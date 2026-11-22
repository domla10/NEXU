import test from 'node:test';
import assert from 'node:assert/strict';
import { CourseManagement } from '../src/lib/academic/course-management.ts';
import { courses, sections, users, assignments, enrollments } from '../src/lib/academic/demo-data.ts';

function setup() {
  let state = structuredClone({ courses, sections, users, assignments, enrollments });
  const store = { read: () => structuredClone(state), write: value => { state = structuredClone(value); } };
  return { service: new CourseManagement(store), get: () => state };
}
const admin = 'demo-multiple';
const valid = { name: 'Curso ficticio', code: 'DEMO-NUEVO', description: 'Descripción de prueba', status: 'active' };
const section = { courseId: 'course-physics-2', name: 'Grupo B', code: 'B', facilitatorId: 'facilitator-02', status: 'active' };
test('crear y editar cursos, rechazar duplicados y preservar inscripciones', async () => {
  const { service, get } = setup();
  const before = structuredClone(get().enrollments);
  const created = await service.saveCourse(admin, valid);
  assert.equal(created.ok, true);
  assert.equal(get().sections.filter(s => s.courseId === created.value.id).length, 1);
  assert.equal((await service.saveCourse(admin, { ...valid, code: 'demo-nuevo' })).ok, false);
  assert.equal((await service.saveCourse(admin, { ...valid, name: 'Editado', status: 'inactive' }, created.value.id)).ok, true);
  assert.equal((await service.saveCourse(admin, { ...valid, name: '' })).ok, false);
  assert.deepEqual(get().enrollments, before);
});
test('cada curso tiene un grupo y permite cambiar su facilitador', async () => {
  const { service, get } = setup();
  assert.equal((await service.saveSection(admin, section)).ok, false);
  assert.equal((await service.saveSection(admin, { ...section, facilitatorId: 'participant-01' }, 'section-physics-demo')).ok, false);
  assert.equal((await service.saveSection(admin, { ...section, facilitatorId: 'facilitator-02' }, 'section-physics-demo')).ok, true);
  assert.equal(get().assignments.find(a => a.sectionId === 'section-physics-demo').userId, 'facilitator-02');
  assert.equal(get().enrollments.filter(e => e.sectionId === 'section-physics-demo').length, 13);
});
test('permisos, contextos y protección de operaciones de escritura', async () => {
  const { service } = setup();
  assert.equal((await service.saveCourse('participant-01', valid)).ok, false);
  assert.equal((await service.saveSection('facilitator-02', section)).ok, false);
  assert.equal((await service.list('participant-01')).ok, false);
  assert.equal((await service.listForRole('participant-01', 'participante')).length, 1);
  assert.equal((await service.listForRole('participant-01', 'facilitador')).length, 0);
  assert.equal((await service.listForRole(admin, 'facilitador'))[0].course.name, 'Física II');
  assert.equal((await service.listForRole(admin, 'participante')).length, 2);
});
