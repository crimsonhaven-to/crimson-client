import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import { summonLumiConsole } from './lumiConsole';
import "./index.css";

// Lumi's little flex in the devtools console — a styled banner + a chatty
// `window.lumi` object for the curious. Purely cosmetic; wrapped so a console
// quirk in some exotic browser can never block the app from rendering.
try { summonLumiConsole(); } catch { /* the empress forgives */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ErrorBoundary>
);

// Register the service worker that makes the app installable ("Install app" /
// add-to-home-screen) and resilient offline. Only runs in production builds and
// over secure contexts; it never proxies the cross-origin backend API.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
