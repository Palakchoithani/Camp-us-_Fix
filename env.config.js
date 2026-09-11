/**
 * CAMP(US)FIX — Runtime Environment Configuration
 * Dynamically resolves the Google OAuth redirect URI from the current window origin.
 * Works correctly in development (localhost) AND in production (any deployed domain).
 * Override at deploy time via server-injected <script> before this file loads if needed.
 */
window.__CAMPUS_ENV__ = window.__CAMPUS_ENV__ || {
  GOOGLE_CLIENT_ID: "341687061911-k4um60gt7pu01qdg4jj9ipge9hgj669i.apps.googleusercontent.com",
  // Dynamically resolved — never hardcoded. Works on localhost AND production domains.
  GOOGLE_REDIRECT_URI: window.location.origin + "/api/auth/google/callback"
};
