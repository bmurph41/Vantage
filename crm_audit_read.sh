#!/bin/bash
# ============================================================
#  MarinaMatch CRM Audit — Codebase Reader
#  Run from your Replit project root:
#    bash crm_audit_read.sh 2>/dev/null | tee /tmp/crm_audit_output.txt
#  Then paste the contents of /tmp/crm_audit_output.txt back here.
# ============================================================

OUT=""
DIVIDER="================================================================"
SUBDIV="----------------------------------------------------------------"

section() {
  echo ""
  echo "$DIVIDER"
  echo "  $1"
  echo "$DIVIDER"
}

subsection() {
  echo ""
  echo "$SUBDIV"
  echo "  $1"
  echo "$SUBDIV"
}

print_file() {
  local filepath="$1"
  local label="${2:-$1}"
  if [ -f "$filepath" ]; then
    echo ""
    echo "### FILE: $filepath"
    echo "### LINES: $(wc -l < "$filepath")"
    echo ""
    cat "$filepath"
    echo ""
    echo "### END: $filepath"
  else
    echo ""
    echo "### NOT FOUND: $filepath"
  fi
}

print_file_section() {
  # Print lines matching a pattern plus N lines of context
  local filepath="$1"
  local pattern="$2"
  local context="${3:-30}"
  local label="${4:-$pattern}"
  if [ -f "$filepath" ]; then
    echo ""
    echo "### GREP in $filepath — pattern: $label"
    grep -n -A "$context" "$pattern" "$filepath" | head -200
    echo "### END GREP"
  fi
}

print_file_lines() {
  local filepath="$1"
  local start="$2"
  local end="$3"
  if [ -f "$filepath" ]; then
    echo ""
    echo "### FILE: $filepath [lines $start–$end]"
    sed -n "${start},${end}p" "$filepath"
    echo "### END"
  fi
}

