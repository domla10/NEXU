#!/usr/bin/env python3
"""Pruebas Cloud opt-in. Lee clave pública y correo desde stdin; secretos solo en memoria.

No imprime cuerpos HTTP, contraseñas, claves, JWT ni URLs con parámetros sensibles.
No crea ni modifica nada hasta que el operador autorice expresamente cada fase.
"""
import getpass
import json
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

PROJECT_URL = 'https://hwckbmhfbsrwqohhmrom.supabase.co'  # NEXU-TEST exclusivamente
KINDS = ('admin', 'facilitador', 'participante')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

OPENER = urllib.request.build_opener(NoRedirect())

class CheckFailure(Exception):
    pass

def check(condition, label):
    print(('OK: ' if condition else 'FALLO: ') + label, flush=True)
    if not condition:
        raise CheckFailure(label)

def ask(prompt):
    return input(prompt).strip()

def api(key, path, method='GET', body=None, token=None, prefer=None):
    headers = {'apikey': key, 'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if prefer:
        headers['Prefer'] = prefer
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(PROJECT_URL + path, data=data, headers=headers, method=method)
    try:
        with OPENER.open(request, timeout=25) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        try:
            data = json.loads(exc.read())
        except (ValueError, UnicodeError):
            data = {}
        return exc.code, data
    except (OSError, ValueError) as exc:
        raise CheckFailure('No se pudo completar una solicitud segura; vuelve a empezar con una ejecución nueva.') from exc

def suffix_email(base, marker, kind):
    name, sep, domain = base.strip().partition('@')
    if not sep or not name or not domain or '+' in name or '@' in domain:
        raise CheckFailure('Introduce una dirección base sin alias; la bandeja debe estar bajo tu control.')
    return f'{name}+nexu{marker[:8]}{kind}@{domain}'

def main():
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise CheckFailure('Se requiere una terminal interactiva para proteger la entrada.')
    print('Destino fijo: NEXU-TEST. Se crearán tres cuentas y datos de prueba si se autorizan.', flush=True)
    base_email = ask('Correo base de la bandeja de pruebas: ')
    key = getpass.getpass('Clave pública del proyecto de pruebas (entrada oculta): ')
    if not key.startswith('eyJ') or key.count('.') != 2:
        raise CheckFailure('Se necesita la clave pública anon JWT del proyecto de prueba.')
    marker = secrets.token_hex(16)
    print('Identificador de ejecución:', marker, flush=True)
    print('Se generan contraseñas distintas en memoria. Un reinicio exige iniciar una nueva ejecución autorizada.', flush=True)
    if ask('Escribe CREAR para autorizar las tres altas en NEXU-TEST: ') != 'CREAR':
        raise CheckFailure('Altas canceladas antes de modificar el proyecto.')
    users = {}
    for table in ('profiles', 'courses', 'enrollments', 'course_facilitators'):
        path = '/rest/v1/' + table + ('?select=id' if table in ('profiles', 'courses') else '?select=course_id')
        status, error = api(key, path, token=key)
        check(status in (401, 403) and isinstance(error, dict) and error.get('code') == '42501', f'anónimo no lee {table} (HTTP {status})')
    status, error = api(key, '/rest/v1/rpc/set_profile_role', 'POST', {'target_id': '00000000-0000-0000-0000-000000000000', 'new_role': 'administrador'}, key)
    check(status in (401, 403) and isinstance(error, dict) and error.get('code') == '42501', f'anónimo no ejecuta RPC administrativa (HTTP {status})')
    for kind in KINDS:
        email = suffix_email(base_email, marker, kind)
        password = secrets.token_urlsafe(36)
        while True:
            status, response = api(key, '/auth/v1/signup', 'POST', {
                'email': email, 'password': password,
                'data': {'full_name': 'Identidad ficticia de prueba', 'nexu_test_run': marker,
                         'nexu_test_identity': kind, 'role': 'administrador'},
            })
            if status != 429:
                break
            print('Auth limita temporalmente los envíos; la ejecución conserva sus datos en memoria.', flush=True)
            if ask('Cuando se restablezca el límite, escribe REINTENTAR: ') != 'REINTENTAR':
                raise CheckFailure('Ejecución detenida por límite de envíos.')
        user = (response or {}).get('user') or (response or {})
        check(status in (200, 201) and isinstance(user, dict) and bool(user.get('id')), f'registro de {kind} aceptado por Auth (HTTP {status})')
        check(not user.get('email_confirmed_at') and not (response or {}).get('access_token'), f'{kind} requiere confirmar correo')
        users[kind] = {'email': email, 'password': password, 'id': user['id']}
        status, pending = api(key, '/auth/v1/token?grant_type=password', 'POST', {'email': email, 'password': password})
        check(status == 400 and isinstance(pending, dict) and pending.get('error_code') == 'email_not_confirmed' and not pending.get('access_token'), f'inicio de {kind} rechazado antes de confirmar (HTTP {status})')
        print(f'Confirma el correo dirigido al alias de {kind} (sufijo +nexu{marker[:8]}{kind}).', flush=True)
        while True:
            if ask('Cuando esté confirmado, escribe CONTINUAR: ') != 'CONTINUAR':
                raise CheckFailure('Ejecución detenida; no se eliminaron las cuentas creadas.')
            status, session = api(key, '/auth/v1/token?grant_type=password', 'POST', {'email': email, 'password': password})
            if status == 400 and isinstance(session, dict) and session.get('error_code') == 'email_not_confirmed':
                print('El correo todavía no figura confirmado; puedes volver a intentarlo.', flush=True)
                continue
            break
        check(status == 200 and isinstance(session, dict) and bool(session.get('access_token')), f'inicio de sesión real de {kind} tras confirmar (HTTP {status})')
        users[kind]['token'] = session['access_token']
        status, profiles = api(key, '/rest/v1/profiles?select=id,role', token=users[kind]['token'])
        check(status == 200 and isinstance(profiles, list) and len(profiles) == 1 and profiles[0].get('id') == user['id'] and profiles[0].get('role') == 'participante', f'perfil inicial de {kind} es participante')
    print('Listo para aplicar únicamente el bootstrap versionado de NEXU-TEST con el identificador mostrado.', flush=True)
    print('UUID del usuario administrador de prueba:', users['admin']['id'], flush=True)
    if ask('Tras ejecutar el bootstrap autorizado y verificar su resultado, escribe ADMIN: ') != 'ADMIN':
        raise CheckFailure('Bootstrap no confirmado; se detuvo la prueba.')
    # Las confirmaciones pueden tardar más que la vida útil del primer token.
    for kind in KINDS:
        status, session = api(key, '/auth/v1/token?grant_type=password', 'POST', {
            'email': users[kind]['email'], 'password': users[kind]['password'],
        })
        check(status == 200 and isinstance(session, dict) and bool(session.get('access_token')), f'sesión renovada de {kind} (HTTP {status})')
        users[kind]['token'] = session['access_token']
    admin = users['admin']['token']
    facilitator = users['facilitador']['token']
    participant = users['participante']['token']
    status, profiles = api(key, '/rest/v1/profiles?select=id,role', token=admin)
    check(status == 200 and any(p.get('id') == users['admin']['id'] and p.get('role') == 'administrador' for p in (profiles or [])), 'bootstrap del administrador confirmado con sesión real')
    status, _ = api(key, '/rest/v1/rpc/set_profile_role', 'POST', {'target_id': users['facilitador']['id'], 'new_role': 'facilitador'}, admin)
    check(200 <= status < 300, f'administrador asigna facilitador mediante RPC (HTTP {status})')
    status, error = api(key, '/rest/v1/rpc/set_profile_role', 'POST', {'target_id': users['admin']['id'], 'new_role': 'participante'}, admin)
    check(status == 403 and isinstance(error, dict) and error.get('code') == '42501', f'administrador no cambia su propio rol (HTTP {status})')
    title = 'Curso ficticio NEXU ' + marker[:8]
    status, courses = api(key, '/rest/v1/courses?select=id', 'POST', {'name': title}, admin, 'return=representation')
    check(status in (200, 201) and isinstance(courses, list) and len(courses) == 1, f'administrador crea curso de prueba (HTTP {status})')
    course_id = courses[0]['id']
    status, other_courses = api(key, '/rest/v1/courses?select=id', 'POST', {'name': 'Curso ajeno ficticio NEXU ' + marker[:8]}, admin, 'return=representation')
    check(status in (200, 201) and isinstance(other_courses, list) and len(other_courses) == 1, f'administrador crea curso ajeno de prueba (HTTP {status})')
    other_course_id = other_courses[0]['id']
    for table, field, kind in [('course_facilitators', 'facilitator_id', 'facilitador'), ('enrollments', 'participant_id', 'participante')]:
        status, _ = api(key, '/rest/v1/' + table, 'POST', {'course_id': course_id, field: users[kind]['id']}, admin)
        check(status in (200, 201, 204), f'administrador crea relación {table} (HTTP {status})')
    status, updated = api(key, '/rest/v1/profiles?id=eq.' + users['participante']['id'] + '&select=id,full_name', 'PATCH', {'full_name': 'Participante de prueba'}, participant, 'return=representation')
    check(status == 200 and isinstance(updated, list) and len(updated) == 1 and updated[0].get('full_name') == 'Participante de prueba', f'participante puede editar su nombre (HTTP {status})')
    status, rows = api(key, '/rest/v1/courses?select=id', token=participant)
    check(status == 200 and {x.get('id') for x in (rows or [])} == {course_id}, 'participante solo ve su curso inscrito')
    status, rows = api(key, '/rest/v1/enrollments?select=participant_id', token=participant)
    check(status == 200 and all(x.get('participant_id') == users['participante']['id'] for x in (rows or [])) and len(rows or []) == 1, 'participante solo ve su inscripción')
    status, rows = api(key, '/rest/v1/profiles?select=id', token=participant)
    check(status == 200 and len(rows or []) == 1 and rows[0].get('id') == users['participante']['id'], 'participante no ve perfiles ajenos')
    status, error = api(key, '/rest/v1/profiles?id=eq.' + users['participante']['id'], 'PATCH', {'role': 'administrador'}, participant)
    check(status == 403 and isinstance(error, dict) and error.get('code') == '42501', f'participante no cambia su rol (HTTP {status})')
    status, error = api(key, '/rest/v1/rpc/set_profile_role', 'POST', {'target_id': users['participante']['id'], 'new_role': 'administrador'}, participant)
    check(status == 403 and isinstance(error, dict) and error.get('code') == '42501', f'participante no eleva su rol por RPC (HTTP {status})')
    status, error = api(key, '/rest/v1/enrollments', 'POST', {'course_id': other_course_id, 'participant_id': users['participante']['id']}, participant)
    check(status == 403 and isinstance(error, dict) and error.get('code') == '42501', f'participante no puede inscribirse (HTTP {status})')
    status, rows = api(key, '/rest/v1/profiles?select=id', token=facilitator)
    check(status == 200 and {x.get('id') for x in (rows or [])} == {users['participante']['id'], users['facilitador']['id']}, 'facilitador ve su perfil y el participante del curso')
    status, rows = api(key, '/rest/v1/courses?select=id', token=facilitator)
    check(status == 200 and {x.get('id') for x in (rows or [])} == {course_id}, 'facilitador solo ve el curso asignado')
    status, changed = api(key, '/rest/v1/courses?id=eq.' + other_course_id + '&select=id', 'PATCH', {'name': 'Cambio no autorizado'}, facilitator, 'return=representation')
    check(status == 200 and changed == [], f'facilitador no modifica un curso ajeno (HTTP {status})')
    status, error = api(key, '/rest/v1/course_facilitators', 'POST', {'course_id': other_course_id, 'facilitator_id': users['facilitador']['id']}, facilitator)
    check(status == 403 and isinstance(error, dict) and error.get('code') == '42501', f'facilitador no puede asignarse cursos (HTTP {status})')
    status, _ = api(key, '/rest/v1/enrollments', 'POST', {'course_id': course_id, 'participant_id': users['participante']['id']}, admin)
    check(status == 409, f'no se permiten inscripciones duplicadas (HTTP {status})')
    print('Prueba terminada. Las cuentas y los datos de prueba no se eliminan automáticamente.', flush=True)

if __name__ == '__main__':
    try:
        main()
    except (CheckFailure, EOFError, KeyboardInterrupt):
        print('Prueba detenida; revisa el último resultado. Ninguna credencial se ha guardado.', file=sys.stderr, flush=True)
        sys.exit(1)
