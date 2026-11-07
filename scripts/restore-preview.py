#!/usr/bin/env python3
"""Restore the verified original archive to the explicitly authorized Preview only.

No .env loading. Credentials are requested on a TTY, kept in memory, and passed
through the child environment. No provider calls, migrations runner or agents.
Use --check-only for an offline archive check, --verify-target for a read-only
identity probe, or --restore in a NUC terminal. Errors never print psql stderr,
COPY rows, or connection strings.
"""
import argparse
import getpass
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.parse

REF = "eoroljcefsurgsxegfzp"
ROOT = pathlib.Path(__file__).resolve().parents[1]
BACKUP = pathlib.Path('/home/pablo/backups/linhadejogo/linhadejogo-local-data.dump')
SHA256 = '6e4fd6d79d09178c0ef00ba634c43525f3302ed1354af5bfe93ab9269768ad03'
CA = pathlib.Path('/home/pablo/Downloads/prod-ca-2021-novo.crt')
COUNTS = dict(agent_cache=0, api_calls=500, sports=1, competitions=13,
              evaluation_runs=11, seasons=184, teams=377, matches=50388,
              players=116, predictions=9, squad_entries=116, standings=212,
              sync_state=114)


class RecoveryError(Exception):
    pass


def require(ok, message):
    if not ok:
        raise RecoveryError(message)


def sequence_restart(value, called, increment=1):
    return value + increment if called else value


def archive():
    with BACKUP.open('rb') as handle:
        require(hashlib.file_digest(handle, 'sha256').hexdigest() == SHA256,
                'SHA256 do backup inesperado; interrompido.')
    result = subprocess.run(['pg_restore', '--data-only', '--no-owner',
                             '--no-privileges', '--file=-', str(BACKUP)],
                            capture_output=True, text=True, timeout=120)
    require(result.returncode == 0, 'Não foi possível ler integralmente o backup.')
    # Parse and validate the COPY blocks before any connection or transaction.
    blocks = re.findall(r'^COPY public\.(\w+) \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n',
                        result.stdout, re.M | re.S)
    counts = {}
    for table, _, rows in blocks:
        require(table not in counts, 'Entrada de dados duplicada no arquivo.')
        counts[table] = len(rows.splitlines())
    require(counts == COUNTS, 'Conteúdo/contagens do backup não correspondem à origem.')
    sports = next(rows for table, _, rows in blocks if table == 'sports')
    require(sports.strip().split('\t') == ['1', 'football', 'Futebol'],
            'Registo de futebol no backup inesperado.')
    sequences = re.findall(r"^SELECT pg_catalog.setval\('public\.(\w+)', (\d+), (true|false)\);$",
                           result.stdout, re.M)
    expected_sequences = {t + '_id_seq' for t in COUNTS if t not in ['agent_cache', 'sync_state']}
    expected_sequences.add('archive_external_id_seq')
    require(len(sequences) == 12 and {s[0] for s in sequences} == expected_sequences,
            'Entradas de sequências inesperadas.')
    # Build COPY payload directly from checked blocks; never execute setval or
    # pg_restore-generated session settings. Preserve every original field/ID.
    payload = ''.join(f'COPY public.{table} ({columns}) FROM stdin;\n{rows}\\.\n'
                      for table, columns, rows in blocks if table != 'sports')
    restarts = '\n'.join(
        f'ALTER SEQUENCE public.{name} RESTART WITH '
        f'{sequence_restart(int(value), called == "true")};'
        for name, value, called in sequences)
    return payload, restarts


def connection_environment(raw):
    try:
        u = urllib.parse.urlsplit(raw)
        username = urllib.parse.unquote(u.username or '')
        password = urllib.parse.unquote(u.password or '')
        require(u.scheme in ['postgres', 'postgresql'] and
                u.hostname == 'aws-0-eu-west-1.pooler.supabase.com' and
                u.port == 5432 and username == 'postgres.' + REF and
                urllib.parse.unquote(u.path) == '/postgres' and
                password and not u.query and not u.fragment,
                'A ligação não corresponde ao Session Pooler Preview autorizado.')
    except (ValueError, TypeError):
        raise RecoveryError('Formato da ligação inválido.') from None
    require(CA.is_file(), 'Certificado CA local indisponível.')
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    env.update(PGHOST=u.hostname, PGPORT=str(u.port), PGUSER=username,
               PGPASSWORD=password, PGDATABASE='postgres', PGSSLMODE='verify-full',
               PGSSLROOTCERT=str(CA), PGGSSENCMODE='disable',
               PGCONNECT_TIMEOUT='10', PSQL_HISTORY='/dev/null')
    return env


