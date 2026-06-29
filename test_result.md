#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
# (preserved)
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Session C - Invoice PDF + View + Print + Share for AgriBiz ERP.
  Add backend endpoints to generate A5 portrait invoice PDFs (ReportLab),
  print HTML pages, and a share endpoint returning whatsapp_url and mailto_url.
  Patch Feed.jsx, Hatchery.jsx, Farm.jsx to add View/Print/Share actions on the
  sales tables. Do NOT touch the existing Sale creation flow.

backend:
  - task: "Invoice PDF endpoint (GET /api/invoice/{type}/{sale_id}/pdf)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Implemented A5 portrait ReportLab PDF for feed/chick/farm sales. Verified via curl that all 3 return %PDF-1.4 magic bytes."
        -working: true
        -agent: "testing"
        -comment: "✅ PASSED: Tested all 3 types (feed/chick/farm). Returns correct Content-Type (application/pdf), starts with %PDF magic bytes. Invalid type returns 400, non-existent sale_id returns 404. No side effects detected."
  - task: "Invoice print endpoint (GET /api/invoice/{type}/{sale_id}/print)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Returns HTML page embedding PDF iframe and auto-triggers print()."
        -working: true
        -agent: "testing"
        -comment: "✅ PASSED: Tested all 3 types (feed/chick/farm). Returns HTML with Content-Type text/html, contains iframe pointing to /api/invoice/{type}/{sale_id}/pdf. Auto-print JavaScript working."
  - task: "Invoice share endpoint (POST /api/invoice/{type}/{sale_id}/share)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Returns whatsapp_url and mailto_url containing PDF link."
        -working: true
        -agent: "testing"
        -comment: "✅ PASSED: Tested all 3 types (feed/chick/farm). Returns JSON with all required keys: whatsapp_url, mailto_url, pdf_url, invoice_no. URLs properly formatted with customer details and invoice info."

frontend:
  - task: "Invoice actions on Feed/Hatchery/Farm sales tables"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Feed.jsx, Hatchery.jsx, Farm.jsx, lib/invoice.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Added View/Print/Share action column with required data-testids. Sale creation flow untouched."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Session C complete. Backend invoice endpoints added with ReportLab. Frontend patched with View/Print/Share buttons on Feed/Hatchery/Farm sales tables. Sale creation flow preserved. Admin: admin@agribiz.com / admin123."
    -agent: "testing"
    -message: "✅ ALL BACKEND INVOICE ENDPOINTS PASSED. Tested all 3 types (feed/chick/farm) for PDF, Print, and Share endpoints. Error handling verified (400 for invalid type, 404 for non-existent sale). CRITICAL: Verified no side effects - no duplicate sales, no stock changes, no outstanding modifications. Backend testing complete."
