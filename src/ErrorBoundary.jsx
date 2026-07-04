import React from 'react';
import { themedAsset } from './hooks';

/*
 * Top-level safety net. A render-time exception anywhere in the tree would
 * otherwise blank the whole page (white screen). This catches it and shows a
 * themed fallback with a recovery action instead. It does not touch any data
 * fetching or backend interaction — it only guards rendering.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep a trace in the console for debugging; no PII, no network calls.
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          padding: '2rem',
          textAlign: 'center',
          background: '#1a0005',
          color: '#ffe5ea',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <img
          src={themedAsset('lumi_nobackground')}
          alt=""
          width="140"
          height="151"
          style={{ maxWidth: '40vw', height: 'auto', opacity: 0.9 }}
        />
        <h1 style={{ fontSize: '1.5rem', color: '#ff4066', margin: 0 }}>
          A shadow fell across the corridor
        </h1>
        <p style={{ maxWidth: '34rem', opacity: 0.8, margin: 0 }}>
          Something went wrong while rendering this page. The Haven is still
          standing — try returning to the entrance.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            border: '1px solid #8f071d',
            background: '#38020c',
            color: '#ffe5ea',
            padding: '0.6rem 1.4rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Return to the Haven
        </button>
      </div>
    );
  }
}
