/**
 * CAMP(US) FIX — Firebase Cloud Configuration
 * 
 * 1. Go to https://console.firebase.google.com/ (100% Free, NO credit card needed).
 * 2. Click "Add project" (Name it: campus-fix).
 * 3. Go to "Project Settings" (gear icon) > Scroll down to "Your apps" > Click the Web icon (</>).
 * 4. Register app and copy the `firebaseConfig` keys below.
 * 5. In Firebase console, click "Build" > "Realtime Database" > "Create Database" > Start in "test mode".
 */
window.__FIREBASE_CONFIG__ = window.__FIREBASE_CONFIG__ || {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
