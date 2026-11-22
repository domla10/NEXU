import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.NEXU_TEST_BASE_URL;
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1366, height: 768 }]) {
  test(`presentación y registro local ${viewport.width}×${viewport.height}`, { skip: !base }, async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport }); page.on('dialog', dialog => dialog.accept());
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/docente/cursos/fisica-ii/asistencia`);
      await page.getByRole('button', { name: 'Crear sesión' }).click();
      await page.getByRole('button', { name: 'Iniciar sesión de asistencia' }).click();
      await page.getByRole('button', { name: 'Mostrar QR' }).click();
      await page.getByRole('button', { name: 'Presentar QR' }).waitFor();
      const url = page.url(); await page.getByRole('button', { name: 'Presentar QR' }).click();
      await page.getByRole('button', { name: 'Salir de presentación' }).waitFor(); assert.equal(page.url(), url);
      await page.getByRole('button', { name: 'Salir de presentación' }).click(); assert.equal(page.url(), url);
      await page.locator('summary').filter({ hasText: 'Texto del QR' }).click();
      const payload = await page.locator('textarea[aria-label="Texto de QR de demostración"]').inputValue();
      await page.goto(`${base}/estudiante`); await page.locator('#actor-participante').selectOption('participant-01');
      await page.locator('summary').filter({ hasText: /^Escanear QR$/ }).click();
      await page.getByText('Alternativa de prueba con texto').click();
      await page.locator('textarea[aria-label="Texto de QR de demostración"]').fill(payload);
      await page.getByRole('button', { name: 'Comprobar QR' }).click();
      await page.getByRole('button', { name: 'Confirmar asistencia de demostración' }).click();
      await page.getByText('Asistencia de demostración registrada.').waitFor();
      await page.reload(); await page.locator('#actor-participante').selectOption('participant-01');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('summary').filter({ hasText: /^Historial de asistencia$/ }).click();
      const history = page.locator('details[open]').filter({ has: page.locator('time') });
      await history.getByText('Física II', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('cámara denegada muestra una alternativa de demostración', { skip: !base }, async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => Promise.reject(new DOMException('Denegado', 'NotAllowedError')) }); });
    await page.goto(`${base}/estudiante`);
    await page.locator('summary').filter({ hasText: /^Escanear QR$/ }).click();
    await page.getByRole('button', { name: 'Abrir cámara' }).click();
    await page.getByText('No se pudo acceder a la cámara. Revisa los permisos o usa la alternativa de texto.').waitFor();
  } finally { await browser.close(); }
});

test('presentación sin Fullscreen conserva el foco, la URL y la sesión al salir con Escape', { skip: !base }, async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
    await page.addInitScript(() => Object.defineProperty(document.documentElement, 'requestFullscreen', { value: undefined }));
    await page.goto(base + '/docente/cursos/fisica-ii/asistencia');
    await page.getByRole('button', { name: 'Crear sesión' }).click();
    await page.getByRole('button', { name: 'Iniciar sesión de asistencia' }).click();
    await page.getByRole('button', { name: 'Mostrar QR' }).click();
    const present = page.getByRole('button', { name: 'Presentar QR' });
    const url = page.url();
    const historyLength = await page.evaluate(() => history.length);
    await present.click();
    const dialog = page.getByRole('dialog', { name: 'Física II' });
    await dialog.waitFor();
    assert.equal(await dialog.evaluate(el => el.matches(':modal') && el.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await present.evaluate(el => document.activeElement === el), true);
    assert.equal(page.url(), url);
    assert.equal(await page.evaluate(() => history.length), historyLength);
    await page.getByRole('button', { name: 'Ocultar QR' }).waitFor();
  } finally { await browser.close(); }
});

test('cerrar el lector libera la cámara virtual de Chromium', { skip: !base }, async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
    await page.goto(base + '/estudiante');
    const reader = page.locator('summary').filter({ hasText: /^Escanear QR$/ });
    await reader.click();
    await page.getByRole('button', { name: 'Abrir cámara' }).click();
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    const track = await page.locator('video').evaluateHandle(video => video.srcObject.getVideoTracks()[0]);
    assert.equal(await track.evaluate(track => track.readyState), 'live');
    await reader.click();
    await page.waitForFunction(track => track.readyState === 'ended', track);
    await track.dispose();
  } finally { await browser.close(); }
});
