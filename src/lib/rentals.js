import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

const rentalsRef = collection(db, 'rentals');
const equipmentRef = collection(db, 'equipment');

export async function getRentalsByStatuses(statuses) {
  if (!statuses.length) return [];

    const q = query(rentalsRef, where('status', 'in', statuses));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => new Date(a.pickupDate || 0) - new Date(b.pickupDate || 0));
}

export async function getAllEquipment() {
  const q = query(equipmentRef, orderBy('name', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
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
}
