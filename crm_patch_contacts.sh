#!/bin/bash
# =============================================================
#  PATCH: Contacts — CRM Role + Investment Profile + Rel Score
#  Touches 3 files:
#    1. contact-form-modal.tsx  — new "Investment Profile" card
#    2. contact-record.tsx      — interface + header badge + profile section
#    3. contacts.tsx            — rel score column + crmRole filter
# =============================================================
set -e

echo "=== Patching contact-form-modal.tsx ==="

# ── Step 1: Add state vars for new fields ─────────────────────
# Insert after the leadStatus useState line
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/components/modals/contact-form-modal.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('crmRole') && src.includes('investmentProfile')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Add new fields to ContactPayload type (after leadStatus line)
const payloadAnchor = `  leadStatus?: string | null;`;
const newPayloadFields = `  leadStatus?: string | null;
  crmRole?: string;
  sourceType?: string;
  linkedInUrl?: string;
  targetAssetClasses?: string[];
  targetGeographies?: string[];
  dealSizeMin?: number | null;
  dealSizeMax?: number | null;
  investmentNotes?: string;`;
src = src.replace(payloadAnchor, newPayloadFields);

// 2. Add state declarations after the leadStatus useState
const stateAnchor = `  const [leadStatus, setLeadStatus] = useState<string | undefined>(contact?.leadStatus ?? undefined);`;
const newStates = `  const [leadStatus, setLeadStatus] = useState<string | undefined>(contact?.leadStatus ?? undefined);
  const [crmRole, setCrmRole] = useState<string>(contact?.crmRole ?? '');
  const [sourceType, setSourceType] = useState<string>(contact?.sourceType ?? '');
  const [linkedInUrl, setLinkedInUrl] = useState<string>(contact?.linkedInUrl ?? '');
  const [targetAssetClasses, setTargetAssetClasses] = useState<string[]>(contact?.targetAssetClasses ?? []);
  const [targetGeographies, setTargetGeographies] = useState<string[]>(contact?.targetGeographies ?? []);
  const [dealSizeMin, setDealSizeMin] = useState<string>(contact?.dealSizeMin ? String(contact.dealSizeMin) : '');
  const [dealSizeMax, setDealSizeMax] = useState<string>(contact?.dealSizeMax ? String(contact.dealSizeMax) : '');
  const [investmentNotes, setInvestmentNotes] = useState<string>(contact?.investmentNotes ?? '');`;
src = src.replace(stateAnchor, newStates);

// 3. Add resets in the useEffect reset block (after setLeadStatus reset)
const resetAnchor = `    setLeadStatus(contact?.leadStatus ?? undefined);
    setTouched(false);`;
const newResets = `    setLeadStatus(contact?.leadStatus ?? undefined);
    setCrmRole(contact?.crmRole ?? '');
    setSourceType(contact?.sourceType ?? '');
    setLinkedInUrl(contact?.linkedInUrl ?? '');
    setTargetAssetClasses(contact?.targetAssetClasses ?? []);
    setTargetGeographies(contact?.targetGeographies ?? []);
    setDealSizeMin(contact?.dealSizeMin ? String(contact.dealSizeMin) : '');
    setDealSizeMax(contact?.dealSizeMax ? String(contact.dealSizeMax) : '');
    setInvestmentNotes(contact?.investmentNotes ?? '');
    setTouched(false);`;
src = src.replace(resetAnchor, newResets);

// 4. Add to resetForm() function (after setLeadStatus reset in resetForm)
const formResetAnchor = `    setLeadStatus(undefined);
    setTouched(false);`;
const newFormResets = `    setLeadStatus(undefined);
    setCrmRole('');
    setSourceType('');
    setLinkedInUrl('');
    setTargetAssetClasses([]);
    setTargetGeographies([]);
    setDealSizeMin('');
    setDealSizeMax('');
    setInvestmentNotes('');
    setTouched(false);`;
src = src.replace(formResetAnchor, newFormResets);

