import express from 'express';
import Tesseract from 'tesseract.js';
import mammoth from 'mammoth';
import path from 'path';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import pdfParsePkg from 'pdf-parse/lib/pdf-parse.js';

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
            finalAirmen.push({ ...initA, ...existing });
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

  // Generate clean initial database
  const db: LocalDB = {
    airmen: [...INITIAL_AIRMEN],
    assignments: {},
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
  const PORT = 3000;

  const FALLBACK_SUPABASE_URL = 'https://asevtncnoytawykhcleg.supabase.co';
  const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';

  function isJwtKey(str: string | undefined | null): boolean {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    return trimmed.startsWith('eyJ') || (trimmed.split('.').length === 3 && !trimmed.startsWith('http'));
  }

  function isHttpUrl(str: string | undefined | null): boolean {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    return /^https?:\/\//i.test(trimmed);
  }

  // Helper to sanitize duplicated/malformed Supabase environment values
  function cleanSupabaseUrl(url: string | undefined | null): string {
    if (!url || typeof url !== 'string') return FALLBACK_SUPABASE_URL;
    let cleaned = url.trim();
    if (!cleaned || cleaned === 'undefined' || cleaned === 'null' || cleaned === '""' || cleaned === "''") {
      return FALLBACK_SUPABASE_URL;
    }
    if (isJwtKey(cleaned)) {
      return FALLBACK_SUPABASE_URL;
    }
    if (cleaned.length % 2 === 0 && cleaned.slice(0, cleaned.length / 2) === cleaned.slice(cleaned.length / 2)) {
      cleaned = cleaned.slice(0, cleaned.length / 2);
    }
    const httpsMatch = cleaned.match(/https?:\/\/[^\/\s]+/g);
    if (httpsMatch && httpsMatch.length > 0) {
      cleaned = httpsMatch[0];
    }
    cleaned = cleaned.replace(/\/+$/, '');

    if (!/^https?:\/\/[a-zA-Z0-9_.-]+/.test(cleaned)) {
      return FALLBACK_SUPABASE_URL;
    }
    return cleaned;
  }

  function cleanSupabaseAnonKey(key: string | undefined | null): string {
    if (!key || typeof key !== 'string') return FALLBACK_SUPABASE_ANON_KEY;
    let cleaned = key.trim();
    if (!cleaned || cleaned === 'undefined' || cleaned === 'null' || cleaned === '""' || cleaned === "''") {
      return FALLBACK_SUPABASE_ANON_KEY;
    }
    if (isHttpUrl(cleaned)) {
      return FALLBACK_SUPABASE_ANON_KEY;
    }
    if (cleaned.length % 2 === 0 && cleaned.slice(0, cleaned.length / 2) === cleaned.slice(cleaned.length / 2)) {
      cleaned = cleaned.slice(0, cleaned.length / 2);
    }
    if (!isJwtKey(cleaned)) {
      return FALLBACK_SUPABASE_ANON_KEY;
    }
    return cleaned;
  }

  const rawEnvUrl = process.env.VITE_SUPABASE_URL;
  const rawEnvKey = process.env.VITE_SUPABASE_ANON_KEY;

  let resolvedUrl = rawEnvUrl;
  let resolvedKey = rawEnvKey;

  if ((!resolvedUrl || isJwtKey(resolvedUrl)) && isHttpUrl(resolvedKey)) {
    resolvedUrl = rawEnvKey;
    resolvedKey = rawEnvUrl;
  } else if (isHttpUrl(resolvedKey) && !isHttpUrl(resolvedUrl)) {
    resolvedUrl = resolvedKey;
  }

  // Supabase Proxy to bypass Adblockers and CORS restrictions
  const supabaseUrl = cleanSupabaseUrl(resolvedUrl);
  const supabaseAnonKey = cleanSupabaseAnonKey(resolvedKey);
  
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
              Name: a.name || a.fullName || 'Airman',
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
            res.setHeader('content-type', 'application/json');
            res.status(200).send(JSON.stringify(dbData.airmen || []));
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

    try {
      targetUrl = `${supabaseUrl}${req.originalUrl.replace('/api/supabase', '')}`;
      const headers = { ...req.headers };
      delete headers.host;
      delete headers.origin;
      delete headers.referer;
      delete headers.connection;
      delete headers['content-length'];
      delete headers['accept-encoding']; // Let fetch handle this
      
      headers['apikey'] = supabaseAnonKey;
      if (!headers['authorization'] || String(headers['authorization']).includes(supabaseAnonKey)) {
        headers['authorization'] = `Bearer ${supabaseAnonKey}`;
      } else {
        const authVal = String(headers['authorization']);
        if (authVal.startsWith('Bearer ')) {
          const token = authVal.slice(7);
          headers['authorization'] = `Bearer ${cleanSupabaseAnonKey(token)}`;
        }
      }
      
      const reqOptions: RequestInit = {
        method: req.method,
        headers: headers as Record<string, string>,
      };
      
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (Buffer.isBuffer(req.body) && req.body.length > 0) {
          reqOptions.body = req.body;
        } else if (typeof req.body === 'string' && req.body.length > 0) {
          reqOptions.body = req.body;
        } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
          reqOptions.body = JSON.stringify(req.body);
        }
      }
      
      // Perform upstream fetch with 25s timeout and automatic single retry
      let supabaseRes: Response | null = null;
      let lastFetchErr: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 25000);
          supabaseRes = await fetch(targetUrl, {
            ...reqOptions,
            signal: controller.signal
          });
          clearTimeout(timer);
          break;
        } catch (fetchErr: any) {
          lastFetchErr = fetchErr;
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 350));
            continue;
          }
        }
      }

      if (!supabaseRes) {
        throw lastFetchErr || new Error('Upstream timeout');
      }
      
      const hopByHopHeaders = new Set([
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailers',
        'transfer-encoding',
        'upgrade',
        'content-encoding',
        'content-length',
      ]);

      const arrayBuffer = await supabaseRes.arrayBuffer();
      const bodyText = Buffer.from(arrayBuffer).toString('utf-8');
      const isRestrictedOrOffline = 
        supabaseRes.status === 402 || 
        supabaseRes.status === 403 || 
        supabaseRes.status >= 500 || 
        bodyText.includes('exceed_egress_quota') || 
        bodyText.includes('restricted due to the following violations');

      if (isRestrictedOrOffline) {
        if (handleCanteenFallback(targetUrl, reqOptions.body || req.body)) {
          return;
        }
      }

      supabaseRes.headers.forEach((val, key) => {
        if (!hopByHopHeaders.has(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });
      res.status(supabaseRes.status);
      res.send(Buffer.from(arrayBuffer));
    } catch (e: any) {
      console.warn('[Proxy Notice] Upstream database temporarily unavailable, checking local fallback:', e?.message || e);
      if (handleCanteenFallback(targetUrl || req.originalUrl, req.body)) {
        return;
      }

      res.status(503).json({
        message: 'Upstream database temporarily unavailable. Falling back to local state.',
        code: 'PGRST_UPSTREAM_TIMEOUT',
        details: e?.message || 'Connection timeout'
      });
    }
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

  app.get('/api/duty-assignments', (req, res) => {
    const db = loadDatabase();
    res.json(db.assignments || {});
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
    try {
      const testRes = await fetch(`${supabaseUrl}/rest/v1/Canteen_Member?select=airman_id&limit=1`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      if (testRes.status === 402 || testRes.status === 403) {
        return res.json({
          status: 'restricted',
          code: testRes.status,
          reason: 'exceed_egress_quota',
          message: 'Supabase Egress Quota Exceeded (HTTP 402). Direct queries restricted.'
        });
      }
      res.json({ status: testRes.ok ? 'online' : 'error', code: testRes.status });
    } catch (e: any) {
      res.json({ status: 'offline', error: e?.message });
    }
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
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[155 UASU BAF] Duty Management Server running on http://localhost:${PORT}`);
  });
}

startServer();
