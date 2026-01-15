import * as XLSX from 'xlsx';
import { db } from '../db';
import { 
  marinaSubjects, 
  compSets, 
  compSetItems, 
  rateComps, 
  salesComps,
  marinaFieldSources,
  marinaCompAuditEvents,
  type MarinaSubject,
  type CompSet,
  type CompSetItem,
  type RateComp,
  type SalesComp,
} from '@shared/schema';
import { eq, and, inArray, desc, isNull } from 'drizzle-orm';

interface ExportOptions {
  compSetId: string;
  orgId: string;
  userId: string;
}

export async function exportCompPackToExcel(options: ExportOptions): Promise<Buffer> {
  const { compSetId, orgId, userId } = options;
  
  // Get comp set
  const [compSet] = await db
    .select()
    .from(compSets)
    .where(and(eq(compSets.id, compSetId), eq(compSets.orgId, orgId)));
  
  if (!compSet) {
    throw new Error('Comp set not found');
  }
  
  // Get subject (with orgId and deletedAt filter for multi-tenant security)
  let subject: MarinaSubject | null = null;
  if (compSet.subjectId) {
    const [s] = await db
      .select()
      .from(marinaSubjects)
      .where(and(
        eq(marinaSubjects.id, compSet.subjectId),
        eq(marinaSubjects.orgId, orgId),
        isNull(marinaSubjects.deletedAt)
      ));
    subject = s || null;
  }
  
  // Get comp set items
  const items = await db
    .select()
    .from(compSetItems)
    .where(and(eq(compSetItems.compSetId, compSetId), eq(compSetItems.orgId, orgId)));
  
  // Get comps based on type (with orgId filter for multi-tenant security)
  let compsData: (RateComp | SalesComp)[] = [];
  
  if (compSet.compType === 'RATE') {
    const rateCompIds = items.filter(i => i.rateCompId).map(i => i.rateCompId!);
    if (rateCompIds.length > 0) {
      compsData = await db
        .select()
        .from(rateComps)
        .where(and(
          inArray(rateComps.id, rateCompIds),
          eq(rateComps.orgId, orgId)
        ));
    }
  } else {
    const salesCompIds = items.filter(i => i.salesCompId).map(i => i.salesCompId!);
    if (salesCompIds.length > 0) {
      compsData = await db
        .select()
        .from(salesComps)
        .where(and(
          inArray(salesComps.id, salesCompIds),
          eq(salesComps.orgId, orgId)
        ));
    }
  }
  
  // Get field sources
  const entityIds = [compSetId, ...(subject ? [subject.id] : []), ...items.map(i => i.id)];
  const sources = await db
    .select()
    .from(marinaFieldSources)
    .where(and(
      eq(marinaFieldSources.orgId, orgId),
      inArray(marinaFieldSources.entityId, entityIds)
    ));
  
  // Get audit events
  const auditEvents = await db
    .select()
    .from(marinaCompAuditEvents)
    .where(and(
      eq(marinaCompAuditEvents.compSetId, compSetId),
      eq(marinaCompAuditEvents.orgId, orgId)
    ))
    .orderBy(desc(marinaCompAuditEvents.createdAt))
    .limit(100);
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  
  // Tab 1: Summary
  const summaryData = [
    ['Marina Comp Pack Export'],
    [''],
    ['Comp Set Details'],
    ['Name', compSet.name],
    ['Type', compSet.compType],
    ['Created', compSet.createdAt?.toISOString() || ''],
    ['Last Computed', compSet.lastComputedAt?.toISOString() || 'Not computed'],
    [''],
    ['Subject Marina'],
    ['Name', subject?.name || 'N/A'],
    ['Address', subject?.address || ''],
    ['City', subject?.city || ''],
    ['State', subject?.state || ''],
    ['Slips', subject?.slipsTotal?.toString() || ''],
    ['Racks', subject?.racksTotal?.toString() || ''],
    ['Capacity Index', subject?.capacityIndex?.toString() || ''],
    [''],
    ['Indicated Values'],
  ];
  
  // Add indicated values from lastComputeResult
  const result = compSet.lastComputeResult as Record<string, unknown> | null;
  if (result) {
    if (compSet.compType === 'RATE') {
      summaryData.push(['Indicated Wet Rate', result.indicatedWetRate?.toString() || 'N/A']);
      summaryData.push(['Indicated Rack Rate', result.indicatedRackRate?.toString() || 'N/A']);
      summaryData.push(['Indicated Land Rate', result.indicatedLandRate?.toString() || 'N/A']);
    } else {
      summaryData.push(['Indicated Price/Slip', result.indicatedPricePerSlip?.toString() || 'N/A']);
      summaryData.push(['Indicated Price/Rack', result.indicatedPricePerRack?.toString() || 'N/A']);
      summaryData.push(['Indicated Price/Cap Index', result.indicatedPricePerCapacityIndex?.toString() || 'N/A']);
      summaryData.push(['Indicated Total Value', result.indicatedTotalValue?.toString() || 'N/A']);
    }
    summaryData.push(['Comps Used', result.compsUsed?.toString() || '0']);
    summaryData.push(['Computed At', result.computedAt?.toString() || '']);
  }
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Tab 2: Comps
  const compsHeader = compSet.compType === 'RATE' 
    ? ['Marina', 'City', 'State', 'Wet Slips', 'Dry Racks', 'Wet Rate', 'Rack Rate', 
       'Similarity Score', 'Weight', 'Included', 'Notes']
    : ['Marina', 'City', 'State', 'Sale Price', 'Wet Slips', 'Dry Racks', 'Price/Slip',
       'Sale Date', 'Similarity Score', 'Weight', 'Included', 'Notes'];
  
  const compsRows = items.map(item => {
    const comp = compsData.find(c => c.id === (compSet.compType === 'RATE' ? item.rateCompId : item.salesCompId));
    if (!comp) return null;
    
    if (compSet.compType === 'RATE') {
      const rc = comp as RateComp;
      return [
        rc.marina,
        rc.city || '',
        rc.state || '',
        rc.wetSlips?.toString() || '',
        rc.dryRacks?.toString() || '',
        rc.wetRateValue?.toString() || '',
        rc.rackRateValue?.toString() || '',
        item.similarityScore?.toString() || '',
        item.normalizedWeight?.toString() || '',
        item.included ? 'Yes' : 'No',
        item.notes || '',
      ];
    } else {
      const sc = comp as SalesComp;
      return [
        sc.marina,
        sc.city || '',
        sc.state || '',
        sc.salePrice?.toString() || '',
        sc.wetSlips?.toString() || '',
        sc.dryRacks?.toString() || '',
        sc.pricePerSlip?.toString() || '',
        sc.saleYear ? `${sc.saleMonth || 1}/${sc.saleYear}` : '',
        item.similarityScore?.toString() || '',
        item.normalizedWeight?.toString() || '',
        item.included ? 'Yes' : 'No',
        item.notes || '',
      ];
    }
  }).filter(Boolean);
  
  const compsSheet = XLSX.utils.aoa_to_sheet([compsHeader, ...compsRows]);
  XLSX.utils.book_append_sheet(workbook, compsSheet, 'Comps');
  
  // Tab 3: Adjustments
  const adjustmentData = [
    ['Adjustment Configuration'],
    [''],
    ['Scoring Weights'],
  ];
  
  const scoringConfig = compSet.scoringConfig as Record<string, unknown> | null;
  const weights = (scoringConfig?.weights || {}) as Record<string, number>;
  Object.entries(weights).forEach(([key, value]) => {
    adjustmentData.push([key, (value as number)?.toString() || '']);
  });
  
  adjustmentData.push(['']);
  adjustmentData.push(['Adjustment Config']);
  
  const adjustmentConfig = compSet.adjustmentConfig as Record<string, unknown> | null;
  if (adjustmentConfig) {
    Object.entries(adjustmentConfig).forEach(([key, value]) => {
      adjustmentData.push([key, JSON.stringify(value)]);
    });
  }
  
  const adjustmentSheet = XLSX.utils.aoa_to_sheet(adjustmentData);
  XLSX.utils.book_append_sheet(workbook, adjustmentSheet, 'Adjustments');
  
  // Tab 4: Sources
  const sourcesHeader = ['Entity Type', 'Entity ID', 'Field', 'Source Type', 'Source Ref', 'Confidence', 'Date'];
  const sourcesRows = sources.map(s => [
    s.entityType,
    s.entityId,
    s.fieldName,
    s.sourceType,
    s.sourceRef || '',
    s.confidence?.toString() || '',
    s.sourceDate?.toISOString() || '',
  ]);
  
  const sourcesSheet = XLSX.utils.aoa_to_sheet([sourcesHeader, ...sourcesRows]);
  XLSX.utils.book_append_sheet(workbook, sourcesSheet, 'Sources');
  
  // Tab 5: Audit
  const auditHeader = ['Event Type', 'User ID', 'Details', 'Timestamp'];
  const auditRows = auditEvents.map(e => [
    e.eventType,
    e.userId,
    JSON.stringify(e.details || {}),
    e.createdAt?.toISOString() || '',
  ]);
  
  const auditSheet = XLSX.utils.aoa_to_sheet([auditHeader, ...auditRows]);
  XLSX.utils.book_append_sheet(workbook, auditSheet, 'Audit');
  
  // Write to buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  return buffer;
}
