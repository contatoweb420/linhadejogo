#!/usr/bin/env python3
"""Post-restore validation only: no restore, writes, provider calls or agents run."""
import getpass
import importlib.util
import json
import os
import pathlib
import re
import subprocess
import sys
import uuid
import argparse
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preview_recovery', ROOT / 'scripts/restore-preview.py')
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)
ORIGIN = json.loads((ROOT / 'scripts/preview-recovery-origin.json').read_text())
INTEGRATION_TESTS = [
    'homepage results use restored matches',
    'agent competitions and standings use existing access layer',
    'match and team detail queries preserve restored identity',
    'historical predictions remain readable without recalculation',
]


def stream_summary(text):
    # Allowlisted signals, never a redacted copy of arbitrary process output.
    signals = []
    for needle, label in [('JSON report written to', 'JSON_REPORT_WRITTEN'),
                          ('configLoader', 'VITE_CONFIG_WARNING'),
                          ('Cannot find module', 'MODULE_NOT_FOUND'),
                          ('Unknown option', 'CLI_OPTION_UNSUPPORTED'),
                          ('EACCES', 'PERMISSION_DENIED'), ('EPERM', 'PERMISSION_DENIED'),
                          ('ENOSPC', 'NO_SPACE'), ('ENOENT', 'PATH_NOT_FOUND')]:
        if needle in text:
            signals.append(label)
    return dict(bytes=len(text.encode('utf8')), signals=signals)


def integration_tests(env, enabled=True, names=None):
    child_env = dict(env, LDJ_PREVIEW_VALIDATION='1' if enabled else '0', NEXT_TELEMETRY_DISABLED='1')
    results = []
    for name in INTEGRATION_TESTS if names is None else names:
        fd = None
        try:
            # Vitest 5 writes JSON to a file, not stdout. An inherited memfd
            # supplies an explicit output file without persisting raw messages.
            fd = os.memfd_create('ldj-vitest-report', os.MFD_CLOEXEC)
            os.fchmod(fd, 0o600)
            process_env = dict(child_env, LDJ_VITEST_REPORT_FD=str(fd))
            process = subprocess.run(
                ['node', str(ROOT / 'node_modules/vitest/vitest.mjs'), 'run',
                 '--maxWorkers=1', '--reporter=' + str(ROOT / 'scripts/preview-vitest-reporter.mjs'),
                 '-t', re.escape(name) + '$',
                 'src/server/db/preview-readonly.integration.test.ts'],
                cwd=ROOT, env=process_env, capture_output=True, text=True, timeout=90,
                pass_fds=(fd,))
            os.lseek(fd, 0, os.SEEK_SET)
            raw = os.read(fd, 4 * 1024 * 1024 + 1)
            output = raw.decode('utf8') if len(raw) <= 4 * 1024 * 1024 else ''
            result = integration_result(name, process.returncode, output)
            result.update(executor_exit_code=process.returncode,
                          report_source='anonymous_memory_fd', report_bytes=len(raw),
                          stdout=stream_summary(process.stdout), stderr=stream_summary(process.stderr))
            results.append(result)
        except subprocess.TimeoutExpired as error:
            results.append(dict(test=name, result='EXECUTOR_ERROR', phase='TEST_PROCESS',
                                code='PROCESS_TIMEOUT', executor_exit_code=None,
                                stdout=stream_summary((error.stdout or b'').decode('utf8', errors='replace')
                                                      if isinstance(error.stdout, bytes) else error.stdout or ''),
                                stderr=stream_summary((error.stderr or b'').decode('utf8', errors='replace')
                                                      if isinstance(error.stderr, bytes) else error.stderr or '')))
        except (OSError, UnicodeError):
            results.append(dict(test=name, result='EXECUTOR_ERROR', phase='TEST_PROCESS',
                                code='REPORT_IO_ERROR', executor_exit_code=None))
        finally:
            if fd is not None:
                os.close(fd)
    return results


