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
  coastalType: string | null;
  region: string | null;
  isPortfolio: boolean;
  capRate: number | null;
  noi: number | null;
  acres: number | null;
  occupancy: number | null;
  yearBuilt: number | null;
  bodyOfWater: string | null;
}

interface ComparisonStatistics {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgCapRate: number;
  minCapRate: number;
  maxCapRate: number;
  avgWetSlips: number;
  avgDryRacks: number;
}

interface CompsComparisonPDFProps {
  comps: SalesComp[];
  statistics: ComparisonStatistics;
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
    color: '#003366',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statCard: {
    width: '25%',
    padding: 8,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statSubtext: {
    fontSize: 7,
    color: '#9ca3af',
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#003366',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    color: '#1f2937',
  },
  propCol: { width: '20%' },
  locCol: { width: '15%' },
  priceCol: { width: '12%', textAlign: 'right' },
  slipsCol: { width: '8%', textAlign: 'right' },
  capRateCol: { width: '10%', textAlign: 'right' },
  yearCol: { width: '8%', textAlign: 'center' },
  waterCol: { width: '12%' },
  regionCol: { width: '15%' },
  compCard: {
    marginBottom: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  compName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#003366',
  },
  compPrice: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
  },
  compDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  compDetail: {
    width: '33%',
    marginBottom: 4,
  },
  compDetailLabel: {
    fontSize: 7,
    color: '#6b7280',
  },
  compDetailValue: {
    fontSize: 9,
    color: '#1f2937',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  pageNumber: {
    fontSize: 8,
    color: '#6b7280',
  },
});

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toFixed(2)}%`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
};

function CompsComparisonPDFDocument({ comps, statistics }: CompsComparisonPDFProps) {
  const generatedDate = format(new Date(), 'MMMM d, yyyy');

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Marina Sales Comparables Analysis</Text>
          <Text style={styles.subtitle}>
            Comparative Analysis of {comps.length} Properties | Generated {generatedDate}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Sale Price</Text>
              <Text style={styles.statValue}>{formatCurrency(statistics.avgPrice)}</Text>
              <Text style={styles.statSubtext}>
                Range: {formatCurrency(statistics.minPrice)} - {formatCurrency(statistics.maxPrice)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Cap Rate</Text>
              <Text style={styles.statValue}>{formatPercent(statistics.avgCapRate)}</Text>
              <Text style={styles.statSubtext}>
                Range: {formatPercent(statistics.minCapRate)} - {formatPercent(statistics.maxCapRate)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Wet Slips</Text>
              <Text style={styles.statValue}>{formatNumber(Math.round(statistics.avgWetSlips))}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Dry Racks</Text>
              <Text style={styles.statValue}>{formatNumber(Math.round(statistics.avgDryRacks))}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comparison Table</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.propCol]}>Property</Text>
              <Text style={[styles.tableHeaderCell, styles.locCol]}>Location</Text>
              <Text style={[styles.tableHeaderCell, styles.priceCol]}>Sale Price</Text>
              <Text style={[styles.tableHeaderCell, styles.slipsCol]}>Wet</Text>
              <Text style={[styles.tableHeaderCell, styles.slipsCol]}>Dry</Text>
              <Text style={[styles.tableHeaderCell, styles.priceCol]}>$/Slip</Text>
              <Text style={[styles.tableHeaderCell, styles.capRateCol]}>Cap Rate</Text>
              <Text style={[styles.tableHeaderCell, styles.yearCol]}>Year</Text>
              <Text style={[styles.tableHeaderCell, styles.waterCol]}>Water Type</Text>
            </View>
            {comps.map((comp, index) => (
              <View key={comp.id} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                <Text style={[styles.tableCellBold, styles.propCol]}>
                  {comp.propertyName || 'Unknown Property'}
                </Text>
                <Text style={[styles.tableCell, styles.locCol]}>
                  {[comp.city, comp.state].filter(Boolean).join(', ') || 'N/A'}
                </Text>
                <Text style={[styles.tableCell, styles.priceCol]}>
                  {formatCurrency(comp.salePrice)}
                </Text>
                <Text style={[styles.tableCell, styles.slipsCol]}>
                  {formatNumber(comp.wetSlips)}
                </Text>
                <Text style={[styles.tableCell, styles.slipsCol]}>
                  {formatNumber(comp.dryRacks)}
                </Text>
                <Text style={[styles.tableCell, styles.priceCol]}>
                  {formatCurrency(comp.pricePerSlip)}
                </Text>
                <Text style={[styles.tableCell, styles.capRateCol]}>
                  {formatPercent(comp.capRate)}
                </Text>
                <Text style={[styles.tableCell, styles.yearCol]}>
                  {comp.saleYear || 'N/A'}
                </Text>
                <Text style={[styles.tableCell, styles.waterCol]}>
                  {comp.waterType || 'N/A'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>MarinaMatch Comparative Analysis</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {comps.map((comp, index) => (
        <Page key={comp.id} size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>{comp.propertyName || 'Unknown Property'}</Text>
            <Text style={styles.subtitle}>
              Property {index + 1} of {comps.length} | {[comp.city, comp.state].filter(Boolean).join(', ')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Details</Text>
            <View style={styles.compDetails}>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Sale Price</Text>
                <Text style={styles.compDetailValue}>{formatCurrency(comp.salePrice)}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Sale Date</Text>
                <Text style={styles.compDetailValue}>
                  {comp.saleMonth && comp.saleYear ? `${comp.saleMonth}/${comp.saleYear}` : comp.saleYear || 'N/A'}
                </Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Cap Rate</Text>
                <Text style={styles.compDetailValue}>{formatPercent(comp.capRate)}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>NOI</Text>
                <Text style={styles.compDetailValue}>{formatCurrency(comp.noi)}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Price Per Slip</Text>
                <Text style={styles.compDetailValue}>{formatCurrency(comp.pricePerSlip)}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Occupancy</Text>
                <Text style={styles.compDetailValue}>{formatPercent(comp.occupancy)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property Details</Text>
            <View style={styles.compDetails}>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Address</Text>
                <Text style={styles.compDetailValue}>{comp.address || 'N/A'}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>City, State</Text>
                <Text style={styles.compDetailValue}>
                  {[comp.city, comp.state, comp.zipCode].filter(Boolean).join(', ') || 'N/A'}
                </Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Region</Text>
                <Text style={styles.compDetailValue}>{comp.region || 'N/A'}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Water Type</Text>
                <Text style={styles.compDetailValue}>{comp.waterType || 'N/A'}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Body of Water</Text>
                <Text style={styles.compDetailValue}>{comp.bodyOfWater || 'N/A'}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Coastal Type</Text>
                <Text style={styles.compDetailValue}>{comp.coastalType || 'N/A'}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Acreage</Text>
                <Text style={styles.compDetailValue}>{comp.acres ? `${comp.acres} acres` : 'N/A'}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Year Built</Text>
                <Text style={styles.compDetailValue}>{comp.yearBuilt || 'N/A'}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Portfolio Sale</Text>
                <Text style={styles.compDetailValue}>{comp.isPortfolio ? 'Yes' : 'No'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Capacity</Text>
            <View style={styles.compDetails}>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Wet Slips</Text>
                <Text style={styles.compDetailValue}>{formatNumber(comp.wetSlips)}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Dry Racks</Text>
                <Text style={styles.compDetailValue}>{formatNumber(comp.dryRacks)}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Total Slips</Text>
                <Text style={styles.compDetailValue}>{formatNumber(comp.totalSlips)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaction Parties</Text>
            <View style={styles.compDetails}>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Buyer</Text>
                <Text style={styles.compDetailValue}>{comp.buyerName || 'N/A'}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Seller</Text>
                <Text style={styles.compDetailValue}>{comp.sellerName || 'N/A'}</Text>
              </View>
              <View style={styles.compDetail}>
                <Text style={styles.compDetailLabel}>Broker</Text>
                <Text style={styles.compDetailValue}>{comp.brokerName || 'N/A'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>MarinaMatch Comparative Analysis</Text>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}

export async function generateCompsComparisonPDF(
  comps: SalesComp[],
  statistics: ComparisonStatistics
): Promise<Blob> {
  const doc = <CompsComparisonPDFDocument comps={comps} statistics={statistics} />;
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

export type { SalesComp, ComparisonStatistics };