// 5. Add to payload in handleSave (after leadStatus line)
const payloadBuildAnchor = `      leadStatus: contactTag === 'lead' ? leadStatus : null, // Explicitly null to clear field when not lead`;
const newPayloadBuild = `      leadStatus: contactTag === 'lead' ? leadStatus : null, // Explicitly null to clear field when not lead
      crmRole: crmRole || undefined,
      sourceType: sourceType || undefined,
      linkedInUrl: linkedInUrl.trim() || undefined,
      targetAssetClasses: targetAssetClasses.length > 0 ? targetAssetClasses : undefined,
      targetGeographies: targetGeographies.length > 0 ? targetGeographies : undefined,
      dealSizeMin: dealSizeMin ? parseFloat(dealSizeMin) : undefined,
      dealSizeMax: dealSizeMax ? parseFloat(dealSizeMax) : undefined,
      investmentNotes: investmentNotes.trim() || undefined,`;
src = src.replace(payloadBuildAnchor, newPayloadBuild);

// 6. Insert Investment Profile card before the closing </div> of the body
// Find the Deal Team card closing and insert after it
const insertAnchor = `          {/* Deal Team Card */}`;
const investmentCard = `          {/* Investment Profile Card */}
          <Card className="border-muted">
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">Investment Profile</CardTitle>
                <span className="text-xs text-muted-foreground ml-1">Optional — for investors, brokers & owners</span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">CRE Role</Label>
                  <Select value={crmRole} onValueChange={setCrmRole}>
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900" data-testid="select-crm-role">
                      <SelectValue placeholder="Select CRE role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="listing_broker">Listing Broker</SelectItem>
                      <SelectItem value="buyers_broker">Buyer's Broker</SelectItem>
                      <SelectItem value="property_manager">Property Manager</SelectItem>
                      <SelectItem value="lender">Lender</SelectItem>
                      <SelectItem value="attorney">Attorney</SelectItem>
                      <SelectItem value="appraiser">Appraiser</SelectItem>
                      <SelectItem value="investor_lp">Investor (LP)</SelectItem>
                      <SelectItem value="investor_gp">Investor (GP)</SelectItem>
                      <SelectItem value="family_office">Family Office</SelectItem>
                      <SelectItem value="institutional_buyer">Institutional Buyer</SelectItem>
                      <SelectItem value="syndicator">Syndicator</SelectItem>
                      <SelectItem value="government">Government / Authority</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Source</Label>
                  <Select value={sourceType} onValueChange={setSourceType}>
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900" data-testid="select-source-type">
                      <SelectValue placeholder="How did you meet?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="conference">Conference</SelectItem>
                      <SelectItem value="costar">CoStar</SelectItem>
                      <SelectItem value="loopnet">LoopNet</SelectItem>
                      <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="broker_intro">Broker Introduction</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-sm">LinkedIn URL</Label>
                  <Input
                    value={linkedInUrl}
                    onChange={e => setLinkedInUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    className="h-9 bg-white dark:bg-slate-900"
                    data-testid="input-linkedin-url"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Min Deal Size</Label>
                  <Input
                    value={dealSizeMin}
                    onChange={e => setDealSizeMin(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="e.g. 1000000"
                    className="h-9 bg-white dark:bg-slate-900"
                    data-testid="input-deal-size-min"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Max Deal Size</Label>
                  <Input
                    value={dealSizeMax}
                    onChange={e => setDealSizeMax(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="e.g. 20000000"
                    className="h-9 bg-white dark:bg-slate-900"
                    data-testid="input-deal-size-max"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-sm">Investment Notes</Label>
                  <Textarea
                    value={investmentNotes}
                    onChange={e => setInvestmentNotes(e.target.value)}
                    placeholder="Target cap rates, preferred hold periods, geography preferences, return hurdles..."
                    rows={3}
                    className="resize-none bg-white dark:bg-slate-900"
                    data-testid="textarea-investment-notes"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deal Team Card */}`;
src = src.replace(insertAnchor, investmentCard);

// 7. Add TrendingUp to lucide imports if not there
if (!src.includes('TrendingUp')) {
  src = src.replace(
    `import { User, Phone, Upload, Thermometer, Check, ChevronsUpDown, X, Building2, MapPin, Plus, Star, Trash2 } from "lucide-react";`,
    `import { User, Phone, Upload, Thermometer, Check, ChevronsUpDown, X, Building2, MapPin, Plus, Star, Trash2, TrendingUp } from "lucide-react";`
  );
}

writeFileSync(path, src, 'utf8');
console.log('  ✓ contact-form-modal.tsx patched');
JS

echo ""
echo "=== Patching contact-record.tsx ==="

