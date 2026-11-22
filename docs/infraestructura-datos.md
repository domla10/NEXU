> **Actualización multirrol:** Las descripciones históricas de rol exclusivo y RPC privilegiada de este documento quedan sustituidas por [Modelo multirrol y autorización](modelo-multirrol.md). El resto se conserva como registro histórico.

# Base de datos y seguridad de NEXU

La infraestructura versionada es una propuesta inicial para Supabase/PostgreSQL. No conecta la interfaz, no crea el curso piloto y no se ha aplicado al proyecto remoto. La migración está en `supabase/migrations/` y sus pruebas en `supabase/tests/`. Las carpetas históricas `database/` se conservan; las migraciones ejecutables de Supabase viven únicamente en `supabase/migrations/`.

## Modelo y permisos

- `auth.users` conserva las identidades; `profiles` tiene una fila por identidad, nombre mínimo, rol y fechas. El registro crea siempre el rol `participante`, ignorando cualquier rol de los metadatos. El nombre recibido es opcional, se limpia y limita a 120 caracteres; si está vacío se usa «Nombre pendiente». Si falla el trigger, falla la inserción de la cuenta: no se deja una identidad parcialmente creada.
- `courses` contiene cursos; `course_facilitators` vincula facilitadores y `enrollments` vincula participantes. Sus claves compuestas evitan duplicados, y los índices inversos favorecen las consultas por persona. No se cargan cursos ni personas de muestra.
- RLS y permisos por columna trabajan juntos: un participante consulta su perfil, inscripciones y cursos inscritos y solo actualiza su propio `full_name`. Un facilitador consulta sus cursos y los perfiles e inscripciones de participantes de esos cursos. Ninguno puede otorgarse roles, inscribirse o asignarse cursos. El administrador confirmado gestiona cursos, asignaciones e inscripciones; para cambiar el rol de otra persona usa `public.set_profile_role(target_id, new_role)`. Nadie puede cambiar su propio rol. Los cambios de rol requieren retirar primero todas las asignaciones e inscripciones de la persona, para que no se reactiven permisos antiguos.
- El acceso mediante la API requiere un usuario cuyo correo conste como confirmado en `auth.users`, incluso si la configuración de Auth cambiara por error. Un usuario pendiente tiene perfil creado, pero no puede acceder a los datos protegidos. En el futuro se debe activar la confirmación obligatoria de correo en Supabase Auth y mantener desactivado el acceso anónimo si no es necesario. Confirmar correo **no acredita** pertenencia a la universidad.
- Las funciones auxiliares `SECURITY DEFINER` tienen `search_path` vacío, validan la identidad consultando `auth.uid()` y evitan recursión entre políticas. Son propiedad del ejecutor de la migración, que debe poder leer `auth.users` y las tablas protegidas sin quedar sujeto a las mismas políticas. Mantener `nexu_private` fuera de los esquemas expuestos por la API; sus funciones de consulta solo se conceden a `authenticated`. Los triggers de validación verifican autorización antes de consultar roles de terceros.
- Los cambios de rol, cursos, asignaciones e inscripciones generan eventos transaccionales en `nexu_private.admin_audit` con actor, acción, identificadores y, para roles, valores anterior y nuevo. No se guardan correos, nombres ni tokens. La auditoría no es inmutable frente a propietarios o administradores de la base de datos, ni registra intentos fallidos. Definir retención, acceso administrativo y almacenamiento externo resistente a alteraciones antes de usar datos reales. Solo una conexión privilegiada puede leerla; no hay API de lectura de auditoría en esta fase.
- Cambiar el nombre de un perfil no es una operación administrativa auditada. Para eliminar una cuenta con relaciones, primero deben retirarse sus asignaciones e inscripciones mediante un administrador autorizado. Los propietarios de la base de datos y `service_role` pueden omitir RLS si tienen los permisos SQL correspondientes; nunca exponer credenciales privilegiadas al navegador. Omitir RLS no evita los triggers ni la validación explícita del actor en la RPC. Los permisos efectivos de `service_role` dependen de la configuración de Supabase y deben comprobarse en la instancia real antes de su uso.

## Pruebas locales reproducibles

Con Docker disponible, desde la raíz del repositorio:

```sh
supabase/tests/run-isolated-postgres.sh
```

El script crea un contenedor PostgreSQL 17 desechable, sin red ni volúmenes, con un `auth.users` y un `auth.uid()` mínimos simulados; aplica la migración y ejecuta `supabase/tests/rls_foundation.sql`. El SQL usa datos ficticios, `SET ROLE` y una transacción que termina en `ROLLBACK`; el script elimina únicamente el contenedor creado por esa ejecución. La simulación verifica SQL y RLS, incluidos cambios de rol y membresías concurrentes y dos intentos simultáneos de bootstrap, pero no reemplaza una prueba de integración contra una instancia local completa de Supabase, su servicio Auth y PostgREST. El ejecutor solo usa el contenedor creado por él, sin red; la prueba de concurrencia comprueba su etiqueta y modo de red antes de escribir.

