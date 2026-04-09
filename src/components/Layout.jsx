import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/booking', label: 'Booking' },
  { to: '/checkout', label: 'Checkout' },
  { to: '/checkin', label: 'Check-in' },
  { to: '/equipment', label: 'Equipment' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Rental management</p>
          <h1>Equipment Tracker</h1>
          <p className="muted">Bookings, pickups, returns and live overview in one place.</p>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer card compact">
          <div>
            <div className="label">Signed in as</div>
            <div>{user?.displayName || user?.email}</div>
          </div>
          <button className="secondary-button" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
