import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { useEffect, useState } from 'react';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import Setup from './setup/Setup';
import { needsSetup } from './local-backend';
import './index.css';

// Extension entry point. Differs from the web main.jsx in three ways:
//  * HashRouter (chrome-extension:// pages can't use history/path routing),
//  * no PWA service-worker registration (the extension has its own worker),
//  * a first-run gate: until the user provides their own TMDB token the app
//    shows the setup screen instead of the (data-less) UI.
function Root() {
  const [phase, setPhase] = useState('loading'); // loading | setup | ready

  useEffect(() => {
    needsSetup().then((need) => setPhase(need ? 'setup' : 'ready'));
  }, []);

  if (phase === 'loading') return null;
  if (phase === 'setup') return <Setup onDone={() => setPhase('ready')} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <HashRouter>
      <Root />
    </HashRouter>
  </ErrorBoundary>
);
