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
  }>,
  filename = 'BAF_155_UASU_Duty_Ratio_Template.csv'
) {
  const activeTables = matrix.filter((t) => !t.isDisabled);
  const rows: string[][] = [];

  // Title comment
  rows.push(['# BAF 155 UASU - OFFICIAL DUTY RATIO MATRIX']);
  rows.push(['# NOTE: "Total" column and "Daily Total" / "Daily Req" rows are auto-calculated. Only edit flight quotas for Day 1-31.']);
  rows.push([]);

  activeTables.forEach((table) => {
    const cleanTitle = (table.title || '').replace(/"/g, '""');
    rows.push([`"Duty: ${cleanTitle}"`]);

    const headers = ['Date', ...Array.from({ length: 31 }, (_, i) => String(i + 1)), 'Total'];
    rows.push(headers);

    const flights: Array<{ key: string; label: string }> = [
      { key: 'Mechanics', label: 'Mechanics' },
      { key: 'Avionics', label: 'Avionics' },
      { key: 'GCS', label: 'GCS' },
      { key: 'Admin', label: 'Admin' },
    ];

    const flightStartRow = rows.length + 1; // 1-based row index in Excel
    const flightEndRow = flightStartRow + flights.length - 1;

    flights.forEach(({ key, label }) => {
      const currentRow = rows.length + 1;
      const days = table.data?.[key] || Array(31).fill(0);
      const totalFormula = `=SUM(B${currentRow}:AF${currentRow})`;

      rows.push([
        `"${label}"`,
        ...days.map((d) => String(d ?? 0)),
        totalFormula,
      ]);
    });

    // Daily Total row
    const dailyTotalRow = rows.length + 1;
    const dailyTotalFormulas: string[] = [];
    for (let day = 1; day <= 31; day++) {
      const colLetter = getExcelColName(day + 1);
      dailyTotalFormulas.push(`=SUM(${colLetter}${flightStartRow}:${colLetter}${flightEndRow})`);
    }
    const monthTotalFormula = `=SUM(B${dailyTotalRow}:AF${dailyTotalRow})`;

    rows.push([
      '"Daily Total"',
      ...dailyTotalFormulas,
      monthTotalFormula,
    ]);

    // Daily Req row
    const dailyReq =
      table.dailyRequirement ??
      (table.totalRequiredMonth ? Math.round(table.totalRequiredMonth / 31) : 0);
    if (dailyReq > 0) {
      const reqRow = rows.length + 1;
      rows.push([
        '"Daily Req"',
        ...Array(31).fill(String(dailyReq)),
        `=SUM(B${reqRow}:AF${reqRow})`,
      ]);
    }

    // Blank line between duties
    rows.push([]);
  });

  const csvContent = rows.map((r) => r.join(',')).join('\n');
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

