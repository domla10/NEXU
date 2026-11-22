#!/usr/bin/env python3
"""Ejecuta carreras en un clúster PostgreSQL creado y destruido por este proceso."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get('NEXU_POSTGRES_BIN', '/usr/lib/postgresql/17/bin')).resolve()
ENV = {key: value for key, value in os.environ.items() if not key.upper().startswith('PG')}


def command(args, **kwargs):
    return subprocess.run(args, env=ENV, text=True, check=True, capture_output=True, **kwargs)


def main():
    for binary in ('initdb', 'pg_ctl', 'psql'):
        if not (BIN / binary).is_file():
            raise RuntimeError(f'Falta {BIN / binary}; configura NEXU_POSTGRES_BIN')
    with tempfile.TemporaryDirectory(prefix='nexu-concurrency-') as directory:
        socket = Path(directory)
        data = socket / 'data'
        command([str(BIN / 'initdb'), '-D', str(data), '-A', 'trust', '--no-locale'])
        port = '55439'
        command([str(BIN / 'pg_ctl'), '-D', str(data), '-l', str(socket / 'server.log'),
                 '-o', f"-k {socket} -p {port} -c listen_addresses=''", 'start'])
        psql = [str(BIN / 'psql'), '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
                '-h', str(socket), '-p', port, '-d', 'postgres']

        def run(sql, name='nexu_check', check=True):
            env = dict(ENV, PGAPPNAME=name)
            return subprocess.run(psql, input=sql, env=env, text=True, capture_output=True, check=check)

        def start(sql, name):
            env = dict(ENV, PGAPPNAME=name)
            proc = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, env=env, text=True)
            proc.stdin.write(sql)
            proc.stdin.close()
            return proc

        def wait_for(predicate, processes):
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                if any(p.poll() is not None for p in processes):
                    raise RuntimeError('Una transacción terminó antes de observar el bloqueo')
                if run(predicate).stdout.strip() == 't':
                    return
                time.sleep(.05)
            raise RuntimeError('No se observó el bloqueo esperado')

        def finish(proc, succeeds):
            proc.wait(timeout=15)
            error = proc.stderr.read()
            if (proc.returncode == 0) != succeeds:
                raise RuntimeError(error or 'Resultado inesperado de transacción')
            return error

        try:
            files = ['supabase/tests/support/auth_stub.sql',
                     'supabase/migrations/20261114230539_data_foundation.sql',
                     'supabase/migrations/20261122145735_multirole_authorization.sql']
            for file in files:
                command(psql + ['-f', str(ROOT / file)])
            admin, actor = str(uuid.uuid4()), str(uuid.uuid4())
            run(f"insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('{admin}','a@example.test',now(),'{{}}'),('{actor}','b@example.test',now(),'{{}}'); update public.profiles set role='administrador' where id in ('{admin}','{actor}');")
            auth_actor = f"set local role authenticated; select set_config('request.jwt.claim.sub','{actor}',true);"
            auth_admin = f"set local role authenticated; select set_config('request.jwt.claim.sub','{admin}',true);"
            revoke = f"select public.set_profile_role('{actor}','participante');"
            for write_first in (True, False):
                if not write_first:
                    run(f"update public.profiles set role='administrador' where id='{actor}';")
                first_sql = auth_actor + "insert into public.courses(name) values ('primero');" if write_first else auth_admin + revoke
                second_sql = auth_admin + revoke if write_first else auth_actor + "insert into public.courses(name) values ('segundo');"
                first = start('begin; ' + first_sql + 'select pg_sleep(6); commit;', 'nexu_first')
                wait_for("select exists(select 1 from pg_stat_activity where application_name='nexu_first' and wait_event='PgSleep');", [first])
                second = start('begin; ' + second_sql + 'commit;', 'nexu_second')
                wait_for("select exists(select 1 from pg_stat_activity a join pg_stat_activity b on b.pid=any(pg_blocking_pids(a.pid)) where a.application_name='nexu_second' and b.application_name='nexu_first');", [first, second])
                finish(first, True)
                error = finish(second, write_first)
                if not write_first and 'row-level security' not in error:
                    raise RuntimeError('La escritura posterior no fue rechazada por RLS')
            print('Concurrencia: ambos bloqueos y órdenes verificados en clúster desechable.')
        finally:
            command([str(BIN / 'pg_ctl'), '-D', str(data), 'stop', '-m', 'fast'])


if __name__ == '__main__':
    main()
