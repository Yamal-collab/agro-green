"""
Invoice Endpoints Testing for AgriBiz ERP
Tests GET /api/invoice/{type}/{sale_id}/pdf
Tests GET /api/invoice/{type}/{sale_id}/print
Tests POST /api/invoice/{type}/{sale_id}/share
"""
import os
import requests
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://5ba9a444-d940-4535-90b6-2ac6030a02bd.preview.emergentagent.com").rstrip("/")
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
    """Create necessary test data and return sale IDs"""
    print("\n📦 Creating test data...")
    
    # Create customer
    print("  Creating customer...")
    cust_r = requests.post(f"{API_BASE}/customers", json={
        "name": "Ramesh Farms",
        "phone": "9876543210",
        "farm_name": "Ramesh Poultry Farm",
        "address": "123 Main Street, Coimbatore, Tamil Nadu",
        "gst": "33ABCDE1234F1Z5",
        "business_units": [1, 2, 3]
    }, headers=headers)
    
    if cust_r.status_code != 200:
        print(f"❌ Customer creation failed: {cust_r.status_code} - {cust_r.text}")
        return None
    
    customer_id = cust_r.json()["id"]
    print(f"  ✅ Customer created: {customer_id}")
    
    # Create supplier
    print("  Creating supplier...")
    supp_r = requests.post(f"{API_BASE}/suppliers", json={
        "name": "Feed Supplier Co",
        "phone": "9876543211",
        "address": "456 Supply Street",
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
        "name": "Premium Chicken Feed",
        "brand": "NutriPoultry",
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
        "quantity": 1000.0,
        "purchase_rate": 50.0,
        "transport": 500.0,
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
        "quantity": 100.0,
        "unit_price": 60.0,
        "transport": 200.0,
        "discount": 100.0,
        "payment_status": "pending"
    }, headers=headers)
    
    if feed_sale_r.status_code != 200:
        print(f"❌ Feed sale failed: {feed_sale_r.status_code} - {feed_sale_r.text}")
        return None
    
    feed_sale_id = feed_sale_r.json()["id"]
    print(f"  ✅ Feed sale created: {feed_sale_id}")
    
    # Create egg purchase (creates batch automatically)
    print("  Creating egg purchase...")
    egg_purch_r = requests.post(f"{API_BASE}/egg/purchases", json={
        "supplier_id": supplier_id,
        "date": today,
        "quantity": 1000,
        "rate": 5.0,
        "transport": 300.0,
        "incubation_start": today
    }, headers=headers)
    
    if egg_purch_r.status_code != 200:
        print(f"❌ Egg purchase failed: {egg_purch_r.status_code} - {egg_purch_r.text}")
        return None
    
    batch_id = egg_purch_r.json()["batch"]["id"]
    print(f"  ✅ Egg purchase created, batch: {batch_id}")
    
    # Update batch with hatched chicks
    print("  Updating batch with hatched chicks...")
    batch_update_r = requests.patch(f"{API_BASE}/hatchery/batches/{batch_id}", json={
        "hatched_chicks": 800,
        "dead_eggs": 200,
        "status": "hatched",
        "hatch_date": today
    }, headers=headers)
    
    if batch_update_r.status_code != 200:
        print(f"❌ Batch update failed: {batch_update_r.status_code} - {batch_update_r.text}")
        return None
    
    print(f"  ✅ Batch updated with 800 hatched chicks")
    
    # Create chick sale
    print("  Creating chick sale...")
    chick_sale_r = requests.post(f"{API_BASE}/hatchery/sales", json={
        "batch_id": batch_id,
        "customer_id": customer_id,
        "date": today,
        "quantity": 200,
        "unit_price": 25.0,
        "transport": 500.0,
        "discount": 200.0,
        "payment_status": "pending"
    }, headers=headers)
    
    if chick_sale_r.status_code != 200:
        print(f"❌ Chick sale failed: {chick_sale_r.status_code} - {chick_sale_r.text}")
        return None
    
    chick_sale_id = chick_sale_r.json()["id"]
    print(f"  ✅ Chick sale created: {chick_sale_id}")
    
    # Transfer chicks to farm
    print("  Transferring chicks to farm...")
    transfer_r = requests.post(f"{API_BASE}/hatchery/transfer", json={
        "batch_id": batch_id,
        "date": today,
        "quantity": 300,
        "notes": "Transfer to farm for testing"
    }, headers=headers)
    
    if transfer_r.status_code != 200:
        print(f"❌ Chick transfer failed: {transfer_r.status_code} - {transfer_r.text}")
        return None
    
    print(f"  ✅ Chicks transferred to farm")
    
    # Create farm sale
    print("  Creating farm sale...")
    farm_sale_r = requests.post(f"{API_BASE}/farm/sales", json={
        "customer_id": customer_id,
        "date": today,
        "quantity": 50,
        "unit_price": 150.0,
        "transport": 300.0,
        "discount": 150.0,
        "payment_status": "pending"
    }, headers=headers)
    
    if farm_sale_r.status_code != 200:
        print(f"❌ Farm sale failed: {farm_sale_r.status_code} - {farm_sale_r.text}")
        return None
    
    farm_sale_id = farm_sale_r.json()["id"]
    print(f"  ✅ Farm sale created: {farm_sale_id}")
    
    return {
        "customer_id": customer_id,
        "feed_sale_id": feed_sale_id,
        "chick_sale_id": chick_sale_id,
        "farm_sale_id": farm_sale_id
    }

