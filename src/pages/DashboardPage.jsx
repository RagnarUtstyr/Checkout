import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import RentalCard from '../components/RentalCard';
import { daysUntil, isSameDay } from '../lib/date';
import { getRentalsByStatuses } from '../lib/rentals';

export default function DashboardPage() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const data = await getRentalsByStatuses(['booked', 'checked_out']);
        setRentals(data);
      } catch (err) {
        setError(err.message || 'Failed to load rentals.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const booked = useMemo(() => rentals.filter((rental) => rental.status === 'booked'), [rentals]);
  const checkedOut = useMemo(() => rentals.filter((rental) => rental.status === 'checked_out'), [rentals]);

  const stats = useMemo(() => {
    const today = new Date();
    return {
      pickupsToday: rentals.filter((item) => isSameDay(item.pickupDate, today)).length,
      returnsToday: rentals.filter((item) => isSameDay(item.returnDate, today)).length,
      overdue: checkedOut.filter((item) => daysUntil(item.returnDate) < 0).length,
      active: rentals.length,
    };
  }, [rentals, checkedOut]);

  return (
    <div className="stack-lg">
      <div className="row spread align-center wrap gap-md">
        <div>
          <p className="eyebrow">Overview</p>
          <h2>Current bookings and checkouts</h2>
          <p className="muted">Track upcoming pickups, due returns, and what is currently out.</p>
        </div>
        <div className="row gap-sm wrap">
          <Link to="/booking" className="primary-button link-button">
            New booking
          </Link>
          <Link to="/checkout" className="secondary-button link-button">
            Process checkout
          </Link>
          <Link to="/equipment" className="secondary-button link-button">
            Manage equipment
          </Link>
        </div>
      </div>

      <div className="grid four-col stats-grid">
        <div className="card stat-card">
          <div className="label">Active rentals</div>
          <strong>{stats.active}</strong>
        </div>
        <div className="card stat-card">
          <div className="label">Pickups today</div>
          <strong>{stats.pickupsToday}</strong>
        </div>
        <div className="card stat-card">
          <div className="label">Returns today</div>
          <strong>{stats.returnsToday}</strong>
        </div>
        <div className="card stat-card">
          <div className="label">Overdue</div>
          <strong>{stats.overdue}</strong>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="card">Loading current rentals…</div> : null}

      {!loading ? (
        <div className="grid two-col gap-lg dashboard-columns">
          <section className="stack-md">
            <div className="row spread align-center">
              <h3>Upcoming bookings</h3>
              <span className="label">{booked.length}</span>
            </div>
            {booked.length ? (
              booked.map((rental) => (
                <RentalCard
                  key={rental.id}
                  rental={rental}
                  actions={
                    <Link className="secondary-button link-button" to={`/checkout?booking=${rental.id}`}>
                      Start checkout
                    </Link>
                  }
                />
              ))
            ) : (
              <div className="card">No upcoming bookings.</div>
            )}
          </section>

          <section className="stack-md">
            <div className="row spread align-center">
              <h3>Currently checked out</h3>
              <span className="label">{checkedOut.length}</span>
            </div>
            {checkedOut.length ? (
              checkedOut.map((rental) => (
                <RentalCard
                  key={rental.id}
                  rental={rental}
                  actions={
                    <Link className="secondary-button link-button" to={`/checkin?booking=${rental.id}`}>
                      Start check-in
                    </Link>
                  }
                />
              ))
            ) : (
              <div className="card">Nothing is currently checked out.</div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
