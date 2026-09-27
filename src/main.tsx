import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppErrorBoundary } from './AppErrorBoundary';
import './App.css';
import { initAuth } from './auth';

// After a new deploy, a tab still running the previous build can ask for
// script files that no longer exist, which leaves a blank page. Reload once
// to pick up the new build instead.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    if (sessionStorage.getItem('launchly.reloadedForUpdate')) return;
    sessionStorage.setItem('launchly.reloadedForUpdate', '1');
  } catch {
    /* storage blocked — still reload */
  }
  window.location.reload();
});
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      sessionStorage.removeItem('launchly.reloadedForUpdate');
    } catch {
      /* ignore */
    }
  }, 10000);
});

initAuth();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