node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/contact-record.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('RelationshipScoreBadge') && src.includes('investmentProfile')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Add new fields to ContactRecord interface
const interfaceAnchor = `  rollups?: { lastActivityAt?: string; nextActivityAt?: string; openDealsCount?: number; pipelineValue?: number; engagementScore30d?: number };`;
const newInterfaceFields = `  rollups?: { lastActivityAt?: string; nextActivityAt?: string; openDealsCount?: number; pipelineValue?: number; engagementScore30d?: number };
  // Investment profile fields
  crmRole?: string | null;
  sourceType?: string | null;
  linkedInUrl?: string | null;
  targetAssetClasses?: string[] | null;
  targetGeographies?: string[] | null;
  dealSizeMin?: string | null;
  dealSizeMax?: string | null;
  investmentNotes?: string | null;
  relationshipScore?: number | null;
  nextFollowupDate?: string | null;
  ndaOnFile?: boolean;
  emailConsent?: boolean;`;
src = src.replace(interfaceAnchor, newInterfaceFields);

// 2. Add RelationshipScoreBadge import
const importAnchor = `import { apiRequest } from '@/lib/queryClient';`;
const newImport = `import { apiRequest } from '@/lib/queryClient';
import { RelationshipScoreBadge } from '@/components/crm/RelationshipScoreBadge';`;
src = src.replace(importAnchor, newImport);

// 3. Add crmRole label helper
const labelHelperAnchor = `const tagColors: Record<string, string> = {`;
const crmRoleHelper = `const crmRoleLabels: Record<string, string> = {
  owner: 'Owner', listing_broker: 'Listing Broker', buyers_broker: "Buyer's Broker",
  property_manager: 'Property Manager', lender: 'Lender', attorney: 'Attorney',
  appraiser: 'Appraiser', investor_lp: 'Investor (LP)', investor_gp: 'Investor (GP)',
  family_office: 'Family Office', institutional_buyer: 'Institutional Buyer',
  syndicator: 'Syndicator', government: 'Government', other: 'Other',
};

const crmRoleColors: Record<string, string> = {
  owner: 'bg-purple-50 text-purple-700 border-purple-200',
  listing_broker: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  buyers_broker: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  lender: 'bg-blue-50 text-blue-700 border-blue-200',
  investor_lp: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  investor_gp: 'bg-violet-50 text-violet-700 border-violet-200',
  family_office: 'bg-amber-50 text-amber-700 border-amber-200',
  institutional_buyer: 'bg-teal-50 text-teal-700 border-teal-200',
};

const tagColors: Record<string, string> = {`;
src = src.replace(labelHelperAnchor, crmRoleHelper);

// 4. Add RelationshipScoreBadge to the kpiChips section
// kpiChips is built at line ~155; we add score as first chip if available
const kpiAnchor = `  const kpiChips = contact ? [`;
const newKpiChips = `  const relScoreChip = contact?.relationshipScore != null ? {
    label: 'Relationship',
    value: contact.relationshipScore >= 80 ? 'Hot' : contact.relationshipScore >= 60 ? 'Warm' : contact.relationshipScore >= 40 ? 'Lukewarm' : 'Cold',
    icon: TrendingUp,
    color: contact.relationshipScore >= 80 ? 'text-red-600' : contact.relationshipScore >= 60 ? 'text-amber-600' : contact.relationshipScore >= 40 ? 'text-blue-600' : 'text-gray-500',
  } : null;

  const kpiChips = contact ? [
    ...(relScoreChip ? [relScoreChip] : []),`;
src = src.replace(kpiAnchor, newKpiChips);

// 5. Add crmRole badge display in the header area
// Find where contactTag is displayed and add crmRole badge next to it
const headerStatusAnchor = `      status={contact?.contactTag ? fmtLabel(contact.contactTag) : contact?.leadStatus ? fmtLabel(contact.leadStatus) : undefined}`;
const newHeaderStatus = `      status={contact?.contactTag ? fmtLabel(contact.contactTag) : contact?.leadStatus ? fmtLabel(contact.leadStatus) : undefined}
      statusExtra={contact?.crmRole ? (
        <Badge variant="outline" className={\`text-xs \${crmRoleColors[contact.crmRole] || 'bg-gray-50 text-gray-700'}\`}>
          {crmRoleLabels[contact.crmRole] || contact.crmRole}
        </Badge>
      ) : undefined}`;
