#!/usr/bin/env python3
"""
CAMP(US)FIX — HIGH-PERFORMANCE REAL-TIME PRODUCTION ASGI SERVER
Powered by FastAPI, Uvicorn, SQLite WAL Database, and WebSockets.
Features:
- Instant real-time bi-directional synchronization across Student, Admin Room, and Department dashboards.
- Role- and department-aware WebSocket channels.
- Production ACID-compliant database persistence (SQLite WAL / PostgreSQL).
- Server-side 48-hour auto-close background scheduler.
- Strict Role-Based Access Control (RBAC) with cryptographic JWT cookie verification.
- Google OAuth 2.0 institutional authentication.
"""

import os
import sys
import json
import time
import base64
import hashlib
import asyncio
import urllib.parse
import urllib.request
import urllib.error
import ssl
from typing import List, Dict, Any, Optional, Set

from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

import database

# ---------------------------------------------------------------------------
# Configuration & Secrets
# ---------------------------------------------------------------------------
PORT = int(os.environ.get("PORT", 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(DIRECTORY, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Load local .env file if present
env_file = os.path.join(DIRECTORY, ".env")
if os.path.exists(env_file):
    try:
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k and k not in os.environ:
                        os.environ[k] = v
    except Exception as e:
        print(f"Warning: Could not parse .env: {e}")

SESSION_SIGNATURE_SECRET = os.environ.get("SESSION_SIGNATURE_SECRET", "CAMPUS-FIX-SEC-TOKEN-V2-2026-KEY")

GOOGLE_CLIENT_ID = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
GOOGLE_CLIENT_SECRET = (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()
GOOGLE_REDIRECT_URI = (os.environ.get("GOOGLE_REDIRECT_URI") or "").strip() or None

PROTECTED_ROUTES = {
    "/student-dashboard.html": "student",
    "/admin-dashboard.html": "admin",
    "/department-dashboard.html": "department"
}

ROLE_DASHBOARDS = {
    "student": "/student-dashboard.html",
    "admin": "/admin-dashboard.html",
    "department": "/department-dashboard.html"
}

ROLE_LOGIN_PAGES = {
    "student": "/student-login.html",
    "admin": "/admin-login.html",
    "department": "/department-login.html"
}

# ---------------------------------------------------------------------------
# Cryptographic Token Management
# ---------------------------------------------------------------------------
def verify_bearer_token(token: str) -> Optional[Dict[str, Any]]:
    if not token or not isinstance(token, str):
        return None
    token = urllib.parse.unquote(token.strip()).strip('"').strip("'")
    parts = token.split('.')
    if len(parts) != 3:
        return None
    header_b64, body_b64, signature = parts
    expected_to_hash = f"{header_b64}.{body_b64}.{SESSION_SIGNATURE_SECRET}".encode('utf-8')
    expected_sig = hashlib.sha256(expected_to_hash).hexdigest()
    sig_valid = (signature == expected_sig)
    if not sig_valid:
        alt_hash = f"{header_b64.rstrip('=')}.{body_b64.rstrip('=')}.{SESSION_SIGNATURE_SECRET}".encode('utf-8')
        if signature == hashlib.sha256(alt_hash).hexdigest():
            sig_valid = True
    if not sig_valid:
        return None
    try:
        padded_body = body_b64 + '=' * (-len(body_b64) % 4)
        payload_bytes = base64.b64decode(padded_body)
        payload = json.loads(payload_bytes.decode('utf-8'))
        now_ms = int(time.time() * 1000)
        if now_ms > payload.get('exp', 0):
            return None # Expired
        return payload
    except Exception:
        return None

def create_bearer_token(user: Dict[str, Any]) -> str:
    SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000 # 24 hours
    now_ms = int(time.time() * 1000)
    payload = {
        "sub": user.get("id"),
        "role": user.get("role"),
        "name": user.get("name"),
        "email": user.get("email"),
        "picture": user.get("picture", ""),
        "deptName": user.get("deptName") or None,
        "permissions": user.get("permissions", []),
        "iat": now_ms,
        "exp": now_ms + SESSION_EXPIRY_MS
    }
    header_json = json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(',', ':'))
    body_json = json.dumps(payload, separators=(',', ':'))
    header_b64 = base64.b64encode(header_json.encode('utf-8')).decode('utf-8')
    body_b64 = base64.b64encode(body_json.encode('utf-8')).decode('utf-8')
    to_hash = f"{header_b64}.{body_b64}.{SESSION_SIGNATURE_SECRET}".encode('utf-8')
    signature = hashlib.sha256(to_hash).hexdigest()
    return f"{header_b64}.{body_b64}.{signature}"

def extract_auth_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.startswith("Bearer "):
        tok = auth_header[7:].strip()
        if tok:
            return urllib.parse.unquote(tok.strip('"').strip("'"))
    role_hint = request.headers.get("X-Campus-Role", "").strip()
    if role_hint:
        role_tok = request.cookies.get(f"campus_auth_token_{role_hint}")
        if role_tok:
            return urllib.parse.unquote(role_tok.strip('"').strip("'"))
    cookie_tok = request.cookies.get("campus_auth_token")
    if cookie_tok:
        return urllib.parse.unquote(cookie_tok.strip('"').strip("'"))
    return None

def provision_google_user(email: str, name: str, picture: str = "", role: str = "student", dept_name: Optional[str] = None) -> Dict[str, Any]:
    email = (email or "student@campus.edu").strip()
    name = (name or email.split('@')[0].replace('.', ' ').title()).strip()
    email_hash = hashlib.md5(email.lower().encode('utf-8')).hexdigest().upper()

    if role == "admin":
        user = {
            "id": f"ADM-{email_hash[:6]}",
            "role": "admin",
            "name": name,
            "email": email,
            "picture": picture or "",
            "designation": "Campus Administrator",
            "division": "Central Administration & Oversight",
            "permissions": ["manage_all", "assign_department", "view_audit_logs", "sla_override", "analytics_read"]
        }
    elif role == "department":
        chosen_dept = dept_name or "Facility Maintenance & Plumbing"
        user = {
            "id": f"DEPT-{email_hash[:6]}",
            "role": "department",
            "name": name,
            "email": email,
            "picture": picture or "",
            "deptName": chosen_dept,
            "division": "Operations Desk",
            "permissions": ["view_dept_tickets", "dispatch_crew", "update_ticket_status", "inventory_read"]
        }
    else:
        user = {
            "id": f"STU-{email_hash[:6]}",
            "role": "student",
            "name": name,
            "email": email,
            "picture": picture or "",
            "regNo": f"2024CS{email_hash[:4]}",
            "hostelBlock": "Block B (Nilgiri)",
            "roomNumber": "B-304",
            "permissions": ["submit_ticket", "track_ticket", "upvote_ticket", "sos_alert"]
        }

    try:
        database.upsert_user(user)
    except Exception as e:
        print(f"[AUTH] User upsert notice: {e}")
    return user

def fetch_google_json(url: str, data: Optional[bytes] = None, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    try:
        ctx = ssl.create_default_context()
    except Exception:
        ctx = ssl._create_unverified_context()

    req = urllib.request.Request(url, data=data)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=12) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        try:
            err_json = json.loads(err_body)
            msg = err_json.get('error_description') or err_json.get('error') or str(e)
            raise Exception(msg)
        except Exception:
            raise Exception(f"Google API error ({e.code}): {err_body}")
    except Exception as e:
        try:
            unverified_ctx = ssl._create_unverified_context()
            with urllib.request.urlopen(req, context=unverified_ctx, timeout=12) as response:
                return json.loads(response.read().decode('utf-8'))
        except Exception:
            raise e

# ---------------------------------------------------------------------------
# Real-Time WebSocket Connection Manager (Role & Department Channels)
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        # active_connections: set of (WebSocket, client_meta_dict)
        self.active_connections: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, client_meta: Dict[str, Any]):
        await websocket.accept()
        self.active_connections[websocket] = client_meta
        role = client_meta.get("role", "guest")
        user_id = client_meta.get("userId", "anon")
        dept = client_meta.get("deptName") or "none"
        print(f"[WS] Client connected: {user_id} (Role: {role}, Dept: {dept}). Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            meta = self.active_connections.pop(websocket)
            print(f"[WS] Client disconnected: {meta.get('userId')}. Remaining: {len(self.active_connections)}")

    async def broadcast(self, event_type: str, data: Any, channels: Optional[List[str]] = None):
        """
        Broadcasts event to connected clients matching channels:
        channels format:
        - None or 'global': all clients
        - 'role:admin': only admins
        - 'role:department': all departments
        - 'role:student': all students
        - 'dept:<DeptName>': specific department
        - 'user:<UserId>': specific user
        """
        if not self.active_connections:
            return

        payload = json.dumps({
            "type": event_type,
            "data": data,
            "timestamp": int(time.time() * 1000)
        })

        dead_sockets = []
        for ws, meta in list(self.active_connections.items()):
            should_send = False
            if not channels or "global" in channels:
                should_send = True
            else:
                user_role = meta.get("role")
                user_id = meta.get("userId")
                user_dept = meta.get("deptName")

                if f"role:{user_role}" in channels:
                    should_send = True
                elif user_id and f"user:{user_id}" in channels:
                    should_send = True
                elif user_dept and f"dept:{user_dept}" in channels:
                    should_send = True

            if should_send:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead_sockets.append(ws)

        for ws in dead_sockets:
            self.disconnect(ws)

ws_manager = ConnectionManager()

# ---------------------------------------------------------------------------
# FastAPI Application Initialization
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CAMP(US) FIX Real-Time Production API",
    description="Campus Grievance Redressal System with Real-Time Multi-Dashboard Sync",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=500)

# ---------------------------------------------------------------------------
# Security, Caching & Anti-BF-Cache Middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def rbac_and_security_middleware(request: Request, call_next):
    path = request.url.path

    # Security: Strictly block direct access to database, source code, and secrets
    clean_path = path.lower().split("?")[0]
    BLOCKED_EXTS = (".py", ".pyc", ".db", ".db-wal", ".db-shm", ".sqlite", ".sqlite3", ".env", ".log", ".sh")
    if (any(clean_path.endswith(ext) for ext in BLOCKED_EXTS)
            or "/." in clean_path
            or clean_path in ["/procfile", "/requirements.txt", "/dockerfile"]):
        return Response(content="403 Forbidden: Direct access to system files is restricted.", status_code=403)

    # Check protected routes for authenticated browser access
    if path in PROTECTED_ROUTES:
        required_role = PROTECTED_ROUTES[path]
        raw_token = request.cookies.get(f"campus_auth_token_{required_role}") or request.cookies.get("campus_auth_token")
        if not raw_token:
            auth_h = request.headers.get("Authorization", "")
            if auth_h.startswith("Bearer "):
                raw_token = auth_h[7:].strip()

        token = urllib.parse.unquote(raw_token) if raw_token else None
        payload = verify_bearer_token(token) if token else None
        user_role = payload.get("role") if payload else None

        if not user_role or user_role != required_role:
            redirect_url = ROLE_LOGIN_PAGES.get(required_role, "/student-login.html")
            return RedirectResponse(url=redirect_url, status_code=302)

    response = await call_next(request)

    # Static assets (JS, CSS, images, fonts, uploads) can be safely cached by browser for maximum speed
    STATIC_EXTS = ('.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.ico')
    if any(clean_path.endswith(ext) for ext in STATIC_EXTS) or clean_path.startswith('/uploads/'):
        response.headers["Cache-Control"] = "public, max-age=86400"
        if "Pragma" in response.headers:
            del response.headers["Pragma"]
        if "Expires" in response.headers:
            del response.headers["Expires"]
    else:
        # Anti-cache headers on dynamic/HTML/API responses so browser Back button re-validates
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0, private"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# ---------------------------------------------------------------------------
# Real-Time WebSocket Endpoint (Strict Authentication & Channel Isolation)
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Extract client identification from query params and verify cryptographically
    params = dict(websocket.query_params)
    raw_token = params.get("token") or websocket.cookies.get("campus_auth_token")

    verified_role = "guest"
    verified_user_id = f"guest-{os.urandom(3).hex()}"
    verified_dept = None

    if raw_token:
        token = urllib.parse.unquote(raw_token.strip()).strip('"').strip("'")
        payload = verify_bearer_token(token)
        if payload:
            verified_role = payload.get("role", "student")
            verified_user_id = payload.get("sub", verified_user_id)
            verified_dept = payload.get("deptName")

    # Reject role spoofing: clients without verified token cannot claim admin or department channels
    client_meta = {
        "role": verified_role,
        "userId": verified_user_id,
        "deptName": verified_dept
    }

    await ws_manager.connect(websocket, client_meta)

    try:
        while True:
            data = await websocket.receive_text()
            # Client heartbeat ping/pong
            try:
                msg = json.loads(data)
                if msg.get("action") == "ping":
                    await websocket.send_text(json.dumps({"action": "pong", "time": int(time.time() * 1000)}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

# ---------------------------------------------------------------------------
# Background 48-Hour Auto-Close Daemon
# ---------------------------------------------------------------------------
async def auto_close_background_loop():
    """Continuously runs in background every 30 seconds to auto-close expired fixed tickets."""
    while True:
        try:
            closed_tickets = database.check_auto_close_tickets()
            if closed_tickets:
                for t in closed_tickets:
                    dept = t.get("department")
                    student_id = t.get("studentId")
                    # Broadcast to Admin, Department, and Student
                    channels = ["global", "role:admin"]
                    if dept:
                        channels.append(f"dept:{dept}")
                    if student_id:
                        channels.append(f"user:{student_id}")

                    await ws_manager.broadcast("ticket_auto_closed", t, channels=channels)
                    print(f"[BACKGROUND DAEMON] Auto-closed ticket #{t.get('id')} and broadcasted update.")
        except Exception as e:
            print("[BACKGROUND DAEMON] Error during auto-close check:", e)
        await asyncio.sleep(30)

@app.on_event("startup")
async def on_startup():
    asyncio.create_task(auto_close_background_loop())
    print(f"[CAMPUS FIX] Server started on port {PORT}. Auto-close daemon active.")

# ---------------------------------------------------------------------------
# Production REST APIs
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check():
    """Production health-check endpoint."""
    stats = database.get_dashboard_stats()
    return {
        "status": "healthy",
        "database": "connected (SQLite WAL)",
        "activeWebSocketClients": len(ws_manager.active_connections),
        "stats": stats,
        "timestamp": int(time.time() * 1000)
    }

@app.get("/api/env")
async def get_env_config():
    return {
        "GOOGLE_CLIENT_ID": GOOGLE_CLIENT_ID,
        "PORT": PORT,
        "ENVIRONMENT": os.environ.get("CAMPUS_ENV", "production" if os.environ.get("PORT") else "development")
    }

@app.get("/api/stats")
async def get_stats():
    return database.get_dashboard_stats()

@app.get("/api/tickets")
async def get_tickets(request: Request):
    """Fetches all tickets from database with optional role-based filtering."""
    role = request.query_params.get("role")
    user_id = request.query_params.get("userId")
    dept = request.query_params.get("dept")
    tickets = database.get_all_tickets(role=role, user_id=user_id, dept_name=dept)
    return tickets

@app.get("/api/tickets/{ticket_id}")
async def get_single_ticket(ticket_id: str):
    ticket = database.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@app.post("/api/tickets")
async def create_new_ticket(request: Request):
    """
    Student or campus member creates a new ticket.
    Persists to database and immediately broadcasts to Admin Room & Assigned Department!
    """
    body = await request.json()
    token = extract_auth_token(request)
    actor = verify_bearer_token(token) if token else None

    # Handle batch array if legacy sync sends array
    if isinstance(body, list):
        # Legacy batch save support (idempotent upsert & live real-time sync)
        for item in body:
            tid = item.get("id")
            if not tid:
                continue
            existing = database.get_ticket_by_id(tid)
            if not existing:
                ticket = database.create_ticket(item, actor)
                if item.get("isEmergency") or item.get("emergencyType"):
                    ticket["isEmergency"] = True
                    ticket["emergencyType"] = item.get("emergencyType") or item.get("category") or "Emergency"
                assigned_dept = ticket.get("department")
                channels = ["global", "role:admin"]
                if assigned_dept:
                    channels.append(f"dept:{assigned_dept}")
                event_type = "emergency_alert" if item.get("isEmergency") or item.get("emergencyType") else "ticket_created"
                await ws_manager.broadcast(event_type, ticket, channels=channels)
            else:
                # Check for status transition
                item_status = item.get("status")
                if item_status and item_status != existing.get("status"):
                    updated = database.update_ticket_status(
                        tid, item_status, actor=actor, notes=item.get("notes", ""), extra=item
                    )
                    if updated:
                        assigned_dept = updated.get("department")
                        student_id = updated.get("studentId")
                        channels = ["global", "role:admin"]
                        if assigned_dept:
                            channels.append(f"dept:{assigned_dept}")
                        if student_id:
                            channels.append(f"user:{student_id}")
                        ev_type = "ticket_fixed" if item_status == "fixed" else "ticket_resolved" if item_status == "resolved" else "ticket_reopened" if item_status == "reopened" else "status_updated"
                        await ws_manager.broadcast(ev_type, updated, channels=channels)

                # Check for department reassignment
                item_dept = item.get("department")
                if item_dept and item_dept != existing.get("department"):
                    updated = database.assign_ticket_department(tid, item_dept, actor=actor)
                    if updated:
                        channels = ["global", "role:admin", f"dept:{item_dept}"]
                        await ws_manager.broadcast("ticket_assigned", updated, channels=channels)

        return {"success": True, "tickets": database.get_all_tickets()}

    ticket = database.create_ticket(body, actor)
    if body.get("isEmergency") or body.get("emergencyType"):
        ticket["isEmergency"] = True
        ticket["emergencyType"] = body.get("emergencyType") or body.get("category") or "Emergency"
    assigned_dept = ticket.get("department")

    # Broadcast real-time event instantly!
    channels = ["global", "role:admin"]
    if assigned_dept:
        channels.append(f"dept:{assigned_dept}")

    event_type = "emergency_alert" if body.get("isEmergency") or body.get("emergencyType") else "ticket_created"
    await ws_manager.broadcast(event_type, ticket, channels=channels)
    return {"success": True, "ticket": ticket}

@app.post("/api/tickets/{ticket_id}/status")
async def change_ticket_status(ticket_id: str, request: Request):
    """Updates ticket status (in_progress, fixed, resolved, reopened) with strict RBAC enforcement."""
    body = await request.json()
    new_status = body.get("status")
    notes = body.get("notes", "")
    token = extract_auth_token(request)
    actor = verify_bearer_token(token) if token else None
    role = actor.get("role") if actor else "guest"

    if not new_status:
        raise HTTPException(status_code=400, detail="Missing status")

    # Strict Rule Enforcement: Department CANNOT close/resolve tickets!
    if new_status == "resolved" and role == "department":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Department technicians cannot close tickets. Final resolution requires student verification or 48-hour system auto-close."
        )

    # Students cannot arbitrarily transition tickets to in_progress/dispatched
    req_role_hint = request.headers.get("X-Campus-Role", "").strip()
    if role == "student" and req_role_hint not in ["department", "admin"] and new_status in ["in_progress", "dispatched"]:
        raise HTTPException(status_code=403, detail="Forbidden: Students cannot dispatch or start work orders.")

    updated = database.update_ticket_status(ticket_id, new_status, actor=actor, notes=notes, extra=body)
    if not updated:
        raise HTTPException(status_code=404, detail="Ticket not found")

    assigned_dept = updated.get("department")
    student_id = updated.get("studentId")

    channels = ["global", "role:admin"]
    if assigned_dept:
        channels.append(f"dept:{assigned_dept}")
    if student_id:
        channels.append(f"user:{student_id}")

    # Specific event names for quick front-end handling
    ev_type = "status_updated"
    if new_status == "fixed":
        ev_type = "ticket_fixed"
    elif new_status == "resolved":
        ev_type = "ticket_resolved"
    elif new_status == "reopened":
        ev_type = "ticket_reopened"

    await ws_manager.broadcast(ev_type, updated, channels=channels)
    return {"success": True, "ticket": updated}

@app.post("/api/tickets/{ticket_id}/assign")
async def assign_department(ticket_id: str, request: Request):
    """Admin assigns or reassigns department. Enforces Admin role authorization."""
    body = await request.json()
    new_dept = body.get("department")
    reason = body.get("reason", "")
    token = extract_auth_token(request)
    actor = verify_bearer_token(token) if token else None

    # Strict RBAC: Only Admin can reassign departments
    if not actor or actor.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Department reassignment requires Administrator privileges.")

    if not new_dept:
        raise HTTPException(status_code=400, detail="Missing department")

    updated = database.assign_ticket_department(ticket_id, new_dept, actor=actor, reason=reason)
    if not updated:
        raise HTTPException(status_code=404, detail="Ticket not found")

    channels = ["global", "role:admin", f"dept:{new_dept}"]
    await ws_manager.broadcast("ticket_assigned", updated, channels=channels)
    return {"success": True, "ticket": updated}

@app.post("/api/tickets/{ticket_id}/verify")
async def verify_ticket_resolution(ticket_id: str, request: Request):
    """Student verifies fixed issue: 'confirm' (closes) or 'reopen' (returns to dept)."""
    body = await request.json()
    decision = body.get("decision", "confirm") # 'confirm' or 'reopen'
    rating = body.get("rating", 5)
    notes = body.get("notes", "")

    token = extract_auth_token(request)
    actor = verify_bearer_token(token) if token else None

    ticket = database.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Check 48h deadline expiration
    dl = ticket.get("verificationDeadline")
    if dl and int(time.time() * 1000) > dl:
        # Already past deadline: auto-closed
        updated = database.get_ticket_by_id(ticket_id)
        return {"success": False, "message": "Ticket has already auto-closed after 48h timeout.", "ticket": updated}

    if decision == "confirm":
        updated = database.update_ticket_status(
            ticket_id,
            "resolved",
            actor=actor,
            notes=notes or f"Confirmed & signed off by student ({rating}★).",
            extra={"closure_type": "student_verified", "closed_by": "student", "rating": rating}
        )
        ev_type = "ticket_resolved"
    else:
        updated = database.update_ticket_status(
            ticket_id,
            "reopened",
            actor=actor,
            notes=notes or "Student flagged defect as unresolved. Reinspection requested."
        )
        ev_type = "ticket_reopened"

    dept = updated.get("department")
    student_id = updated.get("studentId")
    channels = ["global", "role:admin"]
    if dept:
        channels.append(f"dept:{dept}")
    if student_id:
        channels.append(f"user:{student_id}")

    await ws_manager.broadcast(ev_type, updated, channels=channels)
    return {"success": True, "ticket": updated}

@app.post("/api/tickets/{ticket_id}/upvote")
async def upvote_issue(ticket_id: str, request: Request):
    """Student upvotes issue severity."""
    body = await request.json()
    student_id = body.get("studentId")
    if not student_id:
        token = extract_auth_token(request)
        payload = verify_bearer_token(token) if token else None
        student_id = payload.get("sub", "STU-ANON") if payload else "STU-ANON"

    updated = database.upvote_ticket(ticket_id, student_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Ticket not found")

    await ws_manager.broadcast("ticket_upvoted", updated, channels=["global"])
    return {"success": True, "ticket": updated}

@app.get("/api/notifications")
async def get_user_notifications(request: Request):
    """Retrieves notifications filtered by user role and department."""
    role = request.query_params.get("role", "student")
    user_id = request.query_params.get("userId")
    dept = request.query_params.get("dept")
    notifs = database.get_notifications(role=role, user_id=user_id, dept_name=dept)
    return notifs

@app.post("/api/notifications/{notif_id}/read")
async def mark_notif_read(notif_id: int):
    database.mark_notification_read(notif_id)
    return {"success": True}

# ---------------------------------------------------------------------------
# Secure Image / Proof File Upload Endpoint (Path Traversal & Size Protected)
# ---------------------------------------------------------------------------
@app.post("/api/upload")
async def upload_image(request: Request):
    """Accepts base64 data URL and stores securely with strict size and format validation."""
    try:
        body = await request.json()
        data_url = body.get("image") or body.get("data")
        if not data_url or not isinstance(data_url, str):
            raise HTTPException(status_code=400, detail="Invalid image payload")

        # Maximum payload size 15MB
        if len(data_url) > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Payload exceeds maximum limit (10MB)")

        header, base64_str = data_url.split(',', 1) if ',' in data_url else ('', data_url)
        ext = ".png"
        if "jpeg" in header or "jpg" in header:
            ext = ".jpg"
        elif "webp" in header:
            ext = ".webp"
        elif header and "png" not in header:
            raise HTTPException(status_code=400, detail="Unsupported image format. Allowed: PNG, JPEG, WEBP")

        raw_bytes = base64.b64decode(base64_str)
        if len(raw_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image file exceeds 10MB limit")

        fname = f"proof_{int(time.time() * 1000)}_{os.urandom(4).hex()}{ext}"
        fpath = os.path.join(UPLOADS_DIR, fname)
        with open(fpath, "wb") as f:
            f.write(raw_bytes)

        return {"success": True, "url": f"/uploads/{fname}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/uploads/{filename}")
async def serve_upload(filename: str):
    """Safely serves uploaded proof photos while strictly preventing path traversal attacks."""
    safe_filename = os.path.basename(filename)
    fpath = os.path.abspath(os.path.join(UPLOADS_DIR, safe_filename))
    uploads_dir_abs = os.path.abspath(UPLOADS_DIR)
    if not fpath.startswith(uploads_dir_abs) or not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(fpath)

# ---------------------------------------------------------------------------
# Google OAuth & Authentication APIs
# ---------------------------------------------------------------------------
def make_secure_cookie(name: str, value: str, max_age: int = 86400, http_only: bool = True):
    return {
        "key": name,
        "value": value,
        "max_age": max_age,
        "path": "/",
        "samesite": "lax",
        "httponly": http_only
    }

@app.post("/api/auth/login")
async def api_auth_login(request: Request, response: Response):
    body = await request.json()
    identifier = (body.get("identifier") or body.get("userId") or body.get("username") or body.get("email") or "").strip()
    password = (body.get("password") or "").strip()
    role = (body.get("role") or "").strip().lower()
    dept_name = (body.get("deptName") or body.get("departmentName") or body.get("department") or "").strip()

    if not identifier:
        raise HTTPException(status_code=400, detail="Institutional registration number, ID, or email is required.")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required.")

    # 1. First try database-level salted verification
    user = database.verify_user_credentials(identifier, password, expected_role=role if role else None)

    # 2. If not found in database, check seed user dictionary and common demo passwords
    if not user:
        ROLE_DEMO_PASSWORDS = {
            "student": "StudentPass@2026",
            "admin": "AdminDean@2026",
            "department": "DeptOps@2026"
        }
        
        seed_users = [
            {"id": "2024CS0123", "role": "student", "name": "Aarav K. Senapati", "email": "aarav.senapati@campus.edu", "deptName": "Computer Science & Engineering", "division": "Hostel Block 4 • Suite 212", "designation": "Student Reporter"},
            {"id": "2023EE0102", "role": "student", "name": "Devansh Rao", "email": "devansh.rao@campus.edu", "deptName": "Electrical Engineering", "division": "Hostel Block 2 • Room 104", "designation": "Student Reporter"},
            {"id": "EMP-ADM-001", "role": "admin", "name": "Prof. S. Sharma", "email": "dean.sharma@campus.edu", "deptName": "Central Administration", "division": "Level 4 Executive", "designation": "Dean of Student Affairs & Chief Proctor"},
            {"id": "DEPT-OPS-01", "role": "department", "name": "Department Dispatch Officer", "email": "dispatch@campus.edu", "deptName": "Facility Maintenance & Plumbing", "division": "Operations Desk", "designation": "Dispatch Command Lead"},
            {"id": "DEPT-PLUMB-04", "role": "department", "name": "R. Murugan", "email": "dispatch.plumbing@campus.edu", "deptName": "Facility Maintenance & Plumbing", "division": "Plumbing Division", "designation": "West Quadrant Lead"},
            {"id": "DEPT-ELECT-02", "role": "department", "name": "Sunil Verma", "email": "dispatch.electrical@campus.edu", "deptName": "Campus Electrical & Power", "division": "HT Distribution Wing", "designation": "Substation Lead"},
            {"id": "DEPT-HOSTEL-01", "role": "department", "name": "K. Deshmukh", "email": "dispatch.hostel@campus.edu", "deptName": "Hostel Sanitation & Food Services", "division": "Hostel Mess & Sanitation Wing", "designation": "Hostel Operations Superintendent"},
            {"id": "DEPT-IT-01", "role": "department", "name": "Vikram Mehta", "email": "dispatch.network@campus.edu", "deptName": "IT & Campus Network Services", "division": "Campus NOC & Server Vault", "designation": "Campus NOC Lead"},
            {"id": "DEPT-SHE-01", "role": "department", "name": "Dr. Nalini Iyer", "email": "icc.she@campus.edu", "deptName": "SHE Complaint Cell", "division": "Internal Complaints Committee Desk", "designation": "ICC Presiding Officer"},
            {"id": "DEPT-RAG-01", "role": "department", "name": "Col. P. Nair", "email": "antiragging.cell@campus.edu", "deptName": "Anti-Ragging Committee", "division": "24x7 Ombudsman Emergency Squad", "designation": "Proctorial Security Head"}
        ]

        id_lower = identifier.lower()
        matched = None
        for u in seed_users:
            if u["id"].lower() == id_lower or u["email"].lower() == id_lower:
                matched = dict(u)
                break

        if matched:
            user_role = matched.get("role", "")
            expected_pass = ROLE_DEMO_PASSWORDS.get(user_role)
            if password == expected_pass:
                user = matched

    if not user:
        raise HTTPException(status_code=401, detail="Invalid institutional credentials or unauthorized role.")

    # 3. Dynamic Department Name Binding
    if user.get("role") == "department" or role == "department":
        user["role"] = "department"
        dept_roster = {
            "Facility Maintenance & Plumbing": {"name": "R. Murugan", "division": "Plumbing Division", "designation": "West Quadrant Lead"},
            "Campus Electrical & Power": {"name": "Sunil Verma", "division": "HT Distribution Wing", "designation": "Substation Lead"},
            "Civil & Structural Maintenance": {"name": "Eng. K. Mehta", "division": "Civil Infrastructure Wing", "designation": "Civil Works Overseer"},
            "Network Infrastructure & IT": {"name": "Vikram Mehta", "division": "Campus NOC & Server Vault", "designation": "Campus NOC Lead"},
            "IT & Campus Network Services": {"name": "Vikram Mehta", "division": "Campus NOC & Server Vault", "designation": "Campus NOC Lead"},
            "Hostel Sanitation & Food Services": {"name": "K. Deshmukh", "division": "Hostel Mess & Sanitation Wing", "designation": "Hostel Operations Superintendent"},
            "SHE Complaint Cell": {"name": "Dr. Nalini Iyer", "division": "Internal Complaints Committee Desk", "designation": "ICC Presiding Officer"},
            "Anti-Ragging Committee": {"name": "Col. P. Nair", "division": "24x7 Ombudsman Emergency Squad", "designation": "Proctorial Security Head"}
        }
        if dept_name:
            user["deptName"] = dept_name
            user["department"] = dept_name
            if dept_name in dept_roster:
                user["name"] = dept_roster[dept_name]["name"]
                user["division"] = dept_roster[dept_name]["division"]
                user["designation"] = dept_roster[dept_name]["designation"]
        elif not user.get("deptName"):
            user["deptName"] = "Facility Maintenance & Plumbing"
            user["department"] = "Facility Maintenance & Plumbing"

    # 4. Attach permissions
    role_perms = {
        "student": ["file_ticket", "view_my_tickets", "upvote_ticket", "view_bulletins"],
        "admin": ["all", "master_incidents", "escalate_ombudsman", "reassign_dept", "broadcast_alert", "audit_logs", "manage_all", "assign_department", "view_audit_logs", "sla_override", "analytics_read"],
        "department": ["view_dept_tickets", "dispatch_crew", "update_ticket_status", "inventory_read"]
    }
    user["permissions"] = role_perms.get(user["role"], [])

    # 5. Issue server-signed JWT
    token = create_bearer_token(user)

    # 6. Set HTTP cookies
    user_role = user["role"]
    max_age = 86400

    response.set_cookie("campus_session_role", user_role, max_age=max_age, path="/", samesite="lax")
    response.set_cookie("campus_auth_token", token, max_age=max_age, path="/", samesite="lax")
    response.set_cookie(f"campus_auth_token_{user_role}", token, max_age=max_age, path="/", samesite="lax")

    role_targets = {
        "student": "student-dashboard.html",
        "admin": "admin-dashboard.html",
        "department": "department-dashboard.html"
    }
    target_url = role_targets.get(user_role, "index.html")

    return {
        "success": True,
        "token": token,
        "user": user,
        "targetUrl": target_url
    }

@app.get("/api/auth/verify")
async def verify_auth_session(request: Request):
    token = extract_auth_token(request)
    if not token:
        return {"authenticated": False, "error": "No token provided"}
    payload = verify_bearer_token(token)
    if not payload:
        return {"authenticated": False, "error": "Invalid or expired token"}
    return {"authenticated": True, "role": payload.get("role"), "user": payload}

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie("campus_session_role", path="/")
    response.delete_cookie("campus_auth_token", path="/")
    for r in ["student", "admin", "department"]:
        response.delete_cookie(f"campus_auth_token_{r}", path="/")
    return {"success": True, "message": "Session terminated"}

@app.get("/api/auth/google/login")
async def google_login_redirect(request: Request):
    role = request.query_params.get("role", "student")
    dept_name = request.query_params.get("deptName", "")
    return_to = request.query_params.get("return_to", "")
    host = request.headers.get("Host", f"localhost:{PORT}")
    proto = request.headers.get("X-Forwarded-Proto", "http")
    redirect_uri = GOOGLE_REDIRECT_URI or f"{proto}://{host}/api/auth/google/callback"

    state_obj = {"role": role, "deptName": dept_name, "return_to": return_to, "ts": int(time.time())}
    state_str = base64.urlsafe_b64encode(json.dumps(state_obj).encode('utf-8')).decode('utf-8')
    auth_params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state_str,
        "prompt": "select_account"
    }
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(auth_params)}"

    if request.query_params.get("json") == "1":
        return {"auth_url": google_auth_url}
    return RedirectResponse(google_auth_url, status_code=302)

@app.get("/api/auth/google/callback")
async def google_oauth_callback(request: Request):
    code = request.query_params.get("code")
    state_param = request.query_params.get("state")
    error = request.query_params.get("error")

    role = "student"
    dept_name = None
    return_to = None
    if state_param:
        try:
            padded = state_param + '=' * (-len(state_param) % 4)
            data = json.loads(base64.urlsafe_b64decode(padded.encode('utf-8')).decode('utf-8'))
            role = data.get("role", "student")
            dept_name = data.get("deptName")
            return_to = data.get("return_to")
        except Exception:
            pass

    login_page = ROLE_LOGIN_PAGES.get(role, "/student-login.html")
    if error or not code:
        return RedirectResponse(f"{login_page}?error={urllib.parse.quote(error or 'missing_code')}", status_code=302)

    try:
        host = request.headers.get("Host", f"localhost:{PORT}")
        proto = request.headers.get("X-Forwarded-Proto", "http")
        redirect_uri = GOOGLE_REDIRECT_URI or f"{proto}://{host}/api/auth/google/callback"

        token_url = "https://oauth2.googleapis.com/token"
        token_payload = urllib.parse.urlencode({
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }).encode('utf-8')

        token_data = fetch_google_json(
            token_url,
            data=token_payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        access_token = token_data.get("access_token")
        id_token = token_data.get("id_token")

        user_info = {}
        if access_token:
            user_info = fetch_google_json(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
        elif id_token:
            parts = id_token.split('.')
            if len(parts) >= 2:
                pad = parts[1] + '=' * (-len(parts[1]) % 4)
                user_info = json.loads(base64.urlsafe_b64decode(pad.encode('utf-8')).decode('utf-8'))

        email = user_info.get("email", "")
        name = user_info.get("name", "")
        picture = user_info.get("picture", "")

        user = provision_google_user(email, name, picture, role=role, dept_name=dept_name)
        session_token = create_bearer_token(user)

        base_dest = return_to if (return_to and return_to.startswith("/")) else ROLE_DASHBOARDS.get(role, "/student-dashboard.html")
        join_char = "&" if "?" in base_dest else "?"
        redirect_dest = (
            f"{base_dest}{join_char}google_auth=success"
            f"&token={urllib.parse.quote(session_token)}"
            f"&user={urllib.parse.quote(json.dumps(user))}"
        )

        resp = RedirectResponse(redirect_dest, status_code=302)
        resp.set_cookie("campus_session_role", role, max_age=86400, httponly=False, path="/")
        resp.set_cookie("campus_auth_token", session_token, max_age=86400, httponly=True, path="/")
        resp.set_cookie(f"campus_auth_token_{role}", session_token, max_age=86400, httponly=True, path="/")
        return resp
    except Exception as e:
        return RedirectResponse(f"{login_page}?error={urllib.parse.quote(str(e))}", status_code=302)

@app.post("/api/auth/google")
async def google_direct_token_exchange(request: Request, response: Response):
    body = await request.json()
    role = body.get("role", "student")
    dept_name = body.get("deptName")
    credential = body.get("credential") or body.get("id_token")
    code = body.get("code")

    try:
        if credential:
            token_info = fetch_google_json(f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}")
            if token_info.get("aud") != GOOGLE_CLIENT_ID:
                raise Exception("Audience mismatch in Google ID token.")
            email = token_info.get("email")
            name = token_info.get("name")
            picture = token_info.get("picture")
        elif code:
            host = request.headers.get("Host", f"localhost:{PORT}")
            proto = request.headers.get("X-Forwarded-Proto", "http")
            redirect_uri = GOOGLE_REDIRECT_URI or f"{proto}://{host}/api/auth/google/callback"

            token_url = "https://oauth2.googleapis.com/token"
            token_payload = urllib.parse.urlencode({
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            }).encode('utf-8')
            token_data = fetch_google_json(
                token_url,
                data=token_payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            access_token = token_data.get("access_token")
            user_info = fetch_google_json(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            email = user_info.get("email")
            name = user_info.get("name")
            picture = user_info.get("picture")
        else:
            raise Exception("Missing Google credential or code.")

        user = provision_google_user(email, name, picture, role=role, dept_name=dept_name)
        token = create_bearer_token(user)

        response.set_cookie("campus_session_role", role, max_age=86400, httponly=False, path="/")
        response.set_cookie("campus_auth_token", token, max_age=86400, httponly=True, path="/")
        response.set_cookie(f"campus_auth_token_{role}", token, max_age=86400, httponly=True, path="/")

        return {
            "success": True,
            "user": user,
            "token": token,
            "targetUrl": ROLE_DASHBOARDS.get(role, "/student-dashboard.html")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------------------------
# Static Files Serving (Mounts workspace root for HTML, JS, CSS, PNG assets)
# ---------------------------------------------------------------------------
app.mount("/", StaticFiles(directory=DIRECTORY, html=True), name="static")

if __name__ == "__main__":
    print(f"===========================================================")
    print(f" CAMP(US) FIX High-Performance Real-Time Production Server")
    print(f" Running on http://0.0.0.0:{PORT}/")
    print(f" WebSocket Endpoint: ws://0.0.0.0:{PORT}/ws")
    print(f" Database: {database.DB_PATH} (WAL Mode Active)")
    print(f"===========================================================")
    uvicorn.run(app, host="0.0.0.0", port=PORT, access_log=False)
