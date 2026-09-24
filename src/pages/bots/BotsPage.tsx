import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Film,
  BarChart3,
  MessageSquare,
  Anchor,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Check,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { ShineButton, FloatField, Loader, Tooltip } from '../../ui';
import {
  AGENT_SPECS,
  AgentKind,
  DemoReport,
  buildDemoReport,
  normaliseHandle,
} from './demo-data';
import './bots.css';

/** How many analysis agents a run can use. */
const AGENT_COUNTS = [1, 2, 3, 4, 5];

const ICONS: Record<AgentKind, React.ReactNode> = {
  video: <Film size={16} />,
  engagement: <BarChart3 size={16} />,
  comments: <MessageSquare size={16} />,
  hooks: <Anchor size={16} />,
  ideas: <Lightbulb size={16} />,
};

type RunState = 'idle' | 'running' | 'done';

interface RunHistoryEntry {
  id: string;
  handle: string;
  startedAt: number;
  finished: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 365;

type FinishedFilter = 'all' | 'yes' | 'no';

function toDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Bots — a prototype surface for a future analysis feature.
 *
 * The agents read and reason about a creator's own posts. There is no posting,
 * no view or like inflation and no comment automation here: the comment card
 * drafts replies for a human to send, and the run itself is simulated entirely
 * in the browser (see demo-data.ts).
 */
export function BotsPage() {
  const [handle, setHandle] = useState('');
  const [agents, setAgents] = useState(3);
  const [state, setState] = useState<RunState>('idle');
  const [done, setDone] = useState<AgentKind[]>([]);
  const [report, setReport] = useState<DemoReport | null>(null);
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);

  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(() => toDateInput(Date.now() - 30 * DAY_MS));
  const [rangeTo, setRangeTo] = useState(() => toDateInput(Date.now()));
  const [finishedFilter, setFinishedFilter] = useState<FinishedFilter>('all');

  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const canRun = normaliseHandle(handle).length > 1 && state !== 'running';

  const run = () => {
    if (!canRun) return;
    const clean = normaliseHandle(handle);
    clearTimers();
    setDone([]);
    setReport(null);
    setState('running');

    const runId = `${clean}-${Date.now()}`;
    setHistory((prev) => [{ id: runId, handle: clean, startedAt: Date.now(), finished: false }, ...prev]);

    /* The agents "report in" one at a time so the page has something to show
       while a real run would be waiting on the model. */
    const active = AGENT_SPECS.slice(0, Math.max(3, agents));
    active.forEach((spec, i) => {
      timers.current.push(
        setTimeout(() => setDone((prev) => [...prev, spec.kind]), 420 + i * 460)
      );
    });
    timers.current.push(
      setTimeout(() => {
        setReport(buildDemoReport(clean, agents));
        setState('done');
        setHistory((prev) =>
          prev.map((entry) => (entry.id === runId ? { ...entry, finished: true } : entry))
        );
      }, 420 + active.length * 460)
    );
  };

  const reset = () => {
    clearTimers();
    setState('idle');
    setDone([]);
    setReport(null);
  };

  const resetFilters = () => {
    setRangeFrom(toDateInput(Date.now() - 30 * DAY_MS));
    setRangeTo(toDateInput(Date.now()));
    setFinishedFilter('all');
    setRangeOpen(false);
  };

  const applyRangeFrom = (value: string) => {
    setRangeFrom(value);
    const from = new Date(value).getTime();
    const to = new Date(rangeTo).getTime();
    if (Number.isFinite(from) && Number.isFinite(to) && to - from > MAX_RANGE_DAYS * DAY_MS) {
      setRangeTo(toDateInput(from + MAX_RANGE_DAYS * DAY_MS));
    }
  };

  const applyRangeTo = (value: string) => {
    const from = new Date(rangeFrom).getTime();
    let to = new Date(value).getTime();
    if (Number.isFinite(from) && Number.isFinite(to)) {
      if (to - from > MAX_RANGE_DAYS * DAY_MS) to = from + MAX_RANGE_DAYS * DAY_MS;
      if (to - from < MIN_RANGE_DAYS * DAY_MS) to = from + MIN_RANGE_DAYS * DAY_MS;
    }
    setRangeTo(toDateInput(to));
  };

  const filteredHistory = useMemo(() => {
    const from = new Date(rangeFrom).getTime();
    const to = new Date(rangeTo).getTime() + DAY_MS - 1;
    return history.filter((entry) => {
      if (entry.startedAt < from || entry.startedAt > to) return false;
      if (finishedFilter === 'yes' && !entry.finished) return false;
      if (finishedFilter === 'no' && entry.finished) return false;
      return true;
    });
  }, [history, rangeFrom, rangeTo, finishedFilter]);

  const rangeLabel = `${rangeFrom} → ${rangeTo}`;

