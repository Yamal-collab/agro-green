#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
# (preserved)
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Refactor Reports module into a clean executive business dashboard. Remove
  customer selector, Excel export, Print/PDF, BU tabs, report-kind selector,
  and all customer-specific lists. Keep only date-range filter. Show 5 KPIs,
  4 BU cards (Feed/Hatchery/Farm/Water) and business analytics charts. Do
  NOT modify Sales / Inventory / Finance / Dashboard / Customer Detail /
  FIFO payment / Invoice PDF.

backend:
  - task: "GET /api/reports/exec-dashboard"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Returns totals (revenue/expenses/profit/outstanding/stock_value), per_bu cards, monthly_trend (6 months) and expense_breakdown. Filterable via dfrom/dto. Revenue from sales totals, expenses from finance_transactions, stock value from feed inventory (qty*avg cost), stock units from each BU."
        -working: true
        -agent: "testing"
        -comment: "✅ ALL TESTS PASSED (13/13). Executive dashboard endpoint: (1) Structure correct with all required keys, (2) totals.revenue matches sum of per_bu revenues, (3) totals.profit = revenue - expenses, (4) all per-BU profit calculations correct, (5) future date filter works (totals=0, trend length=6), (6) date range filter works correctly. Regression tests: (7) POST /api/payments works, (8) POST /api/feed/sales creates sales with invoice_no, (9) Invoice PDF valid, (10) Customer details returns invoices & payments arrays, (11) Customer statement PDF valid, (12) Dashboard summary contains outstanding & recent_transactions, (13) Top customers endpoint returns list ≤5. No regressions detected."

frontend:
  - task: "Reports.jsx → Executive Dashboard"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Reports.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Rewritten. Removed customer selector, Excel button, Print/PDF button, BU tabs, kind selector, customer-specific tables. Added 5 KPIs, 4 BU cards, Revenue-by-BU bar, Monthly trend line, Expense Breakdown pie, Profit Comparison bar, Outstanding-by-BU horizontal bar. Date range filter only."

metadata:
  created_by: "main_agent"
  version: "1.3"
  test_sequence: 5
  run_ui: false

test_plan:
  current_focus:
    - "GET /api/reports/exec-dashboard"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Reports refactored to executive dashboard. Need backend testing of /api/reports/exec-dashboard correctness, plus verify no regression in Sales/Inventory/Finance/Dashboard/CustomerDetail/Invoice PDF/FIFO payment endpoints."
    -agent: "testing"
    -message: "✅ Backend testing complete. All 13 tests passed (6 exec-dashboard tests + 7 regression tests). New endpoint working correctly with proper structure, calculations, and date filtering. No regressions detected in existing endpoints (payments, sales, invoices, customer details, dashboard). Ready for user acceptance."
