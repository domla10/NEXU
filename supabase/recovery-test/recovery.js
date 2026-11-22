'use strict';
// El fragmento se procesa solo en el navegador y se elimina antes de solicitar recursos.
const fragment = new URLSearchParams(window.location.hash.slice(1));
window.history.replaceState(null, '', window.location.pathname);
let token = fragment.get('access_token');
fragment.delete('access_token');
fragment.delete('refresh_token');
let isRecoverySession = false;
try {
  const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  isRecoverySession = payload.iss === 'https://hwckbmhfbsrwqohhmrom.supabase.co/auth/v1' &&
    Array.isArray(payload.amr) && payload.amr.some(item => item.method === 'recovery');
} catch {
  isRecoverySession = false;
}
const form = document.getElementById('form');
const status = document.getElementById('status');
if (!window.isSecureContext || fragment.get('type') !== 'recovery' || !isRecoverySession) {
  status.textContent = 'El enlace no es válido o ha caducado. Solicita uno nuevo desde NEXU-TEST.';
} else {
  status.textContent = 'Introduce una contraseña nueva.';
  form.hidden = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('password');
    const confirmation = document.getElementById('confirmation');
    const key = 'sb_publishable_AdpGePL6Yz8rwoUuKHeKHA_542fLd8M';
    if (password.value.length < 16 || password.value !== confirmation.value) {
      status.textContent = 'Las contraseñas deben coincidir y tener al menos 16 caracteres.';
      return;
    }
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const response = await fetch('https://hwckbmhfbsrwqohhmrom.supabase.co/auth/v1/user', {
        method: 'PUT',
        headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.value }),
        credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
      });
      if (!response.ok) throw new Error('recovery failed');
      token = null;
      password.value = '';
      confirmation.value = '';
      form.hidden = true;
      status.textContent = 'Contraseña actualizada. Ya puedes cerrar esta página.';
    } catch {
      status.textContent = 'No se pudo actualizar la contraseña. Solicita otro enlace si ha caducado.';
      button.disabled = false;
    }
  });
}
