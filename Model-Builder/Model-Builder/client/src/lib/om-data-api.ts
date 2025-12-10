export interface OmDataSeries {
  id: string;
  label: string;
  unit?: 'currency' | 'percent' | 'count' | 'index';
  data: { x: string | number; y: number }[];
}

export interface OmDataTable {
  id: string;
  label: string;
  description?: string;
  columns: { id: string; label: string; align?: 'left' | 'right' | 'center' }[];
  rows: Record<string, any>[];
}

export interface OmDataResponse {
  metrics: Record<string, number | string>;
  series: OmDataSeries[];
  tables: OmDataTable[];
}

export type OmDataSourceType = 'underwriting' | 'sales_comps' | 'rent_comps' | 'market' | 'demographics' | 'manual' | 'dataset';

export interface OmDataBinding {
  sourceType: OmDataSourceType;
  sourceId?: string | null;
  sheetName?: string;
  bindingRole?: string;
  query?: any;
}

export async function fetchOmData(projectId: string, sourceType: OmDataSourceType, datasetId?: string, sheetName?: string): Promise<OmDataResponse> {
  if (sourceType === 'manual') {
    return { metrics: {}, series: [], tables: [] };
  }

  if (sourceType === 'dataset' && datasetId) {
    try {
      let rawData: any[];
      let headers: string[];
      let sheetLabel: string;
      
      if (sheetName) {
        const response = await fetch(`/api/datasets/${datasetId}/sheet/${encodeURIComponent(sheetName)}`);
        if (!response.ok) throw new Error('Failed to fetch sheet data');
        const result = await response.json();
        rawData = result.data || [];
        headers = result.metadata?.headers || (rawData[0] ? Object.keys(rawData[0]) : []);
        sheetLabel = result.sheetName || sheetName;
      } else {
        const response = await fetch(`/api/datasets/${datasetId}`);
        if (!response.ok) throw new Error('Failed to fetch dataset');
        const dataset = await response.json();
        const dataObj = dataset.data as Record<string, any[]>;
        const firstSheetName = dataset.sheetNames?.[0] || Object.keys(dataObj)[0] || 'Sheet1';
        rawData = dataObj[firstSheetName] || [];
        headers = dataset.metadata?.sheets?.[firstSheetName]?.headers || (rawData[0] ? Object.keys(rawData[0]) : []);
        sheetLabel = firstSheetName;
      }
      
      return transformDatasetToOmData(rawData, headers, sheetLabel);
    } catch (error) {
      console.error('Error fetching dataset:', error);
      return { metrics: {}, series: [], tables: [] };
    }
  }

  const sourceIdMap: Record<string, string> = {
    'underwriting': 'underwriting',
    'sales_comps': 'sales-comps', 
    'rent_comps': 'rent-comps',
    'market': 'market-data',
    'demographics': 'demographics',
  };
  
  const mappedSourceId = sourceIdMap[sourceType];
  if (!mappedSourceId) {
    return { metrics: {}, series: [], tables: [] };
  }

  try {
    const response = await fetch(`/api/data-facade/data/${mappedSourceId}`);
    if (!response.ok) throw new Error('Failed to fetch data');
    const data = await response.json();
    
    if (Array.isArray(data)) {
      return transformArrayToOmData(data, sourceType);
    }
    
    return {
      metrics: data,
      series: [],
      tables: [],
    };
  } catch (error) {
    console.error('Error fetching OM data:', error);
    return getMockData(sourceType);
  }
}

function transformDatasetToOmData(data: any[], headers: string[], sheetName: string): OmDataResponse {
  const metrics: Record<string, number | string> = {};
  const series: OmDataSeries[] = [];
  const tables: OmDataTable[] = [];

  if (data.length === 0) {
    return { metrics, series, tables };
  }

  const numericColumns = headers.filter(h => {
    const sampleValues = data.slice(0, 5).map(row => row[h]);
    return sampleValues.some(v => typeof v === 'number' && !isNaN(v));
  });

  const labelColumn = headers.find(h => 
    !numericColumns.includes(h) && 
    data.slice(0, 5).every(row => typeof row[h] === 'string' || typeof row[h] === 'number')
  ) || headers[0];

  if (data.length === 1 && numericColumns.length > 0) {
    numericColumns.forEach(col => {
      metrics[col] = data[0][col];
    });
  }

  if (data.length > 1 && numericColumns.length > 0) {
    numericColumns.forEach(numCol => {
      const seriesData = data.map(row => ({
        x: String(row[labelColumn] || ''),
        y: Number(row[numCol]) || 0,
      })).filter(d => d.x && !isNaN(d.y));

      if (seriesData.length > 0) {
        series.push({
          id: numCol.toLowerCase().replace(/\s+/g, '_'),
          label: numCol,
          unit: detectUnit(numCol),
          data: seriesData,
        });
      }
    });
  }

  if (data.length > 0) {
    tables.push({
      id: sheetName.toLowerCase().replace(/\s+/g, '_'),
      label: sheetName,
      columns: headers.map(h => ({
        id: h,
        label: h,
        align: numericColumns.includes(h) ? 'right' as const : 'left' as const,
      })),
      rows: data,
    });
  }

  return { metrics, series, tables };
}

