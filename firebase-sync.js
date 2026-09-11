/**
 * CAMP(US) FIX — Firebase Realtime Sync Engine
 * Enables multi-device real-time sync across Student, Admin, and Department portals
 * without requiring any paid backend server or credit card.
 */
(function () {
  let db = null;
  let ticketsRef = null;
  let isFirebaseActive = false;

  function isConfigured() {
    const cfg = window.__FIREBASE_CONFIG__;
    return cfg && cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY' && cfg.projectId && cfg.projectId !== 'YOUR_PROJECT_ID';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        return resolve();
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (!isConfigured()) {
      console.log('[Firebase Sync] Not configured. Operating with native WebSocket / local store.');
      return;
    }

    try {
      if (typeof window.firebase === 'undefined') {
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(window.__FIREBASE_CONFIG__);
      }

      db = firebase.database();
      ticketsRef = db.ref('campus_tickets');
      isFirebaseActive = true;
      console.log('⚡ [Firebase Sync] Connected to cloud database.');

      // Update UI Live Indicator
      updateLiveBadge(true);

      // Listen for initial data / sync seed tickets if cloud is empty
      ticketsRef.once('value', (snapshot) => {
        const val = snapshot.val();
        if (!val) {
          console.log('[Firebase Sync] Cloud store empty. Uploading baseline campus tickets...');
          const local = getLocalTickets();
          if (local && local.length > 0) {
            const batch = {};
            local.forEach(t => {
              if (t.id) batch[t.id] = t;
            });
            ticketsRef.set(batch);
          }
        }
      });

      // Realtime listener for all connected clients
      ticketsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const ticketsArray = Object.values(data);
          // Sort descending by priority or createdAt
          ticketsArray.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

          // Save to local cache & storage
          try {
            localStorage.setItem('campus_tickets', JSON.stringify(ticketsArray));
          } catch (e) {}

          // Notify dashboard UI components
          window.dispatchEvent(new CustomEvent('campus:tickets-updated', {
            detail: { tickets: ticketsArray, source: 'firebase' }
          }));
        }
      }, (err) => {
        console.warn('[Firebase Sync] Realtime listener notice:', err);
        updateLiveBadge(false);
      });

      hookDashboardFunctions();

    } catch (err) {
      console.error('[Firebase Sync] Initialization error:', err);
      updateLiveBadge(false);
    }
  }

  function getLocalTickets() {
    try {
      const raw = localStorage.getItem('campus_tickets');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    if (typeof window.getTickets === 'function') {
      return window.getTickets();
    }
    return [];
  }

  function updateLiveBadge(online) {
    const badges = document.querySelectorAll('.live-indicator-badge, [id*="live-status"]');
    badges.forEach(b => {
      if (online) {
        b.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span> Firebase Live Sync`;
        b.classList.add('text-emerald-400');
      }
    });
  }

  function hookDashboardFunctions() {
    if (!isFirebaseActive || !ticketsRef) return;

    // Hook ticket creation
    const originalCreate = window.apiCreateTicket;
    window.apiCreateTicket = async function (ticketData) {
      const id = ticketData.id || ("CP-" + Math.floor(1000 + Math.random() * 9000));
      const newTicket = { ...ticketData, id, createdAt: ticketData.createdAt || Date.now() };
      
      try {
        await ticketsRef.child(id).set(newTicket);
        console.log(`[Firebase Sync] Ticket #${id} written to cloud.`);
      } catch (e) {
        console.warn('[Firebase Sync] Cloud write warning, trying fallback:', e);
      }

      if (typeof originalCreate === 'function') {
        try { originalCreate(ticketData); } catch (e) {}
      }

      return { success: true, ticket: newTicket, id };
    };

    // Hook status updates (in_progress, fixed, resolved)
    const originalUpdate = window.apiUpdateStatus;
    window.apiUpdateStatus = async function (ticketId, nextStatus, note = '') {
      const updates = {
        status: nextStatus,
        lastUpdated: Date.now()
      };
      if (nextStatus === 'fixed') {
        updates.fixedAt = Date.now();
        updates.verificationDeadline = Date.now() + (48 * 3600 * 1000);
      }
      if (nextStatus === 'resolved') {
        updates.resolvedAt = Date.now();
        updates.progress = 100;
      }
      if (nextStatus === 'in_progress') {
        updates.progress = 50;
      }

      try {
        await ticketsRef.child(ticketId).update(updates);
        console.log(`[Firebase Sync] Status #${ticketId} -> ${nextStatus} synced.`);
      } catch (e) {
        console.warn('[Firebase Sync] Update status cloud write warning:', e);
      }

      if (typeof originalUpdate === 'function') {
        try { await originalUpdate(ticketId, nextStatus, note); } catch (e) {}
      }

      return { success: true, ticketId, status: nextStatus };
    };

    // Hook upvote ticket
    const originalUpvote = window.apiUpvoteTicket;
    window.apiUpvoteTicket = async function (ticketId) {
      try {
        const snap = await ticketsRef.child(ticketId).once('value');
        const current = snap.val();
        if (current) {
          const upvotes = (current.upvotes || 0) + 1;
          await ticketsRef.child(ticketId).update({ upvotes });
          console.log(`[Firebase Sync] Upvote #${ticketId} -> ${upvotes}`);
        }
      } catch (e) {
        console.warn('[Firebase Sync] Upvote cloud write warning:', e);
      }

      if (typeof originalUpvote === 'function') {
        try { await originalUpvote(ticketId); } catch (e) {}
      }
      return { success: true, ticketId };
    };
  }

  // Auto-run when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose global controller
  window.FirebaseSync = {
    isConfigured,
    init,
    isOnline: () => isFirebaseActive,
    pushTicket: async (t) => ticketsRef && ticketsRef.child(t.id).set(t),
    updateTicket: async (id, u) => ticketsRef && ticketsRef.child(id).update(u)
  };
})();
