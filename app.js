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
  equipmentModalKey: '',
};

function getRoute() {
  return (location.hash || '#/').replace(/^#/, '');
}
function currentPath() {
  return state.route.split('?')[0] || '/';
}
function getRouteParams() {
  return new URLSearchParams((state.route.split('?')[1] || ''));
}
function setRoute(path, params = null) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  location.hash = `${path}${query}`;
}
function setFlash({ notice = '', error = '' } = {}) {
  state.flash = { notice, error };
}
function escapeHtml(v = '') {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function slugify(v) {
  return String(v || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function unitDisplayName(name, unitNumber) {
  return `${name} #${unitNumber}`;
}
function fmtDate(value) {
  if (!value) return '—';
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}
function dateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value?.seconds) {
    const d = new Date(value.seconds * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return dateOnly(aStart) <= dateOnly(bEnd) && dateOnly(bStart) <= dateOnly(aEnd);
}
function uid() {
  const id = auth.currentUser?.uid;
  if (!id) throw new Error('You must be signed in.');
  return id;
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
      <div class="brand">
        <h1>Equipment Tracker</h1>
        <p>Private to the signed-in user</p>
      </div>
      <div class="userbar">
        <span>${escapeHtml(state.user?.displayName || state.user?.email || '')}</span>
        <button class="small ghost" id="logoutBtn">Log out</button>
      </div>
    </div>
    <div class="app-shell">
      ${flashMarkup()}
      <div class="layout">
        <aside class="sidebar">
          ${nav.map(([href, label]) => `<a class="nav-link ${currentPath() === href ? 'active' : ''}" href="#${href}">${label}</a>`).join('')}
        </aside>
        <main class="main-panel">${content}</main>
      </div>
    </div>
  `;
}
function flashMarkup() {
  const { notice, error } = state.flash;
  return `${error ? `<div class="flash error">${escapeHtml(error)}</div>` : ''}${notice ? `<div class="flash notice">${escapeHtml(notice)}</div>` : ''}`;
}
function render() {
  if (!state.user) return renderLogin();
  const path = currentPath();
  let content = '';
  if (path === '/booking') content = renderBookingPage();
  else if (path === '/checkout') content = renderCheckoutPage();
  else if (path === '/checked-out') content = renderCheckedOutPage();
  else if (path === '/checkin') content = renderCheckinPage();
  else if (path === '/equipment') content = renderEquipmentPage();
  else content = renderOverviewPage();
  document.getElementById('app').innerHTML = appShell(content);
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await signOut(auth);
    setFlash({ notice: 'Signed out.' });
  });
  mountPageLogic(path);
}

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      ${flashMarkup()}
      <div class="card login-card">
        <div class="muted small">Rental equipment tracker</div>
        <h1 style="margin-top:8px">Sign in</h1>
        <p class="muted">Use Google or email/password.</p>
        <div class="grid">
          <button id="googleLoginBtn">Continue with Google</button>
          <form id="emailAuthForm" class="grid">
            <div>
              <label>Email</label>
              <input name="email" type="email" required />
            </div>
            <div>
              <label>Password</label>
              <input name="password" type="password" required />
            </div>
            <div class="row">
              <button type="submit">Log in</button>
              <button type="button" class="ghost" id="registerBtn">Create account</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  document.getElementById('googleLoginBtn').onclick = async () => {
    try { setFlash(); await signInWithPopup(auth, googleProvider); } catch (e) { setFlash({ error: e.message || 'Google sign-in failed.' }); renderLogin(); }
  };
  document.getElementById('emailAuthForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { setFlash(); await signInWithEmailAndPassword(auth, form.get('email'), form.get('password')); } catch (e) { setFlash({ error: e.message || 'Email sign-in failed.' }); renderLogin(); }
  };
  document.getElementById('registerBtn').onclick = async () => {
    const form = new FormData(document.getElementById('emailAuthForm'));
    try { setFlash(); await createUserWithEmailAndPassword(auth, form.get('email'), form.get('password')); } catch (e) { setFlash({ error: e.message || 'Registration failed.' }); renderLogin(); }
  };
}

function renderOverviewPage() {
  return `
    <div class="stats">
      <div class="card stat"><h3>Active rentals</h3><div class="value" id="statActive">—</div></div>
      <div class="card stat"><h3>Pickups today</h3><div class="value" id="statPickupsToday">—</div></div>
      <div class="card stat"><h3>Returns today</h3><div class="value" id="statReturnsToday">—</div></div>
      <div class="card stat"><h3>Overdue</h3><div class="value" id="statOverdue">—</div></div>
    </div>
    <div class="section-head">
      <div><h2>Upcoming bookings</h2><div class="muted small">Booked but not yet checked out.</div></div>
      <div><h2>Currently checked out</h2><div class="muted small">Jobs that are out right now.</div></div>
    </div>
    <div class="columns">
      <div class="list" id="overviewBooked"></div>
      <div class="list" id="overviewOut"></div>
    </div>
  `;
}
function renderBookingPage() {
  return `
    <div class="panel">
      <div class="spread"><div><h2 style="margin:0">Create booking</h2><div class="muted small">Items disappear from search once added.</div></div></div>
      <hr class="sep" />
      <form id="bookingForm" class="grid">
        <div class="forms">
          <div><label>Name</label><input name="renterName" required /></div>
          <div><label>Company</label><input name="company" /></div>
          <div><label>Email</label><input name="email" type="email" /></div>
          <div><label>Phone</label><input name="phone" /></div>
          <div><label>Pickup date</label><input name="pickupDate" id="pickupDate" type="date" required /></div>
          <div><label>Return date</label><input name="returnDate" id="returnDate" type="date" required /></div>
          <div class="full"><label>Notes</label><textarea name="notes"></textarea></div>
        </div>
        <div class="card">
          <div class="spread"><strong>Equipment</strong><span class="muted small" id="availabilityNote">Choose dates to check availability.</span></div>
          <div class="grid" style="margin-top:10px">
            <input id="bookingSearch" placeholder="Search equipment" />
            <div class="search-results" id="bookingSearchResults"></div>
          </div>
        </div>
        <div class="card">
          <strong>Selected for booking</strong>
          <div class="selected-list" id="bookingSelectedList" style="margin-top:10px"></div>
        </div>
        <div class="row"><button type="submit">Save booking</button></div>
      </form>
    </div>
  `;
}
function renderCheckoutPage() {
  return `
    <div class="grid">
      <div class="panel">
        <div class="spread"><div><h2 style="margin:0">Checkout</h2><div class="muted small">Create direct checkout or load a booking.</div></div></div>
        <hr class="sep" />
        <div class="twocol">
          <div class="card">
            <label>Open booking or checkout</label>
            <select id="checkoutRentalSelect"><option value="">Choose…</option></select>
          </div>
          <div class="card">
            <button id="newDirectCheckoutBtn" class="ghost">Create direct checkout</button>
          </div>
        </div>
      </div>
      <div id="checkoutWorkspace"></div>
    </div>
  `;
}
function renderCheckedOutPage() {
  return `
    <div class="panel">
      <div class="spread"><div><h2 style="margin:0">Checked-out</h2><div class="muted small">Open an active checkout to edit it.</div></div></div>
      <hr class="sep" />
      <div class="list" id="checkedOutList"></div>
    </div>
  `;
}
function renderCheckinPage() {
  return `
    <div class="panel">
      <div class="spread"><div><h2 style="margin:0">Check-in</h2><div class="muted small">Pick returned items into the Returned list.</div></div></div>
      <hr class="sep" />
      <label>Choose active checkout</label>
      <select id="checkinRentalSelect"><option value="">Choose…</option></select>
      <div id="checkinWorkspace" style="margin-top:16px"></div>
    </div>
  `;
}
function renderEquipmentPage() {
  return `
    <div class="grid">
      <div class="panel">
        <div class="spread"><div><h2 style="margin:0">Equipment</h2><div class="muted small">Grouped list with total and available counts.</div></div></div>
        <hr class="sep" />
        <div class="forms">
          <div><label>Name</label><input id="eqName" /></div>
          <div><label>Type</label><input id="eqType" /></div>
          <div><label>Amount</label><input id="eqAmount" type="number" min="1" value="1" /></div>
          <div><label>Manufacturer</label><input id="eqManufacturer" /></div>
          <div><label>Model</label><input id="eqModel" /></div>
          <div><label>Notes</label><input id="eqNotes" /></div>
        </div>
        <div class="row" style="margin-top:12px">
          <button id="addEquipmentBtn">Add equipment</button>
          <input type="file" id="xmlFile" accept=".xml,text/xml" />
          <button class="ghost" id="importXmlBtn">Import XML</button>
        </div>
      </div>
      <div class="panel">
        <table class="table-like">
          <thead><tr><th>Name</th><th>Type</th><th>Total</th><th>Available</th><th></th></tr></thead>
          <tbody id="equipmentGroupTable"></tbody>
        </table>
      </div>
    </div>
    <div id="equipmentModalHost"></div>
  `;
}

function mountPageLogic(path) {
  if (path === '/booking') return setupBookingPage();
  if (path === '/checkout') return setupCheckoutPage();
  if (path === '/checked-out') return setupCheckedOutPage();
  if (path === '/checkin') return setupCheckinPage();
  if (path === '/equipment') return setupEquipmentPage();
  return setupOverviewPage();
}

async function getAllEquipment() {
  const snap = await getDocs(query(equipmentRef, where('ownerId', '==', uid())));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).map((item) => ({
    ...item,
    name: item.name || 'Unnamed equipment',
    type: item.type || item.category || 'General',
    unitNumber: Number(item.unitNumber) || 1,
    displayName: item.displayName || unitDisplayName(item.name || 'Unnamed equipment', Number(item.unitNumber) || 1),
    groupKey: item.groupKey || `${slugify(item.type || item.category || 'General')}__${slugify(item.name || 'Unnamed equipment')}`,
    status: item.status || 'available',
  })).sort((a, b) => a.displayName.localeCompare(b.displayName));
}
async function getEquipmentGroups() {
  const items = await getAllEquipment();
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.groupKey)) groups.set(item.groupKey, { key: item.groupKey, name: item.name, type: item.type, manufacturer: item.manufacturer || '', model: item.model || '', notes: item.notes || '', items: [] });
    groups.get(item.groupKey).items.push(item);
  }
  return [...groups.values()].map((g) => ({ ...g, items: g.items.sort((a,b)=>a.unitNumber-b.unitNumber), total: g.items.length, available: g.items.filter((i)=>i.status !== 'checked_out').length })).sort((a,b)=>a.name.localeCompare(b.name));
}
async function getRentals() {
  const snap = await getDocs(query(rentalsRef, where('ownerId', '==', uid())));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a,b) => (dateOnly(a.pickupDate) || '').localeCompare(dateOnly(b.pickupDate) || ''));
}
async function getRentalById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, 'rentals', id));
  if (!snap.exists()) return null;
  const data = { id: snap.id, ...snap.data() };
  return data.ownerId === uid() ? data : null;
}
async function createRental(payload) {
  return addDoc(rentalsRef, { ...payload, ownerId: uid(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
async function updateRental(rentalId, payload) {
  await updateDoc(doc(db, 'rentals', rentalId), { ...payload, updatedAt: serverTimestamp() });
  if (payload.items) await syncEquipmentStatuses(payload.items, payload.status);
}
async function deleteRentalById(rentalId) {
  const rental = await getRentalById(rentalId);
  if (rental?.items?.length) {
    const batch = writeBatch(db);
    for (const item of rental.items) {
      if (item.equipmentId && (rental.status === 'checked_out' || rental.status === 'partial_return')) {
        batch.update(doc(db, 'equipment', item.equipmentId), { status: 'available', updatedAt: serverTimestamp() });
      }
    }
    await batch.commit();
  }
  await deleteDoc(doc(db, 'rentals', rentalId));
}
async function syncEquipmentStatuses(items, rentalStatus) {
  const batch = writeBatch(db);
  for (const item of items || []) {
    if (!item.equipmentId) continue;
    let nextStatus = 'available';
    if (rentalStatus === 'checked_out') nextStatus = item.pickedUp ? 'checked_out' : 'available';
    if (rentalStatus === 'partial_return' || rentalStatus === 'completed') nextStatus = item.returned ? 'available' : 'checked_out';
    if (rentalStatus === 'booked') nextStatus = 'available';
    batch.update(doc(db, 'equipment', item.equipmentId), { status: nextStatus, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}
async function createEquipmentGroup(payload) {
  const name = payload.name.trim();
  const type = (payload.type || 'General').trim();
  const amount = Math.max(1, Number(payload.amount) || 1);
  const groupKey = `${slugify(type)}__${slugify(name)}`;
  const existing = (await getAllEquipment()).filter((x) => x.groupKey === groupKey);
  let highest = existing.reduce((m, x) => Math.max(m, Number(x.unitNumber) || 0), 0);
  const batch = writeBatch(db);
  for (let i = 0; i < amount; i += 1) {
    highest += 1;
    batch.set(doc(equipmentRef), {
      ownerId: uid(),
      name,
      type,
      category: type,
      unitNumber: highest,
      displayName: unitDisplayName(name, highest),
      groupKey,
      manufacturer: payload.manufacturer?.trim() || '',
      model: payload.model?.trim() || '',
      notes: payload.notes?.trim() || '',
      status: 'available',
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}
async function deleteEquipmentItem(id) {
  await deleteDoc(doc(db, 'equipment', id));
}
function parseEquipmentXml(text) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');
  if (xml.querySelector('parsererror')) throw new Error('The XML file could not be read.');
  const nodes = [...xml.querySelectorAll('item, equipment, product, asset, entry, record')];
  const source = nodes.length ? nodes : [...xml.documentElement.children];
  const readField = (node, names) => {
    for (const name of names) {
      const child = [...node.children].find((x) => x.tagName.toLowerCase() === name.toLowerCase());
      if (child?.textContent?.trim()) return child.textContent.trim();
      const attr = node.getAttribute(name);
      if (attr?.trim()) return attr.trim();
    }
    return '';
  };
  const rows = source.map((node) => ({
    name: readField(node, ['name','title','label','equipmentname','description']),
    type: readField(node, ['type','category','group','department','equipmenttype']),
    amount: Math.max(1, parseInt(readField(node, ['amount','qty','quantity','count','units']) || '1', 10) || 1),
    manufacturer: readField(node, ['manufacturer','brand','make']),
    model: readField(node, ['model']),
    notes: readField(node, ['notes','comment','comments']),
  })).filter((r) => r.name);
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
    const groupKey = `${slugify(type)}__${slugify(name)}`;
    let nextUnit = highestByGroup.get(groupKey) || 0;
    const amount = Math.max(1, Number(row.amount) || 1);
    for (let i = 0; i < amount; i += 1) {
      nextUnit += 1;
      batch.set(doc(equipmentRef), {
        ownerId: uid(), name, type, category: type, unitNumber: nextUnit,
        displayName: unitDisplayName(name, nextUnit), groupKey,
        manufacturer: row.manufacturer?.trim() || '', model: row.model?.trim() || '', notes: row.notes?.trim() || '',
        status: 'available', active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    highestByGroup.set(groupKey, nextUnit);
  }
  await batch.commit();
}

function bookingCard(rental, actionLabel, actionPath, extraButtons = '') {
  return `
    <div class="card">
      <div class="spread">
        <div>
          <div class="badge ${escapeHtml(rental.status)}">${escapeHtml(rental.status)}</div>
          <h3 style="margin:8px 0 6px">${escapeHtml(rental.renterName || 'Unnamed renter')}</h3>
          <div class="item-meta"><span>Out ${escapeHtml(fmtDate(rental.pickupDate))}</span><span>In ${escapeHtml(fmtDate(rental.returnDate))}</span></div>
        </div>
        <div class="toolbar">
          <button class="small ghost" data-nav="${escapeHtml(actionPath)}">${escapeHtml(actionLabel)}</button>
          ${extraButtons}
        </div>
      </div>
      <div style="margin-top:10px"><button class="small ghost" data-toggle-items="${rental.id}">View items (${(rental.items || []).length})</button></div>
      <div class="stack-list hidden" id="items-${rental.id}" style="margin-top:10px">${(rental.items || []).map((item) => `<div class="item-row vertical"><div><strong>${escapeHtml(item.name || item.equipmentName || 'Item')}</strong></div></div>`).join('') || '<div class="muted small">No items.</div>'}</div>
    </div>
  `;
}

async function setupOverviewPage() {
  try {
    const rentals = await getRentals();
    const active = rentals.filter((r) => ['booked','checked_out','partial_return'].includes(r.status));
    const today = todayLocal();
    const pickupsToday = rentals.filter((r) => ['booked','checked_out','partial_return'].includes(r.status) && dateOnly(r.pickupDate) === today).length;
    const returnsToday = rentals.filter((r) => ['checked_out','partial_return'].includes(r.status) && dateOnly(r.returnDate) === today).length;
    const overdue = rentals.filter((r) => ['checked_out','partial_return'].includes(r.status) && dateOnly(r.returnDate) && dateOnly(r.returnDate) < today).length;
    document.getElementById('statActive').textContent = String(active.length);
    document.getElementById('statPickupsToday').textContent = String(pickupsToday);
    document.getElementById('statReturnsToday').textContent = String(returnsToday);
    document.getElementById('statOverdue').textContent = String(overdue);
    document.getElementById('overviewBooked').innerHTML = rentals.filter((r) => r.status === 'booked').map((r) => bookingCard(r, 'Checkout', `/checkout?id=${r.id}`)).join('') || '<div class="card muted">No upcoming bookings.</div>';
    document.getElementById('overviewOut').innerHTML = rentals.filter((r) => ['checked_out','partial_return'].includes(r.status)).map((r) => bookingCard(r, 'Open', `/checked-out?id=${r.id}`)).join('') || '<div class="card muted">Nothing checked out.</div>';
    attachSharedCardHandlers();
  } catch (e) {
    setFlash({ error: e.message || 'Failed to load overview.' }); render();
  }
}

function attachSharedCardHandlers() {
  document.querySelectorAll('[data-nav]').forEach((btn) => btn.onclick = () => setRoute(btn.dataset.nav));
  document.querySelectorAll('[data-toggle-items]').forEach((btn) => btn.onclick = () => document.getElementById(`items-${btn.dataset.toggleItems}`)?.classList.toggle('hidden'));
}

async function setupBookingPage() {
  const resultsEl = document.getElementById('bookingSearchResults');
  const selectedEl = document.getElementById('bookingSelectedList');
  const searchEl = document.getElementById('bookingSearch');
  const pickupEl = document.getElementById('pickupDate');
  const returnEl = document.getElementById('returnDate');
  const availabilityNote = document.getElementById('availabilityNote');
  let catalog = [];
  let rentals = [];
  const selected = [];

  function selectedIds() { return new Set(selected.filter((x) => x.equipmentId).map((x) => x.equipmentId)); }
  function unavailableIds() { return getUnavailableForDates(rentals, pickupEl.value, returnEl.value); }
  function renderSelected() {
    selectedEl.innerHTML = selected.length ? selected.map((item, idx) => `
      <div class="item-row">
        <div><strong>${escapeHtml(item.name)}</strong><div class="item-meta"><span>${escapeHtml(item.type || '')}</span></div></div>
        <button class="small ghost" data-remove-selected="${idx}">Remove</button>
      </div>`).join('') : '<div class="muted small">No equipment added yet.</div>';
    document.querySelectorAll('[data-remove-selected]').forEach((btn) => btn.onclick = () => { selected.splice(Number(btn.dataset.removeSelected), 1); renderSelected(); renderResults(); });
  }
  function renderResults() {
    const q = searchEl.value.trim().toLowerCase();
    const blocked = unavailableIds();
    const picked = selectedIds();
    let items = catalog.filter((item) => item.status !== 'checked_out' && !picked.has(item.id) && !blocked.has(item.id));
    if (q) items = items.filter((item) => [item.displayName, item.name, item.type].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
    availabilityNote.textContent = pickupEl.value && returnEl.value ? `${items.length} items available for selected dates.` : 'Choose dates to check availability.';
    resultsEl.innerHTML = items.length ? items.map((item) => `
      <div class="item-row">
        <div><strong>${escapeHtml(item.displayName)}</strong><div class="item-meta"><span>${escapeHtml(item.type)}</span><span>${escapeHtml(item.manufacturer || '')}</span><span>${escapeHtml(item.model || '')}</span></div></div>
        <button class="small" data-add-item="${item.id}">Add</button>
      </div>`).join('') : '<div class="muted small">No equipment matches your search.</div>';
    document.querySelectorAll('[data-add-item]').forEach((btn) => btn.onclick = () => {
      const item = catalog.find((x) => x.id === btn.dataset.addItem);
      if (!item) return;
      selected.push({ equipmentId: item.id, equipmentName: item.name, name: item.displayName, type: item.type, unitNumber: item.unitNumber, pickedUp: false, returned: false });
      renderSelected(); renderResults();
    });
  }
  try {
    [catalog, rentals] = await Promise.all([getAllEquipment(), getRentals()]);
    renderSelected(); renderResults();
    searchEl.oninput = renderResults;
    pickupEl.oninput = renderResults;
    returnEl.oninput = renderResults;
    document.getElementById('bookingForm').onsubmit = async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      if (!selected.length) { setFlash({ error: 'Add at least one equipment item.' }); return render(); }
      try {
        await createRental({
          renterName: form.get('renterName'), company: form.get('company'), email: form.get('email'), phone: form.get('phone'),
          pickupDate: form.get('pickupDate'), returnDate: form.get('returnDate'), notes: form.get('notes'),
          status: 'booked', items: selected,
        });
        setFlash({ notice: 'Booking created.' }); setRoute('/');
      } catch (e) { setFlash({ error: e.message || 'Failed to save booking.' }); render(); }
    };
  } catch (e) { setFlash({ error: e.message || 'Failed to load booking page.' }); render(); }
}

function getUnavailableForDates(rentals, pickupDate, returnDate, excludeRentalId = '') {
  if (!pickupDate || !returnDate) return new Set();
  const blocked = new Set();
  rentals
    .filter((r) => r.id !== excludeRentalId)
    .filter((r) => ['booked','checked_out','partial_return'].includes(r.status))
    .filter((r) => overlaps(r.pickupDate, r.returnDate, pickupDate, returnDate))
    .forEach((r) => {
      (r.items || []).forEach((item) => {
        if (!item?.equipmentId) return;
        if (r.status === 'checked_out') {
          if (item.pickedUp && !item.returned) blocked.add(item.equipmentId);
          return;
        }
        if (r.status === 'partial_return') {
          if (!item.returned) blocked.add(item.equipmentId);
          return;
        }
        blocked.add(item.equipmentId);
      });
    });
  return blocked;
}

function checkoutEditorMarkup(rental, catalog, pickedList) {
  const allItems = rental.items || [];
  const requested = allItems.filter((item) => !pickedList.some((x) => x.equipmentId === item.equipmentId || (!x.equipmentId && x.name === item.name)));
  return `
    <div class="panel">
      <div class="spread">
        <div>
          <h2 style="margin:0">${escapeHtml(rental.renterName || 'Direct checkout')}</h2>
          <div class="item-meta"><span>Out ${escapeHtml(fmtDate(rental.pickupDate))}</span><span>In ${escapeHtml(fmtDate(rental.returnDate))}</span></div>
        </div>
        <div class="toolbar">
          ${rental.status === 'booked' ? '<button class=\"small danger\" id=\"deleteBookingBtn\">Delete booking</button>' : ''}
        </div>
      </div>
      <hr class="sep" />
      <div class="twocol">
        <div class="stack-box">
          <div class="spread"><strong>Booking list</strong><span class="muted small">What is left to find.</span></div>
          <div class="stack-list" id="checkoutRequestedList" style="margin-top:10px">${requested.length ? requested.map((item, idx) => `
            <div class="item-row vertical">
              <div class="spread"><div><strong>${escapeHtml(item.name)}</strong><div class="item-meta"><span>${escapeHtml(item.type || '')}</span></div></div><div class="toolbar"><button class="small success" data-pick-requested="${idx}">Pick</button><button class="small ghost" data-remove-requested="${idx}">Remove</button></div></div>
            </div>`).join('') : '<div class="muted small">Nothing left to pick.</div>'}</div>
        </div>
        <div class="stack-box">
          <div class="spread"><strong>Picked</strong><span class="muted small">Items ready to go.</span></div>
          <div class="stack-list" id="checkoutPickedList" style="margin-top:10px">${pickedList.length ? pickedList.map((item, idx) => `
            <div class="item-row vertical">
              <div class="spread"><div><strong>${escapeHtml(item.name)}</strong><div class="item-meta"><span>${escapeHtml(item.type || '')}</span></div></div><button class="small ghost" data-unpick-item="${idx}">Move back</button></div>
            </div>`).join('') : '<div class="muted small">No picked items yet.</div>'}</div>
        </div>
      </div>
      <hr class="sep" />
      <div class="card">
        <div class="spread"><strong>Add more equipment</strong></div>
        <input id="checkoutSearch" placeholder="Search available equipment" style="margin:10px 0" />
        <div class="search-results" id="checkoutSearchResults"></div>
      </div>
      <div class="row" style="margin-top:14px"><button id="saveCheckoutBtn">Save checkout</button></div>
    </div>
  `;
}

async function setupCheckoutPage() {
  const params = getRouteParams();
  const selectedId = params.get('id') || '';
  const rentals = await getRentals();
  const activeOptions = rentals.filter((r) => ['booked','checked_out'].includes(r.status));
  const select = document.getElementById('checkoutRentalSelect');
  select.innerHTML = '<option value="">Choose…</option>' + activeOptions.map((r) => `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>${escapeHtml(r.renterName || 'Unnamed')} · ${escapeHtml(r.status)} · ${escapeHtml(fmtDate(r.pickupDate))}</option>`).join('');
  select.onchange = () => setRoute('/checkout', select.value ? { id: select.value } : null);
  document.getElementById('newDirectCheckoutBtn').onclick = () => setRoute('/checkout', { direct: '1' });
  if (selectedId) return mountCheckoutEditor(await getRentalById(selectedId));
  if (params.get('direct') === '1') {
    const now = new Date().toISOString().slice(0,10);
    return mountCheckoutEditor({ id: '', renterName: 'Direct checkout', pickupDate: now, returnDate: now, status: 'checked_out', items: [] }, true);
  }
  document.getElementById('checkoutWorkspace').innerHTML = '<div class="card muted">Choose a booking or create a direct checkout.</div>';
}

async function mountCheckoutEditor(rental, isDirect = false) {
  if (!rental) {
    document.getElementById('checkoutWorkspace').innerHTML = '<div class="card muted">Booking not found.</div>';
    return;
  }
  const workspace = document.getElementById('checkoutWorkspace');
  const catalog = await getAllEquipment();
  const pickedList = (rental.items || []).filter((item) => item.pickedUp && !item.returned).map((x) => ({ ...x }));
  function rerender() {
    workspace.innerHTML = checkoutEditorMarkup(rental, catalog, pickedList);
    const allItems = rental.items || [];
    const selectedIds = new Set(allItems.filter((x) => x.equipmentId).map((x) => x.equipmentId));
    const available = catalog.filter((item) => item.status !== 'checked_out' && !selectedIds.has(item.id));
    const resultsEl = document.getElementById('checkoutSearchResults');
    const searchEl = document.getElementById('checkoutSearch');
    function renderSearch() {
      const q = searchEl.value.trim().toLowerCase();
      const rows = available.filter((item) => !q || [item.displayName, item.name, item.type].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
      resultsEl.innerHTML = rows.length ? rows.map((item) => `<div class="item-row"><div><strong>${escapeHtml(item.displayName)}</strong><div class="item-meta"><span>${escapeHtml(item.type)}</span></div></div><button class="small" data-add-checkout-item="${item.id}">Add</button></div>`).join('') : '<div class="muted small">No available equipment matches your search.</div>';
      document.querySelectorAll('[data-add-checkout-item]').forEach((btn) => btn.onclick = () => {
        const item = catalog.find((x) => x.id === btn.dataset.addCheckoutItem);
        if (!item) return;
        rental.items.push({ equipmentId: item.id, equipmentName: item.name, name: item.displayName, type: item.type, unitNumber: item.unitNumber, pickedUp: false, returned: false });
        rerender();
      });
    }
    searchEl.oninput = renderSearch;
    renderSearch();

    const requested = allItems.filter((item) => !pickedList.some((x) => x.equipmentId === item.equipmentId || (!x.equipmentId && x.name === item.name)));
    document.querySelectorAll('[data-pick-requested]').forEach((btn) => btn.onclick = () => {
      const item = requested[Number(btn.dataset.pickRequested)];
      const original = rental.items.find((x) => (x.equipmentId && x.equipmentId === item.equipmentId) || (!x.equipmentId && x.name === item.name && !x.pickedUp));
      if (!original) return;
      original.pickedUp = true;
      pickedList.push(original);
      rerender();
    });
    document.querySelectorAll('[data-remove-requested]').forEach((btn) => btn.onclick = () => {
      const item = requested[Number(btn.dataset.removeRequested)];
      rental.items = rental.items.filter((x) => !((x.equipmentId && x.equipmentId === item.equipmentId) || (!x.equipmentId && x.name === item.name && !x.pickedUp)));
      rerender();
    });
    document.querySelectorAll('[data-unpick-item]').forEach((btn) => btn.onclick = () => {
      const item = pickedList[Number(btn.dataset.unpickItem)];
      const original = rental.items.find((x) => (x.equipmentId && x.equipmentId === item.equipmentId) || (!x.equipmentId && x.name === item.name));
      if (original) original.pickedUp = false;
      pickedList.splice(Number(btn.dataset.unpickItem), 1);
      rerender();
    });
    document.getElementById('saveCheckoutBtn').onclick = async () => {
      const items = rental.items.map((x) => ({ ...x, pickedUp: !!x.pickedUp, returned: !!x.returned }));
      const status = items.some((x) => x.pickedUp) ? 'checked_out' : 'booked';
      try {
        if (isDirect && !rental.id) {
          const ref = await createRental({ renterName: rental.renterName || 'Direct checkout', company: '', email: '', phone: '', pickupDate: rental.pickupDate, returnDate: rental.returnDate, notes: '', items, status });
          await updateRental(ref.id, { items, status, renterName: rental.renterName || 'Direct checkout', pickupDate: rental.pickupDate, returnDate: rental.returnDate, company: '', email: '', phone: '', notes: '' });
        } else {
          await updateRental(rental.id, { ...rental, items, status });
        }
        setFlash({ notice: 'Checkout saved.' });
        setRoute('/checked-out');
      } catch (e) { setFlash({ error: e.message || 'Failed to save checkout.' }); render(); }
    };
    const deleteBookingBtn = document.getElementById('deleteBookingBtn');
    if (deleteBookingBtn) {
      deleteBookingBtn.onclick = async () => {
        if (!rental.id || !confirm('Delete this booking?')) return;
        await deleteRentalById(rental.id);
        setFlash({ notice: 'Booking deleted.' });
        setRoute('/');
      };
    }
  }
  rerender();
}

async function setupCheckedOutPage() {
  const rentals = await getRentals();
  const list = rentals.filter((r) => ['checked_out','partial_return'].includes(r.status));
  const container = document.getElementById('checkedOutList');
  container.innerHTML = list.length ? list.map((r) => bookingCard(r, 'Open', `/checkout?id=${r.id}`)).join('') : '<div class="card muted">No active checkouts.</div>';
  attachSharedCardHandlers();
}

function checkinEditorMarkup(rental, outItems, returnedItems) {
  return `
    <div class="twocol">
      <div class="stack-box">
        <div class="spread"><strong>Still out</strong><span class="muted small">Items not yet returned.</span></div>
        <div class="stack-list" style="margin-top:10px">${outItems.length ? outItems.map((item, idx) => `<div class="item-row vertical"><div class="spread"><div><strong>${escapeHtml(item.name)}</strong></div><button class="small success" data-return-pick="${idx}">Pick</button></div></div>`).join('') : '<div class="muted small">Nothing left out.</div>'}</div>
      </div>
      <div class="stack-box">
        <div class="spread"><strong>Returned</strong><span class="muted small">Picked into check-in.</span></div>
        <div class="stack-list" style="margin-top:10px">${returnedItems.length ? returnedItems.map((item, idx) => `<div class="item-row vertical"><div class="spread"><div><strong>${escapeHtml(item.name)}</strong></div><button class="small ghost" data-return-unpick="${idx}">Move back</button></div></div>`).join('') : '<div class="muted small">No returned items yet.</div>'}</div>
      </div>
    </div>
    <div class="row" style="margin-top:16px"><button id="saveCheckinBtn">Save check-in</button></div>
  `;
}

async function setupCheckinPage() {
  const rentals = await getRentals();
  const list = rentals.filter((r) => ['checked_out','partial_return'].includes(r.status));
  const select = document.getElementById('checkinRentalSelect');
  select.innerHTML = '<option value="">Choose…</option>' + list.map((r) => `<option value="${r.id}">${escapeHtml(r.renterName || 'Unnamed')} · ${escapeHtml(fmtDate(r.pickupDate))}</option>`).join('');
  const params = getRouteParams();
  if (params.get('id')) select.value = params.get('id');
  select.onchange = () => setRoute('/checkin', select.value ? { id: select.value } : null);
  if (!select.value) return;
  const rental = await getRentalById(select.value);
  const workspace = document.getElementById('checkinWorkspace');
  if (!rental) return void(workspace.innerHTML = '<div class="card muted">Checkout not found.</div>');
  const returned = (rental.items || []).filter((item) => item.returned).map((x) => ({ ...x }));
  function rerender() {
    const out = (rental.items || []).filter((item) => item.pickedUp && !item.returned);
    workspace.innerHTML = checkinEditorMarkup(rental, out, returned);
    document.querySelectorAll('[data-return-pick]').forEach((btn) => btn.onclick = () => {
      const item = out[Number(btn.dataset.returnPick)];
      const original = rental.items.find((x) => x.equipmentId === item.equipmentId || (!x.equipmentId && x.name === item.name && x.pickedUp && !x.returned));
      if (!original) return;
      original.returned = true;
      returned.push(original);
      rerender();
    });
    document.querySelectorAll('[data-return-unpick]').forEach((btn) => btn.onclick = () => {
      const item = returned[Number(btn.dataset.returnUnpick)];
      const original = rental.items.find((x) => x.equipmentId === item.equipmentId || (!x.equipmentId && x.name === item.name && x.returned));
      if (original) original.returned = false;
      returned.splice(Number(btn.dataset.returnUnpick), 1);
      rerender();
    });
    document.getElementById('saveCheckinBtn').onclick = async () => {
      const items = rental.items.map((x) => ({ ...x }));
      const remaining = items.filter((x) => x.pickedUp && !x.returned).length;
      const status = remaining ? 'partial_return' : 'completed';
      try { await updateRental(rental.id, { ...rental, items, status }); setFlash({ notice: 'Check-in saved.' }); setRoute('/'); } catch (e) { setFlash({ error: e.message || 'Failed to save check-in.' }); render(); }
    };
  }
  rerender();
}

async function setupEquipmentPage() {
  async function load() {
    const groups = await getEquipmentGroups();
    const tbody = document.getElementById('equipmentGroupTable');
    tbody.innerHTML = groups.length ? groups.map((group) => `
      <tr>
        <td><strong>${escapeHtml(group.name)}</strong></td>
        <td>${escapeHtml(group.type)}</td>
        <td>${group.total}</td>
        <td>${group.available}</td>
        <td><button class="small ghost" data-open-group="${escapeHtml(group.key)}">Open</button></td>
      </tr>`).join('') : '<tr><td colspan="5" class="muted">No equipment yet.</td></tr>';
    document.querySelectorAll('[data-open-group]').forEach((btn) => btn.onclick = () => openEquipmentModal(groups.find((g) => g.key === btn.dataset.openGroup)));
  }
  document.getElementById('addEquipmentBtn').onclick = async () => {
    try {
      await createEquipmentGroup({
        name: document.getElementById('eqName').value,
        type: document.getElementById('eqType').value,
        amount: document.getElementById('eqAmount').value,
        manufacturer: document.getElementById('eqManufacturer').value,
        model: document.getElementById('eqModel').value,
        notes: document.getElementById('eqNotes').value,
      });
      setFlash({ notice: 'Equipment added.' }); render();
    } catch (e) { setFlash({ error: e.message || 'Failed to add equipment.' }); render(); }
  };
  document.getElementById('importXmlBtn').onclick = async () => {
    const file = document.getElementById('xmlFile').files?.[0];
    if (!file) { setFlash({ error: 'Choose an XML file first.' }); return render(); }
    try {
      const text = await file.text();
      const rows = parseEquipmentXml(text);
      await importEquipmentRows(rows);
      setFlash({ notice: `Imported ${rows.length} rows.` }); render();
    } catch (e) { setFlash({ error: e.message || 'XML import failed.' }); render(); }
  };
  await load();
}

function openEquipmentModal(group) {
  const host = document.getElementById('equipmentModalHost');
  if (!group) return;
  host.innerHTML = `
    <div class="modal-backdrop" id="equipmentModalBackdrop">
      <div class="modal">
        <div class="spread"><div><h2 style="margin:0">${escapeHtml(group.name)}</h2><div class="muted small">${escapeHtml(group.type)} · ${group.total} total · ${group.available} available</div></div><button class="small ghost" id="closeEquipmentModalBtn">Back</button></div>
        <hr class="sep" />
        <div class="row" style="margin-bottom:12px"><input id="modalAddAmount" type="number" min="1" value="1" style="max-width:120px" /><button id="modalAddBtn">Add more</button></div>
        <div class="stack-list">${group.items.map((item) => `<div class="item-row"><div><strong>${escapeHtml(item.displayName)}</strong><div class="item-meta"><span>${escapeHtml(item.status)}</span></div></div><button class="small danger" data-delete-equipment="${item.id}">Remove</button></div>`).join('')}</div>
      </div>
    </div>
  `;
  document.getElementById('closeEquipmentModalBtn').onclick = () => host.innerHTML = '';
  document.getElementById('equipmentModalBackdrop').onclick = (e) => { if (e.target.id === 'equipmentModalBackdrop') host.innerHTML = ''; };
  document.getElementById('modalAddBtn').onclick = async () => {
    await createEquipmentGroup({ name: group.name, type: group.type, amount: document.getElementById('modalAddAmount').value, manufacturer: group.manufacturer, model: group.model, notes: group.notes });
    setFlash({ notice: 'Equipment added.' }); render();
  };
  document.querySelectorAll('[data-delete-equipment]').forEach((btn) => btn.onclick = async () => { if (!confirm('Remove this item?')) return; await deleteEquipmentItem(btn.dataset.deleteEquipment); setFlash({ notice: 'Item removed.' }); render(); });
}

onAuthStateChanged(auth, (user) => {
  state.user = user;
  state.route = getRoute();
  render();
});
window.addEventListener('hashchange', () => { state.route = getRoute(); render(); });
