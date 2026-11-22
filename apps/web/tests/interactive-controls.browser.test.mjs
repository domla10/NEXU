import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const base = process.env.NEXU_TEST_BASE_URL;
const launch = () => chromium.launch({
  headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'],
});
const button = (page, name) => page.getByRole('button', { name, exact: true });
const disclosure = (page, name) => page.locator('summary').filter({ hasText: new RegExp('^' + name + '$') });

async function checkSurfaces(page) {
  const issues = await page.evaluate(() => {
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth) problems.push('Desbordamiento horizontal');
    for (const control of document.querySelectorAll('a[href], button, summary, select, textarea, input')) {
      if (!control.checkVisibility()) continue;
      const rect = control.getBoundingClientRect();
      const style = getComputedStyle(control);
      const label = control.getAttribute('aria-label') || control.innerText || control.id || control.tagName;
      if (rect.width < 44 || rect.height < 44) problems.push(label + ' tiene un blanco táctil reducido');
      const border = parseFloat(style.borderTopWidth) > 0 && style.borderTopColor !== 'rgba(0, 0, 0, 0)';
      if (!border && style.backgroundColor === 'rgba(0, 0, 0, 0)') problems.push(label + ' carece de superficie');
      if (control.matches('a, button') && control.querySelector('a, button, input, select, textarea')) {
        problems.push(label + ' contiene otra acción');
      }
    }
    return problems;
  });
  assert.deepEqual(issues, [], page.url());
}

for (const width of [360, 390, 430, 1280]) {
  test(`controles visibles y navegación por teclado a ${width} px`, { skip: !base }, async () => {
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width, height: width >= 1000 ? 900 : width === 360 ? 800 : 844 }, isMobile: width < 1000, hasTouch: width < 1000 });
      for (const route of ['/', '/login', '/register', '/forgot-password']) {
        await page.goto(base + route);
        await checkSurfaces(page);
      }
      await page.goto(base + '/admin');
      await button(page, 'Gestión de cursos').focus();
      await page.keyboard.press('Enter');
      const pencil = button(page, 'Editar Física II');
      await pencil.waitFor();
      await checkSurfaces(page);
      await pencil.focus();
      assert.equal(await pencil.evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'), true);
      await page.keyboard.press('Space');
      await page.getByLabel('Nombre', { exact: true }).waitFor();
      await checkSurfaces(page);
      await button(page, 'Cancelar').click();
      await page.goto(base + '/estudiante');
      await page.getByLabel('Participante de demostración').waitFor();
      await disclosure(page, 'Catálogo y solicitudes de inscripción').click();
      await disclosure(page, 'Escanear QR').click();
      await disclosure(page, 'Alternativa de prueba con texto').click();
      await checkSurfaces(page);
      await page.goto(base + '/docente');
      await page.getByRole('link', { name: /Física II/ }).click();
      await checkSurfaces(page);
      await page.getByRole('link', { name: /Iniciar asistencia/ }).click();
      await button(page, 'Crear sesión').waitFor();
      await checkSurfaces(page);
    } finally { await browser.close(); }
  });
}

test('el participante solicita y cada facilitador decide desde la materia correspondiente', { skip: !base }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('dialog', dialog => dialog.accept());
    await page.goto(base + '/estudiante');
    await page.getByLabel('Participante de demostración').selectOption('participant-extra-01');
    await disclosure(page, 'Catálogo y solicitudes de inscripción').click();
    for (const course of ['Física II', 'Idioma Moderno']) {
      const card = page.locator('article').filter({ has: button(page, 'Solicitar inscripción'), hasText: course });
      await button(card, 'Solicitar inscripción').click();
      await card.getByText('Solicitud pendiente', { exact: true }).waitFor();
    }
    await page.goto(base + '/docente');
    for (const [course, facilitator, decision] of [
      ['Física II', 'demo-multiple', 'Rechazar'], ['Idioma Moderno', 'facilitator-02', 'Aprobar'],
    ]) {
      await page.getByLabel('Facilitador de demostración').selectOption(facilitator);
      await page.getByRole('link', { name: new RegExp(course) }).click();
      await page.getByRole('link', { name: /Participantes/ }).click();
      const action = button(page, decision);
      await action.waitFor();
      await checkSurfaces(page);
      await action.click();
      await action.waitFor({ state: 'detached' });
      await page.getByRole('link', { name: new RegExp(course) }).click();
      await page.getByRole('link', { name: /Mis cursos/ }).click();
      assert.equal(await page.getByLabel('Facilitador de demostración').inputValue(), facilitator);
    }
    await page.goto(base + '/estudiante');
    await page.getByLabel('Participante de demostración').selectOption('participant-extra-01');
    await page.getByRole('heading', { name: 'Idioma Moderno', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Física II', exact: true }).count(), 0);
    await disclosure(page, 'Catálogo y solicitudes de inscripción').click();
    await page.getByText(/rechazada/i).first().waitFor();
    await page.getByText(/aprobada/i).first().waitFor();
  } finally { await browser.close(); }
});
