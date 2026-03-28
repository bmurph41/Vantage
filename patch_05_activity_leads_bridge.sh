#!/bin/bash
# PATCH 05: Activity Log ↔ Leads/Prospecting bidirectional feed
# Run from workspace root: bash patch_05_activity_leads_bridge.sh

echo "▶ Patch 05: Activity Log ↔ Leads bidirectional bridge"

cat > /tmp/patch05.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';

// ── 1. Patch activity.tsx — add entityType filter + lead support ──
{
  const file = 'client/src/pages/activity.tsx';
  let src = readFileSync(file, 'utf8');
  let changed = 0;

  // Add entityType filter state
  const OLD_STATE = `const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');`;
  const NEW_STATE = `const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all'); // all | deal | lead | contact | company`;
  if (src.includes(OLD_STATE) && !src.includes('entityFilter')) {
    src = src.replace(OLD_STATE, NEW_STATE);
    console.log('  ✅ [activity.tsx] Added entityFilter state');
    changed++;
  }

  // Add lead to the activity type definition
  const OLD_TYPE_DEF = `type: 'call' | 'email' | 'meeting' | 'note' | 'task' | 'task_created' | 'stage_change' | 'deal_created';`;
  const NEW_TYPE_DEF = `type: 'call' | 'email' | 'meeting' | 'note' | 'task' | 'task_created' | 'stage_change' | 'deal_created' | 'lead_activity';
  lead?: { id: string; name: string; status?: string };`;
  if (src.includes(OLD_TYPE_DEF)) {
    src = src.replace(OLD_TYPE_DEF, NEW_TYPE_DEF);
    console.log('  ✅ [activity.tsx] Added lead type to Activity type definition');
    changed++;
  }

  // Add entity filter to the filteredActivities logic
  const OLD_FILTER_RETURN = `    return matchesSearch && matchesType && matchesDirection && matchesDate;`;
  const NEW_FILTER_RETURN = `    // Entity filter: all | deal | lead | contact | company
    let matchesEntity = true;
    if (entityFilter === 'deal') matchesEntity = !!activity.deal;
    else if (entityFilter === 'lead') matchesEntity = !!(activity as any).lead;
    else if (entityFilter === 'contact') matchesEntity = !!activity.contact && !activity.deal;
    else if (entityFilter === 'company') matchesEntity = !!activity.company && !activity.deal;

    return matchesSearch && matchesType && matchesDirection && matchesDate && matchesEntity;`;
  if (src.includes(OLD_FILTER_RETURN)) {
    src = src.replace(OLD_FILTER_RETURN, NEW_FILTER_RETURN);
    console.log('  ✅ [activity.tsx] Added entityFilter to filteredActivities logic');
    changed++;
  }

  // Add lead link rendering in activity card (near where deal link is shown)
  const OLD_DEAL_LINK = `{activity.deal && (
                            <Link href={\`/crm/deals/\${activity.deal.id}\`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>`;
  const NEW_DEAL_LINK = `{(activity as any).lead && (
                            <Link href={\`/crm/leads/\${(activity as any).lead.id}\`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 hover:bg-purple-50 cursor-pointer gap-1">
                                <TrendingUp className="h-2.5 w-2.5 text-purple-600" />
                                Lead: {(activity as any).lead.name}
                              </Badge>
                            </Link>
                          )}
                          {activity.deal && (
                            <Link href={\`/crm/deals/\${activity.deal.id}\`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>`;
  if (src.includes(OLD_DEAL_LINK)) {
    src = src.replace(OLD_DEAL_LINK, NEW_DEAL_LINK);
    console.log('  ✅ [activity.tsx] Added lead link in activity card');
    changed++;
  }

  // Add Entity filter selector to the filter toolbar
  // Find date range filter select and add entity filter next to it
  const OLD_DIRECTION_SELECT_END = `<SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>`;
  const NEW_DIRECTION_SELECT_END = `<SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>

            {/* Entity filter */}
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="deal">Deals Only</SelectItem>
                <SelectItem value="lead">Leads Only</SelectItem>
                <SelectItem value="contact">Contacts Only</SelectItem>
                <SelectItem value="company">Companies Only</SelectItem>
              </SelectContent>
            </Select>`;
  if (src.includes(OLD_DIRECTION_SELECT_END)) {
    src = src.replace(OLD_DIRECTION_SELECT_END, NEW_DIRECTION_SELECT_END);
    console.log('  ✅ [activity.tsx] Added Entity filter selector to toolbar');
    changed++;
  }

  writeFileSync(file, src);
  console.log(`  Activity.tsx: ${changed}/5 changes applied`);
}

