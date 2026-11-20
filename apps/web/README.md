
## Gestión de cursos de demostración

La ruta `/admin` permite crear y editar cursos y secciones con un administrador ficticio. Los cambios se conservan en `localStorage` del navegador, sobreviven a una recarga y no se envían a Supabase. La consulta de asignaciones dentro de ese panel usa los datos guardados. Los paneles de participante y facilitador de la etapa 1 todavía usan los datos iniciales del servidor y no reflejan las ediciones del navegador. Los permisos del servicio son una demostración y no constituyen seguridad frente a modificaciones del navegador.

Los códigos con prefijo `DEMO` son ficticios. No representan códigos oficiales. Para ejecutar también la prueba HTTP de navegación, inicia la aplicación localmente y ejecuta `NEXU_TEST_BASE_URL=http://127.0.0.1:3188 npm test` ajustando el puerto al servidor.