def integration_result(name, returncode, output):
    # Parse only test statuses and our fixed diagnostic markers. Never persist
    # raw Vitest output, failure messages, SQL, connection fields or stderr.
    result = dict(test=name, result='EXECUTOR_ERROR', phase='TEST_PROCESS', code='REPORT_UNAVAILABLE')
    try:
        data = json.loads(output)
    except ValueError:
        return result
    if not isinstance(data, dict) or not isinstance(data.get('testResults'), list):
        return result
    messages = []
    diagnostics = list(data.get('diagnosticErrors', []))
    found = []
    for file in data.get('testResults', []):
        messages.append(file.get('message', ''))
        diagnostics.extend(file.get('diagnosticErrors', []))
        for assertion in file.get('assertionResults', []):
            if assertion.get('title') == name or assertion.get('fullName', '').endswith(name):
                found.append(assertion.get('status'))
                messages.extend(assertion.get('failureMessages', []))
                diagnostics.extend(assertion.get('diagnosticErrors', []))
    result.update(test_status=found[0] if len(found) == 1 else None,
                  test_body_executed=found[0] in ['passed', 'failed'] if len(found) == 1 else None)
    if returncode == 0 and found == ['passed'] and not diagnostics:
        return dict(test=name, result='PASSED', phase=None, code=None,
                    test_status='passed', test_body_executed=True)
    markers = re.findall(r'\[LDJ_PHASE=(SETUP|SESSION_IDENTITY|HOMEPAGE|AGENT_DATA|MATCH_TEAM|PREDICTIONS) CODE=([A-Z0-9_]{1,64})\]', '\n'.join(messages))
    if diagnostics:
        allowed_phases = {'SETUP', 'SESSION_IDENTITY', 'HOMEPAGE', 'AGENT_DATA', 'MATCH_TEAM', 'PREDICTIONS', 'TEST_PROCESS'}
        safe = []
        for diagnostic in diagnostics:
            phase, code = diagnostic.get('phase'), diagnostic.get('code')
            if phase in allowed_phases and isinstance(code, str) and re.fullmatch('[A-Z0-9_]{1,64}', code):
                frames = [f for f in diagnostic.get('frames', []) if isinstance(f, str) and
                          re.fullmatch(r'src/server/db/preview-readonly\.integration\.test\.ts:\d+:\d+', f)]
                safe.append(dict(phase=phase, code=code, frames=frames[:6]))
        if safe:
            phase = safe[0]['phase']
            result.update(result='EXECUTOR_ERROR' if phase == 'TEST_PROCESS' else
                          'BLOCKED' if phase in ['SETUP', 'SESSION_IDENTITY'] else 'FAILED',
                          phase=phase, code=safe[0]['code'], diagnostics=safe)
            return result
    if markers:
        phase, code = markers[0]
        result.update(result='BLOCKED' if phase in ['SETUP', 'SESSION_IDENTITY'] else 'FAILED',
                      phase=phase, code=code)
    elif returncode == 0 and len(found) == 1 and found[0] in ['skipped', 'pending', 'todo']:
        result.update(result='NOT_RUN', code='TEST_SKIPPED')
    else:
        result['code'] = 'TEST_SETUP_OR_UNCLASSIFIED_FAILURE' if returncode else 'TEST_NOT_FOUND_OR_INCONSISTENT_REPORT'
    return result


def integration_status(results):
    if len(results) == len(INTEGRATION_TESTS) and all(t['result'] == 'PASSED' for t in results):
        return 'PASSED'
    if any(t['result'] == 'EXECUTOR_ERROR' for t in results):
        return 'EXECUTOR_ERROR'
    if any(t['result'] == 'FAILED' for t in results):
        return 'FAILED'
    return 'BLOCKED'


