import test from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.NEXU_TEST_BASE_URL;
test('paneles y navegación muestran los cursos del contexto', { skip: !base }, async () => {
  const facilitator = await fetch(`${base}/docente`);
  assert.equal(facilitator.status, 200);
  const facilitatorHtml = await facilitator.text();
  assert.match(facilitatorHtml, /Física II/);
  assert.match(facilitatorHtml, /\/docente\/cursos\/fisica-ii/);
  assert.doesNotMatch(facilitatorHtml, /Introducción a la ciencia/);
  const participant = await fetch(`${base}/estudiante`);
  assert.equal(participant.status, 200);
  const participantHtml = await participant.text();
  assert.match(participantHtml, /Física II/);
  assert.match(participantHtml, /Introducción a la ciencia/);
  for (const path of ['/docente/cursos/fisica-ii', '/docente/cursos/fisica-ii/asistencia', '/docente/cursos/fisica-ii/historial']) {
    assert.equal((await fetch(base + path)).status, 200);
  }
  assert.equal((await fetch(`${base}/docente/cursos/introduccion-ciencia`)).status, 404);
});
