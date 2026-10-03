// Values come from Vite env at BUILD time, so set them in the deploy pipeline,
// not at container runtime.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend.crimsonhaven.to';
//export const API_BASE_URL = 'http://localhost:8000'; // For local development against a locally running backend
export const CLIENT_VERSION = '13.6.0';

//   VITE_HOSTED_IN: where user data lives, e.g. "Switzerland" or "🇨🇭 Switzerland".
//   VITE_DMCA_MAIL: contact address for takedown / DMCA requests.
export const HOSTED_IN = import.meta.env.VITE_HOSTED_IN || 'Secret:3';
export const DMCA_MAIL = import.meta.env.VITE_DMCA_MAIL || 'NoEmailProvided';
