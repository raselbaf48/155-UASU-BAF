const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// Insert imports
const importStatement = "import { CanteenLayout } from '../features/canteen/components/CanteenLayout';\nimport { EmployeeDashboard } from '../features/canteen/pages/EmployeeDashboard';\n";
code = code.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\n" + importStatement);

// Replace Canteen empty state with CanteenLayout
const oldCanteen = `{activeTab === 'Canteen' && (
          <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto animate-fadeIn flex flex-col">
            <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 flex items-center print:hidden">
              <button 
                onClick={() => setActiveTab('Office')}
                className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 shadow-lg cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold text-sm">Back</span>
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
              <Coffee className="w-20 h-20 text-slate-700" />
              <h2 className="text-2xl font-black text-white">Canteen Portal</h2>
              <p className="text-slate-500 font-medium">This feature is currently under development.</p>
            </div>
          </div>
        )}`;

const newCanteen = `{activeTab === 'Canteen' && (
          <CanteenLayout onBack={() => setActiveTab('Office')}>
            <EmployeeDashboard />
          </CanteenLayout>
        )}`;

code = code.replace(oldCanteen, newCanteen);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);
