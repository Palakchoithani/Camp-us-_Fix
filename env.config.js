/**
 * CAMP(US)FIX — Runtime Environment Configuration
 * Dynamically resolves the backend API origin and Google OAuth redirect URI.
 * Works correctly on Render, Firebase Hosting, localhost, and VS Code Live Server.
 */
(function () {
  const isStaticHost = (
    window.location.hostname.includes('web.app') ||
    window.location.hostname.includes('firebaseapp.com') ||
    (window.location.hostname === 'localhost' && window.location.port !== '8000' && window.location.port !== '') ||
    (window.location.hostname === '127.0.0.1' && window.location.port !== '8000' && window.location.port !== '') ||
    window.location.protocol === 'file:'
  );

  const apiBase = isStaticHost ? 'https://camp-us-fix.onrender.com' : '';

  window.__CAMPUS_ENV__ = window.__CAMPUS_ENV__ || {};
  window.__CAMPUS_ENV__.GOOGLE_CLIENT_ID = window.__CAMPUS_ENV__.GOOGLE_CLIENT_ID || "341687061911-k4um60gt7pu01qdg4jj9ipge9hgj669i.apps.googleusercontent.com";
  window.__CAMPUS_ENV__.API_BASE = apiBase;
  window.__CAMPUS_ENV__.GOOGLE_REDIRECT_URI = (apiBase || window.location.origin) + "/api/auth/google/callback";
})();
