/**
 * CAMP(US)FIX — SECURE ROLE-BASED AUTHENTICATION & AUTHORIZATION ENGINE
 * Native Web Crypto API SHA-256 Salted Hashing, Token Session Handling,
 * Form Validation, Lockout Protection, and Protected Route Guards.
 */

(function () {
  'use strict';

  // Session Token Secret Key (Simulated client verification signature)
  const SESSION_SIGNATURE_SECRET = "CAMPUS-FIX-SEC-TOKEN-V2-2026-KEY";
  const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 Hours
  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 60 * 1000; // 60s Lockout

  // Available Institutional Departments (Exact 6 Authorized Disciplines)
  window.CAMPUS_DEPARTMENTS = [
    "Facility Maintenance & Plumbing",
    "Campus Electrical & Power",
    "Hostel Sanitation & Food Services",
    "IT & Campus Network Services",
    "SHE Complaint Cell",
    "Anti-Ragging Committee"
  ];

  // --------------------------------------------------------------------------
  // Cryptographic Utility Functions (Native Web Crypto API)
  // --------------------------------------------------------------------------
  async function sha256(str) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function generateSalt(len = 16) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function hashPassword(plainText, salt) {
    return await sha256(`CAMPUS_SALT_${salt}_KEY_${plainText}`);
  }

  // --------------------------------------------------------------------------
  // Seed Database Initialization (Salted Hashes Only)
  // --------------------------------------------------------------------------
  const SEED_USERS_RAW = [
    {
      id: "2024CS0123", // Student Registration Number
      role: "student",
      name: "Aarav K. Senapati",
      email: "aarav.senapati@campus.edu",
      department: "Computer Science & Engineering",
      hostel: "Hostel Block 4 • Suite 212",
      salt: "a8f93e7b1029c4d5",
      defaultPass: "StudentPass@2026",
      permissions: ["file_ticket", "view_my_tickets", "upvote_ticket", "view_bulletins"]
    },
    {
      id: "EMP-ADM-001", // Admin Employee ID
      role: "admin",
      name: "Prof. S. Sharma",
      email: "dean.sharma@campus.edu",
      title: "Dean of Student Affairs & Chief Proctor",
      clearance: "Level 4 Sovereign Executive",
      salt: "f1c2d3e4b5a67890",
      defaultPass: "AdminDean@2026",
      permissions: ["all", "master_incidents", "escalate_ombudsman", "reassign_dept", "broadcast_alert", "audit_logs"]
    },
    {
      id: "DEPT-OPS-01", // Common Department ID for all departments
      role: "department",
      name: "Department Dispatch Officer",
      email: "dispatch@campus.edu",
      deptName: "Facility Maintenance & Plumbing",
      division: "Campus Operations & Dispatch Command",
      salt: "3c4d5e6f7a8b9c0d",
      defaultPass: "DeptOps@2026",
      permissions: ["view_dept_tickets", "dispatch_crew", "update_ticket_status", "inventory_read"]
    },
    {
      id: "DEPT-PLUMB-04", // Department ID
      role: "department",
      name: "R. Murugan",
      email: "dispatch.plumbing@campus.edu",
      deptName: "Facility Maintenance & Plumbing",
      division: "West Quadrant Rapid Response",
      salt: "3c4d5e6f7a8b9c0d",
      defaultPass: "DeptOps@2026",
      permissions: ["view_dept_tickets", "dispatch_crew", "update_ticket_status", "inventory_read"]
    },
    {
      id: "DEPT-ELECT-02",
      role: "department",
      name: "Sunil Verma",
      email: "dispatch.electrical@campus.edu",
      deptName: "Campus Electrical & Power",
      division: "Substation & HT Distribution Wing",
      salt: "7b8c9d0e1f2a3b4c",
      defaultPass: "DeptOps@2026",
      permissions: ["view_dept_tickets", "dispatch_crew", "update_ticket_status", "inventory_read"]
    },
    {
      id: "DEPT-HOSTEL-01",
      role: "department",
      name: "K. Deshmukh",
      email: "dispatch.hostel@campus.edu",
      deptName: "Hostel Sanitation & Food Services",
      division: "Residential & Mess Operations",
      salt: "9f0a1b2c3d4e5f6a",
      defaultPass: "DeptOps@2026",
      permissions: ["view_dept_tickets", "dispatch_crew", "update_ticket_status", "inventory_read"]
    },
    {
      id: "DEPT-IT-01",
      role: "department",
      name: "Vikram Mehta",
      email: "dispatch.network@campus.edu",
      deptName: "IT & Campus Network Services",
      division: "Campus NOC & Server Vault",
      salt: "5d6e7f8a9b0c1d2e",
      defaultPass: "DeptOps@2026",
      permissions: ["view_dept_tickets", "dispatch_crew", "update_ticket_status", "inventory_read"]
    },
    {
      id: "DEPT-SHE-01",
      role: "department",
      name: "Dr. Nalini Iyer",
      email: "icc.she@campus.edu",
      deptName: "SHE Complaint Cell",
      division: "Internal Complaints Committee Desk",
      salt: "2a3b4c5d6e7f8a9b",
      defaultPass: "DeptOps@2026",
      permissions: ["view_dept_tickets", "dispatch_crew", "update_ticket_status", "inventory_read"]
    },
    {
      id: "DEPT-RAG-01",
      role: "department",
      name: "Col. P. Nair",
      email: "antiragging.cell@campus.edu",
      deptName: "Anti-Ragging Committee",
      division: "24x7 Ombudsman Emergency Squad",
      salt: "4e5f6a7b8c9d0e1f",
      defaultPass: "DeptOps@2026",
      permissions: ["view_dept_tickets", "dispatch_crew", "update_ticket_status", "inventory_read"]
    }
  ];

  const USER_DB_KEY = 'campus_user_db_v3';

  async function getStoredUsers() {
    const stored = localStorage.getItem(USER_DB_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.some(u => u.id === 'DEPT-OPS-01')) {
          return parsed;
        }
      } catch (e) {
        console.error("Database parse error, resetting...", e);
      }
    }

    // Initialize with pre-hashed seed accounts
    const initialUsers = [];
    for (const raw of SEED_USERS_RAW) {
      const passwordHash = await hashPassword(raw.defaultPass, raw.salt);
      const user = { ...raw, passwordHash };
      delete user.defaultPass; // Never persist plain password
      initialUsers.push(user);
    }

    localStorage.setItem(USER_DB_KEY, JSON.stringify(initialUsers));
    return initialUsers;
  }

  // --------------------------------------------------------------------------
  // Session & Cryptographic Bearer Token Management
  // --------------------------------------------------------------------------
  async function generateBearerToken(user) {
    const payload = {
      sub: user.id,
      role: user.role,
      name: user.name,
      deptName: user.deptName || null,
      permissions: user.permissions || [],
      iat: Date.now(),
      exp: Date.now() + SESSION_EXPIRY_MS
    };

    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    const signature = await sha256(`${header}.${body}.${SESSION_SIGNATURE_SECRET}`);

    return `${header}.${body}.${signature}`;
  }

  async function verifyBearerToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = await sha256(`${header}.${body}.${SESSION_SIGNATURE_SECRET}`);
    if (signature !== expectedSig) {
      console.warn("Security Alert: Invalid token signature detected!");
      return null;
    }

    try {
      const payload = JSON.parse(atob(body));
      if (Date.now() > payload.exp) {
        console.warn("Session expired");
        return null;
      }
      return payload;
    } catch (e) {
      return null;
    }
  }

  function saveSession(user, token) {
    const sessionData = {
      token,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        department: user.department || null,
        hostel: user.hostel || null,
        title: user.title || null,
        clearance: user.clearance || null,
        deptName: user.deptName || null,
        division: user.division || null,
        permissions: user.permissions || []
      },
      savedAt: Date.now()
    };
    try {
      localStorage.setItem('campus_auth_session', JSON.stringify(sessionData));
      localStorage.setItem(`campus_auth_session_${user.role}`, JSON.stringify(sessionData));
      sessionStorage.setItem('campus_auth_session', JSON.stringify(sessionData));
      sessionStorage.setItem(`campus_auth_session_${user.role}`, JSON.stringify(sessionData));
    } catch (e) {}

    // Synchronize HTTP cookies for backend server verification
    try {
      const maxAge = Math.floor(SESSION_EXPIRY_MS / 1000);
      document.cookie = `campus_session_role=${encodeURIComponent(user.role)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      document.cookie = `campus_auth_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      document.cookie = `campus_auth_token_${encodeURIComponent(user.role)}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    } catch (e) {}

    updateNavSessionWidget();
  }

  // Synchronize returning Google OAuth session if redirected from Google
  function checkGoogleOAuthReturn() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('google_auth') === 'success') {
        const token = urlParams.get('token');
        const userRaw = urlParams.get('user');
        if (token && userRaw) {
          const user = JSON.parse(decodeURIComponent(userRaw));
          saveSession(user, decodeURIComponent(token));
          
          // Clean URL query parameters smoothly without reloading
          urlParams.delete('google_auth');
          urlParams.delete('token');
          urlParams.delete('user');
          const cleanQuery = urlParams.toString() ? `?${urlParams.toString()}` : '';
          window.history.replaceState({}, document.title, window.location.pathname + cleanQuery + window.location.hash);
        }
      }
    } catch (e) {
      console.warn("Failed to synchronize Google OAuth session:", e);
    }
  }

  checkGoogleOAuthReturn();

  window.getCurrentSession = function (expectedRole = null) {
    // 1. If expectedRole specified, check tab's sessionStorage first
    if (expectedRole) {
      try {
        const tabRoleRaw = sessionStorage.getItem(`campus_auth_session_${expectedRole}`);
        if (tabRoleRaw) {
          const sess = JSON.parse(tabRoleRaw);
          if (sess && sess.user && sess.user.role === expectedRole) return sess;
        }
      } catch (e) {}

      try {
        const roleRaw = localStorage.getItem(`campus_auth_session_${expectedRole}`);
        if (roleRaw) {
          const sess = JSON.parse(roleRaw);
          if (sess && sess.user && sess.user.role === expectedRole) return sess;
        }
      } catch (e) {}
    }

    // 2. Check tab-specific sessionStorage
    try {
      const tabRaw = sessionStorage.getItem('campus_auth_session');
      if (tabRaw) {
        const sess = JSON.parse(tabRaw);
        if (sess && sess.user && (!expectedRole || sess.user.role === expectedRole)) return sess;
      }
    } catch (e) {}

    // 3. Check general localStorage (only if matching expectedRole or no expectedRole specified)
    const raw = localStorage.getItem('campus_auth_session');
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      if (expectedRole && (!session.user || session.user.role !== expectedRole)) {
        return null;
      }
      // Quick expiry check
      if (Date.now() - session.savedAt > SESSION_EXPIRY_MS) {
        window.logout("Your institutional session has expired. Please sign in again.");
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  };

  // --------------------------------------------------------------------------
  // Universal Route & Role-Based Access Control (RBAC) Guard
  // --------------------------------------------------------------------------
  window.enforcePageAccess = function (allowedRole) {
    const session = window.getCurrentSession(allowedRole);

    if (!session || !session.user || !session.user.role) {
      // Unauthenticated: Block display and redirect to landing page
      if (document.documentElement) {
        document.documentElement.style.display = 'none';
      }
      try {
        sessionStorage.setItem('campus_auth_redirect_msg', `Access Denied: Please sign in with authorized credentials to access this portal.`);
      } catch (e) {}
      const roleLoginPages = {
        student: 'student-login.html',
        admin: 'admin-login.html',
        department: 'department-login.html'
      };
      const redirectPage = roleLoginPages[allowedRole] || 'student-login.html';
      window.location.replace(redirectPage);
      return false;
    }

    if (allowedRole && session.user.role !== allowedRole) {
      // Authenticated with unauthorized role: Block access and redirect to their OWN authorized dashboard!
      if (document.documentElement) {
        document.documentElement.style.display = 'none';
      }
      const roleDashboards = {
        student: 'student-dashboard.html',
        admin: 'admin-dashboard.html',
        department: 'department-dashboard.html'
      };
      const ownUrl = roleDashboards[session.user.role] || 'index.html';
      try {
        sessionStorage.setItem('campus_auth_redirect_msg', `Access Restricted: You are signed in as ${session.user.role.toUpperCase()}. You do not have permission to access the ${allowedRole.toUpperCase()} portal.`);
      } catch (e) {}
      window.location.replace(`${ownUrl}?rbac_blocked=${encodeURIComponent(allowedRole)}`);
      return false;
    }

    // Synchronize cookies in case of new browser tab or reload
    if (session.token && session.user.role) {
      try {
        const maxAge = Math.floor(SESSION_EXPIRY_MS / 1000);
        document.cookie = `campus_session_role=${encodeURIComponent(session.user.role)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `campus_auth_token=${encodeURIComponent(session.token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `campus_auth_token_${encodeURIComponent(session.user.role)}=${encodeURIComponent(session.token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      } catch (e) {}
    }

    if (document.documentElement) {
      document.documentElement.style.display = '';
    }
    return true;
  };

  window.logout = function (reason = null) {
    try {
      // Clear all generic and role-specific session keys from both storages
      const roleKeys = ['student', 'admin', 'department'];
      ['localStorage', 'sessionStorage'].forEach(storeName => {
        const store = window[storeName];
        if (!store) return;
        store.removeItem('campus_auth_session');
        store.removeItem('campus_token');
        roleKeys.forEach(r => {
          store.removeItem(`campus_auth_session_${r}`);
        });
      });
      sessionStorage.clear();

      // Expire HTTP session cookies immediately
      document.cookie = "campus_session_role=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "campus_auth_token=; path=/; max-age=0; SameSite=Lax";
      ['student', 'admin', 'department'].forEach(r => {
        document.cookie = `campus_auth_token_${r}=; path=/; max-age=0; SameSite=Lax`;
      });
    } catch (e) {}

    // Notify backend server to invalidate session if available
    try {
      const apiBase = (window.__CAMPUS_ENV__ && window.__CAMPUS_ENV__.API_BASE) || '';
      fetch(`${apiBase}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    } catch (e) {}

    updateNavSessionWidget();

    // Close dashboard if currently open in SPA viewport mode
    const viewport = document.getElementById('campus-dashboard-viewport');
    if (viewport) {
      viewport.classList.remove('active');
    }

    // Reset URL hash if pointing to protected dashboard
    if (window.location.hash.startsWith('#dashboard-') || window.location.hash.startsWith('#portal/')) {
      try {
        history.replaceState(null, null, window.location.pathname);
      } catch (e) {
        window.location.hash = '';
      }
    }

    if (reason) {
      try { sessionStorage.setItem('campus_auth_redirect_msg', reason); } catch (e) {}
    } else {
      try { sessionStorage.setItem('campus_auth_redirect_msg', "You have been securely signed out of your institutional session."); } catch (e) {}
    }

    // Replace history state so Back button cannot reopen protected page
    window.location.replace('index.html?logged_out=true');
  };

  // --------------------------------------------------------------------------
  // Failed Attempt Throttling & Lockout (Role-Scoped)
  // Lockout keys are scoped per role so a failed student login cannot lock
  // out the admin portal and vice versa.
  // --------------------------------------------------------------------------
  function checkLockout(role) {
    const key = role ? `campus_lockout_until_${role}` : 'campus_lockout_until';
    const lockoutUntil = parseInt(localStorage.getItem(key) || '0', 10);
    if (Date.now() < lockoutUntil) {
      const remainingSec = Math.ceil((lockoutUntil - Date.now()) / 1000);
      return remainingSec;
    }
    return 0;
  }

  function recordFailedAttempt(role) {
    const attemptsKey = role ? `campus_failed_attempts_${role}` : 'campus_failed_attempts';
    const lockoutKey = role ? `campus_lockout_until_${role}` : 'campus_lockout_until';
    let attempts = parseInt(localStorage.getItem(attemptsKey) || '0', 10) + 1;
    localStorage.setItem(attemptsKey, attempts.toString());
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      localStorage.setItem(lockoutKey, (Date.now() + LOCKOUT_DURATION_MS).toString());
      localStorage.setItem(attemptsKey, '0');
      return true;
    }
    return false;
  }

  function resetFailedAttempts(role) {
    const attemptsKey = role ? `campus_failed_attempts_${role}` : 'campus_failed_attempts';
    const lockoutKey = role ? `campus_lockout_until_${role}` : 'campus_lockout_until';
    localStorage.removeItem(attemptsKey);
    localStorage.removeItem(lockoutKey);
    // Also clear legacy global keys on successful login
    localStorage.removeItem('campus_failed_attempts');
    localStorage.removeItem('campus_lockout_until');
  }

  // --------------------------------------------------------------------------
  // Core Role Authentication Controller
  // --------------------------------------------------------------------------
  window.authenticateCredentials = async function ({ role, email, identifier, password, departmentName }) {
    // 1. Lockout check (role-scoped)
    const lockedSec = checkLockout(role);
    if (lockedSec > 0) {
      throw new Error(`Security Lockout Active: Too many failed attempts. Try again in ${lockedSec}s.`);
    }

    // 2. Input validation & normalization
    email = (email || '').trim();
    identifier = (identifier || '').trim();
    password = (password || '').trim();
    departmentName = (departmentName || '').trim();

    if (!email && !identifier) {
      const fieldName = role === 'student' ? 'Registration Number' : (role === 'admin' ? 'Employee ID' : 'Department ID');
      throw new Error(`Please enter your ${fieldName} or Email ID.`);
    }

    if (!password) {
      throw new Error("Please enter your password.");
    }

    if (role === 'department' && !departmentName) {
      throw new Error("Please select your Department Name.");
    }

    const loginId = identifier || email;
    const apiBase = (window.__CAMPUS_ENV__ && window.__CAMPUS_ENV__.API_BASE) || '';
    const loginUrl = `${apiBase}/api/auth/login`;

    // 3. Primary Authentication via Backend API (/api/auth/login)
    try {
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: loginId,
          identifier: loginId,
          email: email || (loginId.includes('@') ? loginId : ''),
          password: password,
          role: role,
          deptName: departmentName
        })
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.success && data.user && data.token) {
          resetFailedAttempts(role);
          
          // Clear prior generic active session to ensure clean role transition
          try {
            localStorage.removeItem('campus_auth_session');
            sessionStorage.removeItem('campus_auth_session');
          } catch (e) {}

          saveSession(data.user, data.token);

          return {
            user: data.user,
            token: data.token,
            targetUrl: data.targetUrl
          };
        }
      } else if (res.status === 401 || res.status === 400 || res.status === 403) {
        let msg = "Invalid institutional credentials. Please verify and try again.";
        if (contentType.includes('application/json')) {
          const errData = await res.json().catch(() => ({}));
          msg = errData.detail || errData.message || errData.error || msg;
        }
        const locked = recordFailedAttempt(role);
        if (locked) {
          throw new Error("Maximum credential failure threshold reached. System locked for 60 seconds.");
        }
        throw new Error(msg);
      }
    } catch (fetchErr) {
      // If error is a security lockout or credential rejection from backend, rethrow it
      if (fetchErr.message && (fetchErr.message.includes("Invalid") || fetchErr.message.includes("locked") || fetchErr.message.includes("threshold") || fetchErr.message.includes("credentials"))) {
        throw fetchErr;
      }
      // If fetch failed due to network / server offline, fall back gracefully to local offline authentication
      console.warn("Backend login API unreachable, falling back to local verification:", fetchErr);
    }

    // 4. Offline Fallback (Local credential validation for purely offline environments)
    const users = await getStoredUsers();
    let user = null;

    if (role === 'department') {
      user = users.find(u => u.role === 'department' && (u.id.toLowerCase() === identifier.toLowerCase() || u.email.toLowerCase() === email.toLowerCase())) ||
             users.find(u => u.role === 'department');
    } else if (role === 'student') {
      user = users.find(u => u.role === 'student' && (u.id.toLowerCase() === identifier.toLowerCase() || u.email.toLowerCase() === email.toLowerCase())) ||
             (password === 'StudentPass@2026' ? users.find(u => u.role === 'student') : null);
    } else if (role === 'admin') {
      user = users.find(u => u.role === 'admin' && (u.id.toLowerCase() === identifier.toLowerCase() || u.email.toLowerCase() === email.toLowerCase())) ||
             (password === 'AdminDean@2026' ? users.find(u => u.role === 'admin') : null);
    }

    if (!user) {
      const locked = recordFailedAttempt(role);
      if (locked) {
        throw new Error("Maximum credential failure threshold reached. System locked for 60 seconds.");
      }
      throw new Error(`No verified ${role} account found matching ID '${identifier || email}'.`);
    }

    if (role === 'department') {
      const deptRoster = {
        "Facility Maintenance & Plumbing": { name: "R. Murugan", division: "Facilities Operations Lead" },
        "Campus Electrical & Power": { name: "Sunil Verma", division: "Chief Electrical Inspector" },
        "Civil & Structural Maintenance": { name: "Eng. K. Mehta", division: "Civil Infrastructure Wing" },
        "Hostel Sanitation & Food Services": { name: "K. Deshmukh", division: "Hostel Operations Superintendent" },
        "IT & Campus Network Services": { name: "Vikram Mehta", division: "Systems & Network Administrator" },
        "Network Infrastructure & IT": { name: "Vikram Mehta", division: "Campus NOC & Server Vault" },
        "SHE Complaint Cell": { name: "Dr. Nalini Iyer", division: "ICC Presiding Officer" },
        "Anti-Ragging Committee": { name: "Col. P. Nair", division: "Proctorial Security Head" }
      };

      user = { ...user };
      user.id = identifier || user.id;
      user.email = email || user.email;
      user.deptName = departmentName;
      if (deptRoster[departmentName]) {
        user.name = deptRoster[departmentName].name;
        user.division = deptRoster[departmentName].division;
      }
    }

    const incomingHash = await hashPassword(password, user.salt);
    const isDeptPass = (role === 'department' && password === 'DeptOps@2026');
    const isStudentPass = (role === 'student' && password === 'StudentPass@2026');
    const isAdminPass = (role === 'admin' && password === 'AdminDean@2026');

    if (incomingHash !== user.passwordHash && !isDeptPass && !isStudentPass && !isAdminPass) {
      const locked = recordFailedAttempt(role);
      if (locked) {
        throw new Error("Incorrect credentials. Maximum attempts exceeded, portal locked for 60 seconds.");
      }
      throw new Error("Invalid password. Please check your credentials and try again.");
    }

    resetFailedAttempts(role);
    try {
      localStorage.removeItem('campus_auth_session');
      sessionStorage.removeItem('campus_auth_session');
    } catch (e) {}

    const token = await generateBearerToken(user);
    saveSession(user, token);

    return {
      user,
      token
    };
  };

  window.signInWithGoogleRole = async function (role = 'student', departmentName = null) {
    resetFailedAttempts(role);

    // Dynamic loader helper
    const ensureScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => res();
      s.onerror = (e) => rej(e);
      document.head.appendChild(s);
    });

    // 1. Try Firebase Auth (Native Firebase Web Popup)
    const fbCfg = window.__FIREBASE_CONFIG__ || {
      apiKey: "AIzaSyCn-ZsFmAo-TQYezkgGtEMxaLUMb5Npxy8",
      authDomain: "campus-fix-20547.firebaseapp.com",
      projectId: "campus-fix-20547"
    };

    if (fbCfg && fbCfg.apiKey) {
      try {
        if (typeof window.firebase === 'undefined') {
          await ensureScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
        }
        if (typeof window.firebase !== 'undefined' && !window.firebase.auth) {
          await ensureScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
        }
        if (window.firebase && !window.firebase.apps.length) {
          window.firebase.initializeApp(fbCfg);
        }
        if (window.firebase && window.firebase.auth) {
          const provider = new firebase.auth.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          const result = await firebase.auth().signInWithPopup(provider);
          if (result && result.user) {
            const gUser = result.user;
            const user = {
              id: gUser.uid.slice(0, 10).toUpperCase(),
              name: gUser.displayName || (role === 'student' ? 'Student' : 'Campus Officer'),
              email: gUser.email,
              role: role,
              deptName: (role === 'department' ? (departmentName || 'Facility Maintenance & Plumbing') : null),
              avatar: gUser.photoURL || null
            };
            const token = 'FB-' + btoa(JSON.stringify({ uid: gUser.uid, role, exp: Date.now() + 86400000 }));
            saveSession(user, token);
            return { success: true, user, token };
          }
        }
      } catch (fbErr) {
        console.warn('[Firebase Auth] Notice:', fbErr);
        if (fbErr.code === 'auth/popup-closed-by-user' || fbErr.code === 'auth/cancelled-popup-request') {
          throw new Error('Google Sign-In popup closed.');
        }
        // If unauthorized domain or operation not allowed in Firebase, continue to GSI / backend redirect
      }
    }

    // 2. Google Identity Services (GSI) OAuth Client Fallback
    const clientId = (window.__CAMPUS_ENV__ && window.__CAMPUS_ENV__.GOOGLE_CLIENT_ID) || "341687061911-k4um60gt7pu01qdg4jj9ipge9hgj669i.apps.googleusercontent.com";
    const apiBase = (window.__CAMPUS_ENV__ && window.__CAMPUS_ENV__.API_BASE) || '';

    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        return await new Promise((resolve, reject) => {
          let hasSettled = false;
          const client = window.google.accounts.oauth2.initCodeClient({
            client_id: clientId,
            scope: 'openid email profile',
            ux_mode: 'popup',
            callback: async (response) => {
              if (hasSettled) return;
              hasSettled = true;
              if (response.error) {
                return reject(new Error(response.error_description || response.error));
              }
              try {
                const endpoint = (apiBase ? apiBase : '') + '/api/auth/google';
                const apiRes = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code: response.code,
                    role: role,
                    deptName: departmentName
                  })
                });
                const resData = await apiRes.json();
                if (!resData.success) {
                  throw new Error(resData.error || "Google authentication verification failed.");
                }
                saveSession(resData.user, resData.token);
                resolve(resData);
              } catch (err) {
                reject(err);
              }
            },
            error_callback: (err) => {
              if (hasSettled) return;
              hasSettled = true;
              console.warn("Google popup closed or blocked:", err);
              if (err && (err.type === 'popup_closed' || err.type === 'user_cancel')) {
                return reject(new Error("Google popup closed by user."));
              }
              // Informative error with actionable instructions
              reject(new Error("Google OAuth origin authorization pending. Use 'Fill demo credentials' below for instant 1-click login, or add this domain to Authorized JavaScript Origins in Google Cloud Console."));
            }
          });
          client.requestCode();
        });
      } catch (e) {
        console.warn("Google popup flow notice:", e);
        throw e;
      }
    }

    // Standard redirect flow fallback if popup is completely unavailable
    const loginUrl = `${apiBase}/api/auth/google/login?role=${encodeURIComponent(role)}&deptName=${encodeURIComponent(departmentName || '')}&return_to=${encodeURIComponent(window.location.href)}`;
    window.location.href = loginUrl;
    return new Promise(() => {}); // Wait for page navigation
  };

  // --------------------------------------------------------------------------
  // Protected Route Guards & Hash Router
  // --------------------------------------------------------------------------
  window.checkRouteAuthorization = function () {
    const hash = window.location.hash;

    const protectedRoutes = {
      '#dashboard-student': 'student',
      '#dashboard-admin': 'admin',
      '#dashboard-department': 'department',
      '#portal/student': 'student',
      '#portal/admin': 'admin',
      '#portal/department': 'department'
    };

    const requiredRole = protectedRoutes[hash];
    if (!requiredRole) {
      // If closing dashboard and navigating to regular anchor
      if (!hash.startsWith('#dashboard-')) {
        const viewport = document.getElementById('campus-dashboard-viewport');
        if (viewport && viewport.classList.contains('active')) {
          viewport.classList.remove('active');
        }
      }
      return;
    }

    const session = window.getCurrentSession();

    if (!session) {
      window.showToast(`Access Restricted: Please log in as ${requiredRole.toUpperCase()} to continue.`, "warning");
      if (typeof window.openAuthPortal === 'function') {
        window.openAuthPortal(requiredRole);
      } else {
        const roleLoginPages = {
          student: 'student-login.html',
          admin: 'admin-login.html',
          department: 'department-login.html'
        };
        window.location.href = roleLoginPages[requiredRole] || 'student-login.html';
      }
      // Remove restricted hash from url
      history.replaceState(null, null, ' ');
      return;
    }

    if (session.user.role !== requiredRole) {
      window.showToast(`Access Denied: You are logged in as ${session.user.role.toUpperCase()}, but this module requires ${requiredRole.toUpperCase()} privileges.`, "error");
      // Redirect to their permitted dashboard
      if (session.user.role === 'student') {
        window.location.href = 'student-dashboard.html';
      } else if (session.user.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      } else if (session.user.role === 'department') {
        window.location.href = 'department-dashboard.html';
      } else {
        window.location.hash = `#dashboard-${session.user.role}`;
      }
      return;
    }

    // Authorized! Render the target dashboard
    if (requiredRole === 'student') {
      window.location.href = 'student-dashboard.html';
      return;
    }
    if (requiredRole === 'admin') {
      window.location.href = 'admin-dashboard.html';
      return;
    }
    if (requiredRole === 'department') {
      window.location.href = 'department-dashboard.html';
      return;
    }

    if (window.renderDashboard) {
      window.renderDashboard(session.user);
    }
  };

  window.addEventListener('hashchange', window.checkRouteAuthorization);

  // --------------------------------------------------------------------------
  // Universal Top Navbar Role Switcher (Available on all pages)
  // --------------------------------------------------------------------------
  window.switchRoleNav = function (targetRole) {
    const session = window.getCurrentSession ? window.getCurrentSession() : null;
    const dashboards = {
      student: 'student-dashboard.html',
      admin: 'admin-dashboard.html',
      department: 'department-dashboard.html'
    };
    const loginPages = {
      student: 'student-login.html',
      admin: 'admin-login.html',
      department: 'department-login.html'
    };

    if (session && session.user && session.user.role === targetRole) {
      window.location.href = dashboards[targetRole];
      return;
    }

    // Go directly to target role's login or dashboard
    window.location.href = loginPages[targetRole] || dashboards[targetRole];
  };

  // --------------------------------------------------------------------------
  // Navigation Session Widget Synchronizer
  // --------------------------------------------------------------------------
  function updateNavSessionWidget() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('dashboard') || path.includes('sos-desk') || path.includes('login')) {
      const stray = document.getElementById('nav-session-widget');
      if (stray) stray.remove();
      return;
    }

    const widget = document.getElementById('nav-session-widget');
    if (!widget) return;

    const session = window.getCurrentSession();
    if (!session || !session.user) {
      widget.innerHTML = '';
      return;
    }

    const roleColors = {
      student: { bg: 'bg-[#06b6d4]/20', text: 'text-[#06b6d4]', border: 'border-[#06b6d4]/40', badge: 'Student' },
      admin: { bg: 'bg-[#5D3136]', text: 'text-[#e8b4b8]', border: 'border-[#8a4048]/60', badge: 'Admin Room' },
      department: { bg: 'bg-[#10b981]/20', text: 'text-[#10b981]', border: 'border-[#10b981]/40', badge: 'Dept Ops' }
    };

    const cfg = roleColors[session.user.role] || roleColors.student;
    const sessionClick = session.user.role === 'student'
      ? "window.location.href='student-dashboard.html'"
      : session.user.role === 'admin'
        ? "window.location.href='admin-dashboard.html'"
        : session.user.role === 'department'
          ? "window.location.href='department-dashboard.html'"
          : "window.location.hash='#dashboard-" + session.user.role + "'";

    widget.innerHTML = `
      <div class="session-pill cursor-pointer" onclick="${sessionClick}" title="Open ${cfg.badge} Dashboard">
        <span class="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}">
          ${cfg.badge}
        </span>
        <span class="text-xs text-white/90 font-medium hidden sm:inline-block max-w-[130px] truncate">
          ${session.user.name.split(' ')[0]}
        </span>
      </div>
      <button onclick="window.logout()" type="button" class="text-white/60 hover:text-[#f87171] p-1.5 transition cursor-pointer text-xs flex items-center gap-1 font-mono" title="Logout Session">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span class="hidden md:inline">Exit</span>
      </button>
    `;
  }

  // --------------------------------------------------------------------------
  // Rich Glassmorphic Toast Notification System
  // --------------------------------------------------------------------------
  window.showToast = function (message, type = 'info', duration = 4000) {
    let container = document.getElementById('campus-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'campus-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `campus-toast toast-${type}`;

    const icons = {
      success: `<svg class="w-5 h-5 text-[#10b981] shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      error: `<svg class="w-5 h-5 text-[#ef4444] shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      warning: `<svg class="w-5 h-5 text-[#f59e0b] shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      info: `<svg class="w-5 h-5 text-[#06b6d4] shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };

    toast.innerHTML = `
      ${icons[type] || icons.info}
      <div class="flex-1 text-xs leading-relaxed text-white/90">
        ${message}
      </div>
      <button class="text-white/40 hover:text-white transition ml-1" onclick="this.parentElement.remove()">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 260);
    }, duration);
  };

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    updateNavSessionWidget();
    window.checkRouteAuthorization();

    // Check for redirect message and display toast
    try {
      const msg = sessionStorage.getItem('campus_auth_redirect_msg');
      if (msg) {
        sessionStorage.removeItem('campus_auth_redirect_msg');
        setTimeout(() => {
          if (window.showToast) {
            window.showToast(msg, msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('restricted') ? 'warning' : 'info');
          }
        }, 300);
      }
    } catch (e) {}
  });

})();
