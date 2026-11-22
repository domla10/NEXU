'use client';
import { useSyncExternalStore } from 'react';
import { assignments, courses, enrollments, sections, users } from './demo-data';
import type { DemoState, StateStore } from './course-management';

const key = 'nexu-demo-course-management-v1';
const event = 'nexu-demo-changed';
export function initialState(): DemoState { return structuredClone({ users, courses, sections, assignments, enrollments, requests: [] }); }
export const browserStore: StateStore = {
  read() {
    const saved = localStorage.getItem(key);
    if (!saved) return initialState();
    const state: unknown = JSON.parse(saved);
    if (!state || typeof state !== 'object' || !['users', 'courses', 'sections', 'assignments', 'enrollments'].every(k => Array.isArray((state as Record<string, unknown>)[k]))) throw new Error('Los datos guardados no tienen un formato válido.');
    const data = state as DemoState;
    data.users = data.users.map(user => ({ ...user, demoParticipant: user.demoParticipant ?? users.find(seed => seed.id === user.id)?.demoParticipant }));
    for (const seed of users.filter(user => user.id.startsWith('participant-extra-'))) {
      if (!data.users.some(user => user.id === seed.id)) data.users.push({ ...seed });
    }
    if (data.requests === undefined) data.requests = [];
    if (!Array.isArray(data.requests)) throw new Error('Las solicitudes guardadas no tienen un formato válido.');
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
