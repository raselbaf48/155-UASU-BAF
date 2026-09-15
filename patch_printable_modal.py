import re

with open('src/components/PrintableNominalRollModal.tsx', 'r') as f:
    content = f.read()

# Add variant to props
content = content.replace(
    '  title?: string;\n  onClose: () => void;',
    "  title?: string;\n  variant?: 'nominal' | 'biodata';\n  onClose: () => void;"
)

content = content.replace(
    '  title = "OFFICIAL NOMINAL ROLL : 155 UASU BAF",\n  onClose,\n}) => {',
    '  title = "OFFICIAL NOMINAL ROLL : 155 UASU BAF",\n  variant = "nominal",\n  onClose,\n}) => {'
)

# Replace table head
thead_old = """                  <tr>
                    <th className="p-1.5 border border-black font-bold text-center w-8">Ser</th>
                    <th className="p-1.5 border border-black font-bold text-center">BD No</th>
                    <th className="p-1.5 border border-black font-bold text-center">Rank</th>
                    <th className="p-1.5 border border-black font-bold text-center">Full Name</th>
                    <th className="p-1.5 border border-black font-bold text-center">Trade</th>
                    <th className="p-1.5 border border-black font-bold text-center">Flight</th>
                    <th className="p-1.5 border border-black font-bold text-center">Address</th>
                    <th className="p-1.5 border border-black font-bold text-center">Mobile No</th>
                  </tr>"""

thead_new = """                  <tr>
                    <th className="p-1.5 border border-black font-bold text-center w-8">Ser</th>
                    <th className="p-1.5 border border-black font-bold text-center">BD No</th>
                    <th className="p-1.5 border border-black font-bold text-center">Rank</th>
                    <th className="p-1.5 border border-black font-bold text-center">Full Name</th>
                    <th className="p-1.5 border border-black font-bold text-center">Trade</th>
                    <th className="p-1.5 border border-black font-bold text-center">Flight</th>
                    {variant === 'biodata' && <th className="p-1.5 border border-black font-bold text-center">Blood Group</th>}
                    <th className="p-1.5 border border-black font-bold text-center">{variant === 'biodata' ? 'Present Address' : 'Address'}</th>
                    {variant === 'biodata' && <th className="p-1.5 border border-black font-bold text-center">Permanent Address</th>}
                    <th className="p-1.5 border border-black font-bold text-center">Mobile No</th>
                    {variant === 'biodata' && <th className="p-1.5 border border-black font-bold text-center">Dt of Posting</th>}
                  </tr>"""
content = content.replace(thead_old, thead_new)

# Replace table body row
tbody_old = """                    <tr key={airman.id} className="even:bg-gray-100 print:even:bg-gray-100" style={{ pageBreakInside: 'avoid', pageBreakAfter: 'auto' }}>
                      <td className="p-1.5 border border-black text-center">
                        {idx + 1}
                      </td>
                      <td className="p-1.5 border border-black text-center">
                        {airman.bdNo.replace(/^BD\//i, '')}
                      </td>
                      <td className="p-1.5 border border-black text-center">
                        {formatAirmanName(airman.rank)}
                      </td>
                      <td className="p-1.5 border border-black text-left">
                        {airman.fullName || airman.name}
                      </td>
                      <td className="p-1.5 border border-black text-left">
                        {airman.trade}
                      </td>
                      <td className="p-1.5 border border-black text-left">
                        {airman.flightName}
                      </td>
                      <td className="p-1.5 border border-black text-left">
                        {airman.addressBlock || '-'}
                      </td>
                      <td className="p-1.5 border border-black text-center">
                        {airman.mobileNo || '-'}
                      </td>
                    </tr>"""

