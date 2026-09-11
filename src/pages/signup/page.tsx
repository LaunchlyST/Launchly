import React, { memo, useEffect, useRef, useState } from 'react';
import { useAuthStore } from 'src/auth-store';
import { supabase } from 'src/lib/supabase';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';
const OCEAN_ACTIVE_MS = 3000;

interface SignUpProps {
  onSwitchToLogin: () => void;
}

const OceanScene = memo(function OceanScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let running = true;

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const particles = Array.from({ length: reduceMotion ? 55 : 150 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: rand(0.35, 1.8),
      speed: rand(0.008, 0.04),
      drift: rand(-0.012, 0.012),
      alpha: rand(0.12, 0.55),
    }));
    const bubbles = Array.from({ length: reduceMotion ? 10 : 34 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: rand(1.2, 5.2),
      speed: rand(0.018, 0.07),
      wobble: rand(0.4, 1.3),
      alpha: rand(0.1, 0.42),
    }));
    const fish = Array.from({ length: reduceMotion ? 5 : 14 }, (_, index) => ({
      x: Math.random(),
      y: rand(0.16, 0.72),
      size: rand(10, 34),
      speed: rand(0.006, 0.026) * (index % 2 ? -1 : 1),
      depth: rand(0.25, 1),
      hue: rand(185, 216),
      phase: rand(0, Math.PI * 2),
    }));
    const weeds = Array.from({ length: 30 }, (_, index) => ({
      x: index / 29 + rand(-0.018, 0.018),
      h: rand(54, 188),
      w: rand(3, 9),
      phase: rand(0, Math.PI * 2),
      depth: rand(0.35, 1),
    }));

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFish = (time: number) => {
      fish.forEach((f) => {
        if (!reduceMotion) {
          f.x += f.speed;
          if (f.speed > 0 && f.x > 1.12) f.x = -0.12;
          if (f.speed < 0 && f.x < -0.12) f.x = 1.12;
        }

        const x = f.x * width;
        const y = f.y * height + Math.sin(time * 0.0012 + f.phase) * 9 * f.depth;
        const s = f.size * f.depth;
        const dir = f.speed >= 0 ? 1 : -1;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir, 1);
        ctx.globalAlpha = 0.11 + f.depth * 0.16;
        ctx.filter = f.depth < 0.55 ? 'blur(1.8px)' : 'blur(0.4px)';
        const body = ctx.createRadialGradient(-s * 0.15, -s * 0.08, 1, 0, 0, s);
        body.addColorStop(0, `hsla(${f.hue}, 42%, 78%, 0.72)`);
        body.addColorStop(1, `hsla(${f.hue}, 48%, 30%, 0.35)`);
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.95, s * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-s * 0.82, 0);
        ctx.lineTo(-s * 1.28, -s * 0.24);
        ctx.lineTo(-s * 1.18, s * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    };

    const draw = (time = 0) => {
      ctx.clearRect(0, 0, width, height);

      const water = ctx.createLinearGradient(0, 0, 0, height);
      water.addColorStop(0, 'rgba(20, 95, 134, 0.14)');
      water.addColorStop(0.24, 'rgba(7, 59, 92, 0.2)');
      water.addColorStop(0.58, 'rgba(3, 39, 61, 0.24)');
      water.addColorStop(1, 'rgba(1, 11, 19, 0.36)');
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, width, height);

      const haze = ctx.createRadialGradient(width * 0.48, height * 0.08, 0, width * 0.5, height * 0.38, height * 0.95);
      haze.addColorStop(0, 'rgba(112, 220, 255, 0.2)');
      haze.addColorStop(0.45, 'rgba(18, 98, 137, 0.15)');
      haze.addColorStop(1, 'rgba(0, 8, 15, 0.46)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 10; i += 1) {
        const x = width * (0.06 + i * 0.105) + Math.sin(time * 0.00035 + i) * 28;
        const rayWidth = width * (0.04 + (i % 3) * 0.018);
        const ray = ctx.createLinearGradient(x, 0, x + rayWidth * 2, height * 0.82);
        ray.addColorStop(0, 'rgba(180, 236, 255, 0.16)');
        ray.addColorStop(0.48, 'rgba(104, 207, 240, 0.045)');
        ray.addColorStop(1, 'rgba(8, 30, 48, 0)');
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = ray;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + rayWidth, 0);
        ctx.lineTo(x + rayWidth * 4.5, height);
        ctx.lineTo(x - rayWidth * 2.2, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      particles.forEach((p) => {
        const drift = reduceMotion ? 0 : time * 0.00002;
        const x = ((p.x + p.drift * drift + 1) % 1) * width;
        const y = ((p.y + p.speed * drift + 1) % 1) * height;
        ctx.fillStyle = `rgba(205, 244, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      bubbles.forEach((b) => {
        const t = reduceMotion ? 0 : time * 0.00004 * b.speed;
        const y = ((b.y - t + 1) % 1) * height;
        const x = (b.x + Math.sin(time * 0.001 * b.wobble + b.y * 8) * 0.012) * width;
        ctx.strokeStyle = `rgba(203, 244, 255, ${b.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      });

      drawFish(time);

      const floorY = height * 0.84;
      const sand = ctx.createLinearGradient(0, floorY, 0, height);
      sand.addColorStop(0, 'rgba(24, 48, 45, 0)');
      sand.addColorStop(0.18, 'rgba(13, 34, 30, 0.42)');
      sand.addColorStop(1, 'rgba(5, 8, 7, 0.62)');
      ctx.fillStyle = sand;
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      for (let x = 0; x <= width; x += 36) {
        ctx.lineTo(x, floorY + Math.sin(x * 0.012 + time * 0.00012) * 10 + Math.sin(x * 0.027) * 7);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(5, 8, 7, 0.55)';
      for (let i = 0; i < 18; i += 1) {
        const x = (i * 151) % width;
        const y = floorY + 36 + ((i * 29) % Math.max(80, height * 0.12));
        ctx.beginPath();
        ctx.ellipse(x, y, 28 + (i % 5) * 9, 9 + (i % 4) * 4, i * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      weeds.forEach((w) => {
        const baseX = w.x * width;
        const baseY = height - 4;
        const sway = reduceMotion ? Math.sin(w.phase) * 4 : Math.sin(time * 0.001 + w.phase) * (9 + w.depth * 8);
        ctx.strokeStyle = `rgba(${18 + w.depth * 15}, ${82 + w.depth * 70}, ${67 + w.depth * 45}, ${0.32 + w.depth * 0.28})`;
        ctx.lineWidth = w.w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.bezierCurveTo(baseX + sway * 0.3, baseY - w.h * 0.35, baseX + sway, baseY - w.h * 0.72, baseX + sway * 0.55, baseY - w.h);
        ctx.stroke();
      });

      if (!reduceMotion) frame = window.requestAnimationFrame(draw);
    };

    const visibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running && !reduceMotion) {
        running = true;
        frame = requestAnimationFrame(draw);
      }
    };

    resize();
    draw(0);
    if (!reduceMotion) frame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  return (
    <div className="ocean-world" aria-hidden="true">
      <canvas ref={canvasRef} className="ocean-canvas" />
      <div className="ocean-surface" />
      <div className="ocean-caustics" />
      <div className="ocean-refraction" />
      <div className="ocean-vignette" />
    </div>
  );
});

export function SignUp({ onSwitchToLogin }: SignUpProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [underOcean, setUnderOcean] = useState(false);
  const clickTimes = useRef<number[]>([]);
  const oceanTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const signUp = useAuthStore((s) => s.signUp);

  const pendingEmail = typeof window !== 'undefined' ? sessionStorage.getItem('pendingSignUpEmail') : '';

  useEffect(() => {
    if (pendingEmail) {
      setEmail(pendingEmail);
      sessionStorage.removeItem('pendingSignUpEmail');
    }
  }, []);

  const isReturningUser = !!pendingEmail;

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const clearOceanTimer = () => {
    if (oceanTimer.current) {
      window.clearTimeout(oceanTimer.current);
      oceanTimer.current = null;
    }
  };

  const activateOcean = () => {
    clearOceanTimer();
    setUnderOcean(true);
    oceanTimer.current = window.setTimeout(() => {
      setUnderOcean(false);
      oceanTimer.current = null;
    }, OCEAN_ACTIVE_MS);
  };

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.auth-container')) return;

    const colors = ['#5b5ef4', '#8b5cf6', '#00d4ff', '#f59e0b', '#10b981', '#e5484d', '#ec4899', '#a855f7', '#06b6d4'];
    const sparkles = ['*', '+', 'x', '.', '*', '+', '.'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const color2 = colors[Math.floor(Math.random() * colors.length)];
    const x = e.clientX;
    const y = e.clientY;

    const flash = document.createElement('div');
    flash.className = 'splash-flash';
    flash.style.background = `radial-gradient(circle at ${x}px ${y}px, ${color}40, transparent 60%)`;
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    const glow = document.createElement('div');
    glow.className = 'splash-glow';
    glow.style.left = `${x}px`;
    glow.style.top = `${y}px`;
    glow.style.background = `radial-gradient(circle, ${color}, ${color2}, transparent)`;
    glow.style.boxShadow = `0 0 60px 20px ${color}80, 0 0 120px 40px ${color2}40`;
    document.body.appendChild(glow);
    glow.addEventListener('animationend', () => glow.remove());

    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div');
      ring.className = 'splash-ring';
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      ring.style.borderColor = i % 2 === 0 ? color : color2;
      ring.style.animationDelay = `${i * 0.08}s`;
      document.body.appendChild(ring);
      ring.addEventListener('animationend', () => ring.remove());
    }

    for (let i = 0; i < 16; i++) {
      const particle = document.createElement('div');
      particle.className = 'splash-particle';
      const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 80 + Math.random() * 140;
      const size = 3 + Math.random() * 5;
      const c = Math.random() > 0.5 ? color : color2;
      const dur = 0.4 + Math.random() * 0.4;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.background = c;
      particle.style.boxShadow = `0 0 ${size * 2}px ${c}`;
      particle.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
      particle.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
      particle.style.setProperty('--dur', `${dur}s`);
      document.body.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove());
    }

    for (let i = 0; i < 8; i++) {
      const trail = document.createElement('div');
      trail.className = 'splash-trail';
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 40 + Math.random() * 60;
      trail.style.left = `${x}px`;
      trail.style.top = `${y}px`;
      trail.style.background = color;
      trail.style.boxShadow = `0 0 4px ${color}`;
      trail.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      trail.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      document.body.appendChild(trail);
      trail.addEventListener('animationend', () => trail.remove());
    }

    for (let i = 0; i < 5; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'splash-sparkle';
      sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
      const sx = -40 + Math.random() * 80;
      const sy = -60 - Math.random() * 40;
      sparkle.style.left = `${x - 8}px`;
      sparkle.style.top = `${y - 8}px`;
      sparkle.style.color = Math.random() > 0.5 ? color : color2;
      sparkle.style.textShadow = `0 0 8px ${color}`;
      sparkle.style.setProperty('--sx', `${sx}px`);
      sparkle.style.setProperty('--sy', `${sy}px`);
      sparkle.style.animationDelay = `${i * 0.05}s`;
      document.body.appendChild(sparkle);
      sparkle.addEventListener('animationend', () => sparkle.remove());
    }

    const now = performance.now();
    clickTimes.current = [...clickTimes.current.filter((ts) => now - ts < 1200), now];
    if (clickTimes.current.length >= 3) {
      clickTimes.current = [];
      activateOcean();
    }
  };

  useEffect(() => () => clearOceanTimer(), []);

  const handleGitHub = async () => {
    setError('');
    setSuccess('');
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin + '/' },
      });
      if (error) {
        setError(error.message || 'GitHub sign-in failed. Please try again.');
        setOauthLoading(false);
      }
    } catch {
      setError('An unexpected error occurred with GitHub sign-in.');
      setOauthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: signUpError, session } = await signUp(email, password);
      if (signUpError) {
        const msg = signUpError.message;
        if (msg.includes('Email rate limit exceeded') || msg.includes('rate limit')) {
          setError('Too many attempts. Please wait a few minutes and try again.');
        } else if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('User already')) {
          setError('An account with this email already exists. Please log in.');
        } else {
          setError('We couldn\'t create your account. Please try again.');
        }
      } else if (session && session.user) {
        try {
          const res = await fetch(`${WORKER_URL}/api/subscription?userId=${session.user.id}`);
          const data = await res.json();
          if (data.subscription_status === 'active') {
            window.location.href = '/dashboard';
          } else {
            window.location.href = '/paywall';
          }
        } catch {
          window.location.href = '/paywall';
        }
      } else {
        setSuccess('Check your email to confirm your account.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`auth-page auth-page--signup${underOcean ? ' is-under-ocean' : ''}`}
      onClick={handleBackgroundClick}
    >
      <div className="stars" />
      <OceanScene />
      <div className="auth-container" onClick={(e) => e.stopPropagation()}>
        <form className="form" onSubmit={handleSubmit}>
          <p>
            {isReturningUser ? 'Welcome back,' : 'Welcome,'}
            <span>
              {isReturningUser ? ` ${email}, create your account` : ' create your account'}
            </span>
          </p>

          <button type="button" className="oauthButton">
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <button type="button" className="oauthButton" onClick={handleGitHub} disabled={oauthLoading}>
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            {oauthLoading ? 'Connecting to GitHub...' : 'Continue with Github'}
          </button>

          <div className="separator">
            <div />
            <span>OR</span>
            <div />
          </div>

          <input
            type="email"
            placeholder="Email"
            name="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            required
          />

          <input
            type="password"
            placeholder="Password"
            name="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            required
            minLength={6}
          />

          <input
            type="password"
            placeholder="Confirm Password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
            required
          />

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button type="submit" className="oauthButton" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 17 5-5-5-5" />
              <path d="m13 17 5-5-5-5" />
            </svg>
          </button>

          <p className="form-switch">
            Already have an account?{' '}
            <button type="button" className="form-switch-link" onClick={onSwitchToLogin}>
              Log In
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
