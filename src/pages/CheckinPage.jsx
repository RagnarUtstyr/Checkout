import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDate } from '../lib/date';
import { getRentalById, getRentalsByStatuses, updateRental } from '../lib/rentals';

export default function CheckinPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking');

  const [rentals, setRentals] = useState([]);
  const [selectedRentalId, setSelectedRentalId] = useState(bookingId || '');
  const [selectedRental, setSelectedRental] = useState(null);
  const [workingItems, setWorkingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getRentalsByStatuses(['checked_out']);
        setRentals(data);
      } catch (err) {
        setError(err.message || 'Failed to load checked-out rentals.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    async function loadRental() {
      if (!selectedRentalId) {
        setSelectedRental(null);
        setWorkingItems([]);
        return;
      }

      try {
        const data = await getRentalById(selectedRentalId);
        setSelectedRental(data);
        setWorkingItems(data?.items || []);
      } catch (err) {
        setError(err.message || 'Failed to load rental details.');
      }
    }

    loadRental();
  }, [selectedRentalId]);

  const returnedCount = useMemo(
    () => workingItems.filter((item) => item.returned).length,
    [workingItems]
  );

  function toggleReturned(indexToToggle) {
    setWorkingItems((current) =>
      current.map((item, index) =>
        index === indexToToggle ? { ...item, returned: !item.returned } : item
      )
    );
  }

  async function completeCheckin() {
    if (!selectedRental) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const allReturned = workingItems.every((item) => item.returned);
      await updateRental(selectedRental.id, {
        items: workingItems,
        status: allReturned ? 'completed' : 'partial_return',
        checkedInAt: new Date().toISOString(),
      });
      setMessage(allReturned ? 'Check-in completed.' : 'Partial return saved.');
    } catch (err) {
      setError(err.message || 'Failed to complete check-in.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <p className="eyebrow">Check-in</p>
        <h2>Register returned equipment</h2>
        <p className="muted">Find the active checkout, then tick off each item as it comes back.</p>
      </div>

      {loading ? <div className="card">Loading checked-out rentals…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      {!loading ? (
        <section className="card">
          <label>Select active checkout</label>
          <select
            className="text-input"
            value={selectedRentalId}
            onChange={(event) => setSelectedRentalId(event.target.value)}
          >
            <option value="">Choose a checkout…</option>
            {rentals.map((rental) => (
              <option key={rental.id} value={rental.id}>
                {rental.renterName} — due {formatDate(rental.returnDate)}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      {selectedRental ? (
        <section className="card stack-md">
          <div className="row spread wrap gap-md align-start">
            <div>
              <h3>{selectedRental.renterName}</h3>
              <p className="muted">Due back {formatDate(selectedRental.returnDate)}</p>
              <p className="muted">{selectedRental.email || selectedRental.phone || 'No contact details'}</p>
            </div>
            <div className="stat-chip">Returned {returnedCount}/{workingItems.length}</div>
          </div>

          <div className="checklist">
            {workingItems.map((item, index) => (
              <label key={`${item.name}-${index}`} className={`check-row ${item.returned ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={Boolean(item.returned)}
                  onChange={() => toggleReturned(index)}
                />
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted small-text">{item.serialNumber || 'No serial number'}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="row gap-sm wrap">
            <button className="primary-button" onClick={completeCheckin} disabled={saving}>
              {saving ? 'Saving…' : 'Save check-in'}
            </button>
            <span className="muted">Fully returned rentals move to completed. Partial returns are kept separate.</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
