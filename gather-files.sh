#!/bin/bash
# Run from project root: bash gather-files.sh
# Creates a tarball of all files needed for Inputs & Assumptions consolidation

OUT="consolidation-files"
rm -rf "$OUT" "$OUT.tar.gz"
mkdir -p "$OUT"

# Core files to modify
FILES=(
  "client/src/pages/modeling/projects/workspace/inputs.tsx"
  "client/src/pages/modeling/projects/workspace/historical-pl.tsx"
  "client/src/pages/modeling/projects/workspace/unit-mix-leases.tsx"
)

# Find DirectInputForm and PLModeToggle wherever they live
find client/src -type f -name "direct-input*" >> /tmp/gather-list.txt 2>/dev/null
find client/src -type f -name "pl-mode*" >> /tmp/gather-list.txt 2>/dev/null
find client/src -type f -name "PLMode*" >> /tmp/gather-list.txt 2>/dev/null
find client/src -type f -name "financial-source*" >> /tmp/gather-list.txt 2>/dev/null

# Shared configs
find shared -type f -name "asset-class*" >> /tmp/gather-list.txt 2>/dev/null

# Types for customMetrics / inputAssumptions
find shared -type f -name "schema*" -o -name "types*" | head -10 >> /tmp/gather-list.txt 2>/dev/null
find client/src -path "*/types*" -name "*.ts" | head -10 >> /tmp/gather-list.txt 2>/dev/null

# Hooks that feed these components
find client/src -type f -name "*use*project*" | head -5 >> /tmp/gather-list.txt 2>/dev/null
find client/src -type f -name "*use*financial*" | head -5 >> /tmp/gather-list.txt 2>/dev/null
find client/src -type f -name "*use*input*" | head -5 >> /tmp/gather-list.txt 2>/dev/null

# Server-side compute endpoint
find server -type f -name "*direct-input*" >> /tmp/gather-list.txt 2>/dev/null
find server -type f -name "*compute*" | head -5 >> /tmp/gather-list.txt 2>/dev/null

# Dedup
sort -u /tmp/gather-list.txt > /tmp/gather-dedup.txt

# Copy all files preserving directory structure
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mkdir -p "$OUT/$(dirname "$f")"
    cp "$f" "$OUT/$f"
    echo "✅ $f"
  else
    echo "⚠️  NOT FOUND: $f"
  fi
done

while IFS= read -r f; do
  if [ -f "$f" ]; then
    mkdir -p "$OUT/$(dirname "$f")"
    cp "$f" "$OUT/$f"
    echo "✅ $f"
  fi
done < /tmp/gather-dedup.txt

rm -f /tmp/gather-list.txt /tmp/gather-dedup.txt

# Summary
echo ""
echo "=== Files gathered ==="
find "$OUT" -type f | sort
echo ""
FILE_COUNT=$(find "$OUT" -type f | wc -l)
echo "Total: $FILE_COUNT files"

# Create tarball
tar czf "$OUT.tar.gz" "$OUT"
echo "📦 Created $OUT.tar.gz — upload this to Claude"
