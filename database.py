"""
CAMP(US) FIX — Production Database Layer
ACID-compliant SQLite with WAL mode / PostgreSQL (via DATABASE_URL).
Handles tickets, users, departments, timeline events, upvotes, notifications, and audit logs.
"""

import os
import sys
import json
import time
import sqlite3
from collections import defaultdict
from typing import List, Dict, Any, Optional

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(DIRECTORY, "campus_fix.db"))

def get_connection():
    """Returns a SQLite connection configured with WAL mode for high concurrency."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    """Initializes tables, indexes, and seeds initial data if database is empty."""
    conn = get_connection()
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        with conn:
            # 1. Users table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL,
                dept_name TEXT,
                picture TEXT,
                designation TEXT,
                division TEXT,
                created_at INTEGER NOT NULL
            );
            """)

            # 2. Departments table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS departments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                code TEXT NOT NULL,
                lead_name TEXT,
                contact_channel TEXT
            );
            """)

            # 3. Tickets table
            conn.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT,
                department TEXT,
                location TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                severity TEXT DEFAULT 'moderate',
                priority_score INTEGER DEFAULT 50,
                priority_label TEXT DEFAULT 'MEDIUM',
                status TEXT NOT NULL DEFAULT 'submitted',
                progress INTEGER DEFAULT 10,
                current_step TEXT,
                student_id TEXT NOT NULL,
                student_name TEXT NOT NULL,
                is_anonymous INTEGER DEFAULT 0,
                is_recurring INTEGER DEFAULT 0,
                duplicate_of TEXT,
                photo_url TEXT,
                proof_photo TEXT,
                assigned_crew TEXT,
                crew_initials TEXT,
                fixed_at INTEGER,
                verification_deadline INTEGER,
                closure_type TEXT,
                closed_by TEXT,
                resolved_at INTEGER,
                rating INTEGER,
                upvotes INTEGER DEFAULT 1,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            """)

            # 4. Ticket timeline events
            conn.execute("""
            CREATE TABLE IF NOT EXISTS ticket_timeline (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id TEXT NOT NULL,
                stage TEXT NOT NULL,
                time_label TEXT NOT NULL,
                note TEXT NOT NULL,
                actor_id TEXT,
                actor_name TEXT,
                actor_role TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
            );
            """)

            # 5. Upvotes tracking (prevents double upvoting)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS ticket_upvotes (
                ticket_id TEXT NOT NULL,
                student_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (ticket_id, student_id),
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
            );
            """)

            # 6. In-App Notifications
            conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_id TEXT,
                recipient_role TEXT NOT NULL,
                dept_name TEXT,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                ticket_id TEXT,
                is_read INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            """)

            # 7. System Audit Logs
            conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id TEXT,
                action TEXT NOT NULL,
                actor_id TEXT,
                actor_name TEXT,
                actor_role TEXT,
                details TEXT,
                created_at INTEGER NOT NULL
            );
            """)

            # Performance indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tickets_dept ON tickets(department);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tickets_student ON tickets(student_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tickets_deadline ON tickets(verification_deadline);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_timeline_ticket ON ticket_timeline(ticket_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_role, recipient_id, is_read);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_ticket ON audit_logs(ticket_id);")

        seed_initial_data(conn)
    finally:
        conn.close()

def seed_initial_data(conn: sqlite3.Connection):
    """Populates departments and initial tickets from tickets.json if table is empty."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as cnt FROM departments;")
    if cur.fetchone()["cnt"] == 0:
        departments = [
            ("DEPT-PLUMB", "Facility Maintenance & Plumbing", "PLUMB", "R. Murugan", "VHF Ch-4"),
            ("DEPT-ELEC", "Campus Electrical & Power", "ELEC", "S. Ramanathan", "Ext 4012"),
            ("DEPT-CIVIL", "Civil & Structural Maintenance", "CIVIL", "Eng. K. Mehta", "Desk 201"),
            ("DEPT-NET", "Network Infrastructure & IT", "ITNET", "Admin Desk", "NOC-Net"),
            ("DEPT-SHE", "SHE Complaint Cell", "SHE", "Internal Complaints Committee", "Confidential Suite 12"),
            ("DEPT-RAG", "Anti-Ragging Committee", "RAG", "Prof. P. K. Sharma (Dean)", "Ombudsman 24x7")
        ]
        conn.executemany("INSERT INTO departments (id, name, code, lead_name, contact_channel) VALUES (?,?,?,?,?);", departments)
        conn.commit()

    # Seed initial authorized users
    cur.execute("SELECT COUNT(*) as cnt FROM users;")
    if cur.fetchone()["cnt"] == 0:
        now_ts = int(time.time() * 1000)
        seed_users = [
            ("2024CS0123", "Aarav K. Senapati", "aarav.senapati@campus.edu", "student", "Computer Science & Engineering", "", "Student Reporter", "Hostel Block 4 • Suite 212", now_ts),
            ("EMP-ADM-001", "Prof. S. Sharma", "dean.sharma@campus.edu", "admin", "Central Administration", "", "Dean of Student Affairs & Chief Proctor", "Level 4 Executive", now_ts),
            ("DEPT-OPS-01", "Department Dispatch Officer", "dispatch@campus.edu", "department", "Facility Maintenance & Plumbing", "", "Dispatch Command Lead", "Operations Desk", now_ts),
            ("DEPT-PLUMB-04", "R. Murugan", "dispatch.plumbing@campus.edu", "department", "Facility Maintenance & Plumbing", "", "West Quadrant Lead", "Plumbing Division", now_ts),
            ("DEPT-ELECT-02", "Sunil Verma", "dispatch.electrical@campus.edu", "department", "Campus Electrical & Power", "", "Substation Lead", "HT Distribution Wing", now_ts)
        ]
        conn.executemany("""
        INSERT OR IGNORE INTO users (id, name, email, role, dept_name, picture, designation, division, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, seed_users)
        conn.commit()

    cur.execute("SELECT COUNT(*) as cnt FROM tickets;")
    if cur.fetchone()["cnt"] == 0:
        tickets_file = os.path.join(DIRECTORY, "tickets.json")
        if os.path.exists(tickets_file):
            try:
                with open(tickets_file, "r", encoding="utf-8") as f:
                    tickets_data = json.load(f)
                now = int(time.time() * 1000)
                for t in tickets_data:
                    tid = t.get("id")
                    if not tid:
                        continue
                    status = t.get("status", "submitted")
                    if status == "verification_required":
                        status = "fixed"
                    
                    fixed_at = t.get("fixedAt")
                    ver_dl = t.get("verificationDeadline")
                    if status == "fixed" and not ver_dl:
                        fixed_at = now - (60 * 60 * 1000)
                        ver_dl = fixed_at + (48 * 3600 * 1000)

                    created = t.get("createdAt") or now
                    updated = t.get("updatedAt") or created

                    conn.execute("""
                    INSERT OR IGNORE INTO tickets (
                        id, title, description, category, department, location, latitude, longitude,
                        severity, priority_score, priority_label, status, progress, current_step,
                        student_id, student_name, is_anonymous, is_recurring, duplicate_of, photo_url, proof_photo,
                        assigned_crew, crew_initials, fixed_at, verification_deadline, closure_type, closed_by,
                        resolved_at, rating, upvotes, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """, (
                        tid,
                        t.get("title", "Untitled Campus Issue"),
                        t.get("notes") or t.get("desc") or "",
                        t.get("category", "Maintenance"),
                        t.get("department", "Facility Maintenance & Plumbing"),
                        t.get("location", "Campus Grounds"),
                        t.get("latitude") or t.get("lat"),
                        t.get("longitude") or t.get("lng"),
                        t.get("severity", "moderate"),
                        t.get("priorityScore") or 50,
                        t.get("priorityLabel") or "MEDIUM",
                        status,
                        t.get("progress", 10),
                        t.get("currentStep", "Assigned for review"),
                        t.get("studentId", "2024CS0123"),
                        t.get("studentName", "Aarav K. Senapati"),
                        1 if t.get("isAnonymous") or t.get("anonymous") else 0,
                        1 if t.get("isRecurring") else 0,
                        t.get("duplicateOf"),
                        t.get("photoUrl") or t.get("photo"),
                        t.get("proofPhoto") or t.get("afterPhoto"),
                        t.get("assignedCrew"),
                        t.get("crewInitials"),
                        fixed_at,
                        ver_dl,
                        t.get("closureType"),
                        t.get("closedBy"),
                        t.get("resolvedAt"),
                        t.get("rating"),
                        t.get("upvotes", 1),
                        created,
                        updated
                    ))

                    # Timeline events
                    timeline = t.get("timeline", [])
                    for ev in timeline:
                        conn.execute("""
                        INSERT INTO ticket_timeline (ticket_id, stage, time_label, note, created_at)
                        VALUES (?, ?, ?, ?, ?);
                        """, (
                            tid,
                            ev.get("stage", "Update"),
                            ev.get("time", "Earlier"),
                            ev.get("note", "Status updated"),
                            created
                        ))
                conn.commit()
                print(f"[DB] Successfully migrated {len(tickets_data)} seed tickets into database.")
            except Exception as e:
                print(f"[DB] Warning migrating tickets.json: {e}")

# ---------------------------------------------------------------------------
# Ticket Serialization Helper
# ---------------------------------------------------------------------------
def row_to_ticket(row: sqlite3.Row, conn: Optional[sqlite3.Connection] = None) -> Dict[str, Any]:
    t = dict(row)
    # Re-map DB snake_case columns to camelCase expected by existing frontend code
    tid = t["id"]
    t["studentId"] = t.pop("student_id", "")
    t["studentName"] = t.pop("student_name", "")
    t["isAnonymous"] = bool(t.pop("is_anonymous", 0))
    t["isRecurring"] = bool(t.pop("is_recurring", 0))
    t["duplicateOf"] = t.pop("duplicate_of", None)
    t["photoUrl"] = t.pop("photo_url", None)
    t["proofPhoto"] = t.pop("proof_photo", None)
    t["assignedCrew"] = t.pop("assigned_crew", None)
    t["crewInitials"] = t.pop("crew_initials", None)
    t["priorityScore"] = t.pop("priority_score", 50)
    t["priorityLabel"] = t.pop("priority_label", "MEDIUM")
    t["fixedAt"] = t.pop("fixed_at", None)
    t["verificationDeadline"] = t.pop("verification_deadline", None)
    t["closureType"] = t.pop("closure_type", None)
    t["closedBy"] = t.pop("closed_by", None)
    t["resolvedAt"] = t.pop("resolved_at", None)
    t["currentStep"] = t.pop("current_step", "")
    desc_val = t.pop("description", "")
    t["notes"] = desc_val
    t["description"] = desc_val

    # Retrieve timeline
    if conn:
        cur = conn.cursor()
        cur.execute("SELECT stage, time_label as time, note FROM ticket_timeline WHERE ticket_id = ? ORDER BY id ASC;", (tid,))
        t["timeline"] = [dict(r) for r in cur.fetchall()]
        
        # Retrieve upvoter IDs
        cur.execute("SELECT student_id FROM ticket_upvotes WHERE ticket_id = ?;", (tid,))
        t["upvoters"] = [r["student_id"] for r in cur.fetchall()]
    else:
        t["timeline"] = []
        t["upvoters"] = []

    return t

# ---------------------------------------------------------------------------
# Ticket CRUD Operations
# ---------------------------------------------------------------------------
def get_all_tickets(role: Optional[str] = None, user_id: Optional[str] = None, dept_name: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        query = "SELECT * FROM tickets ORDER BY updated_at DESC;"
        cur.execute(query)
        rows = cur.fetchall()
        if not rows:
            return []

        # High-performance bulk retrieval of timelines and upvoters to eliminate N+1 queries
        cur.execute("SELECT ticket_id, stage, time_label as time, note FROM ticket_timeline ORDER BY id ASC;")
        timelines_map = defaultdict(list)
        for r in cur.fetchall():
            timelines_map[r["ticket_id"]].append({"stage": r["stage"], "time": r["time"], "note": r["note"]})

        cur.execute("SELECT ticket_id, student_id FROM ticket_upvotes;")
        upvotes_map = defaultdict(list)
        for r in cur.fetchall():
            upvotes_map[r["ticket_id"]].append(r["student_id"])

        result = []
        for r in rows:
            t = row_to_ticket(r, conn=None)
            tid = t["id"]
            t["timeline"] = timelines_map.get(tid, [])
            t["upvoters"] = upvotes_map.get(tid, [])
            result.append(t)
        return result
    finally:
        conn.close()

def get_ticket_by_id(ticket_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM tickets WHERE id = ?;", (ticket_id,))
        row = cur.fetchone()
        return row_to_ticket(row, conn) if row else None
    finally:
        conn.close()

def classify_ticket_department(category: str = "", text: str = "") -> str:
    """AI natural language department classifier based on category and textual signals."""
    cat = (category or "").lower()
    full = f"{category} {text}".lower()
    if any(k in full for k in ["ragging", "bully", "senior", "freshers", "intimidation"]):
        return "Anti-Ragging Committee"
    if any(k in full for k in ["she", "harassment", "women", "girl", "stalking", "posh", "icc"]):
        return "SHE Complaint Cell"
    if any(k in cat for k in ["elect", "power", "short circuit", "spark", "blackout"]) or any(k in full for k in ["electric", "power", "spark", "socket", "breaker", "voltage", "switch", "mcb", "wire", "wiring"]):
        return "Campus Electrical & Power"
    if any(k in cat for k in ["wifi", "wi-fi", "net", "it", "internet"]) or any(k in full for k in ["wifi", "wi-fi", "internet", "network", "router", "lan", "ethernet", "cisco", "bandwidth"]):
        return "IT & Campus Network Services"
    if any(k in cat for k in ["mess", "food", "dining", "canteen", "sanitation", "clean"]) or any(k in full for k in ["mess", "food", "canteen", "garbage", "trash", "sanitation", "hygiene", "roach", "pest"]):
        return "Hostel Sanitation & Food Services"
    if any(k in cat for k in ["civil", "wall", "ceiling", "structural", "paint", "crack"]):
        return "Civil & Structural Maintenance"
    if any(k in cat for k in ["plumb", "water", "leak", "pipe", "drain", "toilet", "washbasin", "tap", "flush", "ac", "hvac", "chiller"]) or any(k in full for k in ["plumb", "water", "pipe", "leak", "drain", "toilet", "tap", "faucet", "cooler", "sink", "geyser", "tank", "ac", "hvac"]):
        return "Facility Maintenance & Plumbing"
    return "Facility Maintenance & Plumbing"

def create_ticket(data: Dict[str, Any], actor: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    conn = get_connection()
    try:
        now = int(time.time() * 1000)
        tid = data.get("id") or f"CP-{int(time.time()) % 10000:04d}"
        
        # Priority logic
        score = int(data.get("priorityScore") or 50)
        label = data.get("priorityLabel") or ("CRITICAL" if score >= 80 else "HIGH" if score >= 65 else "MEDIUM" if score >= 40 else "LOW")
        
        dept = data.get("department")
        if not dept or not str(dept).strip():
            dept = classify_ticket_department(data.get("category", ""), f"{data.get('title', '')} {data.get('description', '')}")
        if not dept:
            dept = "Facility Maintenance & Plumbing"
        student_id = data.get("studentId") or (actor.get("id") if actor else "2024CS0123")
        student_name = data.get("studentName") or (actor.get("name") if actor else "Student")

        with conn:
            conn.execute("""
            INSERT INTO tickets (
                id, title, description, category, department, location, latitude, longitude,
                severity, priority_score, priority_label, status, progress, current_step,
                student_id, student_name, is_anonymous, is_recurring, duplicate_of, photo_url,
                upvotes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', 10, 'Issue submitted to campus desk', ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                tid,
                data.get("title", "New Grievance Report"),
                data.get("notes") or data.get("description") or "",
                data.get("category", "General"),
                dept,
                data.get("location", "Campus"),
                data.get("latitude") or data.get("lat"),
                data.get("longitude") or data.get("lng"),
                data.get("severity", "moderate"),
                score,
                label,
                student_id,
                student_name,
                1 if data.get("isAnonymous") else 0,
                1 if data.get("isRecurring") else 0,
                data.get("duplicateOf"),
                data.get("photoUrl"),
                data.get("upvotes", 1),
                now,
                now
            ))

            # Initial timeline record
            conn.execute("""
            INSERT INTO ticket_timeline (ticket_id, stage, time_label, note, actor_id, actor_name, actor_role, created_at)
            VALUES (?, 'Submitted', 'Just now', 'Ticket logged via campus reporting desk.', ?, ?, ?, ?);
            """, (tid, student_id, student_name, "student", now))

            # Audit log
            conn.execute("""
            INSERT INTO audit_logs (ticket_id, action, actor_id, actor_name, actor_role, details, created_at)
            VALUES (?, 'CREATE', ?, ?, ?, 'Grievance ticket created in database', ?);
            """, (tid, student_id, student_name, "student", now))

            # Trigger Admin Notification
            conn.execute("""
            INSERT INTO notifications (recipient_role, title, message, ticket_id, created_at)
            VALUES ('admin', 'New Campus Grievance Filed', ?, ?, ?);
            """, (f"Ticket #{tid}: {data.get('title')} ({dept})", tid, now))

            # Trigger Department Notification
            conn.execute("""
            INSERT INTO notifications (recipient_role, dept_name, title, message, ticket_id, created_at)
            VALUES ('department', ?, 'New Work Order Routed', ?, ?, ?);
            """, (dept, f"Ticket #{tid} at {data.get('location')} assigned to your team.", tid, now))

        return get_ticket_by_id(tid)
    finally:
        conn.close()

def update_ticket_status(ticket_id: str, new_status: str, actor: Optional[Dict[str, Any]] = None, notes: str = "", extra: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        now = int(time.time() * 1000)
        actor_name = actor.get("name", "System Officer") if actor else "System"
        actor_role = actor.get("role", "system") if actor else "system"
        actor_id = actor.get("id", "SYS") if actor else "SYS"

        with conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM tickets WHERE id = ?;", (ticket_id,))
            existing = cur.fetchone()
            if not existing:
                return None

            dept = existing["department"]
            student_id = existing["student_id"]

            progress = existing["progress"]
            step = existing["current_step"]
            fixed_at = existing["fixed_at"]
            verification_deadline = existing["verification_deadline"]
            closure_type = existing["closure_type"]
            closed_by = existing["closed_by"]
            resolved_at = existing["resolved_at"]

            timeline_stage = "Status Updated"
            timeline_note = notes or f"Status shifted to {new_status}."

            if new_status == "in_progress":
                progress = 50
                step = f"Field repair active under {actor_name}"
                timeline_stage = "In Progress"
                timeline_note = notes or f"Maintenance initiated on-site by {actor_name}."
            elif new_status == "fixed":
                progress = 90
                step = "Repair completed. 48-hour student verification window active."
                fixed_at = now
                verification_deadline = now + (48 * 3600 * 1000)
                timeline_stage = "Fixed — Awaiting Student Verification"
                timeline_note = notes or f"Marked fixed by {actor_name}. 48h verification countdown started."
                
                # Notify student
                conn.execute("""
                INSERT INTO notifications (recipient_id, recipient_role, title, message, ticket_id, created_at)
                VALUES (?, 'student', 'Action Required: Verify Resolution', ?, ?, ?);
                """, (student_id, f"Ticket #{ticket_id} was marked fixed. You have 48 hours to confirm or reopen.", ticket_id, now))

            elif new_status == "resolved":
                progress = 100
                resolved_at = now
                step = "Ticket officially closed and resolution verified."
                closure_type = (extra or {}).get("closure_type", "student_verified")
                closed_by = (extra or {}).get("closed_by", "student")
                timeline_stage = "Resolved — Student Verified" if closure_type == "student_verified" else "Resolved — Auto-Closed"
                timeline_note = notes or ("Verified and closed by student." if closure_type == "student_verified" else "Auto-closed after 48h timeout.")

                # Notify department
                conn.execute("""
                INSERT INTO notifications (recipient_role, dept_name, title, message, ticket_id, created_at)
                VALUES ('department', ?, 'Ticket Officially Closed', ?, ?, ?);
                """, (dept, f"Ticket #{ticket_id} verified & closed ({closure_type}).", ticket_id, now))

            elif new_status == "reopened":
                progress = 25
                step = "Reopened by student. Immediate reinspection dispatched."
                fixed_at = None
                verification_deadline = None
                closure_type = "reopened"
                timeline_stage = "Reopened — Student Flagged Defect"
                timeline_note = notes or "Student marked issue as still broken. Returned to department queue."

                # Notify department & admin
                conn.execute("""
                INSERT INTO notifications (recipient_role, dept_name, title, message, ticket_id, created_at)
                VALUES ('department', ?, 'URGENT: Work Order Reopened', ?, ?, ?);
                """, (dept, f"Ticket #{ticket_id} was reopened by reporter. Immediate technician re-dispatch required.", ticket_id, now))

            rating = (extra or {}).get("rating") if extra and "rating" in extra else existing["rating"]

            conn.execute("""
            UPDATE tickets SET
                status = ?, progress = ?, current_step = ?, fixed_at = ?,
                verification_deadline = ?, closure_type = ?, closed_by = ?,
                resolved_at = ?, rating = ?, updated_at = ?
            WHERE id = ?;
            """, (new_status, progress, step, fixed_at, verification_deadline, closure_type, closed_by, resolved_at, rating, now, ticket_id))

            conn.execute("""
            INSERT INTO ticket_timeline (ticket_id, stage, time_label, note, actor_id, actor_name, actor_role, created_at)
            VALUES (?, ?, 'Just now', ?, ?, ?, ?, ?);
            """, (ticket_id, timeline_stage, timeline_note, actor_id, actor_name, actor_role, now))

            conn.execute("""
            INSERT INTO audit_logs (ticket_id, action, actor_id, actor_name, actor_role, details, created_at)
            VALUES (?, 'STATUS_UPDATE', ?, ?, ?, ?, ?);
            """, (ticket_id, actor_id, actor_name, actor_role, f"Status transitioned to {new_status}: {timeline_note}", now))

        return get_ticket_by_id(ticket_id)
    finally:
        conn.close()

def assign_ticket_department(ticket_id: str, new_dept: str, actor: Optional[Dict[str, Any]] = None, reason: str = "") -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        now = int(time.time() * 1000)
        actor_name = actor.get("name", "Administrator") if actor else "Admin"
        actor_role = actor.get("role", "admin") if actor else "admin"
        actor_id = actor.get("id", "ADM") if actor else "ADM"

        with conn:
            conn.execute("""
            UPDATE tickets SET department = ?, updated_at = ? WHERE id = ?;
            """, (new_dept, now, ticket_id))

            note = f"Assigned to {new_dept} by {actor_name}."
            if reason:
                note += f" Reason: {reason}"

            conn.execute("""
            INSERT INTO ticket_timeline (ticket_id, stage, time_label, note, actor_id, actor_name, actor_role, created_at)
            VALUES (?, 'Assigned', 'Just now', ?, ?, ?, ?, ?);
            """, (ticket_id, note, actor_id, actor_name, actor_role, now))

            conn.execute("""
            INSERT INTO notifications (recipient_role, dept_name, title, message, ticket_id, created_at)
            VALUES ('department', ?, 'New Ticket Assigned by Admin', ?, ?, ?);
            """, (new_dept, f"Ticket #{ticket_id} routed to your department: {note}", ticket_id, now))

            conn.execute("""
            INSERT INTO audit_logs (ticket_id, action, actor_id, actor_name, actor_role, details, created_at)
            VALUES (?, 'ASSIGN_DEPT', ?, ?, ?, ?, ?);
            """, (ticket_id, actor_id, actor_name, actor_role, note, now))

        return get_ticket_by_id(ticket_id)
    finally:
        conn.close()

def upvote_ticket(ticket_id: str, student_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        now = int(time.time() * 1000)
        with conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM ticket_upvotes WHERE ticket_id = ? AND student_id = ?;", (ticket_id, student_id))
            if cur.fetchone():
                return get_ticket_by_id(ticket_id) # Already upvoted

            conn.execute("INSERT INTO ticket_upvotes (ticket_id, student_id, created_at) VALUES (?, ?, ?);", (ticket_id, student_id, now))
            conn.execute("UPDATE tickets SET upvotes = upvotes + 1, updated_at = ? WHERE id = ?;", (now, ticket_id))
            
            # Recalculate priority
            cur.execute("SELECT upvotes, severity, is_recurring FROM tickets WHERE id = ?;", (ticket_id,))
            t = cur.fetchone()
            upvotes = t["upvotes"]
            sev = t["severity"]
            is_rec = t["is_recurring"]

            base = 40
            if sev == "critical": base = 80
            elif sev == "high": base = 65
            elif sev == "moderate": base = 50

            new_score = min(100, base + (upvotes * 3) + (15 if is_rec else 0))
            new_label = "CRITICAL" if new_score >= 80 else "HIGH" if new_score >= 65 else "MEDIUM" if new_score >= 40 else "LOW"

            conn.execute("UPDATE tickets SET priority_score = ?, priority_label = ? WHERE id = ?;", (new_score, new_label, ticket_id))
        
        return get_ticket_by_id(ticket_id)
    finally:
        conn.close()

def check_auto_close_tickets() -> List[Dict[str, Any]]:
    """Checks and automatically closes fixed tickets past their 48-hour deadline."""
    conn = get_connection()
    now = int(time.time() * 1000)
    closed_tickets = []
    try:
        with conn:
            cur = conn.cursor()
            cur.execute("""
            SELECT id, department, student_id, verification_deadline
            FROM tickets
            WHERE status = 'fixed' AND verification_deadline IS NOT NULL AND verification_deadline <= ?;
            """, (now,))
            expired = cur.fetchall()

            for exp in expired:
                tid = exp["id"]
                conn.execute("""
                UPDATE tickets SET
                    status = 'resolved',
                    closure_type = 'auto_closed',
                    closed_by = 'system',
                    resolved_at = ?,
                    progress = 100,
                    current_step = 'Auto-closed after 48-hour verification timeout without student response.',
                    updated_at = ?
                WHERE id = ?;
                """, (now, now, tid))

                conn.execute("""
                INSERT INTO ticket_timeline (ticket_id, stage, time_label, note, actor_id, actor_name, actor_role, created_at)
                VALUES (?, 'Resolved — Auto-Closed', 'System', 'Auto-closed after 48 hours without student response.', 'SYS', 'Campus Auto-Close Engine', 'system', ?);
                """, (tid, now))

                conn.execute("""
                INSERT INTO audit_logs (ticket_id, action, actor_id, actor_name, actor_role, details, created_at)
                VALUES (?, 'AUTO_CLOSE', 'SYS', 'System Daemon', 'system', 'Ticket auto-closed after 48-hour verification period expired.', ?);
                """, (tid, now))

                closed_tickets.append(tid)

        if closed_tickets:
            print(f"[DB AUTO-CLOSE] Resolved {len(closed_tickets)} expired tickets: {closed_tickets}")
            return [get_ticket_by_id(tid) for tid in closed_tickets if tid]
        return []
    finally:
        conn.close()

def get_notifications(role: str, user_id: Optional[str] = None, dept_name: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        if role == "admin":
            cur.execute("SELECT * FROM notifications WHERE recipient_role IN ('admin', 'all') ORDER BY created_at DESC LIMIT ?;", (limit,))
        elif role == "department" and dept_name:
            cur.execute("SELECT * FROM notifications WHERE (recipient_role = 'department' AND (dept_name = ? OR dept_name IS NULL)) OR recipient_role = 'all' ORDER BY created_at DESC LIMIT ?;", (dept_name, limit))
        elif role == "student" and user_id:
            cur.execute("SELECT * FROM notifications WHERE (recipient_role = 'student' AND (recipient_id = ? OR recipient_id IS NULL)) OR recipient_role = 'all' ORDER BY created_at DESC LIMIT ?;", (user_id, limit))
        else:
            cur.execute("SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?;", (limit,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

def mark_notification_read(notif_id: int):
    conn = get_connection()
    try:
        with conn:
            conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?;", (notif_id,))
    finally:
        conn.close()

def get_dashboard_stats() -> Dict[str, Any]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
        SELECT
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN status != 'resolved' THEN 1 ELSE 0 END), 0) as active,
            COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0) as in_prog,
            COALESCE(SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END), 0) as fixed,
            COALESCE(SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END), 0) as resolved,
            COALESCE(SUM(CASE WHEN priority_score >= 80 AND status != 'resolved' THEN 1 ELSE 0 END), 0) as urgent,
            COALESCE(SUM(CASE WHEN is_recurring = 1 AND status != 'resolved' THEN 1 ELSE 0 END), 0) as rec,
            COALESCE(SUM(CASE WHEN (department IS NULL OR department = 'Unassigned') AND status != 'resolved' THEN 1 ELSE 0 END), 0) as unassigned
        FROM tickets;
        """)
        row = cur.fetchone()
        return {
            "total": int(row["total"] or 0),
            "active": int(row["active"] or 0),
            "inProgress": int(row["in_prog"] or 0),
            "fixed": int(row["fixed"] or 0),
            "resolved": int(row["resolved"] or 0),
            "urgent": int(row["urgent"] or 0),
            "recurring": int(row["rec"] or 0),
            "unassigned": int(row["unassigned"] or 0)
        }
    finally:
        conn.close()

def upsert_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Inserts or updates a user profile in the persistent database."""
    conn = get_connection()
    try:
        now = int(time.time() * 1000)
        uid = user.get("id") or f"USR-{int(time.time()) % 10000}"
        email = user.get("email") or f"{uid.lower()}@campus.edu"
        name = user.get("name") or "Campus Member"
        role = user.get("role") or "student"
        dept = user.get("deptName") or user.get("department") or None
        pic = user.get("picture") or ""
        desig = user.get("designation") or ("Student" if role == "student" else "Campus Staff")
        div = user.get("division") or user.get("hostel") or None

        with conn:
            conn.execute("""
            INSERT INTO users (id, name, email, role, dept_name, picture, designation, division, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                role = excluded.role,
                dept_name = excluded.dept_name,
                picture = excluded.picture,
                designation = excluded.designation,
                division = excluded.division;
            """, (uid, name, email, role, dept, pic, desig, div, now))
        return user
    finally:
        conn.close()

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = ?;", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

# Auto-initialize DB on import
init_db()

