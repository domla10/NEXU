import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.NEXU_TEST_BASE_URL;
test('administración y curso organizan herramientas en móvil', { skip: !base }, async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
 try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/admin`);
  await page.getByRole('button', { name: 'Gestión de cursos' }).click();
  await page.locator('#course-name').waitFor();
  assert.equal(await page.locator('#section-course').count(), 0);
  await page.getByRole('button', { name: /Panel de administración/ }).click();
  await page.getByRole('button', { name: 'Inscripciones', exact: true }).click();
  await page.locator('#member-search').waitFor();
  await page.getByRole('button', { name: /Panel de administración/ }).click();
  await page.getByRole('button', { name: 'Solicitudes', exact: true }).click();
  await page.getByText('No hay solicitudes.').waitFor();
  await page.goto(`${base}/docente/cursos/fisica-ii`);
  await page.getByRole('link', { name: /Iniciar asistencia/ }).waitFor();
  await page.getByRole('link', { name: /Participantes/ }).click();
  await page.getByText('Participante ficticio 1', { exact: true }).waitFor();
  assert.equal(await page.locator('text=Participante ficticio').count(), 12);
  await page.getByRole('link', { name: /Física II/ }).first().click();
  await page.getByRole('link', { name: /Historial/ }).click();
  await page.getByText('Sin sesiones registradas.').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 } finally { await browser.close(); }
});
