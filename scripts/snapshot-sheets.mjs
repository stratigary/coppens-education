// Saves a copy of each course's published "Website" tab to public/data/fallback/<id>.csv.
// The site reads the live CSV in the browser and falls back to this copy if Google is unreachable.
// Run by .github/workflows/refresh-calendars.yml every night, or by hand: npm run snapshot
import fs from 'node:fs';
import { parseCSV, parseCourseCSV } from '../src/lib/sheets.js';

const { courses } = JSON.parse(fs.readFileSync(new URL('../src/data/courses.json', import.meta.url)));
const site = JSON.parse(fs.readFileSync(new URL('../src/data/site.json', import.meta.url)));
// Teacher-only columns must never reach the public site. If one shows up in a published tab, stop.
const FORBIDDEN = /jitt|if we lose a day|additional activity|teacher|answer key|calendar note/i;

let failed = false;
for (const c of courses.filter(c => c.enabled)) {
  if (!c.sheetCsvUrl) { console.log(`- ${c.id}: no published CSV link yet, keeping the saved copy`); continue; }
  try {
    const res = await fetch(c.sheetCsvUrl, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error('got a web page instead of CSV (is the tab published to the web?)');
    const header = parseCSV(text)[0] || [];
    const bad = header.filter(h => FORBIDDEN.test(h));
    if (bad.length) throw new Error(`published tab contains teacher-only columns: ${bad.join(', ')}. Remove them from the Website tab.`);
    const lessons = parseCourseCSV(text, c, { startYear: site.schoolYearStart });
    if (!lessons.length) throw new Error('no lessons found; check the Website tab headers');
    const out = new URL(`../public/data/fallback/${c.id}.csv`, import.meta.url);
    const before = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (before !== text) { fs.writeFileSync(out, text); console.log(`✓ ${c.id}: updated (${lessons.length} lessons)`); }
    else console.log(`= ${c.id}: unchanged`);
  } catch (e) {
    failed = true;
    console.error(`✗ ${c.id}: ${e.message}`);
  }
}
if (failed) process.exitCode = 1;
