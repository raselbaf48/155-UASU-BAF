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

  // Supabase Proxy to bypass Adblockers
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://asevtncnoytawykhcleg.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';
  
  app.all('/api/supabase/*', async (req, res) => {
    let targetUrl = '';
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
      if (!headers['authorization']) {
        headers['authorization'] = `Bearer ${supabaseAnonKey}`;
      }
      
      const reqOptions: RequestInit = {
        method: req.method,
        headers: headers as Record<string, string>,
      };
      
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        // Stream the request body
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        reqOptions.body = Buffer.concat(chunks);
      }
      
      const supabaseRes = await fetch(targetUrl, reqOptions);
      
      supabaseRes.headers.forEach((val, key) => {
        // Node fetch auto-decompresses the response, so we must strip these headers
        // otherwise the browser will fail to parse the decompressed stream
        if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'content-length') {
          res.setHeader(key, val);
        }
      });
      res.status(supabaseRes.status);
      
      if (supabaseRes.body) {
        const reader = supabaseRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        res.end();
      }
    } catch (e: any) {
      console.error('Supabase proxy error:', e, 'Target:', targetUrl);
      res.status(502).json({ error: 'Proxy error', details: e.message, cause: e.cause ? String(e.cause) : null, targetUrl });
    }
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  let db = loadDatabase();

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
  function getGeminiAI(): GoogleGenAI {
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
