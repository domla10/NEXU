#!/bin/sh
# Solo crea y elimina un contenedor sin red ni volúmenes, propio de esta ejecución.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
name="nexu-rls-test-$$"
created=0
cleanup() { if [ "$created" -eq 1 ]; then docker rm -f "$name" >/dev/null 2>&1 || true; fi; }
trap cleanup EXIT HUP INT TERM
docker run -d --name "$name" --network none --label nexu.audit.isolated=true -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
created=1
ready=0
for attempt in $(seq 1 30); do
  if docker logs "$name" 2>&1 | grep -q "PostgreSQL init process complete" && docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then echo 'PostgreSQL no se inició.' >&2; exit 1; fi
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/tests/support/auth_stub.sql"
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/migrations/20261114230539_data_foundation.sql"
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/tests/rls_foundation.sql"

"$root/supabase/tests/concurrency.sh" "$name"
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/migrations/20261122145735_multirole_authorization.sql"
docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$root/supabase/tests/rls_multirole.sql"
