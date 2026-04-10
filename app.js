
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

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const rentalsRef = collection(db, 'rentals');
const equipmentRef = collection(db, 'equipment');
const googleProvider = new GoogleAuthProvider();

const state = {
  user: null,
  route: getRoute(),
  flash: { notice: '', error: '' },
  modalGroupKey: '',
  theme: getSavedTheme(),
};

function getSavedTheme() {
  const saved = localStorage.getItem('equipmentTrackerTheme');
  return saved === 'dark' ? 'dark' : 'light';
}
function applyTheme(theme) {
  state.theme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  localStorage.setItem('equipmentTrackerTheme', state.theme);
}
function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  if (state.user) render();
}
applyTheme(state.theme);

function getRoute() {
  return (location.hash || '#/').replace(/^#/, '');
}
function currentPath() {
  return state.route.split('?')[0] || '/';
}
function getRouteParams() {
  return new URLSearchParams(state.route.split('?')[1] || '');
}
function setRoute(path, params = null) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  location.hash = `${path}${query}`;
}
function setFlash({ notice = '', error = '' } = {}) {
  state.flash = { notice, error };
}
function uid() {
  const id = auth.currentUser?.uid;
  if (!id) throw new Error('You must be signed in.');
  return id;
}
function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function dateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value?.seconds) {
    const d = new Date(value.seconds * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayLocal() {
  return dateOnly(new Date());
}
function fmtDate(value) {
  const iso = dateOnly(value);
  if (!iso) return '—';
  const date = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value?.seconds) return value.seconds * 1000;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}
function rentalMatchesFilter(rental, filter) {
  const today = todayLocal();
  const outDate = dateOnly(rental.pickupDate);
  const inDate = dateOnly(rental.returnDate);
  switch (filter) {
    case 'pickups_today':
    case 'out_today':
      return outDate === today;
    case 'returns_today':
    case 'in_today':
      return inDate === today;
    case 'overdue':
      return ['checked_out', 'partial_return'].includes(rental.status) && inDate && inDate < today;
    case 'active':
      return ['booked', 'checked_out', 'partial_return'].includes(rental.status);
    default:
      return true;
  }
}
function sortRentals(rentals, sortBy) {
  const today = todayLocal();
  const list = [...rentals];
  const cmpText = (a, b) => String(a.renterName || a.company || '').localeCompare(String(b.renterName || b.company || ''));
  list.sort((a, b) => {
    if (sortBy === 'out_asc') {
      return dateOnly(a.pickupDate).localeCompare(dateOnly(b.pickupDate)) || cmpText(a, b);
    }
    if (sortBy === 'out_desc') {
      return dateOnly(b.pickupDate).localeCompare(dateOnly(a.pickupDate)) || cmpText(a, b);
    }
    if (sortBy === 'in_desc') {
      return dateOnly(b.returnDate).localeCompare(dateOnly(a.returnDate)) || cmpText(a, b);
    }
    if (sortBy === 'newest') {
      return timestampMs(b.createdAt) - timestampMs(a.createdAt) || cmpText(a, b);
    }
    if (sortBy === 'oldest') {
      return timestampMs(a.createdAt) - timestampMs(b.createdAt) || cmpText(a, b);
    }
    if (sortBy === 'overdue_first') {
      const aOver = ['checked_out', 'partial_return'].includes(a.status) && dateOnly(a.returnDate) < today ? 0 : 1;
      const bOver = ['checked_out', 'partial_return'].includes(b.status) && dateOnly(b.returnDate) < today ? 0 : 1;
      return aOver - bOver || dateOnly(a.returnDate).localeCompare(dateOnly(b.returnDate)) || cmpText(a, b);
    }
    return dateOnly(a.returnDate).localeCompare(dateOnly(b.returnDate)) || cmpText(a, b);
  });
  return list;
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return dateOnly(aStart) <= dateOnly(bEnd) && dateOnly(bStart) <= dateOnly(aEnd);
}
function groupKeyFor(name, type) {
  return `${String(type || 'General').trim()}::${String(name || '').trim()}`.toLowerCase();
}
function unitDisplayName(name, unitNumber) {
  return `${name} #${unitNumber}`;
}
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
function readArray(value) {
  return Array.isArray(value) ? value : [];
}
function sortByName(items) {
  return [...items].sort((a, b) => String(a.displayName || a.name || '').localeCompare(String(b.displayName || b.name || '')));
}

function appShell(content) {
  const nav = [
    ['/', 'Overview'],
    ['/booking', 'Booking'],
    ['/checkout', 'Checkout'],
    ['/checked-out', 'Checked-out'],
    ['/checkin', 'Check-in'],
    ['/equipment', 'Equipment'],
  ];
  return `
    <div class="topbar">
      <div class="brand">Equipment Tracker</div>
      <div class="topbar-right">
        <button id="themeToggleBtn" class="ghost small-btn" type="button">${state.theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
        <div class="signed-in">${esc(state.user?.displayName || state.user?.email || '')}</div>
        <button id="logoutBtn" class="ghost small-btn" type="button">Log out</button>
      </div>
    </div>
    ${flashMarkup()}
    <div class="shell">
      <aside class="sidebar">
        ${nav.map(([href, label]) => `<a class="nav-link ${currentPath() === href ? 'active' : ''}" href="#${href}">${esc(label)}</a>`).join('')}
      </aside>
      <main class="main-content">${content}</main>
    </div>
  `;
}

function flashMarkup() {
  const { notice, error } = state.flash;
  return `
    ${error ? `<div class="flash error">${esc(error)}</div>` : ''}
    ${notice ? `<div class="flash notice">${esc(notice)}</div>` : ''}
  `;
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  if (!state.user) return renderLogin();
  let content = '';
  const path = currentPath();
  if (path === '/booking') content = renderBookingPage();
  else if (path === '/checkout') content = renderCheckoutPage();
  else if (path === '/checked-out') content = renderCheckedOutPage();
  else if (path === '/checkin') content = renderCheckinPage();
  else if (path === '/equipment') content = renderEquipmentPage();
  else content = renderOverviewPage();
  app.innerHTML = appShell(content);
  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    toggleTheme();
  });
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await signOut(auth);
    setFlash({ notice: 'Signed out.' });
  });
  mountPageLogic(path);
}

