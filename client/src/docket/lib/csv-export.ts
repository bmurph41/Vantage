import { format } from "date-fns";

export interface DealExportData {
  id: number;
  transactionType: string | null;
  dealStatus: string | null;
  buyer: string | null;
  seller: string | null;
  dealSize: string | null;
  valuation: string | null;
  equityStake: string | null;
  announcedDate: string | null;
  closingDate: string | null;
  confidence: number;
  articleTitle: string | null;
  articleSource: string | null;
  articleUrl: string | null;
  articlePublishedAt: string | null;
  region: string | null;
}

export function exportDealsToCSV(deals: DealExportData[], filename: string = 'docket-deals.csv') {
  // Define CSV headers
  const headers = [
    'Transaction Type',
    'Deal Status',
    'Buyer',
    'Seller',
    'Deal Size',
    'Valuation',
    'Equity Stake',
    'Announced Date',
    'Closing Date',
    'Confidence (%)',
    'Region',
    'Article Title',
    'Article Source',
    'Article URL',
    'Published Date'
  ];

  // Convert deals to CSV rows - escape all values for safety
  const rows = deals.map(deal => [
    escapeCsvValue(formatTransactionType(deal.transactionType)),
    escapeCsvValue(formatDealStatus(deal.dealStatus)),
    escapeCsvValue(deal.buyer || ''),
    escapeCsvValue(deal.seller || ''),
    escapeCsvValue(deal.dealSize || ''),
    escapeCsvValue(deal.valuation || ''),
    escapeCsvValue(deal.equityStake || ''),
    escapeCsvValue(deal.announcedDate ? format(new Date(deal.announcedDate), 'yyyy-MM-dd') : ''),
    escapeCsvValue(deal.closingDate ? format(new Date(deal.closingDate), 'yyyy-MM-dd') : ''),
    escapeCsvValue(Math.round(deal.confidence * 100).toString()),
    escapeCsvValue(deal.region || ''),
    escapeCsvValue(deal.articleTitle || ''),
    escapeCsvValue(deal.articleSource || ''),
    escapeCsvValue(deal.articleUrl || ''),
    escapeCsvValue(deal.articlePublishedAt ? format(new Date(deal.articlePublishedAt), 'yyyy-MM-dd') : '')
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatTransactionType(type: string | null): string {
  if (!type) return '';
  const typeMap: Record<string, string> = {
    ma: 'M&A',
    financing: 'Financing',
    partnership: 'Partnership',
    asset_sale: 'Asset Sale',
    other: 'Other'
  };
  return typeMap[type] || type;
}

function formatDealStatus(status: string | null): string {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}
