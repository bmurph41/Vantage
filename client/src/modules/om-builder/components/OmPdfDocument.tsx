import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { OmPage, OmBlock, OmTheme, OmDocumentDimension } from '../types';
import { OM_DIMENSION_SIZES } from '../types';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  pageHeader: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 20,
    right: 40,
    color: '#64748b',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#0f172a',
  },
  subheading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1e293b',
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: 10,
  },
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  kpiCard: {
    width: '23%',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  kpiCardTeal: {
    width: '23%',
    backgroundColor: '#f0fdfa',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  kpiCardGreen: {
    width: '23%',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  kpiCardBlue: {
    width: '23%',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  kpiCardOrange: {
    width: '23%',
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
  },
  table: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableRowEven: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tableCell: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    color: '#334155',
  },
  tableCellHeader: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  sectionBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionBoxTeal: {
    backgroundColor: '#f0fdfa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#5eead4',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f766e',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    color: '#64748b',
  },
  value: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginVertical: 16,
  },
  callout: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  calloutText: {
    fontSize: 10,
    color: '#1e40af',
    lineHeight: 1.5,
  },
});

const safeFormatCurrency = (value: number | string | undefined | null): string => {
  if (value === undefined || value === null) return '$0';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num)) return '$0';
  return formatCurrency(num);
};

const safeFormatPercent = (value: number | string | undefined | null): string => {
  if (value === undefined || value === null) return '0.0%';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num)) return '0.0%';
  return formatPercent(num);
};