def psql(sql, env, timeout=60):
    validate_connection_environment(env)
    result = subprocess.run(['psql', '-X', '-w', '-q', '-A', '-t',
                             '-v', 'ON_ERROR_STOP=1'], input=sql,
                            capture_output=True, text=True, env=env, timeout=timeout)
    if result.returncode != 0:
        # Classify locally; never print the original stderr or connection fields.
        error = result.stderr.lower()
        if any(term in error for term in ['password authentication failed', '28p01']):
            category = 'AUTENTICACAO_POSTGRESQL_FALHOU'
        elif any(term in error for term in ['certificate verify failed', 'root certificate',
                                            'does not match host name', 'certificate has expired']):
            category = 'VALIDACAO_CERTIFICADO_TLS_FALHOU'
        elif 'ssl' in error or 'tls' in error:
            category = 'LIGACAO_TLS_FALHOU'
        else:
            category = 'POSTGRESQL_OU_LIGACAO_FALHOU'
        raise RecoveryError(category + '; detalhes originais suprimidos. '
                            'Se a ligação caiu durante COMMIT, auditar antes de repetir.')
    return result.stdout.strip()


def validate_connection_environment(env):
    # Validate the actual child environment, not merely the original URI.
    expected = dict(PGHOST='aws-0-eu-west-1.pooler.supabase.com', PGPORT='5432',
                    PGUSER='postgres.' + REF, PGDATABASE='postgres',
                    PGSSLMODE='verify-full', PGSSLROOTCERT=str(CA),
                    PGGSSENCMODE='disable')
    allowed = set(expected) | {'PGPASSWORD', 'PGCONNECT_TIMEOUT'}
    require(all(env.get(k) == v for k, v in expected.items()) and
            bool(env.get('PGPASSWORD')) and
            not any(k.startswith('PG') and k not in allowed for k in env),
            'Destino ou configuração TLS inesperados; ligação recusada.')


def session_checks(identity):
    return {
        'identidade_postgresql': (identity.get('database') == 'postgres' and
                                  identity.get('user') == 'postgres' and
                                  identity.get('session_user') == 'postgres'),
        'tls_cliente_pooler': identity.get('_client_tls_verified') is True,
        'transacao_read_only': identity.get('read_only') == 'on',
    }


def report_session(identity, env):
    def name(value):
        return value if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,128}', value) else None
    # Explicit allowlist: never serialize the environment or the SQL response.
    print(json.dumps({
        'host': env['PGHOST'], 'port': int(env['PGPORT']),
        'database': name(identity.get('database')), 'utilizador': env['PGUSER'],
        'current_user': name(identity.get('user')),
        'session_user': name(identity.get('session_user')),
        'ssl': identity.get('ssl') if type(identity.get('ssl')) is bool else None,
        'tls_version': name(identity.get('tls_version')),
        'transaction_read_only': identity.get('read_only') if identity.get('read_only') in ['on', 'off'] else None,
        'client_sslmode': 'verify-full',
        'client_tls_verified': identity.get('_client_tls_verified') is True,
        'verificacoes': session_checks(identity),
    }))


def validate_session(identity):
    # SQL does not expose a universal Supabase project_ref. Tenant identity is
    # bound by the authenticated postgres.<ref> login on the TLS-verified pooler;
    # this independent SQL response verifies the resulting backend session.
    checks = session_checks(identity)
    failures = [key for key, ok in checks.items() if not ok]
    require(not failures, 'Validacao da sessao falhou: ' + ', '.join(failures) +
            '. Restauracao bloqueada; nenhuma expectativa foi flexibilizada.')


def read_session(sql, env):
    # psql validates the exact child environment and only returns after libpq
    # has successfully authenticated with verify-full + pinned CA/hostname.
    # Disable GSS encryption so it cannot supersede the required TLS transport.
    # This evidence is created locally, never trusted from server-returned JSON.
    validate_connection_environment(env)
    identity = json.loads(psql(sql, env))
    identity['_client_tls_verified'] = True
    return identity


