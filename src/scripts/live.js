// Refreshes the Today cards and course calendars in the browser:
// 1) re-renders for the student's actual "today" and saved IB section,
// 2) tries the live published-to-web CSV for each course, falling back to the saved copy.
import { parseCourseCSV, todayISO } from '../lib/sheets.js';
import { todayCard, calendarHtml, resourcesHtml, fmt, sectionSwitch } from '../lib/render.js';
import site from '../data/site.json';
import coursesData from '../data/courses.json';

const resourceFiles = import.meta.glob('../data/resources/*.json', { eager: true, import: 'default' });
const resourcesFor = id => resourceFiles[`../data/resources/${id}.json`] || { units: [] };
const COURSES = coursesData.courses.filter(c => c.enabled);
const cfg = { startYear: site.schoolYearStart };

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const getSection = c => {
  if (!c.sections?.length) return 'default';
  const v = store.get('section:' + c.id);
  return c.sections.includes(v) ? v : c.sections[0];
};

async function fetchText(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store', redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

const cache = new Map();
/** Returns { lessons, source: 'live' | 'saved' }. */
async function loadCourse(c) {
  if (cache.has(c.id)) return cache.get(c.id);
  const p = (async () => {
    if (c.sheetCsvUrl) {
      try {
        const text = await fetchText(c.sheetCsvUrl);
        if (/^\s*</.test(text)) throw new Error('not CSV'); // sign-in page or error page
        const lessons = parseCourseCSV(text, c, cfg);
        if (lessons.length) return { lessons, source: 'live' };
      } catch (e) { console.info(`[${c.id}] live calendar unavailable, using saved copy:`, e.message); }
    }
    try {
      const text = await fetchText(`/data/fallback/${c.id}.csv`);
      return { lessons: parseCourseCSV(text, c, cfg), source: 'saved' };
    } catch {
      return { lessons: [], source: 'saved' }; // e.g. a newly switched-on course with no sheet yet
    }
  })();
  cache.set(c.id, p);
  return p;
}

function statusText(sources) {
  if (sources.every(s => s === 'live')) return 'Calendar read live from the unit-plan sheets.';
  if (sources.every(s => s === 'saved')) return 'Showing the saved copy of the calendar. It is updated every night.';
  return 'Some calendars are live; others show the saved copy, which is updated every night.';
}

async function renderHome(root) {
  const today = todayISO(site.timeZone);
  const h1 = document.getElementById('today-date');
  if (h1) h1.textContent = fmt.long(today);
  const grid = root.querySelector('[data-cards]');
  const results = await Promise.all(COURSES.map(c => loadCourse(c).catch(() => null)));
  grid.innerHTML = COURSES.map((c, i) => results[i] ? todayCard(c, results[i].lessons, today, getSection(c)) : '').join('');
  const st = root.querySelector('[data-status]');
  if (st) st.textContent = statusText(results.filter(Boolean).map(r => r.source));
}

async function renderCourse(root) {
  const c = COURSES.find(x => x.id === root.dataset.course);
  if (!c) return;
  const today = todayISO(site.timeZone);
  const { lessons, source } = await loadCourse(c);
  const section = getSection(c);
  const cal = calendarHtml(c, lessons, today, section);
  const openEarlier = root.querySelector('details.earlier')?.open;
  root.querySelector('[data-trail]').innerHTML = cal.trail;
  const tw = root.querySelector('.trail-wrap'), now = tw?.querySelector('.wp.now');
  if (tw && now) tw.scrollLeft = Math.max(0, now.offsetLeft - tw.clientWidth / 3);
  root.querySelector('[data-calendar]').innerHTML = cal.body;
  if (openEarlier) root.querySelector('details.earlier')?.setAttribute('open', '');
  const cur = cal.units.find(u => u.status === 'current');
  root.querySelector('[data-resources]').innerHTML = resourcesHtml(c, resourcesFor(c.id), cur?.id);
  const sw = root.querySelector('[data-switch]');
  if (sw) sw.innerHTML = sectionSwitch(c, section, 'Your section (Blue or Gold day)');
  const st = root.querySelector('[data-status]');
  if (st) st.textContent = statusText([source]);
  // Keep a deep link (#d-2026-11-05) working after the re-render.
  if (location.hash && !root.dataset.scrolled) {
    root.dataset.scrolled = '1';
    const el = document.getElementById(location.hash.slice(1));
    if (el) { el.closest('details')?.setAttribute('open', ''); el.scrollIntoView({ block: 'start' }); }
  }
}

function render(root) { return root.dataset.page === 'home' ? renderHome(root) : renderCourse(root); }

const root = document.querySelector('[data-live]');
if (root) {
  root.addEventListener('click', e => {
    const b = e.target.closest('button[data-sec]');
    if (!b) return;
    const card = b.closest('[data-course]');
    const id = card ? card.dataset.course : root.dataset.course;
    store.set('section:' + id, b.dataset.sec);
    render(root).then(() => {
      // put focus back on the pressed button after the re-render
      const scope = id && root.querySelector(`[data-course="${id}"]`) || root;
      scope.querySelector(`button[data-sec="${b.dataset.sec}"]`)?.focus();
    });
  });
  render(root).catch(e => console.error(e));
}