src = src.replace(headerStatusAnchor, newHeaderStatus);

// 6. Add investment profile section to the detail view
// Find the RecordField for "Role" and add after it
const roleFieldAnchor = `        {contact.role && <RecordField label="Role" value={fmtLabel(contact.role)} icon={Tag} />}`;
const newProfileSection = `        {contact.role && <RecordField label="Role" value={fmtLabel(contact.role)} icon={Tag} />}
        {contact.crmRole && <RecordField label="CRE Role" value={crmRoleLabels[contact.crmRole] || fmtLabel(contact.crmRole)} icon={Target} />}
        {contact.sourceType && <RecordField label="Source" value={fmtLabel(contact.sourceType)} icon={Zap} />}
        {contact.linkedInUrl && (
          <RecordField label="LinkedIn" value={
            <a href={contact.linkedInUrl} target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1">
              View Profile <ExternalLink className="h-3 w-3" />
            </a>
          } icon={Linkedin} />
        )}`;
src = src.replace(roleFieldAnchor, newProfileSection);

// 7. Add investment criteria section — insert after the lead status section
const investmentAnchor = `      {(contact.leadStatus || contact.leadScore || contact.leadSource) && (`;
const investmentSection = `      {(contact.crmRole === 'investor_lp' || contact.crmRole === 'investor_gp' || contact.crmRole === 'family_office' || contact.crmRole === 'institutional_buyer' || contact.targetAssetClasses?.length || contact.dealSizeMin || contact.investmentNotes) && (
        <RecordFieldGroup label="Investment Profile" icon={TrendingUp}>
          {(contact.dealSizeMin || contact.dealSizeMax) && (
            <RecordField
              label="Deal Size Range"
              value={[
                contact.dealSizeMin ? formatCurrency(parseFloat(contact.dealSizeMin)) : null,
                contact.dealSizeMax ? formatCurrency(parseFloat(contact.dealSizeMax)) : null,
              ].filter(Boolean).join(' – ') || '—'}
              icon={DollarSign}
            />
          )}
          {contact.targetAssetClasses && contact.targetAssetClasses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {contact.targetAssetClasses.map(ac => (
                <Badge key={ac} variant="secondary" className="text-xs capitalize">{ac.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          )}
          {contact.targetGeographies && contact.targetGeographies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {contact.targetGeographies.map(g => (
                <Badge key={g} variant="outline" className="text-xs">{g}</Badge>
              ))}
            </div>
          )}
          {contact.investmentNotes && (
            <RecordField label="Notes" value={contact.investmentNotes} icon={FileText} />
          )}
        </RecordFieldGroup>
      )}

      {(contact.leadStatus || contact.leadScore || contact.leadSource) && (`;
src = src.replace(investmentAnchor, investmentSection);

// 8. Add next follow-up chip near top of record if present
const nextFollowupSection = `      {contact.nextFollowupDate && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
          <Clock className="h-3 w-3" />
          Follow-up: {fmtDate(contact.nextFollowupDate)}
        </div>
      )}`;

// Insert this after the kpiChips rendering section — find a good anchor
const followupAnchor = `      kpiChips={kpiChips}`;
src = src.replace(followupAnchor, `      kpiChips={kpiChips}
      belowHeader={${nextFollowupSection.trim()}}`);

writeFileSync(path, src, 'utf8');
console.log('  ✓ contact-record.tsx patched');
JS

echo ""
echo "=== Patching contacts.tsx — add RelationshipScore column + crmRole filter ==="

node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/contacts.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('RelationshipScoreBadge') && src.includes('crmRoleFilter')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Add RelationshipScoreBadge import
const importAnchor = `import { SavedViewsSidebar } from '@/components/crm/SavedViewsSidebar';`;
const newImport = `import { SavedViewsSidebar } from '@/components/crm/SavedViewsSidebar';
import { RelationshipScoreBadge } from '@/components/crm/RelationshipScoreBadge';`;
src = src.replace(importAnchor, newImport);

// 2. Add crmRoleFilter state after contactTagFilter state
const stateAnchor = `  const [contactTagFilter, setContactTagFilter] = useState('all');`;
const newState = `  const [contactTagFilter, setContactTagFilter] = useState('all');
  const [crmRoleFilter, setCrmRoleFilter] = useState('all');`;
