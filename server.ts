import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import Tesseract from 'tesseract.js';
import mammoth from 'mammoth';
import path from 'path';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import pdfParsePkg from 'pdf-parse/lib/pdf-parse.js';

process.on('uncaughtException', (err: any) => {
  const msg = String(err?.message || err || '');
  if (msg.includes('Port 24678') || msg.includes('WebSocket') || msg.includes('EADDRINUSE')) {
    console.warn('[server] Suppressed non-fatal server warning:', msg);
    return;
  }
  console.error('[server] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason: any) => {
  const msg = String(reason?.message || reason || '');
  if (msg.includes('Port 24678') || msg.includes('WebSocket') || msg.includes('EADDRINUSE')) {
    console.warn('[server] Suppressed non-fatal rejection:', msg);
    return;
  }
  console.error('[server] Unhandled Rejection:', reason);
});

import { INITIAL_AIRMEN } from './src/data/initialAirmen';
import { DUTY_TYPES } from './src/data/dutyTypes';
import { generateSeedAssignments, calculateDutyStats, detectConflicts } from './src/data/rosterGenerator';
import { generateOfficialMonthAssignments, getOfficialParadeStateDocument } from './src/data/officialJulyAugustData';
import { Airman, DutyAssignment, FlightName, ParadeShift, ActivityHistoryItem, DutyCategoryCode, IDAShift, ImportHistoryBatch } from './src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'baf_unit_data.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'app_settings.json');


function loadAppSettings(): Record<string, { setting_key: string; setting_value: string; updated_at: string }> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading app_settings.json:', err);
  }
  return {};
}

function saveAppSettings(settings: Record<string, { setting_key: string; setting_value: string; updated_at: string }>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save app_settings.json:', err);
  }
}

const CANTEEN_MEMBERS_FILE = path.join(DATA_DIR, 'canteen_members.json');
const CANTEEN_TXS_FILE = path.join(DATA_DIR, 'canteen_transactions.json');
const CANTEEN_EXPENSES_FILE = path.join(DATA_DIR, 'canteen_expenses.json');

function loadCanteenMembers(): any[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(CANTEEN_MEMBERS_FILE)) {
      const raw = fs.readFileSync(CANTEEN_MEMBERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(raw);
      const memKeys = Object.keys(settings).filter(k => k.startsWith('canteen_member_'));
      const extracted: any[] = [];
      for (const k of memKeys) {
        try {
          const val = typeof settings[k].setting_value === 'string' ? JSON.parse(settings[k].setting_value) : settings[k].setting_value;
          const cleanBd = String(val.bdNo || k.replace('canteen_member_', '')).replace(/\D/g, '');
          extracted.push({
            airman_id: 'airman-' + cleanBd,
            id: 'airman-' + cleanBd,
            'BD No': cleanBd,
            service_number: cleanBd,
            Surname: val.surname || val.name || '',
            Rank: val.rank || 'LAC',
            Contact: val.contact || '',
            Due: Number(val.due || 0),
            DP: val.dp || '',
            Role: val.role || 'Member',
            Seniority: val.seniority || 999,
            Name_BN: val.nameBn || '',
            Rank_BN: val.rankBn || '',
            active: true,
            ...val
          });
        } catch {}
      }
      if (extracted.length > 0) {
        extracted.sort((a, b) => (a.Seniority || 999) - (b.Seniority || 999));
        saveCanteenMembers(extracted);
        return extracted;
      }
    }
  } catch (err) {
    console.error('Error reading canteen_members.json:', err);
  }
  return [];
}


function saveCanteenMembers(members: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CANTEEN_MEMBERS_FILE, JSON.stringify(members, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save canteen_members.json:', err);
  }
}

function loadCanteenTransactions(): any[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(CANTEEN_TXS_FILE)) {
      const raw = fs.readFileSync(CANTEEN_TXS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading canteen_transactions.json:', err);
  }
  return [];
}

function saveCanteenTransactions(txs: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CANTEEN_TXS_FILE, JSON.stringify(txs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save canteen_transactions.json:', err);
  }
}

function loadCanteenExpenses(): any[] {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(CANTEEN_EXPENSES_FILE)) {
      const raw = fs.readFileSync(CANTEEN_EXPENSES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading canteen_expenses.json:', err);
  }
  return [];
}

function saveCanteenExpenses(exp: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CANTEEN_EXPENSES_FILE, JSON.stringify(exp, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save canteen_expenses.json:', err);
  }
}


interface LocalDB {
  airmen: Airman[];
  assignments: Record<string, DutyAssignment[]>; // monthKey YYYY-MM -> DutyAssignment[]
  activityHistory?: ActivityHistoryItem[];
  adminPasscode?: string;
  importHistory?: ImportHistoryBatch[];
}

function normalizeFlightName(flight: string): FlightName {
  if (flight === 'Avionic Flight' || flight === 'Avionic') return 'Avionics';
  if (flight === 'Mech Flight' || flight === 'Mech') return 'Mechanics';
  if (flight === 'GCS Flight') return 'GCS';
  if (flight === 'Admin Flight') return 'Admin';
  if (flight === 'Avionics' || flight === 'Mechanics' || flight === 'GCS' || flight === 'Admin') {
    return flight as FlightName;
  }
  return 'Admin';
}

// Ensure data file exists or seed it
function loadDatabase(): LocalDB {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.airmen)) {
        // Preserve existing user modifications and custom airmen
        const existingMap = new Map<string, Airman>();
        parsed.airmen.forEach((a: Airman) => {
          if (a && a.id) existingMap.set(a.id, a);
          if (a && a.bdNo) existingMap.set(a.bdNo, a);
        });

        // Ensure baseline airmen exist while giving 100% priority to user's saved edits
        const finalAirmen: Airman[] = [];
        INITIAL_AIRMEN.forEach((initA) => {
          const existing = existingMap.get(initA.id) || existingMap.get(initA.bdNo);
          if (existing) {
            finalAirmen.push({
              ...initA,
              ...existing,
              fullName: (existing.fullName && existing.fullName !== existing.name) ? existing.fullName : (initA.fullName || existing.fullName || existing.name),
              flightName: existing.flightName || (existing as any).flight || (existing as any).Flight || initA.flightName || 'Admin',
              email: (existing as any).email || (existing as any).gmail || undefined,
            });
          } else {
            finalAirmen.push(initA);
          }
        });

        // Add any newly created custom airmen that were not in INITIAL_AIRMEN
        parsed.airmen.forEach((a: Airman) => {
          if (a && !finalAirmen.some((f) => f.id === a.id || f.bdNo === a.bdNo)) {
            finalAirmen.push(a);
          }
        });

        parsed.airmen = finalAirmen.sort((a, b) => (a.serNo || 999) - (b.serNo || 999));
        if (!parsed.assignments || typeof parsed.assignments !== 'object') {
          parsed.assignments = {};
        }
        if (!parsed.activityHistory || !Array.isArray(parsed.activityHistory)) {
          parsed.activityHistory = [];
        }
        if (!parsed.adminPasscode) {
          parsed.adminPasscode = '1124';
        }
        if (!parsed.importHistory || !Array.isArray(parsed.importHistory)) {
          parsed.importHistory = [];
        }
        if (!parsed.assignments['2026-07'] || parsed.assignments['2026-07'].length < 50) {
          parsed.assignments['2026-07'] = generateOfficialMonthAssignments(2026, 7);
        }
        if (!parsed.assignments['2026-08'] || parsed.assignments['2026-08'].length < 50) {
          parsed.assignments['2026-08'] = generateOfficialMonthAssignments(2026, 8);
        }
        // Clean any placeholder notes in assignments
        Object.keys(parsed.assignments || {}).forEach((k) => {
          if (Array.isArray(parsed.assignments[k])) {
            parsed.assignments[k].forEach((a: any) => {
              if (a.notes && typeof a.notes === 'string' && a.notes.toLowerCase().includes('imported')) {
                a.notes = '';
              }
            });
          }
        });
        saveDatabase(parsed);
        return parsed as LocalDB;
      }
    } catch (err) {
      console.error('Error reading DB_FILE, re-seeding:', err);
    }
  }

  // Generate clean initial database with official July and August rosters
  const db: LocalDB = {
    airmen: [...INITIAL_AIRMEN],
    assignments: {
      '2026-07': generateOfficialMonthAssignments(2026, 7),
      '2026-08': generateOfficialMonthAssignments(2026, 8),
    },
    activityHistory: [],
    adminPasscode: '1124',
    importHistory: [],
  };

  saveDatabase(db);
  return db;
}

const sseClients = new Set<express.Response>();

