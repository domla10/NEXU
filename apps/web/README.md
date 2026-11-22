
## Gestión de cursos de demostración

La ruta `/admin` permite crear y editar cursos y asignar su facilitador desde «Gestión de cursos». Los cambios se conservan en `localStorage` del navegador, sobreviven a una recarga y no se envían a Supabase. Los paneles de administración, participante y facilitador consultan la misma fuente local y se actualizan al cambiar los datos en el mismo navegador y origen. No existe sincronización entre dispositivos. Los permisos del servicio son una demostración y no constituyen seguridad frente a modificaciones del navegador.

Una instalación nueva incluye Física II, con 13 participantes inscritos, e Idioma Moderno. Al leer por primera vez un catálogo anterior, la aplicación guarda la versión 2 en la misma clave de `localStorage`. El segundo curso de ejemplo conserva su ID, sus grupos y su URL histórica. Solo cambia su nombre si todavía se llama «Introducción a la ciencia» y ningún otro curso se llama «Idioma Moderno». El código original pasa a `DEMO-IDIOMA` si está disponible. Las instalaciones nuevas usan el enlace `/docente/cursos/idioma-moderno`.

Si administración ya creó Idioma Moderno, ambos cursos conservan sus nombres y relaciones. Si renombró el segundo curso, se respeta su nombre. Las solicitudes, inscripciones, sesiones, códigos QR emitidos y registros de asistencia siguen vinculados a sus IDs originales.

Los códigos con prefijo `DEMO` son ficticios. No representan códigos oficiales. Para ejecutar también la prueba HTTP de navegación, inicia la aplicación localmente y ejecuta `NEXU_TEST_BASE_URL=http://127.0.0.1:3188 npm test` ajustando el puerto al servidor.

## Solicitudes e inscripciones

El administrador puede inscribir y retirar participantes ficticios. El participante puede solicitar la inscripción en un curso disponible y cancelar solicitudes pendientes. Un facilitador asignado o administrador puede aprobar o rechazar solicitudes. La aprobación guarda la inscripción y la decisión en una única escritura local; PostgreSQL deberá implementar una transacción real al integrar Supabase. Las retiradas permanecen en el historial. Las solicitudes del catálogo y del lector QR de demostración llegan a la misma bandeja.

El almacenamiento local no es una base de datos ni un control de acceso. Sus operaciones no ofrecen garantías transaccionales ante escrituras simultáneas desde varias pestañas.

## Asistencia QR de demostración

En el panel de facilitador, entra a Física II y después a «Iniciar asistencia». Crea e inicia una sesión y muestra su QR. La sesión utiliza el grupo interno del curso abierto. El modo de presentación mantiene la URL y permite salir sin cerrar la sesión. El QR cambia cada 30 segundos; su código, vigencia y registros son ficticios.

En el panel de participante, selecciona un usuario ficticio y abre «Escanear QR». En «Historial de asistencia» puedes consultar los registros locales de ese usuario. La cámara necesita permiso y un contexto seguro HTTPS o localhost. Para probar en un solo navegador se puede copiar el texto de demostración del QR y pegarlo en el lector. Un participante no inscrito puede solicitar inscripción; aprobarla no registra asistencia. Los datos solo existen en el almacenamiento local de ese navegador: no hay sincronización entre dispositivos ni autorización real.

La etapa 4B necesita identidad verificada, emisión y validación de tokens en el servidor con reloj confiable, transacciones y restricciones de duplicados en PostgreSQL, RLS y auditoría. No se deben utilizar estos tokens locales para registrar asistencia real.

La administración presenta accesos separados a cursos, inscripciones y solicitudes. Cada curso nuevo recibe automáticamente un grupo interno para conservar la compatibilidad con inscripciones y asistencia. No se fusionan ni borran grupos históricos: si un curso tiene más de uno, su gestión requiere revisión antes de operar. El facilitador accede a asistencia, participantes e historial desde cada curso.