function renderLogin() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div class="login-shell">
      ${flashMarkup()}
      <div class="login-card">
        <div class="login-head-row">
          <h1>Rental equipment tracker</h1>
          <button id="loginThemeToggleBtn" class="ghost small-btn" type="button">${state.theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
        </div>
        <p class="muted">Sign in with Google or email/password.</p>
        <button id="googleLoginBtn" class="primary wide" type="button">Continue with Google</button>
        <form id="emailAuthForm" class="stack-form">
          <label><span>Email</span><input name="email" type="email" required /></label>
          <label><span>Password</span><input name="password" type="password" required /></label>
          <div class="action-row">
            <button class="primary" type="submit">Log in</button>
            <button id="registerBtn" class="secondary" type="button">Create account</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('loginThemeToggleBtn')?.addEventListener('click', () => {
    toggleTheme();
    renderLogin();
  });
  document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
    try {
      setFlash();
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setFlash({ error: e.message || 'Google sign-in failed.' });
      renderLogin();
    }
  });
  const emailAuthForm = document.getElementById('emailAuthForm');
  if (emailAuthForm) {
    emailAuthForm.onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        setFlash();
        await signInWithEmailAndPassword(auth, form.get('email'), form.get('password'));
      } catch (e) {
        setFlash({ error: e.message || 'Email sign-in failed.' });
        renderLogin();
      }
    };
  }
  document.getElementById('registerBtn')?.addEventListener('click', async () => {
    const formEl = document.getElementById('emailAuthForm');
    if (!formEl) return;
    const form = new FormData(formEl);
    try {
      setFlash();
      await createUserWithEmailAndPassword(auth, form.get('email'), form.get('password'));
    } catch (e) {
      setFlash({ error: e.message || 'Registration failed.' });
      renderLogin();
    }
  });
}

function renderOverviewPage() {
  return `
    <section class="page-block">
      <div class="stats-row stats-row-4" id="overviewStats">
        ${['Active rentals', 'Pickups today', 'Returns today', 'Overdue'].map((label, i) => `
          <div class="stat-card">
            <div class="stat-label">${esc(label)}</div>
            <div class="stat-value" id="stat${i}">—</div>
          </div>`).join('')}
      </div>
    </section>
    <section class="overview-grid">
      <div class="card">
        <div class="section-head"><h2>Upcoming bookings</h2><p class="muted">Booked but not yet checked out.</p></div>
        <div class="action-row wrap">
          <label class="grow">
            <span class="small muted">Filter</span>
            <select id="overviewBookingFilter">
              <option value="all">All</option>
              <option value="pickups_today">Pickups today</option>
              <option value="returns_today">Returns today</option>
              <option value="active">Active rentals</option>
            </select>
          </label>
          <label class="grow">
            <span class="small muted">Sort by</span>
            <select id="overviewBookingSort">
              <option value="out_asc">Out date</option>
              <option value="in_asc">In date</option>
              <option value="newest">Newest created</option>
              <option value="oldest">Oldest created</option>
            </select>
          </label>
        </div>
        <div id="overviewBookings" class="stack-list"><div class="muted">Loading…</div></div>
      </div>
      <div class="card">
        <div class="section-head"><h2>Currently checked out</h2><p class="muted">Jobs that are out right now.</p></div>
        <div class="action-row wrap">
          <label class="grow">
            <span class="small muted">Filter</span>
            <select id="overviewCheckedFilter">
              <option value="all">All checked out</option>
              <option value="out_today">Checkout today</option>
              <option value="in_today">Returns today</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label class="grow">
            <span class="small muted">Sort by</span>
            <select id="overviewCheckedSort">
              <option value="overdue_first">Overdue first</option>
              <option value="in_asc">In date</option>
              <option value="out_asc">Out date</option>
              <option value="newest">Newest created</option>
              <option value="oldest">Oldest created</option>
            </select>
          </label>
        </div>
        <div id="overviewCheckedOut" class="stack-list"><div class="muted">Loading…</div></div>
      </div>
    </section>
  `;
}

function renderBookingPage() {
  return `
    <section class="page-block">
      <div class="section-head">
        <h2>Create booking</h2>
        <p class="muted">Items disappear from search once added.</p>
      </div>
      <form id="bookingForm" class="stack-form">
        <div class="form-grid">
          <label><span>Name</span><input name="renterName" required /></label>
          <label><span>Company</span><input name="company" /></label>
          <label><span>Email</span><input name="email" type="email" /></label>
          <label><span>Phone</span><input name="phone" /></label>
          <label><span>Pickup date</span><input id="pickupDate" name="pickupDate" type="date" required /></label>
          <label><span>Return date</span><input id="returnDate" name="returnDate" type="date" required /></label>
          <label class="span-2"><span>Notes</span><textarea name="notes" rows="3"></textarea></label>
        </div>
        <div id="bookingAvailabilityNote" class="helper-text">Choose dates to check availability.</div>

        <div class="two-column-layout">
          <section class="card list-card">
            <div class="list-card-head">
              <h3>Available equipment</h3>
              <input id="bookingSearch" type="search" placeholder="Search equipment" />
            </div>
            <div id="bookingAvailableList" class="list-scroll"><div class="muted">Loading…</div></div>
          </section>

          <section class="card list-card">
            <div class="list-card-head">
              <h3>Selected for booking</h3>
              <div class="small muted">Scroll inside this section</div>
            </div>
            <div class="action-row wrap">
              <input id="customBookingItemName" class="grow" type="text" placeholder="Add custom item not in equipment list" />
              <input id="customBookingItemType" type="text" placeholder="Type" style="max-width: 180px;" />
              <button id="addCustomBookingItemBtn" class="secondary" type="button">Add custom</button>
            </div>
            <div id="bookingSelectedList" class="list-scroll"><div class="muted">No equipment selected.</div></div>
          </section>
        </div>

        <div class="sticky-actions">
          <button class="primary" type="submit">Save booking</button>
        </div>
      </form>
    </section>
  `;
}

function renderCheckoutPage() {
  return `
    <section class="page-block">
      <div class="section-head">
        <h2>Checkout</h2>
        <p class="muted">Create direct checkout or load a booking.</p>
      </div>

      <div class="card compact-form">
        <div class="action-row wrap">
          <label class="grow">
            <span>Open booking or checkout</span>
            <select id="checkoutRentalSelect"><option value="">Choose…</option></select>
          </label>
          <button id="newDirectCheckoutBtn" class="secondary" type="button">Create direct checkout</button>
        </div>
      </div>

      <div id="checkoutEditor" class="page-block"></div>
    </section>
  `;
}

