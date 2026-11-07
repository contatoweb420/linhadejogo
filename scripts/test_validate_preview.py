"""Offline safety and assessment tests for the post-restore read-only validator."""
import copy
import importlib.util
import pathlib
import re
import json
import unittest

path = pathlib.Path(__file__).with_name('validate-preview.py')
spec = importlib.util.spec_from_file_location('validation', path)
validation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validation)


def restored_metadata():
    return dict(counts=dict(validation.recovery.COUNTS),
                orphans={f'{t}.{c}': 0 for t, c, _, _ in validation.ORIGIN['foreign_keys']},
                duplicates={'matches.source+external_id': 0, 'matches.source+provider_key': 0},
                season_competition_mismatches=0, standings_season_mismatches=0,
                columns=[dict(c, table=t) for t, cols in validation.ORIGIN['columns'].items() for c in cols],
                constraints_valid=True, constraint_counts=dict(p=13, u=10, f=12, c=1),
                indexes=[dict(table=t, name=t + '_source_provider_key', unique=True, valid=True,
                              method='btree', columns=['source', 'provider_key'],
                              predicate='(provider_key IS NOT NULL)') for t in ['matches', 'teams', 'seasons']],
                archive_sequence=dict(type='bigint', start=900000001, increment=1, min=1,
                                      max=9223372036854775807, cache=1, cycle=False))


class ValidationTests(unittest.TestCase):
    def test_nested_suite_setup_error_is_blocked_before_test_body(self):
        name = validation.INTEGRATION_TESTS[0]
        data = {'testResults': [{
            'message': '',
            'diagnosticErrors': [{'phase': 'SESSION_IDENTITY', 'code': 'READ_ONLY_OFF',
                'frames': ['src/server/db/preview-readonly.integration.test.ts:67:9',
                           'private-secret-stack']}],
            'assertionResults': [{'title': name, 'status': 'skipped', 'failureMessages': []}],
        }]}
        result = validation.integration_result(name, 1, json.dumps(data))
        self.assertEqual(result['result'], 'BLOCKED')
        self.assertFalse(result['test_body_executed'])
        self.assertEqual(result['code'], 'READ_ONLY_OFF')
        self.assertNotIn('private-secret', json.dumps(result))

    def test_individual_report_requires_actual_passed_test(self):
        name = validation.INTEGRATION_TESTS[0]
        data = {'testResults': [{'assertionResults': [{'title': name, 'status': 'passed'}]}]}
        self.assertEqual(validation.integration_result(name, 0, json.dumps(data))['result'], 'PASSED')
        self.assertEqual(validation.integration_result(name, 1, json.dumps(data))['result'], 'EXECUTOR_ERROR')
        self.assertEqual(validation.integration_result(name, 0, '{}')['result'], 'EXECUTOR_ERROR')

    def test_failure_report_preserves_only_fixed_markers_and_no_raw_error(self):
        name = validation.INTEGRATION_TESTS[0]
        data = {'testResults': [{'assertionResults': [{'title': name, 'status': 'failed',
            'failureMessages': ['never-display-secret [LDJ_PHASE=SESSION_IDENTITY CODE=READ_ONLY_OFF]']}]}]}
        result = validation.integration_result(name, 1, json.dumps(data))
        self.assertEqual(result['phase'], 'SESSION_IDENTITY')
        self.assertEqual(result['code'], 'READ_ONLY_OFF')
        self.assertNotIn('never-display', json.dumps(result))

    def test_hook_failure_is_reported_even_when_assertions_are_skipped(self):
        name = validation.INTEGRATION_TESTS[2]
        data = {'testResults': [{'message': '[LDJ_PHASE=SESSION_IDENTITY CODE=28P01]',
                                'assertionResults': [{'title': name, 'status': 'skipped'}]}]}
        result = validation.integration_result(name, 1, json.dumps(data))
        self.assertEqual(result['code'], '28P01')
        self.assertEqual(result['result'], 'BLOCKED')

    def test_stdout_announcement_is_not_a_query_failure(self):
        name = validation.INTEGRATION_TESTS[0]
        result = validation.integration_result(name, 0, 'JSON report written to /private/output.json')
        self.assertEqual(result['result'], 'EXECUTOR_ERROR')
        self.assertEqual(result['code'], 'REPORT_UNAVAILABLE')

    def test_skipped_test_is_never_an_integration_pass(self):
        name = validation.INTEGRATION_TESTS[0]
        data = {'testResults': [{'assertionResults': [{'title': name, 'status': 'pending'}]}]}
        result = validation.integration_result(name, 0, json.dumps(data))
        self.assertEqual(result['result'], 'NOT_RUN')
        self.assertEqual(validation.integration_status([result] * 4), 'BLOCKED')

    def test_stream_summary_never_copies_arbitrary_output(self):
        output = 'secret-value postgres://secret@host EACCES configLoader'
        summary = validation.stream_summary(output)
        self.assertNotIn('secret', json.dumps(summary))
        self.assertEqual(summary['signals'], ['VITE_CONFIG_WARNING', 'PERMISSION_DENIED'])

    def test_execution_errors_remain_distinct_from_query_failures(self):
        self.assertEqual(validation.integration_status([dict(result='EXECUTOR_ERROR')]), 'EXECUTOR_ERROR')
        self.assertEqual(validation.integration_status([dict(result='FAILED')]), 'FAILED')
        self.assertEqual(validation.integration_status([dict(result='PASSED')] * 4), 'PASSED')

    def test_sql_is_read_only_and_never_restarts_or_restores(self):
        sql = validation.validation_sql()
        self.assertIn('ISOLATION LEVEL REPEATABLE READ READ ONLY', sql)
        self.assertIn('ROLLBACK;', sql)
        self.assertIsNone(re.search(r'\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|COPY|COMMIT|nextval|setval)\b', sql, re.I))
        self.assertEqual(sql.count('AS k, count(*) AS n FROM public.'), 12)
        self.assertIn('HAVING count(*)>1', sql)

    def test_expected_restored_metadata_passes(self):
        self.assertEqual(validation.assess(restored_metadata()), [])

    def test_every_integrity_or_schema_divergence_is_reported(self):
        base = restored_metadata()
        cases = [
            ('counts', dict(base['counts'], matches=0)),
            ('orphans', {'matches.home_team_id': 1}),
            ('duplicates', {'matches.source+provider_key': 2}),
            ('season_competition_mismatches', 1),
            ('standings_season_mismatches', 1),
            ('columns', []), ('constraints_valid', False),
            ('constraint_counts', {}), ('indexes', []), ('archive_sequence', None),
        ]
        for key, value in cases:
            data = copy.deepcopy(base)
            data[key] = value
            with self.subTest(field=key):
                self.assertTrue(validation.assess(data))

    def test_unique_index_requires_the_exact_partial_predicate(self):
        data = restored_metadata()
        data['indexes'][0]['predicate'] = None
        self.assertIn('Índice incompatível: matches', validation.assess(data))


if __name__ == '__main__':
    unittest.main()
