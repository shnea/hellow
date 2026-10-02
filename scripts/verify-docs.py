"""Validate documentation links, requirement coverage and vendored skill hashes."""
from pathlib import Path
from urllib.parse import unquote
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / 'skills/golden-path/references'
IMPECCABLE = ROOT / 'skills/impeccable'
errors = []
files = [ROOT / 'AGENTS.md', ROOT / '요구사항정의서.md']
files += sorted((ROOT / 'docs').rglob('*.md'))
files += sorted((ROOT / 'skills').rglob('*.md'))
links = 0
for path in files:
    content = path.read_text(encoding='utf-8-sig')
    content = re.sub(r'(?ms)^```[^\n]*\n.*?^```\s*$', '', content)
    for target in re.findall(r'\]\(([^)]+)\)', content):
        if re.match(r'^[a-zA-Z][\w+.-]*:', target) or target.startswith('#'):
            continue
        target = unquote(target.split('#', 1)[0].strip('<>'))
        if not target:
            continue
        links += 1
        if not (path.parent / target).exists():
            errors.append(f'{path.relative_to(ROOT)}: missing link {target}')
domains = sorted((REF / 'domains').glob('*.md'))
if len(domains) != 14:
    errors.append(f'Expected 14 domains, found {len(domains)}')
for path in domains:
    if '## 근거와 연결' not in path.read_text(encoding='utf-8-sig'):
        errors.append(f'{path.name}: missing requirements provenance')
source = (ROOT / '요구사항정의서.md').read_text(encoding='utf-8-sig')
chapters = {int(n) for n in re.findall(r'^#{1,2} (\d+)\.', source, re.M)}
index = (REF / 'project-rules.md').read_text(encoding='utf-8-sig')
coverage = set()
for row in re.findall(r'^\| \[\d{2}-[^\n]+', index, re.M):
    coverage.update(map(int, re.findall(r'\d+', row.split('|')[2])))
if chapters != coverage or chapters != set(range(1, 86)):
    errors.append(f'Requirement mapping mismatch: missing={chapters - coverage}, extra={coverage - chapters}')
for name in ('workflow', 'golden-path', 'impeccable'):
    text = (ROOT / 'skills' / name / 'SKILL.md').read_text(encoding='utf-8-sig')
    if not text.startswith(f'---\nname: {name}\ndescription: '):
        errors.append(f'{name}: missing skill metadata')
manifest = json.loads((IMPECCABLE / 'SHA256SUMS.json').read_text(encoding='utf-8'))
upstream_manifest = json.loads((IMPECCABLE / 'UPSTREAM-SHA256SUMS.json').read_text(encoding='utf-8'))
if manifest.keys() != upstream_manifest.keys():
    errors.append('Impeccable local/upstream manifest file lists differ')
for relative, expected in manifest.items():
    path = IMPECCABLE / relative
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        errors.append(f'Impeccable content hash mismatch: {relative}')
    elif relative in upstream_manifest:
        upstream_content = path.read_bytes().replace(b'skills/impeccable', b'.agents/skills/impeccable')
        if hashlib.sha256(upstream_content).hexdigest() != upstream_manifest[relative]:
            errors.append(f'Impeccable upstream provenance mismatch: {relative}')
for name in ('core.md', 'skills.md', 'decisions.md', 'transfer.md', 'skill-management.md'):
    if not (REF / name).is_file():
        errors.append(f'Missing reference: {name}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(files)} Markdown files, {links} local links, 14 domains, 85 requirement chapters, 3 skill metadata blocks, {len(manifest)} Impeccable hashes.')
