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
