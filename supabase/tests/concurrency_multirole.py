#!/usr/bin/env python3
"""Solo para PostgreSQL desechable ya migrado; usa las variables PG* de libpq."""
import os
import subprocess
import time

PSQL = os.environ.get('NEXU_TEST_PSQL', 'psql')
ADMIN = '92000000-0000-0000-0000-000000000001'
ACTOR = '92000000-0000-0000-0000-000000000002'

def run(sql, **kw):
    return subprocess.run([PSQL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres'],
                          input=sql, text=True, capture_output=True, **kw)

def checked(sql):
    result = run(sql)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout

def start(name, sql):
    env = dict(os.environ, PGAPPNAME=name)
    p = subprocess.Popen([PSQL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres'],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         text=True, env=env)
    p.stdin.write(sql)
    p.stdin.close()
    for _ in range(100):
        state = checked("select count(*) from pg_stat_activity where application_name='" + name + "' and wait_event='PgSleep';")
        if '\n     1\n' in state:
            return p
        if p.poll() is not None:
            raise RuntimeError('Sesión concurrente terminó antes de sincronizar: ' + p.stderr.read())
        time.sleep(.05)
    p.kill()
    raise RuntimeError('No se sincronizó la sesión concurrente')

def finish(p):
    p.wait(timeout=15)
    err = p.stderr.read()
    if p.returncode:
        raise RuntimeError(err)

checked(f"""
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('{ADMIN}','nexu-race-admin@example.test',now(),'{{}}'),
('{ACTOR}','nexu-race-actor@example.test',now(),'{{}}');
update public.profiles set role='administrador' where id in ('{ADMIN}','{ACTOR}');
""")
try:
    # La escritura ya autorizada mantiene el bloqueo hasta terminar.
    p = start('nexu_write_first', f"""begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','{ACTOR}',true);
      insert into public.courses(name) values ('race write first');
      select pg_sleep(3); commit;""")
    checked(f"""begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','{ADMIN}',true);
      select public.set_profile_role('{ACTOR}','participante'); commit;""")
    finish(p)
    checked(f"update public.profiles set role='administrador' where id='{ACTOR}'")
    # La revocación obtiene primero el bloqueo; al esperar, la escritura debe denegarse.
    p = start('nexu_revoke_first', f"""begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','{ADMIN}',true);
      select public.set_profile_role('{ACTOR}','participante');
      select pg_sleep(3); commit;""")
    denied = run(f"""begin; set local role authenticated;
      select set_config('request.jwt.claim.sub','{ACTOR}',true);
      insert into public.courses(name) values ('race unauthorized'); commit;""")
    finish(p)
    if denied.returncode == 0 or 'row-level security' not in denied.stderr:
        raise RuntimeError('La escritura tras revocación no fue rechazada: ' + denied.stderr)
    checked("do $$ begin if exists (select from public.courses where name='race unauthorized') then raise exception 'escritura indebida'; end if; end $$;")
    print('Concurrencia: operación y revocación serializadas en ambos órdenes.')
finally:
    checked(f"delete from public.courses where name in ('race write first','race unauthorized'); delete from auth.users where id in ('{ADMIN}','{ACTOR}');")
