#!/bin/bash
# =============================================================
#  PATCH: Companies — Firm Type + AUM + Investment Profile
#  Touches 3 files:
#    1. company-form-modal.tsx  — new "Institutional Profile" card
#    2. company-record.tsx      — interface + header badge + profile section
#    3. companies.tsx           — companyType filter + AUM display
# =============================================================
set -e

echo "=== Patching company-form-modal.tsx ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/components/modals/company-form-modal.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('crmFirmType') || src.includes('institutionalProfile')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Add TrendingUp to lucide imports
src = src.replace(
  `import { Plus, X, User, Building, Star, MapPin, AlertTriangle, Check, AlertCircle } from "lucide-react";`,
  `import { Plus, X, User, Building, Star, MapPin, AlertTriangle, Check, AlertCircle, TrendingUp, Shield } from "lucide-react";`
);

// 2. Add CRE firm type options constant after companyTypes array
const firmTypeConst = `
const creFirmTypes = [
  { value: "brokerage", label: "Brokerage" },
  { value: "private_equity", label: "Private Equity / REPE" },
  { value: "family_office", label: "Family Office" },
  { value: "reit", label: "REIT" },
  { value: "owner_operator", label: "Owner-Operator" },
  { value: "debt_fund", label: "Lender / Debt Fund" },
  { value: "syndicator", label: "Syndicator" },
  { value: "property_management", label: "Property Management Co." },
  { value: "legal_title", label: "Legal / Title" },
  { value: "government", label: "Government / Authority" },
  { value: "other", label: "Other" },
];

const aumRangeOptions = [
  { value: "under_10m", label: "Under $10M" },
  { value: "10m_100m", label: "$10M – $100M" },
  { value: "100m_1b", label: "$100M – $1B" },
  { value: "over_1b", label: "Over $1B" },
];

`;
src = src.replace(
  `const contactPositionOptions = [`,
  firmTypeConst + `const contactPositionOptions = [`
);

// 3. Add state variables for new fields after isPortfolioCompany/capitalPartner state
const stateAnchor = `  // Pending relationships for new companies`;
const newStates = `  // Institutional profile fields
  const [crmFirmType, setCrmFirmType] = useState(company?.companyType ?? '');
  const [aumRange, setAumRange] = useState((company as any)?.aumRange ?? '');
  const [aumApprox, setAumApprox] = useState((company as any)?.aumApprox ? String((company as any).aumApprox) : '');
  const [investmentMandate, setInvestmentMandate] = useState((company as any)?.investmentMandate ?? '');
  const [ndaOnFile, setNdaOnFile] = useState((company as any)?.ndaOnFile ?? false);
  const [linkedInUrlField, setLinkedInUrlField] = useState(company?.linkedInUrl ?? '');
  const [targetAssetClassesStr, setTargetAssetClassesStr] = useState(
    Array.isArray((company as any)?.targetAssetClasses) ? (company as any).targetAssetClasses.join(', ') : ''
  );

  // Pending relationships for new companies`;
src = src.replace(stateAnchor, newStates);

// 4. Reset new fields in the useEffect reset block
const resetAnchor = `    setIsPortfolioCompany(company.isPortfolioCompany || false);
      setCapitalPartner(company.capitalPartner || "");`;
const newReset = `    setIsPortfolioCompany(company.isPortfolioCompany || false);
      setCapitalPartner(company.capitalPartner || "");
      setCrmFirmType(company?.companyType ?? '');
      setAumRange((company as any)?.aumRange ?? '');
      setAumApprox((company as any)?.aumApprox ? String((company as any).aumApprox) : '');
      setInvestmentMandate((company as any)?.investmentMandate ?? '');
      setNdaOnFile((company as any)?.ndaOnFile ?? false);
      setLinkedInUrlField(company?.linkedInUrl ?? '');
      setTargetAssetClassesStr(Array.isArray((company as any)?.targetAssetClasses) ? (company as any).targetAssetClasses.join(', ') : '');`;
src = src.replace(resetAnchor, newReset);

// Also reset in the else branch (new company reset)
const elseResetAnchor = `      setIsPortfolioCompany(false);
      setCapitalPartner("");
      // Reset pending relationships when creating a new company`;
const newElseReset = `      setIsPortfolioCompany(false);
      setCapitalPartner("");
      setCrmFirmType('');
      setAumRange('');
      setAumApprox('');
      setInvestmentMandate('');
      setNdaOnFile(false);
      setLinkedInUrlField('');
      setTargetAssetClassesStr('');
      // Reset pending relationships when creating a new company`;
src = src.replace(elseResetAnchor, newElseReset);

