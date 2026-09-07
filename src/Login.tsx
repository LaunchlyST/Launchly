import React, { useState } from 'react';
import { useAuthStore } from './auth-store';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

interface LoginProps {
  onSwitchToSignUp: () => void;
}

export function Login({ onSwitchToSignUp }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const signIn = useAuthStore((s) => s.signIn);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const colors = ['#5b5ef4', '#8b5cf6', '#00d4ff', '#f59e0b', '#10b981', '#e5484d', '#ec4899'];
  const handleSplash = (e: React.MouseEvent) => {
    const el = document.createElement('div');
    el.className = 'splash';
    el.style.left = `${e.clientX}px`;
    el.style.top = `${e.clientY}px`;
    el.style.background = `radial-gradient(circle, ${colors[Math.floor(Math.random() * colors.length)]}, transparent)`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError, user, session } = await signIn(email, password);
      if (signInError) {
        const msg = signInError.message;
        if (msg.includes('Email not confirmed') || msg.includes('email not confirmed')) {
          setError('Please confirm your email before logging in. Check your inbox for the confirmation link.');
        } else {
          setError('Incorrect email or password.');
        }
        return;
      }

      if (session && user) {
        try {
          const res = await fetch(`${WORKER_URL}/api/subscription?userId=${user.id}`);
          const data = await res.json();
          if (data.subscription_status === 'active') {
            window.location.href = '/dashboard';
          } else {
            window.location.href = '/pricing';
          }
        } catch {
          window.location.href = '/pricing';
        }
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" onClick={handleSplash}>
      <div className="stars" />
      <div className="auth-container">
        <form className="form" onSubmit={handleSubmit}>
          <p>
            Welcome back,
            <span>log in to continue</span>
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

          <button type="button" className="oauthButton">
            <svg className="icon" viewBox="0 0 24 24">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            Continue with Github
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

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="oauthButton" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 17 5-5-5-5" />
              <path d="m13 17 5-5-5-5" />
            </svg>
          </button>

          <p className="form-switch">
            Don't have an account?{' '}
            <button type="button" className="form-switch-link" onClick={onSwitchToSignUp}>
              Sign Up
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
