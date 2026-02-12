import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';

type AnalyticsData = {
  totalDeals: number;
  totalPurchasePrice: number;
  avgCapRate: number;
  avgEbitda: number;
  successRate: number;
  avgPricePerUnit: number;
  totalUnits: number;
  activeDealsValue: number;
  activeDealsCount: number;
  closedDealsThisMonth: number;
  dealVelocity: number;
  dealsByOutcome: Array<{ outcome: string; count: number }>;
  dealsByBroker: Array<{ 
    brokerId: string; 
    brokerName: string; 
    count: number; 
    totalValue: number;
    wonCount: number;
    lostCount: number;
    passedCount: number;
    winRate: number;
    avgDealSize: number;
  }>;
  dealsByRegion: Array<{ region: string; count: number; totalValue: number }>;
  dealsByState: Array<{ state: string; count: number; totalValue: number }>;
  dealsByMonth: Array<{ month: string; count: number; totalValue: number }>;
  capRateDistribution: Array<{ range: string; count: number }>;
  priceDistribution: Array<{ range: string; count: number }>;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1f2937',
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 5,
  },
  metricsGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  metricCard: {
    width: '30%',
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    border: 1,
    borderColor: '#e5e7eb',
  },
  metricLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  table: {
    display: 'flex',
    width: '100%',
    marginTop: 10,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
    borderBottom: 2,
    borderBottomColor: '#2563eb',
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    paddingHorizontal: 4,
  },
  tableCellBold: {
    flex: 1,
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTop: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  twoColumnGrid: {
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  column: {
    flex: 1,
  },
});

type Props = {
  analytics: AnalyticsData;
  filters: any;
};

