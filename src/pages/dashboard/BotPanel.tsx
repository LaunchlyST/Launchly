import React, { useState } from 'react';
import { Bot, Check, Copy, KeyRound, LoaderCircle, MessageSquare, Sparkles } from 'lucide-react';
import { useStore } from '../../store';

export type BotName = 'Hook bot' | 'Caption bot' | 'Creative bot';

const BOTS: Record<BotName, { icon: typeof Bot; intro: string; system: string; button: string }> = {
  'Hook bot': {
    icon: Bot,
    intro: 'Scroll-stopping opening lines for your next TikTok Shop video.',
    button: 'Write hooks',
    system:
      'You write TikTok Shop video hooks. Return 8 short hooks (max 12 words each) as a numbered list. ' +
      'Each hook must be spoken in the first 2 seconds. Vary the angle: curiosity, problem, result, social proof, comparison. ' +
      'Never invent statistics, reviews, prices or claims about the product.',
  },
  'Caption bot': {
    icon: MessageSquare,
    intro: 'Captions and hashtags that fit the video and the product.',
    button: 'Write captions',
    system:
      'You write TikTok captions for affiliate product videos. Return 5 captions as a numbered list, each under 150 characters, ' +
      'each followed by 3–5 relevant hashtags on the same line. Never invent discounts, prices, statistics or claims.',
  },
  'Creative bot': {
    icon: Sparkles,
    intro: 'Video concepts and shot lists you can film today.',
    button: 'Generate ideas',
    system:
      'You are a TikTok Shop creative strategist. Return 4 video concepts. For each: a title, the hook, a 4–6 step shot list, ' +
      'and the call to action. Keep it filmable on a phone. Never invent statistics, reviews or claims about the product.',
  },
};

async function runBot(apiKey: string, system: string, user: string, signal: AbortSignal): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response from OpenAI.');
  return text.trim();
}

export function BotPanel({ bot, onSettings }: { bot: BotName; onSettings: () => void }) {
  const openaiKey = useStore((s) => s.openaiKey);
  const spec = BOTS[bot];
  const Icon = spec.icon;
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Casual');
  const [market, setMarket] = useState('UK');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product.trim()) return;
    setBusy(true);
    setError('');
    setOutput('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const prompt =
        `Product: ${product.trim()}\n` +
        (audience.trim() ? `Audience: ${audience.trim()}\n` : '') +
        `Tone: ${tone}\nMarket: TikTok Shop ${market}. Use ${market === 'UK' ? 'British' : 'American'} English.`;
      setOutput(await runBot(openaiKey, spec.system, prompt, controller.signal));
    } catch (err) {
      setError(controller.signal.aborted ? 'The request timed out. Please try again.' : err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="research-page-heading">
        <div>
          <span className="eyebrow">Bots</span>
          <h1>{bot}</h1>
          <p>{spec.intro}</p>
        </div>
      </div>
      <section className="research-panel bot-panel">
        {!openaiKey ? (
          <div className="research-empty">
            <span>
              <KeyRound size={25} strokeWidth={1.5} />
            </span>
            <h3>Add your OpenAI key to use {bot}</h3>
            <p>Bots run on your own ChatGPT key. It stays in this browser.</p>
            <button className="research-primary" onClick={onSettings}>
              Open Settings
            </button>
          </div>
        ) : (
          <form className="bot-form" onSubmit={submit}>
            <label>
              <span>Product</span>
              <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="e.g. Heatless curling ribbon" maxLength={200} required />
            </label>
            <label>
              <span>Audience (optional)</span>
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. busy mums, students" maxLength={120} />
            </label>
            <div className="bot-form__row">
              <label>
                <span>Tone</span>
                <select value={tone} onChange={(e) => setTone(e.target.value)}>
                  {['Casual', 'Funny', 'Luxury', 'Urgent', 'Honest review'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Market</span>
                <select value={market} onChange={(e) => setMarket(e.target.value)}>
                  <option value="UK">UK</option>
                  <option value="USA">USA</option>
                </select>
              </label>
            </div>
            <button className="research-primary" disabled={busy || !product.trim()}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Icon size={16} />} {busy ? 'Writing…' : spec.button}
            </button>
          </form>
        )}
        {error && (
          <div className="research-notice" role="alert">
            {error}
          </div>
        )}
        {output && (
          <div className="bot-output">
            <div className="bot-output__head">
              <strong>Result</strong>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(output);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* clipboard blocked */
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre>{output}</pre>
          </div>
        )}
      </section>
    </>
  );
}
