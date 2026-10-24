"""Validate canonical prompt data, category mirrors, provenance, and purchase assets."""
import hashlib
import json
import pathlib
import re
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'src/prompts'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def require(condition, message):
    if not condition:
        raise AssertionError(message)

def main():
    rows = read(DATA / 'all.json')
    update = read(ROOT / 'src/updates/2026-10-24.json')
    require(len(rows) == update['total_count'], 'Total count disagrees with update manifest')
    added = [row for row in rows if row.get('id') in update['source_ids']]
    require(len(added) == update['added_count'], 'Added IDs missing or duplicated')
    legacy = [row for row in rows if not row.get('id')]
    require(len(legacy) == update['baseline_count'], 'Legacy count changed')
    digest = hashlib.sha256(json.dumps(legacy, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    require(digest == update['baseline_records_sha256'], 'Legacy records changed')
    require(len({row['prompt'] for row in rows}) == len(rows), 'Duplicate prompt text')
    index = {row['id']: row for row in added}
    categories = {category for row in rows for category in row['category']}
    for category in categories:
        require(read(DATA / f'{category}.json') == [r for r in rows if category in r['category']],
                f'Category mirror differs: {category}')
    # Catch stale nonempty category files as well as missing mirrors.
    for path in DATA.glob('*.json'):
        if path.stem not in categories | {'all', 'new'}:
            require(not read(path), f'Orphan category data: {path.name}')
    books = {}
    for row in rows:
        meta = row['metadata']
        for field in ('Book Title', 'Author', 'Publisher', 'Year', 'Cover_filename'):
            require(bool(meta.get(field)), f'Missing book field: {field}')
        require((ROOT / 'src/bookcovers' / meta['Cover_filename']).is_file(), 'Missing book cover')
        links = [meta.get(store, '') for store in ('Kyobo', 'Yes24', 'Aladin')]
        require(any(urlparse(link).scheme in ('http', 'https') and urlparse(link).netloc for link in links),
                'Book has no purchase link')
        books[meta['Book Title']] = meta
    for row in added:
        require(isinstance(row['source']['pdf_page'], int), f"Missing source page: {row['id']}")
        require(not re.search(r'AIza[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}', row['prompt']), 'Credential-like string')
        require('G:\\' not in json.dumps(row, ensure_ascii=False), 'Private source path')
        require(not row['id'].startswith('AST'), 'Unreleased book imported')
        previous = row.get('previous_prompt_ids', [])
        require(row['id'] not in previous, 'Context self-reference')
        for prior_id in previous:
            require(prior_id in index, 'Missing context record')
            require(index[prior_id]['metadata']['Book Title'] == row['metadata']['Book Title'], 'Context crosses books')
            require(index[prior_id]['source']['pdf_page'] <= row['source']['pdf_page'], 'Context order reversed')
    print(f"PASS: {len(rows)} prompts; {len(added)} additions; {len(legacy)} legacy records unchanged; {len(books)} books")
    print(f"PASS: {len(categories)} category mirrors; source/context references; covers and purchase links; credential scan")

if __name__ == '__main__':
    main()
