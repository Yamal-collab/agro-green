#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
# (preserved)
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Implement Customer Account Statement & Reports module on top of existing
  AgriBiz ERP. New customer detail page with Summary/Purchases/Payments/Ledger
  tabs; A4 statement PDF, print, share. Reports module with Sales/Purchases/
  Payments/Outstanding/Stock/P&L/BU Summary plus filters and Excel export.
  Dashboard top customers and recent payments/sales. Do NOT break existing
  payment, invoice, sale, finance or PDF flows.

backend:
  - task: "GET /api/customers/{id}/ledger"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Returns customer, entries (debit/credit), opening_balance, closing_balance, totals, last dates. Date range filter via dfrom/dto."
        -working: true
        -agent: "testing"
        -comment: "✅ PASS: All ledger tests passed. Verified structure with customer, entries (date, kind, debit, credit, running_balance, description), opening_balance, closing_balance, total_debit, total_credit, total_billed, total_paid, outstanding, last_purchase_date, last_payment_date. Entries sorted by date ascending. Last running_balance equals closing_balance. Closing_balance matches customer.outstanding within ±1.0 rupee. Date filters (dfrom/dto) working correctly - opening_balance accounts for activity before dfrom, entries filtered within range."
  - task: "GET /api/customers/{id}/statement/pdf + /print + share"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "A4 portrait ReportLab statement: opening, ledger table, closing, totals. Print HTML auto-triggers. Share returns whatsapp_url/mailto_url with PDF link."
        -working: true
        -agent: "testing"
        -comment: "✅ PASS: All statement tests passed. PDF endpoint returns valid PDF (Content-Type: application/pdf, starts with %PDF-). Print endpoint returns HTML with iframe pointing to PDF endpoint. Share endpoint returns whatsapp_url (starts with https://wa.me/), mailto_url (starts with mailto:), and pdf_url."
  - task: "Reports endpoints"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "/reports/sales /purchases /payments /stock /bu-summary; /reports/excel kind=sales|purchases|payments|outstanding|stock|bu-summary|pnl with filters dfrom/dto/customer_id/supplier_id/business_unit."
        -working: true
        -agent: "testing"
        -comment: "✅ PASS: All reports tests passed. Sales report: summary.count matches rows length, rows have invoice_no/business_unit/total/amount_paid/balance_due/payment_status, filters by customer_id/business_unit/date working correctly. Purchases report: has summary and rows with supplier_name/business_unit/total. Payments report: has summary with count/total/by_method dict, rows with allocations. Stock report: has feed/hatchery/farm/water/summary keys. BU Summary: has bu1-bu4 with sales_count/revenue/collected/outstanding, combined with income/expense/profit. Excel export: returns correct Content-Type (spreadsheetml/xlsx), first 2 bytes are 'PK' (zip magic), tested for sales and outstanding kinds."
  - task: "Dashboard top-customers / recent-payments / recent-sales"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "/dashboard/top-customers?by=revenue|outstanding, /dashboard/recent-payments, /dashboard/recent-sales."
        -working: true
        -agent: "testing"
        -comment: "✅ PASS: All dashboard tests passed. Top customers by outstanding: returns list (≤5), sorted by outstanding desc, items have id/name/outstanding. Top customers by revenue: returns list (≤5), sorted by revenue desc, items have id/name/revenue. Recent payments: returns list with party_name/amount/date/method. Recent sales: returns list with invoice_no/customer_name/business_unit/total."

frontend:
  - task: "Customer Detail page (/customers/:id) with tabs and statement actions"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/CustomerDetail.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Dedicated page replacing modal. Tabs Summary/Purchases/Payments/Ledger. View/Print/Share statement buttons. Customers list links to /customers/:id."
  - task: "Reports tabs with filters and Excel"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Reports.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Report kind selector + date/customer/BU filters; Print and Excel export buttons."
  - task: "Dashboard top customers + recent payments/sales"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Dashboard.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false

metadata:
  created_by: "main_agent"
  version: "1.3"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Added statement, ledger, reports and excel endpoints plus dashboard widgets. Need backend testing for ledger correctness, statement PDF validity, reports filtering, Excel content-type, and dashboard top-customer endpoints. CRITICAL: verify existing payment + invoice flows untouched."
    -agent: "testing"
    -message: "✅ ALL BACKEND TESTS PASSED (17/17). Comprehensive testing completed for: A) Customer ledger & statement (ledger with/without date filters, PDF generation, print HTML, share URLs), B) Reports (sales/purchases/payments/stock/bu-summary with filters, Excel export), C) Dashboard widgets (top customers by outstanding/revenue, recent payments/sales), D) No regression (payment creation, feed sale creation, invoice PDF generation all working). All endpoints return correct data structures, proper Content-Types, valid PDFs/Excel files. No regressions detected in existing flows. Backend implementation is production-ready."
