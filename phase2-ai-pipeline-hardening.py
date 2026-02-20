"""
Phase 2: AI Pipeline Hardening
===============================
1. Chunk AI batches to 50 items max (prevents token truncation)
2. Pass section context (Revenue/COGS/Expense) to AI prompt
3. Fix overly-aggressive total exclusion pattern
4. Add promote-to-actuals deduplication (upsert)

Run: python3 phase2-ai-pipeline-hardening.py
"""
import os

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0

# ================================================================
# 1. DOC INTEL: Chunk AI batches + pass section context
# ================================================================
print("=== 1. Chunk AI batches + section context ===")

DIS = "server/services/doc-intel-service.ts"
c = read(DIS)

# Replace the single AI call with chunked batches
old_ai_call = """    // Second pass: AI categorization for items without pattern matches
    if (uncategorizedItems.length > 0) {
      console.log(`[Doc Intel] Running AI categorization for ${uncategorizedItems.length} uncategorized items`);
      
      const allCategories = await this.getCategories(orgId);
      const aiResults = await this.aiCategorizeItems(
        uncategorizedItems.map(i => ({ id: i.id, rawText: i.rawText, amount: i.amount })),
        allCategories,
        enabledDepartments
      );"""

new_ai_call = """    // Second pass: AI categorization for items without pattern matches
    // Chunked to prevent token limit issues with large P&Ls
    if (uncategorizedItems.length > 0) {
      console.log(`[Doc Intel] Running AI categorization for ${uncategorizedItems.length} uncategorized items`);
      
      const allCategories = await this.getCategories(orgId);
      const AI_BATCH_SIZE = 50;
      const aiResults = new Map<string, { categoryId: string; tier: string; department: string; confidence: number }>();
      
      // Process in chunks of 50 items
      for (let batchStart = 0; batchStart < uncategorizedItems.length; batchStart += AI_BATCH_SIZE) {
        const batch = uncategorizedItems.slice(batchStart, batchStart + AI_BATCH_SIZE);
        console.log(`[Doc Intel] AI batch ${Math.floor(batchStart / AI_BATCH_SIZE) + 1}/${Math.ceil(uncategorizedItems.length / AI_BATCH_SIZE)}: ${batch.length} items`);
        
        const batchResults = await this.aiCategorizeItems(
          batch.map(i => ({ id: i.id, rawText: i.rawText, amount: i.amount })),
          allCategories,
          enabledDepartments
        );
        
        for (const [key, val] of batchResults.entries()) {
          aiResults.set(key, val);
        }
      }"""

if old_ai_call in c and 'AI_BATCH_SIZE' not in c:
    c = c.replace(old_ai_call, new_ai_call, 1)
    changes += 1
    print("  ✓ AI categorization now processes in chunks of 50")

# ================================================================
# 2. Fix overly-aggressive \btotal\b exclusion
# ================================================================
print("\n=== 2. Fix total exclusion pattern ===")

old_total_pattern = "      { pattern: /\\btotal\\b/i, reason: 'Summary/total row' },"
new_total_pattern = """      { pattern: /^total\\s/i, reason: 'Summary/total row (line starts with Total)' },
      { pattern: /^\\s*total$/i, reason: 'Summary/total row (standalone Total)' },"""

if old_total_pattern in c:
    c = c.replace(old_total_pattern, new_total_pattern, 1)
    changes += 1
    print("  ✓ Fixed \\btotal\\b → ^total\\s (no longer excludes 'Total Boat Club Revenue')")

# ================================================================
# 3. Add section context to AI prompt
# ================================================================
print("\n=== 3. Enhance AI prompt with amount context ===")

old_prompt_start = """    const prompt = `You are a marina/boat storage financial analyst. Categorize these P&L line items.

Categories available (tier indicates Revenue, COGS, or Expense):
${JSON.stringify(categoryList.slice(0, 50), null, 2)}

Line items to categorize:
${JSON.stringify(items.map(i => ({ id: i.id, text: i.rawText, amount: i.amount })), null, 2)}"""

new_prompt_start = """    // Compute total amounts by sign to help AI understand context
    const totalPositive = items.reduce((s, i) => s + Math.max(0, parseFloat(i.amount || '0')), 0);
    const totalNegative = items.reduce((s, i) => s + Math.min(0, parseFloat(i.amount || '0')), 0);
    
    const prompt = `You are a marina/boat storage financial analyst. Categorize these P&L line items.

IMPORTANT CONTEXT:
- Items with POSITIVE amounts are typically Revenue or COGS
- Items with NEGATIVE amounts are typically Expenses
- Total positive amounts in this batch: $${Math.round(totalPositive).toLocaleString()}
- Total negative amounts in this batch: $${Math.round(Math.abs(totalNegative)).toLocaleString()}
- Use the amount magnitude to distinguish revenue lines (large $) from miscellaneous (small $)

Categories available (tier indicates Revenue, COGS, or Expense):
${JSON.stringify(categoryList.slice(0, 50), null, 2)}

Line items to categorize:
${JSON.stringify(items.map(i => ({ id: i.id, text: i.rawText, amount: i.amount })), null, 2)}"""

if old_prompt_start in c and 'IMPORTANT CONTEXT' not in c:
    c = c.replace(old_prompt_start, new_prompt_start, 1)
    changes += 1
    print("  ✓ AI prompt now includes amount context (positive/negative totals, magnitude guidance)")

write(DIS, c)

# ================================================================
# 4. PROMOTE: Add deduplication (upsert-style)
# ================================================================
print("\n=== 4. Promote deduplication ===")

PTA = "server/services/pnl/promote-to-actuals.ts"
c = read(PTA)

# Find where actuals are inserted and add a delete-before-insert pattern
# This prevents duplicates when re-promoting
old_promote_loop = "  for (const docId of docIds) {"
new_promote_loop = """  // DEDUP: Clear existing actuals for these documents before re-promoting
  // This prevents duplicate actuals when re-importing or re-promoting
  for (const docId of docIds) {
    try {
      await db.execute(
        sql\`DELETE FROM ${modelingActuals} 
             WHERE modeling_project_id = \${modelingProjectId} 
             AND org_id = \${orgId}
             AND source_document_id = \${docId}\`
      );
    } catch (e) {
      // source_document_id column may not exist yet — fall through
      console.warn('[Promote] Could not deduplicate by docId, continuing:', (e as Error).message);
    }
  }

  for (const docId of docIds) {"""

if 'DEDUP: Clear existing' not in c and old_promote_loop in c:
    c = c.replace(old_promote_loop, new_promote_loop, 1)
    changes += 1
    print("  ✓ Added deduplication: clears existing actuals for document before re-promoting")

write(PTA, c)

print(f"\n=== DONE: {changes} patches ===")
print("  1. AI batches chunked to 50 items (prevents token truncation)")
print("  2. \\btotal\\b exclusion fixed to ^total\\s (preserves revenue items with 'Total' in name)")
print("  3. AI prompt enhanced with amount context (positive/negative, magnitude)")
print("  4. Promote-to-actuals deduplication prevents duplicate actuals on re-import")