function renderBlock(block: OmBlock): JSX.Element | null {
  switch (block.type) {
    case 'heading':
      return (
        <Text style={styles.heading}>{block.content?.text || 'Section Title'}</Text>
      );
    
    case 'text':
      return (
        <Text style={styles.text}>{block.content?.markdown || ''}</Text>
      );
    
    case 'callout':
      return (
        <View style={styles.callout}>
          <Text style={styles.calloutText}>{block.content?.text || ''}</Text>
        </View>
      );
    
    case 'divider':
      return <View style={styles.divider} />;
    
    case 'heroKpiGrid':
      const items = block.content?.items || [];
      const kpiStyles = [styles.kpiCardTeal, styles.kpiCardGreen, styles.kpiCardBlue, styles.kpiCardOrange];
      return (
        <View style={styles.kpiGrid}>
          {items.slice(0, 4).map((item: any, index: number) => (
            <View key={index} style={kpiStyles[index] || styles.kpiCard}>
              <Text style={styles.kpiValue}>{item.value || '$0'}</Text>
              <Text style={styles.kpiLabel}>{item.label || 'Metric'}</Text>
            </View>
          ))}
        </View>
      );
    
    case 'executiveSummary':
      return (
        <View style={styles.sectionBox}>
          <Text style={styles.subheading}>Investment Thesis</Text>
          <Text style={styles.text}>{block.content?.investmentThesis || ''}</Text>
          <Text style={styles.subheading}>Property Description</Text>
          <Text style={styles.text}>{block.content?.propertyDescription || ''}</Text>
        </View>
      );
    
    case 'financialAnalysis':
      const metrics = block.content?.metrics || [];
      return (
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>{block.content?.title || 'Financial Analysis'}</Text>
          {metrics.map((m: any, i: number) => (
            <View key={i} style={styles.row}>
              <Text style={styles.label}>{m.label}</Text>
              <Text style={styles.value}>{m.value || '—'}</Text>
            </View>
          ))}
        </View>
      );
    
    case 'operatingAnalysis':
      const opItems = block.content?.items || [];
      return (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellHeader}>Item</Text>
            <Text style={styles.tableCellHeader}>Amount</Text>
            <Text style={styles.tableCellHeader}>% of GOI</Text>
          </View>
          {opItems.map((item: any, i: number) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowEven}>
              <Text style={styles.tableCell}>{item.label || ''}</Text>
              <Text style={styles.tableCell}>{safeFormatCurrency(item.value)}</Text>
              <Text style={styles.tableCell}>{safeFormatPercent(item.percentOfGoi)}</Text>
            </View>
          ))}
        </View>
      );
    
    case 'financingOverview':
      return (
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Financing Overview</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Loan Amount</Text>
            <Text style={styles.value}>{safeFormatCurrency(block.content?.loanAmount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Down Payment</Text>
            <Text style={styles.value}>{safeFormatCurrency(block.content?.downPayment)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>LTV</Text>
            <Text style={styles.value}>{safeFormatPercent(block.content?.ltv)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Interest Rate</Text>
            <Text style={styles.value}>{safeFormatPercent(block.content?.interestRate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Monthly Payment</Text>
            <Text style={styles.value}>{safeFormatCurrency(block.content?.monthlyPayment)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>DCR</Text>
            <Text style={styles.value}>{block.content?.dcr?.toFixed(2) || '—'}</Text>
          </View>
        </View>
      );
    
    case 'cashFlowForecast':
      const years = block.content?.years || [];
      return (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellHeader}>Year</Text>
            <Text style={styles.tableCellHeader}>GOI</Text>
            <Text style={styles.tableCellHeader}>Expenses</Text>
            <Text style={styles.tableCellHeader}>NOI</Text>
            <Text style={styles.tableCellHeader}>CFBT</Text>
          </View>
          {years.map((yr: any, i: number) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowEven}>
              <Text style={styles.tableCell}>{yr.year || i + 1}</Text>
              <Text style={styles.tableCell}>{safeFormatCurrency(yr.goi)}</Text>
              <Text style={styles.tableCell}>{safeFormatCurrency(yr.expenses)}</Text>
              <Text style={styles.tableCell}>{safeFormatCurrency(yr.noi)}</Text>
              <Text style={styles.tableCell}>{safeFormatCurrency(yr.cfbt)}</Text>
            </View>
          ))}
        </View>
      );
    
    case 'marinaKpis':
      return (
        <View style={styles.sectionBoxTeal}>
          <Text style={styles.sectionTitle}>Marina Performance</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Slip Occupancy</Text>
            <Text style={styles.value}>{safeFormatPercent(block.content?.slipOccupancy)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Revenue Per Slip</Text>
            <Text style={styles.value}>{safeFormatCurrency(block.content?.revps)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Wet Slips</Text>
            <Text style={styles.value}>{block.content?.wetSlips || 0}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Dry Storage</Text>
            <Text style={styles.value}>{block.content?.dryStorage || 0}</Text>
          </View>
        </View>
      );
    
    case 'financialBreakdown':
      return (
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Financial Breakdown</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Purchase Price</Text>
            <Text style={styles.value}>{safeFormatCurrency(block.content?.purchasePrice)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Closing Costs</Text>
            <Text style={styles.value}>{safeFormatCurrency(block.content?.closingCosts)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Loan Amount</Text>
            <Text style={styles.value}>{safeFormatCurrency(block.content?.loanAmount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Down Payment</Text>
            <Text style={styles.value}>{safeFormatCurrency(block.content?.downPayment)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total Equity Required</Text>
            <Text style={styles.value}>{safeFormatCurrency(block.content?.totalEquityRequired)}</Text>
          </View>
        </View>
      );
    
    case 'investmentReturns':
      return (
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Investment Returns</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cash on Cash Return</Text>
            <Text style={styles.value}>{safeFormatPercent(block.content?.cashOnCash)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>ROI</Text>
            <Text style={styles.value}>{safeFormatPercent(block.content?.roi)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cap Rate</Text>
            <Text style={styles.value}>{safeFormatPercent(block.content?.capRate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>GRM</Text>
            <Text style={styles.value}>{(block.content?.grm || 0).toFixed(2)}x</Text>
          </View>
        </View>
      );
    
    case 'kpi':
      const kpiItems = block.content?.items || [];
      return (
        <View style={styles.kpiGrid}>
          {kpiItems.map((item: any, index: number) => (
            <View key={index} style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{item.value || '$0'}</Text>
              <Text style={styles.kpiLabel}>{item.label || 'Metric'}</Text>
            </View>
          ))}
        </View>
      );

    case 'gauge':
    case 'target-kpi':
    case 'currency-kpi':
    case 'percent-kpi':
    case 'number-kpi':
      return (
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{block.content?.value || block.content?.current || '—'}</Text>
          <Text style={styles.kpiLabel}>{block.content?.label || block.content?.title || 'Metric'}</Text>
          {block.content?.target && (
            <Text style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>Target: {block.content.target}</Text>
          )}
        </View>
      );

    case 'chart':
    case 'line-chart':
    case 'pie-chart':
    case 'area-chart':
    case 'trend-chart':
    case 'combo-chart':
      return (
        <View style={{ ...styles.sectionBox, alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
          <Text style={styles.sectionTitle}>{block.content?.title || 'Chart'}</Text>
          <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
            [Chart visualization - see interactive version for full details]
          </Text>
          {block.content?.data && Array.isArray(block.content.data) && block.content.data.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {block.content.data.slice(0, 5).map((item: any, i: number) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.label}>{item.name || item.label || `Item ${i + 1}`}</Text>
                  <Text style={styles.value}>{item.value || '—'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      );

    case 'table':
      const tableData = block.content?.rows || block.content?.data || [];
      const tableHeaders = block.content?.headers || block.content?.columns || [];
      return (
        <View style={styles.table}>
          {tableHeaders.length > 0 && (
            <View style={styles.tableHeader}>
              {tableHeaders.map((h: any, i: number) => (
                <Text key={i} style={styles.tableCellHeader}>{typeof h === 'string' ? h : h.label || h.header || ''}</Text>
              ))}
            </View>
          )}
          {tableData.map((row: any, i: number) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowEven}>
              {Array.isArray(row) ? (
                row.map((cell: any, j: number) => (
                  <Text key={j} style={styles.tableCell}>{String(cell)}</Text>
                ))
              ) : typeof row === 'object' ? (
                Object.values(row).map((cell: any, j: number) => (
                  <Text key={j} style={styles.tableCell}>{String(cell)}</Text>
                ))
              ) : (
                <Text style={styles.tableCell}>{String(row)}</Text>
              )}
            </View>
          ))}
        </View>
      );

    case 'matrix':
      const matrixData = block.content?.data || [];
      return (
        <View style={styles.table}>
          {matrixData.map((row: any[], i: number) => (
            <View key={i} style={i === 0 ? styles.tableHeader : (i % 2 === 0 ? styles.tableRow : styles.tableRowEven)}>
              {row.map((cell: any, j: number) => (
                <Text key={j} style={i === 0 ? styles.tableCellHeader : styles.tableCell}>{String(cell)}</Text>
              ))}
            </View>
          ))}
        </View>
      );

    case 'list':
      const listItems = block.content?.items || [];
      return (
        <View style={{ marginBottom: 16 }}>
          {listItems.map((item: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ fontSize: 10, color: '#64748b', marginRight: 8 }}>{block.content?.ordered ? `${i + 1}.` : '•'}</Text>
              <Text style={{ fontSize: 10, color: '#334155', flex: 1 }}>{typeof item === 'string' ? item : item.text || item.label || ''}</Text>
            </View>
          ))}
        </View>
      );

    case 'image':
    case 'gallery':
      return (
        <View style={{ ...styles.sectionBox, alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 10, color: '#94a3b8' }}>[Image: {block.content?.alt || block.content?.caption || 'Visual content'}]</Text>
          {block.content?.caption && (
            <Text style={{ fontSize: 9, color: '#64748b', marginTop: 4, textAlign: 'center' }}>{block.content.caption}</Text>
          )}
        </View>
      );

    case 'map':
    case 'mapPage':
      return (
        <View style={{ ...styles.sectionBox, alignItems: 'center', padding: 24 }}>
          <Text style={styles.sectionTitle}>{block.content?.title || 'Location Map'}</Text>
          <Text style={{ fontSize: 10, color: '#94a3b8 ' }}>[Map visualization - see interactive version]</Text>
          {block.content?.address && (
            <Text style={{ fontSize: 10, color: '#334155', marginTop: 8 }}>{block.content.address}</Text>
          )}
          {(block.content?.lat && block.content?.lng) && (
            <Text style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>
              Coordinates: {block.content.lat?.toFixed(4)}, {block.content.lng?.toFixed(4)}
            </Text>
          )}
        </View>
      );

    case 'spacer':
      const height = block.content?.height || block.style?.height || 24;
      return <View style={{ height: typeof height === 'number' ? height : 24 }} />;

    case 'shape':
      return (
        <View style={{ 
          backgroundColor: block.style?.backgroundColor || '#e2e8f0',
          width: block.position?.width || 100,
          height: block.position?.height || 50,
          borderRadius: block.content?.shapeType === 'circle' ? 999 : 4,
          marginBottom: 12 
        }} />
      );

    case 'icon':
      return (
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 10, color: '#64748b' }}>[Icon: {block.content?.iconName || 'icon'}]</Text>
        </View>
      );

    case 'group':
      const groupBlocks = block.content?.blocks || [];
      return (
        <View style={{ marginBottom: 16 }}>
          {groupBlocks.map((childBlock: OmBlock) => (
            <View key={childBlock.id}>{renderBlock(childBlock)}</View>
          ))}
        </View>
      );

    case 'metricStrip':
      const stripItems = block.content?.metrics || block.content?.items || [];
      return (
        <View style={{ ...styles.kpiGrid, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 }}>
          {stripItems.map((item: any, i: number) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>{item.value || '—'}</Text>
              <Text style={{ fontSize: 8, color: '#64748b' }}>{item.label || ''}</Text>
            </View>
          ))}
        </View>
      );

    case 'imageGrid':
      const images = block.content?.images || [];
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
          {images.map((img: any, i: number) => (
            <View key={i} style={{ width: '48%', margin: '1%', backgroundColor: '#f1f5f9', padding: 16, alignItems: 'center', borderRadius: 4 }}>
              <Text style={{ fontSize: 9, color: '#94a3b8' }}>[Image {i + 1}]</Text>
              {img.caption && <Text style={{ fontSize: 8, color: '#64748b', marginTop: 4 }}>{img.caption}</Text>}
            </View>
          ))}
        </View>
      );

    case 'sectionDivider':
      return (
        <View style={{ borderBottomWidth: 2, borderBottomColor: '#0d7377', marginVertical: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0d7377' }}>{block.content?.title || 'Section'}</Text>
          {block.content?.subtitle && (
            <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{block.content.subtitle}</Text>
          )}
        </View>
      );

    case 'teamGrid':
      const members = block.content?.members || [];
      return (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>{block.content?.title || 'Team'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {members.map((member: any, i: number) => (
              <View key={i} style={{ width: '30%', margin: '1.5%', padding: 8, backgroundColor: '#f8fafc', borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#0f172a' }}>{member.name || 'Team Member'}</Text>
                <Text style={{ fontSize: 9, color: '#64748b' }}>{member.role || member.title || ''}</Text>
              </View>
            ))}
          </View>
        </View>
      );

    case 'disclaimer':
      return (
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 4, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}>
          <Text style={{ fontSize: 8, color: '#92400e', lineHeight: 1.4 }}>
            {block.content?.text || 'This document is for informational purposes only and does not constitute an offer to sell or a solicitation of an offer to buy any securities.'}
          </Text>
        </View>
      );

    case 'portfolioTable':
      const portfolioData = block.content?.properties || block.content?.assets || [];
      return (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableCellHeader}>Property</Text>
            <Text style={styles.tableCellHeader}>Location</Text>
            <Text style={styles.tableCellHeader}>Units/Slips</Text>
            <Text style={styles.tableCellHeader}>Value</Text>
          </View>
          {portfolioData.map((prop: any, i: number) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowEven}>
              <Text style={styles.tableCell}>{prop.name || prop.propertyName || ''}</Text>
              <Text style={styles.tableCell}>{prop.location || prop.city || ''}</Text>
              <Text style={styles.tableCell}>{prop.units || prop.slips || '—'}</Text>
              <Text style={styles.tableCell}>{safeFormatCurrency(prop.value || prop.price)}</Text>
            </View>
          ))}
        </View>
      );
    
    default:
      if (block.content?.text || block.content?.markdown) {
        return <Text style={styles.text}>{block.content?.text || block.content?.markdown}</Text>;
      }
      return null;
  }
}

interface OmPdfDocumentProps {
  pages: OmPage[];
  documentName: string;
  theme?: OmTheme | null;
  dimension?: OmDocumentDimension;
  includePageNumbers?: boolean;
  includeHeader?: boolean;
}

export function OmPdfDocument({ 
  pages, 
  documentName, 
  theme, 
  dimension = 'portrait',
  includePageNumbers = true,
  includeHeader = true,
}: OmPdfDocumentProps) {
  const dims = OM_DIMENSION_SIZES[dimension];
  const isLandscape = dimension === 'landscape' || dimension === '16:9';
  
  return (
    <Document title={documentName} author="Vantage">
      {pages.map((page, pageIndex) => (
        <Page 
          key={page.id} 
          size={dimension === '16:9' ? [1280, 720] : 'LETTER'} 
          orientation={isLandscape ? 'landscape' : 'portrait'}
          style={styles.page}
        >
          {includeHeader && (
            <View style={styles.pageHeader}>
              <Text>{documentName} - {page.title}</Text>
            </View>
          )}
          
          {page.blocks.map((block) => (
            <View key={block.id}>
              {renderBlock(block)}
            </View>
          ))}
          
          {includePageNumbers && (
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
              `Page ${pageNumber} of ${totalPages}`
            )} fixed />
          )}
        </Page>
      ))}
    </Document>
  );
}

export async function generatePdf(
  pages: OmPage[], 
  documentName: string, 
  options?: {
    theme?: OmTheme | null;
    dimension?: OmDocumentDimension;
    includePageNumbers?: boolean;
    includeHeader?: boolean;
  }
): Promise<Blob> {
  const doc = (
    <OmPdfDocument 
      pages={pages} 
      documentName={documentName}
      theme={options?.theme}
      dimension={options?.dimension}
      includePageNumbers={options?.includePageNumbers}
      includeHeader={options?.includeHeader}
    />
  );
  
  const blob = await pdf(doc).toBlob();
  return blob;
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