def validation_sql():
    tables = ','.join("'" + t + "'" for t in recovery.COUNTS)
    orphans = []
    for table, column, parent, key in ORIGIN['foreign_keys']:
        assert all(re.fullmatch(r'[a-z_]+', x) for x in [table, column, parent, key])
        orphans.append(f"SELECT '{table}.{column}' AS k, count(*) AS n FROM public.{table} c "
                       f"WHERE c.{column} IS NOT NULL AND NOT EXISTS "
                       f"(SELECT 1 FROM public.{parent} p WHERE p.{key}=c.{column})")
    duplicates = []
    for table, cols in ORIGIN['columns'].items():
        names = {c['name'] for c in cols}
        for column in ['external_id', 'provider_key']:
            if not {'source', column} <= names:
                continue
            duplicates.append(f"SELECT '{table}.source+{column}' AS k, count(*) AS n FROM "
                              f"(SELECT source, {column} FROM public.{table} "
                              f"WHERE {column} IS NOT NULL GROUP BY source,{column} "
                              "HAVING count(*)>1) d")
    return f"""
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL statement_timeout='60s';
SELECT json_build_object(
 'database',current_database(),'user',current_user,'session_user',session_user,
 'read_only',current_setting('transaction_read_only'),
 'ssl',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),
 'tls_version',(SELECT version FROM pg_stat_ssl WHERE pid=pg_backend_pid()),
 'counts',(SELECT json_object_agg(t,n) FROM ({recovery.count_sql()}) q),
 'orphans',(SELECT json_object_agg(k,n) FROM ({' UNION ALL '.join(orphans)}) q),
 'duplicates',(SELECT json_object_agg(k,n) FROM ({' UNION ALL '.join(duplicates)}) q),
 'season_competition_mismatches', (SELECT count(*) FROM public.matches m
   JOIN public.seasons s ON s.id=m.season_id WHERE s.competition_id<>m.competition_id),
 'standings_season_mismatches', (SELECT count(*) FROM public.standings t
   JOIN public.seasons s ON s.id=t.season_id WHERE s.competition_id<>t.competition_id),
 'match_sources',(SELECT json_object_agg(source,n) FROM
   (SELECT CASE WHEN source IN ('football-data.org','openfootball') THEN source ELSE 'other' END AS source,
    count(*) n FROM public.matches GROUP BY 1) q),
 'match_dates',(SELECT json_build_object('oldest',min(utc_date),'newest',max(utc_date)) FROM public.matches),
 'columns',(SELECT json_agg(json_build_object('table',table_name,'name',column_name,
   'type',data_type,'not_null',is_nullable='NO')) FROM information_schema.columns
   WHERE table_schema='public' AND table_name IN ({tables})),
 'constraints_valid',(SELECT bool_and(c.convalidated) FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
   JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname IN ({tables})),
 'constraint_counts',(SELECT json_object_agg(kind,n) FROM
   (SELECT c.contype::text kind,count(*) n FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace ns ON ns.oid=t.relnamespace WHERE ns.nspname='public' AND t.relname IN ({tables})
    GROUP BY c.contype) q),
 'indexes',(SELECT json_agg(json_build_object('table',t.relname,'name',i.relname,
   'unique',x.indisunique,'valid',x.indisvalid,'method',am.amname,
   'columns',(SELECT json_agg(a.attname ORDER BY k.ord) FROM unnest(x.indkey) WITH ORDINALITY k(num,ord)
     JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num WHERE k.ord<=x.indnkeyatts),
   'predicate',pg_get_expr(x.indpred,x.indrelid)))
   FROM pg_index x JOIN pg_class t ON t.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid
   JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_am am ON am.oid=i.relam
   WHERE n.nspname='public' AND i.relname IN
   ('matches_source_provider_key','teams_source_provider_key','seasons_source_provider_key')),
 'archive_sequence',(SELECT json_build_object('type',data_type::text,'start',start_value,
   'increment',increment_by,'min',min_value,'max',max_value,'cache',cache_size,'cycle',cycle)
   FROM pg_sequences WHERE schemaname='public' AND sequencename='archive_external_id_seq')
);
ROLLBACK;
"""


