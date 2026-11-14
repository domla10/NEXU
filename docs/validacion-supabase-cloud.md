# Plan de validación con Supabase Cloud

Estado: **preparado; no ejecutado en Supabase Cloud**. El PR #4 solo se ha probado en PostgreSQL aislado con Auth simulado. Este plan no autoriza por sí mismo la creación de proyectos, la aplicación de migraciones, el envío de correos ni la creación de usuarios o registros.

## Acceso y selección del entorno

1. En la cuenta de Supabase, identifica visualmente un proyecto independiente llamado `NEXU-TEST`. Un nombre, por sí solo, no demuestra que sea desechable: verifica también organización, entorno y que no contenga datos reales. Si no existe o hay ambigüedad, no lo crees ni lo uses hasta recibir autorización explícita.
2. Conecta la integración Supabase desde el directorio de complementos de ChatGPT y autoriza únicamente el acceso necesario al proyecto de pruebas, si la integración permite limitarlo. Si no puede limitarse, revisa su alcance antes de conectarla. No compartas en el chat contraseñas, tokens, claves privadas ni cadenas de conexión. No selecciones el proyecto principal `NEXU`.
3. Para una ejecución manual alternativa, usa el panel de Supabase autenticado por el propietario y comprueba el proyecto seleccionado en cada operación. No escribas claves en el repositorio, comandos, capturas o registros compartidos.
4. Tras seleccionar el proyecto, pide autorización explícita y específica para aplicar la migración y para crear usuarios, cursos, relaciones y roles ficticios. Obtener acceso de lectura no autoriza esas escrituras. No realices `db push`, `db reset`, operaciones de borrado ni ejecutes SQL que modifique datos antes de dicha autorización.

## Inspección previa de solo lectura

Una vez verificado `NEXU-TEST`, `supabase/tests/cloud/inspeccion_solo_lectura.sql` inspecciona únicamente metadatos: colisiones de nombres, tablas, RLS, políticas, triggers, propietarios de funciones y permisos. No lee filas de usuarios ni datos académicos. Antes de la migración, cualquier objeto ya existente requiere detenerse e investigar; después permite comparar la estructura con la migración. El panel de Supabase debe confirmar la identidad del proyecto: el script no puede certificarla.

Comprobar además en la configuración del proyecto que el esquema `nexu_private` no esté expuesto por PostgREST y que los flujos de correo/confirmación sean adecuados para pruebas. Los resultados de `has_*_privilege` no sustituyen una solicitud HTTP con una sesión real: `service_role` puede omitir RLS si posee los permisos correspondientes, pero los triggers y las comprobaciones explícitas de identidad siguen aplicando.

## Tras la autorización: migración y sesiones reales

- Aplicar exactamente la migración versionada `supabase/migrations/20261114000000_data_foundation.sql` como migración identificable, una sola vez y solo si la inspección no mostró colisiones. Guardar el resultado sin incluir secretos. Si falla, registrar el error y detenerse; no reparar manualmente la base con SQL ad hoc. Cualquier corrección debe versionarse y repetirse en un entorno limpio autorizado.
- Usar un proveedor de correo de pruebas controlado para confirmar direcciones creadas exclusivamente para esta prueba. Las direcciones reservadas como `example.test` son ficticias pero no reciben correo real; no deben presentarse como prueba de envío ni de confirmación. Mantener las contraseñas y sesiones en la herramienta de pruebas, fuera del repositorio y sin imprimirlas. No utilizar cuentas universitarias reales.
- Los preparativos de roles, cursos e inscripciones de prueba deben ser reproducibles y autorizados: utilizar fixtures versionados específicos para `NEXU-TEST` y registrar exactamente lo creado. El primer administrador requiere el procedimiento controlado documentado en `infraestructura-datos.md`; no debe derivarse de metadatos de registro. No borrar usuarios o datos sin autorización explícita.
- Ejecutar la matriz siguiente a través de Auth y PostgREST con sesiones reales de prueba; registrar estado HTTP, operación y resultado esperado/observado, sin guardar tokens ni cuerpos con datos personales. Repetir las pruebas afectadas después de cualquier corrección.

