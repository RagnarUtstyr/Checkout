import { useMemo, useState } from 'react';

export default function EquipmentPicker({ catalog, selectedItems, onChange }) {
  const [query, setQuery] = useState('');
  const [customItemName, setCustomItemName] = useState('');

  const filteredEquipment = useMemo(() => {
    if (!query.trim()) return catalog;
    const normalized = query.toLowerCase();
    return catalog.filter((item) => {
      return [item.displayName, item.name, item.type, item.category, item.serialNumber, item.barcode]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [catalog, query]);

  function addItem(item) {
    onChange([
      ...selectedItems,
      {
        equipmentId: item.id,
        name: item.displayName || item.name,
        equipmentName: item.name,
        type: item.type || item.category || '',
        serialNumber: item.serialNumber || '',
        unitNumber: item.unitNumber || null,
        pickedUp: false,
        returned: false,
      },
    ]);
  }

  function addCustomItem() {
    if (!customItemName.trim()) return;
    onChange([
      ...selectedItems,
      {
        equipmentId: null,
        name: customItemName.trim(),
        equipmentName: customItemName.trim(),
        type: 'Custom',
        serialNumber: '',
        unitNumber: null,
        pickedUp: false,
        returned: false,
      },
    ]);
    setCustomItemName('');
  }

  function removeItem(indexToRemove) {
    onChange(selectedItems.filter((_, index) => index !== indexToRemove));
  }

  return (
    <div className="grid two-col gap-lg">
      <section className="card">
        <div className="row spread gap-sm wrap align-center">
          <div>
            <h3>Search equipment</h3>
            <p className="muted">Add individual items from your Firebase equipment collection.</p>
          </div>
          <input
            className="text-input compact-input"
            placeholder="Search by name, type, serial…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="picker-list">
          {filteredEquipment.length ? (
            filteredEquipment.map((item) => (
              <button
                key={item.id}
                type="button"
                className="picker-item"
                onClick={() => addItem(item)}
              >
                <div>
                  <strong>{item.displayName || item.name}</strong>
                  <div className="muted small-text">
                    {[item.type || item.category, item.manufacturer, item.model, item.serialNumber]
                      .filter(Boolean)
                      .join(' • ') || 'No details'}
                  </div>
                </div>
                <span className="plus">+</span>
              </button>
            ))
          ) : (
            <p className="muted">No equipment matches your search.</p>
          )}
        </div>

        <div className="inline-form">
          <input
            className="text-input"
            placeholder="Add a custom item"
            value={customItemName}
            onChange={(event) => setCustomItemName(event.target.value)}
          />
          <button type="button" className="secondary-button" onClick={addCustomItem}>
            Add custom item
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Selected equipment</h3>
        <div className="picker-list selected-list">
          {selectedItems.length ? (
            selectedItems.map((item, index) => (
              <div key={`${item.equipmentId || item.name}-${index}`} className="selected-item">
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted small-text">
                    {[item.type, item.serialNumber].filter(Boolean).join(' • ') || 'No serial number'}
                  </div>
                </div>
                <button type="button" className="ghost-button" onClick={() => removeItem(index)}>
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="muted">No equipment added yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
