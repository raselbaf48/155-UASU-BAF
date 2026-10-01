import React, { useState } from 'react';
import { AirfieldShiftRoster, DutyPost } from '../types';
import { calculateAirfieldStats } from '../utils/airfieldStorage';
import { Printer, Edit2, Check, X, Phone, Calendar, Clock, UserCheck, Shield } from 'lucide-react';

interface FullRosterSheetViewProps {
  roster: AirfieldShiftRoster;
  onUpdateRoster: (updated: AirfieldShiftRoster) => void;
  onSelectPost: (postId: string) => void;
}

export const FullRosterSheetView: React.FC<FullRosterSheetViewProps> = ({
  roster,
  onUpdateRoster,
  onSelectPost,
}) => {
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({
    dutyOfficerName: roster.dutyOfficerName,
    dutyOfficerPhone: roster.dutyOfficerPhone,
    dutySncoName: roster.dutySncoName,
    timeRange: roster.timeRange,
  });

  const stats = calculateAirfieldStats(roster.posts);

  const handleSaveHeader = () => {
    onUpdateRoster({
      ...roster,
      ...headerDraft,
    });
    setIsEditingHeader(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-3 sm:p-6 lg:p-8 space-y-5 pb-36">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 print:hidden">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span>Airfield Duty Master Roster</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {roster.shift}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Shah Amanat International Airport (SAIA) • Date: {roster.date} • Timing: {roster.timeRange}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setHeaderDraft({
                dutyOfficerName: roster.dutyOfficerName,
                dutyOfficerPhone: roster.dutyOfficerPhone,
                dutySncoName: roster.dutySncoName,
                timeRange: roster.timeRange,
              });
              setIsEditingHeader(!isEditingHeader);
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditingHeader ? 'Cancel Edit' : 'Edit Header Info'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* Edit Header Form (collapsible) */}
      {isEditingHeader && (
        <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 space-y-3 animate-fadeIn print:hidden">
          <span className="text-xs font-black uppercase text-indigo-400 tracking-wider block">
            Edit Shift Duty Officers & Timings
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Duty Officer Name</label>
              <input
                type="text"
                value={headerDraft.dutyOfficerName}
                onChange={(e) => setHeaderDraft({ ...headerDraft, dutyOfficerName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1">Duty Officer Mobile</label>
              <input
                type="text"
                value={headerDraft.dutyOfficerPhone}
                onChange={(e) => setHeaderDraft({ ...headerDraft, dutyOfficerPhone: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1">Duty SNCO Name</label>
              <input
                type="text"
                value={headerDraft.dutySncoName}
                onChange={(e) => setHeaderDraft({ ...headerDraft, dutySncoName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-bold mb-1">Shift Time Range</label>
              <input
                type="text"
                value={headerDraft.timeRange}
                onChange={(e) => setHeaderDraft({ ...headerDraft, timeRange: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveHeader}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Changes</span>
            </button>
          </div>
        </div>
      )}

      {/* Official Printable Sheet Container */}
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-4 sm:p-6 overflow-x-auto print:p-0 print:shadow-none print:m-0 print:border-none">
        <div className="min-w-[850px]">
          {/* Main Title Banner matching image */}
          <div className="bg-[#fbbf24] text-black text-center py-1.5 px-4 font-black text-base sm:text-lg border-2 border-black tracking-wider uppercase">
            AIRFIELD DUTY AT SAIA
          </div>
          <div className="bg-[#38bdf8] text-black text-center py-0.5 px-4 font-black text-sm border-x-2 border-b-2 border-black tracking-widest">
            ({roster.shift}) • TIMING: {roster.timeRange}
          </div>

          {/* Top Meta Details Grid matching official spreadsheet */}
          <table className="w-full border-collapse border-x-2 border-b-2 border-black text-xs font-bold">
            <tbody>
              <tr className="bg-[#bae6fd] text-slate-900 border-b border-black">
                <td className="border-r border-black p-1.5 w-1/4">Duty Officer:</td>
                <td className="border-r border-black p-1.5 w-1/4 font-mono">{roster.dutyOfficerPhone}</td>
                <td className="border-r border-black p-1.5 w-1/4">Date:</td>
                <td className="p-1.5 w-1/4 font-mono">{roster.date}</td>
              </tr>
              <tr className="bg-[#bae6fd] text-slate-900 border-b border-black">
                <td className="border-r border-black p-1.5">Active Duty Manned:</td>
                <td className="border-r border-black p-1.5 font-mono">{String(stats.activeCount).padStart(2, '0')} / {stats.targetActiveTotal}</td>
                <td className="border-r border-black p-1.5">Time:</td>
                <td className="p-1.5 font-mono">{roster.timeRange}</td>
              </tr>
              <tr className="bg-[#bae6fd] text-slate-900 border-b border-black">
                <td className="border-r border-black p-1.5">Standby Relief Force:</td>
                <td className="border-r border-black p-1.5 font-mono">{String(stats.standbyCount).padStart(2, '0')} / {stats.targetStandbyTotal}</td>
                <td className="border-r border-black p-1.5">Duty Officer:</td>
                <td className="p-1.5">{roster.dutyOfficerName}</td>
              </tr>
              <tr className="bg-[#bae6fd] text-slate-900 border-b-2 border-black">
                <td className="border-r border-black p-1.5">Total Force Strength:</td>
                <td className="border-r border-black p-1.5 font-mono font-black">{String(stats.totalPersonnel).padStart(2, '0')} Pers</td>
                <td className="border-r border-black p-1.5">Duty SNCO:</td>
                <td className="p-1.5">{roster.dutySncoName}</td>
              </tr>
            </tbody>
          </table>

          {/* Roster Table matching official spreadsheet layout & colors */}
          <table className="w-full border-collapse border-2 border-black text-xs mt-1">
            <thead>
              <tr className="bg-[#dc2626] text-white font-black text-center border-b-2 border-black">
                <th className="border border-black p-2 w-[18%]">Post Name & Time</th>
                <th className="border border-black p-2 w-[8%]">Quota<br />(Act/Stby)</th>
                <th className="border border-black p-2 w-[24%]">Active Duty<br />(Rk + Name)</th>
                <th className="border border-black p-2 w-[18%]">Standby Duty<br />(Rk + Name)</th>
                <th className="border border-black p-2 w-[12%]">Break<br />Down</th>
                <th className="border border-black p-2 w-[11%]">Mobile No</th>
                <th className="border border-black p-2 w-[9%]">Rmks</th>
              </tr>
            </thead>
            <tbody>
              {roster.posts.map((post) => {
                const activeStaff = post.personnel.filter((p) => (p.dutyStatus || 'Active') === 'Active');
                const standbyStaff = post.personnel.filter((p) => p.dutyStatus === 'Standby');
                const targetAct = post.targetActiveStrength ?? post.targetStrength ?? 0;
                const targetStb = post.targetStandbyStrength ?? 0;
                const postTime = post.dutyTime || roster.timeRange || '0600F - 1400F';

                // Breakdown note computation
                let breakdownStr = post.breakdownNote || '';
                if (!breakdownStr) {
                  const arms = post.personnel.reduce((s, p) => s + (p.armsCount || 0), 0);
                  const rt = post.personnel.reduce((s, p) => s + (p.rtCount || 0), 0);
                  const parts = [];
                  if (arms > 0) parts.push(`Arms-${String(arms).padStart(2, '0')}`);
                  if (rt > 0) parts.push(`RT-${String(rt).padStart(2, '0')}`);
                  breakdownStr = parts.join('\n');
                }

                const postMobile = post.mobileNo || post.personnel.find((p) => p.mobileNo)?.mobileNo || '';

                return (
                  <tr
                    key={post.id}
                    onClick={() => onSelectPost(post.id)}
                    className="hover:opacity-90 cursor-pointer transition-opacity text-black border-b border-black"
                  >
                    {/* Post Name & Time */}
                    <td className="border border-black p-1.5 font-bold bg-[#86efac]">
                      <div>{post.name}</div>
                      <div className="text-[10px] text-slate-700 font-mono font-normal">⏱ {postTime}</div>
                    </td>

                    {/* Quota */}
                    <td className="border border-black p-1.5 text-center font-bold bg-[#86efac] font-mono">
                      <span className="text-emerald-800">{activeStaff.length}/{targetAct}</span>
                      {targetStb > 0 && (
                        <div className="text-[10px] text-amber-800">S: {standbyStaff.length}/{targetStb}</div>
                      )}
                    </td>

                    {/* Active Duty (Rk + Name) */}
                    <td className="border border-black p-1.5 font-bold bg-[#86efac] leading-tight">
                      {activeStaff.length > 0 ? (
                        activeStaff.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-xs py-0.5">
                            <span>{p.rank} {p.name}</span>
                            <span className="text-[9px] font-mono font-normal opacity-75">
                              {p.type === 'Permanent' ? '(P)' : '(Addl)'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-red-600 font-normal italic">No active personnel</span>
                      )}
                    </td>

                    {/* Standby Duty (Rk + Name) */}
                    <td className="border border-black p-1.5 font-bold bg-[#fef08a] leading-tight">
                      {standbyStaff.length > 0 ? (
                        standbyStaff.map((p) => (
                          <div key={p.id} className="text-xs py-0.5">
                            {p.rank} {p.name}
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>

                    {/* Break Down */}
                    <td className="border border-black p-1.5 text-center font-bold bg-[#fef08a] whitespace-pre-line font-mono text-[11px]">
                      {breakdownStr || '-'}
                    </td>

                    {/* Mobile No */}
                    <td className="border border-black p-1.5 text-center font-mono text-[11px]">
                      {postMobile || '-'}
                    </td>

                    {/* Rmks */}
                    <td className="border border-black p-1.5 text-center text-[11px]">
                      {post.remarks || '-'}
                    </td>
                  </tr>
                );
              })}

              {/* Total Summary Row */}
              <tr className="bg-[#fbbf24] text-black font-black border-t-2 border-black text-center">
                <td className="border border-black p-2 text-right uppercase tracking-wider">
                  Total
                </td>
                <td className="border border-black p-2 font-mono text-sm">
                  {stats.activeCount}/{stats.targetActiveTotal}
                </td>
                <td className="border border-black p-2 font-mono text-sm text-left pl-2">
                  Active: {stats.activeCount} Pers (P: {stats.permanentCount}, Addl: {stats.additionalCount})
                </td>
                <td className="border border-black p-2 font-mono text-sm">
                  Standby: {stats.standbyCount} Pers
                </td>
                <td className="border border-black p-2 font-mono text-xs whitespace-pre-line text-left pl-3">
                  Arms-{stats.totalArms}
                  <br />
                  RT-{stats.totalRt}
                </td>
                <td className="border border-black p-2"></td>
                <td className="border border-black p-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
