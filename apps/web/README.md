
## Gestión de cursos de demostración

La ruta `/admin` permite crear y editar cursos y secciones con un administrador ficticio. Los cambios se conservan en `localStorage` del navegador, sobreviven a una recarga y no se envían a Supabase. Los paneles de administración, participante y facilitador consultan la misma fuente local y se actualizan al cambiar los datos en el mismo navegador y origen. No existe sincronización entre dispositivos. Los permisos del servicio son una demostración y no constituyen seguridad frente a modificaciones del navegador.

Los códigos con prefijo `DEMO` son ficticios. No representan códigos oficiales. Para ejecutar también la prueba HTTP de navegación, inicia la aplicación localmente y ejecuta `NEXU_TEST_BASE_URL=http://127.0.0.1:3188 npm test` ajustando el puerto al servidor.

## Solicitudes e inscripciones

El administrador puede inscribir y retirar participantes ficticios. El participante puede solicitar una sección disponible y cancelar solicitudes pendientes. Un facilitador asignado o administrador puede aprobar o rechazar solicitudes. La aprobación guarda la inscripción y la decisión en una única escritura local; PostgreSQL deberá implementar una transacción real al integrar Supabase. Las retiradas permanecen en el historial. El origen `qr` está reservado para el futuro; no existe validación de QR.

El almacenamiento local no es una base de datos ni un control de acceso. Sus operaciones no ofrecen garantías transaccionales ante escrituras simultáneas desde varias pestañas.
