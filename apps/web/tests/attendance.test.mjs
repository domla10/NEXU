import test from 'node:test';
import assert from 'node:assert/strict';
import { AttendanceService } from '../src/lib/academic/attendance-service.ts';
import { EnrollmentService } from '../src/lib/academic/enrollment-service.ts';
import { courses, sections, users, assignments, enrollments } from '../src/lib/academic/demo-data.ts';
function setup() { let state = structuredClone({ courses, sections, users, assignments, enrollments, requests: [] }); const store = { read: () => structuredClone(state), write: value => { state = structuredClone(value); } }; return { api: new AttendanceService(store), enrollment: new EnrollmentService(store), get: () => state }; }
const admin='demo-multiple', section='section-physics-demo';
test('sesiones, renovación, caducidad y finalización', async () => {
 const { api }=setup(); assert.equal((await api.create('facilitator-02',section)).ok,false);
 const session=await api.create(admin,section); assert.equal(session.ok,true); assert.equal((await api.issue(admin,session.value.id)).ok,false);
 assert.equal((await api.transition(admin,session.value.id,'activa')).ok,true);
 const one=await api.issue(admin,session.value.id,1000); assert.equal(api.inspect(one.value,30999).ok,true); assert.equal(api.inspect(one.value,31000).ok,false);
 const two=await api.issue(admin,session.value.id,31000); assert.notEqual(one.value,two.value); assert.equal(api.inspect(one.value,31001).ok,false);
 assert.equal((await api.transition(admin,session.value.id,'finalizada')).ok,true); assert.equal(api.inspect(two.value,31001).ok,false);
});
test('asistencia única y solicitud QR sin asistencia implícita', async () => {
 const { api, enrollment, get }=setup(); const sess=await api.create(admin,section); await api.transition(admin,sess.value.id,'activa'); const qr=await api.issue(admin,sess.value.id);
 assert.equal((await api.register('participant-01',qr.value)).ok,true); assert.equal((await api.register('participant-01',qr.value)).ok,false);
 assert.equal((await api.register('participant-extra-01',qr.value)).ok,false);
 const req=await api.requestFromQr('participant-extra-01',qr.value); assert.equal(req.ok,true); assert.equal((await api.requestFromQr('participant-extra-01',qr.value)).ok,false);
 assert.equal(get().requests[0].origin,'qr'); assert.equal((await enrollment.resolve(admin,req.value,'aprobada')).ok,true);
 assert.equal(get().attendance.length,1); assert.equal((await api.register('participant-extra-01',qr.value)).ok,true);
 assert.equal((await api.requestFromQr('participant-extra-02','invalido')).ok,false);
});
