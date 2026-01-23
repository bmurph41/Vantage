import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { format } from 'date-fns';

interface RateComp {
  id: string;
  marinaName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  waterType: string | null;
  wetSlips: number | null;
  drySlips: number | null;
  totalSlips: number | null;
  avgWetRate: number | null;
  avgDryRate: number | null;
  occupancy: number | null;
  yearBuilt: number | null;
  bodyOfWater: string | null;
  region: string | null;
  hasElectric: boolean | null;
  hasWater: boolean | null;
  hasFuel: boolean | null;
  hasWifi: boolean | null;
  hasPumpout: boolean | null;
  hasShipStore: boolean | null;
  hasRepairs: boolean | null;
  hasLaundry: boolean | null;
  hasRestrooms: boolean | null;
  hasShowers: boolean | null;
  hasPool: boolean | null;
  hasRestaurant: boolean | null;
}

interface ComparisonStatistics {
  avgWetRate: number;
  minWetRate: number;
  maxWetRate: number;
  avgDryRate: number;
  minDryRate: number;
  maxDryRate: number;
  avgOccupancy: number;
  avgCapacity: number;
}

interface RateCompsComparisonPDFProps {
  comps: RateComp[];
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
    borderBottomColor: '#0ea5e9',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0369a1',
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
    color: '#0369a1',
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
    backgroundColor: '#0369a1',
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
    backgroundColor: '#f0f9ff',
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
  marinaCol: { width: '18%' },
  locCol: { width: '14%' },
  rateCol: { width: '10%', textAlign: 'right' },
  slipsCol: { width: '8%', textAlign: 'right' },
  occCol: { width: '8%', textAlign: 'right' },
  waterCol: { width: '12%' },
  amenitiesCol: { width: '22%' },
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
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  amenityBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    marginRight: 4,
    marginBottom: 2,
  },
  amenityText: {
    fontSize: 7,
    color: '#1e40af',
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
  return `${value.toFixed(1)}%`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
};

const formatRate = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  return `$${value.toFixed(2)}/ft`;
};

function getAmenities(comp: RateComp): string[] {
  const amenities: string[] = [];
  if (comp.hasElectric) amenities.push('Electric');
  if (comp.hasWater) amenities.push('Water');
  if (comp.hasFuel) amenities.push('Fuel');
  if (comp.hasWifi) amenities.push('WiFi');
  if (comp.hasPumpout) amenities.push('Pumpout');
  if (comp.hasShipStore) amenities.push('Ship Store');
  if (comp.hasRepairs) amenities.push('Repairs');
  if (comp.hasLaundry) amenities.push('Laundry');
  if (comp.hasRestrooms) amenities.push('Restrooms');
  if (comp.hasShowers) amenities.push('Showers');
  if (comp.hasPool) amenities.push('Pool');
  if (comp.hasRestaurant) amenities.push('Restaurant');
  return amenities;
}

