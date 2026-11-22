import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.NEXU_TEST_BASE_URL;
test('rutas de demostración responden antes de hidratar', { skip: !base }, async () => {
  for (const path of ['/', '/admin', '/docente', '/estudiante', '/docente/cursos/fisica-ii', '/docente/cursos/fisica-ii/asistencia', '/docente/cursos/fisica-ii/historial']) {
    assert.equal((await fetch(base + path)).status, 200, path);
  }
});