// 5. Add new fields to createCompanyMutation cleanData
const createCleanAnchor = `        isPortfolioCompany,
        capitalPartner: isPortfolioCompany ? capitalPartner.trim() || undefined : undefined,`;
const newCreateClean = `        isPortfolioCompany,
        capitalPartner: isPortfolioCompany ? capitalPartner.trim() || undefined : undefined,
        companyType: crmFirmType || undefined,
        aumRange: aumRange || undefined,
        aumApprox: aumApprox ? parseFloat(aumApprox) : undefined,
        investmentMandate: investmentMandate.trim() || undefined,
        ndaOnFile,
        linkedInUrl: linkedInUrlField.trim() || undefined,
        targetAssetClasses: targetAssetClassesStr.trim()
          ? targetAssetClassesStr.split(',').map(s => s.trim()).filter(Boolean)
          : undefined,`;
src = src.replace(createCleanAnchor, newCreateClean);

// Also for updateCompanyMutation
const updateCleanAnchor = `        isPortfolioCompany,
        capitalPartner: isPortfolioCompany ? capitalPartner.trim() || null : null,`;
const newUpdateClean = `        isPortfolioCompany,
        capitalPartner: isPortfolioCompany ? capitalPartner.trim() || null : null,
        companyType: crmFirmType || null,
        aumRange: aumRange || null,
        aumApprox: aumApprox ? parseFloat(aumApprox) : null,
        investmentMandate: investmentMandate.trim() || null,
        ndaOnFile,
        linkedInUrl: linkedInUrlField.trim() || null,
        targetAssetClasses: targetAssetClassesStr.trim()
          ? targetAssetClassesStr.split(',').map(s => s.trim()).filter(Boolean)
          : [],`;
src = src.replace(updateCleanAnchor, newUpdateClean);

// 6. Insert Institutional Profile card before the Portfolio Company card
const insertAnchor = `                {/* Portfolio Company Section */}`;
const institutionalCard = `                {/* Institutional Profile Card */}
                <Card className="border-blue-100 dark:border-blue-900">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      Institutional Profile
                      <span className="text-xs font-normal text-muted-foreground">Optional — for investors, funds & brokerages</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm">CRE Firm Type</Label>
                        <Select value={crmFirmType} onValueChange={setCrmFirmType}>
                          <SelectTrigger className="h-9 bg-white dark:bg-slate-900" data-testid="select-cre-firm-type">
                            <SelectValue placeholder="Select firm type" />
                          </SelectTrigger>
                          <SelectContent>
                            {creFirmTypes.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">AUM Range</Label>
                        <Select value={aumRange} onValueChange={setAumRange}>
                          <SelectTrigger className="h-9 bg-white dark:bg-slate-900" data-testid="select-aum-range">
                            <SelectValue placeholder="Select AUM range" />
                          </SelectTrigger>
                          <SelectContent>
                            {aumRangeOptions.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">AUM (approximate $)</Label>
                        <Input
                          value={aumApprox}
                          onChange={e => setAumApprox(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="e.g. 250000000"
                          className="h-9 bg-white dark:bg-slate-900"
                          data-testid="input-aum-approx"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">LinkedIn URL</Label>
                        <Input
                          value={linkedInUrlField}
                          onChange={e => setLinkedInUrlField(e.target.value)}
                          placeholder="https://linkedin.com/company/..."
                          className="h-9 bg-white dark:bg-slate-900"
                          data-testid="input-company-linkedin"
                        />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-sm">Target Asset Classes</Label>
                        <Input
                          value={targetAssetClassesStr}
                          onChange={e => setTargetAssetClassesStr(e.target.value)}
                          placeholder="e.g. marina, multifamily, self_storage (comma-separated)"
                          className="h-9 bg-white dark:bg-slate-900"
                          data-testid="input-target-asset-classes"
                        />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-sm">Investment Mandate</Label>
                        <Textarea
                          value={investmentMandate}
                          onChange={e => setInvestmentMandate(e.target.value)}
                          placeholder="Target returns, hold periods, geography, deal size requirements..."
                          rows={2}
                          className="resize-none bg-white dark:bg-slate-900"
                          data-testid="textarea-investment-mandate"
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <Checkbox
                          id="ndaOnFile"
                          checked={ndaOnFile}
                          onCheckedChange={v => setNdaOnFile(v === true)}
                          data-testid="checkbox-nda-on-file"
                        />
                        <Label htmlFor="ndaOnFile" className="text-sm cursor-pointer flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-green-600" />
                          NDA on file
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Portfolio Company Section */}`;
src = src.replace(insertAnchor, institutionalCard);

writeFileSync(path, src, 'utf8');
console.log('  ✓ company-form-modal.tsx patched');
JS

