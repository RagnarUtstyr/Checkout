import { formatDate } from '../lib/date';

export default function RentalCard({ rental, actions }) {
  return (
    <article className="card rental-card">
      <div className="row spread align-start gap-md wrap">
        <div>
          <div className="row gap-sm wrap">
            <span className={`status-chip ${rental.status}`}>{rental.status}</span>
            <span className="status-chip neutral">{rental.items?.length || 0} items</span>
          </div>
          <h3>{rental.renterName}</h3>
          <p className="muted">{rental.company || rental.email || rental.phone || 'No contact info added'}</p>
        </div>

        {actions ? <div className="row gap-sm wrap">{actions}</div> : null}
      </div>

      <div className="grid two-col metadata-grid">
        <div>
          <div className="label">Pickup</div>
          <div>{formatDate(rental.pickupDate)}</div>
        </div>
        <div>
          <div className="label">Return</div>
          <div>{formatDate(rental.returnDate)}</div>
        </div>
        <div>
          <div className="label">Phone</div>
          <div>{rental.phone || '—'}</div>
        </div>
        <div>
          <div className="label">Email</div>
          <div>{rental.email || '—'}</div>
        </div>
      </div>

      {rental.notes ? (
        <div>
          <div className="label">Notes</div>
          <p>{rental.notes}</p>
        </div>
      ) : null}

      <div>
        <div className="label">Equipment</div>
        <div className="item-list">
          {rental.items?.map((item, index) => (
            <div key={`${item.name}-${index}`} className="item-pill">
              <span>{item.name}</span>
              {item.serialNumber ? <small>#{item.serialNumber}</small> : null}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
