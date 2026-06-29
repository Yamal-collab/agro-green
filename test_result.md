#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
# (preserved)
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Bug fix: POST /api/payments returned 422. Implement full customer payment
  workflow with FIFO allocation across all 4 business units, auto-update of
  invoice payment_status, amount_paid, balance_due, customer outstanding,
  finance totals and dashboard. Customer detail page should show invoices and
  payment history. Do NOT change sale workflow, stock deduction, inventory,
  invoice generation, or PDF/print/share.

backend:
  - task: "POST /api/payments accepts customer_id (FIFO allocation)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "PaymentIn now accepts customer_id (party_id legacy kept). FIFO allocates across feed_sales/chick_sales/farm_sales/water_sales sorted by created_at. Updates amount_paid/balance_due/payment_status. Overpayment becomes advance. Verified via curl - 422 returned only with helpful message when customer_id missing or amount<=0."
        -working: true
        -agent: "testing"
        -comment: "Comprehensive testing completed. All 35 tests passed. Validated: (1) 422 validations - missing customer_id, zero/negative amount, non-existent customer all return correct error codes and messages. (2) FIFO allocation - created 3 invoices (Feed ₹2000, Chick ₹3000, Farm ₹5000) totaling ₹10000. (3) Partial payment ₹1500 - correctly allocated to oldest invoice, status='partial', balance=₹500, outstanding=₹8500. (4) Cascade payment ₹4000 - correctly allocated across 3 invoices (Feed ₹500→paid, Chick ₹3000→paid, Farm ₹500→partial), outstanding=₹4500. (5) Overpayment ₹10000 - correctly allocated ₹4500 to remaining balance, advance=₹5500, outstanding=₹0. (6) All invoices show payment_status='paid' and balance_due=0 after full payment. (7) Dashboard outstanding field working. (8) Customer details endpoint returns correct structure with invoices, payments, and summary totals. (9) Finance transactions created for all payments. (10) No regression - new sales and PDF generation still working."
  - task: "Sales store amount_paid / balance_due / business_unit / payment_status"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "feed_sale, chick_sale, farm_sale, water_sale create handlers now persist amount_paid, balance_due, business_unit, payment_status. Startup migration backfills legacy docs. Customer outstanding recomputed from sum of balance_due."
        -working: true
        -agent: "testing"
        -comment: "Verified all sale endpoints (feed_sales, chick_sales, farm_sales) correctly store and update amount_paid, balance_due, business_unit, and payment_status fields. Payment workflow correctly updates these fields during FIFO allocation. All invoices show correct status transitions (pending→partial→paid) and accurate balance calculations."
  - task: "GET /api/customers/{id}/details (invoices + payments)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Returns customer, all invoices across BUs, payment history with allocations, and totals summary."
        -working: true
        -agent: "testing"
        -comment: "Endpoint working perfectly. Returns complete customer object, all invoices across all BUs with correct payment status, all payment records with detailed allocations, and accurate summary (total_billed=₹10000, total_paid=₹10000, total_due=₹0). All data structures match expected format."

frontend:
  - task: "Record Payment dialog → no 422; success toast"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Finance.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Send customer_id; show success banner with allocation count and advance; dropdown labelled 'Name (₹X Due)' sorted by outstanding desc; validate amount > 0 before submit."
  - task: "Customer detail modal with invoices + payment history"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Customers.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Eye icon on each row opens modal showing summary, all invoices (status badges) and payment history with FIFO allocations."

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "POST /api/payments accepts customer_id (FIFO allocation)"
    - "Sales store amount_paid / balance_due / business_unit / payment_status"
    - "GET /api/customers/{id}/details (invoices + payments)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Payment workflow rewritten. FIFO across all 4 BUs, auto status update, customer outstanding recomputed from balance_due, advance stored when overpayment. Migration on startup backfills legacy sales. Need backend testing to validate."
    -agent: "testing"
    -message: "Backend testing completed successfully. All 35 tests passed covering all 10 scenarios: (1) 422 validations working correctly, (2) FIFO allocation across 3 BUs verified with ₹10000 total outstanding, (3) Partial payment ₹1500 correctly allocated, (4) Cascade payment ₹4000 correctly allocated across 3 invoices, (5) Overpayment ₹10000 with ₹5500 advance working, (6) All invoice statuses updated correctly to 'paid', (7) Dashboard outstanding field working, (8) Customer details endpoint returns complete data structure, (9) Finance transactions created for all payments, (10) No regression - new sales and PDF generation still working. Payment workflow is production-ready."
