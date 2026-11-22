'use client';
import { useSyncExternalStore } from 'react';
import { assignments, courses, enrollments, modernLanguageCourse, sections, users } from './demo-data.ts';
import type { DemoState, StateStore } from './course-management.ts';

const key = 'nexu-demo-course-management-v1';
const event = 'nexu-demo-changed';
const catalogVersion = 2;

export function initialState(): DemoState {
  return structuredClone({ catalogVersion, users, courses, sections, assignments, enrollments, requests: [] });
}

function migrateLegacyCatalog(data: DemoState) {
  const legacy = data.courses.find(course => course.id === modernLanguageCourse.id);
  if (legacy?.name === 'Introducción a la ciencia') {
    const hasModernLanguage = data.courses.some(course =>
      course.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es') === 'idioma moderno'
    );
    if (!hasModernLanguage) {
      legacy.name = modernLanguageCourse.name;
      const codeInUse = data.courses.some(course => course.code.toUpperCase() === modernLanguageCourse.code);
      if (legacy.code === 'DEMO-CIENCIA' && !codeInUse) legacy.code = modernLanguageCourse.code;
    }
  }
  data.catalogVersion = catalogVersion;
}
export const browserStore: StateStore = {
  read() {
    const saved = localStorage.getItem(key);
    if (!saved) return initialState();
    const state: unknown = JSON.parse(saved);
    if (!state || typeof state !== 'object' || !['users', 'courses', 'sections', 'assignments', 'enrollments'].every(k => Array.isArray((state as Record<string, unknown>)[k]))) throw new Error('Los datos guardados no tienen un formato válido.');
    const data = state as DemoState;
    for (const user of data.users) {
      const seed = users.find(profile => profile.id === user.id);
      if (user.demoParticipant === undefined && seed?.demoParticipant) user.demoParticipant = true;
    }
    for (const seed of users.filter(user => user.id.startsWith('participant-extra-'))) {
      if (!data.users.some(user => user.id === seed.id)) data.users.push({ ...seed });
    }
    if (data.requests === undefined) data.requests = [];
    if (!Array.isArray(data.requests)) throw new Error('Las solicitudes guardadas no tienen un formato válido.');
    if ((data.catalogVersion ?? 1) < catalogVersion) {
      migrateLegacyCatalog(data);
      if (localStorage.getItem(key) === saved) {
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
          // Una lectura sigue siendo válida si el navegador no permite guardar la migración.
          if (!(error instanceof DOMException && ['QuotaExceededError', 'SecurityError'].includes(error.name))) throw error;
        }
      }
    }
    return data;
  },
  write(state) { localStorage.setItem(key, JSON.stringify(state)); window.dispatchEvent(new Event(event)); },
};
function subscribe(callback: () => void) {
  window.addEventListener(event, callback); window.addEventListener('storage', callback);
  return () => { window.removeEventListener(event, callback); window.removeEventListener('storage', callback); };
}
export function useDemoRevision() {
  return useSyncExternalStore(subscribe, () => localStorage.getItem(key) ?? '', () => null);
}
