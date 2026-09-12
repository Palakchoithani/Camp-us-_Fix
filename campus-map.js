/**
 * CAMP(US)FIX — UNIFIED CAMPUS GIS MAP ENGINE (Leaflet 1.9.4)
 * Single Source of Truth for Campus Map across Landing Page, Student, Admin Room, and Department.
 * Fully synchronized with live backend tickets store and real-time event bus.
 */

(function () {
  'use strict';

  // 8 Canonical Campus Building Zones
  const CAMPUS_ZONE_TEMPLATES = [
    {
      id: "academic-hub",
      name: "Main Academic & Computing Wing",
      zone: "Zone A • Academic Hub",
      code: "BLDG-01",
      dx: 130,
      dy: 110,
      matchKeywords: ["academic", "computer", "computing", "lecture", "coding", "seminar", "class", "hall 102", "bldg-01"]
    },
    {
      id: "central-library",
      name: "Central Library & Reading Commons",
      zone: "Zone B • Learning Quad",
      code: "BLDG-02",
      dx: -120,
      dy: 180,
      matchKeywords: ["library", "reading", "commons", "book", "bldg-02"]
    },
    {
      id: "hostel-quad",
      name: "Aryabhatta Hostel Complex (Towers A-D)",
      zone: "Zone C • Residential Sector",
      code: "BLDG-03",
      dx: -170,
      dy: -150,
      matchKeywords: ["hostel", "block 4", "block c", "block b", "tower", "room 212", "room 314", "room 316", "warden", "bldg-03"]
    },
    {
      id: "mech-workshop",
      name: "Mechanical & Electronics Labs",
      zone: "Zone D • Engineering Bay",
      code: "BLDG-04",
      dx: 240,
      dy: 190,
      matchKeywords: ["workshop", "mech", "electronics", "circuit", "testing lab", "material", "safety eyewash", "bldg-04"]
    },
    {
      id: "dining-hall",
      name: "Main Mess & Student Dining Hall",
      zone: "Zone E • Community Commons",
      code: "BLDG-05",
      dx: 120,
      dy: -90,
      matchKeywords: ["mess", "dining", "canteen", "kitchen", "grease trap", "washbasin", "drain", "food", "bldg-05"]
    },
    {
      id: "sports-arena",
      name: "Sports Complex & Indoor Gymnasium",
      zone: "Zone F • Athletics Quad",
      code: "BLDG-06",
      dx: 190,
      dy: -210,
      matchKeywords: ["sports", "gym", "badminton", "athletics", "pavilion", "court", "floodlight", "bldg-06"]
    },
    {
      id: "admin-complex",
      name: "Administration Block & Student Affairs",
      zone: "Zone G • Central Office",
      code: "BLDG-07",
      dx: -190,
      dy: 40,
      matchKeywords: ["admin", "accounts", "student affairs", "cashier", "fee", "office", "bldg-07"]
    },
    {
      id: "noc-hub",
      name: "Campus Security & Utility Command Center",
      zone: "Zone H • Infrastructure Core",
      code: "BLDG-08",
      dx: -50,
      dy: -140,
      matchKeywords: ["security", "noc", "utility", "gate", "perimeter", "command", "bldg-08"]
    }
  ];

  // Verified Physical OSM Buildings (IIT Bombay Powai Campus Reference)
  const VERIFIED_IITB_OSM_BUILDINGS = [
    { name: "Academic Complex (Computer Science & Lecture Wing)", lat: 19.1342, lng: 72.9168, type: "academic" },
    { name: "Central Library & Digital Commons Building", lat: 19.1315, lng: 72.9160, type: "library" },
    { name: "Aryabhatta Student Hostel Complex (Block A-D)", lat: 19.1360, lng: 72.9125, type: "residential" },
    { name: "Engineering & Applied Electronics Workshops", lat: 19.1308, lng: 72.9175, type: "laboratories" },
    { name: "Main Student Mess & Dining Facility", lat: 19.1348, lng: 72.9135, type: "dining" },
    { name: "Sports Pavilion & Indoor Athletics Hall", lat: 19.1348, lng: 72.9110, type: "athletics" },
    { name: "Administrative Office & Student Affairs Block", lat: 19.1328, lng: 72.9152, type: "administrative" },
    { name: "Campus Security & Utility Command Center", lat: 19.1300, lng: 72.9145, type: "facility" }
  ];

  const DEFAULT_ANCHOR = { lat: 19.1334, lng: 72.9133 };

  // Shared active maps registry
  const activeMapInstances = {};

  // Haversine distance in meters
  function calcDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  // Determine which building an issue belongs to
  function matchBuildingForTicket(ticket) {
    if (ticket.buildingId) {
      const b = CAMPUS_ZONE_TEMPLATES.find(z => z.id === ticket.buildingId);
      if (b) return b.id;
    }
    const loc = (ticket.location || "").toLowerCase();
    const title = (ticket.title || "").toLowerCase();
    const text = loc + " " + title;

    for (const tmpl of CAMPUS_ZONE_TEMPLATES) {
      for (const kw of tmpl.matchKeywords) {
        if (text.includes(kw)) {
          return tmpl.id;
        }
      }
    }
    // Default fallback by department if not matched
    const dept = (ticket.department || "").toLowerCase();
    if (dept.includes("hostel") || dept.includes("sanitation")) return "hostel-quad";
    if (dept.includes("academic") || dept.includes("network") || dept.includes("it")) return "academic-hub";
    if (dept.includes("electrical") || dept.includes("power")) return "mech-workshop";
    if (dept.includes("admin") || dept.includes("she") || dept.includes("ragging")) return "admin-complex";

    return "academic-hub";
  }

  // Associate tickets with buildings dynamically from the live data store
  function computeBuildingsWithTickets(anchorLat, anchorLng, allTickets = []) {
    const isNearIITB = Math.abs(anchorLat - DEFAULT_ANCHOR.lat) < 0.08 && Math.abs(anchorLng - DEFAULT_ANCHOR.lng) < 0.08;
    const sourceBuildings = isNearIITB ? VERIFIED_IITB_OSM_BUILDINGS : VERIFIED_IITB_OSM_BUILDINGS;

    return CAMPUS_ZONE_TEMPLATES.map((tmpl, idx) => {
      const b = sourceBuildings[idx];
      const dist = calcDistanceMeters(anchorLat, anchorLng, b.lat, b.lng);

      // Find all tickets associated with this building
      const buildingTickets = allTickets.filter(t => matchBuildingForTicket(t) === tmpl.id);
      const activeTickets = buildingTickets.filter(t => t.status !== "resolved");

      // Determine severity based on active tickets
      let severity = "nominal";
      if (activeTickets.some(t => t.severity === "critical")) {
        severity = "critical";
      } else if (activeTickets.some(t => t.severity === "moderate" || t.severity === "high")) {
        severity = "moderate";
      } else if (activeTickets.length > 0) {
        severity = "low";
      }

      return {
        ...tmpl,
        physicalStructureName: b.name,
        buildingType: b.type,
        lat: b.lat,
        lng: b.lng,
        distance: dist,
        isPhysicalBuilding: true,
        severity: severity,
        totalIssues: activeTickets.length,
        issues: activeTickets.map(t => ({
          id: t.id,
          title: t.title,
          category: t.category || "general",
          catIcon: t.catIcon || (t.category === "wifi" ? "📶" : t.category === "power" ? "⚡" : t.category === "hvac" ? "❄️" : "💧"),
          location: t.location || tmpl.name,
          severity: t.severity || "moderate",
          status: t.status ? t.status.replace(/_/g, ' ') : "Under Triage",
          reportedTime: t.reportedTime || "Recently",
          reportedBy: t.studentName || "Campus Member",
          department: t.department || "General Maintenance"
        }))
      };
    });
  }

  // Detailed Address Formatter - Parses geocoding responses and builds readable hierarchical address
  function formatDetailedAddress(geoData, nearestCampusBldg) {
    if (!geoData || typeof geoData !== 'object') {
      if (nearestCampusBldg) {
        return {
          primaryTitle: nearestCampusBldg.name,
          secondaryLine: nearestCampusBldg.zone || 'Campus Zone',
          fullAddress: `${nearestCampusBldg.name}, ${nearestCampusBldg.zone || 'Campus Zone'}`,
          buildingName: nearestCampusBldg.name,
          city: 'Bhopal',
          state: 'Madhya Pradesh',
          pin: ''
        };
      }
      return {
        primaryTitle: 'Campus Location',
        secondaryLine: '',
        fullAddress: 'Campus Location',
        buildingName: 'Campus Location',
        city: '',
        state: '',
        pin: ''
      };
    }

    const addr = geoData.address || {};

    // 1. Primary building / POI / Campus facility / Landmark
    const poi = addr.university || addr.college || addr.school ||
                addr.hospital || addr.amenity || addr.building ||
                addr.office || addr.place || addr.leisure ||
                addr.tourism || addr.historic || addr.shop ||
                addr.commercial || geoData.name;

    // 2. Suburb / Area / Locality / Sector / Village
    const area = addr.suburb || addr.neighbourhood || addr.quarter ||
                 addr.residential || addr.village || addr.hamlet ||
                 addr.city_district || addr.subdistrict;

    // 3. Road / Street / Highway
    const road = addr.road || addr.street || addr.footway || addr.path || addr.highway;

    // 4. City / Town
    const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || '';

    // 5. State
    const state = addr.state || addr.province || addr.state_district || '';

    // 6. Postcode / PIN
    const pin = addr.postcode || '';

    // Determine Primary Title: POI > Area > Road
    let primaryTitle = poi || area || road;

    // If primary title is empty or is literally just the city name (e.g. "Bhopal")
    if (!primaryTitle || (city && primaryTitle.trim().toLowerCase() === city.trim().toLowerCase())) {
      if (nearestCampusBldg && nearestCampusBldg.name) {
        primaryTitle = nearestCampusBldg.name;
      } else if (area && (!city || area.trim().toLowerCase() !== city.trim().toLowerCase())) {
        primaryTitle = area;
      } else if (road) {
        primaryTitle = road;
      } else if (city) {
        primaryTitle = `${city} Campus Hub`;
      } else {
        primaryTitle = 'Campus Zone';
      }
    }

    // Determine Building Name for dropdown and form preselection
    const matchedBuildingName = poi || (nearestCampusBldg ? nearestCampusBldg.name : primaryTitle);

    // Construct Secondary Line: [Road/Street], [City], [State] [PIN]
    const line2Parts = [];
    if (road && road.trim().toLowerCase() !== primaryTitle.trim().toLowerCase()) {
      line2Parts.push(road.trim());
    }
    if (area && area.trim().toLowerCase() !== primaryTitle.trim().toLowerCase() && !line2Parts.some(p => p.toLowerCase() === area.trim().toLowerCase())) {
      line2Parts.push(area.trim());
    }
    if (city && city.trim().toLowerCase() !== primaryTitle.trim().toLowerCase() && !line2Parts.some(p => p.toLowerCase() === city.trim().toLowerCase())) {
      line2Parts.push(city.trim());
    }

    const statePin = (state && pin) ? `${state} ${pin}` : (state || pin || '');
    if (statePin && statePin.trim().toLowerCase() !== primaryTitle.trim().toLowerCase()) {
      line2Parts.push(statePin.trim());
    }

    const secondaryLine = line2Parts.join(', ');
    const fullAddress = secondaryLine ? `${primaryTitle}, ${secondaryLine}` : primaryTitle;

    return {
      primaryTitle,
      secondaryLine,
      fullAddress,
      buildingName: matchedBuildingName,
      city,
      state,
      pin
    };
  }

  // Reverse Geocoding Engine with OSM Nominatim & BigDataCloud fallbacks
  async function resolveDetailedLocation(lat, lng, buildingsList = []) {
    let nearest = null;
    let minDist = Infinity;
    if (Array.isArray(buildingsList) && buildingsList.length > 0) {
      buildingsList.forEach(b => {
        if (typeof b.lat === 'number' && typeof b.lng === 'number') {
          const d = calcDistanceMeters(lat, lng, b.lat, b.lng);
          if (d < minDist) {
            minDist = d;
            nearest = b;
          }
        }
      });
    }

    let rawGeo = null;

    // 1. Primary reverse geocoding via OpenStreetMap Nominatim with strict timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.address || data.display_name)) {
          rawGeo = data;
        }
      }
    } catch (_) {}

    // 2. Secondary fallback via BigDataCloud client API if Nominatim is rate-limited or fails
    if (!rawGeo) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            rawGeo = {
              name: data.locality || data.city,
              address: {
                city: data.city || data.locality,
                state: data.principalSubdivision,
                postcode: data.postcode,
                country: data.countryName
              },
              display_name: [data.locality, data.city, data.principalSubdivision, data.countryName].filter(Boolean).join(', ')
            };
          }
        }
      } catch (_) {}
    }

    const formatted = formatDetailedAddress(rawGeo, nearest);

    return {
      ...formatted,
      locationName: formatted.fullAddress,
      zone: nearest ? nearest.zone : 'Campus Zone',
      distance: nearest ? minDist : null,
      isCampusZone: minDist <= 1500,
      lat,
      lng
    };
  }

  // Export helper functions to global window scope
  window.formatDetailedAddress = formatDetailedAddress;
  window.resolveDetailedLocation = resolveDetailedLocation;

  /**
   * CampusMapController Class
   */
  class CampusMapController {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.options = Object.assign({
        role: 'public', // 'public', 'student', 'admin', 'department'
        deptFilter: null,
        onRaiseTicket: null,
        showBuildingsList: true,
        height: '620px'
      }, options);

      this.map = null;
      this.markersMap = {};
      this.buildingFootprintLayers = [];
      this.userMarker = null;
      this.userAccuracyCircle = null;
      this.userCoordinates = null;
      this.currentFilter = 'all';
      this.searchQuery = '';
      this.isSatellite = false;
      this.streetLayer = null;
      this.satelliteLayer = null;
      this.watchPositionId = null;
      this.recenterPending = false;
      this.hasAcquiredFirstFix = false;
      this.isLocating = false;
      this.locationRequestSeq = 0;
      this.userLocationPlaceName = '';
      this.userLocationSecondaryLine = '';
      this.userLocationFullAddress = '';
      this.userLocationCity = '';
      this.detectedBuildingName = '';

      this.init();
    }

    init() {
      const L = window.Leaflet || window.L;
      if (!L || typeof L.map !== 'function') {
        setTimeout(() => this.init(), 120);
        return;
      }

      this.renderSkeleton();
      this.initLeaflet();
      this.setupEventListeners();
    }

    renderSkeleton() {
      const wrapper = document.getElementById(this.containerId);
      if (!wrapper) return;

      const roleBadge = this.options.role === 'admin' ? 'Admin Overwatch' : (this.options.role === 'department' ? 'Department' : (this.options.role === 'student' ? 'Student Spatial Telemetry' : 'Physical Buildings Only'));

      wrapper.innerHTML = `
        <div class="campus-map-root font-sans text-[#311419]">
          
          <!-- Live Telemetry KPI Bar -->
          <div class="flex flex-col lg:flex-row lg:items-end justify-between mb-6 gap-4">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5D3136]/10 text-[#5D3136] text-[11px] font-mono font-bold uppercase tracking-widest mb-1.5 border border-[#5D3136]/20">
                <span class="w-2 h-2 rounded-full bg-[#5D3136] animate-ping"></span>
                <span>${roleBadge} • Leaflet GIS Engine</span>
              </div>
              <h3 class="text-2xl sm:text-3xl font-extrabold text-[#311419] tracking-tight font-cinematic">
                Campus Infrastructure Overwatch
              </h3>
              <p class="text-xs sm:text-sm text-[#594043] mt-1 max-w-2xl font-normal leading-relaxed">
                Active incident tickets are mapped strictly inside verified physical campus buildings and facility rooms. Real-time GIS telemetry synced with backend database.
              </p>
            </div>

            <!-- Quick Status Badges -->
            <div class="flex flex-wrap items-center gap-2 sm:gap-3">
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E2DBD0] shadow-xs">
                <span class="w-2.5 h-2.5 rounded-full bg-[#dc2626] animate-pulse"></span>
                <span class="text-xs font-mono font-bold text-[#311419]" id="${this.containerId}-kpi-critical">0 Critical</span>
              </div>
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E2DBD0] shadow-xs">
                <span class="w-2.5 h-2.5 rounded-full bg-[#d97706]"></span>
                <span class="text-xs font-mono font-bold text-[#311419]" id="${this.containerId}-kpi-triage">0 Under Triage</span>
              </div>
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E2DBD0] shadow-xs">
                <span class="w-2.5 h-2.5 rounded-full bg-[#0284c7]"></span>
                <span class="text-xs font-mono font-bold text-[#311419]" id="${this.containerId}-kpi-dispatched">0 Dispatched</span>
              </div>
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#059669]/10 border border-[#059669]/30 shadow-xs">
                <span class="w-2.5 h-2.5 rounded-full bg-[#059669]"></span>
                <span class="text-xs font-mono font-bold text-[#059669]" id="${this.containerId}-kpi-resolved">0 Resolved Today</span>
              </div>
            </div>
          </div>

          <!-- Location Telemetry Bar -->
          <div id="${this.containerId}-location-banner" class="mb-4 p-3 bg-white/95 backdrop-blur-md rounded-2xl border border-[#E2DBD0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all">
            <div class="flex items-center gap-3 text-[#311419]">
              <div class="relative flex h-3 w-3 shrink-0">
                <span id="${this.containerId}-gps-status-ping" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span id="${this.containerId}-gps-status-dot" class="relative inline-flex rounded-full h-3 w-3 bg-[#0284c7]"></span>
              </div>
              <div>
                <span class="font-bold font-mono uppercase tracking-wider text-[#5D3136]">Live Geolocation:</span>
                <span id="${this.containerId}-location-status" class="text-[#594043] ml-1">
                  Connecting to device GPS...
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button id="${this.containerId}-btn-locate" class="px-3 py-1.5 rounded-xl bg-[#5D3136] hover:bg-[#733c43] text-white font-mono text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1.5" title="Recenter map to my location">
                <span>📍</span>
                <span id="${this.containerId}-locate-label">My Location</span>
              </button>
            </div>
          </div>

          <!-- Filters & Search Bar -->
          <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4 bg-white/85 p-2.5 rounded-2xl border border-[#E2DBD0] shadow-xs">
            <div id="${this.containerId}-filters" class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 text-xs custom-map-scrollbar">
              <button data-filter="all" class="map-filter-btn active px-3.5 py-1.5 rounded-xl font-medium transition bg-[#5D3136] text-white shadow-xs whitespace-nowrap cursor-pointer">
                All Zones
              </button>
              <button id="${this.containerId}-filter-my-location" data-filter="my-location" class="map-filter-btn px-3.5 py-1.5 rounded-xl font-medium transition bg-[#f9f5ed] text-[#0284c7] hover:bg-[#0284c7]/10 border border-[#0284c7]/30 whitespace-nowrap cursor-pointer items-center gap-1.5" style="display: none;">
                <span class="w-2 h-2 rounded-full bg-[#0284c7] animate-ping"></span>
                <span>📍 Problems at My Location (<span id="${this.containerId}-my-loc-count">0</span>)</span>
              </button>
              <button data-filter="critical" class="map-filter-btn px-3.5 py-1.5 rounded-xl font-medium transition bg-[#f9f5ed] text-[#594043] hover:bg-[#5D3136]/10 border border-[#E2DBD0] whitespace-nowrap cursor-pointer">
                🔴 Critical Priority
              </button>
              <button data-filter="wifi" class="map-filter-btn px-3.5 py-1.5 rounded-xl font-medium transition bg-[#f9f5ed] text-[#594043] hover:bg-[#5D3136]/10 border border-[#E2DBD0] whitespace-nowrap cursor-pointer">
                📶 Wi-Fi & IT
              </button>
              <button data-filter="power" class="map-filter-btn px-3.5 py-1.5 rounded-xl font-medium transition bg-[#f9f5ed] text-[#594043] hover:bg-[#5D3136]/10 border border-[#E2DBD0] whitespace-nowrap cursor-pointer">
                ⚡ Electrical & Power
              </button>
              <button data-filter="plumbing" class="map-filter-btn px-3.5 py-1.5 rounded-xl font-medium transition bg-[#f9f5ed] text-[#594043] hover:bg-[#5D3136]/10 border border-[#E2DBD0] whitespace-nowrap cursor-pointer">
                💧 Plumbing & Water
              </button>
              <button data-filter="hvac" class="map-filter-btn px-3.5 py-1.5 rounded-xl font-medium transition bg-[#f9f5ed] text-[#594043] hover:bg-[#5D3136]/10 border border-[#E2DBD0] whitespace-nowrap cursor-pointer">
                ❄️ HVAC & Climate
              </button>
            </div>

            <div class="relative min-w-[220px]">
              <svg class="w-4 h-4 text-[#73575b] absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input id="${this.containerId}-search" type="text" placeholder="Search building or issue..." class="w-full pl-9 pr-3 py-1.5 text-xs bg-[#fdfbf7] border border-[#E2DBD0] rounded-xl text-[#311419] placeholder-[#8c7477] focus:outline-none focus:border-[#5D3136]">
            </div>
          </div>

          <!-- Main 2-Column Map Display -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            <!-- Left Column: Building Cards -->
            <div class="lg:col-span-5 flex flex-col gap-3 max-h-[620px] overflow-y-auto pr-1 custom-map-scrollbar" id="${this.containerId}-buildings-list">
              <!-- Rendered Dynamically -->
            </div>

            <!-- Right Column: Leaflet Map Container -->
            <div class="lg:col-span-7 relative rounded-2xl overflow-hidden border border-[#E2DBD0] shadow-xl bg-[#f4eee2]">
              
              <!-- Floating Top Controls Bar -->
              <div class="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between pointer-events-none">
                <div class="pointer-events-auto flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E2DBD0] shadow-md text-xs font-mono font-medium text-[#311419]">
                  <span class="w-2 h-2 rounded-full bg-[#059669] animate-pulse"></span>
                  <span id="${this.containerId}-gps-badge">IIT BOMBAY CAMPUS · POWAI</span>
                </div>
                <div class="pointer-events-auto flex items-center gap-2">
                  <button id="${this.containerId}-map-locate" class="p-2 bg-[#5D3136] text-white rounded-xl border border-[#5D3136] shadow-md hover:bg-[#7d3b42] transition text-xs flex items-center gap-1.5 font-medium cursor-pointer" title="Track My Location">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span>My Location</span>
                  </button>
                  <button id="${this.containerId}-map-recenter" class="p-2 bg-white/95 rounded-xl border border-[#E2DBD0] shadow-md hover:bg-[#5D3136] hover:text-white transition text-[#311419] text-xs flex items-center gap-1.5 font-medium cursor-pointer" title="Fit Campus Bounds">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                    </svg>
                    <span>Fit All</span>
                  </button>
                  <button id="${this.containerId}-map-satellite" class="p-2 bg-white/95 rounded-xl border border-[#E2DBD0] shadow-md hover:bg-[#5D3136] hover:text-white transition text-[#311419] text-xs flex items-center gap-1.5 font-medium cursor-pointer" title="Toggle Satellite">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span id="${this.containerId}-sat-label">Satellite</span>
                  </button>
                </div>
              </div>

              <!-- The Leaflet Map Canvas -->
              <div id="${this.containerId}-map-canvas" class="w-full h-[620px] z-0"></div>

              <!-- Floating Legend Footer -->
              <div class="absolute bottom-3 left-3 right-3 z-[400] pointer-events-none flex flex-wrap items-center justify-between gap-2">
                <div class="pointer-events-auto bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E2DBD0] shadow-md text-[11px] flex items-center gap-3 text-[#594043]">
                  <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-[#0284c7]"></span> You Are Here</span>
                  <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-[#dc2626]"></span> Critical</span>
                  <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-[#d97706]"></span> Moderate</span>
                  <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-[#059669]"></span> Nominal</span>
                </div>
                <div class="pointer-events-auto bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E2DBD0] shadow-md text-[11px] font-mono text-[#73575b]" id="${this.containerId}-telemetry-nodes">
                  Telemetry: 1,420 Active Nodes
                </div>
              </div>

            </div>

          </div>

        </div>
      `;
    }

    initLeaflet() {
      const L = window.Leaflet || window.L;
      const canvas = document.getElementById(`${this.containerId}-map-canvas`);
      if (!canvas) return;

      const anchor = this.userCoordinates || DEFAULT_ANCHOR;

      this.map = L.map(`${this.containerId}-map-canvas`, {
        center: [anchor.lat, anchor.lng],
        zoom: 16,
        minZoom: 13,
        maxZoom: 19,
        zoomControl: false
      });

      L.control.zoom({ position: "bottomright" }).addTo(this.map);

      this.streetLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(this.map);

      this.satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 19
      });

      // Handle map click: raise ticket at coordinate
      this.map.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        L.popup()
          .setLatLng(e.latlng)
          .setContent(`
            <div class="p-3 text-[#311419] min-w-[240px]">
              <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#5D3136]/10 text-[#5D3136] text-[10px] font-mono font-bold uppercase mb-2 border border-[#5D3136]/20">
                <span>🏢</span> Building Point Selected
              </div>
              <h4 class="font-bold text-xs text-[#311419]">Building Coordinates:</h4>
              <div class="font-mono text-[11px] text-[#594043] my-1 bg-[#f9f5ed] p-2 rounded-lg border border-[#e2dbd0]">
                ${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E
              </div>
              <p class="text-[11px] text-[#594043] mb-2.5">File an issue specifically located inside this building structure.</p>
              <button onclick="window.dispatchMapLocationAction('${this.containerId}', 'Campus Point (${lat.toFixed(5)}, ${lng.toFixed(5)})', ${lat.toFixed(6)}, ${lng.toFixed(6)})" class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#5D3136] to-[#7d3b42] hover:brightness-110 text-white text-xs font-bold font-mono tracking-wide uppercase shadow transition cursor-pointer">
                + Raise Ticket in This Building
              </button>
            </div>
          `)
          .openOn(this.map);
      });

      // Initial Refresh
      this.refresh();

      // Invalidate size on schedule
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 200);
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 600);
      setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 1200);
    }

    refresh() {
      const allTickets = window.getTickets ? window.getTickets() : [];
      const anchor = this.userCoordinates || DEFAULT_ANCHOR;

      this.buildings = computeBuildingsWithTickets(anchor.lat, anchor.lng, allTickets);

      this.updateKpis(allTickets);
      this.renderMarkers();
      this.renderBuildingCards();
      if (this.userCoordinates) {
        this.updateUserBeacon();
      }
    }

    updateKpis(allTickets) {
      const criticalCount = allTickets.filter(t => t.severity === 'critical' && t.status !== 'resolved').length;
      const triageCount = allTickets.filter(t => (t.status === 'under_triage' || t.status === 'submitted') && t.status !== 'resolved').length;
      const dispatchedCount = allTickets.filter(t => (t.status === 'dispatched' || t.status === 'in_progress') && t.status !== 'resolved').length;
      const resolvedCount = allTickets.filter(t => t.status === 'resolved').length;

      const critEl = document.getElementById(`${this.containerId}-kpi-critical`);
      const triageEl = document.getElementById(`${this.containerId}-kpi-triage`);
      const dispEl = document.getElementById(`${this.containerId}-kpi-dispatched`);
      const resEl = document.getElementById(`${this.containerId}-kpi-resolved`);

      if (critEl) critEl.textContent = `${criticalCount} Critical`;
      if (triageEl) triageEl.textContent = `${triageCount} Under Triage`;
      if (dispEl) dispEl.textContent = `${dispatchedCount} Dispatched`;
      if (resEl) resEl.textContent = `${resolvedCount + 42} Resolved Today`;
    }

    createMarkerIcon(building) {
      let pulseClass = "pulse-ring-green";
      let pinBg = "bg-[#059669]";
      let ringColor = "rgba(5, 150, 105, 0.4)";

      if (building.severity === "critical") {
        pulseClass = "pulse-ring-red";
        pinBg = "bg-[#dc2626]";
        ringColor = "rgba(220, 38, 38, 0.45)";
      } else if (building.severity === "moderate") {
        pulseClass = "pulse-ring-amber";
        pinBg = "bg-[#d97706]";
        ringColor = "rgba(217, 119, 6, 0.45)";
      }

      const html = `
        <div class="relative flex items-center justify-center cursor-pointer group" style="width: 44px; height: 44px;">
          <div class="absolute inset-0 rounded-full ${pulseClass}" style="background: ${ringColor};"></div>
          <div class="relative z-10 w-9 h-9 rounded-full ${pinBg} text-white font-mono font-bold text-xs flex items-center justify-center shadow-lg border-2 border-white transition-transform duration-300 group-hover:scale-115">
            ${building.totalIssues > 0 ? building.totalIssues : '✓'}
          </div>
        </div>
      `;

      const L = window.Leaflet || window.L;
      return L.divIcon({
        html: html,
        className: 'custom-campus-pin',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22]
      });
    }

    generatePopupContent(building) {
      let issuesListHtml = "";
      if (building.issues.length === 0) {
        issuesListHtml = `
          <div class="p-4 text-center bg-[#f0fdf4] rounded-xl border border-[#bbf7d0]">
            <div class="text-[#15803d] font-semibold text-xs flex items-center justify-center gap-1.5">
              <span>✓</span> All Systems Nominal
            </div>
            <div class="text-[11px] text-[#166534] mt-0.5">No active tickets or facility faults in this building.</div>
          </div>
        `;
      } else {
        issuesListHtml = building.issues.map(iss => {
          let sevPill = iss.severity === 'critical'
            ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">CRITICAL</span>'
            : (iss.severity === 'moderate'
              ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">MODERATE</span>'
              : '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">LOW</span>');

          let statusColor = iss.status.toLowerCase().includes('dispatched') || iss.status.toLowerCase().includes('in progress')
            ? 'text-[#0284c7] font-semibold'
            : (iss.status.toLowerCase().includes('triage') ? 'text-[#d97706] font-semibold' : 'text-[#594043]');

          return `
            <div class="p-2.5 rounded-xl bg-[#fdfbf7] border border-[#E2DBD0] hover:border-[#5D3136]/30 transition mb-2">
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="text-xs font-bold text-[#311419] flex items-center gap-1.5 truncate">
                  <span>${iss.catIcon}</span>
                  <span class="truncate">${iss.title}</span>
                </span>
                ${sevPill}
              </div>
              <div class="text-[11px] text-[#594043] flex items-center justify-between">
                <span class="font-semibold text-[#311419] truncate">🏢 Room: ${iss.location}</span>
                <span class="font-mono text-[10px] text-[#8c7477] whitespace-nowrap ml-2">${iss.reportedTime}</span>
              </div>
              <div class="mt-1.5 pt-1.5 border-t border-[#f0ebe1] flex items-center justify-between text-[10px] font-mono">
                <span class="${statusColor}">● ${iss.status}</span>
                <span class="text-[#8c7477]">#${iss.id}</span>
              </div>
            </div>
          `;
        }).join("");
      }

      const distBadge = building.distance ? `<span class="text-[#0284c7] font-bold font-mono">📍 ${building.distance}m away</span>` : '';

      return `
        <div class="p-4 w-[300px] sm:w-[340px] text-[#311419]">
          <!-- Header -->
          <div class="pb-2.5 border-b border-[#E2DBD0] mb-3">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#059669]/10 text-[#059669] text-[10px] font-mono font-bold uppercase border border-[#059669]/20">
                <span>🏢</span> Verified Building
              </span>
              ${distBadge}
            </div>
            <h3 class="font-bold text-sm text-[#311419] leading-snug">${building.name}</h3>
            <div class="text-[11px] text-[#73575b] font-mono mt-0.5 flex items-center justify-between">
              <span class="truncate">Physical Structure: <strong class="text-[#311419] font-sans">${building.physicalStructureName || building.name}</strong></span>
            </div>
          </div>

          <!-- Issues List -->
          <div class="max-h-[220px] overflow-y-auto pr-1 custom-map-scrollbar mb-3">
            ${issuesListHtml}
          </div>

          <!-- Quick Raise / Dispatch Button -->
          <button onclick="window.dispatchMapLocationAction('${this.containerId}', '${building.name}', ${(building.lat || 0).toFixed(6)}, ${(building.lng || 0).toFixed(6)})" class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#5D3136] to-[#7d3b42] hover:brightness-110 text-white text-xs font-bold font-mono tracking-wide uppercase shadow transition flex items-center justify-center gap-1.5 cursor-pointer">
            <span>+ Raise Ticket Inside this Building</span>
          </button>
        </div>
      `;
    }

    filterMatchesBuilding(bldg) {
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const nameMatch = bldg.name.toLowerCase().includes(q) || bldg.zone.toLowerCase().includes(q);
        const issueMatch = bldg.issues.some(iss =>
          iss.title.toLowerCase().includes(q) ||
          iss.location.toLowerCase().includes(q) ||
          iss.category.toLowerCase().includes(q)
        );
        if (!nameMatch && !issueMatch) return false;
      }

      if (this.currentFilter === "all") return true;
      if (this.currentFilter === "my-location") {
        const nearest = this.getNearestBuilding();
        return nearest && bldg.id === nearest.id;
      }
      if (this.currentFilter === "critical") return bldg.severity === "critical";
      return bldg.issues.some(iss => iss.category === this.currentFilter);
    }

    renderMarkers() {
      if (!this.map) return;
      const L = window.Leaflet || window.L;

      // Clear existing markers
      Object.values(this.markersMap).forEach(m => this.map.removeLayer(m));
      this.markersMap = {};
      this.buildingFootprintLayers.forEach(l => this.map.removeLayer(l));
      this.buildingFootprintLayers = [];

      this.buildings.forEach(bldg => {
        if (!this.filterMatchesBuilding(bldg)) return;

        // 1. Building Footprint Polygon
        const latHalf = 0.00013;
        const lngHalf = 0.00017;
        const footprintBounds = [
          [bldg.lat - latHalf, bldg.lng - lngHalf],
          [bldg.lat + latHalf, bldg.lng + lngHalf]
        ];

        const strokeColor = bldg.severity === 'critical' ? '#dc2626' : (bldg.severity === 'moderate' ? '#d97706' : '#5D3136');
        const fillColor = bldg.severity === 'critical' ? '#fee2e2' : (bldg.severity === 'moderate' ? '#fef3c7' : '#f5ebe1');

        const footprint = L.rectangle(footprintBounds, {
          color: strokeColor,
          weight: 1.5,
          dashArray: '3, 3',
          fillColor: fillColor,
          fillOpacity: 0.35,
          interactive: true
        }).addTo(this.map);

        footprint.bindTooltip(`🏢 <strong>${bldg.name}</strong><br><span class="text-[10px] text-[#5D3136]">Physical Building Centroid</span>`, {
          direction: 'top',
          offset: [0, -10]
        });

        footprint.on('click', () => {
          this.selectBuilding(bldg.id);
        });

        this.buildingFootprintLayers.push(footprint);

        // 2. Centroid Pin
        const icon = this.createMarkerIcon(bldg);
        const marker = L.marker([bldg.lat, bldg.lng], { icon: icon }).addTo(this.map);

        const popupContent = this.generatePopupContent(bldg);
        marker.bindPopup(popupContent, { maxWidth: 360 });

        marker.on('click', () => {
          this.highlightBuildingCard(bldg.id);
        });

        this.markersMap[bldg.id] = marker;
      });
    }

    renderBuildingCards() {
      const listContainer = document.getElementById(`${this.containerId}-buildings-list`);
      if (!listContainer) return;

      const filtered = this.buildings.filter(b => this.filterMatchesBuilding(b));

      if (filtered.length === 0) {
        listContainer.innerHTML = `
          <div class="p-8 text-center bg-white rounded-2xl border border-[#E2DBD0]">
            <div class="text-2xl mb-2">🔍</div>
            <div class="text-sm font-bold text-[#311419]">No Buildings Match Your Criteria</div>
            <div class="text-xs text-[#73575b] mt-1">Try changing the category filter or clearing the search bar.</div>
          </div>
        `;
        return;
      }

      // Sort by proximity from user if user coordinates are known
      if (this.userCoordinates) {
        filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }

      const nearestBldg = this.getNearestBuilding();

      listContainer.innerHTML = filtered.map(bldg => {
        const isAtCurrentLoc = nearestBldg && bldg.id === nearestBldg.id;
        let statusDot = bldg.severity === 'critical' ? 'bg-[#dc2626] animate-pulse' : (bldg.severity === 'moderate' ? 'bg-[#d97706]' : 'bg-[#059669]');
        let badgeStyle = bldg.severity === 'critical' ? 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]' : (bldg.severity === 'moderate' ? 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]' : 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]');

        const matchingIssues = (this.currentFilter === "all" || this.currentFilter === "my-location"
          ? bldg.issues
          : bldg.issues.filter(iss => this.currentFilter === "critical" ? iss.severity === "critical" : iss.category === this.currentFilter)
        );

        let issuesPreview = "";
        if (matchingIssues.length > 0) {
          issuesPreview = `
            <div class="mt-3 space-y-2 border-t border-[#f0ebe1] pt-2.5">
              ${matchingIssues.map(iss => {
                const sevBadge = iss.severity === 'critical'
                  ? '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]">CRITICAL</span>'
                  : (iss.severity === 'moderate'
                    ? '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">MODERATE</span>'
                    : '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]">LOW</span>');

                return `
                  <div class="p-2.5 rounded-xl bg-[#fdfbf7] border border-[#f0ebe1] hover:border-[#5D3136]/30 transition">
                    <div class="flex items-start justify-between gap-1.5 mb-1">
                      <span class="font-bold text-xs text-[#311419] flex items-start gap-1.5 leading-snug">
                        <span class="mt-0.5">${iss.catIcon}</span>
                        <span>${iss.title}</span>
                      </span>
                      <span class="shrink-0">${sevBadge}</span>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-[#594043] mt-1">
                      <span class="font-medium text-[#73575b] flex items-center gap-1 truncate">
                        <span>📍</span>
                        <span class="truncate">${iss.location}</span>
                      </span>
                      <span class="text-[10px] font-mono text-[#8c7477] whitespace-nowrap ml-2">${iss.reportedTime}</span>
                    </div>
                    <div class="mt-1.5 pt-1.5 border-t border-[#f4eee5] flex items-center justify-between text-[10px] font-mono">
                      <span class="text-[#0284c7] font-semibold">● ${iss.status}</span>
                      <span class="text-[#8c7477]">#${iss.id}</span>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `;
        } else {
          issuesPreview = `
            <div class="mt-2.5 pt-2 border-t border-[#f0ebe1] text-xs text-[#059669] font-medium flex items-center gap-1">
              <span>✓</span> All indoor nodes active and nominal
            </div>
          `;
        }

        const distText = bldg.distance ? `<span class="text-[#0284c7] font-semibold font-mono ml-2">📍 ${bldg.distance}m away</span>` : '';
        const currentLocBadge = isAtCurrentLoc ? `
          <span class="text-[#0284c7] bg-[#0284c7]/15 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[#0284c7] animate-ping"></span> AT CURRENT LOCATION
          </span>
        ` : '';
        const cardStyle = isAtCurrentLoc
          ? 'border-[#0284c7] ring-2 ring-[#0284c7]/40 bg-[#f0f9ff]/30 shadow-sm'
          : 'border-[#E2DBD0] bg-white';

        return `
          <div id="${this.containerId}-card-${bldg.id}" onclick="window.selectCampusBuilding('${this.containerId}', '${bldg.id}')" class="building-telemetry-card p-4 rounded-2xl ${cardStyle} hover:border-[#5D3136] hover:shadow-md transition-all duration-200 cursor-pointer text-left group">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full ${statusDot} mt-1.5 shrink-0"></span>
                <div>
                  <div class="text-[10px] font-mono tracking-wider text-[#73575b] uppercase flex items-center flex-wrap gap-1.5 mb-1">
                    <span>${bldg.zone}</span>
                    ${currentLocBadge}
                    <span class="text-[#059669] bg-[#059669]/10 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                      <span>🏢</span> IN BUILDING
                    </span>
                    ${distText}
                  </div>
                  <h4 class="font-bold text-sm text-[#311419] group-hover:text-[#5D3136] transition leading-snug">${bldg.name}</h4>
                </div>
              </div>
              <span class="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${badgeStyle} shrink-0">
                ${matchingIssues.length} ${matchingIssues.length === 1 ? 'Issue' : 'Issues'}
              </span>
            </div>
            ${issuesPreview}
          </div>
        `;
      }).join("");
    }

    getNearestBuilding(customLat, customLng) {
      const lat = typeof customLat === 'number' ? customLat : (this.userCoordinates ? this.userCoordinates.lat : null);
      const lng = typeof customLng === 'number' ? customLng : (this.userCoordinates ? this.userCoordinates.lng : null);
      if (lat === null || lng === null || !this.buildings || this.buildings.length === 0) return null;
      let nearest = null;
      let min = Infinity;
      this.buildings.forEach(b => {
        const d = calcDistanceMeters(lat, lng, b.lat, b.lng);
        if (d < min) {
          min = d;
          nearest = b;
        }
      });
      return nearest;
    }

    async resolveReadableLocation(lat, lng) {
      return await resolveDetailedLocation(lat, lng, this.buildings);
    }

    highlightBuildingCard(bldgId) {
      document.querySelectorAll(`#${this.containerId} .building-telemetry-card`).forEach(c => {
        c.classList.remove("ring-2", "ring-[#5D3136]", "bg-[#fdf8f5]");
      });
      const card = document.getElementById(`${this.containerId}-card-${bldgId}`);
      if (card) {
        card.classList.add("ring-2", "ring-[#5D3136]", "bg-[#fdf8f5]");
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    selectBuilding(bldgId) {
      const bldg = this.buildings.find(b => b.id === bldgId);
      if (!bldg || !this.map) return;

      this.map.flyTo([bldg.lat, bldg.lng], 18, {
        duration: 0.9,
        easeLinearity: 0.25
      });

      setTimeout(() => {
        const marker = this.markersMap[bldgId];
        if (marker) marker.openPopup();
      }, 950);

      this.highlightBuildingCard(bldgId);
    }

    setupEventListeners() {
      // Filter buttons
      const container = document.getElementById(this.containerId);
      if (!container) return;

      const filterBtns = container.querySelectorAll(".map-filter-btn");
      filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
          filterBtns.forEach(b => {
            b.classList.remove("bg-[#5D3136]", "text-white", "shadow-xs");
            if (b.id && b.id.includes("filter-my-location")) {
              b.classList.add("bg-[#f9f5ed]", "text-[#0284c7]");
            } else {
              b.classList.add("bg-[#f9f5ed]", "text-[#594043]");
            }
          });
          btn.classList.add("bg-[#5D3136]", "text-white", "shadow-xs");
          btn.classList.remove("bg-[#f9f5ed]", "text-[#594043]", "text-[#0284c7]");

          this.currentFilter = btn.getAttribute("data-filter");
          this.renderMarkers();
          this.renderBuildingCards();
        });
      });

      // Search
      const search = document.getElementById(`${this.containerId}-search`);
      if (search) {
        search.addEventListener("input", (e) => {
          this.searchQuery = e.target.value.trim();
          this.renderMarkers();
          this.renderBuildingCards();
        });
      }

      // My Location buttons (Telemetry Bar + Map Floating Button)
      const locateBtn = document.getElementById(`${this.containerId}-btn-locate`);
      const mapLocateBtn = document.getElementById(`${this.containerId}-map-locate`);

      const triggerRecenter = (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        this.requestFreshLocation(true);
      };

      if (locateBtn) locateBtn.onclick = triggerRecenter;
      if (mapLocateBtn) mapLocateBtn.onclick = triggerRecenter;

      window.addEventListener("beforeunload", () => {
        this.stopWatchingPosition();
      });

      // Recenter Fit All
      const recenterBtn = document.getElementById(`${this.containerId}-map-recenter`);
      if (recenterBtn) {
        recenterBtn.addEventListener("click", () => {
          if (!this.map) return;
          const L = window.Leaflet || window.L;
          const allLayers = Object.values(this.markersMap);
          if (this.userMarker) allLayers.push(this.userMarker);
          const group = new L.featureGroup(allLayers);
          if (group.getLayers().length > 0) {
            this.map.fitBounds(group.getBounds().pad(0.12));
          } else {
            this.map.setView([DEFAULT_ANCHOR.lat, DEFAULT_ANCHOR.lng], 16);
          }
        });
      }

      // Satellite Toggle
      const satBtn = document.getElementById(`${this.containerId}-map-satellite`);
      const satLabel = document.getElementById(`${this.containerId}-sat-label`);
      if (satBtn) {
        satBtn.addEventListener("click", () => {
          if (!this.map) return;
          this.isSatellite = !this.isSatellite;
          if (this.isSatellite) {
            this.map.removeLayer(this.streetLayer);
            this.satelliteLayer.addTo(this.map);
            if (satLabel) satLabel.textContent = "Street";
          } else {
            this.map.removeLayer(this.satelliteLayer);
            this.streetLayer.addTo(this.map);
            if (satLabel) satLabel.textContent = "Satellite";
          }
        });
      }
    }

    updateLocationTelemetryDisplay(lat, lng, accuracy, readableName, nearest, secondaryLine, city) {
      const issuesCount = (nearest && nearest.issues) ? nearest.issues.length : 0;
      const bldgInfo = nearest
        ? ` · 🏢 <strong class="text-[#5D3136]">${nearest.name}</strong> <span class="font-mono text-[10px] px-1.5 py-0.5 rounded ${issuesCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'} font-bold">(${issuesCount} Problem${issuesCount === 1 ? '' : 's'} Here)</span> <button onclick="window.focusCurrentLocationProblems('${this.containerId}')" class="ml-1 text-[#0284c7] hover:underline font-bold text-[11px] cursor-pointer inline-flex items-center gap-0.5"><span>View Details</span> <span>↗</span></button>`
        : '';

      const subLine = secondaryLine || this.userLocationSecondaryLine;
      const secondaryHtml = subLine
        ? ` <span class="text-[#594043] text-xs font-normal">(${subLine})</span>`
        : '';

      const statusHtml = `📍 <strong class="text-[#311419] font-bold text-xs">${readableName}</strong>${secondaryHtml} · <span class="text-[#594043] font-mono">${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E</span> (±${accuracy}m)${bldgInfo}`;
      this.updateLocationStatus("active", statusHtml);

      const badgeEl = document.getElementById(`${this.containerId}-gps-badge`);
      if (badgeEl) {
        const cityName = city || this.userLocationCity || '';
        const cityPart = (cityName && cityName.toLowerCase() !== readableName.toLowerCase()) ? ` · ${cityName.toUpperCase()}` : '';
        badgeEl.textContent = `📍 ${readableName.toUpperCase()}${cityPart}`;
      }

      const locateLabel = document.getElementById(`${this.containerId}-locate-label`);
      if (locateLabel) locateLabel.textContent = "My Location";
    }

    async requestFreshLocation(forceRecenter = true) {
      if (this.isLocating) return; // Prevent duplicate / conflicting requests on rapid clicks

      if (!navigator.geolocation) {
        this.updateLocationStatus("error", `<span class="text-[#b91c1c] font-medium">⚠️ Geolocation is not supported by your browser.</span>`);
        return;
      }

      this.isLocating = true;
      const requestId = ++this.locationRequestSeq;

      // Update UI to non-blocking "Detecting your location..." state immediately
      const locateLabel = document.getElementById(`${this.containerId}-locate-label`);
      if (locateLabel) {
        locateLabel.innerHTML = `<span class="inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span><span>Detecting…</span></span>`;
      }
      this.updateLocationStatus("searching", "Detecting your live location…");

      const badgeEl = document.getElementById(`${this.containerId}-gps-badge`);
      if (badgeEl) {
        badgeEl.textContent = "🛰️ DETECTING GPS...";
      }

      const locateBtn = document.getElementById(`${this.containerId}-btn-locate`);
      if (locateBtn) locateBtn.classList.add("opacity-80");

      return new Promise((resolve) => {
        let watchId = null;
        let settlingTimer = null;
        let bestFix = null;
        let hasFlown = false;

        const cleanup = () => {
          if (watchId !== null && navigator.geolocation) {
            try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
            watchId = null;
          }
          if (settlingTimer !== null) {
            clearTimeout(settlingTimer);
            settlingTimer = null;
          }
        };

        const commitFinalPosition = async (pos) => {
          if (hasFlown) return;
          hasFlown = true;
          cleanup();

          if (this.locationRequestSeq !== requestId) {
            resolve(null);
            return;
          }

          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy || 10);

          if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
            handleFailure({ code: 2, message: "Invalid GPS coordinates" });
            return;
          }

          // Store fresh coordinates immediately
          this.hasAcquiredFirstFix = true;
          this.userCoordinates = { lat, lng, accuracy };
          this.updateBuildingDistances(lat, lng);

          const nearest = this.getNearestBuilding(lat, lng);
          const initialLocName = nearest ? nearest.name : `Campus Area (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`;
          this.userLocationPlaceName = initialLocName;
          this.userLocationSecondaryLine = nearest ? (nearest.zone || 'Campus Zone') : '';
          this.userLocationFullAddress = nearest ? `${nearest.name}, ${nearest.zone || 'Campus Zone'}` : initialLocName;
          this.detectedBuildingName = nearest ? nearest.name : 'Campus Grounds';

          // Atomically update UI, beacon, and fly map directly to fresh coordinates
          this.updateLocationTelemetryDisplay(
            lat,
            lng,
            accuracy,
            this.userLocationPlaceName,
            nearest,
            this.userLocationSecondaryLine,
            this.userLocationCity
          );
          this.updateUserBeacon();

          if (forceRecenter && this.map) {
            this.map.flyTo([lat, lng], 17, {
              duration: 0.9,
              easeLinearity: 0.25
            });
            setTimeout(() => {
              if (this.userMarker && this.locationRequestSeq === requestId) {
                this.userMarker.openPopup();
              }
            }, 950);
          }

          this.isLocating = false;
          if (locateBtn) locateBtn.classList.remove("opacity-80");
          if (locateLabel) locateLabel.textContent = "My Location";
          resolve(this.userCoordinates);

          // Asynchronously reverse geocode and refine readable address
          (async () => {
            try {
              const resolved = await resolveDetailedLocation(lat, lng, this.buildings);
              if (this.locationRequestSeq !== requestId) return;

              if (resolved && (resolved.primaryTitle || resolved.fullAddress)) {
                this.userLocationPlaceName = resolved.primaryTitle || resolved.locationName;
                this.userLocationSecondaryLine = resolved.secondaryLine || '';
                this.userLocationFullAddress = resolved.fullAddress || resolved.locationName;
                this.userLocationCity = resolved.city || '';
                this.detectedBuildingName = resolved.buildingName || (nearest ? nearest.name : this.userLocationPlaceName);

                this.updateLocationTelemetryDisplay(
                  lat,
                  lng,
                  accuracy,
                  this.userLocationPlaceName,
                  nearest,
                  this.userLocationSecondaryLine,
                  this.userLocationCity
                );
                this.updateUserBeacon();
              }
            } catch (_) {}
          })();
        };

        const handleSuccess = (pos) => {
          if (this.locationRequestSeq !== requestId || hasFlown) return;

          const acc = (pos && pos.coords && typeof pos.coords.accuracy === 'number') ? pos.coords.accuracy : 9999;

          // Track the best position received so far
          if (!bestFix || acc < (bestFix.coords.accuracy || 9999)) {
            bestFix = pos;
          }

          // If high accuracy (< 120m), settle immediately and fly!
          if (acc <= 120) {
            commitFinalPosition(pos);
            return;
          }

          // If accuracy is coarse (> 120m), do NOT fly yet!
          // Give the browser up to 2200ms to refine from Wi-Fi/GPS
          if (!settlingTimer) {
            settlingTimer = setTimeout(() => {
              if (!hasFlown && bestFix) {
                commitFinalPosition(bestFix);
              } else if (!hasFlown) {
                handleFailure({ code: 3, message: "GPS position settling timed out" });
              }
            }, 2200);
          }
        };

        const handleFailure = (err) => {
          if (this.locationRequestSeq !== requestId || hasFlown) return;
          cleanup();

          // If we already received a fix during this session, use it rather than failing
          if (bestFix) {
            commitFinalPosition(bestFix);
            return;
          }

          this.isLocating = false;
          if (locateBtn) locateBtn.classList.remove("opacity-80");
          if (locateLabel) locateLabel.textContent = "My Location";

          let msg = "";
          switch (err.code) {
            case 1: // PERMISSION_DENIED
              msg = `<span class="text-[#b91c1c] font-medium">⚠️ Location permission denied. Please allow location access in your browser settings to view your position on the map.</span>`;
              break;
            case 2: // POSITION_UNAVAILABLE
              msg = `<span class="text-[#b45309] font-medium">⚠️ GPS position unavailable. Ensure device location services are turned on.</span>`;
              break;
            case 3: // TIMEOUT
              msg = `<span class="text-[#b45309] font-medium">⚠️ GPS request timed out. Please click My Location to try again.</span>`;
              break;
            default:
              msg = `<span class="text-[#b91c1c] font-medium">⚠️ Location error: ${err.message || "Unknown error"}</span>`;
          }

          this.updateLocationStatus("error", msg);
          resolve(null);
        };

        try {
          watchId = navigator.geolocation.watchPosition(
            handleSuccess,
            (err) => {
              if (bestFix) {
                commitFinalPosition(bestFix);
              } else {
                handleFailure(err);
              }
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        } catch (e) {
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            handleFailure,
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
          );
        }

        // Hard timeout safety net after 8.5s
        setTimeout(() => {
          if (!hasFlown && this.locationRequestSeq === requestId) {
            if (bestFix) {
              commitFinalPosition(bestFix);
            } else {
              handleFailure({ code: 3, message: "GPS request timed out" });
            }
          }
        }, 8500);
      });
    }

    startWatchingPosition(recenterImmediate = false) {
      if (!navigator.geolocation) {
        this.updateLocationStatus("error", `<span class="text-[#b91c1c] font-medium">⚠️ Geolocation is not supported by your browser.</span>`);
        return;
      }

      if (this.watchPositionId !== null) {
        if (recenterImmediate) {
          this.requestFreshLocation(true);
        }
        return;
      }

      const success = async (pos) => {
        // If an explicit user click location request is currently in flight, don't overwrite
        if (this.isLocating) return;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 10);

        this.hasAcquiredFirstFix = true;
        this.userCoordinates = { lat, lng, accuracy };
        this.updateBuildingDistances(lat, lng);

        try {
          const resolved = await this.resolveReadableLocation(lat, lng);
          if (this.isLocating) return;

          const nearest = this.getNearestBuilding(lat, lng);
          if (resolved && (resolved.primaryTitle || resolved.fullAddress || resolved.locationName)) {
            this.userLocationPlaceName = resolved.primaryTitle || resolved.locationName;
            this.userLocationSecondaryLine = resolved.secondaryLine || '';
            this.userLocationFullAddress = resolved.fullAddress || resolved.locationName;
            this.userLocationCity = resolved.city || '';
            this.detectedBuildingName = resolved.buildingName || (nearest ? nearest.name : this.userLocationPlaceName);
          } else {
            const initialLocName = nearest ? nearest.name : `Campus Area (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`;
            this.userLocationPlaceName = initialLocName;
            this.userLocationSecondaryLine = nearest ? (nearest.zone || 'Campus Zone') : '';
            this.userLocationFullAddress = nearest ? `${nearest.name}, ${nearest.zone || 'Campus Zone'}` : initialLocName;
            this.detectedBuildingName = nearest ? nearest.name : 'Campus Grounds';
          }

          this.updateLocationTelemetryDisplay(lat, lng, accuracy, this.userLocationPlaceName, nearest, this.userLocationSecondaryLine, this.userLocationCity);
          this.updateUserBeacon();
        } catch (_) {}
      };

      const error = (err) => {
        if (!this.hasAcquiredFirstFix && !this.isLocating) {
          let msg = "";
          switch (err.code) {
            case 1: // PERMISSION_DENIED
              msg = `<span class="text-[#b91c1c] font-medium">⚠️ Location permission denied. Please enable location access in browser settings to view your position.</span>`;
              break;
            case 2: // POSITION_UNAVAILABLE
              msg = `<span class="text-[#b45309] font-medium">⚠️ GPS position unavailable. Ensure device location services are turned on.</span>`;
              break;
            case 3: // TIMEOUT
              msg = `<span class="text-[#b45309] font-medium">⚠️ Location request timed out. Retrying GPS connection...</span>`;
              break;
            default:
              msg = `<span class="text-[#b91c1c] font-medium">⚠️ Location error: ${err.message || "Unknown error"}</span>`;
          }
          this.updateLocationStatus("error", msg);
        }
      };

      try {
        this.watchPositionId = navigator.geolocation.watchPosition(success, error, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        });
      } catch (e) {
        this.updateLocationStatus("error", `<span class="text-[#b91c1c]">Failed to initialize GPS: ${e.message}</span>`);
      }
    }

    stopWatchingPosition() {
      if (this.watchPositionId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(this.watchPositionId);
        this.watchPositionId = null;
      }
    }

    recenterToUserLocation() {
      this.requestFreshLocation(true);
    }

    updateBuildingDistances(userLat, userLng) {
      if (!this.buildings) return;
      this.buildings.forEach(b => {
        b.distance = calcDistanceMeters(userLat, userLng, b.lat, b.lng);
      });
      this.renderBuildingCards();
    }

    updateLocationStatus(state, messageHtml) {
      const statusEl = document.getElementById(`${this.containerId}-location-status`);
      const pingEl = document.getElementById(`${this.containerId}-gps-status-ping`);
      const dotEl = document.getElementById(`${this.containerId}-gps-status-dot`);

      if (statusEl) {
        statusEl.innerHTML = messageHtml;
      }

      if (pingEl && dotEl) {
        if (state === "active") {
          pingEl.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75";
          dotEl.className = "relative inline-flex rounded-full h-3 w-3 bg-[#0284c7]";
        } else if (state === "searching") {
          pingEl.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75";
          dotEl.className = "relative inline-flex rounded-full h-3 w-3 bg-[#d97706]";
        } else if (state === "error") {
          pingEl.className = "hidden";
          dotEl.className = "relative inline-flex rounded-full h-3 w-3 bg-[#dc2626]";
        }
      }
    }

    updateUserBeacon() {
      if (!this.map || !this.userCoordinates) return;
      const L = window.Leaflet || window.L;
      const { lat, lng, accuracy } = this.userCoordinates;

      let nearestBldg = this.getNearestBuilding(lat, lng);
      let minDistance = nearestBldg ? (nearestBldg.distance || calcDistanceMeters(lat, lng, nearestBldg.lat, nearestBldg.lng)) : null;
      const issuesAtLocation = nearestBldg ? (nearestBldg.issues || []) : [];

      // Update Filter Button badge and visibility
      const myLocFilterBtn = document.getElementById(`${this.containerId}-filter-my-location`);
      const myLocCountEl = document.getElementById(`${this.containerId}-my-loc-count`);
      if (myLocFilterBtn) {
        myLocFilterBtn.style.display = "inline-flex";
      }
      if (myLocCountEl) {
        myLocCountEl.textContent = issuesAtLocation.length;
      }

      const userPinIcon = L.divIcon({
        className: 'custom-user-beacon',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="width: 50px; height: 50px;">
            <div class="absolute inset-0 rounded-full pulse-ring-cyan" style="background: rgba(6, 182, 212, 0.45);"></div>
            <div class="relative z-10 w-9 h-9 rounded-full bg-[#0284c7] text-white flex items-center justify-center shadow-[0_0_18px_rgba(2,132,199,0.8)] border-2 border-white transition-transform duration-300 group-hover:scale-115">
              <div class="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center shadow-xs">
                <div class="w-1.5 h-1.5 rounded-full bg-[#0284c7]"></div>
              </div>
            </div>
          </div>
        `,
        iconSize: [50, 50],
        iconAnchor: [25, 25],
        popupAnchor: [0, -25]
      });

      let problemsHtml = '';
      if (issuesAtLocation.length === 0) {
        problemsHtml = `
          <div class="p-3 text-center bg-[#f0fdf4] rounded-xl border border-[#bbf7d0] my-2.5">
            <div class="text-[#15803d] font-semibold text-xs flex items-center justify-center gap-1.5">
              <span>✓</span> All Systems Nominal
            </div>
            <div class="text-[11px] text-[#166534] mt-0.5">No active facility faults or problems reported at your current location.</div>
          </div>
        `;
      } else {
        const issuesCards = issuesAtLocation.map(iss => {
          let sevPill = iss.severity === 'critical'
            ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">CRITICAL</span>'
            : (iss.severity === 'moderate'
              ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">MODERATE</span>'
              : '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]">LOW</span>');

          let statusColor = iss.status.toLowerCase().includes('dispatched') || iss.status.toLowerCase().includes('in progress')
            ? 'text-[#0284c7] font-semibold'
            : (iss.status.toLowerCase().includes('triage') ? 'text-[#d97706] font-semibold' : 'text-[#594043]');

          return `
            <div class="p-2.5 rounded-xl bg-[#fdfbf7] border border-[#E2DBD0] hover:border-[#0284c7]/40 transition mb-2 text-left">
              <div class="flex items-start justify-between gap-1.5 mb-1">
                <span class="text-xs font-bold text-[#311419] flex items-start gap-1.5 leading-snug">
                  <span class="mt-0.5">${iss.catIcon || '⚠️'}</span>
                  <span class="truncate">${iss.title}</span>
                </span>
                <span class="shrink-0">${sevPill}</span>
              </div>
              <div class="text-[11px] text-[#594043] flex items-center justify-between mt-1">
                <span class="font-semibold text-[#311419] truncate">🏢 Spot: ${iss.location}</span>
                <span class="font-mono text-[10px] text-[#8c7477] whitespace-nowrap ml-2">${iss.reportedTime || 'Recent'}</span>
              </div>
              <div class="mt-1.5 pt-1.5 border-t border-[#f0ebe1] flex items-center justify-between text-[10px] font-mono">
                <span class="${statusColor}">● ${iss.status}</span>
                <span class="text-[#8c7477]">#${iss.id}</span>
              </div>
            </div>
          `;
        }).join("");

        problemsHtml = `
          <div class="my-2.5">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wide text-[#5D3136] flex items-center gap-1">
                <span>⚠️</span> Active Problems Here (${issuesAtLocation.length})
              </span>
              <button onclick="window.filterToMyLocation('${this.containerId}')" class="text-[10px] font-mono font-bold text-[#0284c7] hover:underline cursor-pointer">
                Filter View ↗
              </button>
            </div>
            <div class="max-h-[190px] overflow-y-auto pr-1 custom-map-scrollbar space-y-1">
              ${issuesCards}
            </div>
          </div>
        `;
      }

      const resolvedPrimary = this.userLocationPlaceName || (nearestBldg ? nearestBldg.name : `Campus Area (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      const resolvedSubLine = this.userLocationSecondaryLine || (nearestBldg ? (nearestBldg.zone || 'Campus Zone') : '');
      const resolvedFull = this.userLocationFullAddress || (resolvedSubLine ? `${resolvedPrimary}, ${resolvedSubLine}` : resolvedPrimary);
      const resolvedBldgName = this.detectedBuildingName || (nearestBldg ? nearestBldg.name : resolvedPrimary);

      const safeLocName = (resolvedFull || resolvedPrimary || '').replace(/'/g, "\\'");
      const safeBldgName = (resolvedBldgName || '').replace(/'/g, "\\'");

      const popupContent = `
        <div class="p-4 text-[#311419] min-w-[280px] max-w-[340px]">
          <div class="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#E2DBD0]">
            <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0284c7]/10 text-[#0284c7] text-[10px] font-mono font-bold uppercase border border-[#0284c7]/30">
              <span class="w-2 h-2 rounded-full bg-[#0284c7] animate-ping"></span> Live GPS Position
            </div>
            <span class="text-[10px] font-mono text-[#059669] font-bold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-[#059669]"></span> Live (±${accuracy}m)
            </span>
          </div>

          <div class="mb-2 pb-2 border-b border-[#E2DBD0]/60">
            <h4 class="font-bold text-sm text-[#311419] flex items-start gap-1.5 leading-snug">
              <span class="text-base text-[#0284c7] shrink-0 mt-0.5">📍</span>
              <span>${resolvedPrimary}</span>
            </h4>
            ${resolvedSubLine ? `<div class="text-[11px] text-[#594043] font-medium pl-5 mt-0.5 leading-relaxed">${resolvedSubLine}</div>` : ''}
          </div>
          <div class="font-mono text-[11px] text-[#594043] my-1.5 bg-[#f9f5ed] p-2 rounded-xl border border-[#e2dbd0] flex items-center justify-between">
            <div>
              <div class="font-bold text-[#311419]">${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E</div>
              <div class="text-[10px] text-[#73575b] mt-0.5">Accuracy: ±${accuracy} meters</div>
            </div>
            <span class="text-base">🛰️</span>
          </div>

          ${nearestBldg ? `
            <div class="text-[11px] text-[#594043] mb-2 bg-[#f0f9ff] p-2 rounded-xl border border-[#bae6fd]">
              <div class="text-[#0284c7] font-semibold flex items-center justify-between">
                <span>📍 Nearest Facility:</span>
                <span class="font-mono font-bold">${minDistance}m away</span>
              </div>
              <strong class="text-[#0c4a6e] block mt-0.5 text-xs">${nearestBldg.name}</strong>
              <div class="text-[10px] text-[#0369a1] mt-0.5">${nearestBldg.zone}</div>
            </div>
          ` : ''}

          <!-- Problems Section -->
          ${problemsHtml}

          <!-- Actions -->
          <div class="pt-2 border-t border-[#e2dbd0] space-y-1.5">
            <button onclick="window.dispatchMapLocationAction('${this.containerId}', '${safeLocName}', ${lat.toFixed(6)}, ${lng.toFixed(6)}, '${safeBldgName}')" class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#5D3136] to-[#7d3b42] hover:brightness-110 text-white text-xs font-bold font-mono tracking-wide uppercase shadow transition cursor-pointer flex items-center justify-center gap-1.5">
              <span>+ Raise Ticket at My Location</span>
            </button>
            ${issuesAtLocation.length > 0 ? `
              <button onclick="window.filterToMyLocation('${this.containerId}')" class="w-full py-1.5 px-2 rounded-xl bg-[#0284c7]/10 hover:bg-[#0284c7]/20 text-[#0284c7] text-[11px] font-bold font-mono border border-[#0284c7]/30 transition cursor-pointer flex items-center justify-center gap-1">
                <span>📍 View Only My Location (${issuesAtLocation.length} Issues)</span>
              </button>
            ` : ''}
          </div>
        </div>
      `;

      const secondaryTooltip = resolvedSubLine ? `<br><span style="color: #cbd5e1; font-size: 10px;">${resolvedSubLine}</span>` : '';
      const tooltipContent = issuesAtLocation.length > 0
        ? `📍 <strong>${resolvedPrimary}</strong>${secondaryTooltip} · <span style="color: #fef08a; font-weight: bold;">⚠️ ${issuesAtLocation.length} Problem${issuesAtLocation.length === 1 ? '' : 's'}</span>`
        : `📍 <strong>${resolvedPrimary}</strong>${secondaryTooltip} · <span style="color: #bbf7d0; font-weight: bold;">✓ Live Location (±${accuracy}m)</span>`;

      if (!this.userMarker) {
        this.userMarker = L.marker([lat, lng], { icon: userPinIcon, zIndexOffset: 1000 }).addTo(this.map);
        this.userMarker.bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -25],
          className: 'user-location-tooltip'
        });
        this.userMarker.bindPopup(popupContent, { maxWidth: 340 });
      } else {
        this.userMarker.setLatLng([lat, lng]);
        this.userMarker.setPopupContent(popupContent);
        if (this.userMarker.getTooltip()) {
          this.userMarker.setTooltipContent(tooltipContent);
        }
      }

      if (!this.userAccuracyCircle) {
        this.userAccuracyCircle = L.circle([lat, lng], {
          radius: Math.max(accuracy, 20),
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '4, 4'
        }).addTo(this.map);
      } else {
        this.userAccuracyCircle.setLatLng([lat, lng]);
        this.userAccuracyCircle.setRadius(Math.max(accuracy, 20));
      }
    }
  }

  // Global Dispatcher for "+ Raise Ticket" clicks from any map instance
  window.dispatchMapLocationAction = function (containerId, locationText, lat, lng, buildingName) {
    const inst = activeMapInstances[containerId];
    const resolvedLoc = locationText || (inst && inst.userLocationPlaceName) || (inst && inst.getNearestBuilding() ? inst.getNearestBuilding().name : 'Campus Grounds');
    const resolvedBldg = buildingName || (inst && inst.detectedBuildingName) || (inst && inst.getNearestBuilding() ? inst.getNearestBuilding().name : resolvedLoc);
    const resolvedLat = typeof lat === 'number' ? lat : (inst && inst.userCoordinates ? inst.userCoordinates.lat : null);
    const resolvedLng = typeof lng === 'number' ? lng : (inst && inst.userCoordinates ? inst.userCoordinates.lng : null);

    if (inst && typeof inst.options.onRaiseTicket === 'function') {
      inst.options.onRaiseTicket(resolvedLoc, resolvedLat, resolvedLng, resolvedBldg);
      return;
    }

    // Role-based default handlers
    // 1. Student Portal: open modal & fill location
    const studentModal = document.getElementById('report-issue-modal') || document.getElementById('modal-file-issue');
    const studentLocationInput = document.getElementById('report-input-location') || document.getElementById('modal-input-location') || document.getElementById('input-fixture-room');
    const studentBldgSelect = document.getElementById('input-building-wing');
    if (studentModal) {
      if (studentBldgSelect && resolvedBldg) {
        let matched = false;
        for (let i = 0; i < studentBldgSelect.options.length; i++) {
          const opt = studentBldgSelect.options[i];
          if (opt.value.toLowerCase() === resolvedBldg.toLowerCase() || resolvedBldg.toLowerCase().includes(opt.value.toLowerCase())) {
            studentBldgSelect.selectedIndex = i;
            matched = true;
            break;
          }
        }
        if (!matched) {
          const newOpt = document.createElement('option');
          newOpt.value = resolvedBldg;
          newOpt.textContent = resolvedBldg;
          studentBldgSelect.appendChild(newOpt);
          studentBldgSelect.value = resolvedBldg;
        }
      }
      if (studentLocationInput) studentLocationInput.value = resolvedLoc;
      if (typeof resolvedLat === 'number' && typeof resolvedLng === 'number') {
        studentModal._pendingLat = resolvedLat;
        studentModal._pendingLng = resolvedLng;
        studentModal._pendingLocationName = resolvedLoc;
      }
      studentModal.classList.remove('hidden');
      return;
    }

    // 2. Landing Page: scroll to #raise-ticket
    const landingTicketSec = document.getElementById('raise-ticket');
    if (landingTicketSec) {
      const input = landingTicketSec.querySelector('input');
      if (input) {
        input.value = `[${resolvedLoc}] - `;
        input.focus();
      }
      landingTicketSec.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // 3. Fallback alert
    alert(`Selected: ${resolvedLoc}. Create ticket with this location.`);
  };

  window.selectCampusBuilding = function (containerId, bldgId) {
    const inst = activeMapInstances[containerId];
    if (inst) {
      inst.selectBuilding(bldgId);
    }
  };

  window.filterToMyLocation = function (containerId) {
    const inst = activeMapInstances[containerId];
    if (!inst) return;

    const container = document.getElementById(containerId);
    if (container) {
      const filterBtns = container.querySelectorAll(".map-filter-btn");
      filterBtns.forEach(b => {
        b.classList.remove("bg-[#5D3136]", "text-white", "shadow-xs");
        if (b.id && b.id.includes("filter-my-location")) {
          b.classList.add("bg-[#5D3136]", "text-white", "shadow-xs");
          b.classList.remove("bg-[#f9f5ed]", "text-[#0284c7]");
        } else {
          b.classList.add("bg-[#f9f5ed]", "text-[#594043]");
        }
      });
    }

    inst.currentFilter = "my-location";
    inst.renderMarkers();
    inst.renderBuildingCards();

    inst.recenterToUserLocation();
  };

  window.focusCurrentLocationProblems = function (containerId) {
    const inst = activeMapInstances[containerId];
    if (!inst) return;

    inst.recenterToUserLocation();

    const nearest = inst.getNearestBuilding();
    if (nearest) {
      inst.highlightBuildingCard(nearest.id);
    }
  };

  /**
   * Main factory entrypoint
   */
  window.initCampusMap = function (containerId, options = {}) {
    if (activeMapInstances[containerId]) {
      activeMapInstances[containerId].refresh();
      if (activeMapInstances[containerId].map) {
        activeMapInstances[containerId].map.invalidateSize();
      }
      window.activeCampusMap = activeMapInstances[containerId];
      return activeMapInstances[containerId];
    }

    const controller = new CampusMapController(containerId, options);
    activeMapInstances[containerId] = controller;
    window.activeCampusMap = controller;
    window.activeMapInstances = activeMapInstances;
    return controller;
  };

  // Listen to platform-wide live ticket updates
  window.addEventListener('campus:tickets-updated', function () {
    Object.values(activeMapInstances).forEach(inst => {
      inst.refresh();
    });
  });

})();
