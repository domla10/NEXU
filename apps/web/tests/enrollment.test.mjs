import test from 'node:test';
import assert from 'node:assert/strict';
import { EnrollmentService } from '../src/lib/academic/enrollment-service.ts';
import { courses, sections, users, assignments, enrollments } from '../src/lib/academic/demo-data.ts';
function setup() { let state = structuredClone({ courses, sections, users, assignments, enrollments, requests: [] }); const store = { read: () => structuredClone(state), write: value => { state = structuredClone(value); } }; return { api: new EnrollmentService(store), get: () => state, store }; }
const physics = 'section-physics-demo', second = 'section-second-demo', admin = 'demo-multiple', extra = 'participant-extra-01';
test('solicitud, autorización por sección y aprobación indivisible', async () => {
 const { api, get } = setup(); const req = await api.request(extra, physics); assert.equal(req.ok, true);
 assert.equal((await api.request(extra, physics)).ok, false);
 assert.equal((await api.resolve('facilitator-02', req.value.id, 'aprobada')).ok, false);
 assert.equal((await api.resolve('participant-01', req.value.id, 'aprobada')).ok, false);
 assert.equal((await api.resolve(admin, req.value.id, 'aprobada')).ok, true);
 assert.equal(get().requests[0].status, 'aprobada'); assert.equal(get().enrollments.filter(e => e.userId === extra && e.sectionId === physics).length, 1);
 assert.equal((await api.resolve(admin, req.value.id, 'aprobada')).ok, false);
 assert.equal(get().enrollments.filter(e => e.sectionId === physics).length, 14);
});
test('rechazo y cancelación no crean inscripción', async () => {
 const { api, get } = setup(); const a = await api.request(extra, physics);
 assert.equal((await api.resolve(admin, a.value.id, 'rechazada')).ok, true);
 const b = await api.request(extra, second); assert.equal((await api.resolve(extra, b.value.id, 'cancelada')).ok, true);
 assert.equal(get().enrollments.filter(e => e.userId === extra).length, 0);
 assert.equal(get().enrollments.filter(e => e.sectionId === physics).length, 13);
});
test('administración inscribe, retira y conserva historial', async () => {
 const { api, get } = setup(); assert.equal((await api.direct('participant-01', extra, physics)).ok, false);
 assert.equal((await api.direct(admin, extra, physics)).ok, true); assert.equal((await api.direct(admin, extra, physics)).ok, false);
 assert.equal((await api.withdraw('facilitator-02', extra, physics)).ok, false); assert.equal((await api.withdraw(admin, extra, physics)).ok, true);
 assert.equal(get().enrollments.find(e => e.userId === extra).status, 'retirada');
 assert.equal((await api.direct(admin, extra, physics)).ok, true);
});
test('al cambiar disponibilidad o inscripción la aprobación se rechaza sin cambios parciales', async () => {
 const { api, get, store } = setup(); const req = await api.request(extra, physics); const s = store.read(); s.sections.find(x => x.id === physics).status = 'inactive'; store.write(s);
 assert.equal((await api.resolve(admin, req.value.id, 'aprobada')).ok, false); assert.equal(get().requests[0].status, 'pendiente'); assert.equal(get().enrollments.filter(e => e.sectionId === physics).length, 13);
});
test('una inscripción directa posterior impide aprobar la solicitud pendiente', async () => {
 const { api, get } = setup(); const req = await api.request(extra, physics);
 assert.equal((await api.direct(admin, extra, physics)).ok, true);
 assert.equal((await api.resolve(admin, req.value.id, 'aprobada')).ok, false);
 assert.equal(get().requests[0].status, 'pendiente');
 assert.equal(get().enrollments.filter(e => e.userId === extra && e.sectionId === physics).length, 1);
 assert.equal((await api.members('participant-01', physics)).ok, false);
 assert.equal((await api.request('facilitator-02', physics)).ok, false);
});
