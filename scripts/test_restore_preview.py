"""Offline recovery safety tests: no credentials, database or provider access."""
import importlib.util
import pathlib
import unittest
from unittest import mock
import json

path = pathlib.Path(__file__).with_name('restore-preview.py')
spec = importlib.util.spec_from_file_location('recovery', path)
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class RecoveryTests(unittest.TestCase):
    def preview_environment(self):
        raw = ('postgresql://postgres.eoroljcefsurgsxegfzp:synthetic'
               '@aws-0-eu-west-1.pooler.supabase.com:5432/postgres')
        with mock.patch.object(pathlib.Path, 'is_file', return_value=True):
            return recovery.connection_environment(raw)

    def identity(self):
        return dict(database='postgres', user='postgres', session_user='postgres',
                    ssl=True, tls_version='TLSv1.3', read_only='on',
                    _client_tls_verified=True)

    def test_diagnostics_separate_all_three_failures_and_do_not_disclose_secrets(self):
        env = self.preview_environment()
        identity = self.identity()
        identity.update(user='other', ssl=False, read_only='off',
                        _client_tls_verified=False,
                        password='never-display-synthetic-password',
                        unexpected='never-display-synthetic-token')
        with mock.patch('builtins.print') as output:
            recovery.report_session(identity, env)
        report = json.loads(output.call_args.args[0])
        self.assertEqual(report['verificacoes'], {
            'identidade_postgresql': False, 'tls_cliente_pooler': False,
            'transacao_read_only': False,
        })
        self.assertEqual(report['tls_version'], 'TLSv1.3')
        serialized = json.dumps(report)
        self.assertNotIn('never-display', serialized)
        self.assertNotIn(env['PGPASSWORD'], serialized)

    def test_failed_session_reports_exact_condition_without_relaxing_other_guards(self):
        for field, value, category in [
            ('user', 'other', 'identidade_postgresql'),
            ('_client_tls_verified', False, 'tls_cliente_pooler'),
            ('read_only', 'off', 'transacao_read_only'),
        ]:
            identity = self.identity()
            identity[field] = value
            with self.subTest(field=field), self.assertRaisesRegex(recovery.RecoveryError, category):
                recovery.validate_session(identity)

    def test_connection_error_classification_never_returns_original_stderr(self):
        env = self.preview_environment()
        for error, category in [
            ('password authentication failed', 'AUTENTICACAO_POSTGRESQL_FALHOU'),
            ('SSL error: certificate verify failed', 'VALIDACAO_CERTIFICADO_TLS_FALHOU'),
            ('SSL handshake failed', 'LIGACAO_TLS_FALHOU'),
        ]:
            result = mock.Mock(returncode=1, stderr=error + ' never-display', stdout='')
            with self.subTest(category=category), mock.patch.object(recovery.subprocess, 'run', return_value=result):
                with self.assertRaisesRegex(recovery.RecoveryError, category) as caught:
                    recovery.psql('BEGIN READ ONLY; SELECT 1; ROLLBACK;', env)
                self.assertNotIn('never-display', str(caught.exception))

    def test_preview_connection_forces_verified_tls_and_removes_inherited_pg_settings(self):
        with mock.patch.dict(recovery.os.environ, {'PGHOSTADDR': '127.0.0.1',
                                                 'PGSERVICE': 'production',
                                                 'PGSSLMODE': 'disable'}):
            env = self.preview_environment()
        recovery.validate_connection_environment(env)
        self.assertNotIn('PGHOSTADDR', env)
        self.assertNotIn('PGSERVICE', env)
        self.assertEqual(env['PGSSLMODE'], 'verify-full')

    def test_tampered_child_environment_is_rejected_before_any_sql(self):
        for key, value in [('PGUSER', 'postgres.qrapjyuiyermdbrjyssx'),
                           ('PGHOST', 'other.example'), ('PGPORT', '6543'),
                           ('PGDATABASE', 'other'), ('PGSSLMODE', 'require'),
                           ('PGSSLROOTCERT', '/other.crt'), ('PGHOSTADDR', '127.0.0.1'),
                           ('PGGSSENCMODE', 'prefer')]:
            env = self.preview_environment()
            env[key] = value
            with self.subTest(field=key), mock.patch.object(recovery.subprocess, 'run') as run:
                with self.assertRaises(recovery.RecoveryError):
                    recovery.psql('SELECT 1;', env)
                run.assert_not_called()

    def test_session_identity_requires_both_roles_tls_and_read_only(self):
        recovery.validate_session(self.identity())
        for key, value in [('database', 'other'), ('user', 'other'),
                           ('session_user', 'other'), ('_client_tls_verified', False),
                           ('_client_tls_verified', None), ('read_only', 'off')]:
            identity = self.identity()
            identity[key] = value
            with self.subTest(field=key), self.assertRaises(recovery.RecoveryError):
                recovery.validate_session(identity)

    def test_backend_ssl_does_not_describe_client_pooler_tls(self):
        for backend_ssl in [False, None, True]:
            identity = self.identity()
            identity['ssl'] = backend_ssl
            recovery.validate_session(identity)

    def test_client_tls_evidence_requires_successful_verified_libpq_connection(self):
        env = self.preview_environment()
        identity = self.identity()
        identity.pop('_client_tls_verified')
        identity['ssl'] = False
        with mock.patch.object(recovery, 'psql', return_value=json.dumps(identity)):
            observed = recovery.read_session('BEGIN READ ONLY; SELECT 1; ROLLBACK;', env)
        self.assertTrue(observed['_client_tls_verified'])
        recovery.validate_session(observed)
        with mock.patch.object(recovery, 'psql', side_effect=recovery.RecoveryError('TLS failed')):
            with self.assertRaises(recovery.RecoveryError):
                recovery.read_session('SELECT 1;', env)

    def test_target_probe_uses_only_read_only_identity_sql(self):
        env = self.preview_environment()
        with mock.patch.object(recovery, 'psql', return_value=json.dumps(self.identity())) as query:
            recovery.verify_target(env)
        sql = query.call_args.args[0]
        self.assertIn('BEGIN READ ONLY;', sql)
        self.assertIn('ROLLBACK;', sql)
        self.assertIn('session_user', sql)
        for forbidden in ['INSERT ', 'UPDATE ', 'DELETE ', 'CREATE ', 'ALTER ', 'COPY ', 'COMMIT;']:
            self.assertNotIn(forbidden, sql)

    def test_probe_mode_never_requests_manual_ref_or_runs_archive_or_restore(self):
        with mock.patch.object(recovery.sys, 'argv', ['restore-preview.py', '--verify-target']), \
             mock.patch.object(recovery.sys.stdin, 'isatty', return_value=True), \
             mock.patch.object(recovery.getpass, 'getpass', return_value='synthetic'), \
             mock.patch.object(recovery, 'connection_environment', return_value=self.preview_environment()), \
             mock.patch.object(recovery, 'verify_target') as probe, \
             mock.patch.object(recovery, 'archive') as archive, \
             mock.patch.object(recovery, 'audit') as audit, \
             mock.patch.object(recovery, 'transaction') as transaction, \
             mock.patch('builtins.input', side_effect=AssertionError('Manual confirmation forbidden')), \
             mock.patch('builtins.print'):
            recovery.main()
        probe.assert_called_once()
        archive.assert_not_called()
        audit.assert_not_called()
        transaction.assert_not_called()

    def test_sequence_restart_preserves_next_value_for_both_states(self):
        self.assertEqual(recovery.sequence_restart(42, True), 43)
        self.assertEqual(recovery.sequence_restart(42, False), 42)
        self.assertEqual(recovery.sequence_restart(42, True, 5), 47)

    def test_rejects_every_target_except_explicit_preview_session_pooler(self):
        invalid = [
            'postgresql://postgres.qrapjyuiyermdbrjyssx:synthetic@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
            'postgresql://postgres.eoroljcefsurgsxegfzp:synthetic@other.example:5432/postgres',
            'postgresql://postgres.eoroljcefsurgsxegfzp:synthetic@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
            'postgresql://postgres.eoroljcefsurgsxegfzp:synthetic@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=disable',
        ]
        for raw in invalid:
            with self.subTest(target='redacted'), self.assertRaises(recovery.RecoveryError):
                recovery.connection_environment(raw)

    def test_archive_payload_preserves_tables_excluding_only_sports(self):
        payload, restarts = recovery.archive()
        self.assertNotIn('COPY public.sports ', payload)
        for table in recovery.COUNTS:
            if table != 'sports':
                self.assertIn(f'COPY public.{table} ', payload)
        self.assertNotIn('setval(', payload + restarts)
        self.assertEqual(restarts.count('ALTER SEQUENCE public.'), 12)
        self.assertIn('archive_external_id_seq RESTART WITH 900060955', restarts)
        self.assertIn('sports_id_seq RESTART WITH 7', restarts)
        transaction = recovery.transaction(payload, restarts)
        self.assertLess(transaction.index('LOCK TABLE'), transaction.index('COPY public.'))
        self.assertLess(transaction.index('DO $verify$'), transaction.index('COMMIT;'))
        self.assertNotIn('TRUNCATE', transaction)
        self.assertNotIn('DROP ', transaction)
        self.assertNotIn('DELETE ', transaction)


if __name__ == '__main__':
    unittest.main()