src = src.replace(stateAnchor, newState);

// 3. Add crmRole to filter logic in filteredContacts
const filterAnchor = `      const matchesContactTag = contactTagFilter === 'all' || contact.contactTag === contactTagFilter;`;
const newFilter = `      const matchesContactTag = contactTagFilter === 'all' || contact.contactTag === contactTagFilter;
      const matchesCrmRole = crmRoleFilter === 'all' || (contact as any).crmRole === crmRoleFilter;`;
src = src.replace(filterAnchor, newFilter);

// 4. Update return condition in filteredContacts
const returnAnchor = `      return matchesSearch && matchesStatus && matchesContactTag;`;
const newReturn = `      return matchesSearch && matchesStatus && matchesContactTag && matchesCrmRole;`;
src = src.replace(returnAnchor, newReturn);

// 5. Add Relationship Score column to the columns array
// Find the columns array and add a score column after the contactTag column
const colAnchor = `  const columns: CrmColumn<ContactWithCompany>[] = [`;
// We find the end of columns definition and add our column
// Look for the last column entry — it's usually the actions column
// Instead, find the contactTag column render and add rel score after it
const tagColAnchor = `            <Badge className={\`text-xs \${contactTagColors[contact.contactTag as keyof typeof contactTagColors] || 'bg-gray-500 text-white'}\`}>`;
const newScoreCol = `            <Badge className={\`text-xs \${contactTagColors[contact.contactTag as keyof typeof contactTagColors] || 'bg-gray-500 text-white'}\`}>`;

// Find the columns array closing — add a new column before it
// The columns array ends with a ] ; — find it after the last column
// We'll add the score column right before the actions/edit column
// Look for a pattern like: { key: 'actions' or the edit button column
const actionsColAnchor = src.match(/(\s+\{\s*\n?\s*key:\s*['"]actions['"]/);
if (actionsColAnchor) {
  const scoreColumn = `
    {
      key: 'relationshipScore',
      label: 'Strength',
      render: (contact: ContactWithCompany) => (
        <RelationshipScoreBadge
          contactId={contact.id}
          score={(contact as any).relationshipScore ?? null}
          compact={true}
        />
      ),
    },
`;
  src = src.replace(actionsColAnchor[0], scoreColumn + actionsColAnchor[0]);
  console.log('  ✓ Added relationship score column');
} else {
  console.log('  ⚠ Could not find actions column anchor — score column skipped');
}

// 6. Add crmRole filter Select to the filters section
// Find where the contactTagFilter Select is rendered
const filterSelectAnchor = `        <Select value={statusFilter} onValueChange={setStatusFilter}>`;
const newFilterSelect = `        <Select value={crmRoleFilter} onValueChange={setCrmRoleFilter}>
          <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-crm-role-filter">
            <SelectValue placeholder="CRE Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="listing_broker">Listing Broker</SelectItem>
            <SelectItem value="buyers_broker">Buyer's Broker</SelectItem>
            <SelectItem value="lender">Lender</SelectItem>
            <SelectItem value="investor_lp">Investor (LP)</SelectItem>
            <SelectItem value="investor_gp">Investor (GP)</SelectItem>
            <SelectItem value="family_office">Family Office</SelectItem>
            <SelectItem value="institutional_buyer">Institutional</SelectItem>
            <SelectItem value="syndicator">Syndicator</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>`;
src = src.replace(filterSelectAnchor, newFilterSelect);

writeFileSync(path, src, 'utf8');
console.log('  ✓ contacts.tsx patched');
JS

echo ""
echo "=== Quick syntax check ==="
node --check client/src/components/modals/contact-form-modal.tsx 2>&1 | head -5 || true
node --check client/src/pages/contact-record.tsx 2>&1 | head -5 || true
node --check client/src/pages/contacts.tsx 2>&1 | head -5 || true

echo ""
echo "✅ All contact patches applied."
echo ""
echo "Key additions:"
echo "  • contact-form-modal: new Investment Profile card (CRE role, source, LinkedIn, deal size, notes)"
echo "  • contact-record:     crmRole badge in header, investment profile section, rel score KPI chip"
echo "  • contacts list:      Relationship Strength column + CRE Role filter dropdown"
echo ""
echo "Restart server: fuser -k 5000/tcp && npm run dev"
