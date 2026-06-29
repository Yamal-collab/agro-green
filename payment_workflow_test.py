"""
Payment Workflow Testing for AgriBiz ERP
Tests the fixed payment workflow with FIFO allocation across all business units
"""
import os
import requests
import time
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://agribiz-session-c.preview.emergentagent.com").rstrip("/")
API_BASE = f"{BACKEND_URL}/api"

# Admin credentials
ADMIN_EMAIL = "admin@agribiz.com"
ADMIN_PASSWORD = "admin123"

# Test results tracking
test_results = {
    "passed": [],
    "failed": []
}

def log_pass(test_name):
    """Log a passed test"""
    print(f"✅ PASS: {test_name}")
    test_results["passed"].append(test_name)

def log_fail(test_name, reason):
    """Log a failed test"""
    print(f"❌ FAIL: {test_name}")
    print(f"   Reason: {reason}")
    test_results["failed"].append({"test": test_name, "reason": reason})

def login():
    """Login and return access token"""
    print(f"\n🔐 Logging in as {ADMIN_EMAIL}...")
    try:
        r = requests.post(f"{API_BASE}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=20)
        
        if r.status_code != 200:
            log_fail("Login", f"Status {r.status_code}: {r.text}")
            return None
        
        data = r.json()
        print(f"✅ Login successful: {data['user']['name']}")
        return data["access_token"]
    except Exception as e:
        log_fail("Login", str(e))
        return None

def get_headers(token):
    """Return headers with auth token"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def test_422_validations(headers):
    """Test 422 validation scenarios"""
    print("\n" + "="*80)
    print("SCENARIO 1: Testing 422 Validations")
    print("="*80)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Test 1: Missing customer_id should return 422
    print("\n1.1 Testing missing customer_id...")
    r = requests.post(f"{API_BASE}/payments", json={
        "amount": 1000,
        "date": today,
        "method": "cash"
    }, headers=headers)
    
    if r.status_code == 422 and "customer_id is required" in r.text:
        log_pass("422 - Missing customer_id returns 422 with correct message")
    else:
        log_fail("422 - Missing customer_id", f"Expected 422 with 'customer_id is required', got {r.status_code}: {r.text}")
    
    # Test 2: Amount = 0 should return 422
    print("\n1.2 Testing amount = 0...")
    r = requests.post(f"{API_BASE}/payments", json={
        "customer_id": "dummy-id",
        "amount": 0,
        "date": today,
        "method": "cash"
    }, headers=headers)
    
    if r.status_code == 422 and "amount must be greater than zero" in r.text:
        log_pass("422 - Amount = 0 returns 422 with correct message")
    else:
        log_fail("422 - Amount = 0", f"Expected 422 with 'amount must be greater than zero', got {r.status_code}: {r.text}")
    
    # Test 3: Negative amount should return 422
    print("\n1.3 Testing negative amount...")
    r = requests.post(f"{API_BASE}/payments", json={
        "customer_id": "dummy-id",
        "amount": -100,
        "date": today,
        "method": "cash"
    }, headers=headers)
    
    if r.status_code == 422 and "amount must be greater than zero" in r.text:
        log_pass("422 - Negative amount returns 422 with correct message")
    else:
        log_fail("422 - Negative amount", f"Expected 422 with 'amount must be greater than zero', got {r.status_code}: {r.text}")
    
    # Test 4: Non-existent customer_id should return 404
    print("\n1.4 Testing non-existent customer_id...")
    r = requests.post(f"{API_BASE}/payments", json={
        "customer_id": "non-existent-customer-id-12345",
        "amount": 1000,
        "date": today,
        "method": "cash"
    }, headers=headers)
    
    if r.status_code == 404 and "Customer not found" in r.text:
        log_pass("422 - Non-existent customer returns 404")
    else:
        log_fail("422 - Non-existent customer", f"Expected 404 with 'Customer not found', got {r.status_code}: {r.text}")

def create_test_customer(headers):
    """Create a test customer"""
    print("\n" + "="*80)
    print("Creating Test Customer")
    print("="*80)
    
    r = requests.post(f"{API_BASE}/customers", json={
        "name": "Suresh Kumar",
        "phone": "9876543210",
        "farm_name": "Suresh Poultry Farm",
        "address": "456 Farm Road, Erode, Tamil Nadu",
        "gst": "33XYZKL5678M1N2",
        "business_units": [1, 2, 3, 4]
    }, headers=headers)
    
    if r.status_code != 200:
        log_fail("Create Customer", f"Status {r.status_code}: {r.text}")
        return None
    
    customer = r.json()
    print(f"✅ Customer created: {customer['name']} (ID: {customer['id']})")
    return customer

def create_feed_sale(headers, customer_id, amount):
    """Create a feed sale invoice"""
    print(f"\n  Creating Feed Sale (₹{amount})...")
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Create supplier
    supp_r = requests.post(f"{API_BASE}/suppliers", json={
        "name": "Feed Supplier Ltd",
        "phone": "9876543211",
        "business_unit": 1
    }, headers=headers)
    
    if supp_r.status_code != 200:
        log_fail("Create Supplier", f"Status {supp_r.status_code}: {supp_r.text}")
        return None
    
    supplier_id = supp_r.json()["id"]
    
    # Create feed item
    item_r = requests.post(f"{API_BASE}/feed/items", json={
        "name": "Premium Layer Feed",
        "brand": "NutriPoultry",
        "category": "Layer Feed",
        "unit": "kg"
    }, headers=headers)
    
    if item_r.status_code != 200:
        log_fail("Create Feed Item", f"Status {item_r.status_code}: {item_r.text}")
        return None
    
    feed_item_id = item_r.json()["id"]
    
    # Purchase feed to build stock
    purch_r = requests.post(f"{API_BASE}/feed/purchases", json={
        "supplier_id": supplier_id,
        "feed_item_id": feed_item_id,
        "date": today,
        "quantity": 200,
        "purchase_rate": 15,
        "payment_status": "paid"
    }, headers=headers)
    
    if purch_r.status_code != 200:
        log_fail("Create Feed Purchase", f"Status {purch_r.status_code}: {purch_r.text}")
        return None
    
    # Create feed sale
    # Calculate quantity and unit_price to get exact total
    unit_price = 20
    quantity = amount / unit_price
    
    sale_r = requests.post(f"{API_BASE}/feed/sales", json={
        "customer_id": customer_id,
        "feed_item_id": feed_item_id,
        "date": today,
        "quantity": quantity,
        "unit_price": unit_price,
        "payment_status": "pending"
    }, headers=headers)
    
    if sale_r.status_code != 200:
        log_fail("Create Feed Sale", f"Status {sale_r.status_code}: {sale_r.text}")
        return None
    
    sale = sale_r.json()
    print(f"    ✅ Feed Sale created: {sale['invoice_no']} - ₹{sale['total']}")
    time.sleep(0.5)  # Small delay to ensure created_at ordering
    return sale

def create_chick_sale(headers, customer_id, amount):
    """Create a chick sale invoice"""
    print(f"\n  Creating Chick Sale (₹{amount})...")
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Create egg supplier
    supp_r = requests.post(f"{API_BASE}/suppliers", json={
        "name": "Egg Supplier Co",
        "phone": "9876543212",
        "business_unit": 2
    }, headers=headers)
    
    if supp_r.status_code != 200:
        log_fail("Create Egg Supplier", f"Status {supp_r.status_code}: {supp_r.text}")
        return None
    
    supplier_id = supp_r.json()["id"]
    
    # Purchase eggs (creates batch)
    egg_r = requests.post(f"{API_BASE}/egg/purchases", json={
        "supplier_id": supplier_id,
        "date": today,
        "quantity": 1000,
        "rate": 5,
        "incubation_start": today
    }, headers=headers)
    
    if egg_r.status_code != 200:
        log_fail("Create Egg Purchase", f"Status {egg_r.status_code}: {egg_r.text}")
        return None
    
    batch_id = egg_r.json()["batch"]["id"]
    
    # Update batch with hatched chicks
    batch_r = requests.patch(f"{API_BASE}/hatchery/batches/{batch_id}", json={
        "hatched_chicks": 800,
        "status": "hatched"
    }, headers=headers)
    
    if batch_r.status_code != 200:
        log_fail("Update Batch", f"Status {batch_r.status_code}: {batch_r.text}")
        return None
    
    # Create chick sale
    # Calculate quantity and unit_price to get exact total
    unit_price = 50
    quantity = int(amount / unit_price)
    
    sale_r = requests.post(f"{API_BASE}/hatchery/sales", json={
        "batch_id": batch_id,
        "customer_id": customer_id,
        "date": today,
        "quantity": quantity,
        "unit_price": unit_price,
        "payment_status": "pending"
    }, headers=headers)
    
    if sale_r.status_code != 200:
        log_fail("Create Chick Sale", f"Status {sale_r.status_code}: {sale_r.text}")
        return None
    
    sale = sale_r.json()
    print(f"    ✅ Chick Sale created: {sale['invoice_no']} - ₹{sale['total']}")
    time.sleep(0.5)  # Small delay to ensure created_at ordering
    return sale

def create_farm_sale(headers, customer_id, amount):
    """Create a farm sale invoice"""
    print(f"\n  Creating Farm Sale (₹{amount})...")
    today = datetime.now().strftime("%Y-%m-%d")
    
    # First, we need to transfer chicks to farm to have farm stock
    # Create egg supplier
    supp_r = requests.post(f"{API_BASE}/suppliers", json={
        "name": "Egg Supplier for Farm",
        "phone": "9876543213",
        "business_unit": 2
    }, headers=headers)
    
    if supp_r.status_code != 200:
        log_fail("Create Egg Supplier for Farm", f"Status {supp_r.status_code}: {supp_r.text}")
        return None
    
    supplier_id = supp_r.json()["id"]
    
    # Purchase eggs
    egg_r = requests.post(f"{API_BASE}/egg/purchases", json={
        "supplier_id": supplier_id,
        "date": today,
        "quantity": 1000,
        "rate": 5,
        "incubation_start": today
    }, headers=headers)
    
    if egg_r.status_code != 200:
        log_fail("Create Egg Purchase for Farm", f"Status {egg_r.status_code}: {egg_r.text}")
        return None
    
    batch_id = egg_r.json()["batch"]["id"]
    
    # Update batch with hatched chicks
    batch_r = requests.patch(f"{API_BASE}/hatchery/batches/{batch_id}", json={
        "hatched_chicks": 800,
        "status": "hatched"
    }, headers=headers)
    
    if batch_r.status_code != 200:
        log_fail("Update Batch for Farm", f"Status {batch_r.status_code}: {batch_r.text}")
        return None
    
    # Transfer chicks to farm
    transfer_r = requests.post(f"{API_BASE}/hatchery/transfer", json={
        "batch_id": batch_id,
        "date": today,
        "quantity": 500,
        "notes": "Transfer to farm for sale"
    }, headers=headers)
    
    if transfer_r.status_code != 200:
        log_fail("Transfer Chicks to Farm", f"Status {transfer_r.status_code}: {transfer_r.text}")
        return None
    
    # Create farm sale
    # Calculate quantity and unit_price to get exact total
    unit_price = 100
    quantity = int(amount / unit_price)
    
    sale_r = requests.post(f"{API_BASE}/farm/sales", json={
        "customer_id": customer_id,
        "date": today,
        "quantity": quantity,
        "unit_price": unit_price,
        "payment_status": "pending"
    }, headers=headers)
    
    if sale_r.status_code != 200:
        log_fail("Create Farm Sale", f"Status {sale_r.status_code}: {sale_r.text}")
        return None
    
    sale = sale_r.json()
    print(f"    ✅ Farm Sale created: {sale['invoice_no']} - ₹{sale['total']}")
    time.sleep(0.5)  # Small delay to ensure created_at ordering
    return sale

def test_fifo_setup(headers, customer_id):
    """Create 3 invoices across 3 BUs for FIFO testing"""
    print("\n" + "="*80)
    print("SCENARIO 2: Setting up FIFO Allocation Test (3 Invoices)")
    print("="*80)
    
    # Create invoices in order: Feed (₹2000), Chick (₹3000), Farm (₹5000)
    feed_sale = create_feed_sale(headers, customer_id, 2000)
    if not feed_sale:
        return None
    
    chick_sale = create_chick_sale(headers, customer_id, 3000)
    if not chick_sale:
        return None
    
    farm_sale = create_farm_sale(headers, customer_id, 5000)
    if not farm_sale:
        return None
    
    # Verify customer outstanding
    cust_r = requests.get(f"{API_BASE}/customers/{customer_id}/details", headers=headers)
    if cust_r.status_code != 200:
        log_fail("Get Customer Details", f"Status {cust_r.status_code}: {cust_r.text}")
        return None
    
    cust_data = cust_r.json()
    outstanding = cust_data["customer"]["outstanding"]
    
    if outstanding == 10000:
        log_pass("FIFO Setup - Customer outstanding = ₹10000")
        print(f"    Customer outstanding: ₹{outstanding}")
    else:
        log_fail("FIFO Setup - Customer outstanding", f"Expected ₹10000, got ₹{outstanding}")
    
    return {
        "feed_sale": feed_sale,
        "chick_sale": chick_sale,
        "farm_sale": farm_sale
    }

def test_partial_payment(headers, customer_id):
    """Test partial payment scenario"""
    print("\n" + "="*80)
    print("SCENARIO 3: Partial Payment (₹1500)")
    print("="*80)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    r = requests.post(f"{API_BASE}/payments", json={
        "customer_id": customer_id,
        "amount": 1500,
        "date": today,
        "method": "cash",
        "notes": "Partial payment test"
    }, headers=headers)
    
    if r.status_code != 200:
        log_fail("Partial Payment", f"Status {r.status_code}: {r.text}")
        return None
    
    payment = r.json()
    print(f"\n  Payment Response:")
    print(f"    Amount: ₹{payment['amount']}")
    print(f"    Applied: ₹{payment.get('applied_amount', 0)}")
    print(f"    Advance: ₹{payment.get('advance_amount', 0)}")
    print(f"    Allocations: {len(payment.get('allocations', []))}")
    print(f"    Customer Outstanding After: ₹{payment.get('customer_outstanding_after', 0)}")
    
    # Verify allocations
    allocations = payment.get("allocations", [])
    
    if len(allocations) == 1:
        log_pass("Partial Payment - 1 allocation created")
    else:
        log_fail("Partial Payment - Allocations count", f"Expected 1, got {len(allocations)}")
    
    if allocations:
        alloc = allocations[0]
        if alloc["amount_applied"] == 1500:
            log_pass("Partial Payment - Applied amount = ₹1500")
        else:
            log_fail("Partial Payment - Applied amount", f"Expected ₹1500, got ₹{alloc['amount_applied']}")
        
        if alloc["new_balance"] == 500:
            log_pass("Partial Payment - New balance = ₹500")
        else:
            log_fail("Partial Payment - New balance", f"Expected ₹500, got ₹{alloc['new_balance']}")
        
        if alloc["new_status"] == "partial":
            log_pass("Partial Payment - Status = 'partial'")
        else:
            log_fail("Partial Payment - Status", f"Expected 'partial', got '{alloc['new_status']}'")
    
    if payment.get("customer_outstanding_after") == 8500:
        log_pass("Partial Payment - Customer outstanding after = ₹8500")
    else:
        log_fail("Partial Payment - Outstanding after", f"Expected ₹8500, got ₹{payment.get('customer_outstanding_after')}")
    
    return payment

def test_cascade_payment(headers, customer_id):
    """Test cascade payment across multiple invoices"""
    print("\n" + "="*80)
    print("SCENARIO 4: Cascade Payment (₹4000)")
    print("="*80)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    r = requests.post(f"{API_BASE}/payments", json={
        "customer_id": customer_id,
        "amount": 4000,
        "date": today,
        "method": "bank_transfer",
        "notes": "Cascade payment test"
    }, headers=headers)
    
    if r.status_code != 200:
        log_fail("Cascade Payment", f"Status {r.status_code}: {r.text}")
        return None
    
    payment = r.json()
    print(f"\n  Payment Response:")
    print(f"    Amount: ₹{payment['amount']}")
    print(f"    Applied: ₹{payment.get('applied_amount', 0)}")
    print(f"    Advance: ₹{payment.get('advance_amount', 0)}")
    print(f"    Allocations: {len(payment.get('allocations', []))}")
    print(f"    Customer Outstanding After: ₹{payment.get('customer_outstanding_after', 0)}")
    
    allocations = payment.get("allocations", [])
    
    # Should have 3 allocations: feed (500), chick (3000), farm (500)
    if len(allocations) == 3:
        log_pass("Cascade Payment - 3 allocations created")
    else:
        log_fail("Cascade Payment - Allocations count", f"Expected 3, got {len(allocations)}")
    
    if allocations and len(allocations) >= 3:
        # First allocation: Feed ₹500 → paid
        if allocations[0]["amount_applied"] == 500 and allocations[0]["new_status"] == "paid":
            log_pass("Cascade Payment - Feed invoice paid (₹500)")
        else:
            log_fail("Cascade Payment - Feed allocation", f"Expected ₹500 paid, got ₹{allocations[0]['amount_applied']} {allocations[0]['new_status']}")
        
        # Second allocation: Chick ₹3000 → paid
        if allocations[1]["amount_applied"] == 3000 and allocations[1]["new_status"] == "paid":
            log_pass("Cascade Payment - Chick invoice paid (₹3000)")
        else:
            log_fail("Cascade Payment - Chick allocation", f"Expected ₹3000 paid, got ₹{allocations[1]['amount_applied']} {allocations[1]['new_status']}")
        
        # Third allocation: Farm ₹500 → partial
        if allocations[2]["amount_applied"] == 500 and allocations[2]["new_status"] == "partial":
            log_pass("Cascade Payment - Farm invoice partial (₹500)")
        else:
            log_fail("Cascade Payment - Farm allocation", f"Expected ₹500 partial, got ₹{allocations[2]['amount_applied']} {allocations[2]['new_status']}")
    
    if payment.get("customer_outstanding_after") == 4500:
        log_pass("Cascade Payment - Customer outstanding after = ₹4500")
    else:
        log_fail("Cascade Payment - Outstanding after", f"Expected ₹4500, got ₹{payment.get('customer_outstanding_after')}")
    
    return payment

def test_overpayment(headers, customer_id):
    """Test overpayment/advance scenario"""
    print("\n" + "="*80)
    print("SCENARIO 5: Overpayment/Advance (₹10000)")
    print("="*80)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    r = requests.post(f"{API_BASE}/payments", json={
        "customer_id": customer_id,
        "amount": 10000,
        "date": today,
        "method": "cash",
        "notes": "Overpayment test"
    }, headers=headers)
    
    if r.status_code != 200:
        log_fail("Overpayment", f"Status {r.status_code}: {r.text}")
        return None
    
    payment = r.json()
    print(f"\n  Payment Response:")
    print(f"    Amount: ₹{payment['amount']}")
    print(f"    Applied: ₹{payment.get('applied_amount', 0)}")
    print(f"    Advance: ₹{payment.get('advance_amount', 0)}")
    print(f"    Allocations: {len(payment.get('allocations', []))}")
    print(f"    Customer Outstanding After: ₹{payment.get('customer_outstanding_after', 0)}")
    
    allocations = payment.get("allocations", [])
    
    # Should have 1 allocation: farm ₹4500 → paid
    if len(allocations) == 1:
        log_pass("Overpayment - 1 allocation created")
    else:
        log_fail("Overpayment - Allocations count", f"Expected 1, got {len(allocations)}")
    
    if allocations:
        alloc = allocations[0]
        if alloc["amount_applied"] == 4500 and alloc["new_status"] == "paid":
            log_pass("Overpayment - Farm invoice paid (₹4500)")
        else:
            log_fail("Overpayment - Farm allocation", f"Expected ₹4500 paid, got ₹{alloc['amount_applied']} {alloc['new_status']}")
    
    if payment.get("applied_amount") == 4500:
        log_pass("Overpayment - Applied amount = ₹4500")
    else:
        log_fail("Overpayment - Applied amount", f"Expected ₹4500, got ₹{payment.get('applied_amount')}")
    
    if payment.get("advance_amount") == 5500:
        log_pass("Overpayment - Advance amount = ₹5500")
    else:
        log_fail("Overpayment - Advance amount", f"Expected ₹5500, got ₹{payment.get('advance_amount')}")
    
    if payment.get("customer_outstanding_after") == 0:
        log_pass("Overpayment - Customer outstanding after = ₹0")
    else:
        log_fail("Overpayment - Outstanding after", f"Expected ₹0, got ₹{payment.get('customer_outstanding_after')}")
    
    return payment

def test_status_verification(headers, customer_id):
    """Verify all invoices are marked as paid"""
    print("\n" + "="*80)
    print("SCENARIO 6: Status Verification")
    print("="*80)
    
    # Get customer details
    r = requests.get(f"{API_BASE}/customers/{customer_id}/details", headers=headers)
    
    if r.status_code != 200:
        log_fail("Status Verification - Get Details", f"Status {r.status_code}: {r.text}")
        return
    
    data = r.json()
    invoices = data.get("invoices", [])
    
    print(f"\n  Found {len(invoices)} invoices")
    
    all_paid = True
    for inv in invoices:
        print(f"    {inv['invoice_no']}: {inv['payment_status']} (Balance: ₹{inv['balance_due']})")
        if inv["payment_status"] != "paid" or inv["balance_due"] != 0:
            all_paid = False
    
    if all_paid and len(invoices) >= 3:
        log_pass("Status Verification - All invoices paid with balance_due = 0")
    else:
        log_fail("Status Verification", "Not all invoices are paid or have zero balance")
    
    # Verify individual sale endpoints
    print("\n  Verifying individual sale endpoints...")
    
    # Feed sales
    feed_r = requests.get(f"{API_BASE}/feed/sales", headers=headers)
    if feed_r.status_code == 200:
        feed_sales = feed_r.json()
        feed_paid = [s for s in feed_sales if s.get("customer_id") == customer_id and s.get("payment_status") == "paid"]
        if feed_paid:
            log_pass("Status Verification - Feed sales show payment_status='paid'")
        else:
            log_fail("Status Verification - Feed sales", "No paid feed sales found")
    
    # Chick sales
    chick_r = requests.get(f"{API_BASE}/hatchery/sales", headers=headers)
    if chick_r.status_code == 200:
        chick_sales = chick_r.json()
        chick_paid = [s for s in chick_sales if s.get("customer_id") == customer_id and s.get("payment_status") == "paid"]
        if chick_paid:
            log_pass("Status Verification - Chick sales show payment_status='paid'")
        else:
            log_fail("Status Verification - Chick sales", "No paid chick sales found")
    
    # Farm sales
    farm_r = requests.get(f"{API_BASE}/farm/sales", headers=headers)
    if farm_r.status_code == 200:
        farm_sales = farm_r.json()
        farm_paid = [s for s in farm_sales if s.get("customer_id") == customer_id and s.get("payment_status") == "paid"]
        if farm_paid:
            log_pass("Status Verification - Farm sales show payment_status='paid'")
        else:
            log_fail("Status Verification - Farm sales", "No paid farm sales found")

def test_dashboard_sync(headers):
    """Verify dashboard outstanding is updated"""
    print("\n" + "="*80)
    print("SCENARIO 7: Dashboard Sync")
    print("="*80)
    
    r = requests.get(f"{API_BASE}/dashboard/summary", headers=headers)
    
    if r.status_code != 200:
        log_fail("Dashboard Sync", f"Status {r.status_code}: {r.text}")
        return
    
    data = r.json()
    outstanding = data.get("outstanding", -1)
    
    print(f"\n  Dashboard outstanding: ₹{outstanding}")
    
    # Outstanding should be 0 or very low (our test customer has 0 outstanding)
    # But there might be other customers, so we just verify the field exists and is a number
    if isinstance(outstanding, (int, float)) and outstanding >= 0:
        log_pass("Dashboard Sync - Outstanding field present and valid")
    else:
        log_fail("Dashboard Sync", f"Outstanding field invalid: {outstanding}")

def test_customer_endpoint(headers, customer_id):
    """Test customer details endpoint"""
    print("\n" + "="*80)
    print("SCENARIO 8: Customer Endpoint Verification")
    print("="*80)
    
    r = requests.get(f"{API_BASE}/customers/{customer_id}/details", headers=headers)
    
    if r.status_code != 200:
        log_fail("Customer Endpoint", f"Status {r.status_code}: {r.text}")
        return
    
    data = r.json()
    
    # Verify structure
    if "customer" in data:
        log_pass("Customer Endpoint - 'customer' field present")
    else:
        log_fail("Customer Endpoint", "'customer' field missing")
    
    if "invoices" in data:
        log_pass("Customer Endpoint - 'invoices' field present")
        print(f"    Invoices count: {len(data['invoices'])}")
    else:
        log_fail("Customer Endpoint", "'invoices' field missing")
    
    if "payments" in data:
        log_pass("Customer Endpoint - 'payments' field present")
        print(f"    Payments count: {len(data['payments'])}")
    else:
        log_fail("Customer Endpoint", "'payments' field missing")
    
    if "summary" in data:
        summary = data["summary"]
        log_pass("Customer Endpoint - 'summary' field present")
        print(f"    Total Billed: ₹{summary.get('total_billed', 0)}")
        print(f"    Total Paid: ₹{summary.get('total_paid', 0)}")
        print(f"    Total Due: ₹{summary.get('total_due', 0)}")
        
        # Verify summary calculations
        if summary.get("total_billed") == 10000:
            log_pass("Customer Endpoint - Total billed = ₹10000")
        else:
            log_fail("Customer Endpoint - Total billed", f"Expected ₹10000, got ₹{summary.get('total_billed')}")
        
        if summary.get("total_paid") == 10000:
            log_pass("Customer Endpoint - Total paid = ₹10000")
        else:
            log_fail("Customer Endpoint - Total paid", f"Expected ₹10000, got ₹{summary.get('total_paid')}")
        
        if summary.get("total_due") == 0:
            log_pass("Customer Endpoint - Total due = ₹0")
        else:
            log_fail("Customer Endpoint - Total due", f"Expected ₹0, got ₹{summary.get('total_due')}")
    else:
        log_fail("Customer Endpoint", "'summary' field missing")

def test_finance_totals(headers):
    """Verify finance transactions are created"""
    print("\n" + "="*80)
    print("SCENARIO 9: Finance Totals")
    print("="*80)
    
    r = requests.get(f"{API_BASE}/finance/transactions", headers=headers)
    
    if r.status_code != 200:
        log_fail("Finance Totals", f"Status {r.status_code}: {r.text}")
        return
    
    transactions = r.json()
    
    # Find "Payment Received" transactions
    payment_txns = [t for t in transactions if t.get("category") == "Payment Received"]
    
    print(f"\n  Total finance transactions: {len(transactions)}")
    print(f"  'Payment Received' transactions: {len(payment_txns)}")
    
    if len(payment_txns) >= 3:  # We made 3 payments
        log_pass("Finance Totals - Payment Received transactions created")
        
        # Show some details
        for txn in payment_txns[:3]:
            print(f"    {txn.get('date')}: ₹{txn.get('amount')} - {txn.get('notes')}")
    else:
        log_fail("Finance Totals", f"Expected at least 3 'Payment Received' transactions, found {len(payment_txns)}")

def test_no_regression(headers):
    """Test that new sales and PDF generation still work"""
    print("\n" + "="*80)
    print("SCENARIO 10: No Regression Testing")
    print("="*80)
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Create a new customer for regression test
    cust_r = requests.post(f"{API_BASE}/customers", json={
        "name": "Regression Test Customer",
        "phone": "9999999999",
        "business_units": [1]
    }, headers=headers)
    
    if cust_r.status_code != 200:
        log_fail("Regression - Create Customer", f"Status {cust_r.status_code}: {cust_r.text}")
        return
    
    customer_id = cust_r.json()["id"]
    
    # Test creating a new feed sale
    print("\n  Testing new feed sale creation...")
    feed_sale = create_feed_sale(headers, customer_id, 1000)
    
    if feed_sale and feed_sale.get("invoice_no"):
        log_pass("Regression - New feed sale creation works")
        
        # Test PDF generation
        print("\n  Testing PDF generation...")
        pdf_r = requests.get(f"{API_BASE}/invoice/feed/{feed_sale['id']}/pdf", headers=headers)
        
        if pdf_r.status_code == 200 and pdf_r.headers.get("content-type") == "application/pdf":
            log_pass("Regression - PDF generation works")
        else:
            log_fail("Regression - PDF generation", f"Status {pdf_r.status_code}, Content-Type: {pdf_r.headers.get('content-type')}")
    else:
        log_fail("Regression - New feed sale", "Failed to create feed sale")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(test_results["passed"]) + len(test_results["failed"])
    passed = len(test_results["passed"])
    failed = len(test_results["failed"])
    
    print(f"\nTotal Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    
    if test_results["failed"]:
        print("\n" + "="*80)
        print("FAILED TESTS DETAILS")
        print("="*80)
        for fail in test_results["failed"]:
            print(f"\n❌ {fail['test']}")
            print(f"   {fail['reason']}")
    
    print("\n" + "="*80)
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED!")
    else:
        print(f"⚠️  {failed} TEST(S) FAILED")
    
    print("="*80)

def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("PAYMENT WORKFLOW TESTING - AgriBiz ERP")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    
    # Login
    token = login()
    if not token:
        print("\n❌ Cannot proceed without authentication")
        return
    
    headers = get_headers(token)
    
    # Test 422 validations
    test_422_validations(headers)
    
    # Create test customer
    customer = create_test_customer(headers)
    if not customer:
        print("\n❌ Cannot proceed without customer")
        return
    
    customer_id = customer["id"]
    
    # Setup FIFO test (create 3 invoices)
    sales = test_fifo_setup(headers, customer_id)
    if not sales:
        print("\n❌ Cannot proceed without invoices")
        return
    
    # Test partial payment
    test_partial_payment(headers, customer_id)
    
    # Test cascade payment
    test_cascade_payment(headers, customer_id)
    
    # Test overpayment
    test_overpayment(headers, customer_id)
    
    # Verify status
    test_status_verification(headers, customer_id)
    
    # Test dashboard sync
    test_dashboard_sync(headers)
    
    # Test customer endpoint
    test_customer_endpoint(headers, customer_id)
    
    # Test finance totals
    test_finance_totals(headers)
    
    # Test no regression
    test_no_regression(headers)
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
