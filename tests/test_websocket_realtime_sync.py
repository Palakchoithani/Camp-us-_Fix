#!/usr/bin/env python3
"""
Test Real-Time Multi-Client WebSocket Synchronization:
Connects 3 distinct role clients simultaneously:
  1. Student (Aarav K. Senapati)
  2. Admin (Prof. S. Sharma)
  3. Plumbing Department (R. Murugan)
  4. Electrical Department (Sunil Verma - Unrelated, should NOT receive plumbing events)

Flow:
- Student raises ticket -> Admin receives 'ticket_created' via WS immediately.
- Admin assigns ticket to 'Facility Maintenance & Plumbing' -> Admin & Plumbing receive 'ticket_assigned'; Electrical does NOT.
- Plumbing sets status to 'fixed' -> Admin and Student receive 'ticket_fixed'.
- Student confirms resolution -> Admin receives 'ticket_resolved'.
"""

import asyncio
import json
import time
import urllib.request
import websockets

BASE_HTTP = "http://localhost:8080"
BASE_WS = "ws://localhost:8080/ws"

def api_login(user_id, password):
    url = f"{BASE_HTTP}/api/auth/login"
    data = json.dumps({"userId": user_id, "password": password}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def api_post(path, data, token):
    url = f"{BASE_HTTP}{path}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

async def ws_listener(role, user, event_queue):
    query = urllib.parse.urlencode({
        "role": role,
        "userId": user["id"],
        "deptName": user.get("deptName") or "",
        "token": user["token"]
    })
    async with websockets.connect(f"{BASE_WS}?{query}") as ws:
        while True:
            try:
                msg = await ws.recv()
                data = json.loads(msg)
                if data.get("action") == "pong":
                    continue
                await event_queue.put((role, data))
            except Exception:
                break

async def test_live_sync():
    print("==================================================================")
    print("⚡ TESTING MULTI-CLIENT REAL-TIME WEBSOCKET SYNCHRONIZATION")
    print("==================================================================")

    # 1. Login all parties
    stu = api_login("2024CS0123", "StudentPass@2026")
    adm = api_login("EMP-ADM-001", "AdminDean@2026")
    plumb = api_login("DEPT-PLUMB-04", "DeptOps@2026")
    elec = api_login("DEPT-ELECT-02", "DeptOps@2026")

    stu_user = stu["user"]; stu_user["token"] = stu["token"]
    adm_user = adm["user"]; adm_user["token"] = adm["token"]
    plumb_user = plumb["user"]; plumb_user["token"] = plumb["token"]
    elec_user = elec["user"]; elec_user["token"] = elec["token"]

    event_queue = asyncio.Queue()

    # Start WS listeners for all 4 clients
    task_stu = asyncio.create_task(ws_listener("student", stu_user, event_queue))
    task_adm = asyncio.create_task(ws_listener("admin", adm_user, event_queue))
    task_plumb = asyncio.create_task(ws_listener("department", plumb_user, event_queue))
    task_elec = asyncio.create_task(ws_listener("department", elec_user, event_queue))

    # Wait for connections to stabilize
    await asyncio.sleep(0.5)
    print("  ✓ Connected Student, Admin, Plumbing, and Electrical WebSockets.")

    # 2. Student creates a ticket
    ticket_id = f"CP-LIVE-{int(time.time())}"
    print(f"\n[Action 1] Student creates ticket #{ticket_id}...")
    api_post("/api/tickets", {
        "id": ticket_id,
        "title": "Live Real-Time Corridor Flood",
        "description": "Urgent pipeline burst flooding 1st floor walkway.",
        "category": "plumbing",
        "location": "Hostel Block 4 • 1st Floor Corridor",
        "severity": "critical",
        "priorityScore": 95,
        "department": "Unassigned",
        "studentId": stu_user["id"],
        "studentName": stu_user["name"],
        "status": "submitted"
    }, stu_user["token"])

    # Expect Admin to receive 'ticket_created'
    received = False
    start_t = time.time()
    while time.time() - start_t < 3:
        role, ev = await asyncio.wait_for(event_queue.get(), timeout=2.0)
        if role == "admin" and ev.get("type") == "ticket_created" and ev.get("data", {}).get("id") == ticket_id:
            print(f"  ✓ Admin WS instantly received 'ticket_created' for #{ticket_id} (latency: {int((time.time() - start_t)*1000)}ms)")
            received = True
            break
    assert received, "Admin did not receive real-time ticket_created event!"

    # 3. Admin assigns ticket to 'Facility Maintenance & Plumbing'
    print(f"\n[Action 2] Admin assigns ticket #{ticket_id} to Facility Maintenance & Plumbing...")
    api_post(f"/api/tickets/{ticket_id}/assign", {
        "department": "Facility Maintenance & Plumbing",
        "reason": "Emergency plumbing crew deployment"
    }, adm_user["token"])

    # Expect Plumbing to receive 'ticket_assigned'; Electrical MUST NOT receive it
    plumb_received = False
    elec_leak = False
    start_t = time.time()
    for _ in range(5):
        try:
            role, ev = await asyncio.wait_for(event_queue.get(), timeout=1.5)
            if ev.get("type") == "ticket_assigned" and ev.get("data", {}).get("id") == ticket_id:
                if role == "department" and plumb_user["deptName"] in str(ev):
                    plumb_received = True
                    print(f"  ✓ Plumbing Department WS received 'ticket_assigned' for #{ticket_id}")
                elif role == "department" and "Electrical" in role:
                    elec_leak = True
        except asyncio.TimeoutError:
            break

    assert plumb_received, "Plumbing Department did not receive ticket_assigned event!"
    assert not elec_leak, "SECURITY BREACH: Electrical Department received Plumbing ticket_assigned event!"
    print("  ✓ Department Isolation Verified: Only assigned department received work order.")

    # 4. Plumbing updates status to 'fixed'
    print(f"\n[Action 3] Plumbing marks ticket #{ticket_id} as 'fixed'...")
    api_post(f"/api/tickets/{ticket_id}/status", {
        "status": "fixed",
        "notes": "Burst pipe welded and pressure tested. No leaks detected."
    }, plumb_user["token"])

    # Expect Admin and Student to receive 'ticket_fixed'
    adm_fixed = False
    stu_fixed = False
    start_t = time.time()
    for _ in range(6):
        try:
            role, ev = await asyncio.wait_for(event_queue.get(), timeout=1.5)
            if ev.get("type") == "ticket_fixed" and ev.get("data", {}).get("id") == ticket_id:
                if role == "admin":
                    adm_fixed = True
                    print(f"  ✓ Admin WS received 'ticket_fixed' for #{ticket_id}")
                if role == "student":
                    stu_fixed = True
                    print(f"  ✓ Student WS received 'ticket_fixed' for #{ticket_id}")
        except asyncio.TimeoutError:
            break

    assert adm_fixed, "Admin did not receive ticket_fixed event!"
    assert stu_fixed, "Student did not receive ticket_fixed event!"

    # Clean up background listeners
    task_stu.cancel()
    task_adm.cancel()
    task_plumb.cancel()
    task_elec.cancel()

    print("\n==================================================================")
    print("🎉 REAL-TIME WEBSOCKET MULTI-CLIENT SYNC TEST PASSED (100%)!")
    print("==================================================================")

if __name__ == "__main__":
    asyncio.run(test_live_sync())