function renderCheckedOutPage() {
  return `
    <section class="page-block">
      <div class="section-head"><h2>Checked-out</h2><p class="muted">Open an active checkout to edit it.</p></div>
      <div class="card compact-form">
        <div class="action-row wrap">
          <label class="grow">
            <span>Filter</span>
            <select id="checkedOutFilter">
              <option value="all">All checked out</option>
              <option value="out_today">Checkout today</option>
              <option value="in_today">Returns today</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label class="grow">
            <span>Sort by</span>
            <select id="checkedOutSort">
              <option value="overdue_first">Overdue first</option>
              <option value="in_asc">In date</option>
              <option value="out_asc">Out date</option>
              <option value="newest">Newest created</option>
              <option value="oldest">Oldest created</option>
            </select>
          </label>
        </div>
      </div>
      <div id="checkedOutList" class="stack-list"><div class="muted">Loading…</div></div>
    </section>
  `;
}

function renderCheckinPage() {
  return `
    <section class="page-block">
      <div class="section-head">
        <h2>Check-in</h2>
        <p class="muted">Pick returned items into the Returned list.</p>
      </div>
      <div class="card compact-form">
        <label>
          <span>Choose active checkout</span>
          <select id="checkinRentalSelect"><option value="">Choose…</option></select>
        </label>
      </div>
      <div id="checkinEditor" class="page-block"></div>

      <div class="page-block">
        <div class="section-head"><h3>History</h3><p class="muted">Completed and partially returned check-ins.</p></div>
        <div id="checkinHistoryList" class="stack-list"><div class="muted">Loading…</div></div>
      </div>
    </section>
  `;
}

function renderEquipmentPage() {
  return `
    <section class="page-block">
      <div class="section-head">
        <h2>Equipment</h2>
        <p class="muted">Grouped list with total and available counts.</p>
      </div>

      <div class="card compact-form">
        <div class="form-grid">
          <label><span>Name</span><input id="eqName" type="text" /></label>
          <label><span>Type</span><input id="eqType" type="text" /></label>
          <label><span>Amount</span><input id="eqAmount" type="number" min="1" value="1" /></label>
          <label><span>Manufacturer</span><input id="eqManufacturer" type="text" /></label>
          <label><span>Model</span><input id="eqModel" type="text" /></label>
          <label class="span-2"><span>Notes</span><input id="eqNotes" type="text" /></label>
        </div>
        <div class="action-row wrap">
          <button id="addEquipmentBtn" class="primary" type="button">Add equipment</button>
          <input id="xmlFile" type="file" accept=".xml,text/xml,application/xml" />
          <button id="importXmlBtn" class="secondary" type="button">Import XML</button>
        </div>
      </div>

      <div class="card">
        <div class="list-card-head">
          <h3>Inventory</h3>
          <input id="equipmentSearch" type="search" placeholder="Search equipment by name or type" />
        </div>
        <div class="table-wrap">
          <table class="inventory-table">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Total</th><th>Available</th><th></th></tr>
            </thead>
            <tbody id="equipmentGroupTable"><tr><td colspan="5" class="muted">Loading…</td></tr></tbody>
          </table>
        </div>
      </div>

      <div id="equipmentModalHost"></div>
    </section>
  `;
}

function mountPageLogic(path) {
  if (path === '/booking') setupBookingPage();
  else if (path === '/checkout') setupCheckoutPage();
  else if (path === '/checked-out') setupCheckedOutPage();
  else if (path === '/checkin') setupCheckinPage();
  else if (path === '/equipment') setupEquipmentPage();
  else setupOverviewPage();
}

