#!/bin/sh
# Uso interno: solo con el contenedor desechable creado por run-isolated-postgres.sh.
set -eu
container=$1
case "$container" in nexu-rls-test-[0-9]*) ;; *) echo 'Contenedor de prueba no válido.' >&2; exit 1 ;; esac
[ "$(docker inspect -f '{{ index .Config.Labels "nexu.audit.isolated" }}' "$container")" = true ] || { echo 'Falta la etiqueta de aislamiento.' >&2; exit 1; }
[ "$(docker inspect -f '{{ .HostConfig.NetworkMode }}' "$container")" = none ] || { echo 'El contenedor debe estar sin red.' >&2; exit 1; }
tmp=$(mktemp -d)
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT HUP INT TERM
psql_run() { docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
psql_run <<'SQL'
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('30000000-0000-0000-0000-000000000001','admin-concurrencia@example.test',now(),'{}'),
('30000000-0000-0000-0000-000000000002','persona-a@example.test',now(),'{}'),
('30000000-0000-0000-0000-000000000003','persona-b@example.test',now(),'{}');
update public.profiles set role='administrador' where id='30000000-0000-0000-0000-000000000001';
insert into public.courses(id,name) values ('40000000-0000-0000-0000-000000000001','Curso concurrencia');
SQL
cat > "$tmp/first.sql" <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
insert into public.enrollments(course_id,participant_id) values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
select pg_sleep(3);
commit;
SQL
cat > "$tmp/second.sql" <<'SQL'
\set VERBOSITY sqlstate
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select public.set_profile_role('30000000-0000-0000-0000-000000000002','facilitador');
commit;
SQL
cat > "$tmp/third.sql" <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select public.set_profile_role('30000000-0000-0000-0000-000000000003','facilitador');
select pg_sleep(3);
commit;
SQL
cat > "$tmp/fourth.sql" <<'SQL'
\set VERBOSITY sqlstate
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
insert into public.enrollments(course_id,participant_id) values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003');
commit;
SQL
run_first() {
  app=$1; script=$2
  docker exec -i -e PGAPPNAME="$app" "$container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$script" > "$tmp/first.out" 2>&1 &
  first_pid=$!
  found=0
  for n in $(seq 1 100); do
    if [ "$(docker exec "$container" psql -X -qAt -U postgres -d postgres -c "select count(*) from pg_stat_activity where application_name = '$app' and wait_event = 'PgSleep'")" = 1 ]; then found=1; break; fi
    sleep 0.1
  done
  if [ "$found" -ne 1 ]; then echo 'No se pudo sincronizar la prueba concurrente.' >&2; wait "$first_pid" || true; exit 1; fi
}
run_first nexu_race_insert "$tmp/first.sql"
if psql_run < "$tmp/second.sql" > "$tmp/second.out" 2>&1; then echo 'FALLO: cambio de rol concurrente permitido' >&2; exit 1; fi
wait "$first_pid"
if ! grep -q '23514' "$tmp/second.out"; then cat "$tmp/second.out" >&2; exit 1; fi
run_first nexu_race_role "$tmp/third.sql"
if psql_run < "$tmp/fourth.sql" > "$tmp/fourth.out" 2>&1; then echo 'FALLO: inscripción concurrente incompatible' >&2; exit 1; fi
wait "$first_pid"
if ! grep -q 'P0001' "$tmp/fourth.out"; then cat "$tmp/fourth.out" >&2; exit 1; fi
result=$(psql_run -At <<'SQL'
select (select role='participante' from public.profiles where id='30000000-0000-0000-0000-000000000002')
 and exists(select 1 from public.enrollments where participant_id='30000000-0000-0000-0000-000000000002')
 and (select role='facilitador' from public.profiles where id='30000000-0000-0000-0000-000000000003')
 and not exists(select 1 from public.enrollments where participant_id='30000000-0000-0000-0000-000000000003');
SQL
)
[ "$result" = t ] || { echo 'FALLO: datos concurrentes inconsistentes' >&2; exit 1; }
echo 'Pruebas concurrentes completadas: ambas secuencias mantienen la consistencia.'
# Dos operadores intentan bootstrap en paralelo en una base que aún no tiene administrador.
psql_run <<'SQL'
update public.profiles set role='participante' where id='30000000-0000-0000-0000-000000000001';
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('30000000-0000-0000-0000-000000000004','bootstrap-a@example.test',now(),'{}'),
('30000000-0000-0000-0000-000000000005','bootstrap-b@example.test',now(),'{}');
SQL
cat > "$tmp/bootstrap-a.sql" <<'SQL'
begin;
lock table public.profiles in exclusive mode;
update public.profiles p set role='administrador'
where p.id='30000000-0000-0000-0000-000000000004' and p.role='participante'
  and exists (select 1 from auth.users u where u.id=p.id and u.email_confirmed_at is not null)
  and not exists (select 1 from public.profiles existing where existing.role='administrador');
select pg_sleep(3);
commit;
SQL
cat > "$tmp/bootstrap-b.sql" <<'SQL'
begin;
lock table public.profiles in exclusive mode;
update public.profiles p set role='administrador'
where p.id='30000000-0000-0000-0000-000000000005' and p.role='participante'
  and exists (select 1 from auth.users u where u.id=p.id and u.email_confirmed_at is not null)
  and not exists (select 1 from public.profiles existing where existing.role='administrador');
commit;
SQL
run_first nexu_race_bootstrap "$tmp/bootstrap-a.sql"
psql_run < "$tmp/bootstrap-b.sql" > "$tmp/bootstrap-b.out" 2>&1
wait "$first_pid"
result=$(psql_run -At -c "select count(*)=1 and bool_and(id='30000000-0000-0000-0000-000000000004') from public.profiles where role='administrador'")
[ "$result" = t ] || { echo 'FALLO: bootstrap concurrente inconsistente' >&2; exit 1; }
echo 'Bootstrap concurrente: únicamente una cuenta recibió el rol inicial.'
