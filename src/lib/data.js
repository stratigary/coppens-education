// Build-time data helpers.
import fs from 'node:fs';
import path from 'node:path';
import site from '../data/site.json';
import coursesData from '../data/courses.json';
import { parseCourseCSV, todayISO } from './sheets.js';

export { site };
export const allCourses = coursesData.courses;
export const courses = coursesData.courses.filter(c => c.enabled);
export const courseById = id => allCourses.find(c => c.id === id);
const resourceFiles = import.meta.glob('../data/resources/*.json', { eager: true, import: 'default' });
export const resourcesFor = id => resourceFiles[`../data/resources/${id}.json`] || { units: [] };

/** Lessons from the saved copy (public/data/fallback/<id>.csv); the browser swaps in live data. */
export function savedLessons(c) {
  const file = path.join(process.cwd(), 'public', 'data', 'fallback', `${c.id}.csv`);
  if (!fs.existsSync(file)) return [];
  return parseCourseCSV(fs.readFileSync(file, 'utf8'), c, { startYear: site.schoolYearStart });
}
export const buildToday = () => todayISO(site.timeZone);
export const activeAnnouncements = (courseId, today) => (site.announcements || []).filter(a =>
  a.show !== false && a.text && (!a.until || a.until >= today) && (a.course === 'all' || !a.course || a.course === courseId || (courseId === 'home')));
