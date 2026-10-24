"""Canonical publication content. Runtime JSON and HTML are generated, never edited."""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = '/ppp/'
ORIGIN = 'https://nanalab.kr'
CATEGORIES = {
    'prompt_engineering':'Prompt Engineering', 'document':'Document',
    'writing_contents':'Writing/Contents', 'work_productivity':'Work/Productivity',
    'development':'Development', 'science':'Science', 'image':'Image',
    'design':'Design', 'music':'Music', 'education':'Education', 'business':'Business',
    'data':'Data', 'philosophy':'Philosophy', 'finance':'Finance', 'health':'Health',
    'law':'Law', 'living':'Living', 'language':'Language', 'etc':'ETC',
}
STORES = {'Kyobo':('교보문고','kyobo.png'), 'Yes24':('YES24','yes24.png'), 'Aladin':('알라딘','aladin.png')}

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))

def json_text(value, pretty=False):
    return json.dumps(value, ensure_ascii=False, indent=2 if pretty else None,
                      separators=None if pretty else (',', ':')) + '\n'

def stable_id(text):
    return 'p-' + hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]

def title_for(text):
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:64].rstrip() + ('…' if len(text) > 64 else '')

def load_content():
    books = read_json(ROOT / 'content/books.json')
    records = []
    for path in sorted((ROOT / 'content/prompts').glob('*.json')):
        records.extend(read_json(path))
    records.sort(key=lambda r: r['order'])
    book_map = {b['id']:b for b in books}
    record_map = {r['id']:r for r in records}
    if len(book_map) != len(books) or len(record_map) != len(records):
        raise ValueError('Duplicate book or prompt ID')
    if any(not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', b['id']) for b in books):
        raise ValueError('Book ID must be a safe lowercase URL segment')
    if any(not re.fullmatch(r'[A-Za-z0-9-]+', r['id']) for r in records):
        raise ValueError('Prompt ID must be a safe URL segment')
    if len({r['id'].lower() for r in records}) != len(records):
        raise ValueError('Prompt IDs collide in generated URLs')
    groups = {}
    for r in records:
        if r['book_id'] not in book_map or not r['body'].strip():
            raise ValueError(f"Invalid book/body: {r['id']}")
        if any(c not in CATEGORIES for c in r['categories']):
            raise ValueError(f"Unknown category: {r['id']}")
        if r['group_id'] not in record_map:
            raise ValueError(f"Missing group root: {r['id']}")
        if r.get('printed_page') and (not isinstance(r['printed_page'], int) or not r.get('page_verified')):
            raise ValueError(f"Unverified printed page: {r['id']}")
        groups.setdefault(r['group_id'], []).append(r)
    for gid, turns in groups.items():
        turns.sort(key=lambda r: (r['sequence'],r['order']))
        if turns[0]['id'] != gid or len({r['book_id'] for r in turns}) != 1:
            raise ValueError(f'Invalid conversation group: {gid}')
    return books, records, groups

def detail_path(record):
    return f"{BASE}prompts/{record['group_id'].lower()}/"

def record_url(record):
    return detail_path(record) + (f"#turn-{record['id'].lower()}" if record['id'] != record['group_id'] else '')

def is_indexable(turns):
    body = re.sub(r'\s+', '', turns[0]['body'])
    # Context-free one-word replies remain available through their book, without thin search landing pages.
    return len(turns) > 1 or len(body) >= 25 or turns[0].get('indexable', False)

def compatibility_rows(books, records):
    book_map = {b['id']:b for b in books}
    rows = []
    for r in records:
        b = book_map[r['book_id']]
        meta = {'Book Title':b['title'],'Year':b['year'],'Author':b['author'],
                'Publisher':b['publisher'],'Cover_filename':b['cover'], **b['stores']}
        if b.get('isbn'): meta['ISBN'] = b['isbn']
        source = {'id':r['id']}
        if r.get('recipe'): source['recipe'] = r['recipe']
        if r.get('printed_page'): source['printed_page'] = r['printed_page']
        rows.append({'id':r['id'],'category':r['categories'],'prompt':r['body'],'comment':r.get('comment',''),
                     'href':r.get('href',''),'screenshot':r.get('screenshot',''),'metadata':meta,'source':source,
                     'previous_prompt_ids':r.get('previous_ids',[])})
    return rows
