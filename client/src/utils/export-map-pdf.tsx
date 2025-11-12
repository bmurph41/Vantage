import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';

interface CompForPDF {
  id: string;
  marina: string;
  city?: string;
  state?: string;
  salePrice?: number;
  saleMonth?: number;
  saleYear?: number;
  wetSlips?: number;
  dryRacks?: number;
  storageTypes?: string[];
  profitCenterStorage?: boolean;
  profitCenterFuel?: boolean;
  profitCenterService?: boolean;
  profitCenterEvents?: boolean;
  profitCenterFnb?: boolean;
  profitCenterHospitality?: boolean;
  profitCenterShipStore?: boolean;
  profitCenterBoatSales?: boolean;
  profitCenterBoatRentals?: boolean;
  profitCenterBoatBrokerage?: boolean;
  profitCenterBoatClub?: boolean;
  profitCenterRvPark?: boolean;
  profitCenterParts?: boolean;
  profitCenterThirdPartyLeases?: boolean;
  lat?: number;
  lng?: number;
}

interface MapPDFOptions {
  comps: CompForPDF[];
  subjectProperty?: CompForPDF | null;
  title: string;
  compMarkerColor: string;
  subjectMarkerColor: string;
  mapSnapshot?: string; // Base64 image data
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottom: '2px solid #333',
    paddingBottom: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    fontSize: 10,
  },
  marker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  compCard: {
    marginBottom: 15,
    padding: 12,
    border: '1px solid #ddd',
    borderRadius: 4,
  },
  compTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  compDetail: {
    fontSize: 10,
    marginBottom: 3,
    flexDirection: 'row',
  },
  detailLabel: {
    fontWeight: 'bold',
    width: 120,
  },
  detailValue: {
    flex: 1,
  },
  mapImage: {
    width: '100%',
    height: 300,
    marginBottom: 20,
    objectFit: 'contain',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 10,
    color: '#666',
  },
});

function formatCurrency(value?: number): string {
  if (!value) return 'N/A';
  return `$${value.toLocaleString()}`;
}

