import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCNmMDNgT91vrj_BsivKvLewCq2SHXHb2o',
  authDomain: 'checkout-52442.firebaseapp.com',
  projectId: 'checkout-52442',
  storageBucket: 'checkout-52442.firebasestorage.app',
  messagingSenderId: '500953675538',
  appId: '1:500953675538:web:92179889a6dfea7342a5cb',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const rentalsRef = collection(db, 'rentals');
const equipmentRef = collection(db, 'equipment');

const state = {
  user: null,
  route: getRoute(),
  notice: '',
  error: '',
};

function getRoute() {
  return (location.hash || '#/').replace(/^#/, '');
}

function setRoute(route) {
  location.hash = route;
}

function getRouteInfo() {
  const raw = state.route || '/';
  const [path, queryString = ''] = raw.split('?');
  return { path, params: new URLSearchParams(queryString) };
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function displayName(name, unitNumber) {
  return unitNumber ? `${name} #${unitNumber}` : name;
}

function formatDate(value) {
  if (!value) return '—';
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function daysUntil(dateInput) {
  const today = new Date();
  const date = new Date(dateInput);
  const diff = date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.round(diff / 86400000);
}

function setFlash({ notice = '', error = '' } = {}) {
  state.notice = notice;
  state.error = error;
}

function isCurrentRoute(routeBase) {
  return state.route.split('?')[0] === routeBase;
}

function getEl(id) {
  return document.getElementById(id);
}

function setHtmlIfPresent(id, html) {
  const el = getEl(id);
  if (!el) return false;
  el.innerHTML = html;
  return true;
}

function setTextIfPresent(id, text) {
  const el = getEl(id);
  if (!el) return false;
  el.textContent = text;
  return true;
}

function flashMarkup() {
  return `${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ''}${state.notice ? `<div class="success">${escapeHtml(state.notice)}</div>` : ''}`;
}

function shell(content) {
  const route = state.route;
  const nav = [
    ['/', 'Overview'],
    ['/booking', 'Booking'],
    ['/checkout', 'Checkout'],
    ['/checkin', 'Check-in'],
    ['/equipment', 'Equipment'],
  ];

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="eyebrow">Rental management</div>
          <h1>Equipment Tracker</h1>
          <p>Bookings, pickups, returns and inventory from GitHub Pages + Firebase.</p>
        </div>
        <nav class="nav">
          ${nav
            .map(([href, label]) => `<a href="#${href}" class="${route === href ? 'active' : ''}">${label}</a>`)
            .join('')}
        </nav>
        <div class="sidebar-footer card">
          <div class="small muted">Signed in as</div>
          <div>${escapeHtml(state.user?.displayName || state.user?.email || '')}</div>
          <button class="secondary" id="logoutBtn">Log out</button>
        </div>
      </aside>
      <main class="content stack">
        ${flashMarkup()}
        ${content}
      </main>
    </div>
  `;
}

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="auth-shell">
      <div class="card auth-card stack">
        <div>
          <div class="eyebrow">Rental equipment tracker</div>
          <h1>Sign in</h1>
          <p class="muted">Use Google or email/password with Firebase Authentication.</p>
        </div>
        ${flashMarkup()}
        <button class="primary" id="googleLoginBtn">Continue with Google</button>
        <hr class="sep" />
        <form id="emailAuthForm" class="stack">
          <div>
            <label>Email</label>
            <input type="email" name="email" required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" name="password" required />
          </div>
          <div class="row">
            <button class="primary" type="submit" data-mode="login">Log in</button>
            <button class="secondary" type="button" id="registerBtn">Create account</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('googleLoginBtn').onclick = async () => {
    try {
      setFlash();
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setFlash({ error: error.message || 'Google sign-in failed.' });
      render();
    }
  };

  document.getElementById('emailAuthForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setFlash();
      await signInWithEmailAndPassword(auth, form.get('email'), form.get('password'));
    } catch (error) {
      setFlash({ error: error.message || 'Email sign-in failed.' });
      render();
    }
  };

  document.getElementById('registerBtn').onclick = async () => {
    const form = document.getElementById('emailAuthForm');
    const values = new FormData(form);
    try {
      setFlash();
      await createUserWithEmailAndPassword(auth, values.get('email'), values.get('password'));
    } catch (error) {
      setFlash({ error: error.message || 'Registration failed.' });
      render();
    }
  };
}

async function getAllEquipment() {
  const snapshot = await getDocs(equipmentRef);
  return snapshot.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }))
    .map((item) => ({
      ...item,
      name: item.name || 'Unnamed equipment',
      type: item.type || item.category || 'General',
      unitNumber: Number(item.unitNumber) || 1,
      displayName: item.displayName || displayName(item.name || 'Unnamed equipment', Number(item.unitNumber) || 1),
      groupKey: item.groupKey || `${slugify(item.type || item.category || 'General')}__${slugify(item.name || 'Unnamed equipment')}`,
      status: item.status || 'available',
    }))
    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

async function getEquipmentGroups() {
  const items = await getAllEquipment();
  const groups = new Map();
  for (const item of items) {
    const key = item.groupKey;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: item.name,
        type: item.type,
        manufacturer: item.manufacturer || '',
        model: item.model || '',
        description: item.description || '',
        notes: item.notes || '',
        items: [],
      });
    }
    groups.get(key).items.push(item);
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => a.unitNumber - b.unitNumber),
      amount: group.items.length,
      availableCount: group.items.filter((item) => item.status !== 'checked_out').length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getRentalsByStatuses(statuses) {
  if (!statuses.length) return [];
  const q = query(rentalsRef, where('status', 'in', statuses));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((snap) => ({ id: snap.id, ...snap.data() }))
    .sort((a, b) => new Date(a.pickupDate || 0) - new Date(b.pickupDate || 0));
}

async function getRentalById(id) {
  const snap = await getDoc(doc(db, 'rentals', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function createEquipmentGroup(payload) {
  const name = payload.name.trim();
  const type = (payload.type || 'General').trim();
  const amount = Math.max(1, Number(payload.amount) || 1);
  const groupKey = `${slugify(type)}__${slugify(name)}`;
  const existing = (await getAllEquipment()).filter((item) => item.groupKey === groupKey);
  let highest = existing.reduce((max, item) => Math.max(max, Number(item.unitNumber) || 0), 0);
  const batch = writeBatch(db);

  for (let i = 0; i < amount; i += 1) {
    highest += 1;
    batch.set(doc(equipmentRef), {
      name,
      type,
      category: type,
      unitNumber: highest,
      displayName: displayName(name, highest),
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

function parseEquipmentXml(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  if (xml.querySelector('parsererror')) throw new Error('The XML file could not be read.');
  const nodes = Array.from(xml.querySelectorAll('item, equipment, product, asset, entry, record'));
  const sourceNodes = nodes.length ? nodes : Array.from(xml.documentElement.children);

  const readField = (node, names) => {
    for (const name of names) {
      const child = Array.from(node.children).find((x) => x.tagName.toLowerCase() === name.toLowerCase());
      if (child?.textContent?.trim()) return child.textContent.trim();
      const attr = node.getAttribute(name);
      if (attr?.trim()) return attr.trim();
    }
    return '';
  };

  const rows = sourceNodes
    .map((node) => ({
      name: readField(node, ['name', 'title', 'label', 'equipmentname', 'description']),
      type: readField(node, ['type', 'category', 'group', 'department', 'equipmenttype']),
      amount: Math.max(1, parseInt(readField(node, ['amount', 'qty', 'quantity', 'count', 'units']) || '1', 10) || 1),
      manufacturer: readField(node, ['manufacturer', 'brand', 'make']),
      model: readField(node, ['model']),
      description: readField(node, ['description', 'details']),
      notes: readField(node, ['notes', 'comment', 'comments']),
    }))
    .filter((row) => row.name);

  if (!rows.length) throw new Error('No equipment entries were found in the XML file.');
  return rows;
}

async function importEquipmentRows(rows) {
  const existing = await getAllEquipment();
  const highestByGroup = new Map();
  existing.forEach((item) => highestByGroup.set(item.groupKey, Math.max(highestByGroup.get(item.groupKey) || 0, item.unitNumber)));
  const batch = writeBatch(db);
  for (const row of rows) {
    const name = row.name.trim();
    const type = (row.type || 'General').trim();
    const amount = Math.max(1, Number(row.amount) || 1);
    const groupKey = `${slugify(type)}__${slugify(name)}`;
    let nextUnit = highestByGroup.get(groupKey) || 0;
    for (let i = 0; i < amount; i += 1) {
      nextUnit += 1;
      batch.set(doc(equipmentRef), {
        name,
        type,
        category: type,
        unitNumber: nextUnit,
        displayName: displayName(name, nextUnit),
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
  }
  await batch.commit();
}

async function deleteEquipmentItem(id) {
  await deleteDoc(doc(db, 'equipment', id));
}

async function createRental(payload) {
  await addDoc(rentalsRef, {
    ...payload,
    status: 'booked',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function updateRental(rentalId, payload) {
  await updateDoc(doc(db, 'rentals', rentalId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  if (!payload.items?.length) return;
  const batch = writeBatch(db);
  for (const item of payload.items) {
    if (!item.equipmentId) continue;
    let nextStatus = 'available';
    if (payload.status === 'checked_out') nextStatus = item.pickedUp ? 'checked_out' : 'available';
    if (payload.status === 'completed' || payload.status === 'partial_return') nextStatus = item.returned ? 'available' : 'checked_out';
    batch.update(doc(db, 'equipment', item.equipmentId), { status: nextStatus, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

function rentalCard(rental, actionRoute, actionLabel) {
  return `
    <article class="card rental-card">
      <div class="row spread">
        <div>
          <div class="row"><span class="badge ${rental.status}">${escapeHtml(rental.status)}</span><span class="badge">${(rental.items || []).length} items</span></div>
          <h3>${escapeHtml(rental.renterName || 'Unnamed renter')}</h3>
          <div class="muted">${escapeHtml(rental.company || rental.email || rental.phone || 'No contact info')}</div>
        </div>
        <a class="btn-link secondary" href="#${actionRoute}?booking=${rental.id}">${actionLabel}</a>
      </div>
      <div class="grid two">
        <div><div class="muted small">Pickup</div><div>${escapeHtml(formatDate(rental.pickupDate))}</div></div>
        <div><div class="muted small">Return</div><div>${escapeHtml(formatDate(rental.returnDate))}</div></div>
      </div>
      <div class="item-pills">${(rental.items || []).map((item) => `<span class="pill">${escapeHtml(item.name)}</span>`).join('')}</div>
    </article>`;
}

function renderDashboard() {
  return shell(`
    <div class="page-header">
      <div><div class="eyebrow">Overview</div><h2>Current bookings and checkouts</h2><p>The page shell is local on GitHub. Lists are loaded from Firebase after the page appears.</p></div>
      <div class="row">
        <a class="btn-link primary" href="#/booking">New booking</a>
        <a class="btn-link secondary" href="#/equipment">Manage equipment</a>
      </div>
    </div>
    <section class="grid four" id="dashboardStats">
      <div class="card stat"><div class="muted small">Active rentals</div><strong>—</strong></div>
      <div class="card stat"><div class="muted small">Pickups today</div><strong>—</strong></div>
      <div class="card stat"><div class="muted small">Returns today</div><strong>—</strong></div>
      <div class="card stat"><div class="muted small">Overdue</div><strong>—</strong></div>
    </section>
    <section class="grid two">
      <div class="stack"><div class="row spread"><h3>Upcoming bookings</h3><span class="badge" id="bookedCount">…</span></div><div id="dashboardBooked"><div class="card">Loading bookings…</div></div></div>
      <div class="stack"><div class="row spread"><h3>Currently checked out</h3><span class="badge" id="checkedOutCount">…</span></div><div id="dashboardCheckedOut"><div class="card">Loading checkouts…</div></div></div>
    </section>
  `);
}

function setupDashboardPage() {
  const routeBase = '/';
  getRentalsByStatuses(['booked', 'checked_out']).then((rentals) => {
    if (!isCurrentRoute(routeBase)) return;
    const booked = rentals.filter((r) => r.status === 'booked');
    const checkedOut = rentals.filter((r) => r.status === 'checked_out');
    const stats = {
      active: rentals.length,
      pickupsToday: rentals.filter((r) => new Date(r.pickupDate).toDateString() === new Date().toDateString()).length,
      returnsToday: rentals.filter((r) => new Date(r.returnDate).toDateString() === new Date().toDateString()).length,
      overdue: checkedOut.filter((r) => daysUntil(r.returnDate) < 0).length,
    };
    if (!setHtmlIfPresent('dashboardStats', `
      <div class="card stat"><div class="muted small">Active rentals</div><strong>${stats.active}</strong></div>
      <div class="card stat"><div class="muted small">Pickups today</div><strong>${stats.pickupsToday}</strong></div>
      <div class="card stat"><div class="muted small">Returns today</div><strong>${stats.returnsToday}</strong></div>
      <div class="card stat"><div class="muted small">Overdue</div><strong>${stats.overdue}</strong></div>
    `)) return;
    setTextIfPresent('bookedCount', booked.length);
    setTextIfPresent('checkedOutCount', checkedOut.length);
    setHtmlIfPresent('dashboardBooked', booked.length ? booked.map((r) => rentalCard(r, '/checkout', 'Start checkout')).join('') : '<div class="card">No upcoming bookings.</div>');
    setHtmlIfPresent('dashboardCheckedOut', checkedOut.length ? checkedOut.map((r) => rentalCard(r, '/checkin', 'Start check-in')).join('') : '<div class="card">Nothing is currently checked out.</div>');
  }).catch((error) => {
    setFlash({ error: error.message || 'Failed to load overview data.' });
    render();
  });
}

function renderBooking() {
  return shell(`
    <div class="page-header">
      <div><div class="eyebrow">Booking</div><h2>Create a new booking</h2><p>Add renter details and select individual equipment units.</p></div>
    </div>
    <form id="bookingForm" class="stack">
      <section class="card grid two">
        <div><label>Renter name</label><input name="renterName" required /></div>
        <div><label>Company / department</label><input name="company" /></div>
        <div><label>Email</label><input type="email" name="email" /></div>
        <div><label>Phone</label><input name="phone" /></div>
        <div><label>Pickup date</label><input type="date" name="pickupDate" required /></div>
        <div><label>Return date</label><input type="date" name="returnDate" required /></div>
        <div class="grid" style="grid-column:1/-1"><div><label>Notes</label><textarea name="notes"></textarea></div></div>
      </section>
      <section class="grid two">
        <div class="card stack">
          <div class="row spread"><div><h3>Search equipment</h3><div class="muted small">Only currently available units are shown.</div></div><input id="equipmentSearch" placeholder="Search name or type" style="max-width:220px" /></div>
          <div class="search-results" id="equipmentSearchResults"></div>
          <div class="row"><input id="customItemInput" placeholder="Add a custom item" /><button class="secondary" type="button" id="addCustomItemBtn">Add custom item</button></div>
        </div>
        <div class="card stack"><h3>Selected equipment</h3><div class="selected-list" id="selectedEquipmentList"></div></div>
      </section>
      <div class="row"><button class="primary" type="submit">Save booking</button><span class="muted small">Add at least one item.</span></div>
    </form>
  `);
}

function setupBookingPage() {
  const routeBase = '/booking';
  const selectedItems = [];
  const resultsEl = getEl('equipmentSearchResults');
  const selectedEl = getEl('selectedEquipmentList');
  const searchInput = getEl('equipmentSearch');
  if (!resultsEl || !selectedEl || !searchInput) return;
  let catalog = [];

  getAllEquipment().then((items) => {
    if (!isCurrentRoute(routeBase)) return;
    catalog = items.filter((item) => item.status !== 'checked_out');
    renderResults();
  }).catch((error) => {
    setFlash({ error: error.message || 'Failed to load equipment catalog.' });
    render();
  });

  const renderSelected = () => {
    selectedEl.innerHTML = selectedItems.length ? selectedItems.map((item, index) => `
      <div class="selected-row">
        <div><strong>${escapeHtml(item.name)}</strong><div class="muted small">${escapeHtml(item.type || '')}</div></div>
        <button class="ghost" type="button" data-remove-index="${index}">Remove</button>
      </div>
    `).join('') : '<div class="muted">No equipment added yet.</div>';
    selectedEl.querySelectorAll('[data-remove-index]').forEach((btn) => {
      btn.onclick = () => {
        selectedItems.splice(Number(btn.dataset.removeIndex), 1);
        renderSelected();
      };
    });
  };

  const renderResults = () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q ? catalog.filter((item) => [item.displayName, item.name, item.type].filter(Boolean).some((v) => v.toLowerCase().includes(q))) : catalog;
    resultsEl.innerHTML = filtered.length ? filtered.map((item) => `
      <div class="result-row">
        <div><strong>${escapeHtml(item.displayName)}</strong><div class="muted small">${escapeHtml([item.type, item.manufacturer, item.model].filter(Boolean).join(' • ') || 'No details')}</div></div>
        <button class="secondary" type="button" data-add-id="${item.id}">Add</button>
      </div>
    `).join('') : '<div class="muted">No equipment matches your search.</div>';
    resultsEl.querySelectorAll('[data-add-id]').forEach((btn) => {
      btn.onclick = () => {
        const item = catalog.find((row) => row.id === btn.dataset.addId);
        if (!item) return;
        selectedItems.push({
          equipmentId: item.id,
          name: item.displayName,
          equipmentName: item.name,
          type: item.type,
          serialNumber: item.serialNumber || '',
          unitNumber: item.unitNumber || null,
          pickedUp: false,
          returned: false,
        });
        renderSelected();
      };
    });
  };

  searchInput.oninput = renderResults;
  const addCustomItemBtn = getEl('addCustomItemBtn');
  if (addCustomItemBtn) addCustomItemBtn.onclick = () => {
    const input = getEl('customItemInput');
    if (!input.value.trim()) return;
    selectedItems.push({ equipmentId: null, name: input.value.trim(), equipmentName: input.value.trim(), type: 'Custom', pickedUp: false, returned: false });
    input.value = '';
    renderSelected();
  };
  renderSelected();

  const bookingForm = getEl('bookingForm');
  if (!bookingForm) return;
  bookingForm.onsubmit = async (event) => {
    event.preventDefault();
    if (!selectedItems.length) {
      setFlash({ error: 'Add at least one equipment item before saving.' });
      render();
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await createRental({
        renterName: form.get('renterName'),
        company: form.get('company'),
        email: form.get('email'),
        phone: form.get('phone'),
        pickupDate: form.get('pickupDate'),
        returnDate: form.get('returnDate'),
        notes: form.get('notes'),
        items: selectedItems,
      });
      setFlash({ notice: 'Booking created successfully.' });
      setRoute('/');
    } catch (error) {
      setFlash({ error: error.message || 'Failed to create booking.' });
      render();
    }
  };
}

function renderCheckout() {
  return shell(`
    <div class="page-header"><div><div class="eyebrow">Checkout</div><h2>Prepare equipment pickup</h2><p>Find the booking, tick off found items, add extra items, or remove unwanted ones.</p></div></div>
    <section class="card stack">
      <div><label>Select booking</label><select id="checkoutBookingSelect"><option value="">Loading bookings…</option></select></div>
    </section>
    <div id="checkoutDetails"></div>
  `);
}

function setupCheckoutPage() {
  const routeBase = '/checkout';
  const select = getEl('checkoutBookingSelect');
  const details = getEl('checkoutDetails');
  if (!select || !details) return;
  const bookingId = new URLSearchParams(location.hash.split('?')[1] || '').get('booking') || '';
  if (select) {
    select.onchange = () => setRoute(select.value ? `/checkout?booking=${select.value}` : '/checkout');
  }

  getRentalsByStatuses(['booked']).then((bookings) => {
    if (!isCurrentRoute(routeBase)) return;
    const options = bookings.map((booking) => `<option value="${booking.id}" ${booking.id === bookingId ? 'selected' : ''}>${escapeHtml(booking.renterName)} — ${escapeHtml(formatDate(booking.pickupDate))} to ${escapeHtml(formatDate(booking.returnDate))}</option>`).join('');
    select.innerHTML = `<option value="">Choose a booking…</option>${options}`;
  }).catch((error) => {
    select.innerHTML = '<option value="">Failed to load bookings</option>';
    setFlash({ error: error.message || 'Failed to load bookings.' });
    render();
  });

  if (!bookingId) {
    details.innerHTML = '<section class="card">Choose a booking to start checkout.</section>';
    return;
  }

  details.innerHTML = '<section class="card">Loading booking details…</section>';
  Promise.all([getRentalById(bookingId), getAllEquipment()]).then(([rental, catalog]) => {
    if (!isCurrentRoute(routeBase)) return;
    if (!rental) {
      details.innerHTML = '<section class="card">Booking not found.</section>';
      return;
    }
    const items = structuredClone(rental.items || []);
    details.innerHTML = `
      <section class="card stack">
        <div class="row spread"><div><h3>${escapeHtml(rental.renterName)}</h3><div class="muted">Pickup ${escapeHtml(formatDate(rental.pickupDate))} • Return ${escapeHtml(formatDate(rental.returnDate))}</div></div><div class="badge" id="checkoutPickedCount">${(items || []).filter((i) => i.pickedUp).length}/${(items || []).length} picked</div></div>
        <div class="checklist" id="checkoutChecklist"></div>
      </section>
      <section class="card stack">
        <div class="row spread"><div><h3>Add more equipment</h3><div class="muted small">Only available units can be added.</div></div><input id="checkoutEquipmentSearch" placeholder="Search equipment" style="max-width:220px" /></div>
        <div class="search-results" id="checkoutEquipmentResults"></div>
        <div class="row"><button class="primary" id="saveCheckoutBtn">Save checkout</button></div>
      </section>
    `;
    const list = getEl('checkoutChecklist');
    const results = getEl('checkoutEquipmentResults');
    const search = getEl('checkoutEquipmentSearch');
    const pickedCountEl = getEl('checkoutPickedCount');
    const saveCheckoutBtn = getEl('saveCheckoutBtn');
    if (!list || !results || !search || !pickedCountEl || !saveCheckoutBtn) return;
    const availableCatalog = catalog.filter((item) => item.status !== 'checked_out');

    const renderChecklist = () => {
      pickedCountEl.textContent = `${items.filter((i) => i.pickedUp).length}/${items.length} picked`;
      list.innerHTML = items.length ? items.map((item, index) => `
        <div class="check-row ${item.pickedUp ? 'checked' : ''}">
          <input type="checkbox" data-pick-index="${index}" ${item.pickedUp ? 'checked' : ''} />
          <div style="flex:1"><strong>${escapeHtml(item.name)}</strong><div class="muted small">${escapeHtml(item.serialNumber || item.type || 'No serial')}</div></div>
          <button class="ghost" type="button" data-remove-index="${index}">Remove</button>
        </div>
      `).join('') : '<div class="muted">No items on this booking.</div>';
      list.querySelectorAll('[data-pick-index]').forEach((el) => el.onchange = () => { items[Number(el.dataset.pickIndex)].pickedUp = el.checked; renderChecklist(); });
      list.querySelectorAll('[data-remove-index]').forEach((el) => el.onclick = () => { items.splice(Number(el.dataset.removeIndex), 1); renderChecklist(); });
    };

    const renderResults = () => {
      const q = search.value.trim().toLowerCase();
      const filtered = q ? availableCatalog.filter((item) => [item.displayName, item.name, item.type].filter(Boolean).some((v) => v.toLowerCase().includes(q))) : availableCatalog;
      results.innerHTML = filtered.map((item) => `
        <div class="result-row">
          <div><strong>${escapeHtml(item.displayName)}</strong><div class="muted small">${escapeHtml(item.type)}</div></div>
          <button class="secondary" type="button" data-add-id="${item.id}">Add</button>
        </div>
      `).join('') || '<div class="muted">No equipment found.</div>';
      results.querySelectorAll('[data-add-id]').forEach((btn) => btn.onclick = () => {
        const item = availableCatalog.find((row) => row.id === btn.dataset.addId);
        if (!item) return;
        items.push({ equipmentId: item.id, name: item.displayName, equipmentName: item.name, type: item.type, serialNumber: item.serialNumber || '', unitNumber: item.unitNumber || null, pickedUp: false, returned: false });
        renderChecklist();
      });
    };

    search.oninput = renderResults;
    renderChecklist();
    renderResults();

    saveCheckoutBtn.onclick = async () => {
      try {
        await updateRental(rental.id, { items, status: 'checked_out', checkedOutAt: new Date().toISOString() });
        setFlash({ notice: 'Checkout saved.' });
        setRoute('/');
      } catch (error) {
        setFlash({ error: error.message || 'Failed to save checkout.' });
        render();
      }
    };
  }).catch((error) => {
    details.innerHTML = '<section class="card">Failed to load checkout data.</section>';
    setFlash({ error: error.message || 'Failed to load checkout data.' });
    render();
  });
}


function renderCheckin() {
  return shell(`
    <div class="page-header"><div><div class="eyebrow">Check-in</div><h2>Register returned equipment</h2><p>Tick off each item as it comes back.</p></div></div>
    <section class="card"><label>Select active checkout</label><select id="checkinRentalSelect"><option value="">Loading active checkouts…</option></select></section>
    <div id="checkinDetails"></div>
  `);
}

function setupCheckinPage() {
  const routeBase = '/checkin';
  const select = getEl('checkinRentalSelect');
  const details = getEl('checkinDetails');
  if (!select || !details) return;
  const bookingId = new URLSearchParams(location.hash.split('?')[1] || '').get('booking') || '';
  if (select) select.onchange = () => setRoute(select.value ? `/checkin?booking=${select.value}` : '/checkin');

  getRentalsByStatuses(['checked_out']).then((rentals) => {
    if (!isCurrentRoute(routeBase)) return;
    const options = rentals.map((rental) => `<option value="${rental.id}" ${rental.id === bookingId ? 'selected' : ''}>${escapeHtml(rental.renterName)} — due ${escapeHtml(formatDate(rental.returnDate))}</option>`).join('');
    select.innerHTML = `<option value="">Choose a checkout…</option>${options}`;
  }).catch((error) => {
    select.innerHTML = '<option value="">Failed to load checkouts</option>';
    setFlash({ error: error.message || 'Failed to load active checkouts.' });
    render();
  });

  if (!bookingId) {
    details.innerHTML = '<section class="card">Choose an active checkout to start check-in.</section>';
    return;
  }
  details.innerHTML = '<section class="card">Loading checkout details…</section>';
  getRentalById(bookingId).then((rental) => {
    if (!isCurrentRoute(routeBase)) return;
    if (!rental) {
      details.innerHTML = '<section class="card">Checkout not found.</section>';
      return;
    }
    const items = structuredClone(rental.items || []);
    details.innerHTML = `<section class="card stack"><div class="row spread"><div><h3>${escapeHtml(rental.renterName)}</h3><div class="muted">Due ${escapeHtml(formatDate(rental.returnDate))}</div></div><div class="badge" id="checkinReturnedCount">${(items || []).filter((i) => i.returned).length}/${(items || []).length} returned</div></div><div class="checklist" id="checkinChecklist"></div><div class="row"><button class="primary" id="saveCheckinBtn">Save check-in</button></div></section>`;
    const list = getEl('checkinChecklist');
    const returnedCountEl = getEl('checkinReturnedCount');
    const saveCheckinBtn = getEl('saveCheckinBtn');
    if (!list || !returnedCountEl || !saveCheckinBtn) return;
    const renderChecklist = () => {
      returnedCountEl.textContent = `${items.filter((i) => i.returned).length}/${items.length} returned`;
      list.innerHTML = items.map((item, index) => `
        <div class="check-row ${item.returned ? 'checked' : ''}">
          <input type="checkbox" data-return-index="${index}" ${item.returned ? 'checked' : ''} />
          <div><strong>${escapeHtml(item.name)}</strong><div class="muted small">${escapeHtml(item.serialNumber || item.type || 'No serial')}</div></div>
        </div>
      `).join('');
      list.querySelectorAll('[data-return-index]').forEach((el) => {
        el.onchange = () => {
          const index = Number(el.getAttribute('data-return-index'));
          items[index].returned = el.checked;
          renderChecklist();
        };
      });
    };
    renderChecklist();
    saveCheckinBtn.onclick = async () => {
      try {
        const allReturned = items.every((item) => item.returned);
        await updateRental(rental.id, { items, status: allReturned ? 'completed' : 'partial_return', checkedInAt: new Date().toISOString() });
        setFlash({ notice: allReturned ? 'Check-in completed.' : 'Partial return saved.' });
        setRoute('/');
      } catch (error) {
        setFlash({ error: error.message || 'Failed to save check-in.' });
        render();
      }
    };
  }).catch((error) => {
    details.innerHTML = '<section class="card">Failed to load rental details.</section>';
    setFlash({ error: error.message || 'Failed to load rental details.' });
    render();
  });
}


function renderEquipment() {
  const routeInfo = getRouteInfo();
  const selectedGroup = routeInfo.params.get('group') || '';
  return shell(`
    <div class="page-header"><div><div class="eyebrow">Equipment</div><h2>Manage your equipment inventory</h2><p>See one row per equipment type, then open a group to manage the individual units.</p></div></div>
    <section class="grid two equipment-top-grid">
      <form id="equipmentForm" class="card stack">
        <div><h3>Add new equipment type</h3><div class="muted small">Create a new equipment group and the first numbered units in one step.</div></div>
        <div class="grid two">
          <div><label>Name</label><input name="name" required /></div>
          <div><label>Type</label><input name="type" required /></div>
          <div><label>Amount</label><input type="number" min="1" name="amount" value="1" required /></div>
          <div><label>Manufacturer</label><input name="manufacturer" /></div>
          <div><label>Model</label><input name="model" /></div>
          <div><label>Description</label><input name="description" /></div>
        </div>
        <div><label>Notes</label><textarea name="notes"></textarea></div>
        <div class="row"><button class="primary" type="submit">Add equipment type</button></div>
      </form>
      <section class="card stack">
        <div><h3>Import XML</h3><div class="muted small">Supports common tags like name, type, amount, quantity, manufacturer and model.</div></div>
        <input type="file" id="xmlFileInput" accept=".xml,text/xml" />
        <div id="xmlPreview" class="muted small">No XML file selected.</div>
        <div class="row"><button class="secondary" id="importXmlBtn" type="button" disabled>Import XML</button></div>
      </section>
    </section>
    <section class="grid two equipment-main-grid">
      <section class="card stack">
        <div class="row spread"><div><h3>Equipment list</h3><div class="muted small">One row per equipment type with total and available counts.</div></div><input id="equipmentFilter" placeholder="Filter equipment" style="max-width:240px" /></div>
        <div class="list equipment-summary-list" id="equipmentGroupsList"><div class="muted">Loading inventory…</div></div>
      </section>
      <section class="card stack equipment-detail-card" id="equipmentDetailPanel" data-selected-group="${escapeHtml(selectedGroup)}">
        <div>
          <h3>Equipment details</h3>
          <div class="muted small">Open a row on the left to see and manage the individual units.</div>
        </div>
        <div class="muted">No equipment group selected.</div>
      </section>
    </section>
  `);
}

function equipmentGroupSummaryMarkup(group, selectedGroup) {
  const isActive = selectedGroup === group.key;
  return `
    <article class="equipment-summary-row ${isActive ? 'active' : ''}" data-filterable="${escapeHtml(`${group.name} ${group.type} ${group.manufacturer} ${group.model}`.toLowerCase())}">
      <button class="equipment-summary-button" type="button" data-open-group="${escapeHtml(group.key)}">
        <div class="equipment-summary-main">
          <div>
            <h3>${escapeHtml(group.name)}</h3>
            <div class="muted">${escapeHtml([group.type, group.manufacturer, group.model].filter(Boolean).join(' • ') || 'No details')}</div>
          </div>
          <div class="equipment-summary-counts">
            <span class="badge">${group.amount} total</span>
            <span class="badge">${group.availableCount} available</span>
          </div>
        </div>
      </button>
    </article>
  `;
}

function equipmentDetailMarkup(group) {
  return `
    <div class="row spread">
      <div>
        <div class="eyebrow">${escapeHtml(group.type)}</div>
        <h3>${escapeHtml(group.name)}</h3>
        <div class="muted">${escapeHtml([group.manufacturer, group.model].filter(Boolean).join(' • ') || 'No manufacturer or model set')}</div>
      </div>
      <div class="row">
        <span class="badge">${group.amount} total</span>
        <span class="badge">${group.availableCount} available</span>
      </div>
    </div>
    ${group.description ? `<div class="muted small">${escapeHtml(group.description)}</div>` : ''}
    ${group.notes ? `<div class="muted small">Notes: ${escapeHtml(group.notes)}</div>` : ''}
    <form id="addUnitsForm" class="card stack subtle-card">
      <div class="row spread">
        <div>
          <h4>Add more ${escapeHtml(group.name)}</h4>
          <div class="muted small">New units will continue the numbering for this equipment type.</div>
        </div>
      </div>
      <div class="row add-units-row">
        <div class="inline-field">
          <label>Amount</label>
          <input type="number" min="1" name="amount" value="1" required />
        </div>
        <button class="primary" type="submit">Add units</button>
      </div>
    </form>
    <div class="stack">
      <div class="row spread"><h4>Individual units</h4><span class="muted small">Remove only the specific unit you no longer want in inventory.</span></div>
      <div class="equipment-unit-list">
        ${group.items.map((item) => `
          <div class="equipment-unit-row">
            <div>
              <strong>${escapeHtml(item.displayName)}</strong>
              <div class="muted small">${escapeHtml(item.status)}${item.location ? ` • ${escapeHtml(item.location)}` : ''}</div>
            </div>
            <button class="danger" type="button" data-delete-equipment="${item.id}">Remove</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function setupEquipmentPage() {
  const routeBase = '/equipment';
  let importRows = [];
  const routeInfo = getRouteInfo();
  const selectedGroup = routeInfo.params.get('group') || '';

  getEquipmentGroups().then((groups) => {
    if (!isCurrentRoute(routeBase)) return;
    const listEl = document.getElementById('equipmentGroupsList');
    const detailEl = document.getElementById('equipmentDetailPanel');
    if (listEl) {
      listEl.innerHTML = groups.length
        ? groups.map((group) => equipmentGroupSummaryMarkup(group, selectedGroup)).join('')
        : '<div class="muted">No equipment added yet.</div>';
    }
    document.querySelectorAll('[data-open-group]').forEach((btn) => {
      btn.onclick = () => setRoute(`/equipment?group=${encodeURIComponent(btn.dataset.openGroup)}`);
    });

    const chosenGroup = groups.find((group) => group.key === selectedGroup);
    if (detailEl) {
      detailEl.innerHTML = chosenGroup
        ? equipmentDetailMarkup(chosenGroup)
        : `
          <div>
            <h3>Equipment details</h3>
            <div class="muted small">Open a row on the left to see and manage the individual units.</div>
          </div>
          <div class="muted">No equipment group selected.</div>
        `;
    }

    document.querySelectorAll('[data-delete-equipment]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Remove this individual equipment item?')) return;
        try {
          await deleteEquipmentItem(btn.dataset.deleteEquipment);
          setFlash({ notice: 'Equipment item removed.' });
          render();
        } catch (error) {
          setFlash({ error: error.message || 'Failed to remove equipment item.' });
          render();
        }
      };
    });

    const addUnitsForm = getEl('addUnitsForm');
    if (addUnitsForm && chosenGroup) {
      addUnitsForm.onsubmit = async (event) => {
        event.preventDefault();
        const values = new FormData(addUnitsForm);
        try {
          await createEquipmentGroup({
            name: chosenGroup.name,
            type: chosenGroup.type,
            amount: values.get('amount'),
            manufacturer: chosenGroup.manufacturer,
            model: chosenGroup.model,
            description: chosenGroup.description,
            notes: chosenGroup.notes,
          });
          setFlash({ notice: `${chosenGroup.name} updated.` });
          render();
        } catch (error) {
          setFlash({ error: error.message || 'Failed to add equipment units.' });
          render();
        }
      };
    }
  }).catch((error) => {
    const listEl = document.getElementById('equipmentGroupsList');
    const detailEl = document.getElementById('equipmentDetailPanel');
    if (listEl) listEl.innerHTML = '<div class="error">Failed to load inventory.</div>';
    if (detailEl) detailEl.innerHTML = `<div class="error">${escapeHtml(error.message || 'Failed to load equipment details.')}</div>`;
  });

  const form = getEl('equipmentForm');
  const xmlInput = getEl('xmlFileInput');
  const xmlPreview = getEl('xmlPreview');
  const importBtn = getEl('importXmlBtn');
  const filterInput = getEl('equipmentFilter');
  if (!form || !xmlInput || !xmlPreview || !importBtn || !filterInput) return;

  form.onsubmit = async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    try {
      await createEquipmentGroup(Object.fromEntries(values.entries()));
      setFlash({ notice: 'Equipment added successfully.' });
      render();
    } catch (error) {
      setFlash({ error: error.message || 'Failed to add equipment.' });
      render();
    }
  };

  xmlInput.onchange = async () => {
    const file = xmlInput.files?.[0];
    if (!file) return;
    try {
      importRows = parseEquipmentXml(await file.text());
      xmlPreview.textContent = `Loaded ${importRows.length} equipment rows from ${file.name}.`;
      importBtn.disabled = false;
    } catch (error) {
      importRows = [];
      importBtn.disabled = true;
      xmlPreview.textContent = error.message || 'Failed to read XML.';
    }
  };

  importBtn.onclick = async () => {
    try {
      await importEquipmentRows(importRows);
      setFlash({ notice: 'XML import completed.' });
      render();
    } catch (error) {
      setFlash({ error: error.message || 'Failed to import XML.' });
      render();
    }
  };

  filterInput.oninput = () => {
    const q = filterInput.value.trim().toLowerCase();
    document.querySelectorAll('[data-filterable]').forEach((el) => {
      el.classList.toggle('hidden', q && !el.dataset.filterable.includes(q));
    });
  };
}

async function renderRoute() {
  switch (state.route.split('?')[0]) {
    case '/booking':
      return renderBooking();
    case '/checkout':
      return renderCheckout();
    case '/checkin':
      return renderCheckin();
    case '/equipment':
      return renderEquipment();
    case '/':
    default:
      return renderDashboard();
  }
}

function setupRoute() {
  if (document.getElementById('logoutBtn')) {
    document.getElementById('logoutBtn').onclick = async () => {
      await signOut(auth);
      setFlash({ notice: 'Logged out.' });
      render();
    };
  }

  switch (state.route.split('?')[0]) {
    case '/booking':
      setupBookingPage();
      break;
    case '/checkout':
      setupCheckoutPage();
      break;
    case '/checkin':
      setupCheckinPage();
      break;
    case '/equipment':
      setupEquipmentPage();
      break;
    default:
      setupDashboardPage();
      break;
  }
}

async function render() {
  state.route = getRoute();
  const appEl = document.getElementById('app');
  if (!state.user) {
    renderLogin();
    return;
  }
  try {
    appEl.innerHTML = await renderRoute();
    setupRoute();
  } catch (error) {
    appEl.innerHTML = shell(`<div class="error">${escapeHtml(error.message || 'Something went wrong while loading the page.')}</div>`);
    setupRoute();
  }
}

window.addEventListener('hashchange', () => {
  state.route = getRoute();
  render();
});

onAuthStateChanged(auth, (user) => {
  state.user = user;
  render();
});
