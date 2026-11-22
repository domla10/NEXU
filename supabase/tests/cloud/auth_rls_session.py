#!/usr/bin/env python3
"""Pruebas Cloud opt-in. Lee clave pública y correo desde stdin; secretos solo en memoria.

No imprime cuerpos HTTP, contraseñas, claves, JWT ni URLs con parámetros sensibles.
No crea ni modifica nada hasta que el operador autorice expresamente cada fase.
"""
import getpass
import json
import math
import os
import secrets
import sys
import time
from email.utils import parsedate_to_datetime
import urllib.error
import urllib.parse
import urllib.request

PROJECT_URL = 'https://hwckbmhfbsrwqohhmrom.supabase.co'  # NEXU-TEST exclusivamente
KINDS = ('admin', 'facilitador', 'participante')
retry_not_before = 0.0

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

def retry_after_seconds(value, now=None):
    """Acepta Retry-After en segundos o fecha HTTP; sin encabezado, espera una hora."""
    if not value:
        return 3600
    try:
        if value.strip().isdigit():
            return int(value.strip())
        date = parsedate_to_datetime(value)
        if date.tzinfo is None:
            return 3600
        return max(0, math.ceil(date.timestamp() - (time.time() if now is None else now)))
    except (ValueError, TypeError, OverflowError):
        return 3600

def retry_remaining():
    return max(0, math.ceil(retry_not_before - time.monotonic()))

def api(key, path, method='GET', body=None, token=None, prefer=None):
    global retry_not_before
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
        if exc.code == 429 and path == '/auth/v1/signup':
            retry_not_before = time.monotonic() + retry_after_seconds(exc.headers.get('Retry-After'))
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

def authenticate_existing(key, email, password, kind, marker):
    status, session = api(key, '/auth/v1/token?grant_type=password', 'POST', {'email': email, 'password': password})
    if status != 200 or not isinstance(session, dict):
        raise CheckFailure(f'No se pudo iniciar sesión en la identidad {kind} (HTTP {status}).')
    user = session.get('user') or {}
    metadata = user.get('user_metadata') or {}
    if not (session.get('access_token') and user.get('id') and user.get('email_confirmed_at')
            and metadata.get('nexu_test_run') == marker and metadata.get('nexu_test_identity') == kind):
        raise CheckFailure('La identidad autenticada no corresponde a la ejecución confirmada.')
    return {'id': user['id'], 'token': session['access_token']}

def authenticate_persistent(key, kind, password):
    email = os.environ.get(f'NEXU_TEST_{kind.upper()}_EMAIL', '').strip()
    if not email:
        raise CheckFailure(f'Falta el correo de la identidad {kind}.')
    status, session = api(key, '/auth/v1/token?grant_type=password', 'POST',
                          {'email': email, 'password': password})
    if status != 200 or not isinstance(session, dict):
        raise CheckFailure(f'No se pudo iniciar sesión en {kind} (HTTP {status}).')
    user = session.get('user') or {}
    if not (session.get('access_token') and user.get('id') and user.get('email_confirmed_at')
            and str(user.get('email', '')).casefold() == email.casefold()):
        raise CheckFailure(f'La cuenta {kind} no coincide o no está confirmada.')
    return {'id': user['id'], 'token': session['access_token']}


def persistent_authenticate():
    names = {'admin': 'NEXU_TEST_ADMIN_PASSWORD',
             'facilitador': 'NEXU_TEST_FACILITADOR_PASSWORD',
             'participante': 'NEXU_TEST_PARTICIPANTE_PASSWORD'}
    key = os.environ.get('NEXU_TEST_ANON_KEY', '')
    if not key or any(not os.environ.get(name) for name in names.values()) or any(
            not os.environ.get(f'NEXU_TEST_{kind.upper()}_EMAIL') for kind in names):
        raise CheckFailure('Faltan variables NEXU_TEST requeridas.')
    users = {kind: authenticate_persistent(key, kind, os.environ[name])
             for kind, name in names.items()}
    if len({user['id'] for user in users.values()}) != len(names):
        raise CheckFailure('Las identidades deben ser distintas.')
    return users


