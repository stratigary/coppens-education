// HTML renderers shared by the static build and the in-browser live refresh.
// Everything that comes from a sheet goes through esc().
import { snapshot, groupUnits, dateOf, noteOf, shortOf } from './sheets.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D = iso => new Date(iso + 'T12:00:00Z');
const f = (iso, o) => D(iso).toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
export const fmt = {
  wd: iso => f(iso, { weekday: 'short' }),
  md: iso => f(iso, { month: 'numeric', day: 'numeric' }),
  short: iso => f(iso, { weekday: 'short', month: 'short', day: 'numeric' }),
  long: iso => f(iso, { weekday: 'long', month: 'long', day: 'numeric' }),
  full: iso => f(iso, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
};
export const base = (p = '') => p; // hook in case the site moves under a sub-path

const pill = fl => `<span class="pill ${esc(fl.type)}">${esc(fl.type === 'due' ? fl.label : fl.label)}</span>`;
const codes = (c, l) => l.codes?.length ? `<ul class="codes" aria-label="${esc(c.codeLabel)}">${l.codes.map(x => `<li class="code">${esc(x)}</li>`).join('')}</ul>` : '';
function fieldList(ls, max) {
  const items = max && ls.length > max ? [...ls.slice(0, max), `+ ${ls.length - max} more`] : ls;
  return items.length === 1 ? esc(items[0]) : `<ul class="bul">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
}
const fields = (l, max) => l.fields?.length ? `<dl class="fields">${l.fields.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${fieldList(v, max)}</dd></div>`).join('')}</dl>` : '';

export function sectionSwitch(c, section, label = 'Your section') {
  if (!c.sections?.length) return '';
  return `<div class="seg" role="group" aria-label="${esc(label)}">${c.sections.map(s => `<button type="button" data-sec="${esc(s)}" aria-pressed="${s === section}">${esc(s)}</button>`).join('')}</div>`;
}

/* ---------- Today card ---------- */
export function todayCard(c, lessons, today, section) {
  const sec = c.sections?.length ? section : 'default';
  const s = snapshot(lessons, today, sec);
  const main = s.today || s.next;
  const status = s.today ? '<p class="status live"><i aria-hidden="true"></i>Class today</p>' : '<p class="status"><i aria-hidden="true"></i>No class today</p>';
  const head = `<div class="card-top"><span class="tag">${esc(c.short)}</span>${sectionSwitch(c, section)}</div>`;
  if (!main) {
    return `<article class="card c-${esc(c.color)}" data-course="${esc(c.id)}">${head}${status}
      <h3><a href="/${esc(c.id)}/">${esc(c.name)}</a></h3><p class="muted">No upcoming classes on the calendar yet.</p>
      <div class="card-foot"><a class="more" href="/${esc(c.id)}/">Course page <span aria-hidden="true">→</span></a></div></article>`;
  }
  const d = dateOf(main, sec), note = noteOf(main, sec);
  const when = s.today ? `Today${main.session ? ' · ' + main.session : ''}` : `Next class · ${fmt.short(d)}`;
  const flags = main.flags?.map(pill).join('') || '';
  const foot = s.today && s.next
    ? `<p><span class="lbl">Next class</span>${esc(fmt.short(dateOf(s.next, sec)))}: ${esc(s.next.title)}</p>`
    : (!s.today && s.prev ? `<p><span class="lbl">Last class</span>${esc(fmt.short(dateOf(s.prev, sec)))}: ${esc(s.prev.title)}</p>` : '');
  return `<article class="card c-${esc(c.color)}" data-course="${esc(c.id)}">
    ${head}${status}
    <div>
      <p class="when">${esc(when)}</p>
      <h3><a href="/${esc(c.id)}/#d-${esc(d)}">${esc(main.title)}</a></h3>
      <p class="unitline">${esc(main.unitTitle)}</p>
    </div>
    ${note ? `<p class="flag">${shortOf(main, sec) ? '<span class="sb">Short block</span> ' : ''}${esc(note.replace(/ · short block$/i, '').replace(/^short block$/i, ''))}</p>` : ''}
    ${flags || main.codes?.length ? `<div class="chips">${flags}${codes(c, main)}</div>` : ''}
    ${fields(main, 4)}
    <div class="card-foot">${foot}<a class="more" href="/${esc(c.id)}/">Full unit calendar <span aria-hidden="true">→</span></a></div>
  </article>`;
}

/* ---------- Course page ---------- */
function lessonHtml(c, l, today, sec) {
  const d = dateOf(l, sec), isToday = d === today, past = d && d < today, note = noteOf(l, sec), short = shortOf(l, sec);
  const date = d ? `<span class="wd">${esc(fmt.wd(d))}</span><span class="md">${esc(fmt.md(d))}</span>` : `<span class="tba">Date TBA</span>`;
  const label = d ? fmt.long(d) : 'Date to be announced';
  return `<li class="lesson${isToday ? ' is-today' : ''}${past ? ' past' : ''}"${d ? ` id="d-${esc(d)}"` : ''}${isToday ? ' aria-current="date"' : ''}>
    <div class="date"><span class="sr-only">${esc(label)}</span><span aria-hidden="true" class="date-vis">${date}</span>${l.session ? `<span class="bk">${esc(l.session)}</span>` : ''}</div>
    <div class="lbody">
      <h4 class="l-title">${isToday ? '<span class="pill today-pill">Today</span>' : ''}<span>${esc(l.title)}</span>${(l.flags || []).map(pill).join('')}</h4>
      ${note || short ? `<p class="flag">${short ? '<span class="sb">Short block</span> ' : ''}${esc(note.replace(/ · short block$/i, '').replace(/^short block$/i, ''))}</p>` : ''}
      ${codes(c, l)}
      ${fields(l)}
      ${c.toolLinks?.filter(t => t.match && new RegExp(t.match, 'i').test(l.title)).map(t => `<a class="more" href="${esc(t.href)}">${esc(t.label)} <span aria-hidden="true">→</span></a>`).join('') || ''}
    </div></li>`;
}
function unitHtml(c, u, today, sec, open) {
  return `<section class="unit" id="unit-${esc(u.id)}" aria-labelledby="h-${esc(u.id)}">
    <div class="unit-head"><h2 id="h-${esc(u.id)}">${esc(u.title)}</h2>${u.status === 'current' ? '<span class="pill now-pill">Current unit</span>' : ''}</div>
    ${u.stds?.length ? `<ul class="codes stds" aria-label="NGSS standards">${u.stds.map(s => `<li class="code">${esc(s)}</li>`).join('')}</ul>` : ''}
    <ol class="lessons">${u.lessons.map(l => lessonHtml(c, l, today, sec)).join('')}</ol></section>`;
}

export function trailHtml(c, units) {
  const trailUnits = (c.units || []).filter(u => u.trail !== false);
  if (!trailUnits.length) return '';
  const st = Object.fromEntries(units.map(u => [u.id, u.status]));
  const cur = trailUnits.findIndex(u => st[u.id] === 'current');
  return `<nav class="trail-wrap" aria-label="Units this year"><ol class="trail">${trailUnits.map((u, i) => {
    const cls = i < cur || (cur < 0 && st[u.id] === 'past') ? 'done' : i === cur ? 'now' : '';
    const has = units.some(x => x.id === u.id);
    const label = u.id.replace(/^U/, '');
    const inner = `<span class="dot" aria-hidden="true">${esc(label.length > 3 ? label.slice(0, 2) : label)}</span><span class="wt">${esc(u.title)}</span>${cls === 'done' ? '<span class="sr-only"> (done)</span>' : ''}`;
    return `<li class="wp ${cls}"${cls === 'now' ? ' aria-current="step"' : ''}>${has ? `<a href="#unit-${esc(u.id)}">${inner}</a>` : inner}</li>`;
  }).join('')}</ol></nav>`;
}

export function calendarHtml(c, lessons, today, section) {
  const sec = c.sections?.length ? section : 'default';
  const units = groupUnits(lessons, today, sec);
  const past = units.filter(u => u.status === 'past'), rest = units.filter(u => u.status !== 'past');
  return {
    units,
    trail: trailHtml(c, units),
    body: `${past.length ? `<details class="earlier"><summary>Earlier units (${past.length})</summary><div class="inner">${past.map(u => unitHtml(c, u, today, sec)).join('')}</div></details>` : ''}
      ${rest.map(u => unitHtml(c, u, today, sec)).join('')}
      ${!units.length ? '<p class="muted">The calendar for this course hasn’t been posted yet.</p>' : ''}`,
  };
}

const KIND_ORDER = ['Slides', 'Doc', 'PDF', 'Sheet', 'Form', 'Video', 'Link', 'File', 'Folder'];
export function resourcesHtml(c, resources, currentUnitId) {
  const byUnit = Object.fromEntries((resources?.units || []).map(u => [u.unit, u.items || []]));
  const order = [...(c.units || []).map(u => u.id), ...Object.keys(byUnit).filter(k => !(c.units || []).some(u => u.id === k))];
  const title = id => id === 'course' ? 'Course documents' : (c.units.find(u => u.id === id)?.title || id);
  const blocks = ['course', ...order.filter(id => id !== 'course')].filter(id => byUnit[id]?.length).map(id => {
    const items = [...byUnit[id]].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    return `<details class="kit-unit"${id === currentUnitId ? ' open' : ''}><summary>${esc(title(id))}${id === currentUnitId ? ' <span class="pill now-pill">Now</span>' : ''} <span class="count">${items.length}</span></summary>
      <ul class="kit-list">${items.map(i => `<li><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}<span class="sr-only"> (${esc(i.kind)}, opens in a new tab)</span></a><span class="k" aria-hidden="true">${esc(i.kind)}</span></li>`).join('')}</ul></details>`;
  });
  return blocks.length ? blocks.join('') : '<p class="muted">Resources for this course will be posted here.</p>';
}
