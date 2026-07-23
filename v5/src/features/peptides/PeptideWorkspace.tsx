import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useAuth } from '../auth/AuthProvider';
import type {
  PeptideAdministration,
  PeptideProtocol,
} from '../../types/database';
import {
  createPeptideProtocol,
  loadPeptideTracker,
  recordPeptideAdministration,
  updatePeptideProtocol,
  type PeptideProtocolDraft,
} from './peptideRepository';
import { describePeptideFrequency, peptideWeekDays } from './peptideSchedule';

type Frequency = PeptideProtocol['frequency_type'];
type DoseUnit = PeptideProtocol['dose_unit'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatAmount(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(4)));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function PeptideWorkspace() {
  const { user } = useAuth();
  const [protocols, setProtocols] = useState<PeptideProtocol[]>([]);
  const [administrations, setAdministrations] = useState<
    PeptideAdministration[]
  >([]);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'saving' | 'error'
  >('loading');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState<DoseUnit>('mcg');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [timeOfDay, setTimeOfDay] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState('2');
  const [startDate, setStartDate] = useState(today());

  const refresh = useCallback(async () => {
    if (!user) return;
    setStatus('loading');
    const result = await loadPeptideTracker(user.id);
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      return;
    }
    setProtocols(result.data.protocols);
    setAdministrations(result.data.administrations);
    setStatus('ready');
    setMessage('');
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeProtocols = useMemo(
    () => protocols.filter((protocol) => protocol.is_active),
    [protocols],
  );

  function resetForm() {
    setName('');
    setDose('');
    setUnit('mcg');
    setFrequency('daily');
    setTimeOfDay('08:00');
    setSelectedDays([]);
    setIntervalDays('2');
    setStartDate(today());
    setShowForm(false);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const doseAmount = Number(dose);
    if (!name.trim() || !Number.isFinite(doseAmount) || doseAmount <= 0) {
      setMessage('Enter a peptide name and a dose greater than zero.');
      return;
    }
    if (frequency === 'selected_days' && selectedDays.length === 0) {
      setMessage('Select at least one day of the week.');
      return;
    }
    const interval = Number(intervalDays);
    if (
      frequency === 'interval_days' &&
      (!Number.isInteger(interval) || interval < 1 || interval > 365)
    ) {
      setMessage('Enter a repeat interval between 1 and 365 days.');
      return;
    }

    const draft: PeptideProtocolDraft = {
      peptide_name: name.trim(),
      dose_amount: doseAmount,
      dose_unit: unit,
      frequency_type: frequency,
      time_of_day: frequency === 'as_needed' ? null : timeOfDay,
      days_of_week: frequency === 'selected_days' ? selectedDays : [],
      interval_days: frequency === 'interval_days' ? interval : null,
      start_date: startDate,
      end_date: null,
      is_active: true,
    };

    setStatus('saving');
    const result = await createPeptideProtocol(user.id, draft);
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      return;
    }
    setProtocols((current) => [result.data, ...current]);
    setStatus('ready');
    setMessage('Schedule saved.');
    resetForm();
  }

  async function handleRecord(
    protocol: PeptideProtocol,
    recordStatus: PeptideAdministration['status'],
  ) {
    if (!user) return;
    setStatus('saving');
    const result = await recordPeptideAdministration(
      user.id,
      protocol,
      recordStatus,
    );
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      return;
    }
    setAdministrations((current) => [result.data, ...current].slice(0, 100));
    setStatus('ready');
    setMessage(
      recordStatus === 'taken' ? 'Dose recorded.' : 'Dose marked as skipped.',
    );
  }

  async function handleArchive(protocol: PeptideProtocol) {
    if (!user) return;
    setStatus('saving');
    const result = await updatePeptideProtocol(user.id, protocol.id, {
      is_active: false,
    });
    if (!result.ok) {
      setStatus('error');
      setMessage(result.error);
      return;
    }
    setProtocols((current) =>
      current.map((item) => (item.id === result.data.id ? result.data : item)),
    );
    setStatus('ready');
    setMessage('Schedule archived. Its history remains available.');
  }

  return (
    <div className="peptide-workspace">
      <section className="peptide-hero">
        <div>
          <p className="eyebrow">Peptide AI</p>
          <h2>Your peptide record</h2>
          <p>
            Track what you use, the recorded dose, its schedule and your
            personal history.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setShowForm(true)}
        >
          Add peptide
        </button>
      </section>

      <aside className="peptide-safety-note">
        <strong>Personal record only</strong>
        <span>
          BioTrack does not prescribe peptides or recommend doses. Record only a
          plan you have already chosen with an appropriately licensed clinician.
        </span>
      </aside>

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
          className="peptide-form"
          onSubmit={(event) => void handleCreate(event)}
        >
          <div className="peptide-section-heading">
            <div>
              <span>New schedule</span>
              <h3>What do you want to track?</h3>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>

          <div className="peptide-form-grid">
            <label>
              Peptide name
              <input
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter the label on your plan"
              />
            </label>
            <label>
              Dose
              <input
                required
                min="0.0001"
                max="1000000"
                step="any"
                inputMode="decimal"
                type="number"
                value={dose}
                onChange={(event) => setDose(event.target.value)}
              />
            </label>
            <label>
              Unit
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value as DoseUnit)}
              >
                <option value="mcg">mcg</option>
                <option value="mg">mg</option>
                <option value="mL">mL</option>
                <option value="units">units</option>
              </select>
            </label>
            <label>
              Frequency
              <select
                value={frequency}
                onChange={(event) =>
                  setFrequency(event.target.value as Frequency)
                }
              >
                <option value="daily">Every day</option>
                <option value="selected_days">Selected weekdays</option>
                <option value="interval_days">Every number of days</option>
                <option value="as_needed">Record only / as needed</option>
              </select>
            </label>
            {frequency === 'interval_days' ? (
              <label>
                Repeat every
                <span className="peptide-inline-input">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={intervalDays}
                    onChange={(event) => setIntervalDays(event.target.value)}
                  />
                  days
                </span>
              </label>
            ) : null}
            {frequency !== 'as_needed' ? (
              <label>
                Usual time
                <input
                  type="time"
                  required
                  value={timeOfDay}
                  onChange={(event) => setTimeOfDay(event.target.value)}
                />
              </label>
            ) : null}
            <label>
              Start date
              <input
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
          </div>

          {frequency === 'selected_days' ? (
            <fieldset className="peptide-weekdays">
              <legend>Days of the week</legend>
              {peptideWeekDays.map((day) => (
                <label key={day.value}>
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(day.value)}
                    onChange={() =>
                      setSelectedDays((current) =>
                        current.includes(day.value)
                          ? current.filter((value) => value !== day.value)
                          : [...current, day.value].sort(),
                      )
                    }
                  />
                  <span>{day.short}</span>
                </label>
              ))}
            </fieldset>
          ) : null}

          <button
            className="primary-button"
            disabled={status === 'saving'}
            type="submit"
          >
            {status === 'saving' ? 'Saving…' : 'Save schedule'}
          </button>
        </form>
      ) : null}

      <section className="peptide-section">
        <div className="peptide-section-heading">
          <div>
            <span>Active schedules</span>
            <h3>{activeProtocols.length} currently tracked</h3>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>

        {status === 'loading' ? <p>Loading your private records…</p> : null}
        {status !== 'loading' && activeProtocols.length === 0 ? (
          <div className="peptide-empty">
            <strong>No peptide schedules yet</strong>
            <p>Add your first schedule to start a private dose history.</p>
          </div>
        ) : null}

        <div className="peptide-protocol-grid">
          {activeProtocols.map((protocol) => (
            <article className="peptide-protocol-card" key={protocol.id}>
              <div className="peptide-protocol-title">
                <div>
                  <span>Active</span>
                  <h3>{protocol.peptide_name}</h3>
                </div>
                <strong>
                  {formatAmount(protocol.dose_amount)} {protocol.dose_unit}
                </strong>
              </div>
              <dl>
                <div>
                  <dt>Frequency</dt>
                  <dd>{describePeptideFrequency(protocol)}</dd>
                </div>
                <div>
                  <dt>Usual time</dt>
                  <dd>
                    {protocol.time_of_day?.slice(0, 5) ?? 'Not scheduled'}
                  </dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{protocol.start_date}</dd>
                </div>
              </dl>
              <div className="peptide-card-actions">
                <button
                  className="primary-button"
                  disabled={status === 'saving'}
                  type="button"
                  onClick={() => void handleRecord(protocol, 'taken')}
                >
                  Record dose
                </button>
                <button
                  className="secondary-button"
                  disabled={status === 'saving'}
                  type="button"
                  onClick={() => void handleRecord(protocol, 'skipped')}
                >
                  Skip
                </button>
                <button
                  className="peptide-text-button"
                  disabled={status === 'saving'}
                  type="button"
                  onClick={() => void handleArchive(protocol)}
                >
                  Archive
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="peptide-section">
        <div className="peptide-section-heading">
          <div>
            <span>History</span>
            <h3>Recent records</h3>
          </div>
        </div>
        {administrations.length === 0 ? (
          <div className="peptide-empty">
            <strong>No doses recorded</strong>
            <p>Your recorded and skipped doses will appear here.</p>
          </div>
        ) : (
          <div className="peptide-history-list">
            {administrations.map((administration) => (
              <article key={administration.id}>
                <span
                  className={`peptide-history-status peptide-history-status--${administration.status}`}
                >
                  {administration.status === 'taken' ? 'Recorded' : 'Skipped'}
                </span>
                <div>
                  <strong>{administration.peptide_name_snapshot}</strong>
                  <small>{formatDateTime(administration.recorded_at)}</small>
                </div>
                <b>
                  {formatAmount(administration.dose_amount_snapshot)}{' '}
                  {administration.dose_unit_snapshot}
                </b>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
