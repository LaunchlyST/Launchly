import React, { useEffect, useRef } from 'react';
import './workflow-soon.css';

/**
 * Automation → Workflow: not built yet. A black arcade screen with a
 * self-playing Pong match behind a "Coming soon" message.
 */
export function WorkflowSoon({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let W = 0;
    let H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const pad = { w: 8, h: 0 };
    const ball = { x: 0, y: 0, vx: 0, vy: 0, s: 10 };
    const left = { y: 0 };
    const right = { y: 0 };
    const reset = (dir = 1) => {
      pad.h = Math.max(46, H * 0.2);
      ball.x = W / 2;
      ball.y = H * (0.3 + Math.random() * 0.4);
      const speed = Math.max(3.2, W / 260);
      ball.vx = speed * dir;
      ball.vy = speed * (Math.random() * 1.2 - 0.6);
      left.y = right.y = H / 2 - pad.h / 2;
    };
    reset();

    let raf = 0;
    const margin = 22;
    const step = () => {
      pad.h = Math.max(46, H * 0.2);
      ball.x += ball.vx;
      ball.y += ball.vy;
      if (ball.y < 0 || ball.y + ball.s > H) {
        ball.vy *= -1;
        ball.y = Math.max(0, Math.min(H - ball.s, ball.y));
      }
      // Both paddles track the ball, a little lazily, so rallies look human.
      const track = (p: { y: number }, active: boolean) => {
        const target = (active ? ball.y : H / 2) - pad.h / 2;
        p.y += (target - p.y) * (active ? 0.085 : 0.03);
        p.y = Math.max(0, Math.min(H - pad.h, p.y));
      };
      track(left, ball.vx < 0);
      track(right, ball.vx > 0);
      const hit = (px: number, p: { y: number }) =>
        ball.x < px + pad.w && ball.x + ball.s > px && ball.y + ball.s > p.y && ball.y < p.y + pad.h;
      if (ball.vx < 0 && hit(margin, left)) {
        ball.vx *= -1;
        ball.vy += ((ball.y + ball.s / 2 - (left.y + pad.h / 2)) / pad.h) * 3;
        ball.x = margin + pad.w;
      }
      if (ball.vx > 0 && hit(W - margin - pad.w, right)) {
        ball.vx *= -1;
        ball.vy += ((ball.y + ball.s / 2 - (right.y + pad.h / 2)) / pad.h) * 3;
        ball.x = W - margin - pad.w - ball.s;
      }
      ball.vy = Math.max(-6, Math.min(6, ball.vy));
      if (ball.x < -40 || ball.x > W + 40) reset(ball.x < 0 ? 1 : -1);

      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.setLineDash([6, 7]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f5f7fa';
      ctx.fillRect(margin, left.y, pad.w, pad.h);
      ctx.fillRect(W - margin - pad.w, right.y, pad.w, pad.h);
      ctx.fillStyle = '#3b82f6';
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 12;
      ctx.fillRect(ball.x, ball.y, ball.s, ball.s);
      ctx.shadowBlur = 0;
      if (!reduce) raf = requestAnimationFrame(step);
    };
    step();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="wf">
      <header className="wf-head">
        <h1>Workflow</h1>
        <span className="wf-pill">Coming soon</span>
      </header>
      <section className="wf-arcade" aria-label="Workflow is coming soon">
        <div className="wf-arcade__court">
          <canvas ref={canvasRef} className="wf-arcade__game" aria-hidden="true" />
          <div className="wf-arcade__copy">
            <p className="wf-arcade__big">SOON</p>
            <p className="wf-arcade__text">
              Workflows are on the way.
              <br />
              Automate your research, step by step.
            </p>
            <button type="button" className="wf-arcade__btn" onClick={onBack}>
              Back to Monitor
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
