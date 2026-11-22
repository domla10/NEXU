'use strict';
// A recovery must start here: PKCE binds the email link to this browser.
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const flowId = params.get('sb_flow_id');
const hadHash = Boolean(window.location.hash);
window.history.replaceState(null, '', window.location.pathname);
const status = document.getElementById('status');
const start = document.getElementById('start');
const form = document.getElementById('form');
const memory = new Map();
function clearVerifiers() {
  const keys = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith('nexu-test-recovery-') && key.endsWith('-code-verifier')) keys.push(key);
  }
  for (const key of keys) window.localStorage.removeItem(key);
}
// Only PKCE verifiers are persisted across the email/browser round trip;
// access and refresh tokens stay in this page's memory.
const storage = {
  getItem(key) {
    if (!key.endsWith('-code-verifier')) return memory.get(key) || null;
    try {
      const record = JSON.parse(window.localStorage.getItem(key));
      if (record && typeof record.value === 'string' && record.expires > Date.now()) return record.value;
    } catch { /* malformed records fail closed */ }
    window.localStorage.removeItem(key);
    return null;
  },
  setItem(key, value) { if (key.endsWith('-code-verifier')) window.localStorage.setItem(key, JSON.stringify({ value, expires: Date.now() + 3600000 })); else memory.set(key, value); },
  removeItem(key) { if (key.endsWith('-code-verifier')) window.localStorage.removeItem(key); else memory.delete(key); },
};
if (!window.isSecureContext) {
  status.textContent = 'Se requiere una conexión HTTPS segura.';
} else {
  const client = supabase.createClient('https://hwckbmhfbsrwqohhmrom.supabase.co', 'sb_publishable_AdpGePL6Yz8rwoUuKHeKHA_542fLd8M', {
    auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: false, storageKey: 'nexu-test-recovery', storage },
  });
  let recoveryEvent = false;
  let authorizedRecovery = false;
  client.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') recoveryEvent = true; });
  start.addEventListener('submit', async event => {
    event.preventDefault();
    const button = start.querySelector('button');
    button.disabled = true;
    try {
      const { error } = await client.auth.resetPasswordForEmail(document.getElementById('email').value.trim(), {
        redirectTo: 'https://nexu-test-recovery.vercel.app/nexu-test-recovery/',
      });
      if (error) throw error;
      start.hidden = true;
      status.textContent = 'Si la cuenta existe, revisa el correo y abre el enlace en este mismo navegador.';
    } catch (error) {
      if (error?.code === 'over_email_send_rate_limit') {
        status.textContent = 'Supabase ha alcanzado un límite de envío de correos. No se envió esta solicitud; espera antes de volver a intentarlo.';
        // Do not encourage repeated requests when no retry time is available.
      } else if (error?.status === 429) {
        status.textContent = 'Supabase ha alcanzado un límite de solicitudes. Espera antes de volver a intentarlo.';
      } else if (typeof error?.status === 'number' && error.status >= 400) {
        status.textContent = 'El servidor no aceptó la solicitud. Revisa la configuración de NEXU-TEST antes de intentarlo de nuevo.';
        button.disabled = false;
      } else {
        status.textContent = 'No se pudo confirmar si se envió la solicitud. Revisa el correo y la conexión antes de intentarlo de nuevo.';
        button.disabled = false;
      }
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authorizedRecovery) return;
    const password = document.getElementById('password');
    const confirmation = document.getElementById('confirmation');
    if (password.value.length < 16 || password.value !== confirmation.value) {
      status.textContent = 'Las contraseñas deben coincidir y tener al menos 16 caracteres.';
      return;
    }
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const { error } = await client.auth.updateUser({password: password.value});
      if (error) throw error;
      authorizedRecovery = false;
      password.value = '';
      confirmation.value = '';
      form.hidden = true;
      status.textContent = 'Contraseña actualizada. Ya puedes cerrar esta página.';
    } catch {
      status.textContent = 'No se pudo actualizar la contraseña; la sesión puede haber caducado.';
      button.disabled = false;
    }
  });
  if (code && !hadHash) {
    (async () => {
      try {
        const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? {flowId} : undefined);
        clearVerifiers();
        if (error || !recoveryEvent || !data.session?.access_token) throw new Error('invalid recovery');
        // Auth verifies the token with the server; only then inspect its signed method.
        const { data: userData, error: userError } = await client.auth.getUser(data.session.access_token);
        if (userError || !userData?.user) throw new Error('invalid session');
        const payload = JSON.parse(atob(data.session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.iss !== 'https://hwckbmhfbsrwqohhmrom.supabase.co/auth/v1' || !Array.isArray(payload.amr) || !payload.amr.some(item => item.method === 'recovery')) throw new Error('not a recovery session');
        authorizedRecovery = true;
        status.textContent = 'Introduce una contraseña nueva.';
        form.hidden = false;
      } catch {
        clearVerifiers();
        status.textContent = 'El enlace no es válido, ha caducado o se abrió en otro navegador. Inicia de nuevo la recuperación aquí.';
        start.hidden = false;
      }
    })();
  } else {
    status.textContent = hadHash ? 'Este enlace antiguo ya no se puede utilizar. Inicia aquí una nueva recuperación.' : 'Inicia la recuperación en este navegador.';
    start.hidden = false;
  }
}
