/**
 * CAMP(US)FIX — CAMPUS AI & DATA ANALYSIS ENGINE (campus-ai.js)
 * 
 * Provides real-time automated intelligence for campus infrastructure telemetry:
 * 1. Semantic Duplicate & Recurrence Detection
 * 2. Multi-Factor Algorithmic Priority Scoring (0-100)
 * 3. Natural Language Department Routing & Auto-Assignment
 * 4. Recurrence Pattern Aggregation & Hotspot Intelligence
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CampusAI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 6 Canonical Institutional Campus Departments
  const CAMPUS_DEPARTMENTS = [
    "Facility Maintenance & Plumbing",
    "Campus Electrical & Power",
    "Hostel Sanitation & Food Services",
    "IT & Campus Network Services",
    "SHE Complaint Cell",
    "Anti-Ragging Committee"
  ];

  // NLP Department Routing Keyword Dictionaries
  const DEPT_KEYWORDS = {
    "Facility Maintenance & Plumbing": [
      "plumbing", "pipe", "burst", "water", "leak", "leaking", "cooler", "spigot", "drain",
      "drainage", "sump", "sewage", "restroom", "toilet", "washbasin", "tap", "faucet", "valve",
      "geyser", "tank", "overflow", "flush", "sink", "grease trap", "water supply", "ac", "hvac",
      "chiller", "cooling", "air conditioner", "filter", "compressor", "duct", "ventilation"
    ],
    "Campus Electrical & Power": [
      "electrical", "power", "electricity", "socket", "plug", "switch", "breaker", "mcb", "trip",
      "substation", "transformer", "wiring", "short circuit", "spark", "sparking", "blackout",
      "outage", "light", "tube light", "bulb", "fan", "ceiling fan", "generator", "ups", "voltage",
      "panel", "conduit", "fuse", "phase", "ht breaker"
    ],
    "IT & Campus Network Services": [
      "wifi", "wi-fi", "internet", "network", "lan", "ethernet", "router", "ap", "access point",
      "portal", "login", "server", "dns", "gateway", "cisco", "catalyst", "switch", "bandwidth",
      "firewall", "lab pc", "computing", "workstation", "projector", "hdmi", "display", "screen"
    ],
    "Hostel Sanitation & Food Services": [
      "mess", "food", "dining", "canteen", "kitchen", "meal", "breakfast", "lunch", "dinner",
      "sanitation", "garbage", "trash", "waste", "cleanliness", "hygiene", "roach", "pest",
      "insect", "infestation", "hostel cleaning", "corridor cleaning", "dustbin"
    ],
    "SHE Complaint Cell": [
      "she", "harassment", "women", "girl", "safety", "stalking", "misbehavior", "inappropriate",
      "posh", "icc", "complaint", "security", "threat", "eve teasing", "assault", "privacy"
    ],
    "Anti-Ragging Committee": [
      "ragging", "bully", "bullying", "senior", "freshers", "intimidation", "harass",
      "hostel ragging", "forced", "humiliation", "vigilance", "ombudsman", "abuse"
    ]
  };

  // Critical Safety Hazard Keywords (Instantly trigger high/critical severity boost)
  const SAFETY_HAZARD_KEYWORDS = [
    "spark", "smoke", "fire", "shock", "electrocution", "gas", "explosion", "flood", "flooding",
    "collapse", "structural", "chemical", "fumes", "harassment", "ragging", "emergency", "assault",
    "conduit near water", "rupture", "burst pipe", "high voltage"
  ];

  // Tokenize & normalize text for similarity comparison
  function tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  // Common English Stopwords
  const STOPWORDS = new Set([
    "the", "and", "is", "in", "at", "of", "on", "for", "with", "about", "against", "between",
    "into", "through", "during", "before", "after", "above", "below", "to", "from", "up",
    "down", "out", "off", "over", "under", "again", "further", "then", "once", "here", "there",
    "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "can",
    "will", "just", "should", "now", "this", "that", "these", "those", "room", "floor", "block"
  ]);

  // Compute Jaccard similarity between two token arrays
  function jaccardSimilarity(tokensA, tokensB) {
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let intersection = 0;
    setA.forEach(token => {
      if (setB.has(token)) intersection++;
    });
    const union = setA.size + setB.size - intersection;
    return union > 0 ? (intersection / union) : 0;
  }

  // Normalize location string for spatial comparison
  function normalizeLocation(loc) {
    if (!loc) return "";
    return loc
      .toLowerCase()
      .replace(/•/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');
  }

  /**
   * 1. Semantic & Proximity Duplicate Detection Engine
   * Compares a proposed or incoming ticket against active tickets in the system.
   */
  function detectDuplicates(newIssue, existingTickets = []) {
    if (!newIssue || !Array.isArray(existingTickets) || existingTickets.length === 0) {
      return {
        isDuplicate: false,
        isRecurring: false,
        matchTicket: null,
        similarityScore: 0,
        recurrenceCount: 0,
        matches: []
      };
    }

    const newLocNorm = normalizeLocation(newIssue.location);
    const newTokens = tokenize(`${newIssue.title || ''} ${newIssue.notes || ''} ${newIssue.location || ''}`);
    const newCategory = (newIssue.category || '').toLowerCase();

    let bestMatch = null;
    let highestScore = 0;
    let exactLocationCount = 0;
    const matchingTickets = [];

    existingTickets.forEach(existing => {
      // Exclude self if updating
      if (existing.id && existing.id === newIssue.id) return;

      const existingLocNorm = normalizeLocation(existing.location);
      const existingTokens = tokenize(`${existing.title || ''} ${existing.notes || ''} ${existing.location || ''}`);
      const existingCategory = (existing.category || '').toLowerCase();

      // 1. Spatial Match Score (0 to 0.45)
      let spatialScore = 0;
      if (newLocNorm && existingLocNorm) {
        if (newLocNorm === existingLocNorm) {
          spatialScore = 0.45;
          exactLocationCount++;
        } else if (newLocNorm.includes(existingLocNorm) || existingLocNorm.includes(newLocNorm)) {
          spatialScore = 0.35;
          exactLocationCount++;
        } else {
          // Check token overlap in location
          const locTokensA = newLocNorm.split(' ');
          const locTokensB = existingLocNorm.split(' ');
          const locOverlap = jaccardSimilarity(locTokensA, locTokensB);
          if (locOverlap >= 0.5) {
            spatialScore = locOverlap * 0.35;
            exactLocationCount++;
          }
        }
      }

      // 2. Semantic Text Overlap Score (0 to 0.40)
      const textScore = jaccardSimilarity(newTokens, existingTokens) * 0.40;

      // 3. Category Match Score (0 to 0.15)
      let catScore = 0;
      if (newCategory && existingCategory && (newCategory === existingCategory || existingCategory.includes(newCategory) || newCategory.includes(existingCategory))) {
        catScore = 0.15;
      }

      const totalSimilarity = spatialScore + textScore + catScore;

      if (totalSimilarity >= 0.45 && existing.status !== 'resolved') {
        matchingTickets.push({
          ticket: existing,
          similarity: Math.min(1.0, totalSimilarity),
          isSameLocation: spatialScore >= 0.30
        });
      }

      if (totalSimilarity > highestScore) {
        highestScore = totalSimilarity;
        bestMatch = existing;
      }
    });

    // An issue is deemed a duplicate if similarity >= 0.60 and status is not resolved
    const isDuplicate = highestScore >= 0.58 && bestMatch && bestMatch.status !== 'resolved';
    // An issue is recurring if there are 2 or more historical reports at this location
    const isRecurring = exactLocationCount >= 2 || (bestMatch && (bestMatch.isRecurring || (bestMatch.upvotes || 0) >= 2));
    const recurrenceCount = Math.max(exactLocationCount, bestMatch ? (bestMatch.recurrenceCount || bestMatch.reportsAggregated || 1) : 1);

    return {
      isDuplicate,
      isRecurring,
      matchTicket: highestScore >= 0.45 ? bestMatch : null,
      similarityScore: Math.round(highestScore * 100) / 100,
      recurrenceCount,
      matches: matchingTickets.sort((a, b) => b.similarity - a.similarity)
    };
  }

  /**
   * 2. Natural Language Department Classifier
   * Auto-assigns the responsible campus department based on category, title, description, and keywords.
   */
  function classifyDepartment(ticket) {
    const text = `${ticket.title || ''} ${ticket.notes || ''} ${ticket.category || ''} ${ticket.location || ''}`.toLowerCase();

    // Priority 1: Anti-ragging keywords
    if (text.includes("ragging") || text.includes("hazing") || text.includes("freshers block") || text.includes("intimidation")) {
      return {
        department: "Anti-Ragging Committee",
        confidence: 0.98,
        reasoning: "Matched high-urgency anti-ragging and student protection keywords."
      };
    }

    // Priority 2: SHE Cell keywords
    if (text.includes("harassment") || text.includes("women") || text.includes("she cell") || text.includes("stalking") || text.includes("posh")) {
      return {
        department: "SHE Complaint Cell",
        confidence: 0.98,
        reasoning: "Matched institutional SHE / POSH women's safety keywords."
      };
    }

    // Score each remaining department by keyword frequency
    const scores = {};
    CAMPUS_DEPARTMENTS.forEach(dept => {
      scores[dept] = 0;
      const kwList = DEPT_KEYWORDS[dept] || [];
      kwList.forEach(kw => {
        if (text.includes(kw)) {
          scores[dept] += (kw.length > 5 ? 2 : 1);
        }
      });
    });

    // Explicit category weight
    const cat = (ticket.category || '').toLowerCase();
    if (cat.includes('plumb') || cat.includes('water')) scores["Facility Maintenance & Plumbing"] += 4;
    if (cat.includes('elect') || cat.includes('power')) scores["Campus Electrical & Power"] += 4;
    if (cat.includes('wifi') || cat.includes('net') || cat.includes('it')) scores["IT & Campus Network Services"] += 4;
    if (cat.includes('mess') || cat.includes('food') || cat.includes('sanitation')) scores["Hostel Sanitation & Food Services"] += 4;
    if (cat.includes('hvac') || cat.includes('ac')) scores["Facility Maintenance & Plumbing"] += 4;
    // Direct category routing for SHE / Anti-Ragging (overrides scoring entirely)
    if (cat.includes('she') || cat === 'she complaint') {
      return { department: "SHE Complaint Cell", confidence: 1.0, reasoning: "Category explicitly set to SHE Complaint by student." };
    }
    if (cat.includes('ragging') || cat.includes('anti-ragging') || cat === 'anti-ragging') {
      return { department: "Anti-Ragging Committee", confidence: 1.0, reasoning: "Category explicitly set to Anti-Ragging by student." };
    }

    let highestDept = "Facility Maintenance & Plumbing";
    let maxScore = -1;

    Object.keys(scores).forEach(dept => {
      if (scores[dept] > maxScore) {
        maxScore = scores[dept];
        highestDept = dept;
      }
    });

    const confidence = maxScore > 0 ? Math.min(0.95, 0.5 + (maxScore * 0.1)) : 0.65;

    return {
      department: highestDept,
      confidence: Math.round(confidence * 100) / 100,
      reasoning: `Auto-routed to ${highestDept} based on keyword match score (${maxScore}).`
    };
  }

  /**
   * 3. Multi-Factor Algorithmic Priority Scoring Engine (0 to 100)
   * Factors:
   * - Base Severity / Safety Hazard: Up to 50 pts
   * - Recurrence Factor: Up to 30 pts (Repeated infrastructure failures get urgent escalation)
   * - Student Impact / Upvotes: Up to 25 pts
   * - Facility Criticality: Up to 15 pts (Server rooms, labs, mess, hostels)
   * - Aging / SLA Degradation: Up to 15 pts
   */
  function calculatePriority(ticket, recurrenceCount = 1) {
    let score = 0;
    const reasons = [];

    // Safety Hazard Keyword Scan & Full Text
    const fullText = `${ticket.title || ''} ${ticket.description || ''} ${ticket.notes || ''} ${ticket.location || ''}`.toLowerCase();
    const hasHazard = SAFETY_HAZARD_KEYWORDS.some(kw => fullText.includes(kw));

    // Factor 1: Base Severity
    const sev = (ticket.severity || 'moderate').toLowerCase();
    if (sev === 'critical') {
      score += 50;
      reasons.push("Critical Severity Base (+50)");
    } else if (sev === 'high' || hasHazard) {
      score += 35;
      reasons.push(sev === 'high' ? "High Severity Base (+35)" : "Elevated Severity Base from Hazard (+35)");
    } else if (sev === 'moderate') {
      score += 20;
      reasons.push("Moderate Severity Base (+20)");
    } else {
      score += 15;
      reasons.push("Standard Severity Base (+15)");
    }

    if (hasHazard) {
      score += 30;
      reasons.push("Safety Hazard Risk Keyword Detected (+30)");
    }

    // Factor 2: Recurrence Multiplier
    const effectiveRecurrence = Math.max(recurrenceCount, ticket.recurrenceCount || ticket.reportsAggregated || 1);
    if (effectiveRecurrence >= 3) {
      score += 30;
      reasons.push(`High Recurrence: ${effectiveRecurrence} repeat incidents (+30)`);
    } else if (effectiveRecurrence === 2) {
      score += 18;
      reasons.push(`Recurring defect: 2nd report at location (+18)`);
    }

    // Factor 3: Student Upvotes / Population Impact
    const upvotes = (ticket.upvotes || 1);
    if (upvotes > 1) {
      const upvoteBonus = Math.min(25, Math.floor(upvotes * 3));
      score += upvoteBonus;
      reasons.push(`Student Upvotes (${upvotes}) (+${upvoteBonus})`);
    }

    // Factor 4: Facility Criticality
    const loc = fullText;
    if (loc.includes("server") || loc.includes("vault") || loc.includes("datacenter") || loc.includes("substation") || loc.includes("transformer")) {
      score += 15;
      reasons.push("Critical Infrastructure Facility (+15)");
    } else if (loc.includes("mess") || loc.includes("kitchen") || loc.includes("library") || loc.includes("exam") || loc.includes("hostel")) {
      score += 8;
      reasons.push("High-Density Student Zone (+8)");
    }

    // Factor 5: Aging SLA Degradation
    if (ticket.createdAt) {
      const hoursOpen = (Date.now() - ticket.createdAt) / (3600 * 1000);
      if (hoursOpen >= 48 && ticket.status !== 'resolved') {
        score += 15;
        reasons.push("Overdue SLA: >48 hours unresolved (+15)");
      } else if (hoursOpen >= 24 && ticket.status !== 'resolved') {
        score += 8;
        reasons.push("SLA Aging: >24 hours (+8)");
      }
    }

    // Cap score at 100, minimum 10
    score = Math.max(10, Math.min(100, score));

    let priorityRank = "Normal";
    let priorityClass = "bg-surface-container text-secondary border-outline";
    let badgeText = "Normal";

    if (score >= 80 || sev === 'critical') {
      priorityRank = "Critical";
      priorityClass = "bg-error-container text-error border-error/30 font-bold";
      badgeText = "CRITICAL PRIORITY";
    } else if (score >= 60) {
      priorityRank = "High";
      priorityClass = "bg-[#fee2e2] text-[#991b1b] border-[#fecaca] font-bold";
      badgeText = "HIGH PRIORITY";
    } else if (score >= 35) {
      priorityRank = "Medium";
      priorityClass = "bg-amber-100 text-amber-900 border-amber-300 font-semibold";
      badgeText = "MEDIUM PRIORITY";
    }

    return {
      score,
      priorityScore: score,
      priorityRank,
      priorityLabel: priorityRank.toUpperCase(),
      badgeText,
      priorityClass,
      reasoning: reasons.join(" • ")
    };
  }

  /**
   * 4. Complete AI Ingestion Pipeline for New or Updated Tickets
   */
  function analyzeTicket(ticket, existingTickets = []) {
    // 1. Detect duplicates and recurrence
    const dupAnalysis = detectDuplicates(ticket, existingTickets);

    // 2. Classify department if unassigned or verify existing
    let deptInfo = { department: ticket.department };
    if (!ticket.department || ticket.department === 'Unassigned' || ticket.department === 'Pending') {
      deptInfo = classifyDepartment(ticket);
    }

    // 3. Calculate multi-factor priority
    const priorityInfo = calculatePriority(ticket, dupAnalysis.recurrenceCount);

    // 4. Enrich ticket
    const enriched = Object.assign({}, ticket, {
      department: ticket.department && ticket.department !== 'Unassigned' ? ticket.department : deptInfo.department,
      aiRoutingConfidence: deptInfo.confidence || 0.85,
      aiRoutingReasoning: deptInfo.reasoning || "Standard department assignment",
      priorityScore: priorityInfo.priorityScore,
      priorityRank: priorityInfo.priorityRank,
      priorityLabel: priorityInfo.priorityRank.toUpperCase(),
      severity: priorityInfo.priorityScore >= 80 ? 'critical' : (priorityInfo.priorityScore >= 60 ? 'high' : (priorityInfo.priorityScore >= 35 ? 'moderate' : 'low')),
      isRecurring: dupAnalysis.isRecurring || (dupAnalysis.recurrenceCount >= 2),
      recurrenceCount: Math.max(ticket.recurrenceCount || 1, dupAnalysis.recurrenceCount),
      duplicateOf: dupAnalysis.isDuplicate && dupAnalysis.matchTicket ? dupAnalysis.matchTicket.id : null,
      aiAnalyzedAt: Date.now()
    });

    return enriched;
  }

  /**
   * 5. Recurrence Pattern Hotspot Analyzer (Campus-Wide)
   * Identifies systemic failure patterns across all historical and active tickets.
   * Generates actionable AI root-cause recommendations per cluster.
   */

  // AI Preventive Recommendation Rules
  const RECOMMENDATION_RULES = [
    {
      keywords: ['pipe', 'pipeline', 'plumb', 'burst', 'leak', 'drain', 'sump', 'sewage'],
      category: 'plumbing',
      recommendations: [
        'Schedule preventive pipeline inspection every 3 months to detect stress fractures early.',
        'Replace temporary rubber washers with brass compression fittings for permanent repair.',
        'Install water pressure regulators to prevent repeat burst failures at elbow joints.',
        'Consider full section replacement of aging cast iron pipes with CPVC rated pipe.'
      ]
    },
    {
      keywords: ['electrical', 'power', 'breaker', 'mcb', 'trip', 'socket', 'wiring', 'spark', 'outage', 'blackout'],
      category: 'electrical',
      recommendations: [
        'Upgrade 32A MCB breakers to commercial-grade 40A units to prevent repeat tripping.',
        'Conduct quarterly thermographic scan of distribution panels to detect hotspots early.',
        'Install surge protection (SPD) on all feeder panels to prevent repeat damage.',
        'Replace aluminum wiring with copper conductor cables in high-load zones.'
      ]
    },
    {
      keywords: ['wifi', 'network', 'internet', 'router', 'access point', 'lan', 'connectivity'],
      category: 'it',
      recommendations: [
        'Deploy additional wireless access points to distribute load and reduce repeat dead-zones.',
        'Implement automatic failover with dual-ISP link to eliminate repeat connectivity outages.',
        'Schedule monthly firmware updates on all managed switches and access points.',
        'Replace aging Cat5e cabling with Cat6A in high-density zones to resolve bandwidth bottlenecks.'
      ]
    },
    {
      keywords: ['cooler', 'water cooler', 'tap', 'faucet', 'washbasin', 'toilet', 'flush'],
      category: 'plumbing',
      recommendations: [
        'Install sensor-based flow regulators on high-traffic water points to detect faults automatically.',
        'Replace spring-return faucet valves with ceramic disc cartridge type to prevent dripping.',
        'Schedule bi-annual preventive maintenance for all water dispensing units.',
        'Install automated water leak detectors with SMS alert system for immediate response.'
      ]
    },
    {
      keywords: ['mess', 'food', 'kitchen', 'canteen', 'dining', 'garbage', 'hygiene', 'pest', 'roach'],
      category: 'sanitation',
      recommendations: [
        'Increase frequency of pest control treatment to fortnightly in high-footfall dining areas.',
        'Install proper ventilation and exhaust hoods to prevent food odor accumulation.',
        'Implement waste segregation protocol and schedule daily deep-cleaning of grease traps.',
        'Deploy IoT waste-level sensors in dustbins for proactive collection scheduling.'
      ]
    },
    {
      keywords: ['fan', 'ceiling fan', 'hvac', 'ac', 'air conditioner', 'cooling', 'ventilation'],
      category: 'mechanical',
      recommendations: [
        'Replace single-phase capacitor-type ceiling fans with energy-efficient BLDC motors.',
        'Schedule quarterly HVAC filter cleaning and coil inspection to prevent repeat failures.',
        'Install smart thermostats with remote monitoring to detect performance drops early.',
        'Replace worn fan blades and motor bearings preventively based on run-hour threshold.'
      ]
    }
  ];

  function generateHotspotRecommendation(hotspot) {
    const locNorm = (hotspot.locationName || '').toLowerCase();
    const topCategory = Object.keys(hotspot.categories).sort(
      (a, b) => hotspot.categories[b] - hotspot.categories[a]
    )[0] || 'general';

    const combinedText = `${locNorm} ${topCategory}`.toLowerCase();

    for (const rule of RECOMMENDATION_RULES) {
      if (rule.keywords.some(kw => combinedText.includes(kw))) {
        const idx = hotspot.totalReports % rule.recommendations.length;
        return {
          type: rule.category,
          recommendation: rule.recommendations[idx],
          severity: hotspot.highestSeverity,
          actionable: true
        };
      }
    }

    // Generic fallback
    return {
      type: 'general',
      recommendation: `Review and upgrade aging infrastructure at ${hotspot.locationName} — ${hotspot.totalReports} repeated incidents suggest systemic root cause.`,
      severity: hotspot.highestSeverity,
      actionable: true
    };
  }

  function analyzeCampusHotspots(allTickets = []) {
    const locationMap = {};
    const categoryMap = {};

    allTickets.forEach(t => {
      const locKey = normalizeLocation(t.location);
      if (!locKey) return;

      if (!locationMap[locKey]) {
        locationMap[locKey] = {
          locationName: t.location,
          totalReports: 0,
          activeReports: 0,
          resolvedReports: 0,
          categories: {},
          ticketIds: [],
          highestSeverity: 'low',
          departments: {}
        };
      }

      const entry = locationMap[locKey];
      entry.totalReports++;
      entry.ticketIds.push(t.id);
      if (t.status === 'resolved') {
        entry.resolvedReports++;
      } else {
        entry.activeReports++;
      }

      const cat = t.category || 'general';
      entry.categories[cat] = (entry.categories[cat] || 0) + 1;
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;

      if (t.department) {
        entry.departments[t.department] = (entry.departments[t.department] || 0) + 1;
      }

      if (t.severity === 'critical') entry.highestSeverity = 'critical';
      else if (t.severity === 'high' && entry.highestSeverity !== 'critical') entry.highestSeverity = 'high';
      else if (t.severity === 'moderate' && entry.highestSeverity === 'low') entry.highestSeverity = 'moderate';
    });

    const recurringHotspots = Object.values(locationMap)
      .filter(loc => loc.totalReports >= 2)
      .sort((a, b) => b.totalReports - a.totalReports)
      .map(hotspot => ({
        ...hotspot,
        aiRecommendation: generateHotspotRecommendation(hotspot),
        primaryDepartment: Object.keys(hotspot.departments).sort(
          (a, b) => hotspot.departments[b] - hotspot.departments[a]
        )[0] || null,
        resolutionRate: hotspot.totalReports > 0
          ? Math.round((hotspot.resolvedReports / hotspot.totalReports) * 100)
          : 0
      }));

    return {
      totalHotspots: recurringHotspots.length,
      hotspots: recurringHotspots,
      categoryDistribution: categoryMap
    };
  }

  /**
   * 6. Upvote Ticket & Recalculate AI Priority Dynamically
   */
  function upvoteTicket(ticketId, studentId, allTickets = []) {
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return null;

    if (!ticket.upvoters) ticket.upvoters = [];
    if (!ticket.upvotes) ticket.upvotes = 0;

    ticket.upvotes += 1;
    if (studentId && !ticket.upvoters.includes(studentId)) {
      ticket.upvoters.push(studentId);
    }

    const pInfo = calculatePriority(ticket, ticket.recurrenceCount || 1);
    ticket.priorityScore = pInfo.priorityScore;
    ticket.priorityRank = pInfo.priorityRank;
    ticket.priorityLabel = pInfo.priorityRank.toUpperCase();
    ticket.priorityClass = pInfo.priorityClass;

    return ticket;
  }

  return {
    CAMPUS_DEPARTMENTS,
    DEPT_KEYWORDS,
    SAFETY_HAZARD_KEYWORDS,
    tokenize,
    jaccardSimilarity,
    normalizeLocation,
    detectDuplicates,
    classifyDepartment,
    calculatePriority,
    analyzeTicket,
    analyzeCampusHotspots,
    upvoteTicket
  };
});
