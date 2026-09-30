import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './shell/ErrorBoundary';
import { summonLumiConsole } from './lumi/console';
import { applyThemeToDom, getTheme } from './account/theme';
import "./index.css";

// index.html already set `data-theme` to avoid a flash; this also updates the
// mobile theme-color meta.
applyThemeToDom(getTheme());

// Purely cosmetic, so a console quirk in an exotic browser must never block rendering.
try { summonLumiConsole(); } catch { /* the empress forgives */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ErrorBoundary>
);

// The service worker makes the app installable and never proxies the cross-origin backend API.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