echo ""
echo "=== Patching company-record.tsx ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/company-record.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('crmFirmTypeLabels') || src.includes('companyType?: string')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Add new fields to CompanyRecord interface
const interfaceAnchor = `  rollups?: { lastActivityAt?: string; nextActivityAt?: string; openDealsCount?: number; pipelineValue?: number; engagementScore30d?: number };`;
const newFields = `  rollups?: { lastActivityAt?: string; nextActivityAt?: string; openDealsCount?: number; pipelineValue?: number; engagementScore30d?: number };
  // Institutional profile
  companyType?: string | null;
  aumRange?: string | null;
  aumApprox?: string | null;
  investmentMandate?: string | null;
  ndaOnFile?: boolean;
  ndaExpiryDate?: string | null;
  targetAssetClasses?: string[] | null;`;
src = src.replace(interfaceAnchor, newFields);

// 2. Add firm type label maps after industryColors
const colorMapAnchor = `const stageColors: Record<string, string> = {`;
const firmTypeMaps = `const crmFirmTypeLabels: Record<string, string> = {
  brokerage: 'Brokerage',
  private_equity: 'Private Equity',
  family_office: 'Family Office',
  reit: 'REIT',
  owner_operator: 'Owner-Operator',
  debt_fund: 'Lender / Debt Fund',
  syndicator: 'Syndicator',
  property_management: 'Property Mgmt',
  legal_title: 'Legal / Title',
  government: 'Government',
  other: 'Other',
};

const aumRangeLabels: Record<string, string> = {
  under_10m: 'Under $10M',
  '10m_100m': '$10M–$100M',
  '100m_1b': '$100M–$1B',
  over_1b: 'Over $1B',
};

const stageColors: Record<string, string> = {`;
src = src.replace(colorMapAnchor, firmTypeMaps);

// 3. Add companyType badge to header — after status/statusColor props
// The header renders: status={company?.industry ? ...} statusColor={...}
const headerAnchor = `      statusColor={company?.industry ? industryColors[company.industry.toLowerCase()] || 'bg-gray-100 text-gray-700' : undefined}`;
const newHeaderProps = `      statusColor={company?.industry ? industryColors[company.industry.toLowerCase()] || 'bg-gray-100 text-gray-700' : undefined}
      statusExtra={company?.companyType ? (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
          {crmFirmTypeLabels[company.companyType] || company.companyType}
        </Badge>
      ) : undefined}
      ndaBadge={company?.ndaOnFile ? (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 gap-1">
          <ShieldCheck className="h-3 w-3" />NDA
        </Badge>
      ) : undefined}`;
src = src.replace(headerAnchor, newHeaderProps);

// 4. Add institutional profile section in CompanyAboutSidebar
// Find where the portfolio section ends and add after it
const sidebarAnchor = `      {(company.isPortfolioCompany || company.portfolioCount) && (`;
const newSidebarSection = `      {/* Institutional Profile */}
      {(company.companyType || company.aumRange || company.investmentMandate || company.targetAssetClasses?.length) && (
        <RecordFieldGroup label="Institutional Profile" icon={TrendingUp}>
          {company.companyType && (
            <RecordField
              label="Firm Type"
              value={crmFirmTypeLabels[company.companyType] || company.companyType}
              icon={Building2}
            />
          )}
          {(company.aumRange || company.aumApprox) && (
            <RecordField
              label="AUM"
              value={[
                company.aumRange ? aumRangeLabels[company.aumRange] || company.aumRange : null,
                company.aumApprox ? formatCurrency(company.aumApprox) : null,
              ].filter(Boolean).join(' · ') || '—'}
              icon={DollarSign}
            />
          )}
          {company.targetAssetClasses && company.targetAssetClasses.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {company.targetAssetClasses.map(ac => (
                <Badge key={ac} variant="secondary" className="text-[10px] capitalize">{ac.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          )}
          {company.investmentMandate && (
            <RecordField label="Mandate" value={company.investmentMandate} icon={FileText} />
          )}
          {company.ndaOnFile && (
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs text-green-700 font-medium">NDA on file</span>
              {company.ndaExpiryDate && (
                <span className="text-xs text-muted-foreground">· expires {company.ndaExpiryDate}</span>
              )}
            </div>
          )}
        </RecordFieldGroup>
      )}

      {(company.isPortfolioCompany || company.portfolioCount) && (`;
src = src.replace(sidebarAnchor, newSidebarSection);

writeFileSync(path, src, 'utf8');
console.log('  ✓ company-record.tsx patched');
JS

echo ""
echo "=== Patching companies.tsx — add companyType filter ==="
node --input-type=module << 'JS'
import { readFileSync, writeFileSync } from 'fs';
const path = 'client/src/pages/companies.tsx';
let src = readFileSync(path, 'utf8');