| Sesión | Operación | Resultado esperado |
| --- | --- | --- |
| Anónima | Leer las cuatro tablas y ejecutar `set_profile_role` | Acceso denegado; no devuelve datos privados. |
| Registro pendiente | Registro y acceso antes de confirmar | Perfil creado con rol participante; Auth exige confirmación y no concede acceso a datos protegidos. Si la configuración devuelve una sesión, la RLS sigue impidiendo el acceso. |
| Participante confirmado | Leer/editar nombre propio y leer inscripción propia | Permitido dentro de los campos y filas autorizados. |
| Participante confirmado | Leer perfil o inscripción ajena; cambiar rol; autoinscribirse o asignarse como facilitador | Ningún dato ajeno visible; cambios rechazados o cero filas según la operación. |
| Facilitador confirmado | Leer curso asignado y sus participantes | Solo datos del curso asignado. |
| Facilitador confirmado | Leer o administrar curso ajeno, crear asignación o conceder rol | No visible o rechazado según la operación. |
| Administrador de prueba | Crear curso, asignar facilitador, inscribir y cambiar rol ajeno por RPC | Permitido y auditado; duplicados rechazados. |
| Administrador de prueba | Cambiar su propio rol | Rechazado. |
| Roles de API | Acceder directamente a funciones privadas o auditar; probar `service_role` de forma controlada | Confirmar permisos efectivos y no exposición de `nexu_private`; no asumir que `service_role` sigue RLS ni enviar su clave al navegador. |

Inspeccionar `auth.users`, triggers y auditoría únicamente con herramientas administrativas autorizadas y mostrar solo los atributos indispensables. Confirmar por PostgREST que el esquema privado no es accesible y que `set_profile_role` valida la sesión. Evaluar explícitamente la revocación concurrente de administradores: las pruebas de concurrencia locales no cubren todas las carreras de autorización.

## Informe y limpieza

Distinguir pruebas ejecutadas, fallidas y pendientes; identificar versiones, resultados y riesgos sin publicar credenciales. No fusionar el PR ni aplicar nada a producción. Antes de borrar usuarios, fixtures o el proyecto de pruebas, pedir una autorización específica que identifique el alcance. El proyecto principal debe quedar intacto.

## Avance de la prueba Cloud autorizada

Se creó un proyecto independiente de prueba y se aplicó la migración versionada mediante la integración de Supabase. El proyecto principal no se consultó ni se modificó. PostgreSQL 17.11 aceptó la migración: se verificaron las cuatro tablas públicas con RLS, doce políticas y el trigger de `auth.users`. Se comprobó que `authenticated` puede actualizar `full_name` pero no `role`, y que `service_role` tiene privilegios elevados y `BYPASSRLS`. La función `set_profile_role` es `SECURITY DEFINER`, propiedad de `postgres`, y Supabase la marca como advertencia porque `authenticated` puede ejecutarla; sus controles internos deben probarse con sesiones reales. La auditoría privada tiene RLS sin política, como defensa adicional para una tabla sin acceso a los roles públicos.

Se registraron dos cuentas de prueba mediante Auth en una bandeja autorizada. Los dos perfiles se crearon como `participante` aunque los metadatos solicitaban el rol administrativo. Para la segunda cuenta, Auth devolvió `email_not_confirmed` antes de confirmar el correo, sin sesión. Se confirmó la primera cuenta, pero no se completó una sesión de prueba con ella: la contraseña efímera se descartó tras interpretar incorrectamente la respuesta de Auth. La segunda cuenta sigue pendiente de confirmación. No se registran aquí direcciones, contraseñas, enlaces ni tokens.

Con la clave pública del proyecto de prueba, PostgREST devolvió denegación de permiso al rol anónimo para las cuatro tablas y la RPC administrativa; solicitar el esquema privado devolvió `PGRST106`. La batería SQL transaccional con datos ficticios solicitó confirmación en la integración y el cliente la canceló dos veces; **no se ejecutó**. Las pruebas de participantes confirmados, facilitadores y administradores con sesiones reales siguen pendientes.

El proveedor registró la migración aplicada con una versión generada distinta del prefijo del archivo versionado. Antes de cualquier futuro `db push`, comparar y reconciliar cuidadosamente el historial del proyecto de prueba; no repetir ciegamente la migración. El asesor de Supabase también indicó índices sin uso en la base recién creada; ese aviso no justifica eliminarlos sin medir consultas reales.

La API pública de Auth confirmó que la autoconfirmación está desactivada, pero no reveló los valores de Site URL ni Redirect URLs; la integración disponible no permite inspeccionarlos o modificarlos. Un correo de prueba redirigió al usuario a `localhost:3000` y la cuenta del alias permanecía sin confirmar en la última comprobación. No se modificó la configuración ni se confirmó manualmente ninguna cuenta. Resolver la redirección y verificar la cuenta antes de reintentar el acceso.
