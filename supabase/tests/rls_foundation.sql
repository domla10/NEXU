-- Ejecutar exclusivamente en una base local desechable después de las migraciones.
-- Requiere una conexión administrativa capaz de SET ROLE anon/authenticated.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALLO: %', message; end if; end $$;
create function pg_temp.expect_denied(statement text, message text) returns void language plpgsql as $$
begin
  begin execute statement; exception when insufficient_privilege then return; end;
  raise exception 'FALLO: se permitió %', message;
end $$;
create function pg_temp.expect_duplicate(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when unique_violation then return; end;
  raise exception 'FALLO: se permitió un duplicado';
end $$;
create function pg_temp.expect_check(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when check_violation then return; end;
  raise exception 'FALLO: se permitió cambiar un rol con relaciones activas';
end $$;

-- Todos los registros, incluidos los correos, son ficticios y se revierten.
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
('10000000-0000-0000-0000-000000000001','admin@example.test',now(),'{"full_name":"Admin prueba","role":"administrador"}'),
('10000000-0000-0000-0000-000000000002','facilitador@example.test',now(),'{"full_name":"Facilitador prueba","role":"administrador"}'),
('10000000-0000-0000-0000-000000000003','participante@example.test',now(),'{"full_name":"Participante prueba","role":"administrador"}'),
('10000000-0000-0000-0000-000000000004','otra@example.test',now(),'{"full_name":"Otra persona"}'),
('10000000-0000-0000-0000-000000000005','pendiente@example.test',null,'{"full_name":"","role":"administrador"}'),
('10000000-0000-0000-0000-000000000006','nombre@example.test',now(),jsonb_build_object('full_name', repeat('x',119) || '  y', 'role', 'administrador'));
select pg_temp.check_true((select count(*)=6 from public.profiles where role='participante' and id::text like '10000000-%'), 'registro siempre crea participante');
select pg_temp.check_true((select char_length(full_name)=119 and full_name=btrim(full_name) from public.profiles where id='10000000-0000-0000-0000-000000000006'), 'nombre truncado sin espacios finales');
select pg_temp.check_true((select full_name='Nombre pendiente' from public.profiles where id='10000000-0000-0000-0000-000000000005'), 'nombre vacío');
-- Preparación local controlada del primer administrador; actor nulo y auditado.
update public.profiles set role='administrador' where id='10000000-0000-0000-0000-000000000001';

set local role anon;
select pg_temp.expect_denied('select * from public.courses', 'lectura anónima de cursos');
select pg_temp.expect_denied('select * from public.profiles', 'lectura anónima de perfiles');
select pg_temp.expect_denied('select * from public.enrollments', 'lectura anónima de inscripciones');
select pg_temp.expect_denied('select * from public.course_facilitators', 'lectura anónima de asignaciones');
select pg_temp.expect_denied($sql$select public.set_profile_role('10000000-0000-0000-0000-000000000003','administrador')$sql$, 'función administrativa por anon');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',true);
select pg_temp.check_true((select count(*)=0 from public.profiles), 'correo sin confirmar no lee perfiles');
select pg_temp.expect_denied($sql$insert into public.courses(name) values ('no autorizado')$sql$, 'curso sin correo confirmado');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.set_profile_role('10000000-0000-0000-0000-000000000002','facilitador');
insert into public.courses(name) values ('Curso de prueba'), ('Curso ajeno');
select set_config('nexu_test.other_course', (select id::text from public.courses where name='Curso ajeno'), true);
insert into public.course_facilitators(course_id,facilitator_id)
  select id,'10000000-0000-0000-0000-000000000002' from public.courses where name='Curso de prueba';
insert into public.enrollments(course_id,participant_id)
  select id,'10000000-0000-0000-0000-000000000003' from public.courses where name='Curso de prueba';
insert into public.enrollments(course_id,participant_id)
  select id,'10000000-0000-0000-0000-000000000004' from public.courses where name='Curso ajeno';
select pg_temp.expect_duplicate($sql$insert into public.enrollments(course_id,participant_id)
  select id,'10000000-0000-0000-0000-000000000003' from public.courses where name='Curso de prueba'$sql$);
select pg_temp.expect_denied($sql$select public.set_profile_role('10000000-0000-0000-0000-000000000001','participante')$sql$, 'cambiar el propio rol de administrador');
select pg_temp.expect_check($sql$select public.set_profile_role('10000000-0000-0000-0000-000000000002','participante')$sql$);
select pg_temp.check_true((select count(*)=2 from public.courses where name in ('Curso de prueba','Curso ajeno')), 'administrador gestiona cursos');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select pg_temp.check_true((select count(*)=1 from public.enrollments), 'participante lee solo inscripción propia');
select pg_temp.check_true((select count(*)=1 from public.profiles), 'participante lee solo su perfil');
select pg_temp.check_true((select count(*)=1 from public.courses where name='Curso de prueba'), 'participante solo lee curso inscrito');
update public.profiles set full_name='Nombre ficticio editado' where id='10000000-0000-0000-0000-000000000003';
select pg_temp.check_true((select full_name='Nombre ficticio editado' from public.profiles where id='10000000-0000-0000-0000-000000000003'), 'editar nombre propio');
select pg_temp.expect_denied($sql$update public.profiles set role='administrador' where id='10000000-0000-0000-0000-000000000003'$sql$, 'cambio directo de rol');
select pg_temp.expect_denied($sql$update public.profiles set full_name='intento', role='administrador' where id='10000000-0000-0000-0000-000000000003'$sql$, 'actualización parcial con rol');
select pg_temp.expect_denied($sql$update public.profiles set updated_at=now() where id='10000000-0000-0000-0000-000000000003'$sql$, 'cambio directo de fecha');
with changed as (update public.profiles set full_name='Intrusión' where id='10000000-0000-0000-0000-000000000004' returning id) select pg_temp.check_true((select count(*)=0 from changed), 'no editar otro perfil');
select pg_temp.expect_denied($sql$select public.set_profile_role('10000000-0000-0000-0000-000000000003','administrador')$sql$, 'escalada por función');
select pg_temp.expect_denied($sql$insert into public.enrollments(course_id,participant_id) values (current_setting('nexu_test.other_course')::uuid,'10000000-0000-0000-0000-000000000003')$sql$, 'autoinscripción a curso ajeno');
select pg_temp.expect_denied($sql$insert into public.courses(name) values ('curso no autorizado')$sql$, 'crear curso como participante');
select pg_temp.expect_denied($sql$insert into public.course_facilitators(course_id,facilitator_id) select course_id,'10000000-0000-0000-0000-000000000003' from public.enrollments limit 1$sql$, 'asignación como participante');
select pg_temp.expect_denied($sql$select * from nexu_private.admin_audit$sql$, 'acceso a auditoría');
select pg_temp.check_true(not has_function_privilege('authenticated','nexu_private.create_profile_for_auth_user()','execute'), 'trigger privilegiado no ejecutable por API');
select pg_temp.check_true(not has_function_privilege('anon','public.set_profile_role(uuid,public.academic_role)','execute'), 'función de rol no ejecutable por anónimo');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.check_true((select count(*)=1 from public.enrollments), 'facilitador ve solo inscripciones de su curso');
select pg_temp.check_true((select count(*)=1 from public.profiles where id='10000000-0000-0000-0000-000000000003'), 'facilitador ve participante inscrito');
select pg_temp.check_true((select count(*)=0 from public.profiles where id='10000000-0000-0000-0000-000000000004'), 'facilitador no ve participante ajeno');
select pg_temp.check_true((select count(*)=0 from public.courses where name='Curso ajeno'), 'facilitador no ve curso ajeno');
select pg_temp.expect_denied($sql$insert into public.course_facilitators(course_id,facilitator_id) values (current_setting('nexu_test.other_course')::uuid,'10000000-0000-0000-0000-000000000002')$sql$, 'autoasignación de facilitador a curso ajeno');
select pg_temp.expect_denied($sql$insert into public.enrollments(course_id,participant_id) select id,'10000000-0000-0000-0000-000000000004' from public.courses limit 1$sql$, 'facilitador inscribe participante');
select pg_temp.expect_denied($sql$select public.set_profile_role('10000000-0000-0000-0000-000000000004','administrador')$sql$, 'facilitador otorga rol');
with changed as (update public.courses set name='Modificado sin permiso' where id=current_setting('nexu_test.other_course')::uuid returning id) select pg_temp.check_true((select count(*)=0 from changed), 'facilitador no modifica curso ajeno');
with changed as (update public.courses set name='Modificado sin permiso' where name='Curso de prueba' returning id)
  select pg_temp.check_true((select count(*)=0 from changed), 'facilitador no modifica cursos');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
delete from public.course_facilitators where facilitator_id='10000000-0000-0000-0000-000000000002';
select public.set_profile_role('10000000-0000-0000-0000-000000000002','participante');
select pg_temp.check_true((select role='participante' from public.profiles where id='10000000-0000-0000-0000-000000000002'), 'cambio de rol tras retirar asignación');
reset role;
-- Simula una concesión explícita: BYPASSRLS no sustituye la comprobación de identidad en la RPC.
grant execute on function public.set_profile_role(uuid, public.academic_role) to service_role;
set local role service_role;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_denied($sql$select public.set_profile_role('10000000-0000-0000-0000-000000000003','administrador')$sql$, 'service_role sin identidad administrativa en la RPC');
reset role;
select pg_temp.check_true(not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname in ('nexu_private','public') and (n.nspname='nexu_private' or p.proname='set_profile_role') and not coalesce('search_path=""'=any(p.proconfig),false)), 'search_path protegido en funciones privilegiadas');
select pg_temp.check_true(not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles owner on owner.oid=p.proowner where p.prosecdef and (n.nspname='nexu_private' or (n.nspname='public' and p.proname='set_profile_role')) and not (owner.rolsuper or owner.rolbypassrls)), 'propietario privilegiado para evitar recursión RLS');
select pg_temp.check_true((select count(*)>=6 from nexu_private.admin_audit where action in ('profiles.update','courses.insert','course_facilitators.insert','enrollments.insert')), 'cambios administrativos auditados');
select pg_temp.check_true((select count(*)=1 from nexu_private.admin_audit where action='profiles.update' and actor_id is null and new_role='administrador'), 'bootstrap auditado sin actor JWT');
rollback;
\echo 'Pruebas de seguridad RLS completadas y revertidas.'