async function getUserEquipment() {
  const q = query(equipmentRef, where('ownerId', '==', uid()));
  const snap = await getDocs(q);
  return sortByName(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}
async function getUserRentals() {
  const q = query(rentalsRef, where('ownerId', '==', uid()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function getRentalById(id) {
  if (!id) return null;
  const ref = doc(db, 'rentals', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = { id: snap.id, ...snap.data() };
  if (data.ownerId !== uid()) throw new Error('Permission denied.');
  return data;
}
async function getEquipmentGroups() {
  const items = await getUserEquipment();
  const groups = new Map();
  for (const item of items) {
    const key = item.groupKey || groupKeyFor(item.name, item.type);
    const existing = groups.get(key) || {
      key,
      name: item.name || item.displayName || 'Unnamed',
      type: item.type || 'General',
      manufacturer: item.manufacturer || '',
      model: item.model || '',
      notes: item.notes || '',
      total: 0,
      available: 0,
      items: [],
    };
    existing.total += 1;
    if ((item.status || 'available') === 'available') existing.available += 1;
    existing.items.push(item);
    groups.set(key, existing);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function createEquipmentGroup(data) {
  const name = String(data.name || '').trim();
  const type = String(data.type || 'General').trim() || 'General';
  const amount = Math.max(1, Number(data.amount || 1));
  if (!name) throw new Error('Equipment name is required.');
  const existing = await getUserEquipment();
  const sameGroup = existing.filter((item) => (item.groupKey || groupKeyFor(item.name, item.type)) === groupKeyFor(name, type));
  let nextNumber = sameGroup.reduce((max, item) => Math.max(max, Number(item.unitNumber || 0)), 0) + 1;
  const batch = writeBatch(db);
  for (let i = 0; i < amount; i += 1) {
    const ref = doc(collection(db, 'equipment'));
    batch.set(ref, {
      ownerId: uid(),
      name,
      type,
      displayName: unitDisplayName(name, nextNumber),
      unitNumber: nextNumber,
      manufacturer: String(data.manufacturer || '').trim(),
      model: String(data.model || '').trim(),
      notes: String(data.notes || '').trim(),
      groupKey: groupKeyFor(name, type),
      status: 'available',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    nextNumber += 1;
  }
  await batch.commit();
}
async function deleteEquipmentItem(id) {
  const ref = doc(db, 'equipment', id);
  await deleteDoc(ref);
}
async function updateEquipmentStatuses(itemIds, status) {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (!uniqueIds.length) return;
  const batch = writeBatch(db);
  uniqueIds.forEach((id) => {
    batch.update(doc(db, 'equipment', id), { status, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}
async function createRental(payload) {
  await addDoc(rentalsRef, { ...payload, ownerId: uid(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
async function updateRental(id, payload) {
  await updateDoc(doc(db, 'rentals', id), { ...payload, updatedAt: serverTimestamp() });
}
async function deleteRental(id) {
  await deleteDoc(doc(db, 'rentals', id));
}

function bookingSummaryCard(rental, kind) {
  const items = readArray(rental.items);
  const hidden = Math.max(0, items.length - 3);
  const deleteBtn = ``;
  const actionBtn = kind === 'booked'
    ? `<a class="secondary small-btn" href="#/checkout?id=${encodeURIComponent(rental.id)}">Open</a>`
    : `<a class="secondary small-btn" href="#/checked-out?id=${encodeURIComponent(rental.id)}">Open</a>`;
  return `
    <div class="card stack-item">
      <div class="item-topline">
        <div>
          <strong>${esc(rental.renterName || rental.company || 'Untitled')}</strong>
          <div class="muted small">Out ${esc(fmtDate(rental.pickupDate))} • In ${esc(fmtDate(rental.returnDate))}</div>
        </div>
        <div class="action-row">${actionBtn}${deleteBtn}</div>
      </div>
      <div class="muted small">${items.slice(0, 3).map((i) => esc(i.name || i.displayName || '')).join(', ')}${hidden ? ` +${hidden} more` : ''}</div>
    </div>
  `;
}

async function setupOverviewPage() {
  try {
    const rentals = await getUserRentals();
    const active = rentals.filter((r) => ['booked', 'checked_out', 'partial_return'].includes(r.status));
    const pickupsToday = rentals.filter((r) => ['booked', 'checked_out'].includes(r.status) && dateOnly(r.pickupDate) === todayLocal()).length;
    const returnsToday = rentals.filter((r) => ['checked_out', 'partial_return'].includes(r.status) && dateOnly(r.returnDate) === todayLocal()).length;
    const overdue = rentals.filter((r) => ['checked_out', 'partial_return'].includes(r.status) && dateOnly(r.returnDate) < todayLocal()).length;
    ['stat0', 'stat1', 'stat2', 'stat3'].forEach((id, idx) => {
      const el = document.getElementById(id);
      if (el) el.textContent = [active.length, pickupsToday, returnsToday, overdue][idx];
    });

    const bookingsEl = document.getElementById('overviewBookings');
    const checkedOutEl = document.getElementById('overviewCheckedOut');
    const bookingFilterEl = document.getElementById('overviewBookingFilter');
    const bookingSortEl = document.getElementById('overviewBookingSort');
    const checkedFilterEl = document.getElementById('overviewCheckedFilter');
    const checkedSortEl = document.getElementById('overviewCheckedSort');

    const renderLists = () => {
      if (bookingsEl) {
        const booked = sortRentals(
          rentals.filter((r) => r.status === 'booked' && rentalMatchesFilter(r, bookingFilterEl?.value || 'all')),
          bookingSortEl?.value || 'out_asc',
        );
        bookingsEl.innerHTML = booked.length ? booked.map((r) => bookingSummaryCard(r, 'booked')).join('') : '<div class="muted">No upcoming bookings match this view.</div>';
      }
      if (checkedOutEl) {
        const checked = sortRentals(
          rentals.filter((r) => ['checked_out', 'partial_return'].includes(r.status) && rentalMatchesFilter(r, checkedFilterEl?.value || 'all')),
          checkedSortEl?.value || 'overdue_first',
        );
        checkedOutEl.innerHTML = checked.length ? checked.map((r) => bookingSummaryCard(r, 'checked_out')).join('') : '<div class="muted">No checked-out jobs match this view.</div>';
      }
    };

    bookingFilterEl?.addEventListener('change', renderLists);
    bookingSortEl?.addEventListener('change', renderLists);
    checkedFilterEl?.addEventListener('change', renderLists);
    checkedSortEl?.addEventListener('change', renderLists);

    renderLists();
    bindDeleteRentalButtons();
  } catch (e) {
    setFlash({ error: e.message || 'Failed to load overview.' });
    render();
  }
}

async function setupEquipmentPage() {
  const tbody = document.getElementById('equipmentGroupTable');
  const searchInput = document.getElementById('equipmentSearch');
  const modalHost = document.getElementById('equipmentModalHost');
  if (!tbody) return;
  let groups = [];

  const renderGroups = () => {
    const q = (searchInput?.value || '').trim().toLowerCase();
    const filtered = !q
      ? groups
      : groups.filter((group) => [group.name, group.type, group.manufacturer, group.model].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    tbody.innerHTML = filtered.length ? filtered.map((group) => `
      <tr>
        <td>${esc(group.name)}</td>
        <td>${esc(group.type)}</td>
        <td>${group.total}</td>
        <td>${group.available}</td>
        <td><button class="secondary small-btn" type="button" data-open-group="${esc(group.key)}">Open</button></td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="muted">No equipment matches your search.</td></tr>';
    document.querySelectorAll('[data-open-group]').forEach((btn) => {
      btn.onclick = () => openEquipmentModal(groups.find((g) => g.key === btn.dataset.openGroup));
    });
  };

  const load = async () => {
    groups = await getEquipmentGroups();
    renderGroups();
  };

  const openEquipmentModal = (group) => {
    if (!group || !modalHost) return;
    modalHost.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card equipment-modal">
          <div class="modal-head">
            <div>
              <h3>${esc(group.name)}</h3>
              <p class="muted">${esc(group.type)} • ${group.total} total • ${group.available} available</p>
            </div>
            <button id="closeEquipmentModal" class="ghost small-btn" type="button">Back</button>
          </div>
          <div class="list-scroll tall-scroll">
            ${sortByName(group.items).map((item) => `
              <div class="item-row">
                <div>
                  <strong>${esc(item.displayName)}</strong>
                  <div class="muted small">${esc(item.status || 'available')}</div>
                </div>
                <button class="ghost danger small-btn" type="button" data-delete-item="${item.id}">Remove</button>
              </div>
            `).join('')}
          </div>
          <div class="sticky-actions">
            <button id="addOneToGroupBtn" class="primary" type="button">Add 1 more</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('closeEquipmentModal')?.addEventListener('click', () => { modalHost.innerHTML = ''; });
    document.getElementById('addOneToGroupBtn')?.addEventListener('click', async () => {
      try {
        await createEquipmentGroup({ name: group.name, type: group.type, amount: 1, manufacturer: group.manufacturer, model: group.model, notes: group.notes });
        await load();
        modalHost.innerHTML = '';
      } catch (e) {
        setFlash({ error: e.message || 'Failed to add equipment.' });
        render();
      }
    });
    document.querySelectorAll('[data-delete-item]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Remove this equipment item?')) return;
        try {
          await deleteEquipmentItem(btn.dataset.deleteItem);
          await load();
          modalHost.innerHTML = '';
        } catch (e) {
          setFlash({ error: e.message || 'Failed to remove equipment item.' });
          render();
        }
      };
    });
  };

  document.getElementById('addEquipmentBtn')?.addEventListener('click', async () => {
    try {
      await createEquipmentGroup({
        name: document.getElementById('eqName')?.value || '',
        type: document.getElementById('eqType')?.value || '',
        amount: document.getElementById('eqAmount')?.value || '1',
        manufacturer: document.getElementById('eqManufacturer')?.value || '',
        model: document.getElementById('eqModel')?.value || '',
        notes: document.getElementById('eqNotes')?.value || '',
      });
      setFlash({ notice: 'Equipment added.' });
      render();
    } catch (e) {
      setFlash({ error: e.message || 'Failed to add equipment.' });
      render();
    }
  });
  document.getElementById('importXmlBtn')?.addEventListener('click', async () => {
    const file = document.getElementById('xmlFile')?.files?.[0];
    if (!file) {
      setFlash({ error: 'Choose an XML file first.' });
      return render();
    }
    try {
      const text = await file.text();
      const rows = parseEquipmentXml(text);
      for (const row of rows) {
        await createEquipmentGroup(row);
      }
      setFlash({ notice: `Imported ${rows.length} rows.` });
      render();
    } catch (e) {
      setFlash({ error: e.message || 'XML import failed.' });
      render();
    }
  });
  searchInput?.addEventListener('input', renderGroups);

  try {
    await load();
  } catch (e) {
    setFlash({ error: e.message || 'Failed to load equipment.' });
    render();
  }
}

function parseEquipmentXml(xmlText) {
  const parser = new DOMParser();
  const docXml = parser.parseFromString(xmlText, 'application/xml');
  if (docXml.querySelector('parsererror')) throw new Error('Invalid XML file.');
  let entries = Array.from(docXml.querySelectorAll('item,equipment,product,asset,entry,record'));
  if (!entries.length && docXml.documentElement) {
    entries = Array.from(docXml.documentElement.children);
  }
  const getValue = (node, names) => {
    for (const name of names) {
      if (node.getAttribute?.(name)) return node.getAttribute(name);
      const child = node.querySelector?.(name);
      if (child?.textContent?.trim()) return child.textContent.trim();
    }
    return '';
  };
  return entries.map((node) => ({
    name: getValue(node, ['name', 'title', 'label', 'equipmentname', 'description']),
    type: getValue(node, ['type', 'category', 'group', 'department', 'equipmenttype']) || 'General',
    amount: Number(getValue(node, ['amount', 'qty', 'quantity', 'count', 'units']) || 1),
    manufacturer: getValue(node, ['manufacturer', 'brand', 'make']),
    model: getValue(node, ['model']),
    notes: getValue(node, ['notes', 'comment', 'comments']),
  })).filter((row) => row.name);
}

function rentalOptionLabel(rental) {
  return `${rental.renterName || rental.company || 'Untitled'} — Out ${fmtDate(rental.pickupDate)} • In ${fmtDate(rental.returnDate)} (${rental.status})`;
}

function normalizeItems(items) {
  return readArray(items).map((item) => ({
    equipmentId: item.equipmentId || null,
    name: item.name || item.displayName || item.equipmentName || '',
    type: item.type || 'General',
    pickedUp: !!item.pickedUp,
    returned: !!item.returned,
  }));
}

async function getUnavailableEquipmentIds(start, end, excludeRentalId = '') {
  if (!start || !end) return new Set();
  const rentals = await getUserRentals();
  const blocking = rentals.filter((r) => r.id !== excludeRentalId && ['booked', 'checked_out', 'partial_return'].includes(r.status) && overlaps(start, end, r.pickupDate, r.returnDate));
  const ids = new Set();
  blocking.forEach((r) => {
    normalizeItems(r.items).forEach((item) => {
      if (item.equipmentId && !item.returned) ids.add(item.equipmentId);
    });
  });
  return ids;
}

async function setupBookingPage() {
  const bookingForm = document.getElementById('bookingForm');
  const availableEl = document.getElementById('bookingAvailableList');
  const selectedEl = document.getElementById('bookingSelectedList');
  const searchInput = document.getElementById('bookingSearch');
  const pickupInput = document.getElementById('pickupDate');
  const returnInput = document.getElementById('returnDate');
  const noteEl = document.getElementById('bookingAvailabilityNote');
  const customNameInput = document.getElementById('customBookingItemName');
  const customTypeInput = document.getElementById('customBookingItemType');
  const addCustomBtn = document.getElementById('addCustomBookingItemBtn');
  if (!bookingForm || !availableEl || !selectedEl || !searchInput || !pickupInput || !returnInput || !noteEl) return;

  let allEquipment = [];
  let unavailableIds = new Set();
  const selected = [];

  const renderSelected = () => {
    selectedEl.innerHTML = selected.length ? selected.map((item, index) => `
      <div class="item-row">
        <div><strong>${esc(item.name)}</strong><div class="muted small">${esc(item.type || '')}${item.equipmentId ? '' : ' • Custom item'}</div></div>
        <button class="ghost small-btn" type="button" data-remove-index="${index}">Remove</button>
      </div>
    `).join('') : '<div class="muted">No equipment selected.</div>';
    selectedEl.querySelectorAll('[data-remove-index]').forEach((btn) => {
      btn.onclick = () => {
        selected.splice(Number(btn.dataset.removeIndex), 1);
        renderSelected();
        renderAvailable();
      };
    });
  };

  const renderAvailable = () => {
    const q = searchInput.value.trim().toLowerCase();
    const selectedIds = new Set(selected.map((item) => item.equipmentId).filter(Boolean));
    const filtered = allEquipment.filter((item) => {
      if ((item.status || 'available') !== 'available') return false;
      if (selectedIds.has(item.id)) return false;
      if (unavailableIds.has(item.id)) return false;
      if (!q) return true;
      return [item.displayName, item.name, item.type, item.manufacturer, item.model].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
    availableEl.innerHTML = filtered.length ? filtered.map((item) => `
      <div class="item-row">
        <div><strong>${esc(item.displayName)}</strong><div class="muted small">${esc(item.type || 'General')}</div></div>
        <button class="secondary small-btn" type="button" data-add-id="${item.id}">Add</button>
      </div>
    `).join('') : '<div class="muted">No equipment matches your search or selected dates.</div>';
    availableEl.querySelectorAll('[data-add-id]').forEach((btn) => {
      btn.onclick = () => {
        const item = allEquipment.find((row) => row.id === btn.dataset.addId);
        if (!item) return;
        selected.push({ equipmentId: item.id, name: item.displayName, type: item.type || 'General', pickedUp: false, returned: false });
        renderSelected();
        renderAvailable();
      };
    });
  };

  async function refreshAvailability() {
    const start = pickupInput.value;
    const end = returnInput.value;
    if (!start || !end) {
      unavailableIds = new Set();
      noteEl.textContent = 'Choose dates to check availability.';
      renderAvailable();
      return;
    }
    unavailableIds = await getUnavailableEquipmentIds(start, end);
    noteEl.textContent = unavailableIds.size ? `${unavailableIds.size} item(s) are already booked or checked out for these dates.` : 'All available items can be booked for these dates.';
    renderAvailable();
  }

  try {
    allEquipment = await getUserEquipment();
    await refreshAvailability();
    renderSelected();
  } catch (e) {
    setFlash({ error: e.message || 'Failed to load booking page.' });
    render();
    return;
  }

  searchInput.addEventListener('input', renderAvailable);
  pickupInput.addEventListener('change', refreshAvailability);
  returnInput.addEventListener('change', refreshAvailability);

  addCustomBtn?.addEventListener('click', () => {
    const name = (customNameInput?.value || '').trim();
    const type = (customTypeInput?.value || '').trim() || 'Custom';
    if (!name) {
      setFlash({ error: 'Enter a custom item name first.' });
      render();
      return;
    }
    selected.push({ equipmentId: null, name, type, pickedUp: false, returned: false });
    if (customNameInput) customNameInput.value = '';
    if (customTypeInput) customTypeInput.value = '';
    renderSelected();
    renderAvailable();
  });

  bookingForm.onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!selected.length) {
      setFlash({ error: 'Add at least one equipment item.' });
      return render();
    }
    try {
      await createRental({
        renterName: form.get('renterName'),
        company: form.get('company'),
        email: form.get('email'),
        phone: form.get('phone'),
        pickupDate: form.get('pickupDate'),
        returnDate: form.get('returnDate'),
        notes: form.get('notes'),
        status: 'booked',
        items: selected,
      });
      setFlash({ notice: 'Booking created.' });
      setRoute('/');
    } catch (e) {
      setFlash({ error: e.message || 'Failed to save booking.' });
      render();
    }
  };
}

function renderCheckoutEditor(rental, allEquipment) {
  const items = normalizeItems(rental?.items);
  const todo = items.filter((item) => !item.pickedUp);
  const picked = items.filter((item) => item.pickedUp);
  const searchOptions = allEquipment.filter((item) => (item.status || 'available') === 'available' && !items.some((row) => row.equipmentId === item.id));
  return `
    <div class="card compact-form">
      <div class="form-grid">
        <label><span>Name</span><input id="checkoutName" value="${esc(rental?.renterName || '')}" /></label>
        <label><span>Company</span><input id="checkoutCompany" value="${esc(rental?.company || '')}" /></label>
        <label><span>Out</span><input id="checkoutOut" type="date" value="${esc(dateOnly(rental?.pickupDate) || todayLocal())}" /></label>
        <label><span>In</span><input id="checkoutIn" type="date" value="${esc(dateOnly(rental?.returnDate) || todayLocal())}" /></label>
      </div>
    </div>

    <div class="two-column-layout">
      <section class="card list-card">
        <div class="list-card-head"><h3>To pick</h3><div class="small muted">${todo.length} left</div></div>
        <div id="checkoutTodoList" class="list-scroll">
          ${todo.length ? todo.map((item) => `
            <div class="item-row">
              <div><strong>${esc(item.name)}</strong><div class="muted small">${esc(item.type || '')}</div></div>
              <button class="secondary small-btn" type="button" data-pick-index="${items.findIndex((row) => row === item)}">Pick</button>
            </div>`).join('') : '<div class="muted">Nothing left to pick.</div>'}
        </div>
      </section>

      <section class="card list-card">
        <div class="list-card-head"><h3>Picked</h3><div class="small muted">${picked.length} picked</div></div>
        <div id="checkoutPickedList" class="list-scroll">
          ${picked.length ? picked.map((item) => `
            <div class="item-row">
              <div><strong>${esc(item.name)}</strong><div class="muted small">${esc(item.type || '')}</div></div>
              <button class="ghost small-btn" type="button" data-unpick-index="${items.findIndex((row) => row === item)}">Move back</button>
            </div>`).join('') : '<div class="muted">No picked items yet.</div>'}
        </div>
      </section>
    </div>

    <div class="card list-card">
      <div class="list-card-head"><h3>Add equipment</h3><input id="checkoutAddSearch" type="search" placeholder="Search available equipment" /></div>
      <div id="checkoutAddList" class="list-scroll short-scroll">
        ${searchOptions.length ? searchOptions.slice(0, 80).map((item) => `
          <div class="item-row">
            <div><strong>${esc(item.displayName)}</strong><div class="muted small">${esc(item.type || '')}</div></div>
            <button class="secondary small-btn" type="button" data-add-equipment="${item.id}">Add</button>
          </div>`).join('') : '<div class="muted">No more available equipment to add.</div>'}
      </div>
    </div>

    <div class="sticky-actions">
      <button id="saveCheckoutBtn" class="primary" type="button">Save checkout</button>
      ${rental?.id && rental.status === 'booked' ? `<button id="deleteCheckoutBtn" class="ghost danger" type="button">Delete booking</button>` : ''}
    </div>

    <script type="application/json" id="checkoutItemsData">${safeJson(items)}</script>
  `;
}

async function setupCheckoutPage() {
  const selectEl = document.getElementById('checkoutRentalSelect');
  const editorEl = document.getElementById('checkoutEditor');
  if (!selectEl || !editorEl) return;
  let rentals = [];
  let allEquipment = [];
  let currentRental = null;

  try {
    rentals = (await getUserRentals()).filter((r) => ['booked', 'checked_out', 'partial_return'].includes(r.status));
    allEquipment = await getUserEquipment();
  } catch (e) {
    setFlash({ error: e.message || 'Failed to load checkout page.' });
    render();
    return;
  }

  const params = getRouteParams();
  const requestedId = params.get('id') || '';
  selectEl.innerHTML = `<option value="">Choose…</option>${rentals.map((r) => `<option value="${r.id}" ${r.id === requestedId ? 'selected' : ''}>${esc(rentalOptionLabel(r))}</option>`).join('')}`;

  async function openRental(rental) {
    currentRental = rental ? { ...rental, items: normalizeItems(rental.items) } : {
      renterName: '',
      company: '',
      pickupDate: todayLocal(),
      returnDate: todayLocal(),
      status: 'checked_out',
      items: [],
    };
    editorEl.innerHTML = renderCheckoutEditor(currentRental, allEquipment);
    bindCheckoutEditor();
  }

  function bindCheckoutEditor() {
    const items = JSON.parse(document.getElementById('checkoutItemsData')?.textContent || '[]');

    function rerenderWithItems(updatedItems) {
      currentRental.items = updatedItems;
      editorEl.innerHTML = renderCheckoutEditor(currentRental, allEquipment);
      bindCheckoutEditor();
    }

    document.querySelectorAll('[data-pick-index]').forEach((btn) => {
      btn.onclick = () => {
        const updated = [...items];
        updated[Number(btn.dataset.pickIndex)].pickedUp = true;
        rerenderWithItems(updated);
      };
    });

    document.querySelectorAll('[data-unpick-index]').forEach((btn) => {
      btn.onclick = () => {
        const updated = [...items];
        updated[Number(btn.dataset.unpickIndex)].pickedUp = false;
        rerenderWithItems(updated);
      };
    });

    const addSearch = document.getElementById('checkoutAddSearch');
    const addList = document.getElementById('checkoutAddList');
    const renderAddList = () => {
      if (!addList) return;
      const q = (addSearch?.value || '').trim().toLowerCase();
      const currentIds = new Set(items.map((item) => item.equipmentId).filter(Boolean));
      const options = allEquipment.filter((item) => (item.status || 'available') === 'available' && !currentIds.has(item.id) && (!q || [item.displayName, item.name, item.type].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))));
      addList.innerHTML = options.length ? options.slice(0, 80).map((item) => `
        <div class="item-row">
          <div><strong>${esc(item.displayName)}</strong><div class="muted small">${esc(item.type || '')}</div></div>
          <button class="secondary small-btn" type="button" data-add-equipment="${item.id}">Add</button>
        </div>`).join('') : '<div class="muted">No more available equipment to add.</div>';
      addList.querySelectorAll('[data-add-equipment]').forEach((btn) => {
        btn.onclick = () => {
          const eq = allEquipment.find((row) => row.id === btn.dataset.addEquipment);
          if (!eq) return;
          rerenderWithItems([...items, { equipmentId: eq.id, name: eq.displayName, type: eq.type || 'General', pickedUp: true, returned: false }]);
        };
      });
    };
    addSearch?.addEventListener('input', renderAddList);
    renderAddList();

    document.getElementById('saveCheckoutBtn')?.addEventListener('click', async () => {
      const payload = {
        renterName: document.getElementById('checkoutName')?.value || '',
        company: document.getElementById('checkoutCompany')?.value || '',
        pickupDate: document.getElementById('checkoutOut')?.value || todayLocal(),
        returnDate: document.getElementById('checkoutIn')?.value || todayLocal(),
        status: items.some((item) => !item.pickedUp) ? 'booked' : 'checked_out',
        items,
      };
      try {
        if (currentRental.id) {
          const before = normalizeItems((await getRentalById(currentRental.id))?.items);
          const addedCheckedOut = items.filter((i) => i.pickedUp && i.equipmentId && !before.some((b) => b.equipmentId === i.equipmentId && b.pickedUp));
          const released = before.filter((b) => b.equipmentId && b.pickedUp && !items.some((i) => i.equipmentId === b.equipmentId && i.pickedUp));
          if (addedCheckedOut.length) await updateEquipmentStatuses(addedCheckedOut.map((i) => i.equipmentId), 'checked_out');
          if (released.length) await updateEquipmentStatuses(released.map((i) => i.equipmentId), 'available');
          await updateRental(currentRental.id, payload);
        } else {
          await createRental(payload);
          const checkedOutIds = items.filter((item) => item.pickedUp && item.equipmentId).map((item) => item.equipmentId);
          if (checkedOutIds.length) await updateEquipmentStatuses(checkedOutIds, 'checked_out');
        }
        setFlash({ notice: 'Checkout saved.' });
        setRoute('/checked-out');
      } catch (e) {
        setFlash({ error: e.message || 'Failed to save checkout.' });
        render();
      }
    });

    document.getElementById('deleteCheckoutBtn')?.addEventListener('click', async () => {
      if (!currentRental?.id || currentRental.status !== 'booked' || !confirm('Delete this booking?')) return;
      try {
        await deleteRental(currentRental.id);
        setFlash({ notice: 'Booking deleted.' });
        setRoute('/');
      } catch (e) {
        setFlash({ error: e.message || 'Failed to delete booking.' });
        render();
      }
    });
  }

  selectEl.addEventListener('change', async () => {
    const id = selectEl.value;
    if (!id) {
      editorEl.innerHTML = '';
      return;
    }
    const rental = rentals.find((r) => r.id === id);
    await openRental(rental);
  });

  document.getElementById('newDirectCheckoutBtn')?.addEventListener('click', async () => {
    selectEl.value = '';
    await openRental(null);
  });

  if (requestedId) {
    const rental = rentals.find((r) => r.id === requestedId);
    if (rental) await openRental(rental);
  }
}

async function setupCheckedOutPage() {
  const listEl = document.getElementById('checkedOutList');
  const filterEl = document.getElementById('checkedOutFilter');
  const sortEl = document.getElementById('checkedOutSort');
  if (!listEl) return;
  try {
    const rentals = (await getUserRentals()).filter((r) => ['checked_out', 'partial_return'].includes(r.status));

    const renderList = () => {
      const filtered = sortRentals(
        rentals.filter((r) => rentalMatchesFilter(r, filterEl?.value || 'all')),
        sortEl?.value || 'overdue_first',
      );

      listEl.innerHTML = filtered.length ? filtered.map((r) => `
        <div class="card stack-item">
          <div class="item-topline">
            <div>
              <strong>${esc(r.renterName || r.company || 'Untitled')}</strong>
              <div class="muted small">Out ${esc(fmtDate(r.pickupDate))} • In ${esc(fmtDate(r.returnDate))}</div>
            </div>
            <div class="action-row">
              <a class="secondary small-btn" href="#/checkout?id=${encodeURIComponent(r.id)}">Edit</a>
            </div>
          </div>
        </div>
      `).join('') : '<div class="muted">No active checkouts match this view.</div>';
    };

    filterEl?.addEventListener('change', renderList);
    sortEl?.addEventListener('change', renderList);

    renderList();
    bindDeleteRentalButtons();
  } catch (e) {
    setFlash({ error: e.message || 'Failed to load checked-out page.' });
    render();
  }
}

function renderCheckinEditor(rental) {
  const items = normalizeItems(rental.items);
  const stillOut = items.filter((item) => item.pickedUp && !item.returned);
  const returned = items.filter((item) => item.returned);
  return `
    <div class="card compact-form">
      <div class="item-topline">
        <div>
          <strong>${esc(rental.renterName || rental.company || 'Untitled')}</strong>
          <div class="muted small">Out ${esc(fmtDate(rental.pickupDate))} • In ${esc(fmtDate(rental.returnDate))}</div>
        </div>
      </div>
    </div>

    <div class="two-column-layout">
      <section class="card list-card">
        <div class="list-card-head"><h3>Still out</h3><div class="small muted">${stillOut.length} left</div></div>
        <div class="list-scroll">
          ${stillOut.length ? stillOut.map((item) => `
            <div class="item-row">
              <div><strong>${esc(item.name)}</strong><div class="muted small">${esc(item.type || '')}</div></div>
              <button class="secondary small-btn" type="button" data-return-index="${items.findIndex((row) => row === item)}">Pick</button>
            </div>`).join('') : '<div class="muted">Nothing left out.</div>'}
        </div>
      </section>

      <section class="card list-card">
        <div class="list-card-head"><h3>Returned</h3><div class="small muted">${returned.length} returned</div></div>
        <div class="list-scroll">
          ${returned.length ? returned.map((item) => `
            <div class="item-row">
              <div><strong>${esc(item.name)}</strong><div class="muted small">${esc(item.type || '')}</div></div>
              <button class="ghost small-btn" type="button" data-unreturn-index="${items.findIndex((row) => row === item)}">Move back</button>
            </div>`).join('') : '<div class="muted">No returned items yet.</div>'}
        </div>
      </section>
    </div>

    <div class="sticky-actions">
      <button id="saveCheckinBtn" class="primary" type="button">Save check-in</button>
    </div>

    <script type="application/json" id="checkinItemsData">${safeJson(items)}</script>
  `;
}

async function setupCheckinPage() {
  const selectEl = document.getElementById('checkinRentalSelect');
  const editorEl = document.getElementById('checkinEditor');
  const historyEl = document.getElementById('checkinHistoryList');
  if (!selectEl || !editorEl || !historyEl) return;

  let rentals = [];
  try {
    rentals = await getUserRentals();
  } catch (e) {
    setFlash({ error: e.message || 'Failed to load check-ins.' });
    render();
    return;
  }

  const active = rentals.filter((r) => ['checked_out', 'partial_return'].includes(r.status));
  const history = rentals.filter((r) => ['completed', 'partial_return'].includes(r.status)).sort((a, b) => dateOnly(b.returnDate).localeCompare(dateOnly(a.returnDate)));
  selectEl.innerHTML = `<option value="">Choose…</option>${active.map((r) => `<option value="${r.id}">${esc(rentalOptionLabel(r))}</option>`).join('')}`;
  historyEl.innerHTML = history.length ? history.map((r) => `
    <div class="card stack-item">
      <div class="item-topline">
        <div>
          <strong>${esc(r.renterName || r.company || 'Untitled')}</strong>
          <div class="muted small">Out ${esc(fmtDate(r.pickupDate))} • In ${esc(fmtDate(r.returnDate))} • ${esc(r.status)}</div>
        </div>
        <a class="secondary small-btn" href="#/checkin?id=${encodeURIComponent(r.id)}">Open</a>
      </div>
    </div>
  `).join('') : '<div class="muted">No check-in history yet.</div>';

  const params = getRouteParams();
  const requestedId = params.get('id') || '';

  async function openRental(rental) {
    if (!rental) {
      editorEl.innerHTML = '';
      return;
    }
    editorEl.innerHTML = renderCheckinEditor(rental);
    bindCheckinEditor(rental);
  }

  function bindCheckinEditor(rental) {
    const items = JSON.parse(document.getElementById('checkinItemsData')?.textContent || '[]');

    function rerender(updatedItems) {
      const updatedRental = { ...rental, items: updatedItems };
      editorEl.innerHTML = renderCheckinEditor(updatedRental);
      bindCheckinEditor(updatedRental);
    }

    document.querySelectorAll('[data-return-index]').forEach((btn) => {
      btn.onclick = () => {
        const updated = [...items];
        updated[Number(btn.dataset.returnIndex)].returned = true;
        rerender(updated);
      };
    });
    document.querySelectorAll('[data-unreturn-index]').forEach((btn) => {
      btn.onclick = () => {
        const updated = [...items];
        updated[Number(btn.dataset.unreturnIndex)].returned = false;
        rerender(updated);
      };
    });

    document.getElementById('saveCheckinBtn')?.addEventListener('click', async () => {
      const updatedItems = JSON.parse(document.getElementById('checkinItemsData')?.textContent || '[]');
      const previousItems = normalizeItems(rental.items);

      const newlyReturnedIds = updatedItems
        .filter((item) => item.equipmentId && item.returned && !previousItems.some((prev) => prev.equipmentId === item.equipmentId && prev.returned))
        .map((item) => item.equipmentId);

      const movedBackOutIds = previousItems
        .filter((prev) => prev.equipmentId && prev.returned && !updatedItems.some((item) => item.equipmentId === prev.equipmentId && item.returned))
        .map((item) => item.equipmentId);

      const pickedItems = updatedItems.filter((item) => item.pickedUp);
      const pickedReturnedCount = pickedItems.filter((item) => item.returned).length;
      const allReturned = pickedItems.length > 0 && pickedReturnedCount === pickedItems.length;
      const anyReturned = pickedReturnedCount > 0;

      try {
        if (newlyReturnedIds.length) await updateEquipmentStatuses(newlyReturnedIds, 'available');
        if (movedBackOutIds.length) await updateEquipmentStatuses(movedBackOutIds, 'checked_out');

        await updateRental(rental.id, {
          items: updatedItems,
          status: allReturned ? 'completed' : (anyReturned ? 'partial_return' : 'checked_out'),
        });

        setFlash({ notice: 'Check-in saved.' });
        setRoute('/checkin');
      } catch (e) {
        setFlash({ error: e.message || 'Failed to save check-in.' });
        render();
      }
    });

  }

  selectEl.addEventListener('change', () => {
    const rental = active.find((r) => r.id === selectEl.value);
    openRental(rental);
  });

  if (requestedId) {
    const requested = rentals.find((r) => r.id === requestedId);
    if (requested) {
      selectEl.value = active.some((r) => r.id === requested.id) ? requested.id : '';
      await openRental(requested);
    }
  }
}

function bindDeleteRentalButtons() {}

window.addEventListener('hashchange', () => {
  state.route = getRoute();
  render();
});

onAuthStateChanged(auth, (user) => {
  state.user = user;
  state.route = getRoute();
  render();
});
