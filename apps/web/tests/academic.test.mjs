import test from 'node:test';
import assert from 'node:assert/strict';
import { demoRepository, DEMO_USER_ID } from '../src/lib/academic/repository.ts';
import { users, courses, sections, assignments, enrollments } from '../src/lib/academic/demo-data.ts';

test('Física II tiene trece inscripciones únicas y sección activa', () => {
  const course = courses.find(c => c.id === 'course-physics-2');
  assert.equal(course.name, 'Física II');
  assert.equal(course.status, 'active');
  const section = sections.find(s => s.courseId === course.id);
  const rows = enrollments.filter(e => e.sectionId === section.id);
  assert.equal(rows.length, 13);
  assert.equal(new Set(rows.map(e => e.userId)).size, 13);
  assert.ok(rows.every(e => users.some(u => u.id === e.userId)));
});

test('integridad referencial y ausencia de relaciones duplicadas', () => {
  assert.equal(new Set(users.map(u => u.id)).size, users.length);
  assert.equal(new Set(courses.map(c => c.id)).size, courses.length);
  assert.ok(sections.every(s => courses.some(c => c.id === s.courseId)));
  for (const rows of [assignments, enrollments]) {
    assert.equal(new Set(rows.map(r => `${r.sectionId}:${r.userId}`)).size, rows.length);
    assert.ok(rows.every(r => users.some(u => u.id === r.userId) && sections.some(s => s.id === r.sectionId)));
  }
});

test('un mismo usuario tiene roles distintos limitados al curso', async () => {
  assert.ok(await demoRepository.hasGlobalPermission(DEMO_USER_ID, 'manage_platform'));
  assert.ok(await demoRepository.hasCoursePermission(DEMO_USER_ID, 'course-physics-2', 'manage_course'));
  assert.ok(await demoRepository.hasCoursePermission(DEMO_USER_ID, 'course-second', 'view_course'));
  assert.equal(await demoRepository.hasCoursePermission(DEMO_USER_ID, 'course-second', 'manage_course'), false);
  assert.equal(await demoRepository.hasCoursePermission('participant-01', 'course-physics-2', 'manage_course'), false);
  assert.equal(await demoRepository.hasCoursePermission('participant-01', 'course-second', 'view_course'), false);
});

test('los repositorios filtran cursos para cada contexto y no exponen referencias mutables', async () => {
  assert.deepEqual((await demoRepository.listCoursesForUser(DEMO_USER_ID, 'facilitador')).map(c => c.name), ['Física II']);
  assert.deepEqual((await demoRepository.listCoursesForUser(DEMO_USER_ID, 'participante')).map(c => c.name), ['Física II', 'Introducción a la ciencia']);
  assert.deepEqual((await demoRepository.listCoursesForUser('participant-01', 'participante')).map(c => c.name), ['Física II']);
  assert.deepEqual(await demoRepository.listCoursesForUser('inexistente', 'participante'), []);
  const result = await demoRepository.listCoursesForUser(DEMO_USER_ID, 'facilitador');
  result[0].name = 'Cambio';
  assert.equal((await demoRepository.findCourseBySlug('fisica-ii')).name, 'Física II');
});
