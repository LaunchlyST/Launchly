/**
 * Demo data for the Bots page.
 *
 * Everything here is generated locally from a seeded PRNG. Nothing in this
 * module touches TikTok, and nothing it produces is posted anywhere: the
 * "agents" are a UI device for showing what a future analysis run would look
 * like. There is deliberately no view, like, follow or comment automation —
 * the page only ever reads and reasons about content a creator already owns.
 */

/** Deterministic PRNG, so the same handle always yields the same demo run. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

export type AgentKind = 'video' | 'engagement' | 'comments' | 'hooks' | 'ideas';

export interface AgentSpec {
  kind: AgentKind;
  title: string;
  /** What this agent claims to do, in one line. */
  blurb: string;
}

export const AGENT_SPECS: AgentSpec[] = [
  { kind: 'video', title: 'Video analysis', blurb: 'Pacing, retention shape and cut rhythm' },
  { kind: 'engagement', title: 'Engagement stats', blurb: 'Reach, saves and follow-through' },
  { kind: 'comments', title: 'Comment suggestions', blurb: 'Replies you could write yourself' },
  { kind: 'hooks', title: 'Hook analysis', blurb: 'The first three seconds, line by line' },
  { kind: 'ideas', title: 'Content ideas', blurb: 'Next posts drawn from what worked' },
];

export interface VideoInsight {
  label: string;
  /** 0–100, drawn as a bar. */
  score: number;
  note: string;
}

export interface Metric {
  label: string;
  value: string;
  /** Signed percentage change against the previous demo window. */
  delta: number;
}

export interface CommentSuggestion {
  from: string;
  comment: string;
  reply: string;
}

export interface HookLine {
  text: string;
  score: number;
  verdict: string;
}

export interface Idea {
  title: string;
  angle: string;
  format: string;
}

export interface DemoReport {
  handle: string;
  agents: number;
  video: VideoInsight[];
  engagement: Metric[];
  comments: CommentSuggestion[];
  hooks: HookLine[];
  ideas: Idea[];
}

const VIDEO_LABELS = [
  ['Opening pacing', 'The first cut lands before the hook finishes.'],
  ['Retention shape', 'A dip around the midpoint, recovered by the payoff.'],
  ['Cut rhythm', 'Steady, with two long holds that read as deliberate.'],
  ['Caption legibility', 'Readable at thumbnail size on a small screen.'],
  ['Audio balance', 'Voice sits above the bed for the whole clip.'],
];

const COMMENT_SEEDS: Array<[string, string, string]> = [
  ['@mara.builds', 'where did you get the lighting setup?', 'Two cheap clamp lights and a bedsheet — happy to film the setup if that would help.'],
  ['@finnwatches', 'does this work for a smaller account?', 'That was the whole reason I tried it at this size. Tell me your niche and I will aim the next one at it.'],
  ['@oli.makes', 'part 2 please', 'Part 2 is filmed. What is the one thing you want answered in it?'],
  ['@ruth_kd', 'how long did the edit take?', 'About forty minutes, most of it on the first three seconds.'],
  ['@dev.on.tap', 'saving this one', 'Glad it earned the save — the follow-up goes deeper on the same idea.'],
];

const HOOK_SEEDS: Array<[string, string]> = [
  ['Nobody tells you this part.', 'Strong open, but it has been worn thin. Name the part.'],
  ['I rebuilt this three times.', 'Concrete and specific. Keep it.'],
  ['Here is what changed.', 'Vague on its own; pair it with the number.'],
  ['Stop doing this to your intro.', 'Reads as scolding. Soften to a question.'],
  ['Day 14 of the rebuild.', 'Works only if the series is already known.'],
];

const IDEA_SEEDS: Array<[string, string, string]> = [
  ['The version that failed', 'Show the cut you did not post and say why', 'Talking head + B-roll'],
  ['Three seconds, three takes', 'Same hook read three ways, audience picks', 'Split screen'],
  ['Answer the top comment', 'Turn the most-liked question into its own post', 'Direct reply'],
  ['Before the edit', 'Raw footage next to the finished clip', 'Side by side'],
  ['One tool, one problem', 'Narrow the usual overview to a single fix', 'Screen record'],
];

function pick<T>(rand: () => number, list: T[], count: number): T[] {
  const copy = [...list];
  const out: T[] = [];
  while (out.length < count && copy.length > 0) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}

function compact(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Build one demo report. Pure, synchronous and offline. */
export function buildDemoReport(handle: string, agents: number): DemoReport {
  const rand = seeded(`${handle}:${agents}`);
  const depth = Math.min(5, Math.max(1, agents));

  const views = 4000 + Math.floor(rand() * 90000);
  const engagement = [
    { label: 'Views', value: compact(views), delta: Math.round(rand() * 60 - 15) },
    { label: 'Watch-through', value: `${(28 + rand() * 45).toFixed(1)}%`, delta: Math.round(rand() * 24 - 8) },
    { label: 'Saves', value: compact(Math.floor(views * (0.01 + rand() * 0.04))), delta: Math.round(rand() * 50 - 10) },
    { label: 'Follows from post', value: compact(Math.floor(views * (0.002 + rand() * 0.01))), delta: Math.round(rand() * 40 - 12) },
  ];

  return {
    handle,
    agents,
    engagement,
    video: pick(rand, VIDEO_LABELS, Math.max(3, depth)).map(([label, note]) => ({
      label,
      note,
      score: 45 + Math.floor(rand() * 50),
    })),
    comments: pick(rand, COMMENT_SEEDS, Math.max(2, depth - 1)).map(([from, comment, reply]) => ({
      from,
      comment,
      reply,
    })),
    hooks: pick(rand, HOOK_SEEDS, Math.max(3, depth)).map(([text, verdict]) => ({
      text,
      verdict,
      score: 40 + Math.floor(rand() * 55),
    })),
    ideas: pick(rand, IDEA_SEEDS, Math.max(3, depth)).map(([title, angle, format]) => ({
      title,
      angle,
      format,
    })),
  };
}

/** Normalise whatever the user typed into a bare handle. */
export function normaliseHandle(input: string): string {
  const trimmed = input.trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '');
  return trimmed.replace(/^@/, '').replace(/[/?#].*$/, '');
}