find_and_print() {
  # find files matching pattern and print them
  local dir="$1"
  local pattern="$2"
  local maxfiles="${3:-5}"
  local count=0
  while IFS= read -r -d '' f; do
    if [ $count -ge $maxfiles ]; then
      echo "### ... (more files found, increase maxfiles if needed)"
      break
    fi
    print_file "$f"
    count=$((count+1))
  done < <(find "$dir" -name "$pattern" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/.cache/*" -print0 2>/dev/null)
}

# ============================================================
section "0. PROJECT STRUCTURE — Top-level directories"
# ============================================================
echo ""
echo "=== Root directory ==="
ls -la 2>/dev/null | head -50

echo ""
echo "=== client/src structure ==="
find client/src -type d 2>/dev/null | head -60 || find src -type d 2>/dev/null | head -60

echo ""
echo "=== server structure ==="
find server -type d 2>/dev/null | head -40 || find . -name "server" -type d 2>/dev/null | head -5

echo ""
echo "=== shared / db structure ==="
find shared -type d 2>/dev/null | head -20
find db -type d 2>/dev/null | head -20

# ============================================================
section "1. DATABASE SCHEMA — Drizzle ORM schema files"
# ============================================================

subsection "1a. Find all schema files"
find . -name "schema.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null
find . -name "schema*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null
find . -name "*.schema.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null

subsection "1b. Primary schema file(s)"
# Try common locations
for f in \
  "shared/schema.ts" \
  "db/schema.ts" \
  "server/db/schema.ts" \
  "src/db/schema.ts" \
  "shared/db/schema.ts"; do
  print_file "$f"
done

subsection "1c. Any additional schema files (schema splits)"
find . -path "*/db/schema*" -name "*.ts" -not -path "*/node_modules/*" 2>/dev/null | while read f; do
  print_file "$f"
done

# ============================================================
section "2. CRM — DATABASE TABLES (grep in schema)"
# ============================================================

# Find the actual schema file path
SCHEMA_FILE=$(find . -name "schema.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | head -1)

if [ -n "$SCHEMA_FILE" ]; then
  echo "Schema file: $SCHEMA_FILE"
  echo "Total lines: $(wc -l < "$SCHEMA_FILE")"

  subsection "2a. contacts table definition"
  grep -n "contacts\|contact" "$SCHEMA_FILE" | head -5
  # Find line number of contacts table
  CONTACT_LINE=$(grep -n "export const contacts\|pgTable.*contact" "$SCHEMA_FILE" | head -1 | cut -d: -f1)
  if [ -n "$CONTACT_LINE" ]; then
    print_file_lines "$SCHEMA_FILE" "$CONTACT_LINE" "$((CONTACT_LINE+80))"
  fi

  subsection "2b. companies table definition"
  COMPANY_LINE=$(grep -n "export const companies\|pgTable.*compan" "$SCHEMA_FILE" | head -1 | cut -d: -f1)
  if [ -n "$COMPANY_LINE" ]; then
    print_file_lines "$SCHEMA_FILE" "$COMPANY_LINE" "$((COMPANY_LINE+80))"
  fi

  subsection "2c. properties table definition"
  PROP_LINE=$(grep -n "export const properties\|pgTable.*propert" "$SCHEMA_FILE" | head -1 | cut -d: -f1)
  if [ -n "$PROP_LINE" ]; then
    print_file_lines "$SCHEMA_FILE" "$PROP_LINE" "$((PROP_LINE+80))"
  fi

  subsection "2d. deals / pipeline table definition"
  DEAL_LINE=$(grep -n "export const deals\|pgTable.*deal\|export const pipeline" "$SCHEMA_FILE" | head -1 | cut -d: -f1)
  if [ -n "$DEAL_LINE" ]; then
    print_file_lines "$SCHEMA_FILE" "$DEAL_LINE" "$((DEAL_LINE+80))"
  fi

  subsection "2e. sales_comps / rent_comps table definitions"
  SALESCOMP_LINE=$(grep -n "export const salesComp\|export const sale_comp\|export const comps\|pgTable.*comp" "$SCHEMA_FILE" | head -1 | cut -d: -f1)
  if [ -n "$SALESCOMP_LINE" ]; then
    print_file_lines "$SCHEMA_FILE" "$SALESCOMP_LINE" "$((SALESCOMP_LINE+80))"
  fi
  RENTCOMP_LINE=$(grep -n "export const rentComp\|export const rent_comp" "$SCHEMA_FILE" | head -1 | cut -d: -f1)
  if [ -n "$RENTCOMP_LINE" ]; then
    print_file_lines "$SCHEMA_FILE" "$RENTCOMP_LINE" "$((RENTCOMP_LINE+80))"
  fi

  subsection "2f. Join / association tables (contact_companies, contact_properties, etc.)"
  grep -n "contactCompan\|contact_compan\|contactPropert\|contact_propert\|companyPropert\|company_propert\|associations\|Relations\|pgTable.*join\|contactDeal\|contact_deal" "$SCHEMA_FILE" | head -40

  subsection "2g. Financial model tables"
  FM_LINE=$(grep -n "export const financialModel\|export const financial_model\|pgTable.*financial" "$SCHEMA_FILE" | head -1 | cut -d: -f1)
  if [ -n "$FM_LINE" ]; then
    print_file_lines "$SCHEMA_FILE" "$FM_LINE" "$((FM_LINE+60))"
  fi

  subsection "2h. ALL export const / pgTable declarations (full table list)"
  grep -n "export const\|= pgTable" "$SCHEMA_FILE" | grep -v "//" | head -80
else
  echo "### WARNING: Could not locate schema.ts"
fi

# ============================================================
section "3. CRM BACKEND ROUTES"
# ============================================================

subsection "3a. Locate routes files"
find . -name "routes.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null
find . -name "routes*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null
find . -path "*/routes/*" -name "*.ts" -not -path "*/node_modules/*" 2>/dev/null | head -30

ROUTES_FILE=$(find . -name "routes.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | head -1)

if [ -n "$ROUTES_FILE" ]; then
  echo "Routes file: $ROUTES_FILE ($(wc -l < "$ROUTES_FILE") lines)"

  subsection "3b. CRM route registrations (contact, company, property, comp endpoints)"
  grep -n "contact\|company\|compan\|propert\|\/crm\|\/comps\|rent.comp\|sales.comp" "$ROUTES_FILE" | grep -i "get\|post\|put\|patch\|delete\|router\|app\.\|route\|express" | head -80

  subsection "3c. Contact routes — full handler blocks"
  # Find all contact route blocks
  grep -n "contact" "$ROUTES_FILE" | grep -i "app\.\|router\.\|route\b" | head -20 | while IFS=: read lineno rest; do
    print_file_lines "$ROUTES_FILE" "$lineno" "$((lineno+40))"
  done

  subsection "3d. Property routes — full handler blocks"
  grep -n "\/properties\|\/property" "$ROUTES_FILE" | grep -i "app\.\|router\.\|route\b\|get\|post\|put" | head -10 | while IFS=: read lineno rest; do
    print_file_lines "$ROUTES_FILE" "$lineno" "$((lineno+40))"
  done

  subsection "3e. Company routes — full handler blocks"
  grep -n "\/companies\|\/company" "$ROUTES_FILE" | grep -i "app\.\|router\.\|route\b\|get\|post\|put" | head -10 | while IFS=: read lineno rest; do
    print_file_lines "$ROUTES_FILE" "$lineno" "$((lineno+40))"
  done

  subsection "3f. Comps routes"
  grep -n "comp" "$ROUTES_FILE" | grep -i "app\.\|router\.\|route\b\|get\|post\|put" | head -20 | while IFS=: read lineno rest; do
    print_file_lines "$ROUTES_FILE" "$lineno" "$((lineno+40))"
  done
else
  echo "### routes.ts not found — searching for route files..."
  find . -path "*/server*" -name "*.ts" -not -path "*/node_modules/*" | xargs grep -l "app.get\|router.get\|app.post" 2>/dev/null | head -10
fi

subsection "3g. Check for separate CRM route files"
find . -path "*/routes*" \( -name "*contact*" -o -name "*compan*" -o -name "*propert*" -o -name "*crm*" \) -not -path "*/node_modules/*" 2>/dev/null | while read f; do
  print_file "$f"
done

# ============================================================
section "4. CRM FRONTEND COMPONENTS"
# ============================================================

subsection "4a. Locate CRM directory"
find . \( -path "*/crm*" -o -path "*/CRM*" \) -type d -not -path "*/node_modules/*" 2>/dev/null
find client/src -type d 2>/dev/null | grep -i "crm\|contact\|compan\|propert" | head -20

subsection "4b. CRM index / main entry"
for pattern in "crm/index.tsx" "crm/index.ts" "CRM/index.tsx" "CRM.tsx" "crm.tsx"; do
  find . -path "*/$pattern" -not -path "*/node_modules/*" 2>/dev/null | while read f; do print_file "$f"; done
done

subsection "4c. Contacts components"
find . \( -name "*Contact*" -o -name "*contact*" \) -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | head -15 | while read f; do
  echo "  FOUND: $f"
done
# Print the main contact list and record files
find . \( -name "ContactList*" -o -name "Contacts.*" -o -name "ContactRecord*" -o -name "ContactDetail*" -o -name "ContactPage*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -3 | while read f; do
  print_file "$f"
done

subsection "4d. Companies components"
find . \( -name "*Compan*" -o -name "*company*" \) -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | head -15 | while read f; do
  echo "  FOUND: $f"
done
find . \( -name "CompanyList*" -o -name "Companies.*" -o -name "CompanyRecord*" -o -name "CompanyDetail*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -3 | while read f; do
  print_file "$f"
done

subsection "4e. Properties CRM components"
find . \( -name "*Propert*" -o -name "*property*" \) -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | grep -i "crm\|list\|record\|detail\|page\|view" | head -15 | while read f; do
  echo "  FOUND: $f"
done
find . \( -name "PropertyList*" -o -name "PropertyRecord*" -o -name "PropertyDetail*" -o -name "PropertyCRM*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -3 | while read f; do
  print_file "$f"
done

subsection "4f. PreviewDrawer component"
find . -name "*Preview*" -o -name "*Drawer*" -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -5 | while read f; do
  print_file "$f"
done

subsection "4g. Pipeline / Deal board component"
find . \( -name "*Pipeline*" -o -name "*pipeline*" -o -name "*DealBoard*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -5 | while read f; do
  echo "  FOUND: $f"
done
find . \( -name "Pipeline.*" -o -name "DealBoard.*" -o -name "KanbanBoard*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -2 | while read f; do
  print_file "$f"
done

subsection "4h. Activity Timeline component"
find . \( -name "*Timeline*" -o -name "*Activity*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -5 | while read f; do
  echo "  FOUND: $f"
done
find . \( -name "ActivityTimeline*" -o -name "Timeline.*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -2 | while read f; do
  print_file "$f"
done

# ============================================================
section "5. COMPS — EXISTING IMPLEMENTATION"
# ============================================================

subsection "5a. Locate all comps-related files"
find . \( -name "*comp*" -o -name "*Comp*" \) -name "*.tsx" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | grep -v "component\|Component\|decomp" | head -20 | while read f; do echo "  $f"; done
find . \( -name "*comp*" -o -name "*Comp*" \) -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | grep -v "component\|Component\|decomp\|schema\|\.d\.ts" | head -20 | while read f; do echo "  $f"; done

subsection "5b. Print comps component files"
find . \( -name "*SalesComp*" -o -name "*RentComp*" -o -name "*salesComp*" -o -name "*rentComp*" -o -name "*Comps.*" -o -name "*comps.*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -5 | while read f; do
  print_file "$f"
done

subsection "5c. Comps in routes (grep)"
if [ -n "$ROUTES_FILE" ]; then
  grep -n "comp\|Comp" "$ROUTES_FILE" | grep -v "component\|Component\|#\|//" | head -30
fi

subsection "5d. Comps schema (grep in schema)"
if [ -n "$SCHEMA_FILE" ]; then
  grep -n -A 40 "comp\|Comp" "$SCHEMA_FILE" | grep -v "component\|Component" | head -100
fi

# ============================================================
section "6. FINANCIAL MODEL — CRM LINKAGE"
# ============================================================

subsection "6a. Locate financial model files"
find . \( -name "*FinancialModel*" -o -name "*financial-model*" -o -name "*financialModel*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -10 | while read f; do echo "  $f"; done

subsection "6b. How are deals linked to properties? (schema + routes)"
if [ -n "$SCHEMA_FILE" ]; then
  grep -n "property_id\|propertyId\|deal_id\|dealId" "$SCHEMA_FILE" | head -40
fi

subsection "6c. Financial model ↔ property / deal linkage"
if [ -n "$SCHEMA_FILE" ]; then
  grep -n "financial\|deal_id\|project_id\|projectId" "$SCHEMA_FILE" | head -40
fi

subsection "6d. FM data returned in any CRM-facing API endpoint"
if [ -n "$ROUTES_FILE" ]; then
  grep -n "financialModel\|financial_model\|irrResult\|capRate\|irr" "$ROUTES_FILE" | grep -v "//\|import" | head -30
fi

# ============================================================
section "7. STORAGE / DATABASE LAYER"
# ============================================================

subsection "7a. storage.ts / db.ts — CRM query functions"
for f in "server/storage.ts" "server/db.ts" "db/storage.ts" "storage.ts"; do
  if [ -f "$f" ]; then
    echo "Found: $f ($(wc -l < "$f") lines)"
    echo ""
    echo "--- CRM-relevant function signatures ---"
    grep -n "contact\|compan\|propert\|comp\|deal" "$f" | grep -i "async\|function\|const.*=\|export" | grep -v "//\|component" | head -60
    echo ""
    echo "--- Full file (first 300 lines) ---"
    head -300 "$f"
  fi
done

subsection "7b. Any separate CRM storage/repository files"
find . \( -name "*contact*storage*" -o -name "*crm*storage*" -o -name "*contact*repo*" \) -not -path "*/node_modules/*" 2>/dev/null | while read f; do print_file "$f"; done

# ============================================================
section "8. TYPES / INTERFACES"
# ============================================================

subsection "8a. Locate type definition files"
find . \( -name "types.ts" -o -name "*.types.ts" -o -name "types.d.ts" \) -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | head -10 | while read f; do echo "  $f"; done

subsection "8b. CRM-related type interfaces"
find . \( -name "types.ts" -o -name "*.types.ts" \) -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | head -5 | while read f; do
  echo "=== $f ==="
  grep -n -A 20 "interface.*Contact\|interface.*Compan\|interface.*Propert\|type.*Contact\|type.*Compan\|type.*Propert" "$f" | head -100
done

# Also check shared folder
for f in "shared/types.ts" "shared/schema.ts" "client/src/types.ts"; do
  if [ -f "$f" ]; then
    echo "=== $f — CRM types ==="
    grep -n -A 15 "Contact\|Company\|Propert" "$f" | grep -v "node_modules" | head -80
  fi
done

# ============================================================
section "9. API CLIENT / HOOKS (TanStack Query)"
# ============================================================

subsection "9a. Locate API/hooks files"
find . \( -name "*api*" -o -name "*hooks*" -o -name "queryClient*" \) -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v "node_modules\|dist\|\.d\.ts" | grep -i "crm\|contact\|compan\|propert" | head -20 | while read f; do echo "  $f"; done

subsection "9b. CRM query hooks (useContacts, useCompanies, useProperties)"
find . -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v "node_modules\|dist" | xargs grep -l "useContacts\|useCompanies\|useProperties\|useCRM" 2>/dev/null | head -5 | while read f; do
  echo "=== $f ==="
  grep -n -B2 -A 20 "useContacts\|useCompanies\|useProperties\|useCRM" "$f" | head -100
done

subsection "9c. API fetch functions for CRM entities"
find . -path "*/api*" \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" 2>/dev/null | head -10 | while read f; do
  if grep -qi "contact\|compan\|propert" "$f" 2>/dev/null; then
    echo "=== $f ==="
    grep -n "contact\|compan\|propert\|fetch\|axios\|apiRequest" "$f" | head -40
  fi
done

# ============================================================
section "10. SIDEBAR NAVIGATION"
# ============================================================

subsection "10a. Main sidebar / navigation component"
find . \( -name "*Sidebar*" -o -name "*Navigation*" -o -name "*NavMenu*" -o -name "*sidebar*" \) -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | head -5 | while read f; do
  print_file "$f"
done

subsection "10b. Router / App component (route definitions)"
find . \( -name "App.tsx" -o -name "App.ts" -o -name "router.tsx" -o -name "routes.tsx" \) -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | head -3 | while read f; do
  print_file "$f"
done

# ============================================================
section "11. MIGRATION FILES — EXISTING DB MIGRATIONS"
# ============================================================

subsection "11a. Drizzle migrations directory"
find . -path "*/drizzle/*" -o -path "*/migrations/*" 2>/dev/null | grep -v "node_modules\|dist" | head -20 | while read f; do echo "  $f"; done

subsection "11b. Most recent migration files (last 3)"
find . -path "*/drizzle/*" -name "*.sql" -not -path "*/node_modules/*" 2>/dev/null | sort | tail -3 | while read f; do
  print_file "$f"
done
find . -path "*/migrations/*" -name "*.sql" -not -path "*/node_modules/*" 2>/dev/null | sort | tail -3 | while read f; do
  print_file "$f"
done

subsection "11c. drizzle.config.ts"
for f in "drizzle.config.ts" "drizzle.config.js"; do
  print_file "$f"
done

# ============================================================
section "12. PACKAGE.JSON — Dependencies"
# ============================================================
subsection "12a. package.json scripts + key deps"
if [ -f "package.json" ]; then
  echo "=== package.json ==="
  cat package.json | grep -A 5 '"scripts"' | head -20
  echo "..."
  cat package.json | grep -A 3 '"drizzle\|pg\|postgres\|express\|tanstack\|react-query\|zod"' | head -30
fi

# ============================================================
section "SUMMARY — FILE INVENTORY"
# ============================================================
echo ""
echo "=== All .tsx files in client/src (CRM-relevant names) ==="
find client/src -name "*.tsx" -not -path "*/node_modules/*" 2>/dev/null | grep -i "crm\|contact\|compan\|propert\|deal\|pipeline\|comp\|financial\|model" | sort

echo ""
echo "=== All .ts files in server (non-node_modules) ==="
find server -name "*.ts" -not -path "*/node_modules/*" 2>/dev/null | sort | head -50

echo ""
echo "=== All .ts files in shared (non-node_modules) ==="
find shared -name "*.ts" -not -path "*/node_modules/*" 2>/dev/null | sort | head -30

echo ""
echo "================================================================"
echo "  AUDIT READ COMPLETE"
echo "  Paste the full output of this file back to Claude."
echo "  If any critical sections show 'NOT FOUND', check path"
echo "  assumptions at the top of this script."
echo "================================================================"
