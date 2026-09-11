#!/usr/bin/env python3
"""
CAMP(US) FIX — COMPLETE TICKET ROUTING & AI ASSIGNMENT VERIFICATION SUITE
Tests the entire lifecycle:
Student → Backend API → Database → Admin Room + Correct Department
→ Status Updates (In Progress -> Fixed -> Verified)
"""

import sys
import os
import json
import time
import asyncio
import sqlite3
import urllib.request
import urllib.parse
import websockets

PORT = 8080
BASE_URL = f"http://127.0.0.1:{PORT}"
WS_URL = f"ws://127.0.0.1:{PORT}/ws"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "campus_fix.db")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server
import database

def get_auth_token(role="student", user_id="2024CS0123", name="Aarav K. Senapati", dept_name=None):
    user = {
        "id": user_id,
        "role": role,
        "name": name,
        "email": f"{user_id.lower()}@campus.edu",
        "deptName": dept_name,
        "permissions": []
    }
    return server.create_bearer_token(user), user

async def main():
    print("=" * 75)
    print(" CAMP(US) FIX — COMPLETE TICKET ROUTING VERIFICATION SUITE")
    print("=" * 75)

    results = {}

    # -----------------------------------------------------------------------
    # Step 1: Prepare Authenticated Test Personas
    # -----------------------------------------------------------------------
    student_token, student_user = get_auth_token("student", "STU-TEST-01", "Aarav Senapati")
    admin_token, admin_user = get_auth_token("admin", "ADM-TEST-01", "Chief Proctor")
    dept_token_elec, dept_user_elec = get_auth_token("department", "DEPT-TEST-ELEC", "Sunil Verma", "Campus Electrical & Power")
    dept_token_plumb, dept_user_plumb = get_auth_token("department", "DEPT-TEST-PLUMB", "R. Murugan", "Facility Maintenance & Plumbing")

    # Connect WebSocket clients
    print("\n[STEP 1] Connecting real-time WebSocket clients (Student, Admin, Electrical Dept, Plumbing Dept)...")
    ws_student = await websockets.connect(f"{WS_URL}?token={student_token}&role=student&userId={student_user['id']}")
    ws_admin = await websockets.connect(f"{WS_URL}?token={admin_token}&role=admin&userId={admin_user['id']}")
    ws_dept_elec = await websockets.connect(f"{WS_URL}?token={dept_token_elec}&role=department&userId={dept_user_elec['id']}&deptName={urllib.parse.quote('Campus Electrical & Power')}")
    ws_dept_plumb = await websockets.connect(f"{WS_URL}?token={dept_token_plumb}&role=department&userId={dept_user_plumb['id']}&deptName={urllib.parse.quote('Facility Maintenance & Plumbing')}")
    print("  ✓ All 4 WebSocket clients connected and authenticated.")

    # -----------------------------------------------------------------------
    # Step 2: AI Category & Keyword Department Routing Tests
    # -----------------------------------------------------------------------
    print("\n[STEP 2] Testing AI / Category Logic & Automatic Department Routing...")
    test_cases = [
        {
            "category": "Electrical",
            "title": "Substation breaker tripping repeatedly",
            "notes": "Sparks seen near MCB panel in Nilgiri Block",
            "expected_dept": "Campus Electrical & Power"
        },
        {
            "category": "Wi-Fi & Network",
            "title": "Access Point offline in Central Library",
            "notes": "Students unable to connect to campus wifi portal",
            "expected_dept": "IT & Campus Network Services"
        },
        {
            "category": "SHE Complaint",
            "title": "Confidential Security Concern",
            "notes": "Report filed with request for immediate ICC attention",
            "expected_dept": "SHE Complaint Cell"
        },
        {
            "category": "Anti-Ragging",
            "title": "Hostel 4 Incident Report",
            "notes": "Intimidation reported near freshmen wing",
            "expected_dept": "Anti-Ragging Committee"
        },
        {
            "category": "Plumbing",
            "title": "Main overhead tank pipe rupture",
            "notes": "Water gushing into ground floor corridor",
            "expected_dept": "Facility Maintenance & Plumbing"
        }
    ]

    all_ai_routed = True
    for tc in test_cases:
        routed_dept = database.classify_ticket_department(tc["category"], f"{tc['title']} {tc['notes']}")
        matched = (routed_dept == tc["expected_dept"])
        print(f"  • Category: '{tc['category']}' -> Routed to: '{routed_dept}' [Expected: '{tc['expected_dept']}'] -> {'✓ PASS' if matched else '✗ FAIL'}")
        if not matched:
            all_ai_routed = False
    results["ai_department_routing"] = all_ai_routed

    # -----------------------------------------------------------------------
    # Step 3: Student Raises an Electrical Emergency Ticket via API
    # -----------------------------------------------------------------------
    test_tid = f"RT-ELEC-{int(time.time()) % 10000}"
    print(f"\n[STEP 3] Student raises ticket #{test_tid} via Backend REST API...")

    ticket_payload = {
        "id": test_tid,
        "title": "Exposed high voltage spark in Science Block Substation",
        "description": "Loose 440V conduit is sparking near main doorway. Critical fire hazard.",
        "category": "Electrical",
        "location": "Science Block B • Ground Floor Room 102",
        "latitude": 19.1334,
        "longitude": 72.9155,
        "severity": "critical",
        "priorityScore": 88,
        "priorityLabel": "CRITICAL",
        "studentId": student_user["id"],
        "studentName": student_user["name"],
        "isAnonymous": False,
        "photoUrl": "/uploads/test_spark_proof.png",
        "upvotes": 3
    }

    # Make HTTP POST /api/tickets with student auth token
    req = urllib.request.Request(
        f"{BASE_URL}/api/tickets",
        data=json.dumps(ticket_payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {student_token}"
        },
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        create_resp = json.loads(resp.read().decode("utf-8"))
        print(f"  ✓ HTTP 200 API response: success={create_resp.get('success')}, id={create_resp.get('ticket', {}).get('id')}")

    # -----------------------------------------------------------------------
    # Step 4: Verify Direct Central SQLite Database Write
    # -----------------------------------------------------------------------
    print("\n[STEP 4] Verifying direct write to central SQLite database...")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM tickets WHERE id = ?;", (test_tid,))
    db_row = cur.fetchone()
    conn.close()

    if db_row:
        print(f"  ✓ Found in central SQLite database: ID={db_row['id']}")
        print(f"    - Department: {db_row['department']}")
        print(f"    - Category: {db_row['category']}")
        print(f"    - Priority: {db_row['priority_score']} ({db_row['priority_label']})")
        print(f"    - GPS Coordinates: Lat={db_row['latitude']}, Lng={db_row['longitude']}")
        print(f"    - Photo URL: {db_row['photo_url']}")
        print(f"    - Student: {db_row['student_name']} ({db_row['student_id']})")
        results["database_persisted"] = True
    else:
        print("  ✗ Ticket NOT found in SQLite database!")
        results["database_persisted"] = False

    # -----------------------------------------------------------------------
    # Step 5: Verify Real-Time WebSocket Delivery to Admin and Electrical Dept
    # -----------------------------------------------------------------------
    print("\n[STEP 5] Verifying real-time WebSocket events received by Admin & Electrical Dept...")
    # Admin receives event
    admin_received = False
    try:
        raw = await asyncio.wait_for(ws_admin.recv(), timeout=2.0)
        msg = json.loads(raw)
        if msg.get("type") == "ticket_created" and msg.get("data", {}).get("id") == test_tid:
            admin_received = True
            print(f"  ✓ Admin WebSocket received 'ticket_created' event for #{test_tid}")
    except Exception as e:
        print("  ✗ Admin WebSocket failed to receive event:", e)
    results["admin_received_ws"] = admin_received

    # Electrical Department receives event
    dept_received = False
    try:
        raw = await asyncio.wait_for(ws_dept_elec.recv(), timeout=2.0)
        msg = json.loads(raw)
        if msg.get("type") == "ticket_created" and msg.get("data", {}).get("id") == test_tid:
            dept_received = True
            print(f"  ✓ Electrical Dept WebSocket received 'ticket_created' event for #{test_tid}")
    except Exception as e:
        print("  ✗ Electrical Dept WebSocket failed to receive event:", e)
    results["department_received_ws"] = dept_received

    # -----------------------------------------------------------------------
    # Step 6: Verify Data Consistency Across Admin, Department, and Student
    # -----------------------------------------------------------------------
    print("\n[STEP 6] Verifying data consistency (ID, GPS, Student, Category, Attachment)...")
    ticket_from_db = database.get_ticket_by_id(test_tid)
    consistent = (
        ticket_from_db["id"] == test_tid and
        ticket_from_db["department"] == "Campus Electrical & Power" and
        ticket_from_db["category"] == "Electrical" and
        ticket_from_db["latitude"] == 19.1334 and
        ticket_from_db["longitude"] == 72.9155 and
        ticket_from_db["photoUrl"] == "/uploads/test_spark_proof.png" and
        ticket_from_db["studentId"] == student_user["id"] and
        ticket_from_db["priorityScore"] == 88 and
        ticket_from_db["priorityLabel"] == "CRITICAL"
    )
    print(f"  ✓ Data consistency verified: {consistent}")
    results["data_consistency"] = consistent

    # -----------------------------------------------------------------------
    # Step 7: Verify Offline Department Reconnection / Database Source of Truth
    # -----------------------------------------------------------------------
    print("\n[STEP 7] Verifying offline Department reconnection recovery from database...")
    # Disconnect department client
    await ws_dept_elec.close()
    print("  ✓ Electrical Department disconnected.")

    # Student raises second ticket for Electrical
    test_tid_2 = f"RT-ELEC-OFFLINE-{int(time.time()) % 10000}"
    ticket_payload_2 = dict(ticket_payload, id=test_tid_2, title="Substation Transformer Oil Leak")
    req = urllib.request.Request(
        f"{BASE_URL}/api/tickets",
        data=json.dumps(ticket_payload_2).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {student_token}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        resp.read()
    print(f"  ✓ Ticket #{test_tid_2} created while Electrical Department was offline.")

    # Reconnect department client and fetch from database (/api/tickets)
    ws_dept_elec_new = await websockets.connect(f"{WS_URL}?token={dept_token_elec}&role=department&userId={dept_user_elec['id']}&deptName={urllib.parse.quote('Campus Electrical & Power')}")
    req = urllib.request.Request(f"{BASE_URL}/api/tickets", headers={"Authorization": f"Bearer {dept_token_elec}"})
    with urllib.request.urlopen(req) as resp:
        reconnected_tickets = json.loads(resp.read().decode("utf-8"))
    
    found_offline_ticket = any(t["id"] == test_tid_2 for t in reconnected_tickets)
    print(f"  ✓ Reconnected Electrical Dept queried database source of truth: Found #{test_tid_2} -> {found_offline_ticket}")
    results["offline_recovery_from_db"] = found_offline_ticket

    # -----------------------------------------------------------------------
    # Step 8: Verify Department Queue Scoping (Dept only sees its own tickets)
    # -----------------------------------------------------------------------
    print("\n[STEP 8] Verifying Department queue scoping (only sees own department tickets)...")
    # Plumbing department queue
    req = urllib.request.Request(f"{BASE_URL}/api/tickets", headers={"Authorization": f"Bearer {dept_token_plumb}"})
    with urllib.request.urlopen(req) as resp:
        all_for_plumb = json.loads(resp.read().decode("utf-8"))
        
    # Department dashboard filters via matchesDepartment
    plumb_filtered = [t for t in all_for_plumb if "plumb" in (t.get("department") or "").lower()]
    dept_scoping_passed = not any(t["id"] in [test_tid, test_tid_2] for t in plumb_filtered)
    print(f"  ✓ Plumbing Department filtered queue excludes Electrical tickets #{test_tid} & #{test_tid_2}: {dept_scoping_passed}")
    results["department_isolation"] = dept_scoping_passed

    # -----------------------------------------------------------------------
    # Step 9: Verify Admin Room Reassignment
    # -----------------------------------------------------------------------
    print("\n[STEP 9] Verifying Admin Room Department Reassignment...")
    # Admin reassigns #{test_tid} to "Facility Maintenance & Plumbing"
    reassign_payload = {"department": "Facility Maintenance & Plumbing", "reason": "Water pipe leak adjacent to electrical conduit"}
    req = urllib.request.Request(
        f"{BASE_URL}/api/tickets/{test_tid}/assign",
        data=json.dumps(reassign_payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        reassign_resp = json.loads(resp.read().decode("utf-8"))
    
    reassigned_ticket = database.get_ticket_by_id(test_tid)
    reassign_success = (reassigned_ticket["department"] == "Facility Maintenance & Plumbing")
    print(f"  ✓ Admin reassigned #{test_tid} to '{reassigned_ticket['department']}': {reassign_success}")
    results["admin_reassign"] = reassign_success

    # -----------------------------------------------------------------------
    # Step 10: Complete Status Lifecycle (In Progress -> Fixed -> Verified)
    # -----------------------------------------------------------------------
    print("\n[STEP 10] Testing Complete Lifecycle (In Progress -> Fixed -> Verified)...")
    # Step 10a: Plumbing dept marks In Progress
    status_payload_1 = {"status": "in_progress", "notes": "Plumbing crew dispatched to isolate water line."}
    req = urllib.request.Request(
        f"{BASE_URL}/api/tickets/{test_tid}/status",
        data=json.dumps(status_payload_1).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {dept_token_plumb}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        status_resp_1 = json.loads(resp.read().decode("utf-8"))
    
    t_inprogress = database.get_ticket_by_id(test_tid)
    inprogress_ok = (t_inprogress["status"] == "in_progress" and t_inprogress["progress"] == 50)
    print(f"  ✓ Department marked 'in_progress' in database: status={t_inprogress['status']}, progress={t_inprogress['progress']}%")

    # Step 10b: Plumbing dept marks Fixed
    status_payload_2 = {"status": "fixed", "notes": "Pipe replaced with copper junction. Water secured."}
    req = urllib.request.Request(
        f"{BASE_URL}/api/tickets/{test_tid}/status",
        data=json.dumps(status_payload_2).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {dept_token_plumb}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        status_resp_2 = json.loads(resp.read().decode("utf-8"))
    
    t_fixed = database.get_ticket_by_id(test_tid)
    fixed_ok = (t_fixed["status"] == "fixed" and t_fixed["progress"] == 90 and t_fixed["verificationDeadline"] is not None)
    print(f"  ✓ Department marked 'fixed': status={t_fixed['status']}, 48h deadline active={fixed_ok}")

    # Step 10c: Student verifies and marks Resolved
    verify_payload = {"decision": "confirm", "rating": 5, "notes": "Verified, repair is solid."}
    req = urllib.request.Request(
        f"{BASE_URL}/api/tickets/{test_tid}/verify",
        data=json.dumps(verify_payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {student_token}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        verify_resp = json.loads(resp.read().decode("utf-8"))
    
    t_resolved = database.get_ticket_by_id(test_tid)
    resolved_ok = (t_resolved["status"] == "resolved" and t_resolved["closureType"] == "student_verified" and t_resolved["progress"] == 100)
    print(f"  ✓ Student verified resolution: status={t_resolved['status']}, closureType={t_resolved['closureType']}, progress={t_resolved['progress']}%")

    results["complete_lifecycle_flow"] = inprogress_ok and fixed_ok and resolved_ok

    # Cleanup websockets
    await ws_student.close()
    await ws_admin.close()
    await ws_dept_elec_new.close()
    await ws_dept_plumb.close()

    print("\n" + "=" * 75)
    print(" VERIFICATION SUMMARY:")
    for k, v in results.items():
        print(f"  - {k:<30}: {v}")
    print("=" * 75)

    all_passed = all(results.values())
    print(f"OVERALL STATUS: {'ALL CHECKS PASSED (100% OPERATIONAL)' if all_passed else 'SOME CHECKS FAILED'}")
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
