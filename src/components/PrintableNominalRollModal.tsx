import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Airman } from '../types';
import { Printer, X, Download } from 'lucide-react';
import { exportHtmlToWord } from '../utils/htmlExport';
import { exportAirmenExcel, formatShortDate } from '../utils/csvExport';
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
  title,
  variant = "nominal",
  onClose,
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    variant === 'biodata' ? 'landscape' : 'portrait'
  );

  const preparedBy = getSavedPreparedBy();
  const authorizedBy = getSavedAuthorizedBy();

  const docHeading = variant === 'biodata' ? 'BIODATA REGISTER : AIRMEN' : 'NOMINAL ROLL : AIRMEN';
  const modalHeading = variant === 'biodata' ? 'OFFICIAL BIODATA REGISTER PRINT PREVIEW' : 'OFFICIAL NOMINAL ROLL PRINT PREVIEW';
  const defaultDocName = variant === 'biodata' ? 'Biodata_Register_155_UASU_BAF' : 'Nominal_Roll_155_UASU_BAF';

  const getPdfTitle = () => 
    variant === 'biodata'
      ? `Biodata_Register_${new Date().toISOString().split('T')[0]}`
      : `Nominal_Roll_${new Date().toISOString().split('T')[0]}`;

  const handleExportExcel = () => {
    const filename = variant === 'biodata' 
      ? `Biodata_Register_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Nominal_Roll_${new Date().toISOString().split('T')[0]}.xlsx`;
    exportAirmenExcel(airmen, variant, filename);
  };

  const handlePrint = () => {
    document.title = getPdfTitle();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 print:bg-white animate-fadeIn print:block print:static print:h-auto print:overflow-visible text-black">
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
              {modalHeading}
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Use 'Save as PDF' or Print directly
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
          {/* Page Orientation Selector */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                orientation === 'portrait'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Portrait mode"
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Landscape mode (Recommended for Biodata)"
            >
              Landscape
            </button>
          </div>

          <button
            onClick={() => exportHtmlToWord('print-nominal-roll-content', `${defaultDocName}.doc`, orientation)}
            className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer border border-slate-700"
          >
            <Download className="w-4 h-4" />
            <span className="text-center">Export Doc</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer border border-emerald-600/40"
            title="Export full register as formatted Excel spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span className="text-center">Export Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center space-x-1.5 px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-center">Official Print</span>
          </button>
        </div>
      </div>

      {/* Printable Content Area */}
      <div className="flex-1 overflow-auto print:overflow-visible bg-slate-200/60 print:bg-white p-3 sm:p-6 print:p-0 flex justify-center print:block">
        <style type="text/css">
          {`
            @media print {
              @page { 
                size: ${orientation}; 
                margin: 6mm; 
              }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          `}
        </style>
        <div 
          id="print-nominal-roll-content" 
          className={`mx-auto h-fit shrink-0 bg-white text-black print:shadow-none print:border-none border border-slate-300 shadow-2xl p-4 sm:p-8 print:p-0 print:m-0 transition-all ${
            orientation === 'landscape'
              ? 'w-full sm:w-[297mm] min-h-[210mm] print:w-full print:min-h-0'
              : 'w-full sm:w-[210mm] min-h-[297mm] print:w-full print:min-h-0'
          }`}
        >
          <div className="w-full">
            {/* Document Header */}
            <div className="text-center mb-5">
              <h1 className="text-sm sm:text-base font-black underline leading-snug tracking-wide">
                {docHeading}<br />
                155 UASU BAF
              </h1>
            </div>

            {/* Matrix Table */}
            <div className="w-full overflow-x-auto print:overflow-visible">
              <table 
                className={`no-zebra w-full text-center border-collapse border border-black font-sans ${
                  orientation === 'landscape' ? 'text-[11px]' : variant === 'biodata' ? 'text-[9.5px]' : 'text-[11px]'
                }`} 
                style={{ pageBreakInside: 'auto' }}
              >
                <thead className="bg-slate-100 print:bg-white text-black" style={{ backgroundColor: '#f1f5f9', color: '#000000', display: 'table-header-group' }}>
                  <tr>
                    <th className="p-1 sm:p-1.5 border border-black font-bold text-center w-7">Ser</th>
                    <th className="p-1 sm:p-1.5 border border-black font-bold text-center whitespace-nowrap">BD No</th>
                    <th className="p-1 sm:p-1.5 border border-black font-bold text-center whitespace-nowrap">Rank</th>
                    <th className="p-1 sm:p-1.5 border border-black font-bold text-left">Full Name</th>
                    <th className="p-1 sm:p-1.5 border border-black font-bold text-center">Trade</th>
                    <th className="p-1 sm:p-1.5 border border-black font-bold text-center">Flight</th>
                    {variant === 'biodata' && <th className="p-1 sm:p-1.5 border border-black font-bold text-center whitespace-nowrap">Blood Group</th>}
                    <th className="p-1 sm:p-1.5 border border-black font-bold text-left">{variant === 'biodata' ? 'Present Address' : 'Address'}</th>
                    {variant === 'biodata' && <th className="p-1 sm:p-1.5 border border-black font-bold text-left">Permanent Address</th>}
                    <th className="p-1 sm:p-1.5 border border-black font-bold text-center whitespace-nowrap">Mobile No</th>
                    {variant === 'biodata' && <th className="p-1 sm:p-1.5 border border-black font-bold text-center whitespace-nowrap">Dt of Posting</th>}
                  </tr>
                </thead>
                <tbody style={{ display: 'table-row-group' }}>
                  {airmen.map((airman, idx) => (
                    <tr key={airman.id} className="even:bg-gray-100 print:even:bg-gray-100" style={{ pageBreakInside: 'avoid', pageBreakAfter: 'auto' }}>
                      <td className="p-1 sm:p-1.5 border border-black text-center font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-1 sm:p-1.5 border border-black text-center font-mono whitespace-nowrap">
                        {airman.bdNo.replace(/^BD\//i, '')}
                      </td>
                      <td className="p-1 sm:p-1.5 border border-black text-center whitespace-nowrap">
                        {formatAirmanName(airman.rank)}
                      </td>
                      <td className="p-1 sm:p-1.5 border border-black text-left font-semibold">
                        {airman.fullName || airman.name}
                      </td>
                      <td className="p-1 sm:p-1.5 border border-black text-left whitespace-nowrap">
                        {airman.trade}
                      </td>
                      <td className="p-1 sm:p-1.5 border border-black text-left whitespace-nowrap">
                        {airman.flightName}
                      </td>
                      {variant === 'biodata' && (
                        <td className="p-1 sm:p-1.5 border border-black text-center whitespace-nowrap font-bold">
                          {airman.bloodGroup || '-'}
                        </td>
                      )}
                      <td className="p-1 sm:p-1.5 border border-black text-left">
                        <div className="leading-tight whitespace-normal min-w-[90px]">
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
                        <td className="p-1 sm:p-1.5 border border-black text-left">
                          <div className="leading-tight whitespace-normal min-w-[100px]">
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
                      <td className="p-1 sm:p-1.5 border border-black text-center font-mono whitespace-nowrap">
                        {airman.mobileNo || '-'}
                      </td>
                      {variant === 'biodata' && (
                        <td className="p-1 sm:p-1.5 border border-black text-center whitespace-nowrap font-mono font-medium">
                          {formatShortDate(airman.dateJoined)}
                        </td>
                      )}
                    </tr>
                  ))}
                  {airmen.length === 0 && (
                    <tr>
                      <td colSpan={variant === 'biodata' ? 11 : 8} className="p-4 text-center text-slate-500 font-medium">
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