def verify_target(env):
    identity = read_session("""
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
SELECT json_build_object(
 'database', current_database(), 'user', current_user,
 'session_user', session_user,
 'read_only', current_setting('transaction_read_only'),
 'ssl', (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),
 'tls_version', (SELECT version FROM pg_stat_ssl WHERE pid=pg_backend_pid())
);
ROLLBACK;
""", env)
    report_session(identity, env)
    validate_session(identity)


def count_sql():
    return ' UNION ALL '.join(
        f"SELECT '{t}' AS t, count(*) AS n FROM public.{t}" for t in COUNTS)


def guard_counts():
    checks = []
    for t in COUNTS:
        expected = 1 if t == 'sports' else 0
        checks.append(f"IF (SELECT count(*) FROM public.{t}) <> {expected} THEN "
                      "RAISE EXCEPTION 'Dados existentes ou conflito: restauração recusada'; END IF;")
    checks.append("IF NOT EXISTS (SELECT 1 FROM public.sports WHERE id=1 "
                  "AND code='football' AND name='Futebol') THEN "
                  "RAISE EXCEPTION 'Registo de futebol inesperado'; END IF;")
    return 'DO $guard$ BEGIN ' + '\n'.join(checks) + ' END $guard$;'


def audit(env):
    tables = ','.join("'" + t + "'" for t in COUNTS)
    sql = f"""
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog, public;
SELECT json_build_object(
 'database', current_database(), 'user', current_user,
 'session_user', session_user,
 'read_only', current_setting('transaction_read_only'),
 'ssl', (SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid=pg_backend_pid()),
 'tls_version', (SELECT version FROM pg_catalog.pg_stat_ssl WHERE pid=pg_backend_pid()),
 'counts', (SELECT json_object_agg(t,n) FROM ({count_sql()}) c),
 'sports_ok', (SELECT count(*)=1 AND bool_and(id=1 AND code='football' AND name='Futebol') FROM public.sports),
 'columns', (SELECT json_agg(json_build_object('table',table_name,'name',column_name,
   'type',data_type,'not_null',is_nullable='NO','default',column_default))
   FROM information_schema.columns WHERE table_schema='public' AND table_name IN ({tables})),
 'constraints', (SELECT json_agg(json_build_object('table',c.conrelid::regclass::text,
   'type',c.contype,'definition',pg_catalog.pg_get_constraintdef(c.oid),'valid',c.convalidated))
   FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
   JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname IN ({tables})),
 'triggers', (SELECT count(*) FROM pg_catalog.pg_trigger g
   JOIN pg_catalog.pg_class t ON t.oid=g.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname IN ({tables}) AND NOT g.tgisinternal),
 'rls', (SELECT count(*) FROM pg_catalog.pg_class t JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
   WHERE n.nspname='public' AND t.relname IN ({tables}) AND t.relrowsecurity),
 'archive_sequence_exists', to_regclass('public.archive_external_id_seq') IS NOT NULL
);
ROLLBACK;
"""
    d = read_session(sql, env)
    report_session(d, env)
    validate_session(d)
    require(d['counts'] == {t: int(t == 'sports') for t in COUNTS} and d['sports_ok'],
            'Há dados existentes ou conflito; não repetir/importar por cima.')
    require(d['triggers'] == 0 and d['rls'] == 0,
            'Triggers ou políticas inesperadas exigem revisão antes da carga.')
    origin = json.loads((ROOT / 'scripts/preview-recovery-origin.json').read_text())
    actual = {(c['table'], c['name']): c for c in d['columns']}
    expected = {(t, c['name']): c for t, cols in origin['columns'].items() for c in cols}
    missing = set(expected) - set(actual)
    allowed = {(t, 'provider_key') for t in ['matches', 'teams', 'seasons']}
    require(missing == allowed and not set(actual) - set(expected),
            'Colunas da Preview diferem do estado inicial esperado.')
    for key, col in actual.items():
        e = expected[key]
        require((col['type'], col['not_null']) == (e['type'], e['not_null']),
                'Tipo ou nulabilidade incompatível com a origem.')
        if key[1] == 'id':
            require((col['default'] or '').replace('public.', '') ==
                    f"nextval('{key[0]}_id_seq'::regclass)", 'Default de ID incompatível.')
    constraints = d['constraints'] or []
    def norm(s):
        return re.sub(r'\s+', '', s.replace('public.', '').replace('"', '')).lower()
    definitions = {(c['table'].removeprefix('public.'), norm(c['definition'])) for c in constraints}
    expected_defs = {(t, norm(f'{kind} ({cols})')) for t, kind, cols in origin['keys']}
    expected_defs |= {(t, norm(f'FOREIGN KEY ({cols}) REFERENCES {other}({othercols})'))
                      for t, cols, other, othercols in origin['foreign_keys']}
    require(expected_defs <= definitions and all(c['valid'] for c in constraints) and
            len(constraints) == len(expected_defs) + 1 and
            sum(c['type'] == 'c' for c in constraints) == 1,
            'Chaves/constraints incompatíveis com a origem.')
    require(not d['archive_sequence_exists'], 'Sequência já existente; rever antes de restaurar.')
    return d


