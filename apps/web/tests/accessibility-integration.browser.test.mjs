import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const base = process.env.NEXU_TEST_BASE_URL;
test('formularios y navegación exponen ubicación y errores', { skip: !base }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${base}/register`);
    assert.match(await page.title(), /Crear cuenta/);
    await page.getByRole('button', { name: 'Validar registro de ejemplo' }).click();
    const summary = page.locator('.error-summary');
    await summary.waitFor();
    assert.equal(await summary.evaluate(el => el === document.activeElement), true);
    assert.equal(await summary.locator('a[href^="#"]').count(), 4);
    await summary.locator('a[href="#email"]').click();
    assert.equal(await page.locator('#email').evaluate(el => el === document.activeElement), true);
    await page.goto(`${base}/docente`);
    assert.match(await page.title(), /Facilitador/);
    assert.equal(await page.locator('nav [aria-current="page"]').getAttribute('href'), '/docente');
    await page.goto(`${base}/docente/cursos/fisica-ii`);
    assert.equal(await page.locator('nav [aria-current="page"]').count(), 0);
  } finally { await browser.close(); }
});
