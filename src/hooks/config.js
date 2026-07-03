// Deployment-baked configuration. All values are read from Vite env at BUILD time
// (VITE_*), so set them as build args / env vars in the deploy pipeline — not at
// container runtime. Lifted verbatim out of the old monolithic hooks.js.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend.crimsonhaven.to';
//export const API_BASE_URL = 'http://localhost:8000'; // For local development against a locally running backend
export const CLIENT_VERSION = '11.7.2';

// Deployment-specific copy that used to be hardcoded (from when the repo was
// private). Baked in at BUILD time like VITE_API_BASE_URL, so set these as build
// args / env vars in the deploy pipeline — not at container runtime.
//   VITE_HOSTED_IN  — where user data lives, e.g. "Switzerland" or "🇨🇭 Switzerland".
//   VITE_DMCA_MAIL  — contact address for takedown / DMCA requests.
export const HOSTED_IN = import.meta.env.VITE_HOSTED_IN || 'Secret:3';
export const DMCA_MAIL = import.meta.env.VITE_DMCA_MAIL || 'NoEmailProvided';
