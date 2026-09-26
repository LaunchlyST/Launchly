import { CalendarClock, ListChecks, Send } from 'lucide-react';
import './automation.css';

/**
 * Automation (/automation).
 *
 * Nothing here posts, schedules, or runs a job yet — there is no worker route
 * or scheduler behind any of it. Each card says so plainly rather than
 * pretending a feature exists, matching how the paywall describes the
 * Affiliate Toolkit tier (src/pages/paywall/plans.ts).
 */
const SECTIONS = [
  {
    id: 'auto-post',
    icon: <Send size={18} />,
    title: 'Auto Post',
    note: 'Post generated content straight to your connected accounts.',
  },
  {
    id: 'scheduled-posts',
    icon: <CalendarClock size={18} />,
    title: 'Scheduled Posts',
    note: 'Queue posts ahead of time and let Launchly publish them for you.',
  },
  {
    id: 'content-jobs',
    icon: <ListChecks size={18} />,
    title: 'Content Jobs',
    note: 'Batch-generate content for many products or creators in one run.',
  },
];

export function AutomationPage() {
  return (
    <div className="simple-page">
      <header className="simple-page__header">
        <h1>Automation</h1>
        <p>Nothing is wired up yet — these are the tools coming to this section.</p>
      </header>
      <div className="simple-page__grid">
        {SECTIONS.map((s) => (
          <article key={s.id} className="simple-page__card">
            <div className="simple-page__card-icon">{s.icon}</div>
            <h2>{s.title}</h2>
            <p>{s.note}</p>
            <span className="simple-page__badge">Not built yet</span>
          </article>
        ))}
      </div>
    </div>
  );
}
