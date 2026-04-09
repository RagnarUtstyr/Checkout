import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

const rentalsRef = collection(db, 'rentals');
const equipmentRef = collection(db, 'equipment');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildEquipmentDisplayName(name, unitNumber) {
  if (!unitNumber) return name;
  return `${name} #${unitNumber}`;
}

function normalizeEquipmentDoc(item) {
  const name = item.name?.trim() || 'Unnamed equipment';
  const type = item.type?.trim() || item.category?.trim() || 'General';
  const unitNumber = Number(item.unitNumber) || 1;

  return {
    ...item,
    name,
    type,
    category: type,
    unitNumber,
    displayName: item.displayName || buildEquipmentDisplayName(name, unitNumber),
    groupKey: item.groupKey || `${slugify(type)}__${slugify(name)}`,
    status: item.status || 'available',
    active: item.active !== false,
  };
}

function groupEquipment(items) {
  const groups = new Map();

  items.forEach((item) => {
    const key = item.groupKey || `${slugify(item.type)}__${slugify(item.name)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: item.name,
        type: item.type,
        category: item.type,
        description: item.description || '',
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        notes: item.notes || '',
        items: [],
      });
    }

    groups.get(key).items.push(item);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => a.unitNumber - b.unitNumber),
      amount: group.items.length,
      availableCount: group.items.filter((item) => item.status !== 'checked_out').length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parseEquipmentXml(xmlText) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('XML import is not available in this browser.');
  }

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const parserError = xml.querySelector('parsererror');

  if (parserError) {
    throw new Error('The XML file could not be read.');
  }

  const candidateNodes = Array.from(
    xml.querySelectorAll('item, equipment, product, asset, entry, record')
  );

  const nodes = candidateNodes.length ? candidateNodes : Array.from(xml.documentElement.children);

  const readField = (node, names) => {
    for (const name of names) {
      const child = Array.from(node.children).find(
        (item) => item.tagName.toLowerCase() === name.toLowerCase()
      );
      if (child?.textContent?.trim()) {
        return child.textContent.trim();
      }
      const attr = node.getAttribute(name);
      if (attr?.trim()) {
        return attr.trim();
      }
    }
    return '';
  };

  const rows = nodes
    .map((node) => {
      const name = readField(node, ['name', 'title', 'label', 'equipmentname', 'description']);
      const type = readField(node, ['type', 'category', 'group', 'department', 'equipmenttype']);
      const amountRaw = readField(node, ['amount', 'qty', 'quantity', 'count', 'units']);
      const manufacturer = readField(node, ['manufacturer', 'brand', 'make']);
      const model = readField(node, ['model']);
      const description = readField(node, ['description', 'details']);
      const notes = readField(node, ['notes', 'comment', 'comments']);

      return {
        name,
        type,
        manufacturer,
        model,
        description,
        notes,
        amount: Math.max(1, Number.parseInt(amountRaw || '1', 10) || 1),
      };
    })
    .filter((item) => item.name);

  if (!rows.length) {
    throw new Error('No equipment entries were found in the XML file.');
  }

  return rows;
}

export async function getRentalsByStatuses(statuses) {
  if (!statuses.length) return [];

  const q = query(rentalsRef, where('status', 'in', statuses));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => new Date(a.pickupDate || 0) - new Date(b.pickupDate || 0));
}

export async function getAllEquipment() {
  const snapshot = await getDocs(equipmentRef);
  return snapshot.docs
    .map((item) => normalizeEquipmentDoc({ id: item.id, ...item.data() }))
    .sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || ''));
}

export async function getEquipmentGroups() {
  const items = await getAllEquipment();
  return groupEquipment(items);
}

export async function createEquipmentGroup(payload) {
  const name = payload.name?.trim();
  if (!name) {
    throw new Error('Equipment name is required.');
  }

  const type = payload.type?.trim() || 'General';
  const amount = Math.max(1, Number(payload.amount) || 1);
  const groupKey = `${slugify(type)}__${slugify(name)}`;

  const existing = (await getAllEquipment()).filter((item) => item.groupKey === groupKey);
  const highestUnit = existing.reduce((max, item) => Math.max(max, Number(item.unitNumber) || 0), 0);

  const batch = writeBatch(db);

  for (let index = 1; index <= amount; index += 1) {
    const unitNumber = highestUnit + index;
    const ref = doc(equipmentRef);
    batch.set(ref, {
      name,
      type,
      category: type,
      unitNumber,
      displayName: buildEquipmentDisplayName(name, unitNumber),
      groupKey,
      manufacturer: payload.manufacturer?.trim() || '',
      model: payload.model?.trim() || '',
      description: payload.description?.trim() || '',
      notes: payload.notes?.trim() || '',
      status: 'available',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function importEquipmentRows(rows) {
  const existing = await getAllEquipment();
  const highestByGroup = new Map();

  existing.forEach((item) => {
    highestByGroup.set(item.groupKey, Math.max(highestByGroup.get(item.groupKey) || 0, item.unitNumber));
  });

  const batch = writeBatch(db);

  rows.forEach((row) => {
    const name = row.name?.trim();
    if (!name) return;

    const type = row.type?.trim() || 'General';
    const amount = Math.max(1, Number(row.amount) || 1);
    const groupKey = `${slugify(type)}__${slugify(name)}`;
    let nextUnit = highestByGroup.get(groupKey) || 0;

    for (let index = 0; index < amount; index += 1) {
      nextUnit += 1;
      const ref = doc(equipmentRef);
      batch.set(ref, {
        name,
        type,
        category: type,
        unitNumber: nextUnit,
        displayName: buildEquipmentDisplayName(name, nextUnit),
        groupKey,
        manufacturer: row.manufacturer?.trim() || '',
        model: row.model?.trim() || '',
        description: row.description?.trim() || '',
        notes: row.notes?.trim() || '',
        status: 'available',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    highestByGroup.set(groupKey, nextUnit);
  });

  await batch.commit();
}

export async function deleteEquipmentItem(equipmentId) {
  await deleteDoc(doc(db, 'equipment', equipmentId));
}

export async function createRental(payload) {
  const docRef = await addDoc(rentalsRef, {
    ...payload,
    status: 'booked',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef;
}

export async function getRentalById(rentalId) {
  const rentalDoc = await getDoc(doc(db, 'rentals', rentalId));
  if (!rentalDoc.exists()) return null;
  return { id: rentalDoc.id, ...rentalDoc.data() };
}

export async function updateRental(rentalId, payload) {
  await updateDoc(doc(db, 'rentals', rentalId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });

  if (!payload.items?.length) {
    return;
  }

  const batch = writeBatch(db);

  payload.items.forEach((item) => {
    if (!item.equipmentId) return;

    let nextStatus = 'available';

    if (payload.status === 'checked_out') {
      nextStatus = item.pickedUp ? 'checked_out' : 'available';
    } else if (payload.status === 'completed' || payload.status === 'partial_return') {
      nextStatus = item.returned ? 'available' : 'checked_out';
    }

    batch.update(doc(db, 'equipment', item.equipmentId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
