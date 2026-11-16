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

if __name__ == '__main__':
    unittest.main()
