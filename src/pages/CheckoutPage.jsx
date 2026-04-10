import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EquipmentPicker from '../components/EquipmentPicker';
import { getAllEquipment, getRentalById, getRentalsByStatuses, updateRental } from '../lib/rentals';
import { formatDate } from '../lib/date';

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking');

  const [bookings, setBookings] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState(bookingId || '');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [workingItems, setWorkingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [bookingData, equipmentData] = await Promise.all([
          getRentalsByStatuses(['booked']),
          getAllEquipment(),
        ]);
        setBookings(bookingData);
        setCatalog(equipmentData);
      } catch (err) {
        setError(err.message || 'Failed to load checkout data.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    async function loadBooking() {
      if (!selectedBookingId) {
        setSelectedBooking(null);
        setWorkingItems([]);
        return;
      }

      try {
        const data = await getRentalById(selectedBookingId);
        setSelectedBooking(data);
        setWorkingItems(data?.items || []);
      } catch (err) {
        setError(err.message || 'Failed to load booking.');
      }
    }

    loadBooking();
  }, [selectedBookingId]);

  const pickedCount = useMemo(
    () => workingItems.filter((item) => item.pickedUp).length,
    [workingItems]
  );

  function togglePicked(indexToToggle) {
    setWorkingItems((current) =>
      current.map((item, index) =>
        index === indexToToggle ? { ...item, pickedUp: !item.pickedUp } : item
      )
    );
  }

  async function completeCheckout() {
    if (!selectedBooking) return;

    setSaving(true);
    setMessage('');
    setError('');

    try {
      await updateRental(selectedBooking.id, {
        items: workingItems,
        status: 'checked_out',
        checkedOutAt: new Date().toISOString(),
      });
      setMessage('Checkout saved. Booking moved to checked out.');
    } catch (err) {
      setError(err.message || 'Failed to save checkout.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <p className="eyebrow">Checkout</p>
        <h2>Prepare and confirm equipment pickup</h2>
        <p className="muted">Open a booking, tick off found equipment, and adjust the final list before handoff.</p>
      </div>

      {loading ? <div className="card">Loading bookings and equipment…</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      {!loading ? (
        <section className="card">
          <label>Select booking</label>
          <select
            className="text-input"
            value={selectedBookingId}
            onChange={(event) => setSelectedBookingId(event.target.value)}
          >
            <option value="">Choose a booking…</option>
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.renterName} — {formatDate(booking.pickupDate)} to {formatDate(booking.returnDate)}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      {selectedBooking ? (
        <div className="stack-lg">
          <section className="card">
            <div className="row spread wrap gap-md align-start">
              <div>
                <h3>{selectedBooking.renterName}</h3>
                <p className="muted">
                  Pickup {formatDate(selectedBooking.pickupDate)} • Return {formatDate(selectedBooking.returnDate)}
                </p>
                <p className="muted">{selectedBooking.email || selectedBooking.phone || 'No contact details'}</p>
              </div>
              <div className="stat-chip">Picked {pickedCount}/{workingItems.length}</div>
            </div>

            <div className="checklist">
              {workingItems.map((item, index) => (
                <label key={`${item.name}-${index}`} className={`check-row ${item.pickedUp ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(item.pickedUp)}
                    onChange={() => togglePicked(index)}
                  />
                  <div>
                    <strong>{item.name}</strong>
                    <div className="muted small-text">{item.serialNumber || 'No serial number'}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <EquipmentPicker catalog={catalog} selectedItems={workingItems} onChange={setWorkingItems} />

          <div className="row gap-sm wrap">
            <button className="primary-button" onClick={completeCheckout} disabled={saving}>
              {saving ? 'Saving…' : 'Complete checkout'}
            </button>
            <span className="muted">You can add missing items or remove unwanted items before saving.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