def register_persistent(kind):
    if kind not in ('admin', 'facilitador'):
        raise CheckFailure('Solo se pueden registrar las identidades pendientes verificadas.')
    if not sys.stdin.isatty():
        raise CheckFailure('Se requiere terminal interactiva.')
    key = os.environ.get('NEXU_TEST_ANON_KEY', '')
    email = os.environ.get(f'NEXU_TEST_{kind.upper()}_EMAIL', '').strip()
    password = os.environ.get(f'NEXU_TEST_{kind.upper()}_PASSWORD', '')
    if not key or not email or len(password) < 16:
        raise CheckFailure('Faltan variables o la contraseña tiene menos de 16 caracteres.')
    if ask(f'Tras verificar que {kind} no existe en NEXU-TEST, escribe REGISTRAR: ') != 'REGISTRAR':
        raise CheckFailure('Registro cancelado.')
    status, response = api(key, '/auth/v1/signup', 'POST', {'email': email, 'password': password})
    if status == 429:
        print(f'Supabase limita los envíos. Espera al menos {retry_remaining()} segundos antes de otro intento.', flush=True)
        raise CheckFailure('Registro limitado por Supabase.')
    user = (response or {}).get('user') or (response or {})
    if status not in (200, 201) or not isinstance(user, dict) or not user.get('id'):
        raise CheckFailure(f'Auth no aceptó el registro (HTTP {status}).')
    if not user.get('identities'):
        raise CheckFailure('Auth no confirmó una identidad nueva; revisa cuentas existentes antes de repetir.')
    if user.get('email_confirmed_at') or (response or {}).get('access_token'):
        raise CheckFailure('La cuenta no requiere confirmación; revisar configuración de Auth.')
    print(f'Registro {kind} aceptado. Confirma el correo recibido.', flush=True)


def persistent_main(run_fixtures=False):
    users = persistent_authenticate()
    print('Las tres identidades confirmadas iniciaron sesión en NEXU-TEST.', flush=True)
    if not run_fixtures:
        return
    if not sys.stdin.isatty() or ask('Para crear datos ficticios autorizados escribe EJECUTAR: ') != 'EJECUTAR':
        raise CheckFailure('Pruebas detenidas antes de crear fixtures.')
    run_security_tests(os.environ['NEXU_TEST_ANON_KEY'], users, secrets.token_hex(16))


