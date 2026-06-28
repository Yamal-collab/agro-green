"""Backend API tests for AgriBiz platform."""
import os
import uuid
from datetime import datetime
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bu-analytics.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@agribiz.com", "password": "admin123"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    assert data["user"]["email"] == ADMIN["email"]
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def state():
    return {}


# ---- Auth ----
def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@agribiz.com", "password": "wrong"})
    assert r.status_code == 401


def test_me(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["role"] == "super_admin"


def test_me_no_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# ---- Customers ----
def test_create_customer(admin_headers, state):
    payload = {"name": f"TEST_Cust_{uuid.uuid4().hex[:6]}", "phone": "9999", "credit_limit": 5000}
    r = requests.post(f"{API}/customers", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == payload["name"]
    assert data["outstanding"] == 0.0
    assert "id" in data
    state["customer_id"] = data["id"]
    state["customer_name"] = data["name"]


def test_list_customers(admin_headers, state):
    r = requests.get(f"{API}/customers", headers=admin_headers)
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert state["customer_id"] in ids


# ---- Poultry ----
def test_create_batch(admin_headers, state):
    payload = {"batch_no": f"B{uuid.uuid4().hex[:5]}", "hatch_date": "2026-01-01", "quantity": 100}
    r = requests.post(f"{API}/poultry/batches", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    state["batch_id"] = r.json()["id"]


def test_list_batches(admin_headers):
    r = requests.get(f"{API}/poultry/batches", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_poultry_sale(admin_headers, state):
    payload = {
        "customer_id": state["customer_id"],
        "customer_name": state["customer_name"],
        "date": datetime.now().strftime("%Y-%m-%d"),
        "product": "eggs",
        "quantity": 10,
        "unit_price": 5,
        "transport": 20,
        "discount": 5,
        "payment_status": "pending",
    }
    r = requests.post(f"{API}/poultry/sales", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 10 * 5 + 20 - 5  # 65
    assert data["invoice_no"].startswith(f"P-{datetime.now().year}-")
    state["poultry_total"] = data["total"]

    # Check customer outstanding incremented
    c = requests.get(f"{API}/customers", headers=admin_headers).json()
    cust = next(x for x in c if x["id"] == state["customer_id"])
    assert cust["outstanding"] == data["total"]


def test_create_poultry_expense(admin_headers):
    payload = {"category": "feed", "amount": 200, "date": datetime.now().strftime("%Y-%m-%d")}
    r = requests.post(f"{API}/poultry/expenses", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["amount"] == 200


# ---- Water ----
def test_create_tank(admin_headers, state):
    payload = {"name": f"TEST_Tank_{uuid.uuid4().hex[:5]}", "capacity": 5000, "current_liters": 100}
    r = requests.post(f"{API}/water/tanks", json=payload, headers=admin_headers)
    assert r.status_code == 200
    state["tank_id"] = r.json()["id"]


def test_tank_adjust(admin_headers, state):
    r = requests.post(f"{API}/water/tanks/{state['tank_id']}/adjust",
                     json={"delta": 1000, "reason": "refill"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["current_liters"] == 1100
    # Clamp at 0
    r2 = requests.post(f"{API}/water/tanks/{state['tank_id']}/adjust",
                      json={"delta": -99999, "reason": "drain"}, headers=admin_headers)
    assert r2.status_code == 200
    assert r2.json()["current_liters"] == 0.0


def test_create_lorry(admin_headers, state):
    payload = {"registration_no": f"TN{uuid.uuid4().hex[:4]}", "capacity": 10000}
    r = requests.post(f"{API}/water/lorries", json=payload, headers=admin_headers)
    assert r.status_code == 200
    state["lorry_id"] = r.json()["id"]


def test_create_water_sale(admin_headers, state):
    payload = {
        "customer_id": state["customer_id"],
        "customer_name": state["customer_name"],
        "date": datetime.now().strftime("%Y-%m-%d"),
        "liters": 1000, "rate": 0.5, "delivery": 50,
        "payment_status": "pending",
    }
    r = requests.post(f"{API}/water/sales", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 1000 * 0.5 + 50  # 550
    assert data["invoice_no"].startswith(f"W-{datetime.now().year}-")
    state["water_total"] = data["total"]


# ---- Inventory ----
def test_inventory_flow(admin_headers, state):
    payload = {"name": f"TEST_Feed_{uuid.uuid4().hex[:5]}", "category": "feed", "unit": "kg",
               "stock": 50, "threshold": 10}
    r = requests.post(f"{API}/inventory/items", json=payload, headers=admin_headers)
    assert r.status_code == 200
    iid = r.json()["id"]
    state["item_id"] = iid

    # in: +20 -> 70
    r2 = requests.post(f"{API}/inventory/move",
                      json={"item_id": iid, "type": "in", "quantity": 20}, headers=admin_headers)
    assert r2.status_code == 200
    assert r2.json()["new_stock"] == 70

    # out: -5 -> 65
    r3 = requests.post(f"{API}/inventory/move",
                      json={"item_id": iid, "type": "out", "quantity": 5}, headers=admin_headers)
    assert r3.status_code == 200
    assert r3.json()["new_stock"] == 65

    # adjust to 30 (absolute)
    r4 = requests.post(f"{API}/inventory/move",
                      json={"item_id": iid, "type": "adjust", "quantity": 30}, headers=admin_headers)
    assert r4.status_code == 200
    assert r4.json()["new_stock"] == 30


# ---- Payments ----
def test_payment(admin_headers, state):
    # Customer outstanding currently = poultry_total + water_total
    expected_before = state["poultry_total"] + state["water_total"]
    pay = 100
    r = requests.post(f"{API}/payments",
                     json={"customer_id": state["customer_id"], "amount": pay,
                           "date": datetime.now().strftime("%Y-%m-%d"), "method": "cash"},
                     headers=admin_headers)
    assert r.status_code == 200, r.text
    customers = requests.get(f"{API}/customers", headers=admin_headers).json()
    cust = next(c for c in customers if c["id"] == state["customer_id"])
    assert abs(cust["outstanding"] - (expected_before - pay)) < 0.01


# ---- Finance / Dashboard ----
def test_pnl(admin_headers):
    month = datetime.now().strftime("%Y-%m")
    r = requests.get(f"{API}/finance/pnl", headers=admin_headers, params={"month": month})
    assert r.status_code == 200
    data = r.json()
    for k in ("income", "expense", "profit", "expense_by_category"):
        assert k in data
    assert data["profit"] == round(data["income"] - data["expense"], 2)


def test_dashboard(admin_headers):
    r = requests.get(f"{API}/dashboard/summary", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    for k in ("today_sales", "month_income", "month_expense", "net_profit", "outstanding",
              "low_stock_count", "active_batches", "lorries_total", "tanks_total",
              "top_customers", "low_stock", "recent_poultry_sales", "recent_water_sales", "revenue_trend"):
        assert k in data, f"missing {k}"
    assert len(data["revenue_trend"]) == 7


# ---- RBAC ----
def test_rbac_farm_staff_cannot_create_customer(admin_headers):
    email = f"TEST_staff_{uuid.uuid4().hex[:6]}@x.com"
    r = requests.post(f"{API}/auth/register",
                     json={"email": email, "password": "pass123", "name": "S", "role": "farm_staff"},
                     headers=admin_headers)
    assert r.status_code == 200, r.text
    lr = requests.post(f"{API}/auth/login", json={"email": email, "password": "pass123"})
    assert lr.status_code == 200
    tok = lr.json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    cr = requests.post(f"{API}/customers", json={"name": "x"}, headers=h)
    assert cr.status_code == 403


def test_rbac_driver_cannot_create_batch(admin_headers):
    email = f"TEST_drv_{uuid.uuid4().hex[:6]}@x.com"
    r = requests.post(f"{API}/auth/register",
                     json={"email": email, "password": "pass123", "name": "D", "role": "driver"},
                     headers=admin_headers)
    assert r.status_code == 200
    lr = requests.post(f"{API}/auth/login", json={"email": email, "password": "pass123"})
    tok = lr.json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    br = requests.post(f"{API}/poultry/batches",
                      json={"batch_no": "X", "hatch_date": "2026-01-01", "quantity": 1}, headers=h)
    assert br.status_code == 403
