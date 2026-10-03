"""Read-only V20/V21 data preservation proof on the isolated F01 restore database.

Never accepts service database names. Output contains counts and hashes, not row data.
The schema restore, migration and fixture tests are separate explicit operations.
"""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--compare', type=Path)
args = parser.parse_args()

def sql(statement):
    result = subprocess.run(
        ['docker', 'exec', 'hellow-reporting-db', 'psql', '-X', '-U', 'reporting',
         '-d', 'reporting', '-At', '-v', 'ON_ERROR_STOP=1', '-c', statement],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()

tables = sql("SELECT tablename FROM pg_tables WHERE schemaname='public' "
             "AND tablename<>'flyway_schema_history' ORDER BY tablename").splitlines()
snapshot = {}
for table in tables:
    identifier = '"' + table.replace('"', '""') + '"'
    # Ignore only the newly introduced column; preserve every pre-existing column.
    row = "to_jsonb(r)-'first_accepted_at'" if table == 'queue_items' else 'to_jsonb(r)'
    count, digest = sql(
        f"SELECT count(*),md5(COALESCE(jsonb_agg({row} ORDER BY ({row})::text)::text,'[]')) "
        f"FROM public.{identifier} r"
    ).split('|')
    snapshot[table] = {'count': int(count), 'hash': digest}

proof = {'tables': snapshot, 'flywayVersion': int(sql(
    "SELECT max(version::int) FROM flyway_schema_history WHERE success=true"))}
if args.compare:
    before = json.loads(args.compare.read_text(encoding='utf-8'))
    assert before['tables'] == snapshot, 'Existing row/column counts or hashes changed'
    proof['existingDataPreserved'] = True
    assert sql('SELECT count(*) FROM queue_items WHERE first_accepted_at IS NOT NULL') == '0'
    proof['legacyAcceptanceTimestampsRemainNull'] = True
    proof['reportIndexes'] = int(sql("SELECT count(*) FROM pg_indexes WHERE schemaname='public' "
        "AND indexname IN ('queue_report_period','consultation_report_period','followup_report_period')"))
    assert proof['reportIndexes'] == 3
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(proof, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in proof.items() if k != 'tables'}))
print(f'Preservation snapshot: {len(snapshot)} tables, {args.out}')
