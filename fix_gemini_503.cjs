const fs = require('fs');
const path = 'server.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `            try {
              response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: [{ role: 'user', parts: partsForGemini }],`;

const replace = `            try {
              const currentParts = retries <= 3 ? partsForGemini.filter(p => !p.inlineData) : partsForGemini;
              response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: [{ role: 'user', parts: currentParts }],`;

content = content.replace(target, replace);
fs.writeFileSync(path, content);