  return (
    <div className="bots-page">
      <header className="bots-header">
        <h1 className="bots-title">Bots</h1>
        <p className="bots-subtitle">
          Point a set of analysis agents at a TikTok account and read back what they
          make of it.
        </p>
      </header>

      {history.length > 0 && (
        <section className="bots-card bots-filters">
          <div className="bots-filters__head">
            <h2 className="bots-filters__title">Filters</h2>
            <button type="button" className="bots-filters__reset" onClick={resetFilters}>
              <RotateCcw size={13} />
              Reset
            </button>
          </div>

          <div className="bots-filters__row">
            <div className="bots-filters__field">
              <span className="picker-label">Time period</span>
              <button
                type="button"
                className="uv-pill bots-range-btn"
                onClick={() => setRangeOpen((v) => !v)}
                aria-expanded={rangeOpen}
              >
                <Calendar size={14} />
                {rangeLabel}
              </button>

              {rangeOpen && (
                <div className="bots-range-pop">
                  <label className="bots-range-field">
                    From
                    <input
                      type="date"
                      value={rangeFrom}
                      max={rangeTo}
                      onChange={(e) => applyRangeFrom(e.target.value)}
                    />
                  </label>
                  <label className="bots-range-field">
                    To
                    <input
                      type="date"
                      value={rangeTo}
                      min={rangeFrom}
                      onChange={(e) => applyRangeTo(e.target.value)}
                    />
                  </label>
                  <p className="bots-note bots-note--foot">7 days to 1 year</p>
                </div>
              )}
            </div>

            <div className="bots-filters__field">
              <span className="picker-label">Finished</span>
              <div className="bots-finished-row">
                {(['all', 'yes', 'no'] as FinishedFilter[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`uv-pill bots-finished-btn ${finishedFilter === v ? 'is-selected' : ''}`}
                    onClick={() => setFinishedFilter(v)}
                    aria-pressed={finishedFilter === v}
                  >
                    {v === 'all' ? 'All' : v === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ul className="bots-history">
            {filteredHistory.length === 0 && (
              <li className="bots-note bots-note--foot">No runs match these filters.</li>
            )}
            {filteredHistory.map((entry) => (
              <li key={entry.id} className="bots-history__row">
                <span className="bots-history__handle">@{entry.handle}</span>
                <span className="bots-history__date">
                  {new Date(entry.startedAt).toLocaleDateString()}
                </span>
                <span className={`bots-history__status ${entry.finished ? 'is-done' : ''}`}>
                  {entry.finished ? <Check size={13} /> : <Loader size="sm" />}
                  {entry.finished ? 'Finished' : 'Running'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bots-card">
        <div className="bots-run">
          <FloatField
            label="TikTok username"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            autoComplete="off"
            spellCheck={false}
          />

          <div className="picker-group">
            <span className="picker-label">Analysis agents</span>
            <div className="bots-agent-row">
              {AGENT_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`uv-pill bots-agent-btn ${agents === n ? 'is-selected' : ''}`}
                  onClick={() => setAgents(n)}
                  aria-pressed={agents === n}
                >
                  <Bot size={15} />
                  {n}
                </button>
              ))}
            </div>
          </div>

          <ShineButton block onClick={run} disabled={!canRun} icon={<Bot size={16} />}>
            {state === 'running' ? 'Analysing…' : 'Run analysis'}
          </ShineButton>

          <p className="bots-disclaimer">
            Demo only. The agents read public posts and draft suggestions for you —
            they never post, follow, like or comment on your behalf, and the figures
            below are simulated.
          </p>
        </div>

        {state !== 'idle' && (
          <div className="bots-roster">
            {AGENT_SPECS.slice(0, Math.max(3, agents)).map((spec) => {
              const finished = done.includes(spec.kind);
              return (
                <Tooltip key={spec.kind} text={spec.blurb} below>
                  <span className={`bots-chip ${finished ? 'is-done' : ''}`}>
                    {finished ? <Check size={14} /> : <Loader size="sm" />}
                    {spec.title}
                  </span>
                </Tooltip>
              );
            })}
          </div>
        )}
      </section>

      {report && (
        <div className="bots-results">
          <Card icon={ICONS.engagement} title="Engagement stats">
            <div className="bots-metrics">
              {report.engagement.map((m) => (
                <div key={m.label} className="bots-metric">
                  <span className="bots-metric__label">{m.label}</span>
                  <span className="bots-metric__value">{m.value}</span>
                  <span
                    className={`bots-metric__delta ${m.delta < 0 ? 'is-down' : 'is-up'}`}
                  >
                    {m.delta < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                    {Math.abs(m.delta)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card icon={ICONS.video} title="Video analysis">
            <ul className="bots-list">
              {report.video.map((v) => (
                <li key={v.label} className="bots-bar-row">
                  <div className="bots-bar-head">
                    <span>{v.label}</span>
                    <span className="bots-bar-score">{v.score}</span>
                  </div>
                  <span className="bots-bar">
                    <span className="bots-bar__fill" style={{ width: `${v.score}%` }} />
                  </span>
                  <p className="bots-note">{v.note}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={ICONS.hooks} title="Hook analysis">
            <ul className="bots-list">
              {report.hooks.map((h) => (
                <li key={h.text} className="bots-hook">
                  <span className={`bots-hook__score ${h.score >= 70 ? 'is-strong' : ''}`}>
                    {h.score}
                  </span>
                  <div>
                    <p className="bots-hook__text">&ldquo;{h.text}&rdquo;</p>
                    <p className="bots-note">{h.verdict}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={ICONS.comments} title="Comment suggestions">
            <ul className="bots-list">
              {report.comments.map((c) => (
                <li key={c.from} className="bots-comment">
                  <p className="bots-comment__from">{c.from}</p>
                  <p className="bots-comment__body">{c.comment}</p>
                  <p className="bots-comment__reply">{c.reply}</p>
                </li>
              ))}
            </ul>
            <p className="bots-note bots-note--foot">
              Drafts for you to send yourself — nothing is posted from here.
            </p>
          </Card>

          <Card icon={ICONS.ideas} title="Content ideas">
            <ul className="bots-list">
              {report.ideas.map((idea) => (
                <li key={idea.title} className="bots-idea">
                  <p className="bots-idea__title">{idea.title}</p>
                  <p className="bots-note">{idea.angle}</p>
                  <span className="bots-tag">{idea.format}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div className="bots-footer">
            <ShineButton quiet onClick={reset}>
              Clear run
            </ShineButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bots-card bots-result">
      <header className="bots-result__head">
        <span className="bots-result__icon">{icon}</span>
        <h2 className="bots-result__title">{title}</h2>
      </header>
      {children}
    </section>
  );
}
