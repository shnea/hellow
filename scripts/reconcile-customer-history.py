"""Validate the customer association repair on a restored database; --apply also repairs dev.

No content or ownership is rewritten. The backup and restored database are retained.
"""
import argparse, datetime, hashlib, json, pathlib, subprocess, time

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB_CONTAINER = 'hellow-dev-db-1'
TABLES = ['customers', 'queue_items', 'consultations', 'timeline_items', 'follow_up_actions',
          'consultation_revisions', 'memberships', 'membership_permissions', 'membership_roles',
          'organization_roles', 'role_grants', 'work_transfers', 'work_transfer_events']
ALLOWED = {'customers': ['registered'], 'queue_items': ['customer_code', 'registered', 'version'],
           'consultations': ['customer_code', 'version'], 'timeline_items': ['customer_code'],
           'follow_up_actions': ['customer_code', 'version']}

def run(*args, data=None):
    result = subprocess.run(args, input=data, capture_output=True, cwd=ROOT)
    if result.returncode:
        raise RuntimeError('Command failed: ' + ' '.join(args[:3]) + '\n' + result.stderr.decode(errors='replace')[-1500:])
    return result.stdout

def sql(db, query):
    return run('docker', 'exec', '-i', DB_CONTAINER, 'psql', '-U', 'hellow', '-d', db,
               '-v', 'ON_ERROR_STOP=1', '-At', data=query.encode()).decode().strip()

def snapshot(db, customer_max, protected=True):
    result = {}
    for table in TABLES:
        value = 'to_jsonb(r)'
        if protected:
            value += ''.join("-'" + field + "'" for field in ALLOWED.get(table, []))
        where = ' where id<=' + customer_max if table == 'customers' and protected else ''
        result[table] = sql(db, 'select count(*)||\':\'||md5(coalesce(jsonb_agg(' + value +
                            ' order by (' + value + ")::text)::text,'[]')) from " + table + ' r' + where)
    return result

def associations(db):
    return {table: sql(db, "select md5(coalesce(jsonb_agg(jsonb_build_array(id,customer_code) order by id)::text,'[]')) from " + table)
            for table in ['queue_items', 'consultations', 'timeline_items', 'follow_up_actions']}

def repair(db):
    sql(db, 'BEGIN;\n' + (ROOT / 'scripts/reconcile-customer-history.sql').read_text(encoding='utf-8') + '\nCOMMIT;')

def no_active():
    assert sql('hellow', "select count(*) from queue_items where type='CALL' and status='PROCESSING' and not call_ended") == '0', 'Active call; postpone repair'
    assert sql('hellow', "select count(*) from work_transfers where status in ('OFFERED','CONNECTING')") == '0', 'Active transfer; postpone repair'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    restored = 'hellow_customer_repair_' + stamp
    compose = ['docker', 'compose', '--env-file', '.env.dev']
    stopped = False
    try:
        if args.apply:
            no_active()
            run(*compose, 'stop', 'nginx', 'api'); stopped = True
            no_active()
        dump = run('docker', 'exec', DB_CONTAINER, 'pg_dump', '-U', 'hellow', '-d', 'hellow', '-Fc')
        backup = ROOT / 'output/backups' / ('customer-repair-' + stamp + '.dump')
        backup.parent.mkdir(parents=True, exist_ok=True); backup.write_bytes(dump)
        run('docker', 'exec', DB_CONTAINER, 'createdb', '-U', 'hellow', restored)
        run('docker', 'exec', '-i', DB_CONTAINER, 'pg_restore', '-U', 'hellow', '-d', restored, '--no-owner', '--exit-on-error', data=dump)
        maximum = sql(restored, 'select coalesce(max(id),0) from customers')
        before = snapshot(restored, maximum)
        counts_before = {t: int(sql(restored, 'select count(*) from ' + t)) for t in TABLES[:5]}
        repair(restored)
        assert snapshot(restored, maximum) == before, 'Protected original content/scope changed'
        once = snapshot(restored, maximum, False); links = associations(restored)
        repair(restored)
        assert snapshot(restored, maximum, False) == once, 'Repair is not idempotent'
        print('Restored database repair preserves original content and ownership; repeated execution is unchanged.', flush=True)
        if args.apply:
            assert snapshot('hellow', maximum) == before, 'Live rows changed during repair preparation'
            repair('hellow')
            assert snapshot('hellow', maximum) == before
            assert associations('hellow') == links
        target = 'hellow' if args.apply else restored
        proof = {'applied': args.apply, 'backup': str(backup), 'sha256': hashlib.sha256(dump).hexdigest(),
                 'restoredDatabase': restored, 'protectedRows': before, 'countsBefore': counts_before,
                 'countsAfter': {t: int(sql(target, 'select count(*) from ' + t)) for t in TABLES[:5]},
                 'unlinkedSaved': int(sql(target, 'select count(*) from queue_items q join consultations r on r.organization_id=q.organization_id and r.queue_code=q.code where q.customer_code is null'))}
        (ROOT / 'output' / ('customer-repair-' + stamp + '.json')).write_text(json.dumps(proof, indent=2), encoding='utf-8')
        print(json.dumps({k: proof[k] for k in ['applied', 'countsBefore', 'countsAfter', 'unlinkedSaved']}), flush=True)
    finally:
        if stopped:
            run(*compose, 'start', 'api')
            for _ in range(60):
                if run('docker', 'inspect', '--format', '{{.State.Health.Status}}', 'hellow-dev-api-1').strip() == b'healthy': break
                time.sleep(2)
            else: raise RuntimeError('API health failed; nginx remains stopped and backup retained')
            run(*compose, 'start', 'nginx')
            run('docker', 'exec', 'hellow-dev-nginx-1', 'nginx', '-s', 'reload')

if __name__ == '__main__':
    main()