def get_counts(headers):
    """Get current counts of sales and customer outstanding"""
    feed_sales = requests.get(f"{API_BASE}/feed/sales", headers=headers).json()
    chick_sales = requests.get(f"{API_BASE}/hatchery/sales", headers=headers).json()
    farm_sales = requests.get(f"{API_BASE}/farm/sales", headers=headers).json()
    customers = requests.get(f"{API_BASE}/customers", headers=headers).json()
    
    total_outstanding = sum(c.get("outstanding", 0) for c in customers)
    
    return {
        "feed_sales_count": len(feed_sales),
        "chick_sales_count": len(chick_sales),
        "farm_sales_count": len(farm_sales),
        "total_outstanding": total_outstanding
    }

def test_invoice_pdf(headers, sale_type, sale_id):
    """Test GET /api/invoice/{type}/{sale_id}/pdf"""
    print(f"\n📄 Testing PDF endpoint for {sale_type} sale {sale_id}...")
    
    r = requests.get(f"{API_BASE}/invoice/{sale_type}/{sale_id}/pdf", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ PDF endpoint failed: {r.status_code} - {r.text}")
        return False
    
    # Check Content-Type
    content_type = r.headers.get("Content-Type", "")
    if "application/pdf" not in content_type:
        print(f"❌ Wrong Content-Type: {content_type} (expected application/pdf)")
        return False
    
    # Check PDF magic bytes
    if not r.content.startswith(b"%PDF"):
        print(f"❌ Response doesn't start with %PDF magic bytes")
        return False
    
    print(f"✅ PDF endpoint working: {len(r.content)} bytes, Content-Type: {content_type}")
    return True

def test_invoice_print(headers, sale_type, sale_id):
    """Test GET /api/invoice/{type}/{sale_id}/print"""
    print(f"\n🖨️  Testing Print endpoint for {sale_type} sale {sale_id}...")
    
    r = requests.get(f"{API_BASE}/invoice/{sale_type}/{sale_id}/print", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ Print endpoint failed: {r.status_code} - {r.text}")
        return False
    
    # Check Content-Type is HTML
    content_type = r.headers.get("Content-Type", "")
    if "text/html" not in content_type:
        print(f"❌ Wrong Content-Type: {content_type} (expected text/html)")
        return False
    
    # Check HTML contains iframe pointing to PDF endpoint
    html = r.text
    expected_iframe_src = f"/api/invoice/{sale_type}/{sale_id}/pdf"
    if expected_iframe_src not in html:
        print(f"❌ HTML doesn't contain iframe with src='{expected_iframe_src}'")
        return False
    
    print(f"✅ Print endpoint working: HTML with iframe to PDF")
    return True

def test_invoice_share(headers, sale_type, sale_id):
    """Test POST /api/invoice/{type}/{sale_id}/share"""
    print(f"\n📤 Testing Share endpoint for {sale_type} sale {sale_id}...")
    
    r = requests.post(f"{API_BASE}/invoice/{sale_type}/{sale_id}/share", headers=headers)
    
    if r.status_code != 200:
        print(f"❌ Share endpoint failed: {r.status_code} - {r.text}")
        return False
    
    data = r.json()
    
    # Check required keys
    required_keys = ["whatsapp_url", "mailto_url", "pdf_url", "invoice_no"]
    missing_keys = [k for k in required_keys if k not in data]
    
    if missing_keys:
        print(f"❌ Missing keys in response: {missing_keys}")
        return False
    
    # Check URLs are not empty
    if not data["whatsapp_url"] or not data["mailto_url"] or not data["pdf_url"]:
        print(f"❌ One or more URLs are empty")
        return False
    
    print(f"✅ Share endpoint working:")
    print(f"   Invoice No: {data['invoice_no']}")
    print(f"   PDF URL: {data['pdf_url']}")
    print(f"   WhatsApp URL: {data['whatsapp_url'][:80]}...")
    print(f"   Mailto URL: {data['mailto_url'][:80]}...")
    return True

def test_error_cases(headers, valid_sale_id):
    """Test error cases: invalid type and non-existent sale_id"""
    print("\n⚠️  Testing error cases...")
    
    # Test invalid type (should return 400)
    print("  Testing invalid type...")
    r = requests.get(f"{API_BASE}/invoice/invalid_type/{valid_sale_id}/pdf", headers=headers)
    if r.status_code != 400:
        print(f"❌ Invalid type should return 400, got {r.status_code}")
        return False
    print(f"  ✅ Invalid type returns 400")
    
    # Test non-existent sale_id (should return 404)
    print("  Testing non-existent sale_id...")
    fake_id = "00000000-0000-0000-0000-000000000000"
    r = requests.get(f"{API_BASE}/invoice/feed/{fake_id}/pdf", headers=headers)
    if r.status_code != 404:
        print(f"❌ Non-existent sale_id should return 404, got {r.status_code}")
        return False
    print(f"  ✅ Non-existent sale_id returns 404")
    
    return True

def test_no_side_effects(headers, counts_before):
    """Verify that invoice endpoints don't create duplicates or modify data"""
    print("\n🔍 Verifying no side effects...")
    
    counts_after = get_counts(headers)
    
    # Check counts haven't changed
    if counts_before["feed_sales_count"] != counts_after["feed_sales_count"]:
        print(f"❌ Feed sales count changed: {counts_before['feed_sales_count']} -> {counts_after['feed_sales_count']}")
        return False
    
    if counts_before["chick_sales_count"] != counts_after["chick_sales_count"]:
        print(f"❌ Chick sales count changed: {counts_before['chick_sales_count']} -> {counts_after['chick_sales_count']}")
        return False
    
    if counts_before["farm_sales_count"] != counts_after["farm_sales_count"]:
        print(f"❌ Farm sales count changed: {counts_before['farm_sales_count']} -> {counts_after['farm_sales_count']}")
        return False
    
    if abs(counts_before["total_outstanding"] - counts_after["total_outstanding"]) > 0.01:
        print(f"❌ Customer outstanding changed: {counts_before['total_outstanding']} -> {counts_after['total_outstanding']}")
        return False
    
    print(f"✅ No side effects detected:")
    print(f"   Feed sales: {counts_after['feed_sales_count']}")
    print(f"   Chick sales: {counts_after['chick_sales_count']}")
    print(f"   Farm sales: {counts_after['farm_sales_count']}")
    print(f"   Total outstanding: Rs. {counts_after['total_outstanding']:,.2f}")
    
    return True

def main():
    """Main test runner"""
    print("=" * 80)
    print("🧪 AgriBiz ERP - Invoice Endpoints Testing")
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
    
    # Get counts before testing
    print("\n📊 Getting baseline counts...")
    counts_before = get_counts(headers)
    print(f"  Feed sales: {counts_before['feed_sales_count']}")
    print(f"  Chick sales: {counts_before['chick_sales_count']}")
    print(f"  Farm sales: {counts_before['farm_sales_count']}")
    print(f"  Total outstanding: Rs. {counts_before['total_outstanding']:,.2f}")
    
    # Test all endpoints for all three types
    all_passed = True
    
    # Test Feed invoices
    print("\n" + "=" * 80)
    print("🌾 Testing FEED Invoice Endpoints")
    print("=" * 80)
    all_passed &= test_invoice_pdf(headers, "feed", test_data["feed_sale_id"])
    all_passed &= test_invoice_print(headers, "feed", test_data["feed_sale_id"])
    all_passed &= test_invoice_share(headers, "feed", test_data["feed_sale_id"])
    
    # Test Chick invoices
    print("\n" + "=" * 80)
    print("🐣 Testing CHICK Invoice Endpoints")
    print("=" * 80)
    all_passed &= test_invoice_pdf(headers, "chick", test_data["chick_sale_id"])
    all_passed &= test_invoice_print(headers, "chick", test_data["chick_sale_id"])
    all_passed &= test_invoice_share(headers, "chick", test_data["chick_sale_id"])
    
    # Test Farm invoices
    print("\n" + "=" * 80)
    print("🐔 Testing FARM Invoice Endpoints")
    print("=" * 80)
    all_passed &= test_invoice_pdf(headers, "farm", test_data["farm_sale_id"])
    all_passed &= test_invoice_print(headers, "farm", test_data["farm_sale_id"])
    all_passed &= test_invoice_share(headers, "farm", test_data["farm_sale_id"])
    
    # Test error cases
    print("\n" + "=" * 80)
    print("⚠️  Testing Error Cases")
    print("=" * 80)
    all_passed &= test_error_cases(headers, test_data["feed_sale_id"])
    
    # Verify no side effects
    print("\n" + "=" * 80)
    print("🔍 Verifying No Side Effects")
    print("=" * 80)
    all_passed &= test_no_side_effects(headers, counts_before)
    
    # Final summary
    print("\n" + "=" * 80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
    print("=" * 80)
    
    return all_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
