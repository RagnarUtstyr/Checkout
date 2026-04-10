import { useEffect, useState } from 'react';
import EquipmentPicker from '../components/EquipmentPicker';
import { createRental, getAllEquipment } from '../lib/rentals';

const initialForm = {
  renterName: '',
  company: '',
  email: '',
  phone: '',
  pickupDate: '',
  returnDate: '',
  notes: '',
};

export default function BookingPage() {
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadEquipment() {
      try {
        setLoading(true);
        const data = await getAllEquipment();
        setCatalog(data);
      } catch (err) {
        setError(err.message || 'Failed to load equipment catalog.');
      } finally {
        setLoading(false);
      }
    }

    loadEquipment();
  }, []);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await createRental({ ...form, items });
      setForm(initialForm);
      setItems([]);
      setMessage('Booking created successfully.');
    } catch (err) {
      setError(err.message || 'Failed to create booking.');
    }

    setSaving(false);
  }

  return (
    <div className="stack-lg">
      <div>
        <p className="eyebrow">Booking</p>
        <h2>Create a new equipment booking</h2>
        <p className="muted">Search equipment, add renter details, and save the booking for later pickup.</p>
      </div>

      <form className="stack-lg" onSubmit={handleSubmit}>
        <section className="card">
          <h3>Contact and rental details</h3>
          <div className="grid two-col gap-md">
            <div>
              <label>Renter name</label>
              <input
                className="text-input"
                value={form.renterName}
                onChange={(event) => updateField('renterName', event.target.value)}
                required
              />
            </div>
            <div>
              <label>Company / department</label>
              <input
                className="text-input"
                value={form.company}
                onChange={(event) => updateField('company', event.target.value)}
              />
            </div>
            <div>
              <label>Email</label>
              <input
                className="text-input"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </div>
            <div>
              <label>Phone</label>
              <input
                className="text-input"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
              />
            </div>
            <div>
              <label>Pickup date</label>
              <input
                className="text-input"
                type="date"
                value={form.pickupDate}
                onChange={(event) => updateField('pickupDate', event.target.value)}
                required
              />
            </div>
            <div>
              <label>Return date</label>
              <input
                className="text-input"
                type="date"
                value={form.returnDate}
                onChange={(event) => updateField('returnDate', event.target.value)}
                required
              />
            </div>
          </div>

          <div className="stack-sm top-space">
            <label>Notes</label>
            <textarea
              className="text-input textarea"
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Accessories, special terms, pickup instructions…"
            />
          </div>
        </section>

        {loading ? <div className="card">Loading equipment catalog…</div> : null}
        {!loading ? <EquipmentPicker catalog={catalog} selectedItems={items} onChange={setItems} /> : null}

        {message ? <div className="success-box">{message}</div> : null}
        {error ? <div className="error-box">{error}</div> : null}

        <div className="row gap-sm">
          <button className="primary-button" type="submit" disabled={saving || !items.length}>
            {saving ? 'Saving…' : 'Save booking'}
          </button>
          <span className="muted">Add at least one equipment item before saving.</span>
        </div>
      </form>
    </div>
  );
}
