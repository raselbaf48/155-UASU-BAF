import React from 'react';
import { createPortal } from 'react-dom';
import { Airman } from '../types';
import { Printer, X, Download } from 'lucide-react';
import { exportHtmlToWord } from '../utils/htmlExport';
import { FileSpreadsheet } from 'lucide-react';
import { getSavedPreparedBy, getSavedAuthorizedBy } from './SignatureConfigModal';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface PrintableNominalRollModalProps {
  airmen: Airman[];
  title?: string;
  variant?: 'nominal' | 'biodata';
  onClose: () => void;
}

export const PrintableNominalRollModal: React.FC<PrintableNominalRollModalProps> = ({
  airmen,
  title = "OFFICIAL NOMINAL ROLL : 155 UASU BAF",
  variant = "nominal",
  onClose,
}) => {
  const preparedBy = getSavedPreparedBy();
  const authorizedBy = getSavedAuthorizedBy();

  const getPdfTitle = () => `Nominal_Roll_${new Date().toISOString().split('T')[0]}.pdf`;


  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Headers (Surname column added next to Full Name for CSV export only)
    const headers = ["Ser", "BD No", "Rank", "Full Name", "Surname", "Trade", "Flight"];
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
    
    csvContent += headers.join(",") + "\n";
    
    // Rows
    airmen.forEach((a, index) => {
      const escapeCsv = (str: string | undefined | null) => {
        if (!str) return '""';
        const cleaned = str.replace(/"/g, '""').replace(/\n/g, ' ');
        return `"${cleaned}"`;
      };
      
      const row = [
        index + 1,
        a.bdNo,
        a.rank,
        escapeCsv(a.fullName || a.name),
        escapeCsv(a.name || a.fullName),
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
      
      csvContent += row.join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = variant === 'biodata' 
      ? `Biodata_Register_${new Date().toISOString().split('T')[0]}.csv`
      : `Nominal_Roll_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    document.title = getPdfTitle();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 print:bg-white animate-fadeIn  print:block print:static print:h-auto print:overflow-visible text-black">
      {/* Top Header Controls (Hidden on Print) */}
      <div className="flex-none bg-slate-900 border-b border-slate-700 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 shadow-2xl print:hidden z-10">
        <div className="flex items-center space-x-3 text-white">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs sm:text-sm font-black tracking-widest leading-tight">
              OFFICIAL NOMINAL ROLL PRINT PREVIEW
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Use 'Save as PDF' or Print directly
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-between sm:justify-start">
          <button
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
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 sm:px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-center">Official Print</span>
          </button>
        </div>
      </div>

      {/* Printable Content Area */}
      <div className="flex-1 overflow-auto print:overflow-visible bg-slate-200/50 print:bg-white p-4 sm:py-8 print:p-0 flex justify-start sm:justify-center print:block">
        <style type="text/css">
          {`
            @media print {
              @page { size: portrait; margin: 8mm; }
            }
          `}
        </style>
        <div id="print-nominal-roll-content" className="w-max sm:w-[210mm] min-w-[min(100vw-32px,210mm)] mx-auto h-fit min-h-[297mm] print:w-full print:min-h-0 print:h-auto shrink-0 bg-white text-black print:shadow-none print:border-none border border-slate-300 shadow-2xl p-4 sm:p-12 print:p-0 print:m-0">
          <div className="w-full">
            {/* Document Header */}
            <div className="text-center mb-6">
              <h1 className="text-base font-black underline leading-snug">
                NOMINAL ROLL : AIRMEN<br />
                155 UASU BAF
              </h1>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto print:overflow-visible flex justify-center print:block">
              <table className="no-zebra w-full text-center text-[12px] border-collapse border border-black font-sans" style={{ pageBreakInside: 'auto' }}>
                <thead className="bg-slate-100 print:bg-white text-black" style={{ backgroundColor: '#f1f5f9', color: '#000000', display: 'table-header-group' }}>
                  <tr>
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
                  </tr>
                </thead>
                <tbody style={{ display: 'table-row-group' }}>
                  {airmen.map((airman, idx) => (
                    <tr key={airman.id} className="even:bg-gray-100 print:even:bg-gray-100" style={{ pageBreakInside: 'avoid', pageBreakAfter: 'auto' }}>
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
                        <div className="leading-tight whitespace-normal min-w-[100px]">
                          {airman.addressBlock ? (
                            airman.addressBlock.includes("Mess, Block No:") ? (
                              <>
                                <span className="block">{airman.addressBlock.split(", Block No:")[0]},</span>
                                <span className="block text-[10px] text-slate-500 font-bold">Block No:{airman.addressBlock.split(", Block No:")[1]}</span>
                              </>
                            ) : (
                              <span className="block">{airman.addressBlock}</span>
                            )
                          ) : '-'}
                        </div>
                      </td>
                      {variant === 'biodata' && (
                        <td className="p-1.5 border border-black text-center">
                          <div className="leading-tight whitespace-normal min-w-[120px]">
                            {airman.permanentAddress ? (
                              airman.permanentAddress.includes(';') ? (
                                (() => {
                                  const parts = airman.permanentAddress.split(';').map(x => x.trim()).filter(Boolean);
                                  const rows = [];
                                  for (let i = 0; i < parts.length; i += 2) {
                                    rows.push(parts.slice(i, i + 2).join('; '));
                                  }
                                  return rows.map((r, i) => <span key={i} className="block">{r}</span>);
                                })()
                              ) : (
                                <span className="block">{airman.permanentAddress}</span>
                              )
                            ) : '-'}
                          </div>
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
                    </tr>
                  ))}
                  {airmen.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-slate-500 font-medium">
                        No airmen found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  , document.body);
};