function formatDate(month?: number, year?: number): string {
  if (!month || !year) return 'N/A';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]} ${year}`;
}

function getProfitCenters(comp: CompForPDF): string[] {
  const centers: string[] = [];
  if (comp.profitCenterStorage) centers.push('Storage');
  if (comp.profitCenterFuel) centers.push('Fuel');
  if (comp.profitCenterService) centers.push('Service');
  if (comp.profitCenterEvents) centers.push('Events');
  if (comp.profitCenterFnb) centers.push('F&B');
  if (comp.profitCenterHospitality) centers.push('Hospitality');
  if (comp.profitCenterShipStore) centers.push('Ship Store');
  if (comp.profitCenterBoatSales) centers.push('Boat Sales');
  if (comp.profitCenterBoatRentals) centers.push('Boat Rentals');
  if (comp.profitCenterBoatBrokerage) centers.push('Boat Brokerage');
  if (comp.profitCenterBoatClub) centers.push('Boat Club');
  if (comp.profitCenterRvPark) centers.push('RV Park');
  if (comp.profitCenterParts) centers.push('Parts');
  if (comp.profitCenterThirdPartyLeases) centers.push('Third Party Leases');
  return centers;
}

function MapPDFDocument({ comps, subjectProperty, title, compMarkerColor, subjectMarkerColor, mapSnapshot }: MapPDFOptions) {
  return (
    <Document>
      {/* Cover Page with Map & Legend */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        
        {mapSnapshot && (
          <View style={styles.section}>
            <Image src={mapSnapshot} style={styles.mapImage} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Map Legend</Text>
          
          {subjectProperty && (
            <View style={styles.legendItem}>
              <View style={[styles.marker, { backgroundColor: subjectMarkerColor }]} />
              <Text>{subjectProperty.marina} (Subject Property)</Text>
            </View>
          )}

          {comps.map((comp, index) => (
            <View key={comp.id} style={styles.legendItem}>
              <View style={[styles.marker, { backgroundColor: compMarkerColor }]} />
              <Text>{index + 1}. {comp.marina}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>

      {/* Detailed Comp Listings */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Comparable Properties Detail</Text>

        {subjectProperty && (
          <View style={styles.compCard}>
            <Text style={styles.compTitle}>SUBJECT PROPERTY: {subjectProperty.marina}</Text>
            <View style={styles.compDetail}>
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={styles.detailValue}>
                {subjectProperty.city && subjectProperty.state 
                  ? `${subjectProperty.city}, ${subjectProperty.state}`
                  : 'N/A'}
              </Text>
            </View>
            <View style={styles.compDetail}>
              <Text style={styles.detailLabel}>Sale Price:</Text>
              <Text style={styles.detailValue}>{formatCurrency(subjectProperty.salePrice)}</Text>
            </View>
            <View style={styles.compDetail}>
              <Text style={styles.detailLabel}>Sale Date:</Text>
              <Text style={styles.detailValue}>{formatDate(subjectProperty.saleMonth, subjectProperty.saleYear)}</Text>
            </View>
            <View style={styles.compDetail}>
              <Text style={styles.detailLabel}>Slip Count:</Text>
              <Text style={styles.detailValue}>
                {subjectProperty.wetSlips ? `${subjectProperty.wetSlips} wet slips` : ''}
                {subjectProperty.wetSlips && subjectProperty.dryRacks ? ', ' : ''}
                {subjectProperty.dryRacks ? `${subjectProperty.dryRacks} dry racks` : ''}
                {!subjectProperty.wetSlips && !subjectProperty.dryRacks ? 'N/A' : ''}
              </Text>
            </View>
            {getProfitCenters(subjectProperty).length > 0 && (
              <View style={styles.compDetail}>
                <Text style={styles.detailLabel}>Profit Centers:</Text>
                <Text style={styles.detailValue}>{getProfitCenters(subjectProperty).join(', ')}</Text>
              </View>
            )}
          </View>
        )}

        {comps.map((comp, index) => (
          <View key={comp.id} style={styles.compCard} wrap={false}>
            <Text style={styles.compTitle}>{index + 1}. {comp.marina}</Text>
            <View style={styles.compDetail}>
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={styles.detailValue}>
                {comp.city && comp.state ? `${comp.city}, ${comp.state}` : 'N/A'}
              </Text>
            </View>
            <View style={styles.compDetail}>
              <Text style={styles.detailLabel}>Sale Price:</Text>
              <Text style={styles.detailValue}>{formatCurrency(comp.salePrice)}</Text>
            </View>
            <View style={styles.compDetail}>
              <Text style={styles.detailLabel}>Sale Date:</Text>
              <Text style={styles.detailValue}>{formatDate(comp.saleMonth, comp.saleYear)}</Text>
            </View>
            <View style={styles.compDetail}>
              <Text style={styles.detailLabel}>Slip Count:</Text>
              <Text style={styles.detailValue}>
                {comp.wetSlips ? `${comp.wetSlips} wet slips` : ''}
                {comp.wetSlips && comp.dryRacks ? ', ' : ''}
                {comp.dryRacks ? `${comp.dryRacks} dry racks` : ''}
                {!comp.wetSlips && !comp.dryRacks ? 'N/A' : ''}
              </Text>
            </View>
            {getProfitCenters(comp).length > 0 && (
              <View style={styles.compDetail}>
                <Text style={styles.detailLabel}>Profit Centers:</Text>
                <Text style={styles.detailValue}>{getProfitCenters(comp).join(', ')}</Text>
              </View>
            )}
          </View>
        ))}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export async function exportMapToPDF(options: MapPDFOptions): Promise<Blob> {
  const doc = <MapPDFDocument {...options} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
