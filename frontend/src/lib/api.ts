/**
 * Central API configuration.
 * Set NEXT_PUBLIC_API_URL in your environment to point to the backend.
 * Defaults to the deployed Render API so production builds never fall back
 * to a browser-local backend. Set NEXT_PUBLIC_API_URL to localhost:8000 for
 * local development.
 */
const DEPLOYED_API_URL = "https://upanalysis.onrender.com";
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const isLocalApiUrl = configuredApiUrl?.includes("localhost:8000") || configuredApiUrl?.includes("127.0.0.1:8000");

// A localhost value is useful locally but can never work from a deployed browser.
// Fall back to Render if an old/misconfigured Vercel environment variable leaks
// into a production build.
export const API_BASE_URL =
  process.env.NODE_ENV === "production" && isLocalApiUrl
    ? DEPLOYED_API_URL
    : configuredApiUrl || DEPLOYED_API_URL;

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
