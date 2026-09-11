# 🏛️ CAMP(US) FIX — Institutional Campus Issue Resolution & AI Operations Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-campus--fix--20547.web.app-00C781?style=for-the-badge&logo=firebase&logoColor=white)](https://campus-fix-20547.web.app)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Firebase](https://img.shields.io/badge/Firebase_Realtime_Sync-FFA611?style=for-the-badge&logo=firebase&logoColor=white)](https://firebase.google.com)
[![WebSocket](https://img.shields.io/badge/WebSockets-Real--Time-blueviolet?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)

> **CAMP(US) FIX** is an enterprise-grade, real-time campus operations platform that empowers university students to report infrastructure, safety, and operational issues. Using NLP and statistical clustering, it automatically identifies recurring problem hotspots, calculates multi-factor priority scores, dispatches work orders to responsible departments, and enforces a closed-loop resolution verification lifecycle.

---

## 🌐 Live Production URL

🚀 **Deployed Platform:** **[https://campus-fix-20547.web.app](https://campus-fix-20547.web.app)**  
*(Instant cloud synchronization active across all devices and browsers)*

---

## 🔑 Demo Credentials (Ready for Testing)

| Portal / Role | User ID | Password | Access Capabilities |
|---|---|---|---|
| 🎓 **Student Portal** | `2024CS0123` | `StudentPass@2026` | Report issues, upload photos, pin GPS locations, upvote community tickets, verify repairs. |
| 🛡️ **Admin Room** | `EMP-ADM-001` | `AdminDean@2026` | Full oversight, reassign departments, audit campus analytics, export CSV reports. |
| 🔧 **Department** *(Plumbing)* | `DEPT-PLUMB-04` | `DeptOps@2026` | Work queue management, field dispatch, status transitions (`In Progress` → `Fixed`). |
| ⚡ **Department** *(Electrical)* | `DEPT-ELECT-02` | `DeptOps@2026` | Department-scoped work order queue, SLA countdown tracking. |
| 🚨 **SOS Desk** | *Public / Anonymous* | *None* | 24/7 emergency hotline, SHE Complaint Cell, and Anti-Ragging rapid response. |

---

## 🎯 Problem Statement Fulfillment

| Problem Requirement | CAMP(US) FIX Solution Architecture | Status |
|---|---|:---:|
| **1. Student Reporting** | Mobile-responsive intake with interactive Leaflet GIS map pin-dropping, category tagger, and photographic proof upload. | ✅ **Complete** |
| **2. Recurring Issue Detection** | `campus-ai.js` runs Jaccard n-gram token similarity (`detectDuplicates()`) to warn users during submission and clusters recurring hotspots by building coordinate bounds. | ✅ **Complete** |
| **3. AI Prioritization** | Multi-factor dynamic scoring (0–100) combining base severity, safety hazard keywords, student upvotes, recurrence count, and SLA time decay. | ✅ **Complete** |
| **4. Department Routing** | NLP keyword classification routes issues automatically to Plumbing, Electrical, IT, Hostel Sanitation, or Safety Committees. Admins retain 1-click reassignment overrides. | ✅ **Complete** |
| **5. Resolution Tracking** | State machine: `Submitted` ➔ `Dispatched` ➔ `In Progress` ➔ `Fixed` (48-Hour Student Verification Window) ➔ `Resolved` via student sign-off or auto-close daemon. | ✅ **Complete** |

---

## 🏗️ System Architecture

```
[ Student Device ]        [ Admin Console ]        [ Department Crews ]
        │                         │                          │
        └──────────────┬──────────┴──────────────┬───────────┘
                       │                         │
                       ▼                         ▼
         ┌────────────────────────┐    ┌────────────────────────┐
         │ Firebase Realtime Sync │    │ FastAPI ASGI WebSocket │
         │   (Cloud Multi-Client) │    │      (/ws Broadcast)   │
         └─────────────┬──────────┘    └────────────┬───────────┘
                       │                            │
                       └──────────────┬─────────────┘
                                      │
                                      ▼
                        ┌──────────────────────────┐
                        │   Campus AI Engine       │
                        │ • Jaccard Duplicate Scan │
                        │ • NLP Category Router    │
                        │ • Multi-Factor Priority  │
                        └─────────────┬────────────┘
                                      │
                                      ▼
                        ┌──────────────────────────┐
                        │ Persistent SQLite / WAL  │
                        │ • 8 Relational Tables    │
                        │ • 48h Auto-Close Daemon  │
                        └──────────────────────────┘
```

---

## 💼 Startup Business Model & Monetization

1. **B2B University SaaS Subscription**:
   - Tiered annual licensing based on campus student enrollment ($5,000–$25,000/year per campus).
2. **Preventative Maintenance Analytics**:
   - Institutional heatmaps identify chronic infrastructure failure points before catastrophic pipe bursts or electrical outages occur, saving universities millions in emergency repair bills.
3. **Regulatory Safety & Compliance (NAAC/NIRF/AICTE)**:
   - Automated audit logs for SHE (Sexual Harassment Elimination) and Anti-Ragging compliance required for institutional accreditation.

---

## 🛠️ Local Development & Testing

```bash
# 1. Clone the repository
git clone https://github.com/Palakchoithani/Camp-us-_Fix.git
cd "CAMP(US) FIX"

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start local development server
python3 server.py

# 4. Run automated production verification suite
python3 tests/verify_production.py
```

---

## 📄 License
Released under the **MIT License**. Built for university campus operational excellence.
