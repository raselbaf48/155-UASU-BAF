import XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Airman } from '../types';

export function normalizeDateToISO(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (!s || s === '-' || s === 'N/A') return '';
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dMmmYRegex = /^(\d{1,2})[-\s/]([A-Za-z]{3})[-\s/](\d{2,4})$/;
  const dMmmMatch = s.match(dMmmYRegex);
  if (dMmmMatch) {
    const day = parseInt(dMmmMatch[1], 10);
    const monthStr = dMmmMatch[2].toLowerCase();
    let year = parseInt(dMmmMatch[3], 10);
    if (year < 100) {
      year += year >= 50 ? 1900 : 2000;
    }
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIdx = months.indexOf(monthStr);
    if (monthIdx >= 0) {
      return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) {
      year += year >= 50 ? 1900 : 2000;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return s;
}

export function formatShortDate(val?: string | null): string {
  if (!val || val === '-' || val === 'N/A') return '-';
  const iso = normalizeDateToISO(val);
  if (!iso) return val;
  const parts = iso.split('-');
  if (parts.length === 3) {
    const year = parts[0].slice(-2);
    const monthNum = parseInt(parts[1], 10);
    const day = parts[2].padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (monthNum >= 1 && monthNum <= 12) {
      return `${day} ${months[monthNum - 1]} ${year}`;
    }
  }
  return val;
}

async function applyExcelDateValidation(
  wbout: any,
  colLetter: string,
  startRow = 2,
  endRow = 2000
): Promise<Blob> {
  try {
    const zip = await JSZip.loadAsync(wbout);
    const sheetPath = 'xl/worksheets/sheet1.xml';
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) {
      return new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    }

    let sheetXml = await sheetFile.async('text');
    const range = `${colLetter}${startRow}:${colLetter}${endRow}`;

    // OpenXML Data Validation with type="date" and input prompt for calendar / date picker
    const dvXml = `<dataValidations count="1"><dataValidation type="date" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Invalid Date" error="Please enter or select a date in format: dd mmm yy (e.g. 12 Jan 22)" promptTitle="Date of Posting" prompt="Double-click or enter date (Format: dd mmm yy)" sqref="${range}"><formula1>1</formula1><formula2>73050</formula2></dataValidation></dataValidations>`;

    if (sheetXml.includes('<ignoredErrors>')) {
      sheetXml = sheetXml.replace('<ignoredErrors>', dvXml + '<ignoredErrors>');
    } else if (sheetXml.includes('<pageMargins')) {
      sheetXml = sheetXml.replace('<pageMargins', dvXml + '<pageMargins');
    } else {
      sheetXml = sheetXml.replace('</worksheet>', dvXml + '</worksheet>');
    }

    zip.file(sheetPath, sheetXml);
    const modifiedArray = await zip.generateAsync({ type: 'arraybuffer' });
    return new Blob([modifiedArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  } catch (err) {
    console.error('Failed to inject date validation, falling back to standard sheet:', err);
    return new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}

export function exportTableToCSV(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  const tables = el.querySelectorAll('table');
  if (tables.length === 0) {
    console.error('No tables found to export');
    return;
  }

  let csvContent = '';

  tables.forEach((table, tableIndex) => {
    // If there are multiple tables, we might want to separate them.
    if (tableIndex > 0) {
      csvContent += '\n\n';
    }

    // Try to get a title preceding the table
    let previousNode = table.previousElementSibling;
    if (previousNode && previousNode.tagName.match(/^H[1-6]$/)) {
      csvContent += `"${previousNode.textContent?.trim()}"\n`;
    }

    const rows = table.querySelectorAll('tr');
    
    // Convert table data to CSV format
    // Because tables might have colspans/rowspans, a naive approach might misalign.
    // However, for basic export, simple iteration works as a fallback.
    // A robust approach creates a 2D array representing the table grid.
    
    // First pass: determine max rows and cols to initialize grid
    let maxCols = 0;
    for (let r = 0; r < rows.length; r++) {
      let cells = rows[r].querySelectorAll('td, th');
      let colsInRow = 0;
      cells.forEach(cell => {
        colsInRow += parseInt(cell.getAttribute('colspan') || '1', 10);
      });
      maxCols = Math.max(maxCols, colsInRow);
    }
    
    let grid: string[][] = Array(rows.length).fill(null).map(() => Array(maxCols).fill(''));
    
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].querySelectorAll('td, th');
      let c = 0; // Current column in grid
      
      cells.forEach(cell => {
        // Find next empty spot in the row
        while (c < maxCols && grid[r][c] !== '') {
          c++;
        }
        
        let text = (cell.textContent || '').replace(/(\r\n|\n|\r)/gm, ' ').trim();
        // Escape quotes
        text = text.replace(/"/g, '""');
        
        const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
        const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
        
        for (let i = 0; i < rowspan; i++) {
          for (let j = 0; j < colspan; j++) {
            if (r + i < rows.length && c + j < maxCols) {
               // Only put text in the top-left cell of the span, others get empty string (or we could duplicate)
               if (i === 0 && j === 0) {
                 grid[r + i][c + j] = `"${text}"`;
               } else {
                 grid[r + i][c + j] = '""';
               }
            }
          }
        }
        c += colspan;
      });
    }

    // Convert grid to CSV string
    grid.forEach(row => {
      csvContent += row.join(',') + '\n';
    });
  });

  // Use BOM for Excel compatibility with UTF-8
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/\.csv?$/, '') + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getExcelColName(colNumber: number): string {
  let colName = '';
  let dividend = colNumber;
  let modulo;
  while (dividend > 0) {
    modulo = (dividend - 1) % 26;
    colName = String.fromCharCode(65 + modulo) + colName;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return colName;
}

export function exportDutyRatioMatrixCSV(
  matrix: Array<{
    id?: string;
    title: string;
    data: Record<string, number[]>;
    dailyRequirement?: number;
    totalRequiredMonth?: number;
    isDisabled?: boolean;
    dailyRequirements?: number[];
    totalRequiredDaily?: number;
  }>,
  filename = 'BAF_155_UASU_Duty_Ratio_Template.csv'
) {
  const activeTables = matrix.filter((t) => !t.isDisabled);
  const rows: string[][] = [];

  // Top header comments matching user template structure
  rows.push(['# BAF 155 UASU - OFFICIAL DUTY RATIO MATRIX', ...Array(33).fill('')]);
  rows.push([
    '"# NOTE: ""Total"" column and ""Daily Total"" / ""Daily Req"" rows are auto-calculated. Only edit flight quotas for Day 1-31."',
    ...Array(33).fill(''),
  ]);
  rows.push(Array(34).fill(''));

  const flights: Array<{ key: string; label: string }> = [
    { key: 'Mechanics', label: 'Mechanics' },
    { key: 'Avionics', label: 'Avionics' },
    { key: 'GCS', label: 'GCS' },
    { key: 'Admin', label: 'Admin' },
  ];

  activeTables.forEach((table) => {
    const dutyName = (table.title || '').replace(/\s*\(\d+\)$/, '').trim();
    rows.push(['Duty Name', 'Flight/Date', ...Array.from({ length: 31 }, (_, i) => String(i + 1)), 'Total']);

    let tableGrandTotal = 0;

    // 1. Flight rows: In Total Col, output the exact sum of all dates (Day 1 - 31) for that flight
    flights.forEach(({ key, label }) => {
      const days = (table.data?.[key] || Array(31).fill(0)).map((d) => Number(d) || 0);
      const rowSum = days.reduce((sum, val) => sum + val, 0);
      tableGrandTotal += rowSum;

      rows.push([
        dutyName,
        label,
        ...days.map((d) => String(d)),
        String(rowSum),
      ]);
    });

    // 2. Daily Total row: In each date column (Day 1 - 31), output the sum of all flights on that date
    // In the Total column, output the sum of all dates for all flights (table grand total)
    const dailyTotals: number[] = [];
    for (let day = 0; day < 31; day++) {
      const daySum = flights.reduce((sum, f) => {
        const val = table.data?.[f.key]?.[day] ?? 0;
        return sum + (Number(val) || 0);
      }, 0);
      dailyTotals.push(daySum);
    }

    rows.push([
      'Daily ',
      'Total',
      ...dailyTotals.map((d) => String(d)),
      String(tableGrandTotal),
    ]);

    // 3. Daily Req row: configured requirements for each day and total monthly requirement
    const hasDailyReqs = table.dailyRequirements && Array.isArray(table.dailyRequirements) && table.dailyRequirements.length > 0;
    const defaultDailyReq = table.totalRequiredDaily ?? table.dailyRequirement ?? (table.totalRequiredMonth ? Math.round(table.totalRequiredMonth / 31) : 0);

    const reqDays = Array.from({ length: 31 }, (_, dayIdx) => {
      if (hasDailyReqs) {
        return Number(table.dailyRequirements![dayIdx]) || 0;
      }
      return defaultDailyReq;
    });
    const reqTotal = hasDailyReqs
      ? reqDays.reduce((a, b) => a + b, 0)
      : (table.totalRequiredMonth || (defaultDailyReq * 31));

    rows.push([
      'Daily ',
      'Req',
      ...reqDays.map((r) => String(r)),
      String(reqTotal),
    ]);

    // Blank line between duties matching template (33 commas / 34 empty fields)
    rows.push(Array(34).fill(''));
  });

  const csvContent = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const cleanName = filename.replace(/\.(csv|xlsx)$/i, '') + '.csv';
  saveAs(blob, cleanName);
}

export function exportDutyRatioMatrixExcel(
  matrix: Array<{
    id?: string;
    title: string;
    data: Record<string, number[]>;
    dailyRequirement?: number;
    totalRequiredMonth?: number;
    isDisabled?: boolean;
    dailyRequirements?: number[];
    totalRequiredDaily?: number;
  }>,
  filename = 'BAF_155_UASU_Duty_Ratio_Matrix.xlsx'
) {
  const activeTables = matrix.filter((t) => !t.isDisabled);
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [];

  const flights: Array<{ key: string; label: string }> = [
    { key: 'Mechanics', label: 'Mechanics' },
    { key: 'Avionics', label: 'Avionics' },
    { key: 'GCS', label: 'GCS' },
    { key: 'Admin', label: 'Admin' },
  ];

  const tableRanges: Array<{ headerRow: number; startRow: number; endRow: number }> = [];

  activeTables.forEach((table, tIdx) => {
    const dutyName = (table.title || '').replace(/\s*\(\d+\)$/, '').trim();
    const headerRowIndex = rows.length;
    rows.push(['Duty Name', 'Flight/Date', ...Array.from({ length: 31 }, (_, i) => i + 1), 'Total']);

    const startRow = rows.length + 1; // 1-based row index in Excel sheet
    let tableGrandTotal = 0;

    flights.forEach(({ key, label }, fIdx) => {
      const days = (table.data?.[key] || Array(31).fill(0)).map((d) => Number(d) || 0);
      const rowSum = days.reduce((a, b) => a + b, 0);
      tableGrandTotal += rowSum;
      const currentRow = startRow + fIdx;
      rows.push([
        dutyName,
        label,
        ...days,
        { f: `SUM(C${currentRow}:AG${currentRow})`, v: rowSum },
      ]);
    });

    const endRow = startRow + flights.length - 1;
    const dailyTotalCols: any[] = [];
    for (let d = 0; d < 31; d++) {
      const colLetter = XLSX.utils.encode_col(d + 2); // Col C = Day 1, Col AG = Day 31
      const daySum = flights.reduce((sum, f) => sum + (Number(table.data?.[f.key]?.[d]) || 0), 0);
      dailyTotalCols.push({
        f: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
        v: daySum,
      });
    }

    const totalColLetter = XLSX.utils.encode_col(33); // AH = Total column
    rows.push([
      'Daily ',
      'Total',
      ...dailyTotalCols,
      { f: `SUM(${totalColLetter}${startRow}:${totalColLetter}${endRow})`, v: tableGrandTotal },
    ]);

    // Daily Req
    const hasDailyReqs = table.dailyRequirements && Array.isArray(table.dailyRequirements) && table.dailyRequirements.length > 0;
    const defaultDailyReq = table.totalRequiredDaily ?? table.dailyRequirement ?? (table.totalRequiredMonth ? Math.round(table.totalRequiredMonth / 31) : 0);
    const reqDays = Array.from({ length: 31 }, (_, dayIdx) => {
      if (hasDailyReqs) return Number(table.dailyRequirements![dayIdx]) || 0;
      return defaultDailyReq;
    });
    const reqTotal = hasDailyReqs ? reqDays.reduce((a, b) => a + b, 0) : (table.totalRequiredMonth || (defaultDailyReq * 31));

    rows.push(['Daily ', 'Req', ...reqDays, reqTotal]);

    const dailyReqRowIndex = rows.length - 1;
    tableRanges.push({
      headerRow: headerRowIndex,
      startRow: headerRowIndex,
      endRow: dailyReqRowIndex,
    });

    // Spacing row between tables (except after the last table)
    if (tIdx < activeTables.length - 1) {
      rows.push(Array(34).fill(''));
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Border and font styling:
  // "Duty Name Row ta Bold hbe"
  // "Duty Name theke Daily Req row porjonto ar Total Col porjonto Table Border thakbe"
  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  tableRanges.forEach(({ headerRow, startRow, endRow }) => {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = 0; c <= 33; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddress]) {
          ws[cellAddress] = { t: 's', v: '' };
        }
        const cell = ws[cellAddress];
        const isHeader = r === headerRow;
        const isSummary = r >= endRow - 1; // Daily Total and Daily Req
        const isTotalCol = c === 33;

        cell.s = {
          border: thinBorder,
          font: {
            name: 'Calibri',
            sz: 11,
            bold: isHeader || isSummary || isTotalCol,
            color: { rgb: '000000' },
          },
          alignment: {
            vertical: 'center',
            horizontal: c === 0 || (c === 1 && !isHeader && !isSummary) ? 'left' : 'center',
            wrapText: false,
          },
          ...(isHeader
            ? { fill: { fgColor: { rgb: 'E2E8F0' } } }
            : isSummary
            ? { fill: { fgColor: { rgb: 'F1F5F9' } } }
            : {}),
        };
      }
    }
  });

  ws['!cols'] = [
    { wch: 26 }, // Duty Name
    { wch: 14 }, // Flight/Date
    ...Array(31).fill({ wch: 5 }), // Day 1-31
    { wch: 9 },  // Total
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Duty Ratio Matrix');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const cleanName = filename.replace(/\.(xlsx|csv)$/i, '') + '.xlsx';
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, cleanName);
}

export function exportAirmenExcel(
  airmen: Airman[],
  variant: 'nominal' | 'biodata' | string = 'nominal',
  filename?: string
) {
  const wb = XLSX.utils.book_new();
  const headers = [
    'Ser',
    'BD No',
    'Rank',
    'Full Name',
    'Surname',
    'Trade',
    'Flight'
  ];

  if (variant === 'biodata') {
    headers.push('Blood Group', 'Present Address', 'Permanent Address');
  } else {
    headers.push('Address');
  }

  headers.push('Mobile No');

  if (variant === 'biodata') {
    headers.push('Dt of Posting');
  }

  const rows: any[][] = [headers];

  airmen.forEach((a, index) => {
    const row: any[] = [
      index + 1,
      a.bdNo || '',
      a.rank || '',
      a.fullName || a.name || '',
      a.name || a.fullName || '',
      a.trade || '',
      a.flightName || ''
    ];

    if (variant === 'biodata') {
      row.push(a.bloodGroup || '-');
      row.push(a.addressBlock || '-');
      row.push(a.permanentAddress || '-');
    } else {
      row.push(a.addressBlock || '-');
    }

    row.push(a.mobileNo ? String(a.mobileNo).trim() : '-');

    if (variant === 'biodata') {
      if (a.dateJoined) {
        const iso = normalizeDateToISO(a.dateJoined);
        if (iso) {
          const [y, m, d] = iso.split('-').map(Number);
          const excelDate = new Date(Date.UTC(y, m - 1, d));
          row.push(excelDate);
        } else {
          row.push('');
        }
      } else {
        row.push('');
      }
    }

    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true, dateNF: 'dd mmm yy' });

  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  const colCount = headers.length;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < colCount; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellAddress]) {
        ws[cellAddress] = { t: 's', v: '' };
      }
      const cell = ws[cellAddress];
      const isHeader = r === 0;

      let hAlign = 'center';
      const colHeader = headers[c];
      if (
        colHeader === 'Full Name' ||
        colHeader === 'Surname' ||
        colHeader === 'Address' ||
        colHeader === 'Present Address' ||
        colHeader === 'Permanent Address'
      ) {
        hAlign = 'left';
      }

      // Explicit Excel cell formats requested:
      // Mobile No -> Text format (@)
      // Dt of Posting -> Date format (dd mmm yy)
      if (!isHeader) {
        if (colHeader === 'Mobile No' || colHeader === 'BD No') {
          cell.t = 's';
          cell.z = '@';
        } else if (colHeader === 'Dt of Posting') {
          cell.z = 'dd mmm yy';
          if (cell.v instanceof Date) {
            cell.t = 'd';
          }
        }
      }

      cell.s = {
        border: thinBorder,
        font: {
          name: 'Calibri',
          sz: 11,
          bold: isHeader,
          color: { rgb: '000000' },
        },
        alignment: {
          vertical: 'center',
          horizontal: isHeader ? 'center' : hAlign,
          wrapText: false,
        },
        ...(isHeader ? { fill: { fgColor: { rgb: 'E2E8F0' } } } : {}),
        ...(!isHeader && colHeader === 'Dt of Posting' ? { numFmt: 'dd mmm yy' } : {}),
        ...(!isHeader && (colHeader === 'Mobile No' || colHeader === 'BD No') ? { numFmt: '@' } : {}),
      };
    }
  }

  ws['!cols'] = headers.map((h) => {
    switch (h) {
      case 'Ser':
        return { wch: 6 };
      case 'BD No':
        return { wch: 12 };
      case 'Rank':
        return { wch: 10 };
      case 'Full Name':
        return { wch: 25 };
      case 'Surname':
        return { wch: 16 };
      case 'Trade':
        return { wch: 15 };
      case 'Flight':
        return { wch: 14 };
      case 'Blood Group':
        return { wch: 12 };
      case 'Present Address':
      case 'Permanent Address':
      case 'Address':
        return { wch: 30 };
      case 'Mobile No':
        return { wch: 16 };
      case 'Dt of Posting':
        return { wch: 14 };
      default:
        return { wch: 12 };
    }
  });

  const sheetTitle = variant === 'biodata' ? 'Biodata Register' : 'Nominal Roll';
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

  const defaultFileName =
    variant === 'biodata'
      ? `Biodata_Register_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Nominal_Roll_${new Date().toISOString().split('T')[0]}.xlsx`;

  const finalName = (filename || defaultFileName).replace(/\.(xlsx|csv)$/i, '') + '.xlsx';
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const postingColIdx = headers.indexOf('Dt of Posting');
  if (postingColIdx >= 0) {
    const colLetter = XLSX.utils.encode_col(postingColIdx);
    applyExcelDateValidation(wbout, colLetter, 2, Math.max(rows.length + 50, 1000)).then((blob) => {
      saveAs(blob, finalName);
    });
  } else {
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, finalName);
  }
}

