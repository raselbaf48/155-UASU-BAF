export function exportHtmlToWord(elementId: string, filename: string, orientation: 'landscape' | 'portrait' = 'landscape') {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  // Clone the element so we can modify it without affecting the actual DOM
  const clone = el.cloneNode(true) as HTMLElement;

  // Add specific attributes to tables for MS Word compatibility
  const tables = clone.querySelectorAll('table');
  tables.forEach((table) => {
    table.setAttribute('border', '1');
    table.setAttribute('cellspacing', '0');
    table.setAttribute('cellpadding', '4');
    table.setAttribute('bordercolor', '#000000');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.textAlign = 'center';
  });

  const ths = clone.querySelectorAll('th');
  ths.forEach((th) => {
    th.style.border = '1px solid black';
    th.style.padding = '2px';
    th.style.backgroundColor = '#f1f5f9';
    th.style.fontWeight = 'bold';
    
    // Check classes for alignment
    if (th.classList.contains('text-left')) th.style.textAlign = 'left';
    else if (th.classList.contains('text-right')) th.style.textAlign = 'right';
    else th.style.textAlign = 'center'; // Default to center for TH
  });

  const tds = clone.querySelectorAll('td');
  tds.forEach((td) => {
    td.style.border = '1px solid black';
    td.style.padding = '2px';
    
    // Check classes for alignment
    if (td.classList.contains('text-left')) td.style.textAlign = 'left';
    else if (td.classList.contains('text-right')) td.style.textAlign = 'right';
    else td.style.textAlign = 'center'; // User requested table contents center aligned
  });

  
  
  // Convert OL and UL to div to prevent double numbering in MS Word
  const lists = clone.querySelectorAll('ol, ul');
  lists.forEach(list => {
    const listElement = list as HTMLElement;
    const div = document.createElement('div');
    div.className = listElement.className;
    div.style.cssText = listElement.style.cssText;
    div.style.margin = '0';
    div.style.padding = '0';
    div.innerHTML = listElement.innerHTML;
    listElement.parentNode?.replaceChild(div, listElement);
  });

  // Convert Flexbox rows into HTML Tables for MS Word layout support
  const flexRows = clone.querySelectorAll('.flex');
  flexRows.forEach(flex => {
    // Only convert horizontal flex rows that have multiple children
    // Specifically looking for the bottom disposal container and the onPt chunks container
    if ((flex.classList.contains('justify-between') && flex.classList.contains('items-start')) || 
        flex.classList.contains('space-x-6') || 
        (flex.classList.contains('justify-center') && (flex.classList.contains('gap-12') || flex.classList.contains('gap-10')))) {
      
      const children = Array.from(flex.children);
      if (children.length > 1) {
        const table = document.createElement('table');
        table.setAttribute('border', '0');
        table.setAttribute('cellpadding', '0');
        table.setAttribute('cellspacing', '0');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.border = 'none';
        
        const tbody = document.createElement('tbody');
        const tr = document.createElement('tr');
        tr.setAttribute('valign', 'top');
        
        children.forEach((child, index) => {
          const td = document.createElement('td');
          td.style.verticalAlign = 'top';
          td.style.border = 'none';
          td.style.padding = '0 12px 0 0'; // simulate gap
          if (index === children.length - 1) td.style.padding = '0';
          
          td.appendChild(child.cloneNode(true));
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
        table.appendChild(tbody);
        flex.parentNode?.replaceChild(table, flex);
      }
    }
  });

  // Since we replaced the parent, we need to query 'li' again on the clone
  const items = clone.querySelectorAll('li');
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = item.className;
    div.style.cssText = item.style.cssText;
    div.style.margin = '0';
    div.style.padding = '2px 0'; // slight spacing for lines
    div.innerHTML = item.innerHTML;
    item.parentNode?.replaceChild(div, item);
  });
  
  // Remove elements that are meant to be hidden in print
  const hiddenElements = clone.querySelectorAll('.print\\:hidden, .hidden');
  hiddenElements.forEach(el => {
    el.parentNode?.removeChild(el);
  });

  // A comprehensive CSS stylesheet that maps common Tailwind classes used in our print previews
  // to standard CSS that Microsoft Word understands.
  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Export Document</title>
      <style>
        @page WordSection1 {
          size: ${orientation === 'landscape' ? '841.9pt 595.3pt' : '595.3pt 841.9pt'}; /* A4 dimensions */
          ${orientation === 'landscape' ? 'mso-page-orientation: landscape;' : ''}
          margin: 36.0pt 36.0pt 36.0pt 36.0pt;
        }
        div.WordSection1 {
          page: WordSection1;
        }
        
        body, table, td, th, div, span, p, li { 
          font-family: Arial, sans-serif !important; 
          font-size: 10pt; 
          color: black; 
        }
        
        /* Keep headers slightly larger and bold */
        h1, h2, h3, .text-lg, .text-xl, .text-base {
          font-size: 14pt !important;
          font-weight: bold !important;
        }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .font-black { font-weight: bold; }
        .underline { text-decoration: underline; }
        .bg-slate-100 { background-color: #f1f5f9; }
        .bg-slate-200 { background-color: #e2e8f0; }
        .bg-white { background-color: #ffffff; }
        .text-xs { font-size: 7pt !important; }
        .text-sm { font-size: 9pt !important; }
        .text-lg { font-size: 14pt; }
        .text-xl { font-size: 16pt !important; }

        .text-\[11px\] { font-size: 8pt !important; }
        .text-\[12px\] { font-size: 9pt !important; }
        .text-\[13px\] { font-size: 10pt !important; }

        .mb-2 { margin-bottom: 8px; }
        .mb-4 { margin-bottom: 16px; }
        .mb-6 { margin-bottom: 24px; }
        .pb-8 { padding-bottom: 32px; }
        .pt-4 { padding-top: 16px; }
        h1, h2, h3, h4, h5, h6 { text-align: center; margin: 4px 0; }
        .print\\:break-after-page { page-break-after: always; }
        .print\\:hidden { display: none !important; }
      </style>
    </head>
    <body>
      <div class="WordSection1">
        ${clone.innerHTML}
      </div>
    </body>
    </html>
  `;

  // Use application/msword and .doc extension for maximum compatibility with this HTML wrapping trick
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/\.docx?$/, '') + '.doc';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
