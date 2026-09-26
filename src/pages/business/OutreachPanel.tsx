import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Mail, Paperclip, Send, X } from 'lucide-react';
import type { Business, BusinessNote, OutreachRecord } from './businessService';
import { businessApi } from './businessService';

type Tab = 'email' | 'message' | 'note' | 'follow';

interface Props {
  business: Business | null;
  /** Verified email: from the provider or the business's own website. Never guessed. */
  email: string | null;
  emailLoading: boolean;
  token: string;
  api?: Pick<typeof businessApi, 'notes' | 'addNote' | 'outreach' | 'addOutreach' | 'emailStatus'>;
}

type Flash = { kind: 'ok' | 'error'; text: string } | null;

export function OutreachPanel({ business, email, emailLoading, token, api = businessApi }: Props) {
  const [tab, setTab] = useState<Tab>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [noteText, setNoteText] = useState('');
  const [followAt, setFollowAt] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [notes, setNotes] = useState<BusinessNote[]>([]);
  const [history, setHistory] = useState<OutreachRecord[]>([]);
  const [mailbox, setMailbox] = useState<{ connected: boolean; configured: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.emailStatus(token).then(({ data }) => setMailbox(data)).catch(() => setMailbox({ connected: false, configured: false }));
  }, [token, api]);

  // New business → fresh draft, its own notes and history.
  useEffect(() => {
    setFlash(null);
    setNotes([]);
    setHistory([]);
    if (!business) return;
    setSubject(`Quick idea to help grow ${business.name} online`);
    setBody(
      `Hi there,\n\nI came across ${business.name}${business.city ? ` in ${business.city}` : ''} and wanted to reach out. ` +
        `I help local businesses grow their online presence through social media and ads.\n\n` +
        `Would you be open to a quick chat about a few ideas tailored to your business?\n\nBest,\n`
    );
    let cancelled = false;
    api.notes(business.id, token).then(({ data }) => !cancelled && setNotes(data)).catch(() => {});
    api.outreach(business.id, token).then(({ data }) => !cancelled && setHistory(data)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [business?.id, token, api]);

  if (!business) {
    return (
      <section className="bc-outreach bc-outreach--empty" aria-label="Outreach">
        <Mail size={20} strokeWidth={1.6} />
        <p>Select a business to start outreach.</p>
      </section>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFlash(null);
    try {
      await fn();
    } catch (err) {
      setFlash({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = (channel: 'email' | 'message') =>
    run(async () => {
      const { data } = await api.addOutreach(
        business.id,
        { intent: 'draft', channel, subject: channel === 'email' ? subject : undefined, body: channel === 'email' ? body : message },
        token
      );
      setHistory((h) => [data, ...h]);
      setFlash({ kind: 'ok', text: 'Draft saved to this lead.' });
    });

  const sendEmail = () =>
    run(async () => {
      await api.addOutreach(business.id, { intent: 'send', channel: 'email', subject, body }, token);
    });

  const scheduleFollowUp = () =>
    run(async () => {
      if (!followAt) throw new Error('Pick a date and time for the follow-up.');
      const { data } = await api.addOutreach(
        business.id,
        { intent: 'follow_up', subject: `Follow up with ${business.name}`, body: noteText || 'Follow up', scheduledFor: new Date(followAt).toISOString() },
        token
      );
      setHistory((h) => [data, ...h]);
      setFlash({ kind: 'ok', text: `Follow-up scheduled for ${new Date(data.scheduledFor!).toLocaleString()}.` });
      setFollowAt('');
    });

  const addNote = () =>
    run(async () => {
      if (!noteText.trim()) throw new Error('Write a note first.');
      const { data } = await api.addNote(business.id, noteText.trim(), token);
      setNotes((n) => [data, ...n]);
      setNoteText('');
      setFlash({ kind: 'ok', text: 'Note saved.' });
    });

  const connected = !!mailbox?.connected;

  return (
    <section className="bc-outreach" aria-label="Outreach">
      <header className="bc-outreach__head">
        <Mail size={18} strokeWidth={1.8} />
        <h2>Outreach to {business.name}</h2>
      </header>

      <div className="bc-tabs" role="tablist">
        {(
          [
            ['email', 'Send Email'],
            ['message', 'Send Message'],
            ['note', 'Add Note'],
            ['follow', 'Schedule Follow Up'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} className={`bc-tab ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'email' && (
        <div className="bc-form">
          {!connected && (
            <div className="bc-connect" data-testid="connect-gmail">
              <div>
                <p className="bc-connect__title">Connect Gmail to send from Launchly</p>
                <p className="bc-muted">
                  {mailbox?.configured
                    ? 'Link your Gmail account to send and track replies without leaving Launchly.'
                    : 'Gmail sending isn’t switched on for Launchly yet. Drafts are saved to this lead in the meantime.'}
                </p>
              </div>
              <button type="button" className="bc-btn bc-btn--ghost" disabled={!mailbox?.configured} title={mailbox?.configured ? '' : 'Coming soon'}>
                Connect Gmail
              </button>
            </div>
          )}
          <label className="bc-field">
            <span>To</span>
            <div className="bc-field__static" data-testid="email-to">
              {emailLoading ? <span className="bc-muted">Looking for a verified email…</span> : email ?? <span className="bc-muted">Email not found</span>}
            </div>
          </label>
          <label className="bc-field">
            <span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="bc-field bc-field--top">
            <span>Message</span>
            <textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div className="bc-actions">
            <input ref={fileRef} type="file" hidden onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} />
            {attachment ? (
              <span className="bc-attachment">
                <Paperclip size={14} /> {attachment.name}
                <button type="button" aria-label="Remove attachment" onClick={() => setAttachment(null)}>
                  <X size={13} />
                </button>
              </span>
            ) : (
              <button type="button" className="bc-link-btn" onClick={() => fileRef.current?.click()}>
                <Paperclip size={15} /> Attach File
              </button>
            )}
            <div className="bc-actions__right">
              <button type="button" className="bc-btn bc-btn--outline" disabled={busy} onClick={() => saveDraft('email')}>
                Save Draft
              </button>
              <button
                type="button"
                className="bc-btn bc-btn--primary"
                disabled={busy || !connected || !email}
                title={!connected ? 'Connect Gmail first' : !email ? 'No verified email for this business' : ''}
                onClick={sendEmail}
              >
                <Send size={15} /> Send Email
              </button>
              <button type="button" className="bc-btn bc-btn--outline" onClick={() => setTab('follow')}>
                <CalendarClock size={15} /> Follow Up
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'message' && (
        <div className="bc-form">
          <p className="bc-muted">
            {business.phone ? `Phone: ${business.phone}` : 'Phone number unavailable.'} Write your message here and save it to this lead; send it from the platform you contact them on.
          </p>
          <label className="bc-field bc-field--top">
            <span>Message</span>
            <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi! I loved your recent posts…" />
          </label>
          <div className="bc-actions">
            <div className="bc-actions__right">
              <button type="button" className="bc-btn bc-btn--outline" disabled={busy || !message.trim()} onClick={() => saveDraft('message')}>
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'note' && (
        <div className="bc-form">
          <label className="bc-field bc-field--top">
            <span>Note</span>
            <textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Spoke to the owner, call back Tuesday…" />
          </label>
          <div className="bc-actions">
            <div className="bc-actions__right">
              <button type="button" className="bc-btn bc-btn--primary" disabled={busy} onClick={addNote}>
                Save Note
              </button>
            </div>
          </div>
          {notes.length > 0 && (
            <ul className="bc-list" data-testid="notes-list">
              {notes.map((n) => (
                <li key={n.id}>
                  <p>{n.content}</p>
                  <time className="bc-muted">{new Date(n.createdAt).toLocaleString()}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'follow' && (
        <div className="bc-form">
          <label className="bc-field">
            <span>When</span>
            <input type="datetime-local" value={followAt} onChange={(e) => setFollowAt(e.target.value)} />
          </label>
          <label className="bc-field bc-field--top">
            <span>Reminder</span>
            <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What to follow up about" />
          </label>
          <div className="bc-actions">
            <div className="bc-actions__right">
              <button type="button" className="bc-btn bc-btn--primary" disabled={busy} onClick={scheduleFollowUp}>
                <CalendarClock size={15} /> Schedule Follow Up
              </button>
            </div>
          </div>
        </div>
      )}

      {flash && (
        <p className={`bc-flash bc-flash--${flash.kind}`} role="status">
          {flash.text}
        </p>
      )}

      {history.length > 0 && (
        <div className="bc-history">
          <p className="bc-card__label bc-card__label--strong">Activity</p>
          <ul className="bc-list">
            {history.slice(0, 5).map((h) => (
              <li key={h.id}>
                <p>
                  <span className={`bc-pill bc-pill--${h.status}`}>{h.status}</span> {h.subject ?? h.body.slice(0, 60)}
                </p>
                <time className="bc-muted">{new Date(h.scheduledFor ?? h.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
