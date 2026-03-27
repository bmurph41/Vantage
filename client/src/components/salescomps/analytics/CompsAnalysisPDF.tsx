import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { format } from 'date-fns';

interface SalesComp {
  id: string;
  propertyName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  saleYear: number | null;
  saleMonth: number | null;
  salePrice: number | null;
  wetSlips: number | null;
  dryRacks: number | null;
  totalSlips: number | null;
  pricePerSlip: number | null;
  waterType: string | null;
  buyerName: string | null;
  sellerName: string | null;
  brokerName: string | null;
  agentName: string | null;
  coastalType: string | null;
  region: string | null;
  isPortfolio: boolean;
  capRate: number | null;
  noi: number | null;
  acres: number | null;
  occupancy: number | null;
  yearBuilt: number | null;
  bodyOfWater: string | null;
  company: string | null;
}

interface TrendsData {
  summary: {
    totalTransactions: number;
    totalVolume: number;
    earliestYear: number;
    latestYear: number;
    avgAnnualGrowth: number;
    volumeCAGR: number;
  };
  yearlyTrends: Array<{
    year: number;
    transactionCount: number;
    totalVolume: number;
    avgPrice: number;
    medianPrice: number;
    avgPricePerSlip: number;
    avgCapRate: number;
  }>;
  regionalBreakdown: Array<{
    region: string;
    transactionCount: number;
    totalVolume: number;
    avgPrice: number;
    marketShare: number;
  }>;
}

interface FilterCriteria {
  states?: string[];
  waterTypes?: string[];
  regions?: string[];
  priceMin?: number;
  priceMax?: number;
  capacityMin?: number;
  capacityMax?: number;
  yearSoldMin?: number;
  yearSoldMax?: number;
  profitCenters?: string[];
}

