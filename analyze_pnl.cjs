const XLSX = require('xlsx');
const path = process.argv[2] || '/mnt/user-data/uploads/SS3_2024_Monthly_P_Ls.xlsx';

const wb = XLSX.readFile(path);
console.log('=== SHEETS ===');
console.log(wb.SheetNames);

const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[1]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('\n=== FILE STRUCTURE ===');
console.log('Total rows:', data.length);

const row1 = data[0] || [];
console.log('\n=== ROW 1 (Headers) ===');
const monthHeaders = [];
for (let c = 0; c < row1.length; c++) {
  const cell = row1[c];
  if (cell && typeof cell === 'string') {
    const monthMatch = cell.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
    if (monthMatch) {
      monthHeaders.push({ col: c, label: cell });
      console.log('  Month at col', c, ':', cell);
    }
  }
}
console.log('Total month columns:', monthHeaders.length);

console.log('\n=== LINE ITEMS (what SHOULD be extracted) ===');
let lineItemCount = 0;

function isSubtotal(text) {
  const lower = text.toLowerCase().trim();
  if (/^total\s/i.test(lower)) return true;
  if (/\stotal$/i.test(lower)) return true;
  if (/^gross\s*profit/i.test(lower)) return true;
  if (/^net\s*(ordinary\s*)?(income|profit|loss)/i.test(lower)) return true;
  if (/^income$/i.test(lower)) return true;
  if (/^expense$/i.test(lower)) return true;
  if (/^cost\s*of\s*(goods\s*)?sold$/i.test(lower)) return true;
  if (/^ordinary\s*income\/expense/i.test(lower)) return true;
  return false;
}

for (let i = 1; i < data.length; i++) {
  const row = data[i] || [];
  let lineItemName = null;
  for (let c = 0; c < 6; c++) {
    const cell = row[c];
    if (cell && typeof cell === 'string' && cell.trim().length > 1) {
      lineItemName = cell.trim();
      break;
    }
  }
  if (!lineItemName) continue;
  if (isSubtotal(lineItemName)) continue;
  
  let hasAmount = false;
  for (const mh of monthHeaders) {
    const val = row[mh.col];
    if (typeof val === 'number' && val !== 0) {
      hasAmount = true;
      break;
    }
  }
  
  if (hasAmount) {
    lineItemCount++;
    if (lineItemCount <= 30) {
      console.log(lineItemCount + '.', lineItemName.substring(0, 40));
    }
  }
}

console.log('\n=== SUMMARY ===');
console.log('Total line items that SHOULD be extracted:', lineItemCount);