def transaction(payload, restarts):
    locks = ', '.join('public.' + t for t in COUNTS)
    migration = (ROOT / 'drizzle/0003_openfootball_archive.sql').read_text()
    checks = []
    for t, n in COUNTS.items():
        checks.append(f"IF (SELECT count(*) FROM public.{t}) <> {n} THEN "
                      "RAISE EXCEPTION 'Contagens restauradas incorretas'; END IF;")
    for t in COUNTS:
        if t not in ['agent_cache', 'sync_state']:
            checks.append(f"IF (SELECT last_value FROM public.{t}_id_seq) <= "
                          f"(SELECT COALESCE(max(id),0) FROM public.{t}) THEN "
                          "RAISE EXCEPTION 'Sequência abaixo dos IDs'; END IF;")
    checks.append("IF NOT EXISTS (SELECT 1 FROM public.sports WHERE id=1 AND code='football' "
                  "AND name='Futebol') THEN RAISE EXCEPTION 'Futebol alterado'; END IF;")
    return ("BEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='180s';\n"
            "SET LOCAL search_path=pg_catalog,public;\n"
            "DO $identity$ BEGIN IF current_database() <> 'postgres' OR "
            "current_user <> 'postgres' OR session_user <> 'postgres' "
            "THEN RAISE EXCEPTION 'Identidade inesperada'; "
            "END IF; END $identity$;\n"
            f"LOCK TABLE {locks} IN ACCESS EXCLUSIVE MODE;\n" + guard_counts() + '\n' +
            migration + '\n' + payload + '\n' + restarts + '\n' +
            'DO $verify$ BEGIN ' + '\n'.join(checks) + ' END $verify$;\n' +
            "COMMIT;\nSELECT 'RECOVERY_COMMITTED';\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check-only', action='store_true')
    mode.add_argument('--verify-target', action='store_true')
    mode.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    if not args.verify_target:
        payload, restarts = archive()
        print(json.dumps({'archive_sha256_ok': True, 'archive_counts': COUNTS}))
    if args.check_only:
        return
    require(sys.stdin.isatty(), 'Executar num terminal interativo para entrada oculta.')
    print('Destino exclusivo: linhadejogo-preview (' + REF + ').')
    raw = getpass.getpass('Connection string Session Pooler Preview (entrada oculta): ')
    env = connection_environment(raw)
    del raw
    if args.verify_target:
        verify_target(env)
        print('PREVIEW_TARGET_VERIFIED_READ_ONLY')
        return
    audit(env)
    print('Preview validada, SSL ativo, estrutura e contagens iniciais compatíveis.')
    output = psql(transaction(payload, restarts), env, timeout=600)
    require('RECOVERY_COMMITTED' in output, 'Commit não confirmado; auditar antes de repetir.')
    report = psql('BEGIN READ ONLY; SELECT json_object_agg(t,n) FROM (' +
                  count_sql() + ') c; ROLLBACK;', env)
    print('RECOVERY_COMMITTED')
    print(report)


if __name__ == '__main__':
    try:
        main()
    except (RecoveryError, OSError, ValueError, subprocess.TimeoutExpired, EOFError):
        # No traceback: arguments, connection fields and COPY data stay private.
        exc = sys.exc_info()[1]
        print(str(exc) if isinstance(exc, RecoveryError) else
              'Operação interrompida; erro de ferramenta, formato ou ligação. '
              'Nenhum detalhe sensível foi exposto.', file=sys.stderr)
        sys.exit(1)
