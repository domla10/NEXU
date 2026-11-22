# Modelo multirrol y autorización

Las inscripciones (`enrollments`) y las asignaciones de facilitación (`course_facilitators`) son relaciones independientes por curso. Una misma persona puede tener ambas, incluso en el mismo curso, y además ser administradora. Los vínculos no se derivan de metadatos de Auth. Solo un administrador con correo confirmado puede crear o borrar relaciones o gestionar cursos.

Por compatibilidad y para conservar datos, `profiles.role` y `academic_role` siguen existiendo. El valor `administrador` otorga autorización global; `participante` y `facilitador` son valores heredados y no determinan permisos académicos. Una asignación previa de facilitador conserva sus permisos porque se conserva su relación con el curso. La inscripción de un administrador no reduce sus permisos. El registro de Auth sigue creando perfiles sin permisos administrativos.

`public.set_profile_role` es `SECURITY INVOKER` y llama a una función de esquema privado. Esta comprueba el usuario confirmado y el rol administrativo vigente, rechaza cambios del propio rol y conserva la auditoría. No se conceden permisos de escritura sobre `profiles.role` al cliente. Las funciones privilegiadas usan `search_path` vacío. El esquema `nexu_private` debe permanecer fuera de los esquemas expuestos por PostgREST; sus funciones llamadas desde las políticas o desde la RPC tienen los permisos de ejecución mínimos para `authenticated` y verifican identidad y autorización.

Las políticas de escritura administrativa toman un bloqueo compartido sobre el perfil del actor hasta finalizar la transacción. Si una revocación ya está en curso, la escritura espera y vuelve a comprobar la autorización; si la escritura comenzó antes, la revocación espera a que termine. Dos administradores que intenten revocarse simultáneamente pueden provocar un interbloqueo: PostgreSQL aborta una transacción y el cliente debe reintentar la operación completa. Las transacciones largas retrasan las revocaciones. Las lecturas en curso siguen la semántica de instantáneas de PostgreSQL; no se promete cancelación inmediata de consultas ya iniciadas.

## Migraciones y pruebas

La migración original tiene ahora la versión `20261114230539`, coincidente con el historial de NEXU-TEST. Su contenido es idéntico al archivo antes denominado `20261114000000_data_foundation.sql` (MD5 `45aa74df1a4d330ab36dbbac073194a8`). La migración `20261122145735_multirole_authorization.sql` conserva perfiles y relaciones, sustituye los controles exclusivos y modifica la RPC. Las dos versiones figuran en NEXU-TEST. Antes de ejecutar migraciones en cualquier otra base, comparar su historial y el contenido real: una instalación que ya registró `20261114000000` requiere una reconciliación específica; no ejecutar `db push` a ciegas. El proyecto principal no se ha modificado.

`supabase/tests/rls_multirole.sql` es transaccional y revierte sus identidades ficticias. Cubre simultaneidad de contextos, administración con inscripción, lectura ajena y escalada por SQL y RPC. `supabase/tests/concurrency_multirole.py` usa conexiones simultáneas y comprueba los dos órdenes de revocación; solo se ejecuta contra una base desechable, nunca contra una base con datos reales. Usa las variables habituales `PGHOST`, `PGPORT` y `PGUSER`, y admite `NEXU_TEST_PSQL` para elegir el ejecutable. La suite local Docker ejecuta la base histórica antes de la migración multirrol y luego las pruebas de la nueva versión.

La prueba SQL en NEXU-TEST simula identidades con `SET ROLE` y `request.jwt.claim.sub`; no sustituye sesiones reales de Auth ni una prueba de PostgREST. La protección contra contraseñas filtradas sigue desactivada. La auditoría no es inmutable para el propietario de la base y no registra intentos rechazados. Se necesitan sesiones reales, una revisión independiente de seguridad y una política operativa de bootstrap y revocación antes del piloto.

## Criterios de aceptación del facilitador

- Puede consultar sus materias asignadas y sus participantes inscritos.
- Las futuras solicitudes de inscripción y sesiones de asistencia requerirán comprobar la asignación vigente al curso en cada operación. Solo podrá aprobar o rechazar solicitudes y gestionar sesiones de sus propias materias. Estas funcionalidades están pendientes.
- No puede crear ni eliminar materias, modificar su configuración institucional, asignar facilitadores ni otorgar administración. Estas operaciones corresponden al administrador. No se concede UPDATE general sobre courses al facilitador.
