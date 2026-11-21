import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.NEXU_TEST_BASE_URL;
test('gestión de cursos muestra formularios solo cuando se solicitan', { skip: !base }, async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('dialog', d => d.accept());
  await page.goto(`${base}/admin`);
  await page.getByRole('button', { name: 'Gestión de cursos' }).click();
  const pencil = page.getByRole('button', { name: 'Editar Física II' }); await pencil.waitFor();
  const rect = await pencil.boundingBox(); assert.ok(rect.width >= 44 && rect.height >= 44);
  assert.equal(await page.locator('#course-name').count(), 0);
  await pencil.click(); await page.locator('#course-name').fill('Cambio cancelado');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  assert.equal(await page.locator('#course-name').count(), 0);
  await page.getByRole('button', { name: 'Editar Física II' }).click();
  assert.equal(await page.locator('#course-name').inputValue(), 'Física II');
  await page.locator('#course-description').fill('Descripción ficticia actualizada');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByText('Curso guardado en este navegador.').waitFor();
  await page.getByRole('button', { name: 'Crear nuevo curso' }).click();
  await page.locator('#course-name').fill('Curso ficticio nuevo');
  await page.locator('#course-code').fill('TEST-UNICO');
  await page.locator('#course-description').fill('Descripción ficticia');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.locator('strong').getByText('Curso ficticio nuevo', { exact: true }).waitFor();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('nexu-demo-course-management-v1')));
  assert.equal(data.enrollments.filter(e => e.sectionId === 'section-physics-demo' && e.status !== 'retirada').length, 13);
  assert.equal(data.sections.filter(s => s.courseId === data.courses.find(c => c.code === 'TEST-UNICO').id).length, 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 } finally { await browser.close(); }
});
