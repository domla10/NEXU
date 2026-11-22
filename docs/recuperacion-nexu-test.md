# Recuperación NEXU-TEST

La página utiliza @supabase/supabase-js 2.119.2, incluido localmente con su licencia. Inicie la recuperación en la página y abra el correo en el mismo navegador: PKCE vincula el código al verificador generado al solicitar el correo. Un enlace implícito anterior no puede convertirse en PKCE; es necesario solicitar otro desde la página tras la autorización correspondiente.

El evento `PASSWORD_RECOVERY` es una señal del cliente, no una prueba firmada. Tras `exchangeCodeForSession`, el servidor valida el acceso con `getUser` y la página exige también el método de recuperación firmado que Auth asigna al flujo PKCE. La página no acepta fragmentos implícitos ni inicia sesión con una sesión preexistente. La autorización del cambio mediante la API de Auth corresponde a Supabase; este control limita el comportamiento de esta página.

El verificador PKCE se guarda temporalmente en `localStorage` para permitir abrir el enlace desde el correo en otra pestaña del mismo navegador. Es un dato sensible, aunque no es un token de sesión. Solo se guardan claves de verificadores en ese almacenamiento; las sesiones y tokens permanecen en memoria. Tras el intercambio o un error se eliminan las claves de verificadores de este sitio; los datos abandonados caducan tras una hora y se eliminan al consultarlos. No abrir el enlace en modo privado ni en otro navegador. Un escáner de correo podría consumir el enlace antes que el usuario.

Las pruebas simuladas se ejecutan con `cd supabase/tests/recovery && npm ci && npm test`. Para reproducir el archivo de navegador se puede ejecutar `npm run vendor` desde ese directorio y comparar el resultado. Las pruebas simuladas no acreditan el funcionamiento real del proyecto alojado.
