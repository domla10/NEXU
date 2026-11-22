-- Ejecutar únicamente en una base de pruebas: todos los datos se revierten.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALLO: %', label; end if; end $$;
create function pg_temp.expect_denied(stmt text, label text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when insufficient_privilege then return; end;
  raise exception 'FALLO: permitido %', label;
end $$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('90000000-0000-0000-0000-000000000001','nexu-admin@example.test',now(),'{}'),
('90000000-0000-0000-0000-000000000002','nexu-multi@example.test',now(),'{}'),
('90000000-0000-0000-0000-000000000003','nexu-participant@example.test',now(),'{}'),
('90000000-0000-0000-0000-000000000004','nexu-other@example.test',now(),'{}');
update public.profiles set role='administrador' where id='90000000-0000-0000-0000-000000000001';
insert into public.courses(id,name) values
('91000000-0000-0000-0000-000000000001','Curso facilitado de prueba'),
('91000000-0000-0000-0000-000000000002','Curso inscrito de prueba'),
('91000000-0000-0000-0000-000000000003','Curso ajeno de prueba');
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000001',true);
insert into public.course_facilitators(course_id,facilitator_id) values
('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002');
insert into public.enrollments(course_id,participant_id) values
('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000003'),
('91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000002'),
('91000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000001'),
('91000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000004');
select pg_temp.assert_true((select count(*)=1 from public.enrollments where participant_id='90000000-0000-0000-0000-000000000001'), 'administrador mantiene inscripción');
select public.set_profile_role('90000000-0000-0000-0000-000000000002','administrador');
select public.set_profile_role('90000000-0000-0000-0000-000000000002','participante');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true((select count(*)=2 from public.courses), 'facilitador e inscrito ven ambos cursos');
select pg_temp.assert_true((select count(*)=1 from public.profiles where id='90000000-0000-0000-0000-000000000003'), 'facilitador ve participante de su curso');
select pg_temp.assert_true((select count(*)=0 from public.profiles where id='90000000-0000-0000-0000-000000000004'), 'no ve perfil ajeno');
select pg_temp.expect_denied($q$select public.set_profile_role('90000000-0000-0000-0000-000000000002','administrador')$q$, 'autoescalada por RPC');
select pg_temp.expect_denied($q$select nexu_private.set_profile_role('90000000-0000-0000-0000-000000000002','administrador')$q$, 'autoescalada mediante función privada');
select pg_temp.expect_denied($q$update public.profiles set role='administrador' where id='90000000-0000-0000-0000-000000000002'$q$, 'cambio directo de rol');
select pg_temp.expect_denied($q$insert into public.course_facilitators(course_id,facilitator_id) values ('91000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000002')$q$, 'autoasignación');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((select count(*)=1 from public.courses), 'participante ve solo su curso');
select pg_temp.assert_true((select count(*)=1 from public.profiles), 'participante no ve perfiles ajenos');
select pg_temp.expect_denied($q$select public.set_profile_role('90000000-0000-0000-0000-000000000004','administrador')$q$, 'participante otorga administración');
reset role;
select pg_temp.assert_true(not (select prosecdef from pg_proc where oid='public.set_profile_role(uuid,public.academic_role)'::regprocedure), 'RPC pública ejecuta con privilegios del invocador');
rollback;
