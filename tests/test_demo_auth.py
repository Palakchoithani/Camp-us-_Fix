"""
CAMP(US) FIX — Production Authentication & Demo Credentials Test Suite
Validates backend APIs, database hashes, role route guards, dynamic department binding, and role switching.
"""

import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure workspace root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server
import database

class TestDemoAuthentication(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(server.app)

    def setUp(self):
        self.client.cookies.clear()

    def test_01_student_login_by_id(self):
        """Test Student demo login via registration number."""
        res = self.client.post("/api/auth/login", json={
            "userId": "2024CS0123",
            "password": "StudentPass@2026",
            "role": "student"
        })
        self.assertEqual(res.status_code, 200, f"Failed: {res.text}")
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["user"]["role"], "student")
        self.assertEqual(data["user"]["id"], "2024CS0123")
        self.assertIn("token", data)
        self.assertEqual(data.get("targetUrl"), "student-dashboard.html")
        # Check cookies set
        cookies = res.cookies
        self.assertIn("campus_auth_token", cookies)
        self.assertIn("campus_auth_token_student", cookies)
        self.assertEqual(cookies.get("campus_session_role"), "student")

    def test_02_student_login_by_email(self):
        """Test Student login via institutional email."""
        res = self.client.post("/api/auth/login", json={
            "email": "aarav.senapati@campus.edu",
            "password": "StudentPass@2026",
            "role": "student"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["user"]["role"], "student")
        self.assertEqual(data["user"]["id"], "2024CS0123")

    def test_03_admin_login_by_id(self):
        """Test Admin Room demo login via Employee ID."""
        res = self.client.post("/api/auth/login", json={
            "userId": "EMP-ADM-001",
            "password": "AdminDean@2026",
            "role": "admin"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data["user"]["role"], "admin")
        self.assertEqual(data["user"]["id"], "EMP-ADM-001")
        self.assertEqual(data.get("targetUrl"), "admin-dashboard.html")
        cookies = res.cookies
        self.assertIn("campus_auth_token_admin", cookies)
        self.assertEqual(cookies.get("campus_session_role"), "admin")

    def test_04_admin_login_by_email(self):
        """Test Admin Room login via institutional email."""
        res = self.client.post("/api/auth/login", json={
            "identifier": "dean.sharma@campus.edu",
            "password": "AdminDean@2026",
            "role": "admin"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["user"]["role"], "admin")
        self.assertEqual(data["user"]["id"], "EMP-ADM-001")

    def test_05_department_dynamic_binding(self):
        """Test Department login dynamically binds selected department name and roster."""
        # 1. Facility Maintenance
        res1 = self.client.post("/api/auth/login", json={
            "userId": "DEPT-OPS-01",
            "password": "DeptOps@2026",
            "role": "department",
            "deptName": "Facility Maintenance & Plumbing"
        })
        self.assertEqual(res1.status_code, 200)
        d1 = res1.json()["user"]
        self.assertEqual(d1["deptName"], "Facility Maintenance & Plumbing")
        self.assertEqual(d1["name"], "R. Murugan")

        # 2. Campus Electrical
        res2 = self.client.post("/api/auth/login", json={
            "userId": "DEPT-OPS-01",
            "password": "DeptOps@2026",
            "role": "department",
            "deptName": "Campus Electrical & Power"
        })
        self.assertEqual(res2.status_code, 200)
        d2 = res2.json()["user"]
        self.assertEqual(d2["deptName"], "Campus Electrical & Power")
        self.assertEqual(d2["name"], "Sunil Verma")

        # 3. SHE Complaint Cell
        res3 = self.client.post("/api/auth/login", json={
            "userId": "DEPT-OPS-01",
            "password": "DeptOps@2026",
            "role": "department",
            "deptName": "SHE Complaint Cell"
        })
        self.assertEqual(res3.status_code, 200)
        d3 = res3.json()["user"]
        self.assertEqual(d3["deptName"], "SHE Complaint Cell")
        self.assertEqual(d3["name"], "Dr. Nalini Iyer")

    def test_06_route_guards(self):
        """Test that protected pages enforce role authentication without 302 bounce on valid tokens."""
        # Unauthenticated: should 302 redirect
        unauth_admin = self.client.get("/admin-dashboard.html", follow_redirects=False)
        self.assertEqual(unauth_admin.status_code, 302)
        self.assertIn("admin-login.html", unauth_admin.headers.get("location", ""))

        unauth_student = self.client.get("/student-dashboard.html", follow_redirects=False)
        self.assertEqual(unauth_student.status_code, 302)
        self.assertIn("student-login.html", unauth_student.headers.get("location", ""))

        unauth_dept = self.client.get("/department-dashboard.html", follow_redirects=False)
        self.assertEqual(unauth_dept.status_code, 302)
        self.assertIn("department-login.html", unauth_dept.headers.get("location", ""))

        # Authenticated student access
        stud_login = self.client.post("/api/auth/login", json={
            "userId": "2024CS0123",
            "password": "StudentPass@2026",
            "role": "student"
        })
        stud_token = stud_login.json()["token"]

        # Student accessing student-dashboard.html should be 200 OK
        resp = self.client.get("/student-dashboard.html", cookies={"campus_auth_token": stud_token})
        self.assertEqual(resp.status_code, 200)

        # Student accessing admin-dashboard.html should be redirected to admin-login
        resp_blocked = self.client.get("/admin-dashboard.html", cookies={"campus_auth_token": stud_token}, follow_redirects=False)
        self.assertEqual(resp_blocked.status_code, 302)
        self.assertIn("admin-login.html", resp_blocked.headers.get("location", ""))

        # Authenticated admin access
        admin_login = self.client.post("/api/auth/login", json={
            "userId": "EMP-ADM-001",
            "password": "AdminDean@2026",
            "role": "admin"
        })
        admin_token = admin_login.json()["token"]
        resp_admin = self.client.get("/admin-dashboard.html", cookies={"campus_auth_token": admin_token})
        self.assertEqual(resp_admin.status_code, 200)

        # Authenticated dept access
        dept_login = self.client.post("/api/auth/login", json={
            "userId": "DEPT-OPS-01",
            "password": "DeptOps@2026",
            "role": "department",
            "deptName": "Facility Maintenance & Plumbing"
        })
        dept_token = dept_login.json()["token"]
        resp_dept = self.client.get("/department-dashboard.html", cookies={"campus_auth_token": dept_token})
        self.assertEqual(resp_dept.status_code, 200)

    def test_07_invalid_credentials_rejected(self):
        """Test that incorrect credentials return HTTP 401."""
        res = self.client.post("/api/auth/login", json={
            "userId": "2024CS0123",
            "password": "WrongPassword!999",
            "role": "student"
        })
        self.assertEqual(res.status_code, 401)

        res2 = self.client.post("/api/auth/login", json={
            "userId": "NON_EXISTENT_ID_999",
            "password": "StudentPass@2026",
            "role": "student"
        })
        self.assertEqual(res2.status_code, 401)

    def test_08_logout(self):
        """Test session termination and cookie clearing."""
        res = self.client.post("/api/auth/logout")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get("success"))

    def test_09_all_department_roster_accounts(self):
        """Test authentication for all specialized department roster accounts."""
        accounts = [
            ("DEPT-PLUMB-04", "dispatch.plumbing@campus.edu", "DeptOps@2026", "Facility Maintenance & Plumbing"),
            ("DEPT-ELECT-02", "dispatch.electrical@campus.edu", "DeptOps@2026", "Campus Electrical & Power"),
            ("DEPT-HOSTEL-01", "dispatch.hostel@campus.edu", "DeptOps@2026", "Hostel Sanitation & Food Services"),
            ("DEPT-IT-01", "dispatch.network@campus.edu", "DeptOps@2026", "IT & Campus Network Services"),
            ("DEPT-SHE-01", "icc.she@campus.edu", "DeptOps@2026", "SHE Complaint Cell"),
            ("DEPT-RAG-01", "antiragging.cell@campus.edu", "DeptOps@2026", "Anti-Ragging Committee")
        ]
        for dept_id, dept_email, dept_pass, expected_dept in accounts:
            self.client.cookies.clear()
            # Test by ID
            r_id = self.client.post("/api/auth/login", json={
                "userId": dept_id,
                "password": dept_pass,
                "role": "department"
            })
            self.assertEqual(r_id.status_code, 200, f"Failed for {dept_id}: {r_id.text}")
            self.assertEqual(r_id.json()["user"]["role"], "department")

            # Test by Email
            self.client.cookies.clear()
            r_email = self.client.post("/api/auth/login", json={
                "email": dept_email,
                "password": dept_pass,
                "role": "department"
            })
            self.assertEqual(r_email.status_code, 200, f"Failed for {dept_email}: {r_email.text}")
            self.assertEqual(r_email.json()["user"]["role"], "department")

    def test_10_role_switching_flow(self):
        """Test seamless role switching: Student -> Admin -> Department -> Student."""
        # 1. Login as Student
        r1 = self.client.post("/api/auth/login", json={
            "userId": "2024CS0123",
            "password": "StudentPass@2026",
            "role": "student"
        })
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(self.client.get("/student-dashboard.html").status_code, 200)

        # 2. Switch to Admin
        r2 = self.client.post("/api/auth/login", json={
            "userId": "EMP-ADM-001",
            "password": "AdminDean@2026",
            "role": "admin"
        })
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(self.client.get("/admin-dashboard.html").status_code, 200)

        # 3. Switch to Department
        r3 = self.client.post("/api/auth/login", json={
            "userId": "DEPT-OPS-01",
            "password": "DeptOps@2026",
            "role": "department",
            "deptName": "Campus Electrical & Power"
        })
        self.assertEqual(r3.status_code, 200)
        self.assertEqual(self.client.get("/department-dashboard.html").status_code, 200)

        # 4. Switch back to Student
        r4 = self.client.post("/api/auth/login", json={
            "userId": "2024CS0123",
            "password": "StudentPass@2026",
            "role": "student"
        })
        self.assertEqual(r4.status_code, 200)
        self.assertEqual(self.client.get("/student-dashboard.html").status_code, 200)

if __name__ == "__main__":
    unittest.main()
