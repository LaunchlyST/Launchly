/**
 * On-device screen reading for Monitor — no AI key, nothing uploaded.
 *
 * Tesseract (OCR) runs in a Web Worker in the user's own browser and reads
 * the text in the current frame. That lets the assistant answer "where is
 * the Settings button?" by finding the words on screen and pointing at them,
 * and "what's on my screen?" by reading the visible text back.
 */

export interface OcrWord {
  text: string;
  /** Pixel box in the source frame. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

export interface OcrResult {
  width: number;
  height: number;
  text: string;
  words: OcrWord[];
}

const STOP = new Set(
  'where is are the a an my me to on in of for find show point at button link tab icon menu option can you please pls plz could would i see click press open go it this that there here'.split(' ')
);

/** "where is the Settings button?" → "settings". Returns null when it's not a find/where question. */
export function extractTarget(question: string): string | null {
  const q = question.toLowerCase().replace(/[“”"'’?!.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const m =
    q.match(/^(?:where(?:'s| is| are)?|find|show me|point (?:at|to)|locate|click(?: on)?|press|open|go to)\s+(.+)$/) ||
    q.match(/^(?:can|could) you (?:find|show me|point (?:at|to)|click(?: on)?|press|open)\s+(.+)$/);
  if (!m) return null;
  const words = m[1].split(' ').filter((w) => w && !STOP.has(w));
  return words.length ? words.join(' ') : null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Find the on-screen position of `target` (one or more words). Multi-word
 * targets must appear as consecutive words. Returns the centre as fractions
 * of the frame, or null if it isn't visible.
 */
export function locate(result: OcrResult, target: string): { x: number; y: number; text: string } | null {
  const parts = target.split(' ').map(norm).filter(Boolean);
  if (!parts.length || !result.width || !result.height) return null;
  const words = result.words.filter((w) => w.confidence >= 40 && norm(w.text));

  let best: { score: number; ws: OcrWord[] } | null = null;
  for (let i = 0; i < words.length; i++) {
    let ok = true;
    let score = 0;
    const span: OcrWord[] = [];
    for (let j = 0; j < parts.length; j++) {
      const w = words[i + j];
      if (!w) {
        ok = false;
        break;
      }
      const t = norm(w.text);
      if (t === parts[j]) score += 3;
      else if (parts[j].length >= 3 && (t.startsWith(parts[j]) || (t.length >= 4 && parts[j].startsWith(t)))) score += 1;
      else {
        ok = false;
        break;
      }
      span.push(w);
    }
    if (ok && (!best || score > best.score)) best = { score, ws: span };
  }
  if (!best) return null;
  const x0 = Math.min(...best.ws.map((w) => w.x0));
  const x1 = Math.max(...best.ws.map((w) => w.x1));
  const y0 = Math.min(...best.ws.map((w) => w.y0));
  const y1 = Math.max(...best.ws.map((w) => w.y1));
  return { x: (x0 + x1) / 2 / result.width, y: (y0 + y1) / 2 / result.height, text: best.ws.map((w) => w.text).join(' ') };
}

/** Rough area name for a point, e.g. "top right". */
export function describeArea(x: number, y: number): string {
  const v = y < 0.33 ? 'top' : y > 0.66 ? 'bottom' : 'middle';
  const h = x < 0.33 ? 'left' : x > 0.66 ? 'right' : 'centre';
  return v === 'middle' && h === 'centre' ? 'centre' : `${v} ${h}`;
}

/** Clean OCR text into something readable to send back in chat. */
export function summariseText(text: string, max = 420): string {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 3 && /[\p{L}]{2}/u.test(l));
  const out = lines.join(' · ');
  return out.length > max ? out.slice(0, max).replace(/\s\S*$/, '') + '…' : out;
}

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) => createWorker('eng')).catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Read the text in a canvas frame. Runs locally in a Web Worker. */
export async function readScreen(canvas: HTMLCanvasElement): Promise<OcrResult> {
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const words: OcrWord[] = [];
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs ?? [])
      for (const l of p.lines ?? [])
        for (const w of l.words ?? [])
          words.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, confidence: w.confidence });
  return { width: canvas.width, height: canvas.height, text: data.text ?? '', words };
}