if (src.includes('firmTypeFilter') || src.includes('crmFirmType')) {
  console.log('  ✓ Already patched'); process.exit(0);
}

// 1. Add firmTypeFilter state after industryFilter
src = src.replace(
  `const [industryFilter, setIndustryFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');`,
  `const [industryFilter, setIndustryFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [firmTypeFilter, setFirmTypeFilter] = useState('all');`
);

// 2. Add to filter reset in view apply
src = src.replace(
  `setIndustryFilter('all');
      setSizeFilter('all');`,
  `setIndustryFilter('all');
      setSizeFilter('all');
      setFirmTypeFilter('all');`
);

// 3. Add firmType to filteredCompanies
src = src.replace(
  `const matchesSize = sizeFilter === 'all' || companySize === sizeFilter;`,
  `const matchesSize = sizeFilter === 'all' || companySize === sizeFilter;
      const matchesFirmType = firmTypeFilter === 'all' || (company as any).companyType === firmTypeFilter;`
);

// 4. Update return condition
src = src.replace(
  `return matchesSearch && matchesIndustry && matchesSize;`,
  `return matchesSearch && matchesIndustry && matchesSize && matchesFirmType;`
);

// 5. Add firm type column — find where industry badge is rendered and add companyType alongside it
const industryColAnchor = `      sortValue: (company) => company.industry || null,
      render: (company) => company.industry ? (
        <Badge className={industryColors[company.industry] || industryColors[getIndustryCategory(company.industry)] || 'bg-gray-100 text-gray-800'}>
          {formatRole(company.industry)}
        </Badge>`;
const newIndustryCol = `      sortValue: (company) => company.industry || null,
      render: (company) => (
        <div className="flex flex-col gap-1">
          {company.industry && (
            <Badge className={industryColors[company.industry] || industryColors[getIndustryCategory(company.industry)] || 'bg-gray-100 text-gray-800'}>
              {formatRole(company.industry)}
            </Badge>
          )}
          {(company as any).companyType && (
            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 w-fit">
              {(company as any).companyType.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>`;
src = src.replace(industryColAnchor, newIndustryCol);

// 6. Add firm type filter Select — find where industryFilter Select is and add before it
// Look for the industry Select filter
const filterAnchor = src.indexOf('<Select value={industryFilter}');
if (filterAnchor !== -1) {
  const firmTypeFilter = `<Select value={firmTypeFilter} onValueChange={setFirmTypeFilter}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Firm Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Firm Types</SelectItem>
            <SelectItem value="brokerage">Brokerage</SelectItem>
            <SelectItem value="private_equity">Private Equity</SelectItem>
            <SelectItem value="family_office">Family Office</SelectItem>
            <SelectItem value="reit">REIT</SelectItem>
            <SelectItem value="owner_operator">Owner-Operator</SelectItem>
            <SelectItem value="debt_fund">Lender / Debt Fund</SelectItem>
            <SelectItem value="syndicator">Syndicator</SelectItem>
            <SelectItem value="property_management">Property Mgmt</SelectItem>
          </SelectContent>
        </Select>
        `;
  src = src.slice(0, filterAnchor) + firmTypeFilter + src.slice(filterAnchor);
  console.log('  ✓ Added firm type filter');
} else {
  console.log('  ⚠ Could not find industry filter anchor — skipping filter UI');
}

writeFileSync(path, src, 'utf8');
console.log('  ✓ companies.tsx patched');
JS

echo ""
echo "=== Syntax check ==="
node --check client/src/pages/company-record.tsx 2>&1 | head -5 || true
node --check client/src/pages/companies.tsx 2>&1 | head -5 || true

echo ""
echo "✅ Companies patches applied."
echo ""
echo "What was added:"
echo "  • company-form-modal: Institutional Profile card"
echo "    — CRE Firm Type (Brokerage/REPE/Family Office/REIT/etc.)"
echo "    — AUM Range + AUM amount"
echo "    — LinkedIn URL"
echo "    — Target Asset Classes (comma-separated)"
echo "    — Investment Mandate textarea"
echo "    — NDA on file checkbox"
echo ""
echo "  • company-record: Institutional Profile section in sidebar"
echo "    — Firm Type badge in header alongside industry"
echo "    — NDA badge in header when on file"
echo "    — AUM, mandate, asset classes in sidebar"
echo ""
echo "  • companies list:"
echo "    — Firm Type filter dropdown"
echo "    — CRE firm type shown as secondary badge on industry column"
echo ""
echo "Restart server: pkill -f 'tsx server' && npm run dev"
