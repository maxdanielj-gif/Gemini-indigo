import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global log buffer for Mobile Debugger - persistent across reloads in sessionStorage
const savedBuffer = typeof window !== 'undefined' ? sessionStorage.getItem('indigo_log_buffer') : null;
(window as any)._logBuffer = savedBuffer ? JSON.parse(savedBuffer) : [];
(window as any)._logListener = null;
const _originalLog = console.log;
const _originalWarn = console.warn;
const _originalError = console.error;
const _originalInfo = console.info;

const bufferLog = (type: string, args: any) => {
  const item = {
    type,
    args: Array.from(args).map(a => {
      if (a instanceof Error) return a.message + '\n' + (a.stack || '');
      if (a !== null && typeof a === 'object') {
        try { return JSON.parse(JSON.stringify(a)); } catch(e) { return String(a); }
      }
      return a;
    }),
    timestamp: new Date().toLocaleTimeString()
  };
  (window as any)._logBuffer.push(item);
  if ((window as any)._logListener) (window as any)._logListener(item);
  
  // Keep buffer reasonable
  if ((window as any)._logBuffer.length > 1000) (window as any)._logBuffer.shift();
};

// Save logs before reload/close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('indigo_log_buffer', JSON.stringify((window as any)._logBuffer));
  });
}

console.log("App starting at " + new Date().toISOString());

console.log = (...args) => { bufferLog('log', args); _originalLog.apply(console, args); };
const _originalClear = localStorage.clear;
localStorage.clear = () => {
  console.warn("localStorage.clear() called!");
  console.trace("localStorage.clear trace");
  _originalClear.apply(localStorage);
};
console.warn = (...args) => { bufferLog('warn', args); _originalWarn.apply(console, args); };
console.error = (...args) => { bufferLog('error', args); _originalError.apply(console, args); };
console.info = (...args) => { bufferLog('log', args); _originalInfo.apply(console, args); };

// Register Service Worker (PWA caching + Web Push notifications)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .then((registration) => {
        console.log('Service Worker registered, scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Keep dark mode in sync with the system preference in real time.
// The initial setting is applied synchronously in index.html before first
// paint; this listener handles changes that happen while the app is open
// (e.g. user switches their phone from light to dark mode).
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
systemDarkQuery.addEventListener('change', (e) => {
  // Only follow the system if the user hasn't explicitly chosen a theme
  if (!localStorage.getItem('theme')) {
    document.documentElement.classList.toggle('dark', e.matches);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
