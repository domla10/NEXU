import test from 'node:test';
import assert from 'node:assert/strict';
import { browserStore, initialState } from '../src/lib/academic/browser-store.ts';
import { AttendanceService } from '../src/lib/academic/attendance-service.ts';
import { CourseManagement } from '../src/lib/academic/course-management.ts';

const storageKey = 'nexu-demo-course-management-v1';
const legacyCourse = {
  id: 'course-second', slug: 'introduccion-ciencia', name: 'Introducción a la ciencia',
  code: 'DEMO-CIENCIA', description: 'Curso ficticio adicional.', program: 'Curso ficticio',
  institution: 'UNESR', campus: 'Núcleo Araure', status: 'active', isPilot: false,
};

function openLegacyStore(t) {
  const saved = initialState();
  delete saved.catalogVersion;
  saved.courses[1] = { ...legacyCourse };
  const values = new Map([[storageKey, JSON.stringify(saved)]]);
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  t.after(() => {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });
  return {
    saved,
    persist: () => values.set(storageKey, JSON.stringify(saved)),
    stored: () => JSON.parse(values.get(storageKey)),
  };
}

test('actualiza el curso histórico una vez y permite usar su QR vigente', t => {
  const { saved, persist, stored } = openLegacyStore(t);
  const sectionId = 'section-second-demo';
  const courseId = 'course-second';
  const facilitatorId = 'facilitator-02';
  const sessionId = 'sesion-anterior';
  const token = 'token-vigente';
  const date = '2026-11-20T10:00:00.000Z';
  saved.courses[1].description = 'Descripción configurada por administración';
  saved.sessions = [{ id: sessionId, courseId, sectionId, facilitatorId, createdAt: date, startedAt: date, status: 'activa', validitySeconds: 30, token, expiresAt: 31000 }];
  saved.attendance = [{ id: 'registro-anterior', sessionId, participantId: 'demo-multiple', recordedAt: date, method: 'qr-demo', status: 'registrada' }];
  saved.requests = [{ id: 'solicitud-anterior', participantId: 'participant-01', courseId, sectionId, facilitatorId, createdAt: date, origin: 'qr', status: 'aprobada', resolvedAt: date, resolvedBy: facilitatorId }];
  saved.enrollments.push({ sectionId, userId: 'participant-01', status: 'retirada', updatedAt: date });
  persist();

  const migrated = browserStore.read();
  const expected = structuredClone(saved);
  expected.courses[1].name = 'Idioma Moderno';
  expected.courses[1].code = 'DEMO-IDIOMA';
  expected.catalogVersion = 2;
  assert.deepEqual(migrated, expected);
  assert.deepEqual(stored(), expected);
  assert.deepEqual(browserStore.read(), expected);
  const qr = JSON.stringify({ version: 'nexu-demo-qr-1', sessionId, courseId, sectionId, token });
  assert.equal(new AttendanceService(browserStore).inspect(qr, 30000).ok, true);
});

test('respeta un Idioma Moderno creado por administración y sus relaciones', t => {
  const { saved, persist } = openLegacyStore(t);
  saved.courses.push({ ...legacyCourse, id: 'curso-manual', slug: 'curso-manual', name: ' IDIOMA MODERNO ', code: 'IDM' });
  saved.sections.push({ id: 'grupo-manual', courseId: 'curso-manual', name: 'Grupo único', code: 'UNICO', status: 'active' });
  saved.assignments.push({ sectionId: 'grupo-manual', userId: 'facilitator-02' });
  persist();
  const migrated = browserStore.read();
  assert.deepEqual(migrated.courses, saved.courses);
  assert.deepEqual(migrated.sections, saved.sections);
  assert.deepEqual(migrated.assignments, saved.assignments);
});

test('respeta el nombre personalizado del segundo curso y ediciones futuras', async t => {
  const { saved, persist } = openLegacyStore(t);
  saved.courses[1].name = 'Taller regional';
  persist();
  assert.deepEqual(browserStore.read().courses, saved.courses);
  const result = await new CourseManagement(browserStore).saveCourse('demo-multiple', legacyCourse, legacyCourse.id);
  assert.ok(result.ok);
  assert.deepEqual(browserStore.read().courses[1], legacyCourse);
});

test('conserva el código personalizado o asignado a otro curso', t => {
  const { saved, persist } = openLegacyStore(t);
  saved.courses[1].code = 'MI-CODIGO';
  persist();
  assert.equal(browserStore.read().courses[1].code, 'MI-CODIGO');
  saved.courses[1].code = 'DEMO-CIENCIA';
  saved.courses.push({ ...legacyCourse, id: 'otro', slug: 'otro', name: 'Taller', code: 'DEMO-IDIOMA' });
  persist();
  const state = browserStore.read();
  assert.deepEqual(state.courses.map(c => c.code), ['DEMO-FIS2', 'DEMO-CIENCIA', 'DEMO-IDIOMA']);
  assert.equal(state.courses[1].name, 'Idioma Moderno');
});

test('un fallo de cuota mantiene legible el catálogo y permite reintentar la migración', t => {
  const { saved, stored } = openLegacyStore(t);
  const blocked = t.mock.method(localStorage, 'setItem', () => {
    throw new DOMException('Almacenamiento lleno', 'QuotaExceededError');
  });
  assert.equal(browserStore.read().courses[1].name, 'Idioma Moderno');
  assert.deepEqual(stored(), saved);
  blocked.mock.restore();
  browserStore.read();
  assert.equal(stored().catalogVersion, 2);
});