function transformArrayToOmData(data: any[], sourceType: string): OmDataResponse {
  if (data.length === 0) {
    return { metrics: {}, series: [], tables: [] };
  }

  const headers = Object.keys(data[0]);
  const numericColumns = headers.filter(h => 
    data.slice(0, 5).some(row => typeof row[h] === 'number')
  );

  const labelColumn = headers.find(h => !numericColumns.includes(h)) || headers[0];

  const series = numericColumns.map(col => ({
    id: col.toLowerCase().replace(/\s+/g, '_'),
    label: col,
    unit: detectUnit(col),
    data: data.map(row => ({
      x: String(row[labelColumn] || ''),
      y: Number(row[col]) || 0,
    })),
  }));

  const tables = [{
    id: sourceType,
    label: sourceType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    columns: headers.map(h => ({
      id: h,
      label: h,
      align: numericColumns.includes(h) ? 'right' as const : 'left' as const,
    })),
    rows: data,
  }];

  return { metrics: {}, series, tables };
}

function detectUnit(columnName: string): 'currency' | 'percent' | 'count' | 'index' | undefined {
  const lower = columnName.toLowerCase();
  if (lower.includes('price') || lower.includes('noi') || lower.includes('revenue') || lower.includes('income') || lower.includes('expense') || lower.includes('rent') || lower.includes('value')) {
    return 'currency';
  }
  if (lower.includes('rate') || lower.includes('percent') || lower.includes('occupancy') || lower.includes('growth')) {
    return 'percent';
  }
  if (lower.includes('count') || lower.includes('units') || lower.includes('slips') || lower.includes('population')) {
    return 'count';
  }
  return undefined;
}

function getMockData(sourceType: OmDataSourceType): OmDataResponse {
  if (sourceType === 'underwriting') {
    return {
      metrics: {
        purchasePrice: 12500000,
        entryCapRate: 0.065,
        noiYear1: 812500,
        noiStabilized: 950000,
        occupancyCurrent: 0.94,
        occupancyStabilized: 0.98,
        revenueYear1: 1250000,
        expenseYear1: 437500
      },
      series: [
        {
          id: 'noiByYear',
          label: 'NOI Projection',
          unit: 'currency',
          data: [
            { x: 'Year 1', y: 812500 },
            { x: 'Year 2', y: 850000 },
            { x: 'Year 3', y: 910000 },
            { x: 'Year 4', y: 980000 },
            { x: 'Year 5', y: 1050000 }
          ]
        },
        {
          id: 'revenueByYear',
          label: 'Gross Revenue',
          unit: 'currency',
          data: [
            { x: 'Year 1', y: 1250000 },
            { x: 'Year 2', y: 1320000 },
            { x: 'Year 3', y: 1400000 },
            { x: 'Year 4', y: 1480000 },
            { x: 'Year 5', y: 1560000 }
          ]
        }
      ],
      tables: [
        {
          id: 't12Pnl',
          label: 'T-12 P&L Summary',
          columns: [
            { id: 'category', label: 'Category', align: 'left' },
            { id: 'amount', label: 'Amount', align: 'right' }
          ],
          rows: [
            { category: 'Rental Income', amount: '$1,150,000' },
            { category: 'Other Income', amount: '$100,000' },
            { category: 'Total Expenses', amount: '($437,500)' },
            { category: 'Net Operating Income', amount: '$812,500' }
          ]
        }
      ]
    };
  }

  if (sourceType === 'market' || sourceType === 'demographics') {
    return {
      metrics: {
        population5mi: 125000,
        medianIncome: 85000,
        homeValueMedian: 650000
      },
      series: [
        {
          id: 'rentGrowth',
          label: 'Market Rent Growth',
          unit: 'percent',
          data: [
            { x: '2020', y: 2.1 },
            { x: '2021', y: 3.5 },
            { x: '2022', y: 4.2 },
            { x: '2023', y: 3.8 },
            { x: '2024', y: 3.2 }
          ]
        }
      ],
      tables: []
    };
  }

  if (sourceType === 'sales_comps') {
    return {
      metrics: {},
      series: [],
      tables: [
        {
          id: 'salesComps',
          label: 'Sales Comparables',
          columns: [
            { id: 'address', label: 'Address', align: 'left' },
            { id: 'price', label: 'Price', align: 'right' },
            { id: 'capRate', label: 'Cap Rate', align: 'right' }
          ],
          rows: [
            { address: '123 Main St', price: '$11,000,000', capRate: '5.0%' },
            { address: '456 Oak Ave', price: '$13,500,000', capRate: '5.4%' }
          ]
        }
      ]
    };
  }

  return { metrics: {}, series: [], tables: [] };
}