export function exportAirmenTemplateExcel(
  filename = 'BAF_155_UASU_Airmen_Biodata_Template.xlsx'
) {
  const wb = XLSX.utils.book_new();
  const headers = [
    'Ser',
    'BD No',
    'Rank',
    'Full Name',
    'Surname',
    'Trade',
    'Flight',
    'Blood Group',
    'Present Address',
    'Permanent Address',
    'Mobile No',
    'Dt of Posting',
  ];

  const sampleRows: any[][] = [
    ['1', '478546', 'Sgt', 'Md Sazzad Hossain', 'Sazzad', 'Afr Fitt', 'Mechanics', 'B+', "Sgt's Mess Block 05", 'Mirpur-10, Dhaka', '01712345678', new Date(Date.UTC(2022, 0, 12))],
    ['2', '489123', 'Cpl', 'Russel Ahmed', 'Russel', 'Eng Fitt', 'Mechanics', 'O+', "Airmen's Mess Block 08", 'Sadar, Bogura', '01812345678', new Date(Date.UTC(2023, 5, 15))],
    ['3', '495678', 'LAC', 'Md Anowar Hossain', 'Anowar', 'E&I Fitt', 'Avionics', 'A+', 'Svc Qtr D-14', 'Kotwali, Chattogram', '01912345678', new Date(Date.UTC(2023, 10, 1))],
    ['4', '498901', 'AC', 'Rakib Hasan', 'Rakib', 'Radio Fitt', 'Avionics', 'AB+', 'Outside Base: Agrabad', 'Gouripur, Mymensingh', '01612345678', new Date(Date.UTC(2024, 1, 10))],
    ['5', '499120', 'AC', 'Tanvir Ahmed', 'Tanvir', 'Armt Fitt', 'Mechanics', 'O+', "Airmen's Mess Block 02", 'Sadar, Jashore', '01798765432', new Date(Date.UTC(2024, 2, 18))],
  ];

  // Provide blank pre-formatted rows for direct user entry
  for (let b = 6; b <= 30; b++) {
    sampleRows.push([String(b), '', '', '', '', '', '', '', '', '', '', '']);
  }

  const rows: any[][] = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true, dateNF: 'dd mmm yy' });

  const thinBorder = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellAddress]) {
        ws[cellAddress] = { t: 's', v: '' };
      }
      const cell = ws[cellAddress];
      const isHeader = r === 0;

      let hAlign = 'center';
      const colHeader = headers[c];
      if (
        colHeader === 'Full Name' ||
        colHeader === 'Surname' ||
        colHeader === 'Present Address' ||
        colHeader === 'Permanent Address'
      ) {
        hAlign = 'left';
      }

      // Explicit cell format requested:
      // Mobile No -> Text format (@)
      // Dt of Posting -> Date format (dd mmm yy)
      if (!isHeader) {
        if (colHeader === 'Mobile No' || colHeader === 'BD No') {
          cell.t = 's';
          cell.z = '@';
        } else if (colHeader === 'Dt of Posting') {
          cell.z = 'dd mmm yy';
          if (cell.v instanceof Date) {
            cell.t = 'd';
          }
        }
      }

      cell.s = {
        border: thinBorder,
        font: {
          name: 'Calibri',
          sz: 11,
          bold: isHeader,
          color: { rgb: '000000' },
        },
        alignment: {
          vertical: 'center',
          horizontal: isHeader ? 'center' : hAlign,
          wrapText: false,
        },
        ...(isHeader ? { fill: { fgColor: { rgb: 'E2E8F0' } } } : {}),
        ...(!isHeader && colHeader === 'Dt of Posting' ? { numFmt: 'dd mmm yy' } : {}),
        ...(!isHeader && (colHeader === 'Mobile No' || colHeader === 'BD No') ? { numFmt: '@' } : {}),
      };
    }
  }

  ws['!cols'] = [
    { wch: 6 },  // Ser
    { wch: 12 }, // BD No
    { wch: 10 }, // Rank
    { wch: 25 }, // Full Name
    { wch: 16 }, // Surname
    { wch: 15 }, // Trade
    { wch: 14 }, // Flight
    { wch: 12 }, // Blood Group
    { wch: 28 }, // Present Address
    { wch: 28 }, // Permanent Address
    { wch: 16 }, // Mobile No
    { wch: 14 }, // Dt of Posting
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Airmen Biodata Template');

  const finalName = filename.replace(/\.(xlsx|csv)$/i, '') + '.xlsx';
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const postingColIdx = headers.indexOf('Dt of Posting');
  const colLetter = postingColIdx >= 0 ? XLSX.utils.encode_col(postingColIdx) : 'M';
  applyExcelDateValidation(wbout, colLetter, 2, 500).then((blob) => {
    saveAs(blob, finalName);
  });
}

