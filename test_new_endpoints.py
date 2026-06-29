"""
AgriBiz ERP - Customer Ledger, Statement, Reports & Dashboard Testing
Tests all new endpoints added for customer statements, reports, and dashboard widgets
"""
import os
import requests
from datetime import datetime, timedelta

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

def get_or_create_customer_with_activity(headers):
    """Get existing customer with activity or create one with sales and payments"""
    print("\n📦 Setting up customer with activity...")
    
    # Try to get existing customers
    custs_r = requests.get(f"{API_BASE}/customers", headers=headers)
    if custs_r.status_code == 200:
        customers = custs_r.json()
        # Find customer with outstanding > 0
        for c in customers:
            if c.get("outstanding", 0) > 0:
                print(f"  ✅ Using existing customer: {c['name']} (ID: {c['id']}, Outstanding: Rs. {c.get('outstanding', 0):,.2f})")
                return c["id"]
    
    # Create new customer with activity
    print("  Creating new customer with activity...")
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Create customer
    cust_r = requests.post(f"{API_BASE}/customers", json={
        "name": "Suresh Poultry Farm",
        "phone": "9876543210",
        "farm_name": "Suresh Farms",
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
    supp_r = requests.post(f"{API_BASE}/suppliers", json={
        "name": "Premium Feed Suppliers",
        "phone": "9876543211",
        "address": "789 Supply Street",
        "business_unit": 1
    }, headers=headers)
    
    if supp_r.status_code != 200:
        print(f"❌ Supplier creation failed")
        return None
    
    supplier_id = supp_r.json()["id"]
    
    # Create feed item
    feed_item_r = requests.post(f"{API_BASE}/feed/items", json={
        "name": "Premium Layer Feed",
        "brand": "NutriMax",
        "category": "Layer Feed",
        "unit": "kg"
    }, headers=headers)
    
    if feed_item_r.status_code != 200:
        print(f"❌ Feed item creation failed")
        return None
    
    feed_item_id = feed_item_r.json()["id"]
    
    # Create feed purchase to build stock
    feed_purch_r = requests.post(f"{API_BASE}/feed/purchases", json={
        "supplier_id": supplier_id,
        "feed_item_id": feed_item_id,
        "date": yesterday,
        "quantity": 2000.0,
        "purchase_rate": 45.0,
        "transport": 1000.0,
        "payment_status": "paid"
    }, headers=headers)
    
    if feed_purch_r.status_code != 200:
        print(f"❌ Feed purchase failed")
        return None
    
    # Create multiple feed sales for the customer
    for i in range(3):
        sale_date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        feed_sale_r = requests.post(f"{API_BASE}/feed/sales", json={
            "customer_id": customer_id,
            "feed_item_id": feed_item_id,
            "date": sale_date,
            "quantity": 100.0 + (i * 20),
            "unit_price": 55.0,
            "transport": 200.0,
            "discount": 50.0,
            "payment_status": "pending"
        }, headers=headers)
        
        if feed_sale_r.status_code != 200:
            print(f"❌ Feed sale {i+1} failed")
            continue
    
    # Create a payment
    payment_r = requests.post(f"{API_BASE}/payments", json={
        "customer_id": customer_id,
        "amount": 3000.0,
        "date": today,
        "method": "cash",
        "notes": "Partial payment"
    }, headers=headers)
    
    if payment_r.status_code != 200:
        print(f"❌ Payment creation failed")
    
    print(f"  ✅ Customer with activity created: {customer_id}")
    return customer_id

# ============ A) Customer Ledger & Statement Tests ============

def test_customer_ledger(headers, customer_id):
    """Test 1: GET /api/customers/{id}/ledger"""
    print(f"\n📊 Test 1: GET /api/customers/{customer_id}/ledger")
    
    r = requests.get(f"{API_BASE}/customers/{customer_id}/ledger", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Verify required fields
    required_fields = ["customer", "entries", "opening_balance", "closing_balance", 
                      "total_debit", "total_credit", "total_billed", "total_paid", 
                      "outstanding", "last_purchase_date", "last_payment_date"]
    
    missing = [f for f in required_fields if f not in data]
    if missing:
        print(f"❌ FAIL: Missing fields: {missing}")
        return False
    
    # Verify entries structure
    if not isinstance(data["entries"], list):
        print(f"❌ FAIL: entries is not a list")
        return False
    
    if len(data["entries"]) > 0:
        entry = data["entries"][0]
        entry_fields = ["date", "kind", "debit", "credit", "running_balance", "description"]
        missing_entry_fields = [f for f in entry_fields if f not in entry]
        if missing_entry_fields:
            print(f"❌ FAIL: Entry missing fields: {missing_entry_fields}")
            return False
        
        # Verify kind is either "sale" or "payment"
        if entry["kind"] not in ["sale", "payment"]:
            print(f"❌ FAIL: Invalid entry kind: {entry['kind']}")
            return False
    
    # Verify entries are sorted by date ascending
    dates = [e["date"] for e in data["entries"]]
    if dates != sorted(dates):
        print(f"❌ FAIL: Entries not sorted by date ascending")
        return False
    
    # Verify running_balance of last entry equals closing_balance
    if len(data["entries"]) > 0:
        last_running = data["entries"][-1]["running_balance"]
        if abs(last_running - data["closing_balance"]) > 0.01:
            print(f"❌ FAIL: Last running_balance ({last_running}) != closing_balance ({data['closing_balance']})")
            return False
    
    # Verify closing_balance equals customer.outstanding (within ±1.0 rupee)
    cust_outstanding = data["customer"].get("outstanding", 0)
    if abs(data["closing_balance"] - cust_outstanding) > 1.0:
        print(f"❌ FAIL: closing_balance ({data['closing_balance']}) != customer.outstanding ({cust_outstanding})")
        return False
    
    print(f"✅ PASS: Ledger structure valid")
    print(f"   Entries: {len(data['entries'])}, Opening: Rs. {data['opening_balance']:,.2f}, Closing: Rs. {data['closing_balance']:,.2f}")
    print(f"   Total Debit: Rs. {data['total_debit']:,.2f}, Total Credit: Rs. {data['total_credit']:,.2f}")
    return True

def test_customer_ledger_date_filter(headers, customer_id):
    """Test 2: GET /api/customers/{id}/ledger with date filters"""
    print(f"\n📊 Test 2: GET /api/customers/{customer_id}/ledger with date filters")
    
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    r = requests.get(f"{API_BASE}/customers/{customer_id}/ledger?dfrom={yesterday}&dto={today}", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Verify opening_balance accounts for activity BEFORE dfrom
    # (opening_balance should be non-zero if there was activity before yesterday)
    
    # Verify all entries dates fall within range
    for entry in data["entries"]:
        entry_date = entry["date"]
        if entry_date < yesterday or entry_date > today:
            print(f"❌ FAIL: Entry date {entry_date} outside range [{yesterday}, {today}]")
            return False
    
    print(f"✅ PASS: Date filter working")
    print(f"   Date range: {yesterday} to {today}")
    print(f"   Entries in range: {len(data['entries'])}")
    print(f"   Opening balance: Rs. {data['opening_balance']:,.2f}")
    return True

def test_customer_statement_pdf(headers, customer_id):
    """Test 3: GET /api/customers/{id}/statement/pdf"""
    print(f"\n📄 Test 3: GET /api/customers/{customer_id}/statement/pdf")
    
    r = requests.get(f"{API_BASE}/customers/{customer_id}/statement/pdf", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    # Check Content-Type
    content_type = r.headers.get("Content-Type", "")
    if "application/pdf" not in content_type:
        print(f"❌ FAIL: Wrong Content-Type: {content_type}")
        return False
    
    # Check PDF magic bytes
    if not r.content.startswith(b"%PDF-"):
        print(f"❌ FAIL: Response doesn't start with %PDF-")
        return False
    
    print(f"✅ PASS: PDF generated successfully")
    print(f"   Size: {len(r.content)} bytes, Content-Type: {content_type}")
    return True

def test_customer_statement_print(headers, customer_id):
    """Test 4: GET /api/customers/{id}/statement/print"""
    print(f"\n🖨️  Test 4: GET /api/customers/{customer_id}/statement/print")
    
    r = requests.get(f"{API_BASE}/customers/{customer_id}/statement/print", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    # Check Content-Type is HTML
    content_type = r.headers.get("Content-Type", "")
    if "text/html" not in content_type:
        print(f"❌ FAIL: Wrong Content-Type: {content_type}")
        return False
    
    # Check HTML contains iframe pointing to PDF endpoint
    html = r.text
    expected_iframe_src = f"/api/customers/{customer_id}/statement/pdf"
    if expected_iframe_src not in html:
        print(f"❌ FAIL: HTML doesn't contain iframe with src='{expected_iframe_src}'")
        return False
    
    print(f"✅ PASS: Print HTML generated with iframe to PDF")
    return True

def test_customer_statement_share(headers, customer_id):
    """Test 5: POST /api/customers/{id}/statement/share"""
    print(f"\n📤 Test 5: POST /api/customers/{customer_id}/statement/share")
    
    r = requests.post(f"{API_BASE}/customers/{customer_id}/statement/share", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Check required keys
    required_keys = ["whatsapp_url", "mailto_url", "pdf_url"]
    missing = [k for k in required_keys if k not in data]
    if missing:
        print(f"❌ FAIL: Missing keys: {missing}")
        return False
    
    # Verify whatsapp_url starts with https://wa.me/
    if not data["whatsapp_url"].startswith("https://wa.me/"):
        print(f"❌ FAIL: whatsapp_url doesn't start with https://wa.me/")
        return False
    
    # Verify mailto_url starts with mailto:
    if not data["mailto_url"].startswith("mailto:"):
        print(f"❌ FAIL: mailto_url doesn't start with mailto:")
        return False
    
    print(f"✅ PASS: Share URLs generated")
    print(f"   PDF URL: {data['pdf_url']}")
    print(f"   WhatsApp: {data['whatsapp_url'][:60]}...")
    return True

# ============ B) Reports Tests ============

def test_report_sales(headers, customer_id):
    """Test 6-8: GET /api/reports/sales with various filters"""
    print(f"\n📈 Test 6: GET /api/reports/sales (no filters)")
    
    r = requests.get(f"{API_BASE}/reports/sales", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Verify structure
    if "summary" not in data or "rows" not in data:
        print(f"❌ FAIL: Missing summary or rows")
        return False
    
    if data["summary"]["count"] != len(data["rows"]):
        print(f"❌ FAIL: summary.count ({data['summary']['count']}) != rows length ({len(data['rows'])})")
        return False
    
    # Verify row structure
    if len(data["rows"]) > 0:
        row = data["rows"][0]
        required_fields = ["invoice_no", "business_unit", "total", "amount_paid", "balance_due", "payment_status"]
        missing = [f for f in required_fields if f not in row]
        if missing:
            print(f"❌ FAIL: Row missing fields: {missing}")
            return False
        
        # Verify business_unit is 1-4
        if row["business_unit"] not in [1, 2, 3, 4]:
            print(f"❌ FAIL: Invalid business_unit: {row['business_unit']}")
            return False
    
    print(f"✅ PASS: Sales report (no filters)")
    print(f"   Total sales: {data['summary']['count']}, Total: Rs. {data['summary']['total']:,.2f}")
    
    # Test 7: Filter by customer_id and business_unit
    print(f"\n📈 Test 7: GET /api/reports/sales?customer_id={customer_id}&business_unit=1")
    
    r2 = requests.get(f"{API_BASE}/reports/sales?customer_id={customer_id}&business_unit=1", headers=headers)
    
    if r2.status_code != 200:
        print(f"❌ FAIL: Status {r2.status_code} - {r2.text}")
        return False
    
    data2 = r2.json()
    
    # Verify all rows have business_unit=1 and customer_id matches
    for row in data2["rows"]:
        if row["business_unit"] != 1:
            print(f"❌ FAIL: Row has business_unit={row['business_unit']}, expected 1")
            return False
        if row["customer_id"] != customer_id:
            print(f"❌ FAIL: Row has customer_id={row['customer_id']}, expected {customer_id}")
            return False
    
    print(f"✅ PASS: Sales report filtered by customer and BU")
    print(f"   Filtered sales: {len(data2['rows'])}")
    
    # Test 8: Date out of range
    print(f"\n📈 Test 8: GET /api/reports/sales?dfrom=2099-01-01")
    
    r3 = requests.get(f"{API_BASE}/reports/sales?dfrom=2099-01-01", headers=headers)
    
    if r3.status_code != 200:
        print(f"❌ FAIL: Status {r3.status_code} - {r3.text}")
        return False
    
    data3 = r3.json()
    
    if len(data3["rows"]) != 0:
        print(f"❌ FAIL: Expected empty rows for future date, got {len(data3['rows'])}")
        return False
    
    print(f"✅ PASS: Sales report with future date returns empty")
    
    return True

def test_report_purchases(headers):
    """Test 9: GET /api/reports/purchases"""
    print(f"\n📦 Test 9: GET /api/reports/purchases")
    
    r = requests.get(f"{API_BASE}/reports/purchases", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Verify structure
    if "summary" not in data or "rows" not in data:
        print(f"❌ FAIL: Missing summary or rows")
        return False
    
    # Verify row structure
    if len(data["rows"]) > 0:
        row = data["rows"][0]
        required_fields = ["supplier_name", "business_unit", "total"]
        missing = [f for f in required_fields if f not in row]
        if missing:
            print(f"❌ FAIL: Row missing fields: {missing}")
            return False
    
    print(f"✅ PASS: Purchases report")
    print(f"   Total purchases: {data['summary']['count']}, Total: Rs. {data['summary']['total']:,.2f}")
    return True

def test_report_payments(headers):
    """Test 10: GET /api/reports/payments"""
    print(f"\n💰 Test 10: GET /api/reports/payments")
    
    r = requests.get(f"{API_BASE}/reports/payments", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Verify structure
    if "summary" not in data or "rows" not in data:
        print(f"❌ FAIL: Missing summary or rows")
        return False
    
    # Verify summary has count, total, by_method
    if "count" not in data["summary"] or "total" not in data["summary"] or "by_method" not in data["summary"]:
        print(f"❌ FAIL: Summary missing required fields")
        return False
    
    # Verify row structure
    if len(data["rows"]) > 0:
        row = data["rows"][0]
        if "allocations" not in row:
            print(f"❌ FAIL: Row missing allocations field")
            return False
    
    print(f"✅ PASS: Payments report")
    print(f"   Total payments: {data['summary']['count']}, Total: Rs. {data['summary']['total']:,.2f}")
    print(f"   By method: {data['summary']['by_method']}")
    return True

def test_report_stock(headers):
    """Test 11: GET /api/reports/stock"""
    print(f"\n📊 Test 11: GET /api/reports/stock")
    
    r = requests.get(f"{API_BASE}/reports/stock", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Verify required keys
    required_keys = ["feed", "hatchery", "farm", "water", "summary"]
    missing = [k for k in required_keys if k not in data]
    if missing:
        print(f"❌ FAIL: Missing keys: {missing}")
        return False
    
    print(f"✅ PASS: Stock report")
    print(f"   Feed items: {len(data['feed'])}, Batches: {len(data['hatchery'])}")
    print(f"   Farm stock: {len(data['farm'])}, Water tanks: {len(data['water'])}")
    return True

def test_report_bu_summary(headers):
    """Test 12: GET /api/reports/bu-summary"""
    print(f"\n📊 Test 12: GET /api/reports/bu-summary")
    
    r = requests.get(f"{API_BASE}/reports/bu-summary", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Verify bu1-bu4 keys
    for i in range(1, 5):
        bu_key = f"bu{i}"
        if bu_key not in data:
            print(f"❌ FAIL: Missing {bu_key}")
            return False
        
        bu_data = data[bu_key]
        required_fields = ["sales_count", "revenue", "collected", "outstanding"]
        missing = [f for f in required_fields if f not in bu_data]
        if missing:
            print(f"❌ FAIL: {bu_key} missing fields: {missing}")
            return False
    
    # Verify combined key
    if "combined" not in data:
        print(f"❌ FAIL: Missing combined key")
        return False
    
    combined = data["combined"]
    if "income" not in combined or "expense" not in combined or "profit" not in combined:
        print(f"❌ FAIL: Combined missing income/expense/profit")
        return False
    
    print(f"✅ PASS: BU Summary report")
    print(f"   BU1 Revenue: Rs. {data['bu1']['revenue']:,.2f}, BU2 Revenue: Rs. {data['bu2']['revenue']:,.2f}")
    print(f"   Combined - Income: Rs. {combined['income']:,.2f}, Expense: Rs. {combined['expense']:,.2f}, Profit: Rs. {combined['profit']:,.2f}")
    return True

def test_report_excel(headers):
    """Test 13: GET /api/reports/excel"""
    print(f"\n📊 Test 13a: GET /api/reports/excel?kind=sales")
    
    r = requests.get(f"{API_BASE}/reports/excel?kind=sales", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    # Check Content-Type
    content_type = r.headers.get("Content-Type", "")
    if "spreadsheetml" not in content_type and "xlsx" not in content_type:
        print(f"❌ FAIL: Wrong Content-Type: {content_type}")
        return False
    
    # Check first 4 bytes are "PK" (zip magic for xlsx)
    if not r.content[:2] == b"PK":
        print(f"❌ FAIL: First 2 bytes are not 'PK' (zip magic)")
        return False
    
    print(f"✅ PASS: Excel export (sales)")
    print(f"   Size: {len(r.content)} bytes, Content-Type: {content_type}")
    
    # Test outstanding report
    print(f"\n📊 Test 13b: GET /api/reports/excel?kind=outstanding")
    
    r2 = requests.get(f"{API_BASE}/reports/excel?kind=outstanding", headers=headers)
    
    if r2.status_code != 200:
        print(f"❌ FAIL: Status {r2.status_code} - {r2.text}")
        return False
    
    if not r2.content[:2] == b"PK":
        print(f"❌ FAIL: First 2 bytes are not 'PK'")
        return False
    
    print(f"✅ PASS: Excel export (outstanding)")
    print(f"   Size: {len(r2.content)} bytes")
    
    return True

# ============ C) Dashboard Widgets Tests ============

def test_dashboard_top_customers(headers):
    """Test 14-15: GET /api/dashboard/top-customers"""
    print(f"\n🏆 Test 14: GET /api/dashboard/top-customers?by=outstanding&limit=5")
    
    r = requests.get(f"{API_BASE}/dashboard/top-customers?by=outstanding&limit=5", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    if not isinstance(data, list):
        print(f"❌ FAIL: Response is not a list")
        return False
    
    if len(data) > 5:
        print(f"❌ FAIL: Returned more than 5 items: {len(data)}")
        return False
    
    # Verify sorted by outstanding desc
    if len(data) > 1:
        for i in range(len(data) - 1):
            if data[i]["outstanding"] < data[i+1]["outstanding"]:
                print(f"❌ FAIL: Not sorted by outstanding desc")
                return False
    
    # Verify structure
    if len(data) > 0:
        item = data[0]
        required_fields = ["id", "name", "outstanding"]
        missing = [f for f in required_fields if f not in item]
        if missing:
            print(f"❌ FAIL: Item missing fields: {missing}")
            return False
    
    print(f"✅ PASS: Top customers by outstanding")
    print(f"   Count: {len(data)}")
    if len(data) > 0:
        print(f"   Top: {data[0]['name']} - Rs. {data[0]['outstanding']:,.2f}")
    
    # Test 15: by revenue
    print(f"\n🏆 Test 15: GET /api/dashboard/top-customers?by=revenue&limit=5")
    
    r2 = requests.get(f"{API_BASE}/dashboard/top-customers?by=revenue&limit=5", headers=headers)
    
    if r2.status_code != 200:
        print(f"❌ FAIL: Status {r2.status_code} - {r2.text}")
        return False
    
    data2 = r2.json()
    
    if not isinstance(data2, list):
        print(f"❌ FAIL: Response is not a list")
        return False
    
    # Verify sorted by revenue desc
    if len(data2) > 1:
        for i in range(len(data2) - 1):
            if data2[i]["revenue"] < data2[i+1]["revenue"]:
                print(f"❌ FAIL: Not sorted by revenue desc")
                return False
    
    # Verify structure
    if len(data2) > 0:
        item = data2[0]
        required_fields = ["id", "name", "revenue"]
        missing = [f for f in required_fields if f not in item]
        if missing:
            print(f"❌ FAIL: Item missing fields: {missing}")
            return False
    
    print(f"✅ PASS: Top customers by revenue")
    print(f"   Count: {len(data2)}")
    if len(data2) > 0:
        print(f"   Top: {data2[0]['name']} - Rs. {data2[0]['revenue']:,.2f}")
    
    return True

def test_dashboard_recent_payments(headers):
    """Test 16: GET /api/dashboard/recent-payments"""
    print(f"\n💰 Test 16: GET /api/dashboard/recent-payments?limit=5")
    
    r = requests.get(f"{API_BASE}/dashboard/recent-payments?limit=5", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    if not isinstance(data, list):
        print(f"❌ FAIL: Response is not a list")
        return False
    
    # Verify structure
    if len(data) > 0:
        item = data[0]
        required_fields = ["party_name", "amount", "date", "method"]
        missing = [f for f in required_fields if f not in item]
        if missing:
            print(f"❌ FAIL: Item missing fields: {missing}")
            return False
    
    print(f"✅ PASS: Recent payments")
    print(f"   Count: {len(data)}")
    return True

def test_dashboard_recent_sales(headers):
    """Test 17: GET /api/dashboard/recent-sales"""
    print(f"\n📈 Test 17: GET /api/dashboard/recent-sales?limit=5")
    
    r = requests.get(f"{API_BASE}/dashboard/recent-sales?limit=5", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ FAIL: Status {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    if not isinstance(data, list):
        print(f"❌ FAIL: Response is not a list")
        return False
    
    # Verify structure
    if len(data) > 0:
        item = data[0]
        required_fields = ["invoice_no", "customer_name", "business_unit", "total"]
        missing = [f for f in required_fields if f not in item]
        if missing:
            print(f"❌ FAIL: Item missing fields: {missing}")
            return False
    
    print(f"✅ PASS: Recent sales")
    print(f"   Count: {len(data)}")
    return True

# ============ D) No Regression Tests ============

def test_no_regression_payment(headers, customer_id):
    """Test 18: POST /api/payments still works"""
    print(f"\n💰 Test 18: POST /api/payments (no regression)")
    
    # Get all customers and find one with outstanding
    custs_r = requests.get(f"{API_BASE}/customers", headers=headers)
    if custs_r.status_code != 200:
        print(f"❌ FAIL: Could not get customers")
        return False
    
    customers = custs_r.json()
    # Find customer with outstanding > 0
    target_customer = None
    for c in customers:
        if c.get("outstanding", 0) > 0:
            target_customer = c
            break
    
    if not target_customer:
        print(f"⚠️  SKIP: No customer with outstanding found")
        return True
    
    customer_id = target_customer["id"]
    outstanding_before = target_customer.get("outstanding", 0)
    
    outstanding_before = target_customer.get("outstanding", 0)
    
    # Create payment
    today = datetime.now().strftime("%Y-%m-%d")
    payment_r = requests.post(f"{API_BASE}/payments", json={
        "customer_id": customer_id,
        "amount": 500.0,
        "date": today,
        "method": "cash",
        "notes": "Test payment for regression check"
    }, headers=headers)
    
    if payment_r.status_code != 200:
        print(f"❌ FAIL: Payment creation failed: {payment_r.status_code} - {payment_r.text}")
        return False
    
    # Get customer outstanding after by fetching all customers
    custs_r2 = requests.get(f"{API_BASE}/customers", headers=headers)
    if custs_r2.status_code != 200:
        print(f"❌ FAIL: Could not get customers after payment")
        return False
    
    customers2 = custs_r2.json()
    target_customer2 = None
    for c in customers2:
        if c["id"] == customer_id:
            target_customer2 = c
            break
    
    if not target_customer2:
        print(f"❌ FAIL: Customer not found after payment")
        return False
    
    outstanding_after = target_customer2.get("outstanding", 0)
    
    # Verify outstanding decreased
    expected_outstanding = outstanding_before - 500.0
    if abs(outstanding_after - expected_outstanding) > 0.01:
        print(f"❌ FAIL: Outstanding not updated correctly. Before: {outstanding_before}, After: {outstanding_after}, Expected: {expected_outstanding}")
        return False
    
    print(f"✅ PASS: Payment creation works")
    print(f"   Outstanding: Rs. {outstanding_before:,.2f} → Rs. {outstanding_after:,.2f}")
    return True

def test_no_regression_feed_sale(headers, customer_id):
    """Test 19: POST /api/feed/sales still works"""
    print(f"\n🌾 Test 19: POST /api/feed/sales (no regression)")
    
    # Get feed items
    items_r = requests.get(f"{API_BASE}/feed/items", headers=headers)
    if items_r.status_code != 200 or len(items_r.json()) == 0:
        print(f"❌ FAIL: No feed items available")
        return False
    
    feed_item_id = items_r.json()[0]["id"]
    
    # Create feed sale
    today = datetime.now().strftime("%Y-%m-%d")
    sale_r = requests.post(f"{API_BASE}/feed/sales", json={
        "customer_id": customer_id,
        "feed_item_id": feed_item_id,
        "date": today,
        "quantity": 50.0,
        "unit_price": 55.0,
        "transport": 100.0,
        "discount": 25.0,
        "payment_status": "pending"
    }, headers=headers)
    
    if sale_r.status_code != 200:
        print(f"❌ FAIL: Feed sale creation failed: {sale_r.status_code} - {sale_r.text}")
        return False
    
    sale_data = sale_r.json()
    
    if "invoice_no" not in sale_data:
        print(f"❌ FAIL: Response missing invoice_no")
        return False
    
    print(f"✅ PASS: Feed sale creation works")
    print(f"   Invoice: {sale_data['invoice_no']}")
    return True

def test_no_regression_invoice_pdf(headers):
    """Test 20: GET /api/invoice/feed/{sale_id}/pdf still works"""
    print(f"\n📄 Test 20: GET /api/invoice/feed/{{sale_id}}/pdf (no regression)")
    
    # Get a feed sale
    sales_r = requests.get(f"{API_BASE}/feed/sales", headers=headers)
    if sales_r.status_code != 200 or len(sales_r.json()) == 0:
        print(f"❌ FAIL: No feed sales available")
        return False
    
    sale_id = sales_r.json()[0]["id"]
    
    # Get invoice PDF
    pdf_r = requests.get(f"{API_BASE}/invoice/feed/{sale_id}/pdf", headers=headers)
    
    if pdf_r.status_code != 200:
        print(f"❌ FAIL: Invoice PDF failed: {pdf_r.status_code} - {pdf_r.text}")
        return False
    
    # Check Content-Type
    content_type = pdf_r.headers.get("Content-Type", "")
    if "application/pdf" not in content_type:
        print(f"❌ FAIL: Wrong Content-Type: {content_type}")
        return False
    
    # Check PDF magic bytes
    if not pdf_r.content.startswith(b"%PDF"):
        print(f"❌ FAIL: Response doesn't start with %PDF")
        return False
    
    print(f"✅ PASS: Invoice PDF generation works")
    print(f"   Size: {len(pdf_r.content)} bytes")
    return True

# ============ Main Test Runner ============

def main():
    """Main test runner"""
    print("=" * 80)
    print("🧪 AgriBiz ERP - Customer Ledger, Statement, Reports & Dashboard Testing")
    print("=" * 80)
    
    # Login
    token = login()
    if not token:
        print("\n❌ FAILED: Could not login")
        return False
    
    headers = get_headers(token)
    
    # Get or create customer with activity
    customer_id = get_or_create_customer_with_activity(headers)
    if not customer_id:
        print("\n❌ FAILED: Could not get/create customer")
        return False
    
    # Track test results
    results = {}
    
    # A) Customer Ledger & Statement Tests
    print("\n" + "=" * 80)
    print("📊 A) CUSTOMER LEDGER & STATEMENT TESTS")
    print("=" * 80)
    results["ledger"] = test_customer_ledger(headers, customer_id)
    results["ledger_date_filter"] = test_customer_ledger_date_filter(headers, customer_id)
    results["statement_pdf"] = test_customer_statement_pdf(headers, customer_id)
    results["statement_print"] = test_customer_statement_print(headers, customer_id)
    results["statement_share"] = test_customer_statement_share(headers, customer_id)
    
    # B) Reports Tests
    print("\n" + "=" * 80)
    print("📈 B) REPORTS TESTS")
    print("=" * 80)
    results["report_sales"] = test_report_sales(headers, customer_id)
    results["report_purchases"] = test_report_purchases(headers)
    results["report_payments"] = test_report_payments(headers)
    results["report_stock"] = test_report_stock(headers)
    results["report_bu_summary"] = test_report_bu_summary(headers)
    results["report_excel"] = test_report_excel(headers)
    
    # C) Dashboard Widgets Tests
    print("\n" + "=" * 80)
    print("🏆 C) DASHBOARD WIDGETS TESTS")
    print("=" * 80)
    results["dashboard_top_customers"] = test_dashboard_top_customers(headers)
    results["dashboard_recent_payments"] = test_dashboard_recent_payments(headers)
    results["dashboard_recent_sales"] = test_dashboard_recent_sales(headers)
    
    # D) No Regression Tests
    print("\n" + "=" * 80)
    print("🔄 D) NO REGRESSION TESTS")
    print("=" * 80)
    results["no_regression_payment"] = test_no_regression_payment(headers, customer_id)
    results["no_regression_feed_sale"] = test_no_regression_feed_sale(headers, customer_id)
    results["no_regression_invoice_pdf"] = test_no_regression_invoice_pdf(headers)
    
    # Final Summary
    print("\n" + "=" * 80)
    print("📊 FINAL SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nTotal: {passed}/{total} tests passed\n")
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print("\n" + "=" * 80)
    if passed == total:
        print("✅ ALL TESTS PASSED")
    else:
        print(f"❌ {total - passed} TEST(S) FAILED")
    print("=" * 80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
