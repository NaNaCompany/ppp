"""Import a two-sheet submission into canonical content, then generate and validate."""
import argparse
import hashlib
import pathlib
import re
import subprocess
import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent/'scripts'))
from content_model import ROOT, CATEGORIES, STORES, load_content, read_json, json_text, stable_id, title_for

def normalize_category(value):
    value=str(value).strip().lower().replace('/','_').replace(' ','_')
    return 'education' if value=='edcuation' else value

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file',type=pathlib.Path)
    parser.add_argument('--book-id',help='Required for a new book: lowercase letters, digits and hyphens')
    parser.add_argument('--dry-run',action='store_true')
    args=parser.parse_args()
    import pandas as pd
    sheets=pd.read_excel(args.file,sheet_name=[0,1],header=None)
    def text(value):return '' if pd.isna(value) else str(value).strip()
    metadata={text(row.iloc[0]):text(row.iloc[1]) for _,row in sheets[0].iterrows() if len(row)>1 and text(row.iloc[0])}
    books,records,_=load_content()
    integrity=read_json(ROOT/'content/integrity.json')
    for r in records:
        if hashlib.sha256(r['body'].encode()).hexdigest()!=integrity['body_sha256'].get(r['id']):
            raise ValueError('Existing prompt differs from its integrity hash; review the source first')
    book=next((b for b in books if b['title']==metadata.get('Book Title')),None)
    if book:
        if args.book_id and args.book_id!=book['id']:raise ValueError('Book ID conflicts with existing title')
    else:
        if not args.book_id or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',args.book_id):raise ValueError('New book requires --book-id')
        if any(b['id']==args.book_id for b in books):raise ValueError('Book ID belongs to another title')
        for field in ('Book Title','Author','Publisher','Year','Cover_filename'):
            if not metadata.get(field):raise ValueError(f'Missing metadata: {field}')
        cover=metadata['Cover_filename']
        if pathlib.Path(cover).name!=cover or not (ROOT/'src/bookcovers'/cover).is_file():raise ValueError('Add the cover image before importing')
        book={'id':args.book_id,'title':metadata['Book Title'],'author':metadata['Author'],
              'publisher':metadata['Publisher'],'year':int(float(metadata['Year'])),'cover':cover,
              'stores':{store:metadata.get(store,'') for store in STORES}}
        if not any(book['stores'].values()):raise ValueError('At least one bookstore link is required')
        if metadata.get('ISBN'):book['isbn']=metadata['ISBN'].replace('-','')
        books.append(book)
    known={r['body'] for r in records};new=[];skipped=0
    for _,row in sheets[1].iloc[1:].iterrows():
        if len(row)<2 or pd.isna(row.iloc[1]) or not str(row.iloc[1]).strip():continue
        body=str(row.iloc[1])
        if body in known:skipped+=1;continue
        categories=[normalize_category(c) for c in text(row.iloc[0]).split(',') if c.strip()]
        if not categories or any(c not in CATEGORIES for c in categories):raise ValueError(f'Unknown category: {row.iloc[0]}')
        prompt_id=stable_id(body)
        record={'id':prompt_id,'book_id':book['id'],'group_id':prompt_id,'order':0,'sequence':1,
                'title':title_for(body),'body':body,'categories':list(dict.fromkeys(categories)),
                'comment':text(row.iloc[2]) if len(row)>2 else '',
                'href':text(row.iloc[3]) if len(row)>3 else '',
                'screenshot':text(row.iloc[4]) if len(row)>4 else ''}
        screenshot=record['screenshot']
        if screenshot and (pathlib.Path(screenshot).name!=screenshot or not (ROOT/'src/screenshots'/screenshot).is_file()):
            raise ValueError('Add screenshot assets before importing')
        new.append(record);known.add(body)
    print(f'{len(new)} new prompts; {skipped} duplicates skipped; book={book["id"]}')
    if args.dry_run or not new:return
    first=min((r['order'] for r in records),default=0)-len(new)
    for i,r in enumerate(new):r['order']=first+i
    per_book=[r for r in records if r['book_id']==book['id']]+new
    per_book.sort(key=lambda r:r['order'])
    for r in new:integrity['body_sha256'][r['id']]=hashlib.sha256(r['body'].encode()).hexdigest()
    integrity['count']+=len(new)
    changes={ROOT/'content/books.json':json_text(books,True),ROOT/'content/prompts'/f'{book["id"]}.json':json_text(per_book,True),
             ROOT/'content/integrity.json':json_text(integrity,True)}
    backup={p:p.read_bytes() if p.exists() else None for p in changes}
    try:
        for path,value in changes.items():path.write_text(value,encoding='utf-8')
        for script in ('build_site.py','validate_content.py'):
            subprocess.run([sys.executable,str(ROOT/'scripts'/script)],cwd=ROOT,check=True)
    except Exception:
        for path,value in backup.items():
            if value is None:path.unlink(missing_ok=True)
            else:path.write_bytes(value)
        subprocess.run([sys.executable,str(ROOT/'scripts/build_site.py')],cwd=ROOT,check=True)
        raise

if __name__=='__main__':main()