tbody_new = """                    <tr key={airman.id} className="even:bg-gray-100 print:even:bg-gray-100" style={{ pageBreakInside: 'avoid', pageBreakAfter: 'auto' }}>
                      <td className="p-1.5 border border-black text-center">
                        {idx + 1}
                      </td>
                      <td className="p-1.5 border border-black text-center">
                        {airman.bdNo.replace(/^BD\//i, '')}
                      </td>
                      <td className="p-1.5 border border-black text-center">
                        {formatAirmanName(airman.rank)}
                      </td>
                      <td className="p-1.5 border border-black text-left">
                        {airman.fullName || airman.name}
                      </td>
                      <td className="p-1.5 border border-black text-left">
                        {airman.trade}
                      </td>
                      <td className="p-1.5 border border-black text-left">
                        {airman.flightName}
                      </td>
                      {variant === 'biodata' && (
                        <td className="p-1.5 border border-black text-center">
                          {airman.bloodGroup || '-'}
                        </td>
                      )}
                      <td className="p-1.5 border border-black text-left">
                        {airman.addressBlock || '-'}
                      </td>
                      {variant === 'biodata' && (
                        <td className="p-1.5 border border-black text-left">
                          {airman.permanentAddress || '-'}
                        </td>
                      )}
                      <td className="p-1.5 border border-black text-center">
                        {airman.mobileNo || '-'}
                      </td>
                      {variant === 'biodata' && (
                        <td className="p-1.5 border border-black text-center whitespace-nowrap">
                          {airman.dateJoined ? new Date(airman.dateJoined).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                        </td>
                      )}
                    </tr>"""
content = content.replace(tbody_old, tbody_new)

# Add CSV Export functionality
import_str = "import { exportHtmlToWord } from '../utils/htmlExport';"
import_new = "import { exportHtmlToWord } from '../utils/htmlExport';\nimport { FileSpreadsheet } from 'lucide-react';"
content = content.replace(import_str, import_new)

export_csv_logic = """
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Headers
    const headers = ["Ser", "BD No", "Rank", "Full Name", "Trade", "Flight"];
    if (variant === 'biodata') {
      headers.push("Blood Group");
      headers.push("Present Address");
      headers.push("Permanent Address");
    } else {
      headers.push("Address");
    }
    headers.push("Mobile No");
    if (variant === 'biodata') {
      headers.push("Dt of Posting");
    }
    
    csvContent += headers.join(",") + "\\n";
    
    // Rows
    airmen.forEach((a, index) => {
      const escapeCsv = (str) => {
        if (!str) return '""';
        const cleaned = str.replace(/"/g, '""').replace(/\\n/g, ' ');
        return `"${cleaned}"`;
      };
      
      const row = [
        index + 1,
        a.bdNo,
        a.rank,
        escapeCsv(a.fullName || a.name),
        escapeCsv(a.trade),
        a.flightName
      ];
      
      if (variant === 'biodata') {
        row.push(a.bloodGroup || '-');
        row.push(escapeCsv(a.addressBlock || '-'));
        row.push(escapeCsv(a.permanentAddress || '-'));
      } else {
        row.push(escapeCsv(a.addressBlock || '-'));
      }
      
      row.push(a.mobileNo || '-');
      
      if (variant === 'biodata') {
        row.push(a.dateJoined ? new Date(a.dateJoined).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-');
      }
      
      csvContent += row.join(",") + "\\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Nominal_Roll_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
"""

content = content.replace('  const handlePrint = () => {', export_csv_logic + '\n  const handlePrint = () => {')

# Add CSV Button
btn_old = """          <button
            onClick={() => exportHtmlToWord('print-nominal-roll-content', 'Nominal_Roll_155_UASU_BAF.doc', 'portrait')}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="text-center">Export Doc</span>
          </button>"""

btn_new = """          <button
            onClick={() => exportHtmlToWord('print-nominal-roll-content', 'Nominal_Roll_155_UASU_BAF.doc', 'portrait')}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="text-center">Export Doc</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-center">Export CSV</span>
          </button>"""
content = content.replace(btn_old, btn_new)

with open('src/components/PrintableNominalRollModal.tsx', 'w') as f:
    f.write(content)

