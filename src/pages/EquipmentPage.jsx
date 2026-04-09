import { useEffect, useMemo, useState } from 'react';
import {
  createEquipmentGroup,
  deleteEquipmentItem,
  getEquipmentGroups,
  importEquipmentRows,
  parseEquipmentXml,
} from '../lib/rentals';

const initialForm = {
  name: '',
  type: '',
  amount: 1,
  manufacturer: '',
  model: '',
  description: '',
  notes: '',
};

export default function EquipmentPage() {
  const [form, setForm] = useState(initialForm);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [query, setQuery] = useState('');

  async function loadEquipment() {
    try {
      setLoading(true);
      const data = await getEquipmentGroups();
      setGroups(data);
    } catch (err) {
      setError(err.message || 'Failed to load equipment.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEquipment();
  }, []);

  const filteredGroups = useMemo(() => {
    if (!query.trim()) return groups;
    const normalized = query.toLowerCase();
    return groups.filter((group) =>
      [group.name, group.type, group.manufacturer, group.model, group.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );
  }, [groups, query]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleAddEquipment(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await createEquipmentGroup(form);
      setForm(initialForm);
      setMessage('Equipment added successfully.');
      await loadEquipment();
    } catch (err) {
      setError(err.message || 'Failed to add equipment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveItem(itemId) {
    const shouldDelete = window.confirm('Remove this individual equipment item?');
    if (!shouldDelete) return;

    setError('');
    setMessage('');

    try {
      await deleteEquipmentItem(itemId);
      setMessage('Equipment item removed.');
      await loadEquipment();
    } catch (err) {
      setError(err.message || 'Failed to remove equipment item.');
    }
  }

  async function handleXmlSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setMessage('');

    try {
      const text = await file.text();
      const rows = parseEquipmentXml(text);
      setImportRows(rows);
      setImportFileName(file.name);
      setMessage(`Loaded ${rows.length} equipment rows from XML.`);
    } catch (err) {
      setImportRows([]);
      setImportFileName('');
      setError(err.message || 'Failed to read XML file.');
    }
  }

  async function handleImportXml() {
    if (!importRows.length) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await importEquipmentRows(importRows);
      setImportRows([]);
      setImportFileName('');
      setMessage('XML import completed. Equipment was added to the catalog.');
      await loadEquipment();
    } catch (err) {
      setError(err.message || 'Failed to import XML.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <p className="eyebrow">Equipment</p>
        <h2>Manage your equipment inventory</h2>
        <p className="muted">
          Add inventory in batches, import from XML, and keep each unit as an individual tracked item.
        </p>
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      <div className="grid two-col gap-lg dashboard-columns">
        <section className="card stack-md">
          <div>
            <h3>Add equipment</h3>
            <p className="muted">
              Amount creates individually tracked items like “C-Stand #1”, “C-Stand #2”, and so on.
            </p>
          </div>

          <form className="stack-md" onSubmit={handleAddEquipment}>
            <div className="grid two-col gap-md">
              <div>
                <label>Name</label>
                <input
                  className="text-input"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="C-Stand"
                  required
                />
              </div>
              <div>
                <label>Type</label>
                <input
                  className="text-input"
                  value={form.type}
                  onChange={(event) => updateField('type', event.target.value)}
                  placeholder="Grip"
                  required
                />
              </div>
              <div>
                <label>Amount</label>
                <input
                  className="text-input"
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(event) => updateField('amount', event.target.value)}
                  required
                />
              </div>
              <div>
                <label>Manufacturer</label>
                <input
                  className="text-input"
                  value={form.manufacturer}
                  onChange={(event) => updateField('manufacturer', event.target.value)}
                  placeholder="Avenger"
                />
              </div>
              <div>
                <label>Model</label>
                <input
                  className="text-input"
                  value={form.model}
                  onChange={(event) => updateField('model', event.target.value)}
                  placeholder="A2033LKIT"
                />
              </div>
              <div>
                <label>Description</label>
                <input
                  className="text-input"
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  placeholder="40-inch grip arm included"
                />
              </div>
            </div>

            <div>
              <label>Notes</label>
              <textarea
                className="text-input textarea"
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Condition, storage location, accessories, maintenance notes…"
              />
            </div>

            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add equipment'}
            </button>
          </form>
        </section>

        <section className="card stack-md">
          <div>
            <h3>Import from XML</h3>
            <p className="muted">
              Upload an XML file and the app will create numbered units for each row based on the amount field.
            </p>
          </div>

          <div className="stack-sm">
            <label>XML file</label>
            <input className="text-input" type="file" accept=".xml,text/xml" onChange={handleXmlSelected} />
          </div>

          {importRows.length ? (
            <div className="stack-sm import-preview">
              <div className="row spread align-center wrap gap-sm">
                <strong>{importFileName}</strong>
                <span className="stat-chip">{importRows.length} rows ready</span>
              </div>
              <div className="picker-list compact-list">
                {importRows.slice(0, 8).map((row, index) => (
                  <div key={`${row.name}-${index}`} className="selected-item">
                    <div>
                      <strong>{row.name}</strong>
                      <div className="muted small-text">
                        {[row.type || 'General', `${row.amount} units`, row.manufacturer, row.model]
                          .filter(Boolean)
                          .join(' • ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {importRows.length > 8 ? (
                <div className="muted small-text">Showing 8 of {importRows.length} parsed rows.</div>
              ) : null}
              <button className="primary-button" type="button" onClick={handleImportXml} disabled={saving}>
                {saving ? 'Importing…' : 'Import XML into equipment'}
              </button>
            </div>
          ) : (
            <div className="muted">No XML file loaded yet.</div>
          )}
        </section>
      </div>

      <section className="card stack-md">
        <div className="row spread align-center wrap gap-md">
          <div>
            <h3>Inventory</h3>
            <p className="muted">Each equipment group expands into individually tracked items.</p>
          </div>
          <input
            className="text-input compact-input"
            placeholder="Search equipment…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {loading ? <div className="card compact">Loading equipment…</div> : null}

        {!loading && filteredGroups.length ? (
          <div className="stack-md">
            {filteredGroups.map((group) => (
              <article key={group.key} className="inventory-group">
                <div className="row spread align-start wrap gap-md">
                  <div>
                    <h4>{group.name}</h4>
                    <div className="muted small-text">
                      {[group.type, `${group.amount} total`, `${group.availableCount} available`, group.manufacturer, group.model]
                        .filter(Boolean)
                        .join(' • ')}
                    </div>
                    {group.description ? <p className="muted top-space">{group.description}</p> : null}
                  </div>
                </div>

                <div className="unit-grid top-space">
                  {group.items.map((item) => (
                    <div key={item.id} className="unit-card">
                      <div>
                        <strong>{item.displayName}</strong>
                        <div className="muted small-text">
                          {[item.type, item.serialNumber, item.status].filter(Boolean).join(' • ')}
                        </div>
                        {item.notes ? <div className="muted small-text top-space">{item.notes}</div> : null}
                      </div>
                      <button
                        type="button"
                        className="ghost-button danger-text"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        Remove item
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {!loading && !filteredGroups.length ? <div className="muted">No equipment found.</div> : null}
      </section>
    </div>
  );
}
