"""
Executive Dashboard & Regression Testing for AgriBiz ERP
Tests new /api/reports/exec-dashboard endpoint and verifies no regression
"""
import os
import requests
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://agribiz-session-c.preview.emergentagent.com").rstrip("/")
API_BASE = f"{BACKEND_URL}/api"

# Admin credentials
ADMIN_EMAIL = "admin@agribiz.com"
ADMIN_PASSWORD = "admin123"

def login():
    """Login and return access token"""
    print(f"\n🔐 Logging in as {ADMIN_EMAIL}...")
    r = requests.post(f"{API_BASE}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }, timeout=20)
    
    if r.status_code != 200:
        print(f"❌ Login failed: {r.status_code} - {r.text}")
        return None
    
    data = r.json()
    print(f"✅ Login successful: {data['user']['name']}")
    return data["access_token"]

def get_headers(token):
    """Return headers with auth token"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def create_test_data(headers):
    """Create necessary test data for testing"""
    print("\n📦 Creating test data...")
    
    # Create customer
    print("  Creating customer...")
    cust_r = requests.post(f"{API_BASE}/customers", json={
        "name": "Lakshmi Poultry Farms",
        "phone": "9876543210",
        "farm_name": "Lakshmi Farms",
        "address": "456 Farm Road, Coimbatore, Tamil Nadu",
        "gst": "33ABCDE5678F1Z5",
        "business_units": [1, 2, 3, 4]
    }, headers=headers)
    
    if cust_r.status_code != 200:
        print(f"❌ Customer creation failed: {cust_r.status_code} - {cust_r.text}")
        return None
    
    customer_id = cust_r.json()["id"]
    print(f"  ✅ Customer created: {customer_id}")
    
    # Create supplier
    print("  Creating supplier...")
    supp_r = requests.post(f"{API_BASE}/suppliers", json={
        "name": "Premium Feed Suppliers",
        "phone": "9876543211",
        "address": "789 Supply Street, Chennai",
        "business_unit": 1
    }, headers=headers)
    
    if supp_r.status_code != 200:
        print(f"❌ Supplier creation failed: {supp_r.status_code} - {supp_r.text}")
        return None
    
    supplier_id = supp_r.json()["id"]
    print(f"  ✅ Supplier created: {supplier_id}")
    
    # Create feed item
    print("  Creating feed item...")
    feed_item_r = requests.post(f"{API_BASE}/feed/items", json={
        "name": "Premium Layer Feed",
        "brand": "NutriPoultry Pro",
        "category": "Layer Feed",
        "unit": "kg"
    }, headers=headers)
    
    if feed_item_r.status_code != 200:
        print(f"❌ Feed item creation failed: {feed_item_r.status_code} - {feed_item_r.text}")
        return None
    
    feed_item_id = feed_item_r.json()["id"]
    print(f"  ✅ Feed item created: {feed_item_id}")
    
    # Create feed purchase to build stock
    print("  Creating feed purchase...")
    today = datetime.now().strftime("%Y-%m-%d")
    feed_purch_r = requests.post(f"{API_BASE}/feed/purchases", json={
        "supplier_id": supplier_id,
        "feed_item_id": feed_item_id,
        "date": today,
        "quantity": 2000.0,
        "purchase_rate": 55.0,
        "transport": 1000.0,
        "payment_status": "paid"
    }, headers=headers)
    
    if feed_purch_r.status_code != 200:
        print(f"❌ Feed purchase failed: {feed_purch_r.status_code} - {feed_purch_r.text}")
        return None
    
    print(f"  ✅ Feed purchase created")
    
    # Create feed sale
    print("  Creating feed sale...")
    feed_sale_r = requests.post(f"{API_BASE}/feed/sales", json={
        "customer_id": customer_id,
        "feed_item_id": feed_item_id,
        "date": today,
        "quantity": 150.0,
        "unit_price": 65.0,
        "transport": 300.0,
        "discount": 150.0,
        "payment_status": "pending"
    }, headers=headers)
    
    if feed_sale_r.status_code != 200:
        print(f"❌ Feed sale failed: {feed_sale_r.status_code} - {feed_sale_r.text}")
        return None
    
    feed_sale_id = feed_sale_r.json()["id"]
    print(f"  ✅ Feed sale created: {feed_sale_id}")
    
    return {
        "customer_id": customer_id,
        "supplier_id": supplier_id,
        "feed_item_id": feed_item_id,
        "feed_sale_id": feed_sale_id
    }

# ============ A) Executive Dashboard Tests ============

def test_exec_dashboard_basic(headers):
    """Test 1: GET /api/reports/exec-dashboard (no params) → 200 with correct structure"""
    print("\n📊 Test 1: Basic exec-dashboard endpoint...")
    
    r = requests.get(f"{API_BASE}/reports/exec-dashboard", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Check totals keys
    if "totals" not in data:
        print(f"❌ FAIL: Missing 'totals' key")
        return False
    
    totals = data["totals"]
    required_totals = ["revenue", "expenses", "profit", "outstanding", "stock_value"]
    missing = [k for k in required_totals if k not in totals]
    if missing:
        print(f"❌ FAIL: Missing totals keys: {missing}")
        return False
    
    # Check all totals are numbers
    for k in required_totals:
        if not isinstance(totals[k], (int, float)):
            print(f"❌ FAIL: totals.{k} is not a number: {type(totals[k])}")
            return False
    
    # Check per_bu keys
    if "per_bu" not in data:
        print(f"❌ FAIL: Missing 'per_bu' key")
        return False
    
    per_bu = data["per_bu"]
    required_bu = ["bu1", "bu2", "bu3", "bu4"]
    missing_bu = [k for k in required_bu if k not in per_bu]
    if missing_bu:
        print(f"❌ FAIL: Missing per_bu keys: {missing_bu}")
        return False
    
    # Check each BU has required fields
    required_bu_fields = ["business_unit", "label", "revenue", "expenses", "profit", 
                          "outstanding", "stock_value", "stock_units", "stock_unit_label", "sales_count"]
    for bu_key in required_bu:
        bu_data = per_bu[bu_key]
        missing_fields = [f for f in required_bu_fields if f not in bu_data]
        if missing_fields:
            print(f"❌ FAIL: {bu_key} missing fields: {missing_fields}")
            return False
    
    # Check monthly_trend
    if "monthly_trend" not in data:
        print(f"❌ FAIL: Missing 'monthly_trend' key")
        return False
    
    monthly_trend = data["monthly_trend"]
    if not isinstance(monthly_trend, list):
        print(f"❌ FAIL: monthly_trend is not a list")
        return False
    
    if len(monthly_trend) != 6:
        print(f"❌ FAIL: monthly_trend length is {len(monthly_trend)}, expected 6")
        return False
    
    # Check each month has required fields
    for i, month_data in enumerate(monthly_trend):
        if "month" not in month_data or "revenue" not in month_data or "expenses" not in month_data:
            print(f"❌ FAIL: monthly_trend[{i}] missing required fields")
            return False
    
    # Check expense_breakdown
    if "expense_breakdown" not in data:
        print(f"❌ FAIL: Missing 'expense_breakdown' key")
        return False
    
    expense_breakdown = data["expense_breakdown"]
    if not isinstance(expense_breakdown, list):
        print(f"❌ FAIL: expense_breakdown is not a list")
        return False
    
    # Check sorted by amount desc
    for i in range(len(expense_breakdown) - 1):
        if expense_breakdown[i]["amount"] < expense_breakdown[i+1]["amount"]:
            print(f"❌ FAIL: expense_breakdown not sorted by amount desc")
            return False
    
    print(f"✅ PASS: Structure correct")
    print(f"   Totals: revenue={totals['revenue']}, expenses={totals['expenses']}, profit={totals['profit']}")
    print(f"   Per-BU: {len(per_bu)} business units")
    print(f"   Monthly trend: {len(monthly_trend)} months")
    print(f"   Expense breakdown: {len(expense_breakdown)} categories")
    
    return True

def test_exec_dashboard_totals_match(headers):
    """Test 2: Verify totals.revenue == sum(per_bu[*].revenue) (within ±1.0)"""
    print("\n📊 Test 2: Verify totals.revenue matches sum of per_bu revenues...")
    
    r = requests.get(f"{API_BASE}/reports/exec-dashboard", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code}")
        return False
    
    data = r.json()
    totals_revenue = data["totals"]["revenue"]
    per_bu_revenue_sum = sum(bu["revenue"] for bu in data["per_bu"].values())
    
    diff = abs(totals_revenue - per_bu_revenue_sum)
    
    if diff > 1.0:
        print(f"❌ FAIL: totals.revenue ({totals_revenue}) != sum(per_bu.revenue) ({per_bu_revenue_sum}), diff={diff}")
        return False
    
    print(f"✅ PASS: totals.revenue ({totals_revenue}) ≈ sum(per_bu.revenue) ({per_bu_revenue_sum}), diff={diff:.2f}")
    return True

def test_exec_dashboard_profit_calc(headers):
    """Test 3: Verify totals.profit == totals.revenue − totals.expenses (within ±1.0)"""
    print("\n📊 Test 3: Verify totals.profit calculation...")
    
    r = requests.get(f"{API_BASE}/reports/exec-dashboard", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code}")
        return False
    
    data = r.json()
    totals = data["totals"]
    expected_profit = totals["revenue"] - totals["expenses"]
    actual_profit = totals["profit"]
    
    diff = abs(expected_profit - actual_profit)
    
    if diff > 1.0:
        print(f"❌ FAIL: totals.profit ({actual_profit}) != revenue-expenses ({expected_profit}), diff={diff}")
        return False
    
    print(f"✅ PASS: totals.profit ({actual_profit}) = revenue ({totals['revenue']}) - expenses ({totals['expenses']}), diff={diff:.2f}")
    return True

def test_exec_dashboard_bu_profit(headers):
    """Test 4: Verify per_bu.bu1.profit == per_bu.bu1.revenue − per_bu.bu1.expenses"""
    print("\n📊 Test 4: Verify per-BU profit calculations...")
    
    r = requests.get(f"{API_BASE}/reports/exec-dashboard", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code}")
        return False
    
    data = r.json()
    all_pass = True
    
    for bu_key in ["bu1", "bu2", "bu3", "bu4"]:
        bu = data["per_bu"][bu_key]
        expected_profit = bu["revenue"] - bu["expenses"]
        actual_profit = bu["profit"]
        diff = abs(expected_profit - actual_profit)
        
        if diff > 0.01:
            print(f"❌ FAIL: {bu_key}.profit ({actual_profit}) != revenue-expenses ({expected_profit}), diff={diff}")
            all_pass = False
        else:
            print(f"   ✅ {bu_key}: profit={actual_profit}, revenue={bu['revenue']}, expenses={bu['expenses']}")
    
    if all_pass:
        print(f"✅ PASS: All per-BU profit calculations correct")
    
    return all_pass

def test_exec_dashboard_future_date(headers):
    """Test 5: GET /api/reports/exec-dashboard?dfrom=2099-01-01 → totals all 0, monthly_trend still length 6"""
    print("\n📊 Test 5: Test with future date filter...")
    
    r = requests.get(f"{API_BASE}/reports/exec-dashboard?dfrom=2099-01-01", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code}")
        return False
    
    data = r.json()
    totals = data["totals"]
    
    # Check totals are all 0
    if totals["revenue"] != 0 or totals["expenses"] != 0 or totals["profit"] != 0:
        print(f"❌ FAIL: Totals not all 0 with future date: revenue={totals['revenue']}, expenses={totals['expenses']}, profit={totals['profit']}")
        return False
    
    # Check monthly_trend still has 6 entries
    if len(data["monthly_trend"]) != 6:
        print(f"❌ FAIL: monthly_trend length is {len(data['monthly_trend'])}, expected 6")
        return False
    
    print(f"✅ PASS: Future date filter works - totals all 0, monthly_trend length 6")
    return True

def test_exec_dashboard_date_range(headers):
    """Test 6: GET /api/reports/exec-dashboard?dfrom=2026-06-01&dto=2026-06-30 → monthly_trend last entry month should be "2026-06" """
    print("\n📊 Test 6: Test with specific date range...")
    
    r = requests.get(f"{API_BASE}/reports/exec-dashboard?dfrom=2026-06-01&dto=2026-06-30", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code}")
        return False
    
    data = r.json()
    monthly_trend = data["monthly_trend"]
    
    if len(monthly_trend) != 6:
        print(f"❌ FAIL: monthly_trend length is {len(monthly_trend)}, expected 6")
        return False
    
    last_month = monthly_trend[-1]["month"]
    
    if last_month != "2026-06":
        print(f"❌ FAIL: Last month is {last_month}, expected 2026-06")
        return False
    
    print(f"✅ PASS: Date range filter works - last month is {last_month}")
    print(f"   Monthly trend: {[m['month'] for m in monthly_trend]}")
    
    return True

# ============ B) Regression Tests ============

def test_regression_payment(headers, test_data):
    """Test 7: POST /api/payments {customer_id, amount, date} → 200"""
    print("\n🔄 Test 7: Regression - POST /api/payments...")
    
    # Get customer details first to check outstanding
    cust_r = requests.get(f"{API_BASE}/customers/{test_data['customer_id']}/details", headers=headers)
    if cust_r.status_code != 200:
        print(f"❌ FAIL: Could not get customer details: {cust_r.status_code}")
        return False
    
    cust_data = cust_r.json()
    outstanding = cust_data.get("outstanding", 0)
    
    if outstanding <= 0:
        print(f"   Note: Customer has no outstanding balance ({outstanding}), payment may not be needed")
    
    # Make payment
    today = datetime.now().strftime("%Y-%m-%d")
    payment_amount = min(500.0, outstanding) if outstanding > 0 else 100.0
    
    r = requests.post(f"{API_BASE}/payments", json={
        "customer_id": test_data["customer_id"],
        "amount": payment_amount,
        "date": today
    }, headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    payment_data = r.json()
    print(f"✅ PASS: Payment created - amount={payment_amount}, id={payment_data.get('id', 'N/A')}")
    return True

def test_regression_feed_sales(headers, test_data):
    """Test 8: POST /api/feed/sales still creates sales (200) and returns invoice_no"""
    print("\n🔄 Test 8: Regression - POST /api/feed/sales...")
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    r = requests.post(f"{API_BASE}/feed/sales", json={
        "customer_id": test_data["customer_id"],
        "feed_item_id": test_data["feed_item_id"],
        "date": today,
        "quantity": 50.0,
        "unit_price": 70.0,
        "transport": 150.0,
        "discount": 50.0,
        "payment_status": "pending"
    }, headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    sale_data = r.json()
    
    if "invoice_no" not in sale_data:
        print(f"❌ FAIL: Response missing 'invoice_no' field")
        return False
    
    print(f"✅ PASS: Feed sale created - invoice_no={sale_data['invoice_no']}, id={sale_data.get('id', 'N/A')}")
    return True

def test_regression_invoice_pdf(headers, test_data):
    """Test 9: GET /api/invoice/feed/{sale_id}/pdf → valid PDF"""
    print("\n🔄 Test 9: Regression - GET /api/invoice/feed/{sale_id}/pdf...")
    
    r = requests.get(f"{API_BASE}/invoice/feed/{test_data['feed_sale_id']}/pdf", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    # Check Content-Type
    content_type = r.headers.get("Content-Type", "")
    if "application/pdf" not in content_type:
        print(f"❌ FAIL: Wrong Content-Type: {content_type} (expected application/pdf)")
        return False
    
    # Check PDF magic bytes
    if not r.content.startswith(b"%PDF"):
        print(f"❌ FAIL: Response doesn't start with %PDF magic bytes")
        return False
    
    print(f"✅ PASS: Invoice PDF valid - {len(r.content)} bytes, Content-Type: {content_type}")
    return True

def test_regression_customer_details(headers, test_data):
    """Test 10: GET /api/customers/{id}/details → 200 with invoices and payments arrays"""
    print("\n🔄 Test 10: Regression - GET /api/customers/{id}/details...")
    
    r = requests.get(f"{API_BASE}/customers/{test_data['customer_id']}/details", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    if "invoices" not in data:
        print(f"❌ FAIL: Response missing 'invoices' field")
        return False
    
    if "payments" not in data:
        print(f"❌ FAIL: Response missing 'payments' field")
        return False
    
    if not isinstance(data["invoices"], list):
        print(f"❌ FAIL: 'invoices' is not a list")
        return False
    
    if not isinstance(data["payments"], list):
        print(f"❌ FAIL: 'payments' is not a list")
        return False
    
    print(f"✅ PASS: Customer details valid - {len(data['invoices'])} invoices, {len(data['payments'])} payments")
    return True

def test_regression_customer_statement_pdf(headers, test_data):
    """Test 11: GET /api/customers/{id}/statement/pdf → valid PDF"""
    print("\n🔄 Test 11: Regression - GET /api/customers/{id}/statement/pdf...")
    
    r = requests.get(f"{API_BASE}/customers/{test_data['customer_id']}/statement/pdf", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    # Check Content-Type
    content_type = r.headers.get("Content-Type", "")
    if "application/pdf" not in content_type:
        print(f"❌ FAIL: Wrong Content-Type: {content_type} (expected application/pdf)")
        return False
    
    # Check PDF magic bytes
    if not r.content.startswith(b"%PDF"):
        print(f"❌ FAIL: Response doesn't start with %PDF magic bytes")
        return False
    
    print(f"✅ PASS: Customer statement PDF valid - {len(r.content)} bytes")
    return True

def test_regression_dashboard_summary(headers):
    """Test 12: GET /api/dashboard/summary → 200, contains outstanding & recent_transactions fields"""
    print("\n🔄 Test 12: Regression - GET /api/dashboard/summary...")
    
    r = requests.get(f"{API_BASE}/dashboard/summary", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    if "outstanding" not in data:
        print(f"❌ FAIL: Response missing 'outstanding' field")
        return False
    
    if "recent_transactions" not in data:
        print(f"❌ FAIL: Response missing 'recent_transactions' field")
        return False
    
    print(f"✅ PASS: Dashboard summary valid - outstanding={data['outstanding']}, recent_transactions count={len(data.get('recent_transactions', []))}")
    return True

def test_regression_top_customers(headers):
    """Test 13: GET /api/dashboard/top-customers?by=outstanding → returns list (≤5)"""
    print("\n🔄 Test 13: Regression - GET /api/dashboard/top-customers?by=outstanding...")
    
    r = requests.get(f"{API_BASE}/dashboard/top-customers?by=outstanding", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    if not isinstance(data, list):
        print(f"❌ FAIL: Response is not a list")
        return False
    
    if len(data) > 5:
        print(f"❌ FAIL: Response has {len(data)} items, expected ≤5")
        return False
    
    print(f"✅ PASS: Top customers valid - {len(data)} customers returned")
    return True

def main():
    """Main test runner"""
    print("=" * 80)
    print("🧪 AgriBiz ERP - Executive Dashboard & Regression Testing")
    print("=" * 80)
    
    # Login
    token = login()
    if not token:
        print("\n❌ FAILED: Could not login")
        return False
    
    headers = get_headers(token)
    
    # Create test data
    test_data = create_test_data(headers)
    if not test_data:
        print("\n❌ FAILED: Could not create test data")
        return False
    
    # Track results
    results = {}
    
    # A) Executive Dashboard Tests
    print("\n" + "=" * 80)
    print("📊 A) EXECUTIVE DASHBOARD TESTS")
    print("=" * 80)
    
    results["Test 1: Basic structure"] = test_exec_dashboard_basic(headers)
    results["Test 2: Totals revenue match"] = test_exec_dashboard_totals_match(headers)
    results["Test 3: Totals profit calc"] = test_exec_dashboard_profit_calc(headers)
    results["Test 4: Per-BU profit calc"] = test_exec_dashboard_bu_profit(headers)
    results["Test 5: Future date filter"] = test_exec_dashboard_future_date(headers)
    results["Test 6: Date range filter"] = test_exec_dashboard_date_range(headers)
    
    # B) Regression Tests
    print("\n" + "=" * 80)
    print("🔄 B) REGRESSION TESTS")
    print("=" * 80)
    
    results["Test 7: POST /api/payments"] = test_regression_payment(headers, test_data)
    results["Test 8: POST /api/feed/sales"] = test_regression_feed_sales(headers, test_data)
    results["Test 9: Invoice PDF"] = test_regression_invoice_pdf(headers, test_data)
    results["Test 10: Customer details"] = test_regression_customer_details(headers, test_data)
    results["Test 11: Customer statement PDF"] = test_regression_customer_statement_pdf(headers, test_data)
    results["Test 12: Dashboard summary"] = test_regression_dashboard_summary(headers)
    results["Test 13: Top customers"] = test_regression_top_customers(headers)
    
    # Final summary
    print("\n" + "=" * 80)
    print("📋 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print("\n" + "=" * 80)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ ALL TESTS PASSED")
    else:
        print(f"❌ {total - passed} TEST(S) FAILED")
    print("=" * 80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
