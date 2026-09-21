import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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

  // Top header comments matching template structure
  rows.push(['# BAF 155 UASU - OFFICIAL DUTY RATIO MATRIX', ...Array(33).fill('')]);
  rows.push([
    '# NOTE: "Total" column and "Daily Total" / "Daily Req" rows are auto-calculated. Only edit flight quotas for Day 1-31.',
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
    rows.push(Array(34).fill(''));
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

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