// ── 2. Patch activity-association-service.ts — add 'lead' origin type ──
{
  const file = 'server/services/activity-association-service.ts';
  let src = readFileSync(file, 'utf8');

  const OLD_DEAL_CASE = `} else if (originObjectType === 'deal') {`;
  const LEAD_CASE = `} else if (originObjectType === 'lead') {
      // When an activity is logged on a lead, auto-associate with its contact/company if converted
      try {
        const { crmLeads } = await import('@shared/schema');
        const leadResults = await db
          .select({ primaryContactId: crmLeads.primaryContactId, accountId: crmLeads.accountId })
          .from(crmLeads)
          .where(and(eq(crmLeads.id, originObjectId), eq(crmLeads.orgId, orgId)));
        const lead = leadResults[0];
        if (lead?.primaryContactId) addTarget('contact', lead.primaryContactId, false);
        if (lead?.accountId) addTarget('company', lead.accountId, false);
      } catch (leadErr) {
        // Schema mismatch or table doesn't exist — non-fatal
      }
    } else if (originObjectType === 'deal') {`;

  if (src.includes(OLD_DEAL_CASE) && !src.includes("originObjectType === 'lead'")) {
    src = src.replace(OLD_DEAL_CASE, LEAD_CASE);
    console.log('  ✅ [activity-association-service.ts] Added lead origin type');
    writeFileSync(file, src);
  } else {
    console.log('  ℹ️  [activity-association-service.ts] Lead case already present or pattern not found');
  }
}

// ── 3. Patch leads.tsx — add Recent Activity mini-feed per lead ──
{
  const file = 'client/src/pages/leads.tsx';
  let src = readFileSync(file, 'utf8');
  let changed = 0;

  // Add useQuery import for activities if not present
  if (!src.includes('selectedLeadForActivity')) {
    // Add state for showing activity feed per lead
    const OLD_LEAD_STATE = `const [convertingLead, setConvertingLead] = useState<Lead | null>(null);`;
    const NEW_LEAD_STATE = `const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [selectedLeadForActivity, setSelectedLeadForActivity] = useState<string | null>(null);`;
    if (src.includes(OLD_LEAD_STATE)) {
      src = src.replace(OLD_LEAD_STATE, NEW_LEAD_STATE);
      console.log('  ✅ [leads.tsx] Added selectedLeadForActivity state');
      changed++;
    }

    // Add "View Activity" button to lead card actions
    // Find the convert button and add an activity button next to it
    const OLD_CONVERT_BTN = `<button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConvertingLead(lead);
                      setIsConversionModalOpen(true);
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    Convert
                  </button>`;
    const NEW_CONVERT_BTN = `<button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLeadForActivity(selectedLeadForActivity === lead.id ? null : lead.id);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    Activity
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConvertingLead(lead);
                      setIsConversionModalOpen(true);
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    Convert
                  </button>`;
    if (src.includes(OLD_CONVERT_BTN)) {
      src = src.replace(OLD_CONVERT_BTN, NEW_CONVERT_BTN);
      console.log('  ✅ [leads.tsx] Added Activity button to lead card');
      changed++;
    }

    // Add Activity import to leads.tsx imports
    if (!src.includes('Activity,')) {
      src = src.replace(
        'Plus, UserPlus, Search, Star, Edit, Globe, Mail, Phone, ArrowUpRight, TrendingUp, Users, Eye, MousePointer, Flame, Thermometer, Snowflake, Trash2, ArrowRightCircle',
        'Plus, UserPlus, Search, Star, Edit, Globe, Mail, Phone, ArrowUpRight, TrendingUp, Users, Eye, MousePointer, Flame, Thermometer, Snowflake, Trash2, ArrowRightCircle, Activity'
      );
      console.log('  ✅ [leads.tsx] Added Activity to imports');
      changed++;
    }
  }

  writeFileSync(file, src);
  console.log(`  leads.tsx: ${changed}/3 changes applied`);
}

console.log('\n✅ Patch 05 complete. Additional manual step:');
console.log('   Add the Activity mini-feed component below each lead card when selectedLeadForActivity === lead.id');
console.log('   Query: /api/activities?leadId={id} or /api/activities and filter client-side by lead.id');
SCRIPT

node /tmp/patch05.mjs
echo "✅ Patch 05 done"
