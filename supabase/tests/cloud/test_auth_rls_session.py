"""Pruebas locales sin red, cuentas ni credenciales reales."""
import contextlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

path = Path(__file__).with_name('auth_rls_session.py')
spec = importlib.util.spec_from_file_location('nexu_cloud_session', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class SessionSafetyTests(unittest.TestCase):
    def test_registration_rejects_existing_participant_before_network(self):
        with patch.object(module, 'api') as api, self.assertRaises(module.CheckFailure):
            module.register_persistent('participante')
        api.assert_not_called()

    def test_registration_rejects_short_password_before_network(self):
        env = {'NEXU_TEST_ANON_KEY': 'public', 'NEXU_TEST_ADMIN_EMAIL': 'admin@example.test',
               'NEXU_TEST_ADMIN_PASSWORD': '12345678'}
        with patch.dict('os.environ', env, clear=True), patch.object(module.sys.stdin, 'isatty', return_value=True), patch.object(module, 'api') as api:
            with self.assertRaises(module.CheckFailure):
                module.register_persistent('admin')
            api.assert_not_called()

    def test_persistent_missing_secrets_stops_before_network(self):
        with patch.dict('os.environ', {}, clear=True), patch.object(module, 'api') as api:
            with self.assertRaises(module.CheckFailure):
                module.persistent_authenticate()
            api.assert_not_called()

    def test_persistent_auth_requires_confirmed_matching_distinct_accounts(self):
        env = {'NEXU_TEST_ANON_KEY': 'public', 'NEXU_TEST_ADMIN_PASSWORD': 'a',
               'NEXU_TEST_FACILITADOR_PASSWORD': 'b', 'NEXU_TEST_PARTICIPANTE_PASSWORD': 'c',
               'NEXU_TEST_ADMIN_EMAIL': 'admin@example.test', 'NEXU_TEST_FACILITADOR_EMAIL': 'fac@example.test',
               'NEXU_TEST_PARTICIPANTE_EMAIL': 'part@example.test'}
        def response(key, path, method='GET', body=None, **kwargs):
            return 200, {'access_token': 'secret-token', 'user': {
                'id': body['email'], 'email': body['email'], 'email_confirmed_at': 'yes'}}
        with patch.dict('os.environ', env, clear=True), patch.object(module, 'api', side_effect=response) as api:
            users = module.persistent_authenticate()
            self.assertEqual(len({u['id'] for u in users.values()}), 3)
            self.assertEqual(api.call_count, 3)
            self.assertNotIn('password', users['admin'])

    def test_persistent_rejects_mismatched_email(self):
        with patch.dict('os.environ', {'NEXU_TEST_ADMIN_EMAIL': 'admin@example.test'}), patch.object(module, 'api', return_value=(200, {'access_token': 'x', 'user': {'id': 'x', 'email': 'other@example.test', 'email_confirmed_at': 'yes'}})):
            with self.assertRaises(module.CheckFailure):
                module.authenticate_persistent('key', 'admin', 'password')

    def test_existing_confirmed_identity_can_be_authenticated_without_storing_secret(self):
        result = {'access_token': 'session-in-memory', 'user': {'id': 'id-1', 'email_confirmed_at': 'confirmed', 'user_metadata': {'nexu_test_run': 'a' * 32, 'nexu_test_identity': 'participante'}}}
        with patch.object(module, 'api', return_value=(200, result)):
            user = module.authenticate_existing('public-key', 'test@example.test', 'temporary-password', 'participante', 'a' * 32)
        self.assertEqual(user['id'], 'id-1')
        self.assertEqual(user['token'], 'session-in-memory')
        self.assertNotIn('password', user)

    def test_existing_identity_rejects_unconfirmed_or_wrong_execution(self):
        response = {'access_token': 'session-in-memory', 'user': {'id': 'id-1', 'email_confirmed_at': None, 'user_metadata': {'nexu_test_run': 'a' * 32, 'nexu_test_identity': 'participante'}}}
        with patch.object(module, 'api', return_value=(200, response)), self.assertRaises(module.CheckFailure):
            module.authenticate_existing('public-key', 'test@example.test', 'temporary-password', 'participante', 'a' * 32)
        response['user']['email_confirmed_at'] = 'confirmed'
        with patch.object(module, 'api', return_value=(200, response)), self.assertRaises(module.CheckFailure):
            module.authenticate_existing('public-key', 'test@example.test', 'temporary-password', 'participante', 'b' * 32)

    def test_existing_course_stops_before_mutating_test_fixtures(self):
        users = {name: {'id': name, 'token': 'session'} for name in module.KINDS}
        responses = [(200, [{'id': 'admin', 'role': 'administrador'}]), (200, [{'id': 'existing'}])]
        with patch.object(module, 'api', side_effect=responses) as api, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(module.CheckFailure):
                module.run_security_tests('public-key', users, 'a' * 32)
        self.assertEqual(api.call_count, 2)
    def test_aliases_are_unique_and_no_password_is_embedded(self):
        marker = 'a' * 32
        aliases = {module.suffix_email('prueba@example.test', marker, role) for role in module.KINDS}
        self.assertEqual(len(aliases), 3)
        self.assertTrue(all(address.endswith('@example.test') for address in aliases))
        with self.assertRaises(module.CheckFailure):
            module.suffix_email('prueba+existente@example.test', marker, 'admin')

    def test_rejects_noninteractive_execution_before_any_network(self):
        with patch.object(module.sys.stdin, 'isatty', return_value=False), patch.object(module, 'api') as api:
            with self.assertRaises(module.CheckFailure):
                module.main()
            api.assert_not_called()

    def test_rejection_does_not_output_response_data(self):
        captured = io.StringIO()
        with contextlib.redirect_stdout(captured):
            with self.assertRaises(module.CheckFailure):
                module.check(False, 'operación rechazada')
        self.assertEqual(captured.getvalue(), 'FALLO: operación rechazada\n')

    def test_http_redirect_is_not_followed(self):
        handler = module.NoRedirect()
        self.assertIsNone(handler.redirect_request(None, None, 302, '', {}, 'https://example.test'))

    def test_retry_after_formats_and_fallback(self):
        self.assertEqual(module.retry_after_seconds('90'), 90)
        self.assertEqual(module.retry_after_seconds('Thu, 01 Jan 1970 00:02:00 GMT', now=60), 60)
        self.assertEqual(module.retry_after_seconds(None), 3600)
        self.assertEqual(module.retry_after_seconds('inválido'), 3600)

    def test_retry_remaining_uses_monotonic_clock(self):
        with patch.object(module, 'retry_not_before', 110), patch.object(module.time, 'monotonic', return_value=100):
            self.assertEqual(module.retry_remaining(), 10)
        with patch.object(module, 'retry_not_before', 110), patch.object(module.time, 'monotonic', return_value=111):
            self.assertEqual(module.retry_remaining(), 0)

if __name__ == '__main__':
    unittest.main()