function broadcastRealtimeEvent(type: string = 'DATA_UPDATED', payload: any = {}) {
  const data = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function saveDatabase(db: LocalDB, eventType: string = 'DATA_UPDATED') {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    broadcastRealtimeEvent(eventType);
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

async function startServer() {
  const app = express();
  const portArgIdx = process.argv.indexOf('--port');
  const portFromArg = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? parseInt(process.argv[portArgIdx + 1], 10) : NaN;
  const PORT = !isNaN(portFromArg) ? portFromArg : 3000;

  const hostArgIdx = process.argv.indexOf('--host');
  const HOST = hostArgIdx !== -1 && process.argv[hostArgIdx + 1] ? process.argv[hostArgIdx + 1] : (process.env.HOST || '0.0.0.0');

  let db = loadDatabase();


  app.all('/api/supabase/*', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    let targetUrl = '';
    function handleCanteenFallback(urlString: string, bodyData: any): boolean {
      try {
        const urlObj = new URL(urlString, 'http://localhost');
        const pathname = urlObj.pathname;

        // 1. APP_SETTINGS
        if (pathname.includes('/rest/v1/app_settings')) {
          const settings = loadAppSettings();
          if (req.method === 'GET') {
            let rows = Object.values(settings);
            const settingKeyParam = urlObj.searchParams.get('setting_key');
            if (settingKeyParam) {
              if (settingKeyParam.startsWith('like.')) {
                const prefix = settingKeyParam.slice(5).replace(/[%_]/g, '');
                rows = rows.filter(r => r.setting_key.startsWith(prefix));
              } else if (settingKeyParam.startsWith('eq.')) {
                const targetKey = settingKeyParam.slice(3);
                rows = rows.filter(r => r.setting_key === targetKey);
              }
            }
            res.setHeader('content-type', 'application/json');
            const accept = String(req.headers['accept'] || '');
            if (accept.includes('application/vnd.pgrst.object+json')) {
              res.status(200).send(JSON.stringify(rows[0] || null));
              return true;
            }
            res.status(200).send(JSON.stringify(rows));
            return true;
          } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            try {
              let parsedBody = bodyData;
              if (typeof parsedBody === 'string') {
                try { parsedBody = JSON.parse(parsedBody); } catch {}
              } else if (Buffer.isBuffer(parsedBody)) {
                try { parsedBody = JSON.parse(parsedBody.toString()); } catch {}
              }
              const items = Array.isArray(parsedBody) ? parsedBody : (parsedBody ? [parsedBody] : []);
              for (const it of items) {
                if (it && it.setting_key) {
                  settings[it.setting_key] = {
                    setting_key: it.setting_key,
                    setting_value: typeof it.setting_value === 'string' ? it.setting_value : JSON.stringify(it.setting_value),
                    updated_at: it.updated_at || new Date().toISOString()
                  };
                }
              }
              saveAppSettings(settings);
              res.setHeader('content-type', 'application/json');
              res.status(201).send(JSON.stringify(items));
              return true;
            } catch (pErr) {
              console.warn('[Proxy Fallback] Could not parse app_settings body:', pErr);
            }
          }
        }

        // 2. CANTEEN_MEMBER
        if (pathname.includes('/rest/v1/Canteen_Member')) {
          let members = loadCanteenMembers();
          if (req.method === 'GET') {
            const airmanIdParam = urlObj.searchParams.get('airman_id');
            const bdNoParam = urlObj.searchParams.get('BD No');
            if (airmanIdParam && airmanIdParam.startsWith('eq.')) {
              const target = airmanIdParam.slice(3).toLowerCase();
              members = members.filter(m => String(m.airman_id || '').toLowerCase() === target || String(m['BD No'] || '').toLowerCase() === target);
            } else if (bdNoParam && bdNoParam.startsWith('eq.')) {
              const target = bdNoParam.slice(3).toLowerCase();
              members = members.filter(m => String(m['BD No'] || '').toLowerCase() === target);
            }
            res.setHeader('content-type', 'application/json');
            const accept = String(req.headers['accept'] || '');
            if (accept.includes('application/vnd.pgrst.object+json')) {
              res.status(200).send(JSON.stringify(members[0] || null));
              return true;
            }
            res.status(200).send(JSON.stringify(members));
            return true;
          } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            try {
              let parsedBody = bodyData;
              if (typeof parsedBody === 'string') {
                try { parsedBody = JSON.parse(parsedBody); } catch {}
              } else if (Buffer.isBuffer(parsedBody)) {
                try { parsedBody = JSON.parse(parsedBody.toString()); } catch {}
              }
              const incoming = Array.isArray(parsedBody) ? parsedBody : (parsedBody ? [parsedBody] : []);
              for (const inc of incoming) {
                if (!inc) continue;
                const incAid = String(inc.airman_id || inc.id || '').trim().toLowerCase();
                const incBd = String(inc['BD No'] || inc.bdNo || '').replace(/\D/g, '');
                const idx = members.findIndex(m => {
                  const mAid = String(m.airman_id || m.id || '').trim().toLowerCase();
                  const mBd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '');
                  return (incAid && mAid === incAid) || (incBd && mBd === incBd);
                });
                if (idx !== -1) {
                  members[idx] = {
                    ...members[idx],
                    ...inc,
                    DP: inc.DP !== undefined && inc.DP !== '' ? inc.DP : members[idx].DP,
                    Due: inc.Due !== undefined ? Number(inc.Due) : members[idx].Due,
                    Contact: inc.Contact || members[idx].Contact
                  };
                } else {
                  members.push({
                    airman_id: inc.airman_id || (incBd ? `airman-${incBd}` : `airman-${Date.now()}`),
                    "BD No": inc['BD No'] || incBd || '',
                    Rank: inc.Rank || 'LAC',
                    Surname: inc.Surname || inc.name || '',
                    DP: inc.DP || '',
                    Due: Number(inc.Due) || 0,
                    Contact: inc.Contact || '',
                    Role: inc.Role || 'Member',
                    Flight: inc.Flight || 'Admin',
                    Trade: inc.Trade || '',
                    active: true,
                    ...inc
                  });
                }
              }
              saveCanteenMembers(members);
              res.setHeader('content-type', 'application/json');
              res.status(201).send(JSON.stringify(incoming));
              return true;
            } catch (err) {
              console.warn('[Proxy Fallback] Error saving Canteen_Member:', err);
            }
          } else if (req.method === 'DELETE') {
            const airmanIdParam = urlObj.searchParams.get('airman_id');
            const bdNoParam = urlObj.searchParams.get('BD No');
            if (airmanIdParam && airmanIdParam.startsWith('eq.')) {
              const target = airmanIdParam.slice(3).toLowerCase();
              members = members.filter(m => String(m.airman_id || '').toLowerCase() !== target);
            }
            if (bdNoParam && bdNoParam.startsWith('eq.')) {
              const target = bdNoParam.slice(3).toLowerCase();
              members = members.filter(m => String(m['BD No'] || '').toLowerCase() !== target);
            }
            saveCanteenMembers(members);
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify({ success: true }));
            return true;
          }
        }

        // 3. CANTEEN_TRANSACTIONS
        if (pathname.includes('/rest/v1/Canteen_Transactions')) {
          let txs = loadCanteenTransactions();
          if (req.method === 'GET') {
            const airmanIdParam = urlObj.searchParams.get('airman_id');
            const monthKeyParam = urlObj.searchParams.get('month_key');
            if (airmanIdParam && airmanIdParam.startsWith('eq.')) {
              const target = airmanIdParam.slice(3).toLowerCase();
              txs = txs.filter(t => String(t.airman_id || '').toLowerCase() === target || String(t.bd_no || '').toLowerCase() === target);
            }
            if (monthKeyParam && monthKeyParam.startsWith('eq.')) {
              const target = monthKeyParam.slice(3);
              txs = txs.filter(t => String(t.month_key) === target);
            }
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify(txs));
            return true;
          } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            try {
              let parsedBody = bodyData;
              if (typeof parsedBody === 'string') {
                try { parsedBody = JSON.parse(parsedBody); } catch {}
              } else if (Buffer.isBuffer(parsedBody)) {
                try { parsedBody = JSON.parse(parsedBody.toString()); } catch {}
              }
              const incoming = Array.isArray(parsedBody) ? parsedBody : (parsedBody ? [parsedBody] : []);
              for (const inc of incoming) {
                if (!inc) continue;
                const id = inc.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const idx = txs.findIndex(t => t.id === id);
                if (idx !== -1) {
                  txs[idx] = { ...txs[idx], ...inc };
                } else {
                  txs.push({ ...inc, id });
                }
              }
              saveCanteenTransactions(txs);
              res.setHeader('content-type', 'application/json');
              res.status(201).send(JSON.stringify(incoming));
              return true;
            } catch (err) {
              console.warn('[Proxy Fallback] Error saving Canteen_Transactions:', err);
            }
          }
        }

        // 4. CANTEEN_EXPENSES
        if (pathname.includes('/rest/v1/Canteen_Expenses')) {
          let exp = loadCanteenExpenses();
          if (req.method === 'GET') {
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify(exp));
            return true;
          } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            try {
              let parsedBody = bodyData;
              if (typeof parsedBody === 'string') {
                try { parsedBody = JSON.parse(parsedBody); } catch {}
              } else if (Buffer.isBuffer(parsedBody)) {
                try { parsedBody = JSON.parse(parsedBody.toString()); } catch {}
              }
              const incoming = Array.isArray(parsedBody) ? parsedBody : (parsedBody ? [parsedBody] : []);
              for (const inc of incoming) {
                if (!inc) continue;
                const id = inc.id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const idx = exp.findIndex(e => e.id === id);
                if (idx !== -1) {
                  exp[idx] = { ...exp[idx], ...inc };
                } else {
                  exp.push({ ...inc, id });
                }
              }
              saveCanteenExpenses(exp);
              res.setHeader('content-type', 'application/json');
              res.status(201).send(JSON.stringify(incoming));
              return true;
            } catch (err) {
              console.warn('[Proxy Fallback] Error saving Canteen_Expenses:', err);
            }
          }
        }

        // 5. CANTEEN_MENU
        if (pathname.includes('/rest/v1/Canteen_Menu')) {
          const settings = loadAppSettings();
          let menuStr = settings['canteen_menu_items_catalog_v1']?.setting_value;
          let menuList: any[] = [];
          if (menuStr) {
            try { menuList = JSON.parse(menuStr); } catch {}
          }
          if (req.method === 'GET') {
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify(menuList));
            return true;
          }
        }

        // 6. USER_PROFILES (Office App User Logins)
        if (pathname.includes('/rest/v1/user_profiles')) {
          const dbData = loadDatabase();
          let users: any[] = (dbData.airmen || []).map((a: any) => {
            const cleanBd = String(a.bdNo || '').replace(/^BD\/?/i, '').trim();
            const isOwner = cleanBd === '48456';
            return {
              'User ID': cleanBd,
              airman_id: a.id || `airman-${cleanBd}`,
              Name: a.fullName || a.name || 'Airman',
              'Full Name': a.fullName || a.name || 'Airman',
              fullName: a.fullName || a.name || 'Airman',
              Surname: a.name || a.fullName || 'Airman',
              Rank: a.rank || 'LAC',
              Flight: a.flightName || 'Admin',
              Trade: a.trade || 'General',
              Role: isOwner ? 'OWNER' : 'USER',
              'User Login PIN': Number(cleanBd) || null,
              'Admin Login PIN': isOwner ? 1124 : null,
              Status: 'ACTIVE',
              password: cleanBd
            };
          });

          const cMems = loadCanteenMembers();
          cMems.forEach((cm: any) => {
            const cleanBd = String(cm['BD No'] || cm.bdNo || '').replace(/\D/g, '');
            if (cleanBd && !users.some(u => u['User ID'] === cleanBd)) {
              users.push({
                'User ID': cleanBd,
                airman_id: cm.airman_id || `airman-${cleanBd}`,
                Name: cm.Surname || cm.name || 'Member',
                Rank: cm.Rank || 'LAC',
                Flight: cm.Flight || 'Admin',
                Trade: cm.Trade || 'General',
                Role: cleanBd === '48456' ? 'OWNER' : 'USER',
                'User Login PIN': Number(cleanBd) || null,
                'Admin Login PIN': cleanBd === '48456' ? 1124 : null,
                Status: 'ACTIVE',
                password: cleanBd
              });
            }
          });

          if (req.method === 'GET') {
            const userIdParam = urlObj.searchParams.get('User ID');
            if (userIdParam && userIdParam.startsWith('eq.')) {
              const target = userIdParam.slice(3).replace(/^BD\/?/i, '').trim().toLowerCase();
              users = users.filter(u => String(u['User ID']).toLowerCase() === target);
            }
            res.setHeader('content-type', 'application/json');
            const accept = String(req.headers['accept'] || '');
            if (accept.includes('application/vnd.pgrst.object+json')) {
              res.status(200).send(JSON.stringify(users[0] || null));
              return true;
            }
            res.status(200).send(JSON.stringify(users));
            return true;
          } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify({ success: true }));
            return true;
          }
        }

        // 7. AIRMEN / BIODATA REGISTER
        if (pathname.includes('/rest/v1/airmen') || pathname.includes('/rest/v1/Biodata')) {
          const dbData = loadDatabase();
          if (req.method === 'GET') {
            const formatted = (dbData.airmen || []).map((a: any) => ({
              ...a,
              airman_id: a.id || a.airman_id,
              "BD No": a.bdNo || a["BD No"] || '',
              "Rank": a.rank || a.Rank || '',
              "Surname": a.name || a.Surname || '',
              "Full Name": a.fullName || a.name || '',
              "Flight": a.flightName || a.Flight || 'Admin',
              "Trade": a.trade || a.Trade || 'General',
              "Mobile No": a.mobileNo || a["Mobile No"] || '',
              "Present Address": a.addressBlock || a["Present Address"] || '',
              "Permanent Address": a.permanentAddress || a["Permanent Address"] || '',
              "Status": (a.active !== false) ? 'ACTIVE' : 'INACTIVE',
              "Seniority": a.seniority !== undefined ? a.seniority : (a.serNo || 1),
              active: a.active !== false,
              status: (a.active !== false) ? 'ACTIVE' : 'INACTIVE',
              flightName: a.flightName || a.Flight || 'Admin',
              name: a.name || a.Surname || '',
              rank: a.rank || a.Rank || '',
              trade: a.trade || a.Trade || 'General',
              bdNo: a.bdNo || a["BD No"] || ''
            }));
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify(formatted));
            return true;
          }
        }

        // 8. DUTY_ROSTERS (Duty Assignments)
        if (pathname.includes('/rest/v1/duty_rosters')) {
          const dbData = loadDatabase();
          if (req.method === 'GET') {
            const allAssignments: any[] = [];
            Object.values(dbData.assignments || {}).forEach((arr: any) => {
              if (Array.isArray(arr)) {
                arr.forEach((a: any) => {
                  allAssignments.push({
                    id: a.id || `${a.airmanId}_${a.date}_${a.dutyCode}`,
                    airman_id: a.airmanId,
                    duty_date: a.date,
                    duty_type: a.dutyCode,
                    shift: a.idaShift || null,
                    notes: a.notes || null,
                    created_at: a.updatedAt || new Date().toISOString()
                  });
                });
              }
            });
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify(allAssignments));
            return true;
          } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify({ success: true }));
            return true;
          }
        }

        // 9. PARADE_STATES
        if (pathname.includes('/rest/v1/parade_states')) {
          const dbData = loadDatabase();
          if (req.method === 'GET') {
            const history = (dbData.activityHistory || []).map((h: any, idx: number) => ({
              id: h.id || `parade_${idx}`,
              date: h.timestamp || h.date || new Date().toISOString(),
              type: h.actionType || h.type || 'PARADE_STATE',
              count: h.count || 0,
              notes: h.details || h.notes || '',
              details: typeof h.details === 'string' ? h.details : JSON.stringify(h.details || {})
            }));
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify(history));
            return true;
          }
        }

        // 10. APP_SETTINGS
        if (pathname.includes('/rest/v1/app_settings')) {
          const settings = loadAppSettings();
          if (req.method === 'GET') {
            const list = Object.values(settings);
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify(list));
            return true;
          }
        }
      } catch (fErr) {
        console.warn('[Proxy Fallback] Exception handling canteen fallback:', fErr);
      }
      return false;
    }

    targetUrl = req.originalUrl.replace('/api/supabase', '');
    if (handleCanteenFallback(targetUrl, req.body)) {
      return;
    }
    res.status(200).json({ success: true, message: 'Handled via local store' });
  });

  // Dedicated Office App Unit Data Endpoints
  app.get('/api/airmen', (req, res) => {
    const db = loadDatabase();
    res.json(db.airmen || []);
  });

  app.get('/api/database', (req, res) => {
    const db = loadDatabase();
    res.json(db);
  });

  app.post('/api/database/save', express.json({ limit: '50mb' }), (req, res) => {
    try {
      const incomingDb = req.body;
      if (incomingDb && (incomingDb.airmen || incomingDb.assignments)) {
        // Strict deduplication by BD number digits before saving
        if (Array.isArray(incomingDb.airmen)) {
          const seen = new Set<string>();
          const cleanAirmen: any[] = [];
          incomingDb.airmen.forEach((a: any) => {
            const digits = String(a.bdNo || a.id || '').replace(/\D/g, '');
            const k = digits || a.id || a.bdNo;
            if (k && !seen.has(k)) {
              seen.add(k);
              cleanAirmen.push(a);
            }
          });
          incomingDb.airmen = cleanAirmen;
        }

        // Strict deduplication of assignments
        if (incomingDb.assignments && typeof incomingDb.assignments === 'object') {
          Object.keys(incomingDb.assignments).forEach((m) => {
            const list = incomingDb.assignments[m] || [];
            const seen = new Set<string>();
            const cleanList: any[] = [];
            list.forEach((asn: any) => {
              const airDigits = String(asn.airmanId || '').replace(/\D/g, '');
              const shift = asn.idaShift || asn.shift || 'n';
              const scope = asn.disposalScope || 'ALL';
              const k = `${airDigits}_${asn.date}_${asn.dutyCode}_${shift}_${scope}`;
              if (!seen.has(k)) {
                seen.add(k);
                cleanList.push(asn);
              }
            });
            incomingDb.assignments[m] = cleanList;
          });
        }

        saveDatabase(incomingDb, 'DATABASE_UPDATED');
        return res.json({ success: true, message: 'Database saved successfully' });
      }
      return res.status(400).json({ error: 'Invalid database payload' });
    } catch (err: any) {
      console.error('Error saving database via /api/database/save:', err);
      return res.status(500).json({ error: err.message || 'Failed to save database' });
    }
  });

  app.get('/api/full-system-backup', (req, res) => {
    try {
      const db = loadDatabase();
      const members = loadCanteenMembers();
      const transactions = loadCanteenTransactions();
      const expenses = loadCanteenExpenses();
      const settings = Object.values(loadAppSettings());
      res.json({
        version: '3.0',
        app: '155 UASU BAF Office Management & Duty Register System',
        exportedAt: new Date().toISOString(),
        baf_unit_data: db,
        canteen: {
          members,
          transactions,
          expenses,
          settings,
        },
        counts: {
          airmen: db.airmen?.length || 0,
          assignments: Object.values(db.assignments || {}).reduce((acc: number, list: any) => acc + (list?.length || 0), 0),
          canteenMembers: members.length,
          transactions: transactions.length,
          settings: settings.length,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate full system backup' });
    }
  });

  app.post('/api/full-system-restore', express.json({ limit: '50mb' }), (req, res) => {
    try {
      const { baf_unit_data, canteen, localSettings, dutySettings, app_settings } = req.body || {};
      let restoredAirmen = 0;
      let restoredAssignments = 0;
      let restoredMembers = 0;
      let restoredTxs = 0;
      let restoredSettings = 0;

      if (baf_unit_data && (baf_unit_data.airmen || baf_unit_data.assignments)) {
        saveDatabase(baf_unit_data, 'DATABASE_RESTORED');
        restoredAirmen = baf_unit_data.airmen?.length || 0;
        restoredAssignments = Number((Object.values(baf_unit_data.assignments || {}) as any[]).reduce((acc: number, list: any) => acc + (list?.length || 0), 0));
      }

      if (canteen) {
        if (Array.isArray(canteen.members) && canteen.members.length > 0) {
          saveCanteenMembers(canteen.members);
          restoredMembers = canteen.members.length;
        }
        if (Array.isArray(canteen.transactions) && canteen.transactions.length > 0) {
          saveCanteenTransactions(canteen.transactions);
          restoredTxs = canteen.transactions.length;
        }
        if (Array.isArray(canteen.expenses) && canteen.expenses.length > 0) {
          saveCanteenExpenses(canteen.expenses);
        }
      }

      const currentSettings = loadAppSettings();
      let settingsModified = false;
      const nowIso = new Date().toISOString();
      const skipSettingKeys = new Set([
        'baf_local_storage_snapshot',
        'baf_drive_cloud_snapshot',
        'baf_backup_restore_history_v1',
        'baf_155_uasu_v2_db',
        'baf_database_v2',
        'canteen_members',
        'canteen_members_cache',
        'canteen_transactions',
        'canteen_txs',
      ]);

      const applySettingArray = (arr: any) => {
        if (!Array.isArray(arr)) return;
        for (const s of arr) {
          if (s && s.setting_key && s.setting_value !== undefined && !skipSettingKeys.has(s.setting_key)) {
            currentSettings[s.setting_key] = {
              setting_key: s.setting_key,
              setting_value: typeof s.setting_value === 'string' ? s.setting_value : JSON.stringify(s.setting_value),
              updated_at: s.updated_at || nowIso
            };
            settingsModified = true;
            restoredSettings++;
          }
        }
      };

      if (canteen?.settings) applySettingArray(canteen.settings);
      if (app_settings) applySettingArray(app_settings);

      if (localSettings && typeof localSettings === 'object' && !Array.isArray(localSettings)) {
        for (const [k, v] of Object.entries(localSettings)) {
          if (k && v !== undefined && v !== null && !skipSettingKeys.has(k)) {
            currentSettings[k] = {
              setting_key: k,
              setting_value: typeof v === 'string' ? v : JSON.stringify(v),
              updated_at: nowIso
            };
            settingsModified = true;
            restoredSettings++;
          }
        }
      }

      if (dutySettings && typeof dutySettings === 'object') {
        const dutyKeyMap: Record<string, string> = {
          dutyMatrix: 'baf_official_duty_matrix_v4',
          dutyRatioHistory: 'baf_duty_ratio_history_v1',
          customDuties: 'baf_custom_duties_v1',
          distributionManpower: 'baf_duty_distribution_manpower',
          distributionDisposals: 'baf_duty_distribution_disposals_master',
          distributionTotalDuty: 'baf_duty_distribution_total_duty',
          distributionCustomFlt: 'baf_duty_distribution_custom_flt',
        };
        for (const [field, storageKey] of Object.entries(dutyKeyMap)) {
          if (dutySettings[field] !== undefined && dutySettings[field] !== null) {
            currentSettings[storageKey] = {
              setting_key: storageKey,
              setting_value: typeof dutySettings[field] === 'string' ? dutySettings[field] : JSON.stringify(dutySettings[field]),
              updated_at: nowIso
            };
            settingsModified = true;
            restoredSettings++;
          }
        }
      }

      if (settingsModified) {
        saveAppSettings(currentSettings);
      }

      broadcastRealtimeEvent('FULL_SYSTEM_RESTORED');
      res.json({
        success: true,
        restoredAirmen,
        restoredAssignments,
        restoredMembers,
        restoredTxs,
        restoredSettings,
      });
    } catch (err: any) {
      console.error('Full system restore error:', err);
      res.status(500).json({ error: err.message || 'Full system restore failed' });
    }
  });

  app.get('/api/duty-assignments', (req, res) => {
    const db = loadDatabase();
    res.json(db.assignments || {});
  });

  app.get('/api/parade-state', (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const shift = (req.query.shift as string) || 'Morning';
    const flight = (req.query.flight as string) || 'Overall';
    const db = loadDatabase();
    const allAirmen = (db.airmen || []).filter((a: any) => a.active !== false);
    const targetAirmen = flight === 'Overall' ? allAirmen : allAirmen.filter((a: any) => a.flightName === flight);
    const monthKey = date.slice(0, 7);
    const dateAssignments = (db.assignments?.[monthKey] || []).filter((a: any) => a.date === date);

    let onParade = 0;
    let onDuty = 0;
    let onLeave = 0;
    let tdy = 0;
    let otherOff = 0;

    const personnelStatusList = targetAirmen.map((airman: any) => {
      const airDigits = String(airman.bdNo || airman.id || '').replace(/\D/g, '');
      const match = dateAssignments.find((a: any) => {
        if (a.airmanId === airman.id || a.airmanId === airman.bdNo) return true;
        const aNorm = String(a.airmanId || '').replace(/[\/_]/g, '');
        const airNorm = String(airman.id || airman.bdNo || '').replace(/[\/_]/g, '');
        if (aNorm && airNorm && aNorm === airNorm) return true;
        const aDigits = String(a.airmanId || '').replace(/\D/g, '');
        return Boolean(airDigits && aDigits && aDigits === airDigits);
      });
      const dutyCode = match?.dutyCode || 'ON_PARADE';
      const isIdac = ['IDAC', 'IDA', 'IDA C', 'IDA_C'].includes(dutyCode);
      const isIdacNt = isIdac && (
        String(match?.idaShift || (match as any)?.shift || '').toLowerCase().includes('night') ||
        String(match?.idaShift || (match as any)?.shift || '').toLowerCase().includes('nt') ||
        String(match?.notes || '').toLowerCase().includes('night') ||
        String(match?.notes || '').toLowerCase().includes('nt')
      );
      let statusCategory = 'PARADE';
      if (dutyCode === 'ON_PARADE' || (shift === 'Morning' && isIdacNt)) { 
        onParade++; 
        statusCategory = 'PARADE'; 
      }
      else if (dutyCode === 'LEAVE') { onLeave++; statusCategory = 'LEAVE'; }
      else if (['TDY', 'ATT', 'DETT'].includes(dutyCode)) { tdy++; statusCategory = 'TDY'; }
      else if (dutyCode === 'DUTY_OFF') { otherOff++; statusCategory = 'OFF'; }
      else { onDuty++; statusCategory = 'DUTY'; }

      let dutyName = dutyCode === 'ON_PARADE' ? 'On Parade' : dutyCode;
      const isCustomCode = dutyCode.startsWith('CUST_') || dutyCode.startsWith('cust_') || dutyCode.includes('1794394');
      if (isCustomCode) {
        if ((match as any)?.dutyName && !(match as any).dutyName.startsWith('CUST_')) {
          dutyName = (match as any).dutyName;
        } else if (dutyCode.includes('1794394')) {
          dutyName = 'Escort Duty';
        } else {
          try {
            const settings = loadAppSettings();
            const rawCustom = settings?.['baf_custom_duties_v1']?.setting_value;
            if (rawCustom) {
              const parsed = JSON.parse(rawCustom);
              if (Array.isArray(parsed)) {
                const found = parsed.find((p: any) => p.code === dutyCode);
                if (found?.name) dutyName = found.name;
              }
            }
            if (dutyName === dutyCode) {
              const rawMatrix = settings?.['baf_official_duty_matrix_v4']?.setting_value;
              if (rawMatrix) {
                const parsed = JSON.parse(rawMatrix);
                if (Array.isArray(parsed)) {
                  const found = parsed.find((p: any) => p.id === dutyCode || p.dutyCode === dutyCode);
                  if (found?.title) dutyName = found.title;
                }
              }
            }
          } catch {}
          if (dutyName === dutyCode) {
            dutyName = 'Escort Duty';
          }
        }
      } else if (['IDAC', 'IDA', 'IDA C', 'IDA_C'].includes(dutyCode)) {
        const s = match?.idaShift || (match as any)?.shift || 'Morning';
        dutyName = `IDAC Duty (${s})`;
      } else if (dutyCode === 'LEAVE') {
        const notesLower = (match?.notes || '').toLowerCase();
        const rawDuty = (((match as any)?.dutyName || '') as string).toLowerCase();
        const comb = `${notesLower} ${rawDuty}`;
        if (comb.includes('recreation') || comb.includes('(rl)') || comb.includes(' rl') || comb.includes('rec leave') || comb.includes('rec.')) {
          dutyName = 'Recreation Leave (RL)';
        } else if (comb.includes('annual') || comb.includes('(al)') || comb.includes(' al')) {
          dutyName = 'Annual Leave (AL)';
        } else if (comb.includes('sick') || comb.includes('(sl)') || comb.includes(' sl')) {
          dutyName = 'Sick Leave (SL)';
        } else if (comb.includes('casual') || comb.includes('(cl)') || comb.includes(' cl')) {
          dutyName = 'Casual Leave (CL)';
        } else if ((match as any)?.dutyName && (match as any).dutyName !== 'LEAVE') {
          dutyName = (match as any).dutyName;
        } else if (match?.notes && !notesLower.includes('imported')) {
          dutyName = match.notes;
        } else {
          dutyName = 'Casual Leave (CL)';
        }
      }

      return {
        airman,
        dutyCode,
        dutyName,
        idaShift: match?.idaShift || (match as any)?.shift,
        statusCategory,
        notes: match?.notes || ''
      };
    });

    res.json({
      date,
      shift,
      flight,
      summary: {
        totalStrength: targetAirmen.length,
        onParade,
        onDuty,
        onLeave,
        tdy,
        otherOff,
        bakeNBite: 0
      },
      flightBreakdown: {},
      personnelStatusList
    });
  });

  app.get('/api/analytics', (req, res) => {
    const db = loadDatabase();
    res.json({
      totalPersonnel: (db.airmen || []).filter((a: any) => a.active !== false).length,
      assignments: [],
      conflictAlerts: []
    });
  });

  app.get('/api/roster', (req, res) => {
    const month = (req.query.month as string) || `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const db = loadDatabase();
    const assignments = (db.assignments && db.assignments[month]) || [];
    res.json({ monthKey: month, assignments });
  });

  app.get('/api/roster/year', (req, res) => {
    const year = parseInt((req.query.year as string) || `${new Date().getFullYear()}`, 10);
    const db = loadDatabase();
    const prefix = `${year}-`;
    const assignments: any[] = [];
    if (db.assignments) {
      Object.keys(db.assignments).forEach((mKey) => {
        if (mKey.startsWith(prefix)) {
          assignments.push(...(db.assignments[mKey] || []));
        }
      });
    }
    res.json({ year, assignments });
  });

  app.get('/api/roster/server-history', (req, res) => {
    const db = loadDatabase();
    res.json({ history: db.activityHistory || [] });
  });

  app.get('/api/roster/history', (req, res) => {
    const db = loadDatabase();
    res.json({ history: db.activityHistory || [] });
  });

  app.post('/api/roster/delete-history-entry', express.json(), (req, res) => {
    const { historyId } = req.body || {};
    if (!historyId) return res.status(400).json({ error: 'Missing historyId' });
    const db = loadDatabase();
    if (db.activityHistory) {
      const idx = db.activityHistory.findIndex((h: any) => h.id === historyId);
      if (idx !== -1) {
        db.activityHistory.splice(idx, 1);
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
      }
    }
    res.json({ success: true });
  });

  function getDatesInRange(fromDateStr: string, toDateStr: string): string[] {
    const dates: string[] = [];
    const [fY, fM, fD] = fromDateStr.split('-').map(Number);
    const [tY, tM, tD] = toDateStr.split('-').map(Number);
    if (!fY || !fM || !fD || !tY || !tM || !tD) return [fromDateStr];
    const current = new Date(Date.UTC(fY, fM - 1, fD));
    const end = new Date(Date.UTC(tY, tM - 1, tD));
    while (current <= end) {
      const y = current.getUTCFullYear();
      const m = String(current.getUTCMonth() + 1).padStart(2, '0');
      const d = String(current.getUTCDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }

  app.post('/api/roster/assign-range', express.json(), (req, res) => {
    const { airmanId, dutyCode, idaShift, fromDate, toDate, notes, proxyForFlight, disposalScope } = req.body || {};
    if (!airmanId || !dutyCode || !fromDate) {
      return res.status(400).json({ error: 'Missing required parameters: airmanId, dutyCode, fromDate' });
    }
    const db = loadDatabase();
    if (!db.assignments) db.assignments = {};
    const dates = getDatesInRange(fromDate, toDate || fromDate);
    const airman = (db.airmen || []).find((a: any) => a.id === airmanId || a.bdNo === airmanId);

    for (const dateStr of dates) {
      const monthKey = dateStr.slice(0, 7);
      if (!db.assignments[monthKey]) db.assignments[monthKey] = [];
      const list = db.assignments[monthKey];

      const isIdac = ['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(dutyCode);
      const isAirport = ['ATT', 'AIRPORT', 'AIRFIELD_DUTY'].includes(dutyCode);
      const scope = disposalScope || 'ALL';

      const cleanTargetDigits = String(airmanId).replace(/\D/g, '');
      const matchAirmanId = (itemAirmanId: any) => {
        if (itemAirmanId === airmanId) return true;
        const c = String(itemAirmanId || '').replace(/\D/g, '');
        return Boolean(cleanTargetDigits && c && c === cleanTargetDigits);
      };

      let index = -1;
      if (isIdac) {
        if (idaShift === 'Night') {
          index = list.findIndex((a: any) => 
            matchAirmanId(a.airmanId) && a.date === dateStr &&
            ((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && (a.idaShift === 'Night' || a.shift === 'Night'))
          );
        } else {
          index = list.findIndex((a: any) =>
            matchAirmanId(a.airmanId) && a.date === dateStr &&
            !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && (a.idaShift === 'Night' || a.shift === 'Night'))
          );
        }
      } else if (isAirport) {
        index = list.findIndex((a: any) =>
          matchAirmanId(a.airmanId) && a.date === dateStr &&
          (a.dutyCode === 'AIRPORT' || a.dutyCode === 'ATT' || a.dutyCode === 'AIRFIELD_DUTY')
        );
      } else {
        index = list.findIndex((a: any) =>
          matchAirmanId(a.airmanId) && a.date === dateStr &&
          (a.disposalScope || 'ALL') === scope
        );
      }

      const assignmentObj: any = {
        id: `asn_${String(airmanId).replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr}_${dutyCode}_${idaShift || 'n'}_${scope}`,
        assignment_id: `asn_${String(airmanId).replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateStr}_${dutyCode}_${idaShift || 'n'}_${scope}`,
        airmanId,
        date: dateStr,
        dutyCode,
        dutyType: dutyCode,
        dutyName: dutyCode,
        idaShift: isIdac ? idaShift : undefined,
        shift: isIdac ? idaShift : undefined,
        notes: notes || '',
        proxyForFlight: proxyForFlight || undefined,
        disposalScope: scope,
        updatedAt: new Date().toISOString()
      };

      if (index >= 0) {
        list[index] = assignmentObj;
      } else {
        list.push(assignmentObj);
      }
    }

    if (!db.activityHistory) db.activityHistory = [];
    db.activityHistory.unshift({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      actionType: dutyCode === 'LEAVE' ? 'GRANT_LEAVE' : 'ASSIGN_RANGE',
      type: dutyCode === 'LEAVE' ? 'GRANT_LEAVE' : 'ASSIGN_RANGE',
      airmanId,
      airmanName: airman ? `${airman.rank || ''} ${airman.name || ''}`.trim() : airmanId,
      airmanRank: airman?.rank || '',
      airmanTrade: airman?.trade || '',
      dutyCode,
      idaShift,
      fromDate,
      toDate: toDate || fromDate,
      notes: notes || ''
    });
    if (db.activityHistory.length > 250) db.activityHistory = db.activityHistory.slice(0, 250);

    saveDatabase(db, 'DATABASE_UPDATED');
    res.json({ success: true, count: dates.length, assignedDates: dates });
  });

  app.post('/api/roster/delete-range', express.json(), (req, res) => {
    const { airmanId, fromDate, toDate, dutyCode, idaShift } = req.body || {};
    if (!airmanId || !fromDate) {
      return res.status(400).json({ error: 'Missing required parameters: airmanId, fromDate' });
    }
    const db = loadDatabase();
    if (!db.assignments) db.assignments = {};
    const dates = getDatesInRange(fromDate, toDate || fromDate);

    const cleanTargetDigits = String(airmanId).replace(/\D/g, '');
    const matchAirmanId = (itemAirmanId: any) => {
      if (itemAirmanId === airmanId) return true;
      const c = String(itemAirmanId || '').replace(/\D/g, '');
      return Boolean(cleanTargetDigits && c && c === cleanTargetDigits);
    };

    for (const dateStr of dates) {
      const monthKey = dateStr.slice(0, 7);
      if (!db.assignments[monthKey]) continue;
      db.assignments[monthKey] = db.assignments[monthKey].filter((a: any) => {
        if (!matchAirmanId(a.airmanId) || a.date !== dateStr) return true;
        if (dutyCode) {
          const isAirport = ['ATT', 'AIRPORT', 'AIRFIELD_DUTY', 'AIRFIELD'].includes(dutyCode);
          if (isAirport) {
            return !['ATT', 'AIRPORT', 'AIRFIELD_DUTY', 'AIRFIELD'].includes(a.dutyCode);
          }
          const isGd = ['GD', 'BASE_SECURITY', 'SECURITY', 'BASE SECURITY DUTY'].includes(dutyCode);
          if (isGd) {
            return !['GD', 'BASE_SECURITY', 'SECURITY', 'BASE SECURITY DUTY'].includes(a.dutyCode) && !(a.dutyName && a.dutyName.toUpperCase().includes('SECURITY'));
          }
          if (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(dutyCode)) {
            if (idaShift) {
              return !((a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') && (a.idaShift === idaShift || a.shift === idaShift));
            }
            return !(a.dutyCode === 'IDAC' || a.dutyCode === 'IDA');
          }
          return a.dutyCode !== dutyCode;
        }
        return false;
      });
    }

    saveDatabase(db, 'DATABASE_UPDATED');
    res.json({ success: true });
  });

  app.post('/api/roster/assign', express.json(), (req, res) => {
    const { monthKey, assignment } = req.body || {};
    if (!assignment || !assignment.airmanId || !assignment.date) {
      return res.status(400).json({ error: 'Missing assignment details' });
    }
    const targetMonth = monthKey || assignment.date.slice(0, 7);
    const db = loadDatabase();
    if (!db.assignments) db.assignments = {};
    if (!db.assignments[targetMonth]) db.assignments[targetMonth] = [];

    const list = db.assignments[targetMonth];
    const idx = list.findIndex((a: any) => a.airmanId === assignment.airmanId && a.date === assignment.date && a.dutyCode === assignment.dutyCode);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...assignment, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...assignment, updatedAt: new Date().toISOString() });
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    res.json({ success: true, assignment });
  });

  app.post('/api/roster/batch-assign', express.json(), (req, res) => {
    const { assignments: batchList, fromDate, toDate } = req.body || {};
    if (!Array.isArray(batchList)) {
      return res.status(400).json({ error: 'Expected assignments array' });
    }
    const db = loadDatabase();
    if (!db.assignments) db.assignments = {};
    for (const item of batchList) {
      if (!item.airmanId || !item.date) continue;
      const mKey = item.date.slice(0, 7);
      if (!db.assignments[mKey]) db.assignments[mKey] = [];
      const list = db.assignments[mKey];
      const idx = list.findIndex((a: any) => a.airmanId === item.airmanId && a.date === item.date && a.dutyCode === item.dutyCode);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...item, updatedAt: new Date().toISOString() };
      } else {
        list.push({ ...item, updatedAt: new Date().toISOString() });
      }
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    res.json({ success: true, count: batchList.length });
  });

  app.post('/api/roster/clear-all', express.json(), (req, res) => {
    const db = loadDatabase();
    db.assignments = {};
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    res.json({ success: true, message: 'All duties cleared' });
  });

  app.post('/api/roster/clear-month', express.json(), (req, res) => {
    const { monthKey } = req.body || {};
    if (!monthKey) return res.status(400).json({ error: 'Missing monthKey' });
    const db = loadDatabase();
    if (db.assignments && db.assignments[monthKey]) {
      db.assignments[monthKey] = [];
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    }
    res.json({ success: true, message: `Month ${monthKey} cleared` });
  });

  // Dedicated Canteen Settings & Full Backup Endpoints
  app.get('/api/canteen/all-settings', (req, res) => {
    const settings = loadAppSettings();
    res.json(Object.values(settings));
  });

  app.post('/api/canteen/save-setting', express.json({ limit: '50mb' }), (req, res) => {
    const { setting_key, setting_value } = req.body || {};
    if (!setting_key) {
      return res.status(400).json({ error: 'Missing setting_key' });
    }
    const settings = loadAppSettings();
    settings[setting_key] = {
      setting_key,
      setting_value: typeof setting_value === 'string' ? setting_value : JSON.stringify(setting_value),
      updated_at: new Date().toISOString()
    };
    saveAppSettings(settings);
    res.json({ success: true, setting_key });
  });

  app.get('/api/canteen/export-full-backup', (req, res) => {
    res.json({
      members: loadCanteenMembers(),
      transactions: loadCanteenTransactions(),
      expenses: loadCanteenExpenses(),
      settings: Object.values(loadAppSettings())
    });
  });

  app.post('/api/canteen/restore-full-backup', express.json({ limit: '50mb' }), (req, res) => {
    try {
      const { members, transactions, expenses, settings } = req.body || {};
      let restoredMembersCount = 0;
      let restoredTxsCount = 0;
      let restoredExpCount = 0;

      let targetMembers = members;
      if (Array.isArray(targetMembers) && targetMembers.length === 1 && targetMembers[0]?.json_agg) {
        targetMembers = targetMembers[0].json_agg;
      } else if (targetMembers && targetMembers.json_agg) {
        targetMembers = targetMembers.json_agg;
      }

      let targetTxs = transactions;
      if (Array.isArray(targetTxs) && targetTxs.length === 1 && targetTxs[0]?.json_agg) {
        targetTxs = targetTxs[0].json_agg;
      } else if (targetTxs && targetTxs.json_agg) {
        targetTxs = targetTxs.json_agg;
      }

      if (Array.isArray(targetMembers) && targetMembers.length > 0) {
        const existingMembers = loadCanteenMembers();
        const mergedMembers = [...existingMembers];
        for (const m of targetMembers) {
          if (!m) continue;
          const mAid = String(m.airman_id || m.id || '').trim().toLowerCase();
          const mBd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '');
          const idx = mergedMembers.findIndex(x => {
            const xAid = String(x.airman_id || x.id || '').trim().toLowerCase();
            const xBd = String(x['BD No'] || x.bdNo || '').replace(/\D/g, '');
            return (mAid && xAid === mAid) || (mBd && xBd === mBd);
          });
          if (idx !== -1) {
            mergedMembers[idx] = { ...mergedMembers[idx], ...m };
          } else {
            mergedMembers.push(m);
          }
        }
        saveCanteenMembers(mergedMembers);
        restoredMembersCount = mergedMembers.length;
      }

      if (Array.isArray(targetTxs) && targetTxs.length > 0) {
        const existingTxs = loadCanteenTransactions();
        const txMap = new Map(existingTxs.map(t => [String(t.id), t]));
        targetTxs.forEach(t => {
          if (t && t.id) txMap.set(String(t.id), t);
        });
        const finalTxs = Array.from(txMap.values());
        saveCanteenTransactions(finalTxs);
        restoredTxsCount = finalTxs.length;
      }

      if (Array.isArray(expenses) && expenses.length > 0) {
        const existingExp = loadCanteenExpenses();
        const expMap = new Map(existingExp.map(e => [String(e.id), e]));
        expenses.forEach(e => {
          if (e && e.id) expMap.set(String(e.id), e);
        });
        const finalExp = Array.from(expMap.values());
        saveCanteenExpenses(finalExp);
        restoredExpCount = finalExp.length;
      }

      if (Array.isArray(settings) && settings.length > 0) {
        const currentSettings = loadAppSettings();
        for (const s of settings) {
          if (s && s.setting_key) {
            currentSettings[s.setting_key] = {
              setting_key: s.setting_key,
              setting_value: typeof s.setting_value === 'string' ? s.setting_value : JSON.stringify(s.setting_value),
              updated_at: s.updated_at || new Date().toISOString()
            };
          }
        }
        saveAppSettings(currentSettings);
      }

      res.json({
        success: true,
        restoredMembersCount,
        restoredTxsCount,
        restoredExpCount
      });
    } catch (e: any) {
      console.error('Error restoring full backup:', e);
      res.status(500).json({ success: false, error: e?.message || 'Restore error' });
    }
  });

  app.get('/api/canteen/cloud-status', async (req, res) => {
    res.json({ status: 'online', code: 200, engine: 'local-json-database' });
  });

  // --- API ENDPOINTS ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', unit: '155 UASU BAF', personnelCount: db.airmen.length });
  });

  // Resolve external image URLs (Google Photos share links, Google Drive, etc.)
  app.get('/api/resolve-image-url', async (req, res) => {
    const rawUrl = (req.query.url as string || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      // 1. Google Drive direct link conversion
      const driveMatch = rawUrl.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|.*[?&]id=([a-zA-Z0-9_-]+))/);
      if (driveMatch) {
        const fileId = driveMatch[1] || driveMatch[2];
        return res.json({ resolvedUrl: `https://lh3.googleusercontent.com/d/${fileId}` });
      }

      // 2. Fetch the target URL (handles photos.app.goo.gl and web pages with og:image)
      const fetchRes = await fetch(rawUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });

      const contentType = fetchRes.headers.get('content-type') || '';
      if (contentType.startsWith('image/')) {
        return res.json({ resolvedUrl: fetchRes.url || rawUrl });
      }

      const html = await fetchRes.text();
      const ogMatch = html.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i)
        || html.match(/<meta content=["']([^"']+)["'] property=["']og:image["']/i)
        || html.match(/<meta name=["']twitter:image["'] content=["']([^"']+)["']/i);

      if (ogMatch && ogMatch[1]) {
        let directUrl = ogMatch[1].replace(/&amp;/g, '&');
        // If it's a googleusercontent photo, optimize size parameter
        if (directUrl.includes('googleusercontent.com')) {
          directUrl = directUrl.replace(/=w\d+-h\d+.*$/, '=s800');
        }
        return res.json({ resolvedUrl: directUrl, originalUrl: rawUrl });
      }

      return res.json({ resolvedUrl: rawUrl, note: 'No og:image found' });
    } catch (err: any) {
      console.error('Error resolving image URL:', err);
      res.status(500).json({ error: err.message, resolvedUrl: rawUrl });
    }
  });

  // Real-time Event Stream (SSE) for instant synchronization across all clients
  app.get('/api/realtime/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Initial connection message
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

    sseClients.add(res);

    // Keep-alive heartbeat every 15 seconds
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // 1. Airmen CRUD
  app.post('/api/sync-google-sheet', async (req, res) => {
    try {
      const defaultUrl = 'https://docs.google.com/spreadsheets/d/1tsmdZI55KL6IbPhPsRqBpGWR9uTIeDE474xF36g96nY/export?format=csv';
      const sheetUrl = req.body?.sheetUrl || defaultUrl;

      const response = await fetch(sheetUrl);
      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch sheet: ${response.statusText}` });
      }

      const csvText = await response.text();
      const lines = csvText.split('\n');

      const newAirmen: Airman[] = [];
      let serCounter = 1;

      for (const line of lines) {
        // Look for lines containing airmen records: e.g. "1,470696,SWO,Moshiur,Cy Asst,..."
        const parts = line.split(',').map((p) => p.replace(/"/g, '').trim());
        if (parts.length >= 5) {
          const serNo = parseInt(parts[0], 10);
          const bdNoRaw = parts[1];
          const rankRaw = parts[2];
          const nameRaw = parts[3];
          const tradeRaw = parts[4];

          if (!isNaN(serNo) && bdNoRaw && rankRaw && nameRaw && tradeRaw) {
            const formattedBdNo = bdNoRaw.startsWith('BD/') ? bdNoRaw : `BD/${bdNoRaw}`;
            let flightName: FlightName;
            const nLower = nameRaw.toLowerCase();
            if (['jahid', 'mobarak', 'rubel', 'shishir', 'shihshir', 'harun', 'joy', 'zakirul', 'tusar', 'saidul', 'asad', 'shohel', 'akash', 'adnan'].some(n => nLower.includes(n))) {
              flightName = 'GCS';
            } else if (['fokrul', 'baten', 'lutfar', 'aminul', 'uzzal', 'riaz', 'mustakim', 'omar', 'rasel', 'rakib', 'nishad'].some(n => nLower.includes(n))) {
              flightName = 'Avionics';
            } else if (['ahsan', 'moshiur', 'shahin', 'ripon', 'nahid', 'ismail', 'maraz', 'shariful'].some(n => nLower.includes(n)) || ['Cy Asst', 'Sec Asst (GD)', 'Log Asst', 'Admin Clerk', 'ATCA'].includes(tradeRaw)) {
              flightName = 'Admin';
            } else {
              flightName = 'Mechanics';
            }

            newAirmen.push({
              id: `airman-gs-${serNo}`,
              serNo,
              code: `${rankRaw.toUpperCase().slice(0, 3)}-${nameRaw.toUpperCase().slice(0, 3)}`,
              bdNo: formattedBdNo,
              rank: (['SWO', 'WO', 'Sgt', 'Cpl', 'LAC'].includes(rankRaw) ? rankRaw : 'LAC') as any,
              name: nameRaw,
              trade: tradeRaw,
              addressBlock: `Barrack / Quarter ${serNo % 10 + 1}`,
              mobileNo: `01711${String(serNo).padStart(6, '0')}`,
              flightName,
              remarks: `Synced from 155 UASU BAF Google Sheet (Ser ${serNo})`,
              active: true,
            });
          }
        }
      }

      if (newAirmen.length === 0) {
        return res.status(400).json({ error: 'No valid airmen personnel rows found in Google Sheet' });
      }

      db.airmen = newAirmen;
      saveDatabase(db);

      res.json({
        success: true,
        count: db.airmen.length,
        message: `Successfully synced ${db.airmen.length} airmen from 155 UASU BAF Google Sheet`,
        airmen: newAirmen
      });
    } catch (err: any) {
      console.error('Error syncing Google Sheet:', err);
      res.status(500).json({ error: err.message || 'Internal server error while syncing Google Sheet' });
    }
  });

  // 7. Reset Database endpoint
  app.post('/api/seed/reset', (req, res) => {
    db = {
      airmen: [...INITIAL_AIRMEN],
      assignments: {},
      activityHistory: [],
      adminPasscode: db.adminPasscode || '1124',
      importHistory: [],
    };

    saveDatabase(db);
    res.json({ message: 'Database reset to clean format with default 48 BAF airmen and empty duty register.' });
  });

  // 8. AI PDF / Image / Document Duty Data Import Analyzer (Gemini Powered)
  let aiClient: GoogleGenAI | null = null;
  function getGeminiAI(): GoogleGenAI | null {
    if (!process.env.GEMINI_API_KEY) {
      return null;
    }
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // Detect rank from text helper
  function detectRankFromText(rawText: string): string | null {
    if (!rawText || typeof rawText !== 'string') return null;
    const lower = rawText.toLowerCase().replace(/[\.]/g, '');
    if (/\b(?:mwo|master\s*warrant\s*officer|m\s*w\s*o)\b/i.test(lower)) return 'MWO';
    if (/\b(?:swo|senior\s*warrant\s*officer|s\s*w\s*o)\b/i.test(lower)) return 'SWO';
    if (/\b(?:flt\s*sgt|f\/sgt|flight\s*sergeant|fs)\b/i.test(lower)) return 'Flt Sgt';
    if (/\b(?:wo|warrant\s*officer|w\s*o)\b/i.test(lower)) return 'WO';
    if (/\b(?:sgt|sergeant)\b/i.test(lower)) return 'Sgt';
    if (/\b(?:cpl|corporal)\b/i.test(lower)) return 'Cpl';
    if (/\b(?:lac|leading\s*aircraftman|l\s*a\s*c)\b/i.test(lower)) return 'LAC';
    if (/\b(?:ac|aircraftman|a\s*c)\b/i.test(lower)) return 'AC';
    return null;
  }

  function cleanAirmanNameFromText(rawText: string): string {
    if (!rawText || typeof rawText !== 'string') return '';
    return rawText
      .replace(/^[0-9]+[.\-)]\s*/, '')
      .replace(/\b(?:bd\/?|)(\d{5,7})\b/gi, '')
      .replace(/\b(?:mwo|swo|flt\s*sgt|f\/sgt|wo|sgt|cpl|lac|ac)\b/gi, '')
      .replace(/\b(?:master\s*warrant\s*officer|senior\s*warrant\s*officer|flight\s*sergeant|warrant\s*officer|sergeant|corporal|leading\s*aircraftman|aircraftman)\b/gi, '')
      .replace(/\b(?:avi|mech|gcs|admin)\s*(?:flt|flight)?\b/gi, '')
      .replace(/\((?:Morning|Afternoon|Night|CL|AL|Leave|Off|GD|BTF|NTF|IDAC|TDY|Bakery|CMH|Airport)\)/gi, '')
      .replace(/^(?:Sy Duty|TF Duty|BTF|NTF|GD|IDAC|Leave|TDY)\s*[-:]\s*/gi, '')
      .replace(/[^a-zA-Z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeRank(rank: string): string {
    const r = rank.toUpperCase().replace(/[\.\s]/g, '');
    if (r === 'MWO' || r === 'MASTERWARRA') return 'MWO';
    if (r === 'SWO' || r === 'SENIORWARRA') return 'SWO';
    if (r === 'FLTSGT' || r === 'FS' || r === 'FLIGHTSERG') return 'FLT SGT';
    if (r === 'WO' || r === 'WARRANTOFF') return 'WO';
    if (r === 'SGT' || r === 'SERGEANT') return 'SGT';
    if (r === 'CPL' || r === 'CORPORAL') return 'CPL';
    if (r === 'LAC' || r === 'LEADINGAIR') return 'LAC';
    if (r === 'AC' || r === 'AIRCRAFTMA') return 'AC';
    return r;
  }

  // Fuzzy matcher to find the best matching airman for a given extracted text snippet (RANK FIRST)
  function findBestAirmanMatch(rawText: string, flightHint?: FlightName | 'Overall'): { airman: Airman | null; confidence: number } {
    if (!rawText || !rawText.trim() || !Array.isArray(db.airmen) || db.airmen.length === 0) {
      return { airman: null, confidence: 0 };
    }
    const rawTrimmed = rawText.trim();
    const cleaned = rawTrimmed.replace(/^[0-9]+[.\-)]\s*/, '').trim().toLowerCase();

    // 1. Direct BD No check
    const bdMatch = cleaned.match(/\b(?:bd\/?|)(\d{5,7})\b/i);
    if (bdMatch) {
      const found = db.airmen.find((a) => a.bdNo.includes(bdMatch[1]));
      if (found) return { airman: found, confidence: 0.99 };
    }

    // 2. Exact match on code (e.g. WO-BTN, SGT-UZL, LAC-RSB, etc.)
    const codeFound = db.airmen.find((a) => cleaned.includes(a.code.toLowerCase()));
    if (codeFound) return { airman: codeFound, confidence: 0.95 };

    // 3. Match by rank FIRST, then name
    const detectedRank = detectRankFromText(rawTrimmed);
    const cleanName = cleanAirmanNameFromText(rawTrimmed).toLowerCase();

    if (detectedRank) {
      const normDetectedRank = normalizeRank(detectedRank);
      const rankCandidates = db.airmen.filter((a) => normalizeRank(a.rank) === normDetectedRank);

      if (rankCandidates.length > 0) {
        let searchPool = rankCandidates;
        if (flightHint && flightHint !== 'Overall') {
          const flightRank = rankCandidates.filter((a) => a.flightName === flightHint);
          if (flightRank.length > 0) {
            searchPool = [...flightRank, ...rankCandidates.filter((a) => a.flightName !== flightHint)];
          }
        }

        // Exact name match in rank
        for (const a of searchPool) {
          const aName = a.name.toLowerCase();
          if (cleanName && cleanName === aName) {
            return { airman: a, confidence: 0.96 };
          }
        }

        // Substring match in rank
        for (const a of searchPool) {
          const aName = a.name.toLowerCase();
          if (cleanName.length >= 3 && (aName.includes(cleanName) || cleanName.includes(aName))) {
            return { airman: a, confidence: 0.94 };
          }
        }

        // Token match in rank
        const queryWords = cleanName.split(/\s+/).filter((w) => w.length >= 3);
        let bestRankMatch: Airman | null = null;
        let highestScore = 0;

        for (const a of searchPool) {
          const aWords = a.name.toLowerCase().split(/[\s,./-]+/).filter((w) => w.length >= 3);
          let score = 0;
          for (const qw of queryWords) {
            for (const aw of aWords) {
              if (qw === aw) score += 2;
              else if (aw.includes(qw) || qw.includes(aw)) score += 1;
            }
          }
          if (score > highestScore) {
            highestScore = score;
            bestRankMatch = a;
          }
        }

        if (bestRankMatch && highestScore > 0) {
          return { airman: bestRankMatch, confidence: 0.90 };
        }
      }
    }

    // 4. Fallback: match without rank constraint
    let candidatePool = db.airmen;
    if (flightHint && flightHint !== 'Overall') {
      const flightList = db.airmen.filter((a) => a.flightName === flightHint);
      if (flightList.length > 0) {
        candidatePool = [...flightList, ...db.airmen.filter((a) => a.flightName !== flightHint)];
      }
    }

    const searchName = (cleanName || cleaned).toLowerCase();
    for (const a of candidatePool) {
      const nameLower = a.name.toLowerCase();
      if (searchName.length >= 3 && (nameLower.includes(searchName) || searchName.includes(nameLower))) {
        return { airman: a, confidence: 0.88 };
      }
    }

    const words = searchName.split(/[\s,./-]+/).filter((w) => w.length >= 3);
    for (const a of candidatePool) {
      const aWords = a.name.toLowerCase().split(/[\s,./-]+/).filter((w) => w.length >= 3);
      for (const w of words) {
        if (aWords.some((aw) => aw.includes(w) || w.includes(aw))) {
          return { airman: a, confidence: 0.82 };
        }
      }
    }

    return { airman: null, confidence: 0 };
  }

  // Extract all text and pages from a PDF buffer using pdf-parse
  async function extractAllPagesFromPdf(buffer: Buffer): Promise<{ totalPages: number; pages: Array<{ pageNumber: number; text: string }>; fullText: string }> {
    try {
      const parsed = await pdfParsePkg(buffer);
      const totalPages = parsed.numpages || 1;
      const pages = [{
        pageNumber: 1,
        text: parsed.text || ''
      }];
      const fullText = pages.map((p) => `--- [PAGE ${p.pageNumber} OF ${totalPages}] ---\n${p.text}`).join('\n\n');
      return { totalPages, pages, fullText };
    } catch (err: any) {
      console.warn('PDFParse extraction note:', err?.message || err);
      // Fallback: extract binary text stream
      const rawStr = buffer.toString('binary');
      const textMatches = rawStr.match(/\(([^()]{2,100})\)\s*(?:Tj|TJ|'|")/g);
      let fallbackText = '';
      if (textMatches && textMatches.length > 5) {
        fallbackText = textMatches
          .map((m) => m.replace(/^\(|\)\s*(?:Tj|TJ|'|")$/g, '').trim())
          .filter((t) => t.length > 1)
          .join(' ');
      }
      return {
        totalPages: 1,
        pages: fallbackText ? [{ pageNumber: 1, text: fallbackText }] : [],
        fullText: fallbackText,
      };
    }
  }

  // Advanced Heuristic BAF Duty Table Parser (Supports table grids, section headers, multi-flight pages, and 20+ unlimited pages)
  function parseRosterTextHeuristically(
    rawInputText: string,
    targetYear: number,
    targetFlight: FlightName | 'Overall'
  ): any {
    const lines = rawInputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let defaultFlight: FlightName = targetFlight === 'Overall' ? 'Avionics' : targetFlight;
    let currentFlight: FlightName = defaultFlight;

    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      january: '01', february: '02', march: '03', april: '04', may_: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };

    const dateMap = new Map<string, { date: string; day: string; assignments: any[] }>();
    const dateRegex = /(?:^|\b)(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s+([A-Za-z]+))?/i;
    const numericDateRegex = /(?:^|\b)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/;

    let activeSectionDuty: DutyCategoryCode | null = null;
    let activeSectionDutyName = '';
    let activeSectionIdaShift: IDAShift | null = null;
    let currentDateStr = '';
    let currentDayName = '';

    // Detect section headers (e.g. "Sy Duty", "TF Duty", "IDAC Duty", "Leave")
    const detectSectionDuty = (line: string): { code: DutyCategoryCode; name: string; shift: IDAShift | null } | null => {
      const upper = line.toUpperCase().trim();
      if (upper === 'SY DUTY' || upper === 'SECURITY DUTY' || upper.startsWith('SY DUTY') || upper.startsWith('BASE SECURITY') || upper === 'GD') {
        return { code: 'GD', name: 'Base Security Duty', shift: null };
      }
      if (upper === 'TF DUTY' || upper === 'TASK FORCE DUTY' || upper.startsWith('TF DUTY') || upper.startsWith('TASK FORCE')) {
        return { code: 'BTF', name: 'Base Taskforce Duty', shift: null };
      }
      if (upper === 'NTF' || upper.includes('NAJIRPARA')) {
        return { code: 'NTF', name: 'Najirpara Taskforce Duty', shift: null };
      }
      if (upper.includes('HALISHAHAR') || upper === 'HALI DUTY') {
        return { code: 'HALISHAHAR', name: 'Halishahar Taskforce Duty', shift: null };
      }
      if (upper.includes('AIRFIELD') || upper.includes('AIRPORT')) {
        return { code: 'ATT', name: 'Airfield Duty', shift: null };
      }
      if (upper.includes('IDAC') || upper.includes('IDA CENTER')) {
        let shift: IDAShift = 'Morning';
        if (upper.includes('NIGHT')) shift = 'Night';
        else if (upper.includes('AFTERNOON') || upper.includes('AFT')) shift = 'Afternoon';
        return { code: 'IDAC', name: 'IDA Center Duty', shift };
      }
      if (upper === 'LEAVE' || upper.startsWith('LEAVE') || upper === 'CL' || upper === 'AL') {
        return { code: 'LEAVE', name: 'Leave (CL/AL)', shift: null };
      }
      if (upper.includes('BAKE N BITE') || upper.includes('BAKE & BITE')) {
        return { code: 'BAKE_N_BITE', name: 'Bake N Bite', shift: null };
      }
      if (upper === 'TDY' || upper.startsWith('TDY')) {
        return { code: 'TDY', name: 'TDY', shift: null };
      }
      return null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();

      // Check for page markers and flight headers
      if (upperLine.includes('AVI FLT') || upperLine.includes('AVIONIC')) {
        currentFlight = 'Avionics';
      } else if (upperLine.includes('MECH FLT') || upperLine.includes('MECHANIC')) {
        currentFlight = 'Mechanics';
      } else if (upperLine.includes('GCS FLT') || upperLine.includes('GCS')) {
        currentFlight = 'GCS';
      } else if (upperLine.includes('ADMIN FLT') || upperLine.includes('ADMIN')) {
        currentFlight = 'Admin';
      }

      // Check if line is a section header (e.g. "Sy Duty", "TF Duty")
      const sectionMatch = detectSectionDuty(line);
      if (sectionMatch && !line.match(dateRegex)) {
        activeSectionDuty = sectionMatch.code;
        activeSectionDutyName = sectionMatch.name;
        activeSectionIdaShift = sectionMatch.shift;
        continue;
      }

      let lineContent = line;

      const match = line.match(dateRegex);
      if (match) {
        const dayNum = match[1].padStart(2, '0');
        const monthStr = match[2].toLowerCase().slice(0, 3);
        const monthNum = monthMap[monthStr] || '08';
        currentDayName = match[3] || '';
        currentDateStr = `${targetYear}-${monthNum}-${dayNum}`;
        lineContent = line.slice(match.index! + match[0].length).replace(/^[\s:—|]+/, '').trim();
      } else {
        const numMatch = line.match(numericDateRegex);
        if (numMatch) {
          if (numMatch[1]) {
            currentDateStr = `${numMatch[1]}-${numMatch[2].padStart(2, '0')}-${numMatch[3].padStart(2, '0')}`;
          } else {
            const yr = numMatch[6].length === 2 ? `20${numMatch[6]}` : numMatch[6];
            currentDateStr = `${yr}-${numMatch[5].padStart(2, '0')}-${numMatch[4].padStart(2, '0')}`;
          }
          lineContent = line.slice(numMatch.index! + numMatch[0].length).replace(/^[\s:—|]+/, '').trim();
        }
      }

      if (currentDateStr) {
        if (!dateMap.has(currentDateStr)) {
          dateMap.set(currentDateStr, { date: currentDateStr, day: currentDayName, assignments: [] });
        }
        const entry = dateMap.get(currentDateStr)!;

        // Process tokens in lineContent
        const tokens = lineContent.split(/(?:[-—|•\t;]+|\s{2,})/);

        for (const token of tokens) {
          const cleanToken = token.trim();
          if (!cleanToken || cleanToken === '-' || cleanToken === '--' || cleanToken.length < 2) continue;

          // Split numbered items e.g., "1. WO Aminul 2. Sgt Uzzal" or comma-separated
          const subNames = cleanToken
            .split(/(?=\d+[.\-)])|,/)
            .map((s) => s.replace(/^\d+[.\-)]\s*/, '').trim())
            .filter((s) => s.length > 2);
          const namesToProcess = subNames.length > 0 ? subNames : [cleanToken];

          for (const item of namesToProcess) {
            let dutyCode: DutyCategoryCode = activeSectionDuty || 'GD';
            let dutyName = activeSectionDutyName || 'Base Security Duty';
            let idaShift: IDAShift | null = activeSectionIdaShift || null;

            const itemUpper = item.toUpperCase();
            const fullLineUpper = lineContent.toUpperCase();

            // Override with inline duty indicators if present
            if (itemUpper.includes('NTF') || itemUpper.includes('NAJIRPARA') || fullLineUpper.includes('NAJIRPARA')) {
              dutyCode = 'NTF';
              dutyName = 'Najirpara Taskforce Duty';
            } else if (itemUpper.includes('BTF') || fullLineUpper.includes('BASE TASKFORCE')) {
              dutyCode = 'BTF';
              dutyName = 'Base Taskforce Duty';
            } else if (itemUpper.includes('TF DUTY') || itemUpper.startsWith('TF -')) {
              dutyCode = 'BTF';
              dutyName = 'Base Taskforce Duty';
            } else if (itemUpper.includes('GD') || itemUpper.includes('SY DUTY') || fullLineUpper.includes('BASE SECURITY')) {
              dutyCode = 'GD';
              dutyName = 'Base Security Duty';
            } else if (itemUpper.includes('HALISHAHAR') || itemUpper.includes('HALI')) {
              dutyCode = 'HALISHAHAR';
              dutyName = 'Halishahar Taskforce Duty';
            } else if (itemUpper.includes('AIRFIELD') || itemUpper.includes('AIRPORT')) {
              dutyCode = 'ATT';
              dutyName = 'Airfield Duty';
            } else if (itemUpper.includes('LEAVE') || itemUpper.includes(' C/L') || itemUpper.includes(' A/L')) {
              dutyCode = 'LEAVE';
              dutyName = 'Leave (CL/AL)';
            } else if (itemUpper.includes('NIGHT') || itemUpper.includes('IDA NIGHT')) {
              dutyCode = 'IDAC';
              dutyName = 'IDA Center Duty';
              idaShift = 'Night';
            } else if (itemUpper.includes('AFTERNOON') || itemUpper.includes('IDA AFT')) {
              dutyCode = 'IDAC';
              dutyName = 'IDA Center Duty';
              idaShift = 'Afternoon';
            } else if (itemUpper.includes('MORNING') || itemUpper.includes('IDA MORN')) {
              dutyCode = 'IDAC';
              dutyName = 'IDA Center Duty';
              idaShift = 'Morning';
            } else if (itemUpper.includes('OFF') || itemUpper.includes('DUTY OFF')) {
              dutyCode = 'DUTY_OFF';
              dutyName = 'Duty Off';
            }

            // Clean duty prefix from name string (e.g., "LAC Rakib (Night)" -> "LAC Rakib")
            const cleanName = item
              .replace(/\((?:Morning|Afternoon|Night|CL|AL|Leave|Off)\)/gi, '')
              .replace(/^(?:Sy Duty|TF Duty|BTF|NTF|GD|IDAC|Leave|TDY)\s*[-:]\s*/gi, '')
              .trim();

            if (dutyCode === 'DUTY_OFF' || dutyCode === 'ON_PARADE') {
              continue;
            }

            const matched = findBestAirmanMatch(cleanName || item, currentFlight);
            if (matched.airman) {
              const alreadyExists = entry.assignments.some(
                (a) => a.matchedAirmanId === matched.airman!.id && a.dutyCode === dutyCode && (dutyCode !== 'IDAC' || a.idaShift === idaShift)
              );
              if (!alreadyExists) {
                entry.assignments.push({
                  rawText: cleanName || item,
                  dutyCode,
                  dutyName,
                  idaShift,
                  matchedAirmanId: matched.airman.id,
                  matchedAirmanName: matched.airman.name,
                  matchedAirmanRank: matched.airman.rank,
                  matchedAirmanFlight: matched.airman.flightName,
                  matchedAirmanBdNo: matched.airman.bdNo,
                  confidence: matched.confidence,
                });
              }
            } else if (cleanName.length > 2 && !['DUTY', 'PARADE', 'STATE', 'FLIGHT', 'TOTAL', 'OFF', 'PRESENT', 'LEAVE'].some((k) => itemUpper === k)) {
              const alreadyExists = entry.assignments.some((a) => a.rawText === (cleanName || item) && a.dutyCode === dutyCode);
              if (!alreadyExists) {
                entry.assignments.push({
                  rawText: cleanName || item,
                  dutyCode,
                  dutyName,
                  idaShift,
                  matchedAirmanId: null,
                  matchedAirmanName: cleanName || item,
                  confidence: 0,
                });
              }
            }
          }
        }
      }
    }

    const dates = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      documentTitle: `PARADE STATE / DUTY ROSTER : ${currentFlight.toUpperCase()} FLT`,
      detectedFlight: currentFlight,
      year: targetYear,
      month: 8,
      totalDates: dates.length,
      dateRange: {
        start: dates[0]?.date || `${targetYear}-08-01`,
        end: dates[dates.length - 1]?.date || `${targetYear}-08-31`,
      },
      dates,
    };
  }

  
  app.post('/api/import/analyze-duty-doc', async (req, res) => {
    try {
      const { fileBase64, files, mimeType, textSnippet, targetYear = 2026, targetFlight = 'Overall' } = req.body || {};

      const fileList = [];
      if (Array.isArray(files) && files.length > 0) {
        for (const f of files) {
          if (f.fileBase64 || f.base64) {
            fileList.push({
              base64: f.fileBase64 || f.base64,
              mime: f.mimeType || f.mime || 'application/pdf',
              name: f.fileName || f.name || 'Document',
            });
          }
        }
      } else if (fileBase64) {
        fileList.push({
          base64: fileBase64,
          mime: mimeType || 'application/pdf',
          name: 'Document',
        });
      }

      if (fileList.length === 0 && !textSnippet) {
        return res.status(400).json({ error: 'No file data or text provided for analysis' });
      }

      let combinedText = textSnippet || '';
      const partsForGemini: any[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const buffer = Buffer.from(file.base64.split(',').pop() || '', 'base64');
        
        partsForGemini.push({
          inlineData: {
            mimeType: file.mime === 'application/pdf' ? 'application/pdf' : file.mime,
            data: file.base64.split(',').pop() || ''
          }
        });
        
        try {
          if (file.mime === 'application/pdf') {
            try {
              const pdfData = await pdfParsePkg(buffer);
              combinedText += '\n--- PDF PAGE ---\n' + pdfData.text;
            } catch (pdfErr) {
              console.warn('PDF Parse error in /api/import/analyze-duty-doc:', pdfErr);
              // Fallback to binary stream extraction
              const { fullText } = await extractAllPagesFromPdf(buffer);
              combinedText += '\n--- PDF PAGE (Heuristic) ---\n' + fullText;
            }
          } else if (file.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mime.includes('word')) {
            const result = await mammoth.extractRawText({ buffer });
            combinedText += '\n--- DOCX CONTENT ---\n' + result.value;
          } else if (file.mime.startsWith('image/')) {
            console.log("Running Tesseract OCR on image...");
            const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
            combinedText += '\n--- OCR IMAGE CONTENT ---\n' + text;
          } else {
             combinedText += '\n' + buffer.toString('utf8');
          }
        } catch (e) {
          console.error("Error parsing file", file.name, e);
        }
      }

      const db = loadDatabase();
      const airmen = db.airmen;
      const dutyCodes = ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'AIRFIELD_DUTY', 'LEAVE', 'IDAC', 'DUTY_OFF', 'ON_PARADE', 'BAKE_N_BITE', 'ESSN', 'CMH', 'SICK_REPORT', 'DRILL_CAT_C', 'RECEPTION', 'TDY', 'ADMIN_ORDER', 'CLASS_TRG', 'GAMES', 'ABSENT'];
      
      const lines = combinedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let finalDates: any[] = [];
      let totalAssignmentsCount = 0;
      
      let heuristicFinalDates: any[] = [];
      let heuristicAssignmentsCount = 0;
      
      try {
        const heuristicResult = parseRosterTextHeuristically(combinedText, targetYear, targetFlight);
        if (heuristicResult && heuristicResult.dates) {
          for (const d of heuristicResult.dates) {
            const mappedAssignments = [];
            for (const a of d.assignments) {
              // Always include, even if matchedAirmanId is null (allows manual fixing in UI)
              mappedAssignments.push({
                rawText: a.rawText || a.matchedAirmanName || '',
                dutyCode: a.dutyCode,
                dutyName: a.dutyName || a.dutyCode,
                idaShift: a.idaShift,
                matchedAirmanId: a.matchedAirmanId || null,
                matchedAirmanName: a.matchedAirmanName || a.rawText,
                matchedAirmanRank: a.matchedAirmanRank,
                matchedAirmanFlight: a.matchedAirmanFlight,
                matchedAirmanBdNo: a.matchedAirmanBdNo,
                confidence: a.confidence || 0
              });
            }
            if (mappedAssignments.length > 0) {
              heuristicFinalDates.push({
                date: d.date,
                assignments: mappedAssignments
              });
              heuristicAssignmentsCount += mappedAssignments.length;
            }
          }
        }
      } catch (e) {
        console.warn("Heuristic parser error:", e);
      }

      try {
        const ai = getGeminiAI();
        if (ai && process.env.GEMINI_API_KEY) {
          const prompt = `Extract duty roster assignments from the provided document(s) or text.
Return a JSON object with a "dates" array. Each date object should have a "date" (YYYY-MM-DD) and an "assignments" array.
To save space, each assignment in the array MUST be a single string in the format "Name, BD No, Duty Code, Shift".
- Duty Code MUST be one of: ${dutyCodes.join(', ')}
- Shift MUST be one of: Morning, Afternoon, Night, or null
- If BD No is not found, leave it empty (e.g. "Rakib, , GD, null")
- Make sure to extract ALL assignments for ALL dates. Do not skip any.
If text is provided below, analyze it as well:
${combinedText.substring(0, 30000)}
`;
          partsForGemini.push({ text: prompt });

          let response;
          let retries = 5;
          while (retries > 0) {
            try {
              const currentParts = retries <= 3 ? partsForGemini.filter(p => !p.inlineData) : partsForGemini;
              response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: currentParts }],
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: 'OBJECT',
                    properties: {
                      dates: {
                        type: 'ARRAY',
                        items: {
                          type: 'OBJECT',
                          properties: {
                            date: { type: 'STRING', description: 'YYYY-MM-DD' },
                            assignments: {
                              type: 'ARRAY',
                              items: {
                                type: 'STRING',
                                description: 'Format: "Name, BDNo, DutyCode, Shift"'
                              }
                            }
                          },
                          required: ['date', 'assignments']
                        }
                      }
                    },
                    required: ['dates']
                  }
                }
              });
              break;
            } catch (err: any) {
              if (err?.status === 'UNAVAILABLE' || err?.status === 'RESOURCE_EXHAUSTED' || err?.code === 503 || err?.status === 503) {
                retries--;
                if (retries === 0) throw err;
                console.warn(`Gemini API 503 error, retrying... (${retries} retries left)`);
                await new Promise(r => setTimeout(r, 4000));
              } else {
                console.warn("AI Parsing failed, falling back to heuristic:", err);
                break; // Break the retry loop and fall back to heuristics
              }
            }
          }

          let aiData;
          try {
             aiData = JSON.parse(response?.text || '{}');
          } catch (jsonErr) {
             console.warn("JSON parsing failed exactly, attempting to fix truncated JSON...");
             let fixedText = response?.text || '';
             // Try to append closing brackets if truncated
             const openBraces = (fixedText.match(/\{/g) || []).length;
             const closeBraces = (fixedText.match(/\}/g) || []).length;
             const openBrackets = (fixedText.match(/\[/g) || []).length;
             const closeBrackets = (fixedText.match(/\]/g) || []).length;
             
             // Very basic fix for truncated string arrays at the end
             if (fixedText.lastIndexOf('"') > fixedText.lastIndexOf(',')) {
                fixedText += '"]}]}';
             }
             try {
                aiData = JSON.parse(fixedText);
             } catch (e2) {
                console.error("Could not recover JSON", e2);
             }
          }

          if (aiData && Array.isArray(aiData.dates) && aiData.dates.length > 0) {
            let aiAssignmentsCount = 0;
            const aiFinalDates = [];
            for (const d of aiData.dates) {
              const mappedAssignments = [];
              if (Array.isArray(d.assignments)) {
                for (const assignStr of d.assignments) {
                  if (typeof assignStr !== 'string') continue;
                  const parts = assignStr.split(',').map(s => s.trim());
                  const aiName = parts[0] || '';
                  const aiBdNo = parts[1] || '';
                  const aiDutyCode = parts[2] || 'GD';
                  const aiShiftStr = parts[3];
                  const aiShift = (aiShiftStr === 'Morning' || aiShiftStr === 'Afternoon' || aiShiftStr === 'Night') ? aiShiftStr : null;

                  let foundAirman = null;
                  for (const a of airmen) {
                    if ((aiBdNo && a.bdNo.includes(aiBdNo)) || 
                        (aiName && a.name.toLowerCase().includes(aiName.toLowerCase()))) {
                      foundAirman = a;
                      break;
                    }
                  }
                  if (!foundAirman && aiName) {
                     const matched = findBestAirmanMatch(aiName, targetFlight);
                     if (matched.airman && matched.confidence > 0.5) {
                        foundAirman = matched.airman;
                     }
                  }
                  
                  if (foundAirman) {
                    mappedAssignments.push({
                      rawText: assignStr,
                      dutyCode: aiDutyCode,
                      dutyName: aiDutyCode,
                      idaShift: aiShift,
                      matchedAirmanId: foundAirman.id,
                      matchedAirmanName: foundAirman.name,
                      matchedAirmanRank: foundAirman.rank,
                      matchedAirmanFlight: foundAirman.flightName,
                      matchedAirmanBdNo: foundAirman.bdNo,
                      confidence: 0.99
                    });
                  } else if (aiName && aiName.length > 2) {
                    mappedAssignments.push({
                      rawText: assignStr,
                      dutyCode: aiDutyCode,
                      dutyName: aiDutyCode,
                      idaShift: aiShift,
                      matchedAirmanId: null,
                      matchedAirmanName: aiName,
                      confidence: 0
                    });
                  }
                }
              }
              if (mappedAssignments.length > 0) {
                aiFinalDates.push({
                  date: d.date,
                  assignments: mappedAssignments
                });
                aiAssignmentsCount += mappedAssignments.length;
              }
            }
            
            // Check if AI performed well compared to Heuristic
            if (aiAssignmentsCount >= heuristicAssignmentsCount * 0.8 && aiAssignmentsCount > 0) {
               // AI did a good job (extracted at least 80% of what heuristic found, or more)
               // Let's merge them to ensure NO data is lost
               const mergedMap = new Map();
               
               // Add AI Data first
               for (const d of aiFinalDates) {
                  mergedMap.set(d.date, [...d.assignments]);
               }
               
               // Add missing from Heuristic
               for (const d of heuristicFinalDates) {
                  if (!mergedMap.has(d.date)) mergedMap.set(d.date, []);
                  const existingArr = mergedMap.get(d.date);
                  
                  for (const heuAssign of d.assignments) {
                     if (!existingArr.find((x: any) => x.matchedAirmanBdNo === heuAssign.matchedAirmanBdNo)) {
                        existingArr.push(heuAssign);
                     }
                  }
               }
               
               finalDates = Array.from(mergedMap.entries()).map(([date, assignments]) => ({ date, assignments }));
               finalDates.sort((a, b) => a.date.localeCompare(b.date));
               for (const d of finalDates) totalAssignmentsCount += d.assignments.length;
               
            } else {
               console.warn(`AI extracted ${aiAssignmentsCount} vs Heuristic ${heuristicAssignmentsCount}. Discarding AI results to prevent data loss.`);
               finalDates = heuristicFinalDates;
               totalAssignmentsCount = heuristicAssignmentsCount;
            }
          } else {
            console.warn(`AI did not return valid dates. Falling back to heuristic.`);
            finalDates = heuristicFinalDates;
            totalAssignmentsCount = heuristicAssignmentsCount;
          }
        } else {
           finalDates = heuristicFinalDates;
           totalAssignmentsCount = heuristicAssignmentsCount;
        }
      } catch (aiErr) {
        console.warn('AI Parsing failed, falling back to heuristic:', aiErr);
        finalDates = heuristicFinalDates;
        totalAssignmentsCount = heuristicAssignmentsCount;
      }

      if (finalDates.length === 0) {
         finalDates = heuristicFinalDates;
         totalAssignmentsCount = heuristicAssignmentsCount;
      }

      if (finalDates.length === 0 || totalAssignmentsCount === 0) {
         return res.status(400).json({ error: 'No dates or duty assignments could be detected in the document. Please verify the document format.' });
      }

      res.json({
        documentTitle: `OCR Extracted Duty Roster`,
        detectedFlight: targetFlight,
        year: targetYear,
        month: finalDates[0] ? parseInt(finalDates[0].date.split('-')[1], 10) : 8,
        totalDates: finalDates.length,
        totalPages: fileList.length || 1,
        totalFiles: fileList.length || 1,
        dateRange: {
          start: finalDates[0]?.date || `${targetYear}-08-01`,
          end: finalDates[finalDates.length - 1]?.date || `${targetYear}-08-31`,
        },
        dates: finalDates,
        totalAssignmentsCount,
        textExtracted: true,
        source: 'OCR_and_Text_Parser'
      });
      
    } catch (err) {
      console.error('Error in analyze-duty-doc:', err);
      res.status(500).json({ error: err.message || 'Failed to analyze duty document' });
    }
  });

// 8.1. Direct Load Official 155 UASU Parade State Roster (01 Jul - 31 Aug)
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Vite middleware in dev or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const isWatchDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: isWatchDisabled ? null : {
          ignored: [
            '**/data/**',
            '**/*.json',
            '**/*.db',
            '**/dist/**',
            '**/package-lock.json',
            '**/bun.lock',
            '**/yarn.lock',
            '**/node_modules/**',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Keep process alive indefinitely to prevent event-loop drain during server transitions
  setInterval(() => {}, 1000 * 60 * 60);

  const startListening = () => {
    const server = app.listen(PORT, HOST, () => {
      console.log(`[155 UASU BAF] Duty Management Server running on http://${HOST}:${PORT}`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[server] Port ${PORT} busy, retrying in 1000ms...`);
        setTimeout(startListening, 1000);
      } else {
        console.error('[server] Server error:', err);
      }
    });
  };

  startListening();
}

startServer().catch((err) => {
  console.error('[server] Failed to start server:', err);
});