def run_security_tests(key, users, marker):
    admin = users['admin']['token']
    facilitator = users['facilitador']['token']
    participant = users['participante']['token']
    status, profiles = api(key, '/rest/v1/profiles?select=id,role', token=admin)
    check(status == 200 and any(p.get('id') == users['admin']['id'] and p.get('role') == 'administrador' for p in (profiles or [])), 'bootstrap del administrador confirmado con sesión real')
    title = 'Curso ficticio NEXU ' + marker[:8]
    other_title = 'Curso ajeno ficticio NEXU ' + marker[:8]
    for name in (title, other_title):
        status, existing = api(key, '/rest/v1/courses?select=id&name=eq.' + urllib.parse.quote(name, safe=''), token=admin)
        check(status == 200 and isinstance(existing, list) and not existing, 'no hay cursos existentes para esta ejecución')
    status, _ = api(key, '/rest/v1/rpc/set_profile_role', 'POST', {'target_id': users['facilitador']['id'], 'new_role': 'facilitador'}, admin)
    check(200 <= status < 300, f'administrador asigna facilitador mediante RPC (HTTP {status})')
    status, error = api(key, '/rest/v1/rpc/set_profile_role', 'POST', {'target_id': users['admin']['id'], 'new_role': 'participante'}, admin)
    check(status == 403 and isinstance(error, dict) and error.get('code') == '42501', f'administrador no cambia su propio rol (HTTP {status})')
    status, courses = api(key, '/rest/v1/courses?select=id', 'POST', {'name': title}, admin, 'return=representation')
    check(status in (200, 201) and isinstance(courses, list) and len(courses) == 1, f'administrador crea curso de prueba (HTTP {status})')
    course_id = courses[0]['id']
    status, other_courses = api(key, '/rest/v1/courses?select=id', 'POST', {'name': other_title}, admin, 'return=representation')
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
    # Mismo JWT para comprobar simultaneidad y revocación efectiva en base de datos.
    status, _ = api(key, '/rest/v1/enrollments', 'POST', {'course_id': other_course_id, 'participant_id': users['facilitador']['id']}, admin)
    check(status in (200, 201, 204), 'facilitador inscrito en otro curso')
    status, rows = api(key, '/rest/v1/courses?select=id', token=facilitator)
    check(status == 200 and {x.get('id') for x in (rows or [])} == {course_id, other_course_id}, 'sesión multirrol ve ambos cursos')
    path = '/rest/v1/course_facilitators?course_id=eq.' + course_id + '&facilitator_id=eq.' + users['facilitador']['id']
    status, deleted = api(key, path, 'DELETE', token=admin, prefer='return=representation')
    check(status == 200 and isinstance(deleted, list) and len(deleted) == 1, 'administrador revoca asignación')
    status, rows = api(key, '/rest/v1/courses?select=id', token=facilitator)
    check(status == 200 and {x.get('id') for x in (rows or [])} == {other_course_id}, 'mismo JWT pierde acceso al curso revocado y conserva inscripción')
    status, _ = api(key, '/rest/v1/rpc/set_profile_role', 'POST', {'target_id': users['facilitador']['id'], 'new_role': 'administrador'}, admin)
    check(200 <= status < 300, 'administrador concede administración temporal')
    status, _ = api(key, '/rest/v1/rpc/set_profile_role', 'POST', {'target_id': users['facilitador']['id'], 'new_role': 'participante'}, admin)
    check(200 <= status < 300, 'administrador revoca administración temporal')
    status, error = api(key, '/rest/v1/courses', 'POST', {'name': 'No autorizado ' + marker[:8]}, facilitator)
    check(status == 403 and isinstance(error, dict) and error.get('code') == '42501', 'mismo JWT no administra tras revocación')
    print('Prueba terminada. Las cuentas y los datos de prueba no se eliminan automáticamente.', flush=True)


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
            remaining = retry_remaining()
            if remaining > 0:
                print(f'Espera al menos {remaining} segundos antes de reintentar el registro.', flush=True)
                if ask('Cuando termine la espera, escribe REINTENTAR: ') != 'REINTENTAR':
                    raise CheckFailure('Ejecución detenida durante la espera.')
                continue
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
    run_security_tests(key, users, marker)

def resume_main():
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise CheckFailure('Se requiere una terminal interactiva.')
    print('Reanudación en NEXU-TEST con identidades confirmadas; no se crean cuentas.', flush=True)
    marker = ask('Identificador de ejecución (32 caracteres hexadecimales): ')
    if len(marker) != 32 or any(c not in '0123456789abcdef' for c in marker):
        raise CheckFailure('Identificador de ejecución inválido.')
    key = getpass.getpass('Clave pública anon de NEXU-TEST: ')
    users = {}
    for kind in KINDS:
        email = getpass.getpass(f'Correo de la identidad {kind}: ')
        password = getpass.getpass(f'Contraseña actual de {kind}: ')
        users[kind] = authenticate_existing(key, email, password, kind, marker)
        del password, email
        print(f'Identidad {kind} confirmada e iniciada mediante Auth.', flush=True)
    if len({user['id'] for user in users.values()}) != len(KINDS):
        raise CheckFailure('Las identidades deben ser distintas.')
    print('Verifica que el bootstrap autorizado de administrador ya se haya aplicado.', flush=True)
    if ask('Para ejecutar las pruebas de seguridad, escribe ADMIN: ') != 'ADMIN':
        raise CheckFailure('Pruebas detenidas antes de crear relaciones de prueba.')
    run_security_tests(key, users, marker)

if __name__ == '__main__':
    try:
        if len(sys.argv) == 3 and sys.argv[1] == '--registrar-persistente':
            register_persistent(sys.argv[2])
        elif sys.argv[1:] == ['--persistentes']:
            persistent_main()
        elif sys.argv[1:] == ['--persistentes-con-fixtures']:
            persistent_main(run_fixtures=True)
        elif sys.argv[1:] == ['--reanudar']:
            resume_main()
        elif sys.argv[1:]:
            raise CheckFailure('Opción desconocida.')
        else:
            main()
    except (CheckFailure, EOFError, KeyboardInterrupt):
        print('Prueba detenida; revisa el último resultado. Ninguna credencial se ha guardado.', file=sys.stderr, flush=True)
        sys.exit(1)
