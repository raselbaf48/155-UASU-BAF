import React from 'react';
import { Airman, FlightName, UserRole } from '../types';
import { Building2, Users, Shield, Award, ChevronRight, ArrowRight, Eye } from 'lucide-react';
import { sortAirmenBySeniority } from '../utils/seniority';

interface FlightsMiniViewProps {
  role: UserRole;
  airmen: Airman[];
  onSelectFlight: (flightName: FlightName) => void;
  onViewAirmanHistory?: (airman: Airman) => void;
}

export const FlightsMiniView: React.FC<FlightsMiniViewProps> = ({
  role,
  airmen,
  onSelectFlight,
  onViewAirmanHistory,
}) => {
  const flights: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];

  const flightMeta: Record<
    FlightName,
    {
      title: string;
      desc: string;
      color: string;
      borderColor: string;
      badgeColor: string;
    }
  > = {
    Avionics: {
      title: 'Avionics Flight',
      desc: 'Electronics, Radar, Communication & Navigation systems',
      color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-800',
      badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
    },
    Mechanics: {
      title: 'Mechanics Flight',
      desc: 'Airframe, Aero-Engine & Propulsion mechanical systems',
      color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      borderColor: 'border-amber-200 dark:border-amber-800',
      badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    },
    GCS: {
      title: 'GCS Flight',
      desc: 'Ground Control Station, Tactical Links & Telemetry control',
      color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
    },
    Admin: {
      title: 'Admin Flight',
      desc: 'Cyber Assistant, Logistics, Unit Orderly Room & Operations',
      color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
      borderColor: 'border-purple-200 dark:border-purple-800',
      badgeColor: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
            <Building2 className="w-4 h-4" />
            <span>Organizational Structure • 155 UASU BAF</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            Flights & Section Roster
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mini overview of the 4 operational flights. Click any flight card to inspect its nominal roll.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-black">
            Total Unit Strength: {airmen.length} Airmen
          </div>
        </div>
      </div>

      {/* 4 Flights Mini Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {flights.map((fl) => {
          const flAirmen = sortAirmenBySeniority(airmen.filter((a) => a.flightName === fl));
          const meta = flightMeta[fl];

          const swoCount = flAirmen.filter((a) => a.rank === 'SWO' || a.rank === 'WO').length;
          const sgtCount = flAirmen.filter((a) => a.rank === 'Sgt').length;
          const cplCount = flAirmen.filter((a) => a.rank === 'Cpl').length;
          const lacCount = flAirmen.filter((a) => a.rank === 'LAC').length;

          // Unique trades
          const trades = Array.from(new Set(flAirmen.map((a) => a.trade))).slice(0, 4);

          return (
            <div
              key={fl}
              className={`bg-white dark:bg-slate-900 rounded-2xl border ${meta.borderColor} p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group`}
            >
              <div>
                {/* Top Badge & Strength */}
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${meta.badgeColor}`}>
                    {fl} Flight
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {flAirmen.length}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 ml-1">Airmen</span>
                  </div>
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white mt-3 group-hover:text-emerald-600 transition-colors">
                  {meta.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {meta.desc}
                </p>

                {/* Rank distribution */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-4 gap-1 text-center">
                  <div className="p-1 rounded bg-slate-50 dark:bg-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold">WO</div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-200">{swoCount}</div>
                  </div>
                  <div className="p-1 rounded bg-slate-50 dark:bg-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold">Sgt</div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-200">{sgtCount}</div>
                  </div>
                  <div className="p-1 rounded bg-slate-50 dark:bg-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold">Cpl</div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-200">{cplCount}</div>
                  </div>
                  <div className="p-1 rounded bg-slate-50 dark:bg-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold">LAC</div>
                    <div className="text-xs font-black text-slate-800 dark:text-slate-200">{lacCount}</div>
                  </div>
                </div>

                {/* Trades tags */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {trades.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action button to open that flight's nominal roll */}
              <button
                onClick={() => onSelectFlight(fl)}
                className="mt-5 w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-600 dark:bg-slate-800 dark:hover:bg-emerald-600 text-slate-800 dark:text-slate-200 hover:text-white dark:hover:text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs"
              >
                <span>View Airmen</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
