-- Inspección de metadatos; no verifica por sí sola la identidad del proyecto.
-- Ejecutar solo tras confirmar visualmente NEXU-TEST en el panel.
-- No muestra usuarios, correos, tokens, claves, credenciales ni datos académicos.
begin read only;

-- Antes de aplicar la migración, cualquier true requiere investigar la colisión.
select 'schema nexu_private' as objeto, to_regnamespace('nexu_private') is not null as existe
union all select 'tipo public.academic_role', to_regtype('public.academic_role') is not null
union all select 'tabla public.profiles', to_regclass('public.profiles') is not null
union all select 'tabla public.courses', to_regclass('public.courses') is not null
union all select 'tabla public.course_facilitators', to_regclass('public.course_facilitators') is not null
union all select 'tabla public.enrollments', to_regclass('public.enrollments') is not null
union all select 'tabla nexu_private.admin_audit', to_regclass('nexu_private.admin_audit') is not null
union all select 'RPC public.set_profile_role', exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='set_profile_role');

-- Funciones seleccionadas, propietario y protección del search_path.
select n.nspname as esquema, p.proname as funcion, pg_get_userbyid(p.proowner) as propietario,
       p.prosecdef as security_definer, p.proconfig as configuracion,
       has_function_privilege('anon', p.oid, 'EXECUTE') as ejecuta_anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as ejecuta_authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as ejecuta_service_role
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='nexu_private' or (n.nspname='public' and p.proname='set_profile_role')
order by n.nspname, p.proname;

select n.nspname as esquema, c.relname as tabla, c.relrowsecurity as rls_activa,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
       has_table_privilege('service_role', c.oid, 'SELECT') as service_role_select,
       has_table_privilege('service_role', c.oid, 'INSERT') as service_role_insert
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname in ('profiles','courses','course_facilitators','enrollments'))
   or (n.nspname='nexu_private' and c.relname='admin_audit')
order by n.nspname,c.relname;

select tablename, policyname, cmd, roles from pg_policies
where schemaname='public' and tablename in ('profiles','courses','course_facilitators','enrollments')
order by tablename, policyname;

select event_object_schema, event_object_table, trigger_name, event_manipulation
from information_schema.triggers
where (event_object_schema='auth' and event_object_table='users' and trigger_name='on_auth_user_created')
   or (event_object_schema='public' and event_object_table in ('profiles','courses','course_facilitators','enrollments'))
order by event_object_schema,event_object_table,trigger_name,event_manipulation;

-- Privilegios por columna para detectar asignaciones indirectas de rol.
select c.relname as tabla, a.attname as columna,
       has_column_privilege('authenticated',c.oid,a.attnum,'UPDATE') as authenticated_update,
       has_column_privilege('service_role',c.oid,a.attnum,'UPDATE') as service_role_update
from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='profiles' and a.attnum>0 and not a.attisdropped
order by a.attnum;
rollback;
