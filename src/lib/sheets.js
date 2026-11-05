// Parses the "Website" tab CSV of each unit-plan sheet into one shared lesson model.
// Runs both at build time (Node) and in the browser, so it must stay dependency-free.
//
// Lesson model:
// { unitId, unitTitle, session, title, codes[], flags[{type,label}], fields[[label, lines[]]],
//   dates: { default } | { Blue, Gold }, notes: {...}, short: {...} }

/* ---------- CSV ---------- */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', i = 0, quoted = false;
  text = String(text || '').replace(/^﻿/, '');
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { quoted = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Turn CSV rows into objects keyed by normalized header name, so column order can change. */
export function toRecords(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h, i) => (String(h).trim() === '#' ? 'num' : normKey(h) || (i === 0 ? 'unit' : '')));
  return rows.slice(1).map(r => {
    const o = {};
    head.forEach((h, i) => { if (h && !(h in o && o[h])) o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}
export const normKey = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Exact header match first, then a header that starts with the key ("block" finds "block min").
const pick = (rec, ...keys) => {
  for (const k of keys) {
    if (k in rec) { if (rec[k]) return rec[k]; continue; }
    for (const rk in rec) if (rk.startsWith(k + ' ') && rec[rk]) return rec[rk];
  }
  return '';
};

/* ---------- small text helpers ---------- */
export const lines = s => String(s || '').split(/\n+/).map(x => x.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
const tidy = s => String(s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const dash = s => s.replace(/(\d)\s*-\s*(\d)/g, '$1–$2');

/* ---------- dates ---------- */
/** "8/21\nSch.5" -> { iso:'2026-08-21', note:'Schedule 5' }. Months Jul–Dec use startYear, Jan–Jun the next year. */
export function parseDateCell(cell, startYear) {
  const ls = String(cell || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (!ls.length) return { iso: null, note: '' };
  const m = ls[0].match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b\s*(.*)$/);
  if (!m) return { iso: null, note: cleanNote(ls.join(' · ')) };
  const mo = +m[1], d = +m[2];
  let y = m[3] ? +m[3] : (mo >= 7 ? startYear : startYear + 1);
  if (y < 100) y += 2000;
  const rest = [m[4], ...ls.slice(1)].filter(Boolean).join(' · ');
  return { iso: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, note: cleanNote(rest) };
}
export function cleanNote(s) {
  s = tidy(s);
  if (!s) return '';
  return s.replace(/\bSch\.?\s*(\d)/gi, 'Schedule $1').replace(/\s*-\s*/g, ' · ').replace(/\bhour\b/gi, 'hr');
}
const SHORT_RE = /delay|dismissal|short block|early release|half day|mardi gras/i;

/** Today's date in the school's time zone as YYYY-MM-DD. */
export function todayISO(timeZone = 'America/New_York', now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const g = t => p.find(x => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/* ---------- units ---------- */
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function matchUnit(course, label) {
  const l = tidy(label).toLowerCase();
  if (!l) return null;
  for (const u of course.units || []) {
    for (const m of u.match || []) {
      if (new RegExp('(^|[^a-z0-9])' + reEsc(m.toLowerCase()) + '($|[^a-z0-9])').test(l)) return u;
    }
  }
  return null;
}

/* ---------- flags (test / quiz / due) ---------- */
function flagsFrom({ title = '', classLines = [], assessment = '', assessmentTitle = '' }) {
  const flags = [];
  const a = assessment.toLowerCase();
  // The Assessment column only counts when the In Class column agrees (or is blank),
  // so a test listed a row early in the sheet doesn't show up on the wrong day.
  const classText = classLines.join(' ').toLowerCase();
  const agrees = w => !classLines.length || classText.includes(w);
  if (a.startsWith('test') && agrees('test')) flags.push({ type: 'test', label: 'Test' });
  else if (a.startsWith('quiz') && agrees('quiz')) flags.push({ type: 'quiz', label: 'Quiz' });
  else if (a.includes('due')) flags.push({ type: 'due', label: assessmentTitle ? `${assessmentTitle} due` : 'Due' });
  const t = title.toLowerCase();
  if (!flags.some(f => f.type === 'test') && /\btest\b/.test(t) && !/review|study/.test(t)) flags.push({ type: 'test', label: 'Test' });
  if (!flags.some(f => f.type === 'quiz') && (/\bquiz\b/.test(t) || classLines.some(l => /^quiz\b/i.test(l)))) flags.push({ type: 'quiz', label: 'Quiz' });
  for (const l of classLines) {
    const m = l.match(/^due:?\s*(.+)$/i);
    if (m) flags.push({ type: 'due', label: `${tidy(m[1]).replace(/\s*-\s*(self grade|review in class|collected).*$/i, '')} due` });
  }
  return flags;
}

/* ---------- per-format row parsers ---------- */
function apes(recs, course, cfg) {
  const out = []; let unitLabel = '';
  for (const r of recs) {
    if (pick(r, 'unit')) unitLabel = pick(r, 'unit');
    const { iso } = parseDateCell(pick(r, 'date'), cfg.startYear);
    const lessonLines = lines(pick(r, 'lesson'));
    if (!iso && !lessonLines.length) continue;
    const sched = tidy(pick(r, 'schedule')), mins = parseInt(pick(r, 'block'), 10);
    let note = '';
    const sm = sched.match(/^sch(?:edule)?\s*(\d)\s*\(([^)]*)\)/i);
    if (/^special/i.test(sched)) note = 'Special schedule: ' + sched.replace(/^special\s*-\s*/i, '');
    else if (sm && !/regular|plc/i.test(sm[2])) note = `Schedule ${sm[1]} · ${sm[2]}`;
    const short = (Number.isFinite(mins) && mins < 60) || SHORT_RE.test(sched);
    if (short) note = note ? note + ' · short block' : 'Short block';
    const reading = tidy(pick(r, 'reading guide due', 'reading'));
    const work = lines(pick(r, 'your classwork', 'classwork', 'in class'));
    const hwRaw = tidy(pick(r, 'hw', 'homework'));
    let hw = hwRaw;
    const hm = hwRaw.match(/^(?:post\s+)?(.*?)\s*>>\s*due\s+(\d{1,2})\/(\d{1,2})/i);
    if (hm) hw = `Reading guide: ${hm[1]} (due ${+hm[2]}/${+hm[3]})`;
    const title = lessonLines[0] || 'Class';
    const classLines = [...lessonLines.slice(1).filter(l => !/^do mod/i.test(l)), ...work];
    const fields = [];
    if (reading) fields.push(['Reading guide due', [/carry-over/i.test(reading) ? 'No new guide due' : reading]]);
    if (classLines.length) fields.push(['In class', splitSemis(classLines)]);
    if (hw) fields.push(['Homework', [hw]]);
    const codes = tidy(pick(r, 'ap topics', 'topics')).split(/\s*,\s*/).filter(Boolean).map(dash);
    out.push(base(course, unitLabel, {
      session: pick(r, 'num') ? `Class ${pick(r, 'num')}` : '',
      title: dash(title), codes, fields,
      flags: flagsFrom({ title, classLines }),
      dates: { default: iso }, notes: { default: note }, short: { default: short },
    }));
  }
  return out;
}
const splitSemis = ls => ls.flatMap(l => l.split(/;\s+/)).map(tidy).filter(Boolean);

const IB_CODE = /\b[A-D]\d\.\d\.\d+\*?/g;
function topicsToTitle(ls) {
  const names = ls.map(l => l.replace(/\(.*?\)/g, '').replace(/,.*already covered.*$/i, '').trim()).filter(Boolean);
  return names.join(' · ');
}
function ib(recs, course, cfg) {
  const out = []; let unitLabel = '';
  for (const r of recs) {
    if (pick(r, 'unit')) unitLabel = pick(r, 'unit');
    const blue = parseDateCell(pick(r, 'blue'), cfg.startYear);
    const gold = parseDateCell(pick(r, 'gold'), cfg.startYear);
    const topics = lines(pick(r, 'todays topics', 'topics'));
    const inClass = lines(pick(r, 'in class'));
    if (!blue.iso && !gold.iso && !inClass.length) continue;
    const assessment = tidy(pick(r, 'assessment'));
    const assessmentTitle = tidy(pick(r, 'assessment title'));
    let title = topics.length ? topicsToTitle(topics) : '';
    if (!title) {
      const t = inClass.find(l => !/^(review|quiz)\b/i.test(l)) || inClass[0] || 'Class';
      title = t;
    }
    if (/^test$/i.test(assessment) && assessmentTitle && inClass.some(l => l.toLowerCase().includes(assessmentTitle.toLowerCase()))) title = assessmentTitle;
    const codes = [...new Set(topics.join(' ').match(IB_CODE) || [])];
    const fields = [];
    if (inClass.length) fields.push(['In class', inClass]);
    const labs = lines(pick(r, 'labs'));
    if (labs.length) fields.push(['Labs', labs]);
    const hw = lines(pick(r, 'homework'));
    if (hw.length) fields.push(['Homework', hw]);
    const reading = lines(pick(r, 'reading notes', 'reading'));
    if (reading.length) fields.push(['Reading for next class', [topicsToTitle(reading.slice(0, 1)) + (reading.length > 1 ? ': ' + topicsToTitle(reading.slice(1)) : '')]]);
    const bk = pick(r, 'bk');
    out.push(base(course, unitLabel, {
      session: bk ? `Bk ${bk}` : '',
      title, codes, fields,
      flags: flagsFrom({ title, classLines: inClass, assessment, assessmentTitle }),
      dates: { Blue: blue.iso, Gold: gold.iso },
      notes: { Blue: blue.note, Gold: gold.note },
      short: { Blue: SHORT_RE.test(blue.note), Gold: SHORT_RE.test(gold.note) },
    }));
  }
  return out;
}

const NGSS = /HS-[A-Z]+\d-\d+/g;
function envsci(recs, course, cfg) {
  const out = []; let unitLabel = ''; const stds = {};
  for (const r of recs) {
    const u = pick(r, 'unit');
    if (u) unitLabel = u;
    const lo = pick(r, 'learning objectives', 'objectives');
    if (lo) stds[unitLabel] = [...new Set(lo.match(NGSS) || [])];
    const blockLines = lines(pick(r, 'block'));
    const { iso, note: dnote } = parseDateCell(pick(r, 'date'), cfg.startYear);
    const work = lines(pick(r, 'in class'));
    if (!iso && !work.length) continue;
    const bnote = cleanNote(blockLines.slice(1).join(' · '));
    const note = [dnote, bnote].filter(Boolean).join(' · ');
    const titleLine = work.find(l => !/^(unit \d+\s*:?\s*-?\s*(slides|notes|slide)|uniy \d|quiz!?$|due:|review test$|hand out|pass out|warm up|classwork:?\s*$)/i.test(l)) || work[0] || 'Class';
    const title = titleLine.replace(/^(activity|classwork|lab|begin|start|finish|continue)\s*[:-]\s*/i, m => m.replace(/\s*[:-]\s*$/, '') + ': ').replace(/!+$/, '');
    const fields = [];
    if (work.length) fields.push(['In class', work]);
    const hw = lines(pick(r, 'homework'));
    if (hw.length) fields.push(['Homework', hw]);
    out.push(base(course, unitLabel, {
      session: blockLines[0] ? `Block ${blockLines[0]}` : '',
      title, codes: [], fields,
      flags: flagsFrom({ title, classLines: work }),
      dates: { default: iso }, notes: { default: note }, short: { default: SHORT_RE.test(note) },
      unitStds: stds,
    }));
  }
  for (const l of out) { l.unitStds = l.unitStds[l.unitLabel] || []; }
  return out;
}

function base(course, unitLabel, l) {
  const u = matchUnit(course, unitLabel);
  return { unitLabel: tidy(unitLabel), unitId: u ? u.id : 'X-' + normKey(unitLabel).replace(/ /g, '-'), unitTitle: u ? u.title : tidy(unitLabel).replace(/!+$/, ''), ...l };
}

const PARSERS = { apes, ib, envsci };
/** Parse the Website-tab CSV text for a course. */
export function parseCourseCSV(text, course, cfg = {}) {
  const startYear = cfg.startYear || 2026;
  const recs = toRecords(parseCSV(text));
  const fn = PARSERS[course.format] || envsci;
  return fn(recs, course, { startYear });
}

/* ---------- queries ---------- */
export const sectionKeys = course => (course.sections && course.sections.length ? course.sections : ['default']);
export const dateOf = (l, section = 'default') => l.dates[section] ?? l.dates.default ?? null;
export const noteOf = (l, section = 'default') => l.notes?.[section] ?? l.notes?.default ?? '';
export const shortOf = (l, section = 'default') => !!(l.short?.[section] ?? l.short?.default);

export function snapshot(lessons, today, section) {
  const dated = lessons.filter(l => dateOf(l, section)).sort((a, b) => dateOf(a, section).localeCompare(dateOf(b, section)));
  return {
    today: dated.find(l => dateOf(l, section) === today) || null,
    next: dated.find(l => dateOf(l, section) > today) || null,
    prev: [...dated].reverse().find(l => dateOf(l, section) < today) || null,
  };
}

/** Group lessons into units in sheet order, with past/current/upcoming status. */
export function groupUnits(lessons, today, section) {
  const units = [];
  for (const l of lessons) {
    let u = units[units.length - 1];
    if (!u || u.id !== l.unitId) { u = { id: l.unitId, title: l.unitTitle, lessons: [], stds: l.unitStds || [] }; units.push(u); }
    u.lessons.push(l);
  }
  const snap = snapshot(lessons, today, section);
  const focus = (snap.today || snap.next || snap.prev);
  for (const u of units) {
    const ds = u.lessons.map(l => dateOf(l, section)).filter(Boolean);
    if (focus && u.lessons.includes(focus)) u.status = 'current';
    else if (ds.length && ds.every(d => d < today)) u.status = 'past';
    else u.status = 'upcoming';
  }
  // A unit sitting before the current one with no dates (e.g. an undated block) counts as past.
  const ci = units.findIndex(u => u.status === 'current');
  units.forEach((u, i) => { if (ci > -1 && i < ci && u.status === 'upcoming' && !u.lessons.some(l => dateOf(l, section) && dateOf(l, section) >= today)) u.status = 'past'; });
  return units;
}
