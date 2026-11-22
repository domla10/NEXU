'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../recovery-test/recovery.js'), 'utf8');

function page(hash, secure = true, responseOk = true) {
  const requests = [];
  let handler;
  let cleared = false;
  const button = { disabled: false };
  const elements = {
    form: { hidden: true, addEventListener: (type, fn) => { handler = fn; }, querySelector: () => button },
    status: { textContent: '' },
    password: { value: 'a'.repeat(20) },
    confirmation: { value: 'a'.repeat(20) },
  };
  const context = {
    URLSearchParams,
    window: { isSecureContext: secure, location: { hash, pathname: '/' },
      history: { replaceState: (_a, _b, url) => { assert.equal(url, '/'); cleared = true; } } },
    document: { getElementById: id => elements[id] },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: responseOk }; },
  };
  vm.runInNewContext(script, context);
  assert.equal(cleared, true);
  return { elements, requests, submit: () => handler({ preventDefault() {} }) };
}

(async () => {
  assert.equal(page('#type=signup&access_token=example').elements.form.hidden, true);
  assert.equal(page('#type=recovery&access_token=example', false).elements.form.hidden, true);
  assert.equal(page('#type=recovery').elements.form.hidden, true);
  const mismatch = page('#type=recovery&access_token=example');
  mismatch.elements.confirmation.value = 'different';
  await mismatch.submit();
  assert.equal(mismatch.requests.length, 0);
  const success = page('#type=recovery&access_token=example&refresh_token=never-send');
  await success.submit();
  assert.equal(success.requests.length, 1);
  const request = success.requests[0];
  assert.equal(request.url, 'https://hwckbmhfbsrwqohhmrom.supabase.co/auth/v1/user');
  assert.equal(request.options.headers.Authorization, 'Bearer example');
  assert.equal(request.options.referrerPolicy, 'no-referrer');
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.redirect, 'error');
  assert.equal(JSON.stringify(request).includes('never-send'), false);
  assert.equal(success.elements.form.hidden, true);
  assert.equal(success.elements.password.value, '');
  const failed = page('#type=recovery&access_token=example', true, false);
  await failed.submit();
  assert.equal(failed.elements.form.hidden, false);
  assert.match(failed.elements.status.textContent, /No se pudo/);
  console.log('Recuperación NEXU-TEST: pruebas simuladas correctas.');
})().catch(error => { console.error(error); process.exit(1); });