function RateCompsComparisonPDFDocument({ comps, statistics }: RateCompsComparisonPDFProps) {
  const generatedDate = format(new Date(), 'MMMM d, yyyy');

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Marina Rate Comparables Analysis</Text>
          <Text style={styles.subtitle}>
            Comparative Analysis of {comps.length} Marinas | Generated {generatedDate}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Wet Slip Rate</Text>
              <Text style={styles.statValue}>{formatRate(statistics.avgWetRate)}</Text>
              <Text style={styles.statSubtext}>
                Range: {formatRate(statistics.minWetRate)} - {formatRate(statistics.maxWetRate)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Dry Slip Rate</Text>
              <Text style={styles.statValue}>{formatRate(statistics.avgDryRate)}</Text>
              <Text style={styles.statSubtext}>
                Range: {formatRate(statistics.minDryRate)} - {formatRate(statistics.maxDryRate)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Occupancy</Text>
              <Text style={styles.statValue}>{formatPercent(statistics.avgOccupancy)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Average Capacity</Text>
              <Text style={styles.statValue}>{formatNumber(Math.round(statistics.avgCapacity))} slips</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate Comparison Table</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.marinaCol]}>Marina</Text>
              <Text style={[styles.tableHeaderCell, styles.locCol]}>Location</Text>
              <Text style={[styles.tableHeaderCell, styles.rateCol]}>Wet Rate</Text>
              <Text style={[styles.tableHeaderCell, styles.rateCol]}>Dry Rate</Text>
              <Text style={[styles.tableHeaderCell, styles.slipsCol]}>Wet</Text>
              <Text style={[styles.tableHeaderCell, styles.slipsCol]}>Dry</Text>
              <Text style={[styles.tableHeaderCell, styles.occCol]}>Occ.</Text>
              <Text style={[styles.tableHeaderCell, styles.waterCol]}>Water Type</Text>
            </View>
            {comps.map((comp, index) => (
              <View key={comp.id} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                <Text style={[styles.tableCellBold, styles.marinaCol]}>
                  {comp.marinaName || 'Unknown Marina'}
                </Text>
                <Text style={[styles.tableCell, styles.locCol]}>
                  {[comp.city, comp.state].filter(Boolean).join(', ') || 'N/A'}
                </Text>
                <Text style={[styles.tableCell, styles.rateCol]}>
                  {formatRate(comp.avgWetRate)}
                </Text>
                <Text style={[styles.tableCell, styles.rateCol]}>
                  {formatRate(comp.avgDryRate)}
                </Text>
                <Text style={[styles.tableCell, styles.slipsCol]}>
                  {formatNumber(comp.wetSlips)}
                </Text>
                <Text style={[styles.tableCell, styles.slipsCol]}>
                  {formatNumber(comp.drySlips)}
                </Text>
                <Text style={[styles.tableCell, styles.occCol]}>
                  {formatPercent(comp.occupancy)}
                </Text>
                <Text style={[styles.tableCell, styles.waterCol]}>
                  {comp.waterType || 'N/A'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>MarinaMatch Rate Comparables Analysis</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {comps.map((comp, index) => {
        const amenities = getAmenities(comp);
        return (
          <Page key={comp.id} size="LETTER" style={styles.page}>
            <View style={styles.header}>
              <Text style={styles.title}>{comp.marinaName || 'Unknown Marina'}</Text>
              <Text style={styles.subtitle}>
                Marina {index + 1} of {comps.length} | {[comp.city, comp.state].filter(Boolean).join(', ')}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rate Information</Text>
              <View style={styles.compDetails}>
                <View style={styles.compDetail}>
                  <Text style={styles.compDetailLabel}>Wet Slip Rate (avg)</Text>
                  <Text style={styles.compDetailValue}>{formatRate(comp.avgWetRate)}</Text>
                </View>
                <View style={styles.compDetail}>
                  <Text style={styles.compDetailLabel}>Dry Slip Rate (avg)</Text>
                  <Text style={styles.compDetailValue}>{formatRate(comp.avgDryRate)}</Text>
                </View>
                <View style={styles.compDetail}>
                  <Text style={styles.compDetailLabel}>Occupancy</Text>
                  <Text style={styles.compDetailValue}>{formatPercent(comp.occupancy)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location & Details</Text>
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
                  <Text style={styles.compDetailLabel}>Year Built</Text>
                  <Text style={styles.compDetailValue}>{comp.yearBuilt || 'N/A'}</Text>
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
                  <Text style={styles.compDetailLabel}>Dry Slips</Text>
                  <Text style={styles.compDetailValue}>{formatNumber(comp.drySlips)}</Text>
                </View>
                <View style={styles.compDetail}>
                  <Text style={styles.compDetailLabel}>Total Slips</Text>
                  <Text style={styles.compDetailValue}>{formatNumber(comp.totalSlips)}</Text>
                </View>
              </View>
            </View>

            {amenities.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Amenities</Text>
                <View style={styles.amenitiesList}>
                  {amenities.map((amenity) => (
                    <View key={amenity} style={styles.amenityBadge}>
                      <Text style={styles.amenityText}>{amenity}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>MarinaMatch Rate Comparables Analysis</Text>
              <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

export async function generateRateCompsComparisonPDF(
  comps: RateComp[],
  statistics: ComparisonStatistics
): Promise<Blob> {
  const doc = <RateCompsComparisonPDFDocument comps={comps} statistics={statistics} />;
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

export type { RateComp, ComparisonStatistics };