def assess(d):
    failures = []
    if d.get('counts') != recovery.COUNTS:
        failures.append('Contagens diferentes do backup')
    for field in ['orphans', 'duplicates']:
        if not d.get(field) or any(value != 0 for value in d[field].values()):
            failures.append(field)
    for field in ['season_competition_mismatches', 'standings_season_mismatches']:
        if d.get(field) != 0:
            failures.append(field)
    expected = {(t, c['name'], c['type'], c['not_null'])
                for t, cols in ORIGIN['columns'].items() for c in cols}
    actual = {(c['table'], c['name'], c['type'], c['not_null']) for c in d.get('columns', [])}
    if actual != expected:
        failures.append('Colunas/tipos/nulabilidade diferentes da origem')
    if d.get('constraints_valid') is not True:
        failures.append('Constraints não validadas')
    if d.get('constraint_counts') != dict(p=13, u=10, f=12, c=1):
        failures.append('Conjunto de constraints diferente da origem')
    indexes = d.get('indexes') or []
    for t in ['matches', 'teams', 'seasons']:
        matches = [i for i in indexes if i['name'] == t + '_source_provider_key']
        if len(matches) != 1:
            failures.append('Índice ausente: ' + t)
            continue
        i = matches[0]
        predicate = re.sub(r'[\s()"]', '', i.get('predicate') or '').lower()
        if not (i['table'] == t and i['unique'] and i['valid'] and i['method'] == 'btree'
                and i['columns'] == ['source', 'provider_key'] and predicate == 'provider_keyisnotnull'):
            failures.append('Índice incompatível: ' + t)
    sequence = d.get('archive_sequence')
    if sequence != dict(type='bigint', start=900000001, increment=1, min=1,
                        max=9223372036854775807, cache=1, cycle=False):
        failures.append('Definição de archive_external_id_seq incompatível')
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--integration-only', action='store_true',
                        help='Run individual read-only application tests without repeating the database audit.')
    parser.add_argument('--executor-self-test', action='store_true',
                        help='Offline executor test: database integration disabled; no credentials needed.')
    parser.add_argument('--keep-session', action='store_true',
                        help='With --integration-only, retain credentials only in memory for a manual rerun after a fix.')
    args = parser.parse_args()
    recovery.require(not args.keep_session or args.integration_only,
                     '--keep-session exige --integration-only.')
    if args.executor_self_test:
        recovery.require(not args.integration_only, 'Selecionar apenas um modo.')
        env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
        results = integration_tests(env, enabled=False)
        passed = len(results) == 4 and all(r['result'] == 'NOT_RUN' and
                                         r['executor_exit_code'] == 0 for r in results)
        print(json.dumps(dict(executor_self_test='PASSED' if passed else 'FAILED',
                              database_access=False, tests=results), indent=2))
        return int(not passed)
    recovery.require(sys.stdin.isatty(), 'Executar num terminal para entrada oculta.')
    raw = getpass.getpass('Connection string Supabase Preview (entrada oculta): ')
    env = recovery.connection_environment(raw)
    del raw
    if args.integration_only:
        recovery.verify_target(env)
        while True:
            results = integration_tests(env)
            report = dict(project_ref=recovery.REF, recorded_at=datetime.now(timezone.utc).isoformat(),
                          read_only=True, database_audit_repeated=False,
                          application_test_results=results,
                          application_queries=integration_status(results))
            status = save_report(report, report['application_queries'] != 'PASSED')
            if not status or not args.keep_session:
                return status
            choice = input('Sessão apenas em memória. Partilhe REPORT_PATH; após uma correção confirmada, '
                           'Enter repete só os testes; q termina: ').strip()
            if choice:
                return status
    data = recovery.read_session(validation_sql(), env)
    recovery.report_session(data, env)
    recovery.validate_session(data)
    failures = assess(data)
    report = {k: data[k] for k in ['counts', 'orphans', 'duplicates', 'match_sources', 'match_dates',
               'season_competition_mismatches', 'standings_season_mismatches',
               'constraints_valid', 'constraint_counts', 'indexes', 'archive_sequence']}
    report.update(project_ref=recovery.REF, recorded_at=datetime.now(timezone.utc).isoformat(),
                  read_only=True, schema_columns_match=not any('Colunas/' in f for f in failures),
                  failures=failures, application_queries='NOT_RUN')
    if not failures:
        results = integration_tests(env)
        report['application_test_results'] = results
        report['application_queries'] = integration_status(results)
        if report['application_queries'] != 'PASSED':
            failures.append('Consultas reais da aplicação falharam; consultar resultados sanitizados por teste')
    return save_report(report, bool(failures))


def save_report(report, failed):
    report_path = pathlib.Path('/home/pablo/backups/linhadejogo') / ('preview-validation-' + str(uuid.uuid4()) + '.json')
    fd = os.open(report_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        json.dump(report, handle, indent=2)
        handle.write('\n')
    print(json.dumps(report, indent=2))
    print('REPORT_PATH', report_path)
    return int(failed)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (recovery.RecoveryError, OSError, ValueError, subprocess.TimeoutExpired, EOFError):
        exc = sys.exc_info()[1]
        print(str(exc) if isinstance(exc, recovery.RecoveryError) else
              'Validação interrompida; detalhes sensíveis suprimidos. Nenhuma escrita na base.', file=sys.stderr)
        sys.exit(1)
