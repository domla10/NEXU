#!/bin/sh
# Comprueba el bootstrap solamente en un contenedor PostgreSQL sin red ni volúmenes.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
name="nexu-bootstrap-test-$$"
created=0
cleanup() { if [ "$created" -eq 1 ]; then docker rm -f "$name" >/dev/null 2>&1 || true; fi; }
trap cleanup EXIT HUP INT TERM
docker run -d --name "$name" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
created=1
ready=0
for n in $(seq 1 30); do
  if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete' && docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || { echo 'PostgreSQL no se inició' >&2; exit 1; }
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/tests/support/auth_stub.sql"
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/migrations/20261114230539_data_foundation.sql"
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('50000000-0000-0000-0000-000000000001','p1@example.test',now(),'{"nexu_test_run":"0123456789abcdef0123456789abcdef","nexu_test_identity":"admin"}'),
('50000000-0000-0000-0000-000000000002','p2@example.test',now(),'{"nexu_test_run":"0123456789abcdef0123456789abcdef","nexu_test_identity":"facilitador"}'),
('50000000-0000-0000-0000-000000000003','p3@example.test',now(),'{"nexu_test_run":"0123456789abcdef0123456789abcdef","nexu_test_identity":"participante"}');
SQL
sed -e 's/<ID_DE_EJECUCION>/0123456789abcdef0123456789abcdef/' -e 's/<UUID_ADMIN_DE_PRUEBA>/50000000-0000-0000-0000-000000000001/' "$root/supabase/tests/cloud/bootstrap_test_admin.sql" | docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres
result=$(docker exec "$name" psql -qAt -U postgres -d postgres -c "select count(*) from public.profiles where role='administrador'")
[ "$result" = 1 ] || { echo 'No se creó exactamente un administrador' >&2; exit 1; }
if sed -e 's/<ID_DE_EJECUCION>/0123456789abcdef0123456789abcdef/' -e 's/<UUID_ADMIN_DE_PRUEBA>/50000000-0000-0000-0000-000000000001/' "$root/supabase/tests/cloud/bootstrap_test_admin.sql" | docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null 2>&1; then
  echo 'Se aceptó indebidamente el bootstrap repetido' >&2; exit 1
fi
echo 'Bootstrap aislado correcto: una asignación y rechazo de repetición.'