interface CompsAnalysisPDFProps {
  comps: SalesComp[];
  trends?: TrendsData | null;
  filterCriteria?: FilterCriteria;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
    paddingVertical: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.4,
    color: '#1f2937',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#003366',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#003366',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
  },
  dateText: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#003366',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  filterLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginRight: 4,
  },
  filterValue: {
    fontSize: 8,
    color: '#6b7280',
    marginRight: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  summaryCard: {
    width: '23%',
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#003366',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#003366',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 8,
    color: '#374151',
  },
  tableCellBold: {
    fontSize: 8,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
  },
  colProperty: { width: '14%' },
  colLocation: { width: '10%' },
  colDate: { width: '6%' },
  colPrice: { width: '10%', textAlign: 'right' as const },
  colCapRate: { width: '6%', textAlign: 'right' as const },
  colWet: { width: '5%', textAlign: 'right' as const },
  colDry: { width: '5%', textAlign: 'right' as const },
  colPerSlip: { width: '8%', textAlign: 'right' as const },
  colWaterType: { width: '7%' },
  colRegion: { width: '8%' },
  colBuyer: { width: '7%' },
  colSeller: { width: '7%' },
  colBroker: { width: '7%' },
  trendsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  trendCol: { width: '14%', textAlign: 'center' as const },
  trendColFirst: { width: '14%', textAlign: 'left' as const },
  regionalRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  regionCol: { width: '20%' },
  regionColNum: { width: '20%', textAlign: 'right' as const },
  footer: {
    position: 'absolute' as const,
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
  pageNumber: {
    fontSize: 7,
    color: '#9ca3af',
  },
});

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  const numValue = Number(value);
  return `$${numValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('en-US');
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  const numValue = Number(value);
  const displayValue = numValue > 1 ? numValue : numValue * 100;
  return `${displayValue.toFixed(2)}%`;
}

function CompsAnalysisPDFDocument({ comps, trends, filterCriteria }: CompsAnalysisPDFProps) {
  const today = format(new Date(), 'MM/dd/yyyy');
  
  const summaryStats = {
    count: comps.length,
    avgPrice: comps.reduce((sum, c) => sum + (Number(c.salePrice) || 0), 0) / comps.length || 0,
    medianCapRate: (() => {
      const rates = comps.map(c => Number(c.capRate)).filter(r => r > 0).sort((a, b) => a - b);
      if (rates.length === 0) return 0;
      const mid = Math.floor(rates.length / 2);
      return rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
    })(),
    totalCapacity: comps.reduce((sum, c) => sum + (Number(c.wetSlips) || 0) + (Number(c.dryRacks) || 0), 0),
    avgPricePerSlip: comps.reduce((sum, c) => sum + (Number(c.pricePerSlip) || 0), 0) / comps.filter(c => c.pricePerSlip).length || 0,
    totalVolume: comps.reduce((sum, c) => sum + (Number(c.salePrice) || 0), 0),
  };

  const hasFilters = filterCriteria && Object.keys(filterCriteria).some(k => {
    const val = filterCriteria[k as keyof FilterCriteria];
    return val !== undefined && val !== null && (Array.isArray(val) ? val.length > 0 : true);
  });

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Marina Sales Comps Analysis</Text>
          <Text style={styles.subtitle}>Comparative Market Analysis Report</Text>
          <Text style={styles.dateText}>Generated: {today}</Text>
        </View>

        {hasFilters && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Filter Criteria</Text>
            <View style={styles.filterRow}>
              {filterCriteria?.states && filterCriteria.states.length > 0 && (
                <>
                  <Text style={styles.filterLabel}>States:</Text>
                  <Text style={styles.filterValue}>{filterCriteria.states.join(', ')}</Text>
                </>
              )}
              {filterCriteria?.regions && filterCriteria.regions.length > 0 && (
                <>
                  <Text style={styles.filterLabel}>Regions:</Text>
                  <Text style={styles.filterValue}>{filterCriteria.regions.join(', ')}</Text>
                </>
              )}
              {filterCriteria?.waterTypes && filterCriteria.waterTypes.length > 0 && (
                <>
                  <Text style={styles.filterLabel}>Water Types:</Text>
                  <Text style={styles.filterValue}>{filterCriteria.waterTypes.join(', ')}</Text>
                </>
              )}
              {(filterCriteria?.priceMin || filterCriteria?.priceMax) && (
                <>
                  <Text style={styles.filterLabel}>Price Range:</Text>
                  <Text style={styles.filterValue}>
                    {filterCriteria.priceMin ? formatCurrency(filterCriteria.priceMin) : 'Any'} - {filterCriteria.priceMax ? formatCurrency(filterCriteria.priceMax) : 'Any'}
                  </Text>
                </>
              )}
              {(filterCriteria?.capacityMin || filterCriteria?.capacityMax) && (
                <>
                  <Text style={styles.filterLabel}>Capacity:</Text>
                  <Text style={styles.filterValue}>
                    {filterCriteria.capacityMin || 0} - {filterCriteria.capacityMax || 'Any'} slips
                  </Text>
                </>
              )}
              {(filterCriteria?.yearSoldMin || filterCriteria?.yearSoldMax) && (
                <>
                  <Text style={styles.filterLabel}>Sale Years:</Text>
                  <Text style={styles.filterValue}>
                    {filterCriteria.yearSoldMin || 'Any'} - {filterCriteria.yearSoldMax || 'Present'}
                  </Text>
                </>
              )}
              {filterCriteria?.profitCenters && filterCriteria.profitCenters.length > 0 && (
                <>
                  <Text style={styles.filterLabel}>Profit Centers:</Text>
                  <Text style={styles.filterValue}>{filterCriteria.profitCenters.join(', ')}</Text>
                </>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selection Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summaryStats.count}</Text>
              <Text style={styles.summaryLabel}>Properties</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatCurrency(summaryStats.totalVolume)}</Text>
              <Text style={styles.summaryLabel}>Total Volume</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatCurrency(summaryStats.avgPrice)}</Text>
              <Text style={styles.summaryLabel}>Avg Sale Price</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatPercent(summaryStats.medianCapRate)}</Text>
              <Text style={styles.summaryLabel}>Median Cap Rate</Text>
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatNumber(summaryStats.totalCapacity)}</Text>
              <Text style={styles.summaryLabel}>Total Capacity (Slips+Racks)</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatCurrency(summaryStats.avgPricePerSlip)}</Text>
              <Text style={styles.summaryLabel}>Avg Price Per Slip</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Comparables</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colProperty]}>Property</Text>
              <Text style={[styles.tableHeaderCell, styles.colLocation]}>Location</Text>
              <Text style={[styles.tableHeaderCell, styles.colDate]}>Date</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrice]}>Sale Price</Text>
              <Text style={[styles.tableHeaderCell, styles.colCapRate]}>Cap</Text>
              <Text style={[styles.tableHeaderCell, styles.colWet]}>Wet</Text>
              <Text style={[styles.tableHeaderCell, styles.colDry]}>Dry</Text>
              <Text style={[styles.tableHeaderCell, styles.colPerSlip]}>$/Slip</Text>
              <Text style={[styles.tableHeaderCell, styles.colWaterType]}>Water</Text>
              <Text style={[styles.tableHeaderCell, styles.colRegion]}>Region</Text>
              <Text style={[styles.tableHeaderCell, styles.colBuyer]}>Buyer</Text>
              <Text style={[styles.tableHeaderCell, styles.colSeller]}>Seller</Text>
              <Text style={[styles.tableHeaderCell, styles.colBroker]}>Broker</Text>
            </View>
            {comps.map((comp, index) => {
              const saleDate = comp.saleYear 
                ? (comp.saleMonth ? `${comp.saleMonth}/${comp.saleYear}` : `${comp.saleYear}`)
                : '-';
              const location = comp.city && comp.state 
                ? `${comp.city}, ${comp.state}` 
                : comp.city || comp.state || '-';
              return (
                <View key={comp.id} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCellBold, styles.colProperty]} numberOfLines={1}>
                    {comp.propertyName || 'Unnamed'}
                  </Text>
                  <Text style={[styles.tableCell, styles.colLocation]} numberOfLines={1}>{location}</Text>
                  <Text style={[styles.tableCell, styles.colDate]}>{saleDate}</Text>
                  <Text style={[styles.tableCellBold, styles.colPrice]}>{formatCurrency(comp.salePrice)}</Text>
                  <Text style={[styles.tableCell, styles.colCapRate]}>{formatPercent(comp.capRate)}</Text>
                  <Text style={[styles.tableCell, styles.colWet]}>{formatNumber(comp.wetSlips)}</Text>
                  <Text style={[styles.tableCell, styles.colDry]}>{formatNumber(comp.dryRacks)}</Text>
                  <Text style={[styles.tableCellBold, styles.colPerSlip]}>{formatCurrency(comp.pricePerSlip)}</Text>
                  <Text style={[styles.tableCell, styles.colWaterType]} numberOfLines={1}>{comp.waterType || '-'}</Text>
                  <Text style={[styles.tableCell, styles.colRegion]} numberOfLines={1}>{comp.region || '-'}</Text>
                  <Text style={[styles.tableCell, styles.colBuyer]} numberOfLines={1}>{comp.buyerName || comp.company || '-'}</Text>
                  <Text style={[styles.tableCell, styles.colSeller]} numberOfLines={1}>{comp.sellerName || '-'}</Text>
                  <Text style={[styles.tableCell, styles.colBroker]} numberOfLines={1}>{comp.brokerName || '-'}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>MarinaMatch Comps Analysis</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {trends && (
        <Page size="LETTER" orientation="landscape" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Market Trend Analysis</Text>
            <Text style={styles.subtitle}>Historical Performance & Regional Breakdown</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Market Overview</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{formatNumber(trends.summary.totalTransactions)}</Text>
                <Text style={styles.summaryLabel}>Total Transactions</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{formatCurrency(trends.summary.totalVolume)}</Text>
                <Text style={styles.summaryLabel}>Total Market Volume</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{formatPercent(trends.summary.avgAnnualGrowth)}</Text>
                <Text style={styles.summaryLabel}>Avg Annual Price Growth</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{formatPercent(trends.summary.volumeCAGR)}</Text>
                <Text style={styles.summaryLabel}>Volume CAGR</Text>
              </View>
            </View>
          </View>

          {trends.yearlyTrends && trends.yearlyTrends.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Yearly Performance</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.trendColFirst]}>Year</Text>
                  <Text style={[styles.tableHeaderCell, styles.trendCol]}>Transactions</Text>
                  <Text style={[styles.tableHeaderCell, styles.trendCol]}>Volume</Text>
                  <Text style={[styles.tableHeaderCell, styles.trendCol]}>Avg Price</Text>
                  <Text style={[styles.tableHeaderCell, styles.trendCol]}>Median Price</Text>
                  <Text style={[styles.tableHeaderCell, styles.trendCol]}>Avg $/Slip</Text>
                  <Text style={[styles.tableHeaderCell, styles.trendCol]}>Avg Cap Rate</Text>
                </View>
                {trends.yearlyTrends.slice(-8).map((trend, index) => (
                  <View key={trend.year} style={[styles.trendsRow, index % 2 === 1 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCellBold, styles.trendColFirst]}>{trend.year}</Text>
                    <Text style={[styles.tableCell, styles.trendCol]}>{formatNumber(trend.transactionCount)}</Text>
                    <Text style={[styles.tableCell, styles.trendCol]}>{formatCurrency(trend.totalVolume)}</Text>
                    <Text style={[styles.tableCell, styles.trendCol]}>{formatCurrency(trend.avgPrice)}</Text>
                    <Text style={[styles.tableCell, styles.trendCol]}>{formatCurrency(trend.medianPrice)}</Text>
                    <Text style={[styles.tableCell, styles.trendCol]}>{formatCurrency(trend.avgPricePerSlip)}</Text>
                    <Text style={[styles.tableCell, styles.trendCol]}>{formatPercent(trend.avgCapRate)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {trends.regionalBreakdown && trends.regionalBreakdown.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Regional Breakdown</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.regionCol]}>Region</Text>
                  <Text style={[styles.tableHeaderCell, styles.regionColNum]}>Transactions</Text>
                  <Text style={[styles.tableHeaderCell, styles.regionColNum]}>Total Volume</Text>
                  <Text style={[styles.tableHeaderCell, styles.regionColNum]}>Avg Price</Text>
                  <Text style={[styles.tableHeaderCell, styles.regionColNum]}>Market Share</Text>
                </View>
                {trends.regionalBreakdown.slice(0, 10).map((region, index) => (
                  <View key={region.region} style={[styles.regionalRow, index % 2 === 1 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCellBold, styles.regionCol]}>{region.region}</Text>
                    <Text style={[styles.tableCell, styles.regionColNum]}>{formatNumber(region.transactionCount)}</Text>
                    <Text style={[styles.tableCell, styles.regionColNum]}>{formatCurrency(region.totalVolume)}</Text>
                    <Text style={[styles.tableCell, styles.regionColNum]}>{formatCurrency(region.avgPrice)}</Text>
                    <Text style={[styles.tableCell, styles.regionColNum]}>{formatPercent(region.marketShare)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>MarinaMatch Comps Analysis</Text>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      )}
    </Document>
  );
}

export async function generateCompsAnalysisPDF(
  comps: SalesComp[], 
  trends?: TrendsData | null,
  filterCriteria?: FilterCriteria
): Promise<Blob> {
  const doc = <CompsAnalysisPDFDocument comps={comps} trends={trends} filterCriteria={filterCriteria} />;
  return await pdf(doc).toBlob();
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type { SalesComp, TrendsData, FilterCriteria };