export const AnalyticsPDFDocument = ({ analytics, filters }: Props) => {
  const hasActiveFilters = Object.values(filters).some(v => v);
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Modeling Projects Analytics Report</Text>
          <Text style={styles.subtitle}>
            Generated on {format(new Date(), 'MMMM d, yyyy h:mm a')}
          </Text>
          {hasActiveFilters && (
            <Text style={styles.subtitle}>Filtered results applied</Text>
          )}
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Performance Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Deals</Text>
              <Text style={styles.metricValue}>{analytics.totalDeals}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Value</Text>
              <Text style={styles.metricValue}>{formatCurrency(analytics.totalPurchasePrice)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Success Rate</Text>
              <Text style={styles.metricValue}>{formatPercent(analytics.successRate)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Avg Cap Rate</Text>
              <Text style={styles.metricValue}>{formatPercent(analytics.avgCapRate)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Avg EBITDA</Text>
              <Text style={styles.metricValue}>{formatCurrency(analytics.avgEbitda)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Avg Price/Unit</Text>
              <Text style={styles.metricValue}>{formatCurrency(analytics.avgPricePerUnit)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Units</Text>
              <Text style={styles.metricValue}>{formatNumber(analytics.totalUnits)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Active Deals</Text>
              <Text style={styles.metricValue}>{analytics.activeDealsCount}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Active Value</Text>
              <Text style={styles.metricValue}>{formatCurrency(analytics.activeDealsValue)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Closed This Month</Text>
              <Text style={styles.metricValue}>{analytics.closedDealsThisMonth}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Deal Velocity</Text>
              <Text style={styles.metricValue}>{formatNumber(analytics.dealVelocity)}/mo</Text>
            </View>
          </View>
        </View>

        {/* Deals by Outcome */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deals by Outcome</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCellBold}>Outcome</Text>
              <Text style={styles.tableCellBold}>Count</Text>
              <Text style={styles.tableCellBold}>Percentage</Text>
            </View>
            {analytics.dealsByOutcome.map((item, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.tableCell}>{item.outcome.replace('_', ' ').toUpperCase()}</Text>
                <Text style={styles.tableCell}>{item.count}</Text>
                <Text style={styles.tableCell}>
                  {analytics.totalDeals > 0 ? formatPercent((item.count / analytics.totalDeals) * 100) : '0%'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>MarinaMatch Modeling Projects Analytics • Confidential • Page 1/3</Text>
        </View>
      </Page>

      {/* Page 2: Broker Performance */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Broker Performance Analysis</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Brokers by Performance</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCellBold, { flex: 2 }]}>Broker Name</Text>
              <Text style={styles.tableCellBold}>Deals</Text>
              <Text style={[styles.tableCellBold, { flex: 1.5 }]}>Total Value</Text>
              <Text style={styles.tableCellBold}>Win Rate</Text>
              <Text style={[styles.tableCellBold, { flex: 1.5 }]}>Avg Deal Size</Text>
            </View>
            {analytics.dealsByBroker.slice(0, 15).map((broker, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{broker.brokerName}</Text>
                <Text style={styles.tableCell}>{broker.count}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{formatCurrency(broker.totalValue)}</Text>
                <Text style={styles.tableCell}>{formatPercent(broker.winRate)}</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>{formatCurrency(broker.avgDealSize)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Geographic Distribution */}
        <View style={styles.section}>
          <View style={styles.twoColumnGrid}>
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Deals by Region</Text>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={styles.tableCellBold}>Region</Text>
                  <Text style={styles.tableCellBold}>Count</Text>
                  <Text style={styles.tableCellBold}>Value</Text>
                </View>
                {analytics.dealsByRegion.slice(0, 8).map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{item.region}</Text>
                    <Text style={styles.tableCell}>{item.count}</Text>
                    <Text style={styles.tableCell}>{formatCurrency(item.totalValue)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Top States</Text>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={styles.tableCellBold}>State</Text>
                  <Text style={styles.tableCellBold}>Count</Text>
                  <Text style={styles.tableCellBold}>Value</Text>
                </View>
                {analytics.dealsByState.slice(0, 8).map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{item.state}</Text>
                    <Text style={styles.tableCell}>{item.count}</Text>
                    <Text style={styles.tableCell}>{formatCurrency(item.totalValue)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>MarinaMatch Modeling Projects Analytics • Confidential • Page 2/3</Text>
        </View>
      </Page>

      {/* Page 3: Distributions */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Deal Distribution Analysis</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.twoColumnGrid}>
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Cap Rate Distribution</Text>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={styles.tableCellBold}>Range</Text>
                  <Text style={styles.tableCellBold}>Count</Text>
                  <Text style={styles.tableCellBold}>%</Text>
                </View>
                {analytics.capRateDistribution.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{item.range}</Text>
                    <Text style={styles.tableCell}>{item.count}</Text>
                    <Text style={styles.tableCell}>
                      {analytics.totalDeals > 0 ? formatPercent((item.count / analytics.totalDeals) * 100) : '0%'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Price Distribution</Text>
              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={styles.tableCellBold}>Range</Text>
                  <Text style={styles.tableCellBold}>Count</Text>
                  <Text style={styles.tableCellBold}>%</Text>
                </View>
                {analytics.priceDistribution.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.tableCell}>{item.range}</Text>
                    <Text style={styles.tableCell}>{item.count}</Text>
                    <Text style={styles.tableCell}>
                      {analytics.totalDeals > 0 ? formatPercent((item.count / analytics.totalDeals) * 100) : '0%'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Deal Timeline */}
        {analytics.dealsByMonth.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deal Timeline (by Month)</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={styles.tableCellBold}>Month</Text>
                <Text style={styles.tableCellBold}>Deals</Text>
                <Text style={styles.tableCellBold}>Total Value</Text>
                <Text style={styles.tableCellBold}>Avg Deal Size</Text>
              </View>
              {analytics.dealsByMonth.slice(-12).map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{item.month}</Text>
                  <Text style={styles.tableCell}>{item.count}</Text>
                  <Text style={styles.tableCell}>{formatCurrency(item.totalValue)}</Text>
                  <Text style={styles.tableCell}>
                    {item.count > 0 ? formatCurrency(item.totalValue / item.count) : '$0'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text>MarinaMatch Modeling Projects Analytics • Confidential • Page 3/3</Text>
        </View>
      </Page>
    </Document>
  );
};
