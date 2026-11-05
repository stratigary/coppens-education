import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCSV, parseDateCell, parseCourseCSV, snapshot, groupUnits, dateOf } from '../src/lib/sheets.js';

const courses = JSON.parse(fs.readFileSync(new URL('../src/data/courses.json', import.meta.url))).courses;
const course = id => courses.find(c => c.id === id);
const saved = id => fs.readFileSync(new URL(`../public/data/fallback/${id}.csv`, import.meta.url), 'utf8');

test('CSV parser handles quotes, commas and line breaks inside cells', () => {
  assert.deepEqual(parseCSV('a,"b, c","d\n""e"""\r\n1,2,3'), [['a', 'b, c', 'd\n"e"'], ['1', '2', '3']]);
});

test('dates without a year: Aug–Dec is the start year, Jan–Jun the next', () => {
  assert.equal(parseDateCell('8/21\nSch.5', 2026).iso, '2026-08-21');
  assert.equal(parseDateCell('8/21\nSch.5', 2026).note, 'Schedule 5');
  assert.equal(parseDateCell('1/12', 2026).iso, '2027-01-12');
  assert.equal(parseDateCell('06/03/2027', 2026).iso, '2027-06-03');
  assert.equal(parseDateCell('', 2026).iso, null);
  assert.match(parseDateCell('11/16\n2 hr delay', 2026).note, /2 hr delay/);
});

test('APES: never publishes teacher-only JiTT columns', () => {
  const head = parseCSV(saved('apes'))[0].join('|').toLowerCase();
  for (const bad of ['jitt', 'additional activity', 'if we lose a day', 'calendar note']) assert.ok(!head.includes(bad), bad);
});

test('APES: today, flags and short blocks', () => {
  const ls = parseCourseCSV(saved('apes'), course('apes'));
  const s = snapshot(ls, '2026-11-05', 'default');
  assert.equal(dateOf(s.today), '2026-11-05');
  assert.equal(s.today.unitId, 'U3');
  assert.ok(s.today.short.default, '11/5 is a 2-hr delay short block');
  const test = ls.find(l => dateOf(l) === '2026-11-17');
  assert.ok(test.flags.some(f => f.type === 'test'));
});

test('IB Bio: Blue and Gold dates are separate', () => {
  const ls = parseCourseCSV(saved('ib-bio'), course('ib-bio'));
  const l = ls.find(x => x.dates.Blue === '2026-10-22');
  assert.equal(l.dates.Gold, '2026-10-23');
  assert.equal(l.unitId, 'U4');
  assert.ok(l.codes.includes('A2.2.1'));
  assert.notEqual(snapshot(ls, '2026-11-05', 'Blue').today, snapshot(ls, '2026-11-05', 'Gold').today);
});

test('Env Sci: merged unit cells carry down, blank dates stay undated', () => {
  const ls = parseCourseCSV(saved('env-sci'), course('env-sci'));
  assert.ok(ls.every(l => !l.unitId.startsWith('X-')), 'every row matched a configured unit');
  assert.ok(ls.some(l => !dateOf(l)), 'some rows have no date yet');
  const units = groupUnits(ls, '2026-11-05', 'default');
  assert.equal(units.find(u => u.status === 'current').id, 'U4');
});