Para probar posteriormente con Supabase CLI, usar un directorio de trabajo y un proyecto **locales desechables** separados de cualquier proyecto con datos: instalar la CLI oficial, inicializar su configuración local con `supabase init` si falta, iniciar los servicios con `supabase start` (que puede aplicar las migraciones **locales** al inicializar la base). Para repetir desde cero se puede usar `supabase db reset --local`. **Este último comando borra la base local seleccionada**: nunca ejecutarlo sobre un entorno que contenga datos que se deseen conservar. Conectarse a esa base local como administrador de pruebas y ejecutar el archivo `supabase/tests/rls_foundation.sql` con `psql -v ON_ERROR_STOP=1 -f ...`. Confirmar las credenciales y el destino local mediante las herramientas de Supabase sin pegarlos en el repositorio. La suite crea usuarios ficticios dentro de una transacción y la revierte.

## Primer administrador: procedimiento posterior y controlado

No se crea ningún administrador automáticamente. Una autoridad del proyecto deberá verificar fuera de NEXU la identidad de la persona, registrar la autorización y asegurarse de que su cuenta de Supabase Auth ya tiene correo confirmado. Tras revisión del entorno y autorización expresa para modificarlo, un operador con acceso privilegiado puede ejecutar una transacción manual en el entorno **correcto**, sustituyendo `<UUID_VERIFICADO>` por el identificador comprobado:

Ejecuta el siguiente bloque en **una misma sesión interactiva** que mantenga la transacción abierta entre comandos. No uses un editor que cierre o confirme automáticamente la transacción antes de inspeccionar el resultado:

```sql
begin;
lock table public.profiles in exclusive mode;
-- Confirma que existe exactamente una fila con fecha no nula; bloquea la identidad durante la operación.
select id, email_confirmed_at
from auth.users
where id = '<UUID_VERIFICADO>'::uuid and email_confirmed_at is not null
for share;

update public.profiles p
set role = 'administrador'
where p.id = '<UUID_VERIFICADO>'::uuid
  and p.role = 'participante'
  and exists (select 1 from auth.users u where u.id = p.id and u.email_confirmed_at is not null)
  and not exists (select 1 from public.profiles existing where existing.role = 'administrador')
returning p.id, p.role;

-- Inspeccionar antes de decidir: debe haber exactamente un administrador y ser la identidad verificada.
select id, role from public.profiles where role = 'administrador';
```

Si la identidad y el correo se verificaron, el `UPDATE` devolvió **exactamente una fila** y la consulta final muestra únicamente el UUID previsto, confirma en la misma sesión:

```sql
commit;
```

Si falta alguna comprobación, el resultado es distinto, se eligió otro UUID o aparece un error, **no ejecutes `COMMIT`**; revierte en la misma sesión:

```sql
rollback;
```

Una vez confirmado, `ROLLBACK` ya no deshace el cambio: cualquier corrección posterior requiere otro procedimiento autorizado y queda auditada. Si se cierra la sesión antes de confirmar, PostgreSQL revierte la transacción y libera el bloqueo.

El cambio queda registrado en la auditoría; una operación desde el editor SQL normalmente tendrá `actor_id` nulo, por lo que debe existir además un registro externo del operador y la autorización. Después del bootstrap, un administrador confirmado puede asignar roles ajenos mediante la función autorizada. Para cambios posteriores del entorno remoto se requiere revisión, respaldo y aprobación operativa; este PR no aplica nada en remoto ni configura despliegues automáticos.

## Pendiente antes de un piloto real

Configurar el proveedor de correo, la confirmación de correo, redirecciones y límites de Auth; revisar políticas de acceso, recuperación de cuentas, autorización institucional, modelo de delegación administrativa, seguridad de sesiones y retención de datos. Faltan las interfaces y servicios administrativos, el registro y la validación de asistencia, las sesiones QR y los controles de respaldo y recuperación. No se ha verificado la migración contra el esquema ni las configuraciones del proyecto Supabase remoto existente. La ausencia de conflictos de nombres y datos debe comprobarse antes de cualquier aplicación futura.

## Resultado de la segunda revisión

Se ejecutaron la migración, las pruebas RLS y las tres pruebas de concurrencia en PostgreSQL 17 aislado con Auth simulado. Se intentó iniciar una instancia local completa con Supabase CLI 2.39.2, pero la descarga de una imagen Docker falló por falta de espacio; Auth y PostgREST no llegaron a estar disponibles. Por tanto, no se han verificado el esquema real de `auth.users`, el comportamiento de registro por HTTP, la exposición RPC de PostgREST ni los permisos efectivos de `anon`, `authenticated` y `service_role` en Supabase real. Es necesario ejecutar esas pruebas en un entorno local completo antes de aplicar la migración a cualquier proyecto con datos. La simulación de `service_role` solo comprueba que la RPC rechaza una llamada sin identidad administrativa, incluso si se le concede explícitamente `EXECUTE`; no reproduce los privilegios predeterminados de Supabase.

Las autorizaciones se comprueban durante las operaciones de base de datos; una operación ya iniciada puede competir con la revocación de un administrador. Antes del piloto hay que definir y probar el comportamiento deseado de revocación inmediata, y añadir una auditoría independiente y resistente a alteraciones. No conceder acceso SQL directo a los roles de la API: las pruebas usan `SET ROLE` y el identificador de prueba solo dentro del contenedor aislado, mientras que PostgREST debe validar los JWT reales.

La configuración versionada `apps/web/vercel.json` desactiva el despliegue Git automático **solo** para `feature/nexu-database-foundation`; no modifica ajustes del proyecto Vercel ni desactiva los despliegues de otras ramas. El cambio existe para cumplir la restricción de esta revisión y puede retirarse cuando la rama deje de usarse, mediante un cambio revisado.
