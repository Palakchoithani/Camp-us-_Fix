/**
 * CAMP(US)FIX — DEDICATED ROLE DASHBOARDS ENGINE
 * Renders Student Dashboard, Admin Room, and Department
 * with live ticket tracking, state mutations, and strict role permissions.
 */

(function () {
  'use strict';

  // Seed Initial Tickets (Inclusive of Stitch Department Dashboard work orders & all 6 authorized disciplines)
  const INITIAL_TICKETS = [
    // 1. Facility Maintenance & Plumbing (Stitch Specific Work Orders)
    {
      id: "CP-1082",
      title: "Block C Main Pipeline Burst & Sump Backflow",
      department: "Facility Maintenance & Plumbing",
      location: "Block C Ground Shaft • Civil Plumbing",
      severity: "critical",
      category: "critical",
      status: "in_progress",
      slaRemaining: "38m Remaining",
      priorityScore: 96,
      assignedCrew: "R. Verma (Lead Crew)",
      crewInitials: "RV",
      currentStep: "Step 3/4: Joint Fitting",
      progress: 75,
      studentName: "K. Raghunath",
      studentId: "2023CV0112",
      isAnonymous: false,
      upvotes: 24,
      upvoters: ["2023CV0112"],
      createdAt: Date.now() - (45 * 60 * 1000),
      notes: "Municipal input elbow joint ruptured. Standing water in annex ground floor. Joint clamp replacement in progress.",
      timeline: [
        { stage: "Submitted", time: "45m ago", note: "Burst alarm verified on VHF Plumb-1." },
        { stage: "Dispatched", time: "40m ago", note: "R. Verma (Lead Crew) deployed on site." },
        { stage: "In Progress", time: "15m ago", note: "Elbow joint fitted, clamp tensioning active." }
      ]
    },
    {
      id: "CP-1055",
      title: "Block 4 Water Cooler Leak",
      department: "Facility Maintenance & Plumbing",
      location: "Hostel Block 4 • 2nd Floor South Wing",
      severity: "high",
      category: "field",
      status: "in_progress",
      slaRemaining: "41m remaining",
      priorityScore: 78,
      assignedCrew: "Crew #04 (R. Murugan)",
      crewInitials: "RM",
      currentStep: "On-Site Repairing",
      progress: 72,
      studentName: "Aarav K. Senapati",
      studentId: "2024CS0123",
      pingDuration: "Student pinged 18 mins ago",
      isAnonymous: false,
      upvotes: 12,
      upvoters: ["2024CS0123"],
      createdAt: Date.now() - (45 * 60 * 1000),
      notes: "2nd Floor South Wing. Spigot valve damaged, water pooling on floor. Crew dispatched • 41m remaining.",
      timeline: [
        { stage: "Submitted", time: "45m ago", note: "Water cooler leak signal received." },
        { stage: "Dispatched", time: "30m ago", note: "Crew #04 (R. Murugan) dispatched." },
        { stage: "In Progress", time: "15m ago", note: "Spigot valve replacement and hydro-seal fitting in progress." }
      ]
    },
    {
      id: "CP-1044",
      title: "Sensor Restroom Tap Running Untriggered",
      department: "Facility Maintenance & Plumbing",
      location: "Central Library • Restroom Automation",
      severity: "moderate",
      category: "field",
      status: "dispatched",
      slaRemaining: "En Route",
      priorityScore: 62,
      assignedCrew: "G. Nair (Crew #04)",
      crewInitials: "GN",
      currentStep: "ETA 6 minutes to site",
      progress: 40,
      studentName: "M. Tandon",
      studentId: "2022ME0308",
      isAnonymous: false,
      upvotes: 8,
      upvoters: [],
      createdAt: Date.now() - (25 * 60 * 1000),
      notes: "Photocell solenoid stuck open in 1st floor reading room washroom. Crew dispatched with replacement sensor.",
      timeline: [
        { stage: "Submitted", time: "25m ago", note: "Water wastage sensor signal received." },
        { stage: "Dispatched", time: "10m ago", note: "G. Nair dispatched with solenoid kit." }
      ]
    },
    {
      id: "CP-1019",
      title: "Sink Grease Trap Overflow Cleared",
      department: "Facility Maintenance & Plumbing",
      location: "Mess Hall D",
      severity: "high",
      category: "verification",
      status: "fixed",
      fixedAt: Date.now() - (18 * 60 * 1000),
      verificationDeadline: Date.now() + (47 * 3600 * 1000 + 42 * 60 * 1000),
      slaRemaining: "47h 42m to verify",
      priorityScore: 82,
      assignedCrew: "A. Chatterjee (Tech I)",
      crewInitials: "AC",
      currentStep: "Mess Hall D Sign-off",
      progress: 90,
      studentName: "P. Iyer",
      studentId: "2024BT0198",
      pingDuration: "Ping sent 18m ago",
      beforePhoto: "https://lh3.googleusercontent.com/aida-public/AB6AXuBcZI4Jcq5rDGVtF_9TF1bWrU2U-MaZFbs7SjD3hdTFshQ8bHKjG64XoIasgnCGrBqdaToajBBhPaoyPSAjqeqeGLxngseEalj4nBC5NsnLTU_F2fi4NPXcI5JaF24GNkUpm9K834eM4whSP6C7aWVKBSWAJTsE0Yv5PI4rLRhwYj_A6duK6-vkslJlGIdFIfvA-LchHryc-VSZmL9QyevUE2yfo5G9XSaQQlvQcl16vPQc7dvLlo9q",
      afterPhoto: "https://lh3.googleusercontent.com/aida-public/AB6AXuDVznsZ1ovejw5GIT8GCK8fUai84cT6u9jfUc6vd08RF-pdThdKctrv_gOyFSIgODieQDUKoZg7RnqGTq4XCnTqSOZUsry2XZbAwiibiLlHJF4iedA8tkiLZOKlchpgmdVlGvCm5wRirsiz0RCHTBjEPdVyfXdKrcFDYFlZWKUMxz-5RyuPAaAyEDZNl35y27spZxiDV_QJIge8KO6vG70PdADtgafr4s-GrvLE6IZ1pqXnB0IwXskg",
      isAnonymous: false,
      upvotes: 15,
      upvoters: [],
      createdAt: Date.now() - (60 * 60 * 1000),
      notes: "Grease trap cleared, enzyme treatment applied, washdown completed. Rule 14.B photographic sign-off dispatched to reporter.",
      timeline: [
        { stage: "Submitted", time: "1h ago", note: "Mess supervisor & resident ticket opened." },
        { stage: "Dispatched", time: "50m ago", note: "A. Chatterjee deployed with vacuum suction unit." },
        { stage: "Work Completed", time: "18m ago", note: "Trap cleared. Rule 14.B photographic sign-off dispatched." }
      ]
    },
    {
      id: "TCK-2026-9041",
      title: "Main Riser Washroom Pipe Rupture",
      department: "Facility Maintenance & Plumbing",
      location: "Hostel Block C • 3rd Floor",
      severity: "critical",
      category: "critical",
      priorityScore: 94,
      reportsAggregated: 18,
      status: "in_progress",
      slaRemaining: "50m Remaining",
      studentId: "2023CV0112",
      studentName: "K. Raghunath",
      isAnonymous: false,
      assignedCrew: "Crew #04 (R. Murugan)",
      crewInitials: "RM",
      currentStep: "Emergency Extraction",
      progress: 65,
      upvotes: 18,
      upvoters: ["2024CS0123"],
      createdAt: Date.now() - (2 * 3600 * 1000),
      notes: "Pressurized water leaking into electrical conduit trays above Rooms 314 & 316. Immediate structural water ingress threat across adjacent hallway.",
      timeline: [
        { stage: "Submitted", time: "2h ago", note: "18 aggregated telemetry & resident reports." },
        { stage: "Dispatched", time: "1h 45m ago", note: "Routed to West Quadrant Crew #04." },
        { stage: "In Progress", time: "40m ago", note: "Emergency shutoff valve engaged. Water extraction active." }
      ]
    },

    // 2. Campus Electrical & Power
    {
      id: "CP-1012",
      title: "Room 212 Fan Regulator Fixed",
      department: "Campus Electrical & Power",
      location: "Hostel Block 4 • Room 212 In-Suite",
      severity: "moderate",
      category: "verification",
      status: "fixed",
      fixedAt: Date.now() - (60 * 60 * 1000),
      verificationDeadline: Date.now() + (47 * 3600 * 1000),
      slaRemaining: "47h remaining to verify",
      priorityScore: 65,
      studentId: "2024CS0123",
      studentName: "Aarav K. Senapati",
      isAnonymous: false,
      assignedCrew: "Crew #02 (S. Ramanathan)",
      crewInitials: "SR",
      currentStep: "Student Resolution Verification (48h)",
      progress: 90,
      upvotes: 5,
      upvoters: ["2024CS0123"],
      createdAt: Date.now() - (3 * 3600 * 1000),
      notes: "Staff electrician has completed work. As reporter, your sign-off is required to close this ticket and update departmental SLA standing.",
      proofUploaded: "12:44 PM",
      proofPhoto: "https://lh3.googleusercontent.com/aida-public/AB6AXuBmM30j_HlSyROLSSwAPnIPRA_D2m9114be7s9opgdSSdv_Y19tm2jtIyofy0Ye2yQZKEP9Xho786gWzRtGQ93Pbw5LwCcKTv-vpiMWW2tnJOQhVTCXuZJ0yimHtXtWvhrpZfP4Chnctnx-pT_5tInN_VLq4DoeRvItgZ244Ru81U1f6Bs7lxalBZrcfV2LFgmyr64HJ6zrZJDAcVlfjMJwnfnv8-KnE3rm8ySYm8ruAi85qbGxOXli",
      timeline: [
        { stage: "Submitted", time: "3h ago", note: "Reported via student terminal." },
        { stage: "Dispatched", time: "2h ago", note: "Electrician S. Ramanathan deployed." },
        { stage: "Work Completed", time: "12:44 PM", note: "Proof photo uploaded: REG_212_REPAIR.JPG. Your sign-off needed." }
      ]
    },
    {
      id: "TCK-2026-8912",
      title: "Main Substation 3-Phase HT Breaker Trip",
      department: "Campus Electrical & Power",
      location: "Central Computing Complex • Server Vault",
      severity: "critical",
      category: "critical",
      status: "in_progress",
      slaRemaining: "42m Remaining",
      priorityScore: 92,
      studentId: "2023EE0491",
      studentName: "Pooja Hegde",
      isAnonymous: true,
      assignedCrew: "Sunil Verma (Lead)",
      crewInitials: "SV",
      currentStep: "Secondary HT Feed Switchover",
      progress: 60,
      upvotes: 29,
      upvoters: [],
      createdAt: Date.now() - (4 * 3600 * 1000),
      notes: "Backup diesel generator active. Secondary HT feed switchover initialized.",
      timeline: [
        { stage: "Submitted", time: "4h ago", note: "Telemetry alert confirmed." },
        { stage: "Dispatched", time: "3h 20m ago", note: "Electrical safety inspector dispatched." }
      ]
    },
    {
      id: "CP-88291",
      title: "Induction Range Heavy Phase Intermittent Voltage Drop",
      department: "Campus Electrical & Power",
      location: "Hostel Quad 2 • Dining Hall",
      severity: "high",
      category: "field",
      priorityScore: 68,
      status: "dispatched",
      slaRemaining: "1h 15m Remaining",
      studentId: "2023EE0102",
      studentName: "Devansh Rao",
      isAnonymous: false,
      assignedCrew: "Crew 04 (M. Joshi)",
      crewInitials: "MJ",
      currentStep: "ETA 12 minutes to Substation 4",
      progress: 35,
      upvotes: 19,
      upvoters: [],
      createdAt: Date.now() - (44 * 60 * 1000),
      notes: "Sub-station 4 primary capacitor load fluctuating by 38V during peak food preparation rotation. Safe, but causes kitchen delays.",
      timeline: [
        { stage: "Submitted", time: "44m ago", note: "Telemetry voltage anomaly detected." },
        { stage: "Dispatched", time: "40m ago", note: "Crew 04 dispatched to Hostel Quad 2 sub-station." }
      ]
    },

    // 3. Hostel Sanitation & Food Services
    {
      id: "TCK-2026-8740",
      title: "Stormwater Drain Overflow & Blockage",
      department: "Hostel Sanitation & Food Services",
      location: "Mess & Dining Quad • Outer Drainage",
      severity: "moderate",
      category: "field",
      status: "in_progress",
      slaRemaining: "1h 30m Remaining",
      priorityScore: 70,
      studentId: "2023EE0102",
      studentName: "Devansh Rao",
      isAnonymous: false,
      assignedCrew: "Sanitation Rapid Response #01",
      crewInitials: "SR",
      currentStep: "Hydro-jet Cleansing",
      progress: 70,
      upvotes: 35,
      upvoters: ["2024CS0123"],
      createdAt: Date.now() - (26 * 3600 * 1000),
      notes: "Hydro-jet clearing performed. Silt trap completely unclogged.",
      timeline: [
        { stage: "Submitted", time: "Yesterday", note: "Reported via student portal." },
        { stage: "Dispatched", time: "Yesterday", note: "Sanitation team deployed." }
      ]
    },
    {
      id: "CP-1062",
      title: "Hostel Block B Overhead Water Tank Chlorination",
      department: "Hostel Sanitation & Food Services",
      location: "Hostel Block B Roof",
      severity: "critical",
      category: "critical",
      status: "in_progress",
      slaRemaining: "20m Remaining",
      priorityScore: 91,
      assignedCrew: "K. Deshmukh (Lead)",
      crewInitials: "KD",
      currentStep: "PPM Bio-assay Verification",
      progress: 85,
      studentName: "Tanvi S.",
      studentId: "2023CH0045",
      isAnonymous: false,
      upvotes: 14,
      upvoters: [],
      createdAt: Date.now() - (40 * 60 * 1000),
      notes: "Routine quarterly dosing completed. Active chlorine PPM reading normalized.",
      timeline: [
        { stage: "Dispatched", time: "30m ago", note: "Water quality team deployed." }
      ]
    },

    // 4. IT & Campus Network Services
    {
      id: "TCK-2026-9105",
      title: "Cisco Catalyst Core AP Cluster Offline",
      department: "IT & Campus Network Services",
      location: "Academic Complex • West Wing Hall G",
      severity: "critical",
      category: "critical",
      priorityScore: 95,
      slaRemaining: "28m Remaining",
      status: "in_progress",
      studentId: "2022IT0114",
      studentName: "Karan Johar",
      isAnonymous: false,
      assignedCrew: "Vikram Mehta (NOC Lead)",
      crewInitials: "VM",
      currentStep: "Switchport VLAN Trunk Re-sync",
      progress: 80,
      upvotes: 42,
      upvoters: [],
      createdAt: Date.now() - (35 * 60 * 1000),
      notes: "42 concurrent computer-based midterms interrupted. Dual failover relay dropped due to switchport misconfiguration.",
      timeline: [
        { stage: "Submitted", time: "35m ago", note: "NOC watchdog switchport failure registered." },
        { stage: "In Progress", time: "10m ago", note: "Core trunk re-flashed." }
      ]
    },
    {
      id: "CP-1033",
      title: "Hostel Quad 1 Fiber Link Optical Loss",
      department: "IT & Campus Network Services",
      location: "Hostel Quad 1 IDF Switch Rack",
      severity: "high",
      category: "field",
      priorityScore: 75,
      status: "dispatched",
      slaRemaining: "En Route",
      studentId: "2024CS0211",
      studentName: "Devika Rao",
      isAnonymous: false,
      assignedCrew: "D. Rao (Net Eng)",
      crewInitials: "DR",
      currentStep: "ETA 8 mins with OTDR Tester",
      progress: 45,
      upvotes: 11,
      upvoters: [],
      createdAt: Date.now() - (50 * 60 * 1000),
      notes: "Optical loss > -28dBm on Core-B uplink. OTDR fiber splicer dispatched.",
      timeline: [
        { stage: "Dispatched", time: "15m ago", note: "Fiber engineer deployed." }
      ]
    },

    // 5. SHE Complaint Cell
    {
      id: "SHE-2026-041",
      title: "Perimeter Pathway High-Intensity Lighting Failure",
      department: "SHE Complaint Cell",
      location: "East Campus Promenade • Girls Hostel Approach",
      severity: "critical",
      category: "critical",
      priorityScore: 98,
      status: "in_progress",
      slaRemaining: "18m Remaining",
      assignedCrew: "Dr. Nalini Iyer (ICC Cell)",
      crewInitials: "NI",
      currentStep: "Patrol Escort Deployed & Relay Swapped",
      progress: 85,
      studentName: "Confidential Student",
      studentId: "2023SH0019",
      isAnonymous: true,
      upvotes: 38,
      upvoters: [],
      createdAt: Date.now() - (30 * 60 * 1000),
      notes: "Patrol deployment active. High-mast floodlight relay replacement initiated.",
      timeline: [
        { stage: "Reported", time: "30m ago", note: "Urgent safety ping received." },
        { stage: "Active Patrol", time: "15m ago", note: "Security guard stationed." }
      ]
    },
    {
      id: "SHE-2026-028",
      title: "Confidential Acoustic Partition Verification",
      department: "SHE Complaint Cell",
      location: "Student Welfare Center Suite 12",
      severity: "moderate",
      category: "verification",
      status: "fixed",
      fixedAt: Date.now() - (25 * 60 * 1000),
      verificationDeadline: Date.now() + (47 * 3600 * 1000 + 35 * 60 * 1000),
      slaRemaining: "47h 35m to verify",
      priorityScore: 60,
      assignedCrew: "ICC Rapid Response Desk",
      crewInitials: "IC",
      currentStep: "Student Counselor Sign-off (48h)",
      progress: 90,
      studentName: "Confidential Student",
      studentId: "2022SH0088",
      isAnonymous: true,
      upvotes: 9,
      upvoters: [],
      createdAt: Date.now() - (120 * 60 * 1000),
      notes: "Sound-dampening acoustic seals installed on intake consultation room door.",
      timeline: [
        { stage: "Completed", time: "25m ago", note: "Installed & sound tested." }
      ]
    },

    // 6. Anti-Ragging Committee
    {
      id: "RAG-2026-014",
      title: "Fresher Wing Corridor CCTV Surveillance Angle Shift",
      department: "Anti-Ragging Committee",
      location: "Freshers Block 1 • 2nd Floor Corridor",
      severity: "critical",
      category: "critical",
      priorityScore: 99,
      status: "in_progress",
      slaRemaining: "12m Remaining",
      assignedCrew: "Col. P. Nair (Squad Lead)",
      crewInitials: "PN",
      currentStep: "PTZ Optical Alignment & Tamper Lock",
      progress: 90,
      studentName: "Ombudsman Secret Watcher",
      studentId: "2024RG0002",
      isAnonymous: true,
      upvotes: 21,
      upvoters: [],
      createdAt: Date.now() - (20 * 60 * 1000),
      notes: "Squad dispatched. PTZ optical alignment and tamper lock engaged.",
      timeline: [
        { stage: "Alert", time: "20m ago", note: "Surveillance angle discrepancy logged." },
        { stage: "Squad On-Site", time: "10m ago", note: "Proctorial squad secured the wing." }
      ]
    },
    {
      id: "RAG-2026-008",
      title: "24x7 Ombudsman Emergency Hotline Audio Loop Verification",
      department: "Anti-Ragging Committee",
      location: "Campus Control Room",
      severity: "moderate",
      category: "verification",
      status: "fixed",
      fixedAt: Date.now() - (10 * 60 * 1000),
      verificationDeadline: Date.now() + (47 * 3600 * 1000 + 50 * 60 * 1000),
      slaRemaining: "47h 50m to verify",
      priorityScore: 70,
      assignedCrew: "Ombudsman Comm Desk",
      crewInitials: "OC",
      currentStep: "Student Verification Pinged (48h)",
      progress: 90,
      studentName: "Ombudsman Liaison",
      studentId: "2021RG0099",
      isAnonymous: false,
      upvotes: 6,
      upvoters: [],
      createdAt: Date.now() - (95 * 60 * 1000),
      notes: "Line carrier tested across PSTN and VoIP gateways. Verified operational.",
      timeline: [
        { stage: "Verified", time: "20m ago", note: "Audio loop ping successful." }
      ]
    },

    // 7. Student Resolved Lifetime History (100% Confirmed by Aarav K. Senapati - 5 Lifetime Resolved)
    {
      id: "CP-0982",
      title: "Hostel 4 Corridor Tube Light Replacement",
      department: "Campus Electrical & Power",
      location: "Hostel Block 4 • 2nd Floor Corridor",
      severity: "low",
      category: "resolved",
      status: "resolved",
      slaRemaining: "Resolved",
      studentId: "2024CS0123",
      studentName: "Aarav K. Senapati",
      isAnonymous: false,
      assignedCrew: "Crew #02 (S. Ramanathan)",
      rating: 5,
      resolvedAt: Date.now() - (4 * 86400 * 1000),
      notes: "T8 LED ballast replaced. Student confirmed closure with 5-star rating.",
      timeline: [
        { stage: "Submitted", time: "4d ago", note: "Flickering tube light reported." },
        { stage: "Resolved", time: "4d ago", note: "Replaced & confirmed by student. SHA: 8a4ef...901c" }
      ]
    },
    {
      id: "CP-0954",
      title: "Water Dispenser Filter Cartridge Renewal",
      department: "Facility Maintenance & Plumbing",
      location: "Hostel Block 4 • 1st Floor Common",
      severity: "moderate",
      category: "resolved",
      status: "resolved",
      slaRemaining: "Resolved",
      studentId: "2024CS0123",
      studentName: "Aarav K. Senapati",
      isAnonymous: false,
      assignedCrew: "Crew #04 (R. Murugan)",
      rating: 5,
      resolvedAt: Date.now() - (12 * 86400 * 1000),
      notes: "Sediment and carbon cartridge renewed. TDS calibrated to 65 ppm. Confirmed by student.",
      timeline: [
        { stage: "Submitted", time: "12d ago", note: "Filter red indicator ping." },
        { stage: "Resolved", time: "12d ago", note: "Replaced and audited. SHA: 3c91d...f82a" }
      ]
    },
    {
      id: "CP-0921",
      title: "Common Room Table Tennis Net Repair",
      department: "Hostel Sanitation & Food Services",
      location: "Hostel Block 4 • Indoor Recreation Room",
      severity: "low",
      category: "resolved",
      status: "resolved",
      slaRemaining: "Resolved",
      studentId: "2024CS0123",
      studentName: "Aarav K. Senapati",
      isAnonymous: false,
      assignedCrew: "Sports Maintenance Team",
      rating: 4,
      resolvedAt: Date.now() - (18 * 86400 * 1000),
      notes: "Clamp bracket adjusted and tension cable tightened. Confirmed by student.",
      timeline: [
        { stage: "Submitted", time: "18d ago", note: "Sagging net report." },
        { stage: "Resolved", time: "18d ago", note: "Fixed and signed off. SHA: e5192...7102" }
      ]
    },
    {
      id: "CP-0899",
      title: "Quiet Reading Room Wi-Fi Mesh Node Reset",
      department: "IT & Campus Network Services",
      location: "Hostel Block 4 • Study Lounge",
      severity: "moderate",
      category: "resolved",
      status: "resolved",
      slaRemaining: "Resolved",
      studentId: "2024CS0123",
      studentName: "Aarav K. Senapati",
      isAnonymous: false,
      assignedCrew: "Network Ops (NOC-3)",
      rating: 5,
      resolvedAt: Date.now() - (24 * 86400 * 1000),
      notes: "PoE injector rebooted and firmware patched. Confirmed by student.",
      timeline: [
        { stage: "Submitted", time: "24d ago", note: "Packet loss report." },
        { stage: "Resolved", time: "24d ago", note: "Restored and signed off. SHA: 9b2d8...7e4a" }
      ]
    },
    {
      id: "CP-0870",
      title: "Study Hall AC Thermostat Calibration",
      department: "Facility Maintenance & Plumbing",
      location: "Hostel Block 4 • Central Study Hall",
      severity: "low",
      category: "resolved",
      status: "resolved",
      slaRemaining: "Resolved",
      studentId: "2024CS0123",
      studentName: "Aarav K. Senapati",
      isAnonymous: false,
      assignedCrew: "HVAC Rapid Response",
      rating: 5,
      resolvedAt: Date.now() - (30 * 86400 * 1000),
      notes: "Thermostat setpoint recalibrated to 23°C. Filter cleaned. Confirmed by student.",
      timeline: [
        { stage: "Submitted", time: "30d ago", note: "Overcooling complaint." },
        { stage: "Resolved", time: "30d ago", note: "Recalibrated and signed off. SHA: 17889...4302" }
      ]
    }
  ];

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // Production Real-Time WebSocket Client & Database Sync Layer
  // --------------------------------------------------------------------------
  let ticketsCache = [];
  let ticketsCacheLoaded = false;
  let wsInstance = null;
  let wsReconnectTimer = null;

  class CampusRealtimeManager {
    constructor() {
      this.connected = false;
      this.init();
    }

    init() {
      if (typeof window === 'undefined') return;
      // Start real-time connection on page load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.connect();
          this.updateLiveIndicator(this.connected);
        });
      } else {
        this.connect();
        this.updateLiveIndicator(this.connected);
      }
      setInterval(() => {
        this.updateLiveIndicator(this.connected);
      }, 2500);
    }

    connect() {
      if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const session = window.getCurrentSession ? window.getCurrentSession() : null;
      const user = session && session.user ? session.user : {};

      const params = new URLSearchParams({
        role: user.role || 'student',
        userId: user.id || 'anon',
        deptName: user.deptName || '',
        token: session && session.token ? session.token : ''
      });

      const wsUrl = `${proto}//${host}/ws?${params.toString()}`;
      try {
        wsInstance = new WebSocket(wsUrl);
      } catch (e) {
        console.warn('[CampusRealtime] WebSocket connection failed:', e);
        this.scheduleReconnect();
        return;
      }

      wsInstance.onopen = () => {
        this.connected = true;
        this.updateLiveIndicator(true);

        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
            wsInstance.send(JSON.stringify({ action: 'ping' }));
          }
        }, 25000);

        // Fetch fresh authoritative state from database
        window.fetchTicketsFromBackend();
      };

      wsInstance.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleServerEvent(payload);
        } catch (err) {
          console.warn('[CampusRealtime] Message parse error:', err);
        }
      };

      wsInstance.onclose = () => {
        this.connected = false;
        this.updateLiveIndicator(false);
        this.scheduleReconnect();
      };

      wsInstance.onerror = () => {
        this.connected = false;
        this.updateLiveIndicator(false);
      };
    }

    scheduleReconnect() {
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(() => {
        this.connect();
      }, 3000);
    }

    updateLiveIndicator(isLive) {
      document.querySelectorAll('.campus-realtime-indicator').forEach(el => {
        if (isLive) {
          el.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-bold shadow-xs"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Live Realtime Active</span>`;
        } else {
          el.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-mono font-bold"><span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>Connecting...</span>`;
        }
      });
    }

    handleServerEvent(payload) {
      const { type, data } = payload;
      if (!data || !data.id) return;

      // Duplicate event suppression
      if (!this.seenEvents) this.seenEvents = new Map();
      const eventKey = `${type}:${data.id}:${data.updatedAt || payload.timestamp || ''}`;
      const now = Date.now();
      if (this.seenEvents.has(eventKey) && (now - this.seenEvents.get(eventKey)) < 3000) {
        return; // Drop duplicate event
      }
      this.seenEvents.set(eventKey, now);
      if (this.seenEvents.size > 200) {
        for (const [k, v] of this.seenEvents.entries()) {
          if (now - v > 10000) this.seenEvents.delete(k);
        }
      }

      const session = window.getCurrentSession ? window.getCurrentSession() : null;
      const currentUser = session ? session.user : null;
      const currentRole = currentUser ? currentUser.role : 'student';

      const idx = ticketsCache.findIndex(t => t.id === data.id);
      if (idx !== -1) {
        ticketsCache[idx] = data;
      } else {
        ticketsCache.unshift(data);
      }

      // Notifications / In-app alerts based on role
      if (type === 'ticket_created') {
        if (currentRole === 'admin') {
          window.showToast ? window.showToast(`New Issue Filed: #${data.id} (${data.department})`, 'info') : null;
        } else if (currentRole === 'department' && currentUser && (window.matchesDepartment ? window.matchesDepartment(data.department, currentUser.deptName) : currentUser.deptName === data.department)) {
          window.showToast ? window.showToast(`New Work Order Assigned: #${data.id}`, 'info') : null;
        }
      } else if (type === 'ticket_assigned') {
        if (currentRole === 'admin') {
          window.showToast ? window.showToast(`Issue #${data.id} assigned to ${data.department}`, 'info') : null;
        } else if (currentRole === 'department' && currentUser && (window.matchesDepartment ? window.matchesDepartment(data.department, currentUser.deptName) : currentUser.deptName === data.department)) {
          window.showToast ? window.showToast(`Work Order Reassigned: #${data.id} routed to your desk.`, 'info') : null;
        }
      } else if (type === 'ticket_fixed') {
        if (currentUser && data.studentId === currentUser.id) {
          window.showToast ? window.showToast(`Issue #${data.id} marked fixed! 48h verification countdown started.`, 'success') : null;
        }
      } else if (type === 'ticket_reopened') {
        if (currentRole === 'department' && currentUser && currentUser.deptName === data.department) {
          window.showToast ? window.showToast(`ALERT: Work Order #${data.id} was reopened by student!`, 'error') : null;
        }
      } else if (type === 'ticket_auto_closed') {
        if (currentUser && data.studentId === currentUser.id) {
          window.showToast ? window.showToast(`Issue #${data.id} auto-closed after 48 hours.`, 'info') : null;
        }
      }

      // Dispatch event to re-render all active dashboards
      window.dispatchEvent(new CustomEvent('campus:tickets-updated', { detail: ticketsCache }));
    }
  }

  window.CampusRealtime = new CampusRealtimeManager();

  window.fetchTicketsFromBackend = function () {
    return fetch('/api/tickets')
      .then(res => res.json())
      .then(dbTickets => {
        if (Array.isArray(dbTickets)) {
          ticketsCache = dbTickets;
          window.dispatchEvent(new CustomEvent('campus:tickets-updated', { detail: ticketsCache }));
          return dbTickets;
        }
        return ticketsCache;
      })
      .catch(err => {
        console.warn('[CampusRealtime] Fetch tickets notice:', err);
        return ticketsCache;
      });
  };

  window.getTickets = function () {
    if (!ticketsCacheLoaded) {
      ticketsCacheLoaded = true;
      window.fetchTicketsFromBackend();
    }
    return ticketsCache.length > 0 ? ticketsCache : INITIAL_TICKETS;
  };

  window.saveTickets = function (tickets, syncWithBackend = false) {
    if (Array.isArray(tickets)) {
      ticketsCache = tickets;
    }
    window.dispatchEvent(new CustomEvent('campus:tickets-updated', { detail: ticketsCache }));

    // Only send bulk array to backend if explicitly requested (e.g. legacy fallback),
    // avoiding duplicate requests when individual REST endpoints are used.
    if (syncWithBackend) {
      fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tickets)
      }).catch(e => console.warn('Backend ticket sync notice:', e));
    }
  };

  // Direct backend mutation helpers
  window.apiCreateTicket = function (ticketData) {
    return fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketData)
    }).then(res => res.json());
  };

  window.apiUpdateStatus = function (ticketId, status, notes = '') {
    return fetch(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    }).then(res => res.json());
  };

  window.apiAssignDept = function (ticketId, department, reason = '') {
    return fetch(`/api/tickets/${encodeURIComponent(ticketId)}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department, reason })
    }).then(res => res.json());
  };

  window.apiVerifyTicket = function (ticketId, decision, rating = 5, notes = '') {
    return fetch(`/api/tickets/${encodeURIComponent(ticketId)}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, rating, notes })
    }).then(res => res.json());
  };

  window.apiUpvoteTicket = function (ticketId) {
    return fetch(`/api/tickets/${encodeURIComponent(ticketId)}/upvote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).then(res => res.json());
  };

  window.getStudentTickets = function (studentId) {
    const tickets = window.getTickets();
    if (!studentId) {
      const session = window.getCurrentSession ? window.getCurrentSession() : null;
      studentId = session && session.user ? session.user.id : "2024CS0123";
    }
    return tickets.filter(t => t.studentId === studentId || (!t.studentId && t.studentName === 'Aarav K. Senapati' && studentId === '2024CS0123'));
  };

  // Helper: Update status of a ticket
  window.updateTicketStatus = function (ticketId, newStatus, note, meta = {}) {
    const tickets = window.getTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx !== -1) {
      tickets[idx].status = newStatus;
      if (meta.progress !== undefined) tickets[idx].progress = meta.progress;
      if (meta.currentStep) tickets[idx].currentStep = meta.currentStep;
      if (meta.slaRemaining) tickets[idx].slaRemaining = meta.slaRemaining;
      if (meta.category) tickets[idx].category = meta.category;
      if (note) {
        tickets[idx].notes = note;
        if (!tickets[idx].timeline) tickets[idx].timeline = [];
        tickets[idx].timeline.push({
          stage: newStatus.toUpperCase().replace(/_/g, ' '),
          time: "Just now",
          note: note
        });
      }
      window.saveTickets(tickets);
      return tickets[idx];
    }
    return null;
  };

  // Helper: Create a new dispatch order
  window.createDispatchOrder = function (orderData) {
    const tickets = window.getTickets();
    const id = "CP-" + Math.floor(1000 + Math.random() * 9000);
    const newTicket = {
      id,
      title: orderData.title || (orderData.location + " - Field Dispatch"),
      department: orderData.department,
      location: orderData.location,
      discipline: orderData.discipline || orderData.department,
      severity: orderData.severity || "moderate",
      status: "dispatched",
      category: orderData.severity === 'critical' ? 'critical' : 'field',
      slaRemaining: orderData.slaRemaining || (orderData.severity === 'critical' ? '30m Remaining' : '6h Remaining'),
      assignedCrew: orderData.assignedCrew || "Crew #01 (Lead)",
      crewInitials: (orderData.assignedCrew ? orderData.assignedCrew.slice(0, 2).toUpperCase() : "CR"),
      currentStep: "Dispatched to Site",
      progress: 25,
      studentName: orderData.studentName || "Campus Dispatch Ops",
      studentId: orderData.studentId || "DEPT-DISPATCH",
      isAnonymous: false,
      notes: orderData.notes || "Field dispatch order authorized via VHF CH-04.",
      upvotes: 1,
      upvoters: [],
      createdAt: Date.now(),
      timeline: [
        { stage: "Dispatched", time: "Just now", note: `Dispatched to ${orderData.assignedCrew || 'Field Crew'}.` }
      ]
    };
    tickets.unshift(newTicket);
    window.saveTickets(tickets);
    return newTicket;
  };

  // Official Campus Departments
  window.CAMPUS_DEPARTMENTS = [
    "Facility Maintenance & Plumbing",
    "Campus Electrical & Power",
    "Hostel Sanitation & Food Services",
    "IT & Campus Network Services",
    "SHE Complaint Cell",
    "Anti-Ragging Committee"
  ];

  // Helper: Match ticket department with logged-in user department
  window.matchesDepartment = function (ticketDept, userDept) {
    if (!ticketDept || !userDept) return false;
    const t = ticketDept.toLowerCase().trim();
    const u = userDept.toLowerCase().trim();
    if (t === u) return true;
    if ((u.includes('plumb') || u.includes('facility')) && (t.includes('plumb') || t.includes('facility') || t.includes('sanitation'))) return true;
    if ((u.includes('elect') || u.includes('power')) && (t.includes('elect') || t.includes('power'))) return true;
    if ((u.includes('it') || u.includes('network') || u.includes('wi-fi')) && (t.includes('it') || t.includes('network') || t.includes('wi-fi') || t.includes('wifi'))) return true;
    if ((u.includes('hostel') || u.includes('food') || u.includes('mess')) && (t.includes('hostel') || t.includes('food') || t.includes('mess'))) return true;
    if (u.includes('she') && t.includes('she')) return true;
    if (u.includes('ragging') && t.includes('ragging')) return true;
    return false;
  };

  // Helper: Identify recurring problem locations from live tickets
  window.computeRecurringMap = function (tickets) {
    const map = {};
    if (!Array.isArray(tickets)) return map;
    tickets.forEach(t => {
      if (t.status !== 'resolved') {
        const locKey = (t.location || '').toLowerCase().split('•')[0].trim();
        if (locKey) {
          map[locKey] = (map[locKey] || 0) + 1;
        }
      }
    });
    return map;
  };

  // --------------------------------------------------------------------------
  // Dashboard Navigation & Shell
  // --------------------------------------------------------------------------
  window.renderDashboard = function (user) {
    let viewport = document.getElementById('campus-dashboard-viewport');
    if (!viewport) {
      viewport = document.createElement('div');
      viewport.id = 'campus-dashboard-viewport';
      document.body.appendChild(viewport);
    }

    viewport.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Top Navigation Header inside Dashboard
    const roleBadges = {
      student: `<span class="px-2.5 py-1 rounded-full text-xs font-mono bg-[#06b6d4]/20 border border-[#06b6d4]/40 text-[#06b6d4] font-bold">STUDENT PORTAL</span>`,
      admin: `<span class="px-2.5 py-1 rounded-full text-xs font-mono bg-[#5D3136] border border-[#8a4048]/80 text-[#e8b4b8] font-bold">ADMIN ROOM</span>`,
      department: `<span class="px-2.5 py-1 rounded-full text-xs font-mono bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] font-bold">DEPARTMENT</span>`
    };

    let innerContent = '';
    if (user.role === 'student') {
      window.location.href = 'student-dashboard.html';
      return;
    } else if (user.role === 'admin') {
      window.location.href = 'admin-dashboard.html';
      return;
    } else if (user.role === 'department') {
      innerContent = buildDepartmentDashboardHTML(user);
    }

    viewport.innerHTML = `
      <!-- Dashboard Top Navbar -->
      <header class="sticky top-0 z-50 w-full bg-[#12090b]/95 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button onclick="window.closeDashboardView()" type="button" class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-mono text-white/80 hover:text-white transition cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            <span>Campus Map</span>
          </button>
          <div class="h-4 w-px bg-white/10 hidden sm:block"></div>
          <div class="flex items-center gap-2.5">
            <h1 class="font-cinematic font-bold text-base sm:text-lg text-white tracking-wide">CAMP(US)FIX</h1>
            ${roleBadges[user.role] || ''}
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="text-right hidden sm:block">
            <div class="text-xs font-medium text-white">${user.name}</div>
            <div class="text-[10px] font-mono text-[#e8b4b8]">${user.id}</div>
          </div>
          <button onclick="window.logout()" type="button" class="px-3.5 py-1.5 rounded-lg bg-[#5D3136]/60 hover:bg-[#5D3136] border border-[#8a4048]/50 text-xs font-mono text-white font-semibold transition cursor-pointer flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            <span>Logout</span>
          </button>
        </div>
      </header>

      <!-- Active Dashboard Content Viewport -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        ${innerContent}
      </main>
    `;

    // Bind dynamic actions
    attachDashboardListeners(user);
  };

  window.closeDashboardView = function () {
    const viewport = document.getElementById('campus-dashboard-viewport');
    if (viewport) {
      viewport.classList.remove('active');
    }
    document.body.style.overflow = '';
    // Reset hash without triggering authorization loop
    if (window.location.hash.startsWith('#dashboard-')) {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  };

  // --------------------------------------------------------------------------
  // 1. STUDENT DASHBOARD
  // --------------------------------------------------------------------------
  function buildStudentDashboardHTML(user) {
    const allTickets = window.getTickets();
    const myTickets = allTickets.filter(t => t.studentId === user.id);
    const resolvedCount = myTickets.filter(t => t.status === 'resolved').length;
    const activeCount = myTickets.filter(t => t.status !== 'resolved').length;
    const totalUpvotes = myTickets.reduce((acc, t) => acc + (t.upvotes || 0), 0);

    return `
      <!-- Student Banner -->
      <div class="glass-panel p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div class="space-y-2 relative z-10">
          <div class="flex items-center gap-2 font-mono text-xs text-[#06b6d4]">
            <span class="w-2 h-2 rounded-full bg-[#06b6d4] animate-ping"></span>
            <span>VERIFIED STUDENT STANDING • ACTIVE 2026</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">${user.name}</h2>
          <div class="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-mono text-white/70">
            <span>Roll No: <strong class="text-[#e8b4b8]">${user.id}</strong></span>
            <span>•</span>
            <span>Dept: <strong class="text-white">${user.department || 'Undergraduate Engineering'}</strong></span>
            <span>•</span>
            <span>Residence: <strong class="text-white">${user.hostel || 'Hostel Block 4'}</strong></span>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0 relative z-10">
          <button onclick="window.openNewTicketModal()" type="button" class="px-5 py-3 rounded-xl bg-gradient-to-r from-[#5D3136] to-[#8a4048] hover:from-[#733c43] hover:to-[#9e4a53] text-white font-mono text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-[#5D3136]/40 flex items-center gap-2 cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            <span>File New Grievance</span>
          </button>
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">My Active Tickets</span>
          <div class="text-2xl font-bold text-white">${activeCount}</div>
          <div class="text-[11px] text-[#f59e0b] font-mono">Under rapid resolution</div>
        </div>
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Verified Resolved</span>
          <div class="text-2xl font-bold text-[#10b981]">${resolvedCount}</div>
          <div class="text-[11px] text-white/50 font-mono">100% audited closure</div>
        </div>
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Peer Upvotes</span>
          <div class="text-2xl font-bold text-[#06b6d4]">${totalUpvotes}</div>
          <div class="text-[11px] text-white/50 font-mono">Campus impact score</div>
        </div>
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Zero-Trace Shield</span>
          <div class="text-2xl font-bold text-[#e8b4b8]">SHA-256</div>
          <div class="text-[11px] text-[#10b981] font-mono">Anonymous masking armed</div>
        </div>
      </div>

      <!-- Main Tabs: My Grievances & Campus Public Feed -->
      <div class="space-y-6">
        <div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div class="flex items-center gap-2">
            <button id="tab-btn-my-tickets" onclick="window.switchStudentTab('my')" type="button" class="dash-tab-btn active px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold transition cursor-pointer border border-transparent">
              My Filed Grievances (${myTickets.length})
            </button>
            <button id="tab-btn-feed-tickets" onclick="window.switchStudentTab('feed')" type="button" class="dash-tab-btn px-4 py-2 rounded-lg font-mono text-xs uppercase font-bold transition text-white/70 hover:text-white cursor-pointer border border-transparent">
              Campus Peer Feed (${allTickets.length})
            </button>
          </div>
          <span class="text-xs font-mono text-white/50 hidden sm:inline-block">Auto-refreshed every 15s</span>
        </div>

        <!-- Tab 1: My Grievances (With Stepper) -->
        <div id="student-view-my-tickets" class="space-y-4">
          ${myTickets.length === 0 ? `
            <div class="glass-panel p-12 text-center text-white/50 space-y-3 font-mono text-xs">
              <p>You have not filed any campus grievances yet.</p>
              <button onclick="window.openNewTicketModal()" class="px-4 py-2 rounded-lg bg-[#5D3136] text-white font-bold hover:bg-[#8a4048] transition cursor-pointer">
                + File Your First Campus Ticket
              </button>
            </div>
          ` : myTickets.map(t => renderStudentTicketCard(t, user)).join('')}
        </div>

        <!-- Tab 2: Campus Peer Feed -->
        <div id="student-view-feed-tickets" class="space-y-4 hidden">
          ${allTickets.map(t => renderPeerTicketCard(t, user)).join('')}
        </div>
      </div>
    `;
  }

  function renderStudentTicketCard(t, user) {
    const isCompleted = t.status === 'resolved';
    const stages = ["Submitted", "Dispatched", "In Progress", "Resolved"];
    const currentIdx = stages.indexOf(
      t.status === 'pending' ? 'Submitted' : (t.status === 'dispatched' ? 'Dispatched' : (t.status === 'in_progress' ? 'In Progress' : 'Resolved'))
    );

    return `
      <div class="glass-panel p-6 space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-xs text-[#e8b4b8] font-bold">${t.id}</span>
              <span class="badge-status badge-${t.status.replace('-', '_')}">${t.status.replace('_', ' ')}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border severity-${t.severity}">${t.severity}</span>
            </div>
            <h3 class="text-lg font-bold text-white">${t.title}</h3>
            <div class="text-xs font-mono text-white/60 flex items-center gap-3">
              <span>📍 ${t.location}</span>
              <span>•</span>
              <span>🏢 ${t.department}</span>
            </div>
          </div>
          <div class="text-right sm:text-right shrink-0">
            <div class="text-xs font-mono text-white/40">Technician Assigned</div>
            <div class="text-xs font-mono font-bold text-white/90">${t.assignedCrew || 'Dispatched on Standby'}</div>
          </div>
        </div>

        <!-- 4-Stage Stepper -->
        <div class="ticket-stepper px-4 py-2 bg-black/30 rounded-xl border border-white/[0.04]">
          ${stages.map((stage, idx) => {
            let statusClass = '';
            if (idx < currentIdx) statusClass = 'completed';
            else if (idx === currentIdx) statusClass = isCompleted ? 'completed' : 'current';

            return `
              <div class="step-node ${statusClass}">
                <div class="step-dot">${idx < currentIdx || (idx === currentIdx && isCompleted) ? '✓' : (idx + 1)}</div>
                <span class="text-[10px] font-mono tracking-wider text-white/70">${stage}</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Bottom Notes -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-white/60 pt-2 border-t border-white/[0.05]">
          <div>Latest Telemetry: <span class="text-white/90">${t.notes || 'Awaiting initial inspector dispatch.'}</span></div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[#06b6d4] font-bold">▲ ${t.upvotes} student endorsements</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderPeerTicketCard(t, user) {
    const hasUpvoted = (t.upvoters || []).includes(user.id);
    return `
      <div class="glass-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="space-y-1.5 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-xs text-[#e8b4b8] font-bold">${t.id}</span>
            <span class="badge-status badge-${t.status.replace('-', '_')}">${t.status.replace('_', ' ')}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border severity-${t.severity}">${t.severity}</span>
          </div>
          <h4 class="text-base font-bold text-white">${t.title}</h4>
          <p class="text-xs font-mono text-white/60">📍 ${t.location} • Dispatched to: <strong class="text-white/90">${t.department}</strong></p>
        </div>

        <button onclick="window.upvoteTicket('${t.id}')" type="button" class="px-4 py-2 rounded-lg font-mono text-xs transition flex items-center gap-2 shrink-0 cursor-pointer ${
          hasUpvoted ? 'bg-[#06b6d4]/20 border border-[#06b6d4]/40 text-[#06b6d4]' : 'bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white/80'
        }">
          <span>▲ Endorse Priority</span>
          <span class="font-bold px-1.5 py-0.5 rounded bg-black/40">${t.upvotes || 0}</span>
        </button>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // 2. ADMIN ROOM
  // --------------------------------------------------------------------------
  function buildAdminDashboardHTML(user) {
    const tickets = window.getTickets();
    const criticalCount = tickets.filter(t => t.severity === 'critical' && t.status !== 'resolved').length;
    const pendingCount = tickets.filter(t => t.status === 'pending').length;
    const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

    return `
      <!-- Admin Room Command Header -->
      <div class="glass-panel glass-panel-highlight p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div class="space-y-2 relative z-10">
          <div class="flex items-center gap-2 font-mono text-xs text-[#e8b4b8]">
            <span class="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse"></span>
            <span>CENTRAL OMBUDSMAN & PROCTORIAL COMMAND HUD</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">${user.name}</h2>
          <div class="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-mono text-white/70">
            <span>Role: <strong class="text-[#e8b4b8]">${user.title || 'Dean of Student Affairs'}</strong></span>
            <span>•</span>
            <span>Clearance: <strong class="text-[#10b981]">${user.clearance || 'Level 4 Sovereign'}</strong></span>
            <span>•</span>
            <span>Auth Node: <strong class="text-white">${user.id}</strong></span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 relative z-10">
          <button onclick="window.openBroadcastModal()" type="button" class="px-4 py-2.5 rounded-xl bg-[#b91c1c] hover:bg-[#dc2626] text-white font-mono text-xs uppercase font-bold tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer">
            <span>📢 Broadcast Campus Emergency Alert</span>
          </button>
        </div>
      </div>

      <!-- Campus-Wide KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Critical Emergencies</span>
          <div class="text-2xl font-bold text-[#ef4444]">${criticalCount}</div>
          <div class="text-[11px] text-[#ef4444] font-mono">Immediate proctorial escalation</div>
        </div>
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Pending Assignment</span>
          <div class="text-2xl font-bold text-[#f59e0b]">${pendingCount}</div>
          <div class="text-[11px] text-white/50 font-mono">Awaiting department sign-off</div>
        </div>
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Total Audited Resolved</span>
          <div class="text-2xl font-bold text-[#10b981]">${resolvedCount}</div>
          <div class="text-[11px] text-[#10b981] font-mono">SLA Adherence: 99.4%</div>
        </div>
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Active Departments</span>
          <div class="text-2xl font-bold text-[#06b6d4]">5 Wings</div>
          <div class="text-[11px] text-white/50 font-mono">Full GIS geofence coverage</div>
        </div>
      </div>

      <!-- Master Incident Management Console -->
      <div class="glass-panel p-6 space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
              <span>Master Incident Console</span>
              <span class="text-xs font-mono text-[#e8b4b8] font-normal">(${tickets.length} Registered Records)</span>
            </h3>
            <p class="text-xs font-mono text-white/60 mt-0.5">Real-time statutory grievance audit and department intervention</p>
          </div>
          
          <div class="flex items-center gap-2 font-mono text-xs">
            <select id="admin-filter-dept" onchange="window.filterAdminTable()" class="bg-[#12090b] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none">
              <option value="all">All Departments</option>
              ${window.CAMPUS_DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Interactive Incident Table -->
        <div class="overflow-x-auto">
          <table class="campus-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Incident Details</th>
                <th>Department</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Student Identity</th>
                <th class="text-right">Executive Authority</th>
              </tr>
            </thead>
            <tbody id="admin-table-body">
              ${tickets.map(t => renderAdminTableRow(t)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAdminTableRow(t) {
    const studentLabel = t.isAnonymous 
      ? `<span class="px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.1] text-white/60 font-mono text-[11px]">Zero-Trace Shield (Masked)</span>`
      : `<span class="font-mono text-xs text-white/90">${t.studentName || t.studentId}</span>`;

    return `
      <tr id="admin-row-${t.id}">
        <td class="font-mono text-xs font-bold text-[#e8b4b8]">${t.id}</td>
        <td>
          <div class="font-bold text-white text-sm">${t.title}</div>
          <div class="text-[11px] font-mono text-white/50">📍 ${t.location}</div>
        </td>
        <td class="font-mono text-xs text-white/80">${t.department}</td>
        <td>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border severity-${t.severity}">${t.severity}</span>
        </td>
        <td>
          <span class="badge-status badge-${t.status.replace('-', '_')}">${t.status.replace('_', ' ')}</span>
        </td>
        <td>${studentLabel}</td>
        <td class="text-right">
          <div class="flex items-center justify-end gap-1.5 font-mono text-xs">
            <button onclick="window.adminEscalateTicket('${t.id}')" type="button" class="px-2.5 py-1 rounded bg-[#a855f7]/20 hover:bg-[#a855f7]/30 border border-[#a855f7]/40 text-[#d8b4fe] transition cursor-pointer" title="Escalate to Ombudsman">
              ⚖️ Escalate
            </button>
            <button onclick="window.adminReassignDept('${t.id}')" type="button" class="px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white/80 transition cursor-pointer" title="Reassign Department">
              ⇄ Transfer
            </button>
            <button onclick="window.adminForceResolve('${t.id}')" type="button" class="px-2.5 py-1 rounded bg-[#10b981]/20 hover:bg-[#10b981]/30 border border-[#10b981]/40 text-[#6ee7b7] transition cursor-pointer" title="Executive Closure">
              ✓ Resolve
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  // --------------------------------------------------------------------------
  // 3. DEPARTMENT (FILTERED BY LOGGED-IN DEPARTMENT)
  // --------------------------------------------------------------------------
  function buildDepartmentDashboardHTML(user) {
    const allTickets = window.getTickets();
    // Strictly filter to the current department
    const deptTickets = allTickets.filter(t => t.department.toLowerCase() === (user.deptName || '').toLowerCase());
    const openCount = deptTickets.filter(t => t.status !== 'resolved').length;
    const inProgressCount = deptTickets.filter(t => t.status === 'in_progress').length;
    const resolvedCount = deptTickets.filter(t => t.status === 'resolved').length;

    return `
      <!-- Department Header -->
      <div class="glass-panel p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div class="space-y-2 relative z-10">
          <div class="flex items-center gap-2 font-mono text-xs text-[#10b981]">
            <span class="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-ping"></span>
            <span>FIELD OPERATIONS DESK • TELEMETRY ACTIVE</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">${user.deptName}</h2>
          <div class="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-mono text-white/70">
            <span>Station ID: <strong class="text-[#e8b4b8]">${user.id}</strong></span>
            <span>•</span>
            <span>Duty Lead: <strong class="text-white">${user.name}</strong></span>
            <span>•</span>
            <span>Division: <strong class="text-white">${user.division || 'Quadrant Rapid Response'}</strong></span>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0 relative z-10">
          <div class="p-3 rounded-xl bg-black/40 border border-white/[0.08] text-right font-mono text-xs">
            <span class="text-white/40 block text-[10px] uppercase">Department Active SLA</span>
            <span class="text-[#10b981] font-bold text-sm">3.4 min Target</span>
          </div>
        </div>
      </div>

      <!-- Department Metrics -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Active Work Orders</span>
          <div class="text-2xl font-bold text-[#f59e0b]">${openCount}</div>
          <div class="text-[11px] text-white/50 font-mono">Assigned to field roster</div>
        </div>
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Crews In-Action</span>
          <div class="text-2xl font-bold text-[#06b6d4]">${inProgressCount}</div>
          <div class="text-[11px] text-[#06b6d4] font-mono">On-site repairs underway</div>
        </div>
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Closed Work Orders</span>
          <div class="text-2xl font-bold text-[#10b981]">${resolvedCount}</div>
          <div class="text-[11px] text-[#10b981] font-mono">Student-audited closure</div>
        </div>
        <div class="glass-panel p-4 space-y-1">
          <span class="font-mono text-[10px] text-white/60 uppercase">Field Inventory</span>
          <div class="text-2xl font-bold text-[#e8b4b8]">100% Stock</div>
          <div class="text-[11px] text-white/50 font-mono">Spare parts verified</div>
        </div>
      </div>

      <!-- Work Orders Queue -->
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 class="text-lg font-bold text-white font-mono uppercase tracking-wide">
            Dispatched Work Orders Queue (${deptTickets.length})
          </h3>
          <span class="text-xs font-mono text-white/50">Restricted to ${user.deptName}</span>
        </div>

        ${deptTickets.length === 0 ? `
          <div class="glass-panel p-12 text-center text-white/50 space-y-2 font-mono text-xs">
            <p>✓ All work orders for ${user.deptName} have been resolved. Zero backlog.</p>
          </div>
        ` : deptTickets.map(t => renderDepartmentWorkOrderCard(t)).join('')}
      </div>
    `;
  }

  function renderDepartmentWorkOrderCard(t) {
    return `
      <div class="glass-panel p-6 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-xs text-[#e8b4b8] font-bold">${t.id}</span>
              <span class="badge-status badge-${t.status.replace('-', '_')}">${t.status.replace('_', ' ')}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border severity-${t.severity}">${t.severity}</span>
            </div>
            <h4 class="text-lg font-bold text-white">${t.title}</h4>
            <div class="text-xs font-mono text-white/60 flex items-center gap-3">
              <span>📍 ${t.location}</span>
              <span>•</span>
              <span>Priority Endorsements: <strong class="text-[#06b6d4]">▲ ${t.upvotes}</strong></span>
            </div>
          </div>

          <div class="text-right shrink-0 font-mono text-xs">
            <div class="text-white/40">Current Crew:</div>
            <div class="font-bold text-white/90">${t.assignedCrew || 'Unassigned'}</div>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-black/40 border border-white/[0.05] text-xs font-mono text-white/70">
          <strong>Repair Notes:</strong> ${t.notes || 'No preliminary notes filed.'}
        </div>

        <!-- Action Control Buttons for Department Staff -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
          <div class="text-[11px] font-mono text-white/50">
            SLA Clock: <span class="text-[#10b981] font-bold">Within Standard Operating SLA (±4m)</span>
          </div>

          <div class="flex items-center gap-2 font-mono text-xs">
            ${t.status === 'pending' ? `
              <button onclick="window.deptUpdateStatus('${t.id}', 'dispatched')" type="button" class="px-3 py-1.5 rounded-lg bg-[#06b6d4]/20 hover:bg-[#06b6d4]/30 border border-[#06b6d4]/40 text-[#67e8f9] font-bold transition cursor-pointer">
                Acknowledge & Dispatch Crew
              </button>
            ` : ''}

            ${t.status === 'dispatched' ? `
              <button onclick="window.deptUpdateStatus('${t.id}', 'in_progress')" type="button" class="px-3 py-1.5 rounded-lg bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 border border-[#f59e0b]/40 text-[#fcd34d] font-bold transition cursor-pointer">
                Start Repair (Mark In Progress)
              </button>
            ` : ''}

            ${(t.status === 'fixed' || t.status === 'verification_required') ? `
              <div class="flex items-center gap-2">
                <span class="px-3 py-1.5 rounded-lg bg-[#f59e0b]/20 border border-[#f59e0b]/40 text-[#fcd34d] font-bold text-xs">
                  ⏳ Awaiting Student Sign-Off (48h Window Active)
                </span>
              </div>
            ` : (t.status !== 'resolved') ? `
              <button onclick="window.deptPromptCompleteModal('${t.id}')" type="button" class="px-3 py-1.5 rounded-lg bg-[#10b981]/20 hover:bg-[#10b981]/30 border border-[#10b981]/40 text-[#6ee7b7] font-bold transition cursor-pointer">
                ✓ Mark Fixed (Handoff to Student)
              </button>
            ` : `
              <span class="text-[#10b981] font-bold">✓ Signed-Off &amp; Audited</span>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // Interactive Actions & Mutation Controllers
  // --------------------------------------------------------------------------
  function attachDashboardListeners(user) {
    // Tab switching for student
    window.switchStudentTab = function (tab) {
      const myView = document.getElementById('student-view-my-tickets');
      const feedView = document.getElementById('student-view-feed-tickets');
      const myBtn = document.getElementById('tab-btn-my-tickets');
      const feedBtn = document.getElementById('tab-btn-feed-tickets');

      if (!myView || !feedView) return;

      if (tab === 'my') {
        myView.classList.remove('hidden');
        feedView.classList.add('hidden');
        myBtn.classList.add('active');
        feedBtn.classList.remove('active');
      } else {
        myView.classList.add('hidden');
        feedView.classList.remove('hidden');
        myBtn.classList.remove('active');
        feedBtn.classList.add('active');
      }
    };

    // Upvoting ticket
    window.upvoteTicket = function (ticketId) {
      const tickets = window.getTickets();
      const t = tickets.find(x => x.id === ticketId);
      if (!t) return;

      t.upvoters = t.upvoters || [];
      if (t.upvoters.includes(user.id)) {
        t.upvoters = t.upvoters.filter(uid => uid !== user.id);
        t.upvotes = Math.max(0, (t.upvotes || 1) - 1);
        window.showToast("Priority endorsement retracted.", "info");
      } else {
        t.upvoters.push(user.id);
        t.upvotes = (t.upvotes || 0) + 1;
        window.showToast(`Endorsed priority for Ticket #${ticketId}. Priority escalated.`, "success");
      }

      window.saveTickets(tickets);
      window.renderDashboard(user);
    };

    // Admin Escalate
    window.adminEscalateTicket = function (ticketId) {
      const tickets = window.getTickets();
      const t = tickets.find(x => x.id === ticketId);
      if (!t) return;

      t.status = 'escalated';
      t.notes = "Formally escalated to Central Campus Ombudsman & Statutory ICC Committee by Dean Sharma.";
      window.saveTickets(tickets);
      window.showToast(`Ticket #${ticketId} escalated to Central Ombudsman.`, "warning");
      window.renderDashboard(user);
    };

    // Admin Reassign Department
    window.adminReassignDept = function (ticketId) {
      const deptOptions = window.CAMPUS_DEPARTMENTS.join('\n- ');
      const newDept = prompt(`Enter target Department Name:\n- ${deptOptions}`);
      if (!newDept || !window.CAMPUS_DEPARTMENTS.includes(newDept.trim())) {
        if (newDept) alert("Invalid Department specified. Please select from registered campus divisions.");
        return;
      }

      const tickets = window.getTickets();
      const t = tickets.find(x => x.id === ticketId);
      if (t) {
        t.department = newDept.trim();
        t.notes = `Executive Reassignment: Routed to ${t.department} by Dean.`;
        window.saveTickets(tickets, false);
        if (window.apiAssignDept) {
          window.apiAssignDept(ticketId, t.department, 'Executive Reassignment by Dean').catch(e => console.warn(e));
        }
        window.showToast(`Ticket #${ticketId} reassigned to ${t.department}`, "success");
        window.renderDashboard(user);
      }
    };

    // Admin Force Resolve
    window.adminForceResolve = function (ticketId) {
      const tickets = window.getTickets();
      const t = tickets.find(x => x.id === ticketId);
      if (t) {
        t.status = 'resolved';
        t.notes = "Executive closure signed-off with zero-defect validation.";
        window.saveTickets(tickets, false);
        if (window.apiUpdateStatus) {
          window.apiUpdateStatus(ticketId, 'resolved', 'Executive closure signed-off with zero-defect validation.').catch(e => console.warn(e));
        }
        window.showToast(`Ticket #${ticketId} closed under Executive Authority.`, "success");
        window.renderDashboard(user);
      }
    };

    // Department Work Order Status Updates
    window.deptUpdateStatus = function (ticketId, nextStatus) {
      const tickets = window.getTickets();
      const t = tickets.find(x => x.id === ticketId);
      if (!t) return;

      let note = "";
      t.status = nextStatus;
      if (nextStatus === 'dispatched') {
        t.assignedCrew = `${user.name} (Lead) • Unit #01`;
        note = `Technician dispatched to ${t.location}.`;
        t.notes = note;
      } else if (nextStatus === 'in_progress') {
        note = `Repair physically initiated on-site by ${user.name}.`;
        t.notes = note;
      }

      window.saveTickets(tickets, false);
      if (window.apiUpdateStatus) {
        window.apiUpdateStatus(ticketId, nextStatus, note).catch(e => console.warn(e));
      }
      window.showToast(`Ticket #${ticketId} updated to ${nextStatus.toUpperCase()}`, "info");
      window.renderDashboard(user);
    };

    // Department Sign-off Modal Prompt (Marks Fixed - student must verify or auto-closes in 48h)
    window.deptPromptCompleteModal = function (ticketId) {
      const notes = prompt("Enter Work-Order Completion Notes & Components Replaced:", "Replaced worn gasket, pressure tested main line, zero residual leaks verified.");
      if (notes === null) return;

      const tickets = window.getTickets();
      const t = tickets.find(x => x.id === ticketId);
      if (t) {
        const now = Date.now();
        t.status = 'fixed';
        t.fixedAt = now;
        t.verificationDeadline = now + (48 * 3600 * 1000);
        t.progress = 90;
        t.notes = `[Marked Fixed by ${user.name}]: ${notes}`;
        if (!t.timeline) t.timeline = [];
        t.timeline.push({
          stage: 'Fixed — Awaiting Student Verification',
          time: 'Just now',
          note: `Field technician marked fixed: ${notes}. 48-hour student verification active.`
        });
        window.saveTickets(tickets, false);
        if (window.apiUpdateStatus) {
          window.apiUpdateStatus(ticketId, 'fixed', notes).catch(e => console.warn(e));
        }
        window.showToast(`Work Order #${ticketId} marked fixed! Student has 48h to verify.`, "success");
        window.renderDashboard(user);
      }
    };

    // Admin Filter Table
    window.filterAdminTable = function () {
      const select = document.getElementById('admin-filter-dept');
      if (!select) return;
      const dept = select.value;
      const tickets = window.getTickets();
      const filtered = dept === 'all' ? tickets : tickets.filter(t => t.department === dept);
      const tbody = document.getElementById('admin-table-body');
      if (tbody) {
        tbody.innerHTML = filtered.map(t => renderAdminTableRow(t)).join('');
      }
    };
  }

  // --------------------------------------------------------------------------
  // Modals: "File New Grievance" (Student) & "Broadcast Alert" (Admin)
  // --------------------------------------------------------------------------
  window.openNewTicketModal = function () {
    let modal = document.getElementById('new-ticket-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'new-ticket-modal';
      modal.className = 'fixed inset-0 z-[1200] bg-black/85 backdrop-blur-md flex items-center justify-center p-4';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="glass-panel p-6 sm:p-8 max-w-lg w-full space-y-5 border border-[#8a4048]/50 shadow-2xl relative">
        <div class="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h3 class="text-xl font-bold text-white">File Institutional Grievance</h3>
            <p class="text-xs font-mono text-white/60">Zero-trace encrypted dispatch to campus facilities</p>
          </div>
          <button onclick="document.getElementById('new-ticket-modal').remove()" class="text-white/60 hover:text-white text-lg">✕</button>
        </div>

        <form id="form-file-ticket" onsubmit="window.handleFileTicketSubmit(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-mono uppercase text-[#e8b4b8] mb-1">Issue Title</label>
            <input type="text" id="ticket-input-title" required placeholder="e.g. Broken corridor light outside lab 204" class="w-full px-3.5 py-2.5 bg-[#0e0709] rounded-lg border border-white/[0.12] text-white font-sans text-xs focus:border-[#8a4048] focus:outline-none"/>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-mono uppercase text-[#e8b4b8] mb-1">Department</label>
              <select id="ticket-input-dept" required class="w-full px-3 py-2.5 bg-[#0e0709] rounded-lg border border-white/[0.12] text-white font-mono text-xs focus:border-[#8a4048] focus:outline-none">
                ${window.CAMPUS_DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-mono uppercase text-[#e8b4b8] mb-1">Severity</label>
              <select id="ticket-input-severity" required class="w-full px-3 py-2.5 bg-[#0e0709] rounded-lg border border-white/[0.12] text-white font-mono text-xs focus:border-[#8a4048] focus:outline-none">
                <option value="low">Low (Standard)</option>
                <option value="moderate" selected>Moderate</option>
                <option value="high">High (Urgent)</option>
                <option value="critical">Critical (Safety Risk)</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-mono uppercase text-[#e8b4b8] mb-1">Campus Location / Geofence</label>
            <input type="text" id="ticket-input-loc" required placeholder="e.g. Hostel Block 4, 2nd Floor West Wing" class="w-full px-3.5 py-2.5 bg-[#0e0709] rounded-lg border border-white/[0.12] text-white font-mono text-xs focus:border-[#8a4048] focus:outline-none"/>
          </div>

          <div class="flex items-center gap-2 p-3 bg-white/[0.03] rounded-lg border border-white/[0.08]">
            <input type="checkbox" id="ticket-input-anon" class="rounded bg-[#0e0709] border-white/20 text-[#5D3136] focus:ring-0 cursor-pointer"/>
            <label for="ticket-input-anon" class="text-xs font-mono text-white/80 cursor-pointer">
              Enable Zero-Trace Privacy Mask (Hide student roll number from technician)
            </label>
          </div>

          <div class="pt-2 flex justify-end gap-3">
            <button type="button" onclick="document.getElementById('new-ticket-modal').remove()" class="px-4 py-2 rounded-lg bg-white/[0.05] text-white/70 font-mono text-xs">
              Cancel
            </button>
            <button type="submit" class="px-5 py-2 rounded-lg bg-gradient-to-r from-[#5D3136] to-[#8a4048] text-white font-mono text-xs font-bold uppercase cursor-pointer">
              Dispatch Ticket
            </button>
          </div>
        </form>
      </div>
    `;
  };

  window.handleFileTicketSubmit = function (e) {
    e.preventDefault();
    const session = window.getCurrentSession();
    if (!session) return;

    const title = document.getElementById('ticket-input-title').value.trim();
    const dept = document.getElementById('ticket-input-dept').value;
    const severity = document.getElementById('ticket-input-severity').value;
    const loc = document.getElementById('ticket-input-loc').value.trim();
    const isAnon = document.getElementById('ticket-input-anon').checked;

    const newTicket = {
      id: "TCK-2026-" + Math.floor(1000 + Math.random() * 9000),
      title,
      department: dept,
      location: loc,
      severity,
      status: "pending",
      studentId: session.user.id,
      studentName: isAnon ? "Anonymous Student" : session.user.name,
      isAnonymous: isAnon,
      assignedCrew: "Unassigned (Dispatched to queue)",
      upvotes: 1,
      upvoters: [session.user.id],
      createdAt: Date.now(),
      notes: "Newly filed ticket. Automated SLA clock initiated.",
      timeline: [
        { stage: "Submitted", time: "Just now", note: "Routed into institutional stream." }
      ]
    };

    const tickets = window.getTickets();
    tickets.unshift(newTicket);
    window.saveTickets(tickets);

    document.getElementById('new-ticket-modal').remove();
    window.showToast(`Ticket #${newTicket.id} registered and dispatched to ${dept}!`, "success");
    window.renderDashboard(session.user);
  };

  window.openBroadcastModal = function () {
    const alertMsg = prompt("Enter Emergency Announcement to Broadcast across University Shell:", "SEVERE WEATHER ADVISORY: Outdoor sports & quad activities suspended until further notice.");
    if (!alertMsg) return;

    let banner = document.getElementById('campus-emergency-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'campus-emergency-banner';
      banner.className = 'w-full bg-[#b91c1c] text-white px-4 py-2 text-xs font-mono font-bold flex items-center justify-between sticky top-0 z-[1300] shadow-md';
      document.body.prepend(banner);
    }

    banner.innerHTML = `
      <div class="flex items-center gap-2 max-w-7xl mx-auto w-full">
        <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
        <span>CAMPUS EMERGENCY BULLETIN:</span>
        <span class="font-normal text-white/90">${alertMsg}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-auto text-white/70 hover:text-white">✕</button>
      </div>
    `;

    window.showToast("Emergency campus broadcast published successfully!", "warning");
  };

})();
