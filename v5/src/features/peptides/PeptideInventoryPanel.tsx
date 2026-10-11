import { useMemo, useState, type FormEvent } from 'react';
import type {
  PeptideInventoryLot,
  PeptideProtocol,
} from '../../types/database';
import {
  createPeptideInventoryLot,
  updatePeptideInventoryLot,
  type PeptideInventoryDraft,
} from './peptideRepository';
import { buildPeptideInventoryAlerts } from './peptideInventory';

type InventoryUnit = PeptideInventoryLot['quantity_unit'];

type Props = {
  userId: string;
  protocols: PeptideProtocol[];
  lots: PeptideInventoryLot[];
  onLotsChange: (lots: PeptideInventoryLot[]) => void;
};

function formatQuantity(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(4)));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(`${value}T12:00:00`),
  );
}

export function PeptideInventoryPanel({
  userId,
  protocols,
  lots,
  onLotsChange,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [protocolId, setProtocolId] = useState('');
  const [name, setName] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('vials');
  const [threshold, setThreshold] = useState('');
  const [openedOn, setOpenedOn] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [status, setStatus] = useState<'ready' | 'saving' | 'error'>('ready');
  const [message, setMessage] = useState('');

  const activeLots = useMemo(() => lots.filter((lot) => lot.is_active), [lots]);
  const alerts = useMemo(
    () => buildPeptideInventoryAlerts(activeLots),
    [activeLots],
  );

  function resetForm() {
    setEditingLotId(null);
    setProtocolId('');
    setName('');
    setLotNumber('');
    setQuantity('');
    setUnit('vials');
    setThreshold('');
    setOpenedOn('');
    setExpiresOn('');
    setShowForm(false);
  }

  function selectProtocol(value: string) {
    setProtocolId(value);
    const protocol = protocols.find((item) => item.id === value);
    if (protocol) setName(protocol.peptide_name);
  }

  function beginEdit(lot: PeptideInventoryLot) {
    setEditingLotId(lot.id);
    setProtocolId(lot.protocol_id ?? '');
    setName(lot.peptide_name);
    setLotNumber(lot.lot_number ?? '');
    setQuantity(formatQuantity(lot.quantity_remaining));
    setUnit(lot.quantity_unit);
    setThreshold(
      lot.low_stock_threshold === null
        ? ''
        : formatQuantity(lot.low_stock_threshold),
    );
    setOpenedOn(lot.opened_on ?? '');
    setExpiresOn(lot.expires_on ?? '');
    setMessage('');
    setShowForm(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantityValue = Number(quantity);
    const thresholdValue = threshold === '' ? null : Number(threshold);

    if (
      !name.trim() ||
      !Number.isFinite(quantityValue) ||
      quantityValue < 0 ||
      (thresholdValue !== null &&
        (!Number.isFinite(thresholdValue) || thresholdValue < 0))
    ) {
      setStatus('error');
      setMessage('Enter a name and valid non-negative inventory amounts.');
      return;
    }
    if (openedOn && expiresOn && expiresOn < openedOn) {
      setStatus('error');
      setMessage('Expiration cannot be before the opened date.');
      return;
    }

    const draft: PeptideInventoryDraft = {
      protocol_id: protocolId || null,
      peptide_name: name.trim(),
      lot_number: lotNumber.trim() || null,
      quantity_remaining: quantityValue,
      quantity_unit: unit,
      low_stock_threshold: thresholdValue,
      opened_on: openedOn || null,
      expires_on: expiresOn || null,
      is_active: true,
    };

    setStatus('saving');
    const result = editingLotId
      ? await updatePeptideInventoryLot(userId, editingLotId, draft)
      : await createPeptideInventoryLot(userId, draft);

    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      return;
    }

    onLotsChange(
      editingLotId
        ? lots.map((lot) => (lot.id === result.data.id ? result.data : lot))
        : [result.data, ...lots],
    );
    setStatus('ready');
    setMessage(editingLotId ? 'Inventory updated.' : 'Inventory lot saved.');
    resetForm();
  }

  async function archiveLot(lot: PeptideInventoryLot) {
    setStatus('saving');
    const result = await updatePeptideInventoryLot(userId, lot.id, {
      is_active: false,
    });
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      return;
    }
    onLotsChange(
      lots.map((item) => (item.id === result.data.id ? result.data : item)),
    );
    setStatus('ready');
    setMessage('Inventory lot archived.');
  }

  return (
    <section className="peptide-section peptide-inventory">
      <div className="peptide-section-heading">
        <div>
          <span>Inventory</span>
          <h3>{activeLots.length} active lots</h3>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setShowForm(true)}
        >
          Add inventory
        </button>
      </div>

      {alerts.length > 0 ? (
        <div className="peptide-inventory-alerts" role="status">
          <strong>{alerts.length} inventory alerts</strong>
          <ul>
            {alerts.map((alert) => (
              <li key={`${alert.kind}-${alert.lot.id}`}>
                <span className={`peptide-alert peptide-alert--${alert.kind}`}>
                  {alert.kind === 'expired'
                    ? 'Expired'
                    : alert.kind === 'expiring'
                      ? 'Expiring'
                      : 'Low stock'}
                </span>
                <b>{alert.lot.peptide_name}</b>
                <small>
                  {alert.kind === 'low'
                    ? `${formatQuantity(alert.lot.quantity_remaining)} ${alert.lot.quantity_unit} remaining`
                    : alert.daysUntilExpiry === 0
                      ? 'Expires today'
                      : alert.daysUntilExpiry !== null &&
                          alert.daysUntilExpiry > 0
                        ? `Expires in ${alert.daysUntilExpiry} days`
                        : `Expired ${Math.abs(alert.daysUntilExpiry ?? 0)} days ago`}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <p
          className={
            status === 'error'
              ? 'auth-message auth-message--error'
              : 'auth-message'
          }
          role={status === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      ) : null}

      {showForm ? (
        <form
          className="peptide-inventory-form"
          onSubmit={(event) => void handleSave(event)}
        >
          <div className="peptide-section-heading">
            <div>
              <span>{editingLotId ? 'Edit lot' : 'New lot'}</span>
              <h3>Record what you have on hand</h3>
            </div>
            <button
              className="peptide-text-button"
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>
          <div className="peptide-form-grid">
            <label>
              Link to schedule
              <select
                value={protocolId}
                onChange={(event) => selectProtocol(event.target.value)}
              >
                <option value="">No linked schedule</option>
                {protocols.map((protocol) => (
                  <option key={protocol.id} value={protocol.id}>
                    {protocol.peptide_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Peptide label
              <input
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Lot number
              <input
                maxLength={120}
                value={lotNumber}
                onChange={(event) => setLotNumber(event.target.value)}
              />
            </label>
            <label>
              Quantity remaining
              <input
                required
                min="0"
                max="1000000"
                step="any"
                inputMode="decimal"
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <label>
              Inventory unit
              <select
                value={unit}
                onChange={(event) =>
                  setUnit(event.target.value as InventoryUnit)
                }
              >
                <option value="vials">vials</option>
                <option value="mg">mg</option>
                <option value="mL">mL</option>
                <option value="units">units</option>
              </select>
            </label>
            <label>
              Low-stock alert at
              <input
                min="0"
                max="1000000"
                step="any"
                inputMode="decimal"
                type="number"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Opened date
              <input
                type="date"
                value={openedOn}
                onChange={(event) => setOpenedOn(event.target.value)}
              />
            </label>
            <label>
              Expiration date
              <input
                type="date"
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
              />
            </label>
          </div>
          <button
            className="primary-button"
            disabled={status === 'saving'}
            type="submit"
          >
            {status === 'saving'
              ? 'Saving…'
              : editingLotId
                ? 'Update inventory'
                : 'Save inventory'}
          </button>
        </form>
      ) : null}

      {activeLots.length === 0 ? (
        <div className="peptide-empty">
          <strong>No inventory recorded</strong>
          <p>Add a lot to track remaining stock and expiration.</p>
        </div>
      ) : (
        <div className="peptide-inventory-grid">
          {activeLots.map((lot) => (
            <article className="peptide-inventory-card" key={lot.id}>
              <div>
                <span>On hand</span>
                <h3>{lot.peptide_name}</h3>
                <strong>
                  {formatQuantity(lot.quantity_remaining)} {lot.quantity_unit}
                </strong>
              </div>
              <dl>
                <div>
                  <dt>Lot</dt>
                  <dd>{lot.lot_number ?? 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Opened</dt>
                  <dd>
                    {lot.opened_on ? formatDate(lot.opened_on) : 'Not set'}
                  </dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>
                    {lot.expires_on ? formatDate(lot.expires_on) : 'Not set'}
                  </dd>
                </div>
              </dl>
              <div className="peptide-card-actions">
                <button
                  className="secondary-button"
                  disabled={status === 'saving'}
                  type="button"
                  onClick={() => beginEdit(lot)}
                >
                  Update
                </button>
                <button
                  className="peptide-text-button"
                  disabled={status === 'saving'}
                  type="button"
                  onClick={() => void archiveLot(lot)}
                >
                  Archive
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
