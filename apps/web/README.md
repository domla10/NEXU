
## Gestión de cursos de demostración

La ruta `/admin` permite crear y editar cursos y secciones con un administrador ficticio. Los cambios se conservan en `localStorage` del navegador, sobreviven a una recarga y no se envían a Supabase. Los paneles de administración, participante y facilitador consultan la misma fuente local y se actualizan al cambiar los datos en el mismo navegador y origen. No existe sincronización entre dispositivos. Los permisos del servicio son una demostración y no constituyen seguridad frente a modificaciones del navegador.

Los códigos con prefijo `DEMO` son ficticios. No representan códigos oficiales. Para ejecutar también la prueba HTTP de navegación, inicia la aplicación localmente y ejecuta `NEXU_TEST_BASE_URL=http://127.0.0.1:3188 npm test` ajustando el puerto al servidor.

## Solicitudes e inscripciones

El administrador puede inscribir y retirar participantes ficticios. El participante puede solicitar una sección disponible y cancelar solicitudes pendientes. Un facilitador asignado o administrador puede aprobar o rechazar solicitudes. La aprobación guarda la inscripción y la decisión en una única escritura local; PostgreSQL deberá implementar una transacción real al integrar Supabase. Las retiradas permanecen en el historial. El origen `qr` está reservado para el futuro; no existe validación de QR.

El almacenamiento local no es una base de datos ni un control de acceso. Sus operaciones no ofrecen garantías transaccionales ante escrituras simultáneas desde varias pestañas.

## Asistencia QR de demostración

En el panel de facilitador, entra a Física II y después a «Iniciar asistencia». Selecciona la sección, crea e inicia una sesión y muestra su QR. El modo de presentación mantiene la URL y permite salir sin cerrar la sesión. El QR cambia cada 30 segundos; su código, vigencia y registros son ficticios.

En el panel de participante, selecciona un usuario ficticio y abre el lector. La cámara necesita permiso y un contexto seguro HTTPS o localhost. Para probar en un solo navegador se puede copiar el texto de demostración del QR y pegarlo en el lector. Un participante no inscrito puede solicitar inscripción; aprobarla no registra asistencia. Los datos solo existen en el almacenamiento local de ese navegador: no hay sincronización entre dispositivos ni autorización real.

La etapa 4B necesita identidad verificada, emisión y validación de tokens en el servidor con reloj confiable, transacciones y restricciones de duplicados en PostgreSQL, RLS y auditoría. No se deben utilizar estos tokens locales para registrar asistencia real.
