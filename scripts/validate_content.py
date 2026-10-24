"""Check source integrity, generated routes, SEO metadata, assets and page labels."""
import collections
import hashlib
import json
import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, unquote
import xml.etree.ElementTree as ET
from content_model import ROOT, BASE, ORIGIN, load_content, read_json, compatibility_rows, detail_path, is_indexable

def require(condition, message):
    if not condition:
        raise AssertionError(message)

class Page(HTMLParser):
    def __init__(self, raw):
        super().__init__(convert_charrefs=True)
        self.tags=[]; self.ids=set(); self.h1=0; self.scripts=[]; self.active_script=None
        self.title=''; self.in_title=False
        self.bodies={}; self.article_id=None; self.copy_text=None
        self.feed(raw)
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs); self.tags.append((tag,attrs))
        if attrs.get('id'): self.ids.add(attrs['id'])
        if tag=='h1':self.h1+=1
        if tag=='title':self.in_title=True
        if tag=='article':self.article_id=attrs.get('data-prompt-id')
        if tag=='div' and 'data-copy-text' in attrs:self.copy_text=''
        if tag=='script':self.active_script=[attrs,'']
    def handle_endtag(self,tag):
        if tag=='div' and self.copy_text is not None:
            self.bodies[self.article_id]=self.copy_text;self.copy_text=None
        if tag=='title':self.in_title=False
        if tag=='script' and self.active_script:
            self.scripts.append(self.active_script);self.active_script=None
    def handle_data(self,text):
        if self.in_title:self.title+=text
        if self.copy_text is not None:self.copy_text+=text
        if self.active_script:self.active_script[1]+=text
    def meta(self,name):
        return next((a.get('content','') for t,a in self.tags if t=='meta' and (a.get('name')==name or a.get('property')==name)),'')
    def canonical(self):
        return next((a.get('href') for t,a in self.tags if t=='link' and a.get('rel')=='canonical'),None)

def main():
    books,records,groups=load_content()
    integrity=read_json(ROOT/'content/integrity.json')
    require(len(records)==integrity['count'], 'Prompt count differs from integrity manifest')
    require(set(integrity['body_sha256'])=={r['id'] for r in records},'Integrity IDs differ')
    rm={r['id']:r for r in records}
    require(len({r['body'] for r in records})==len(records),'Duplicate prompt text')
    require(len({r['order'] for r in records})==len(records),'Duplicate display order')
    verified=0
    forbidden=('같은 대화 맥락','같은맥락을준비하세요','PDF 페이지','책 구매하기')
    for r in records:
        require(hashlib.sha256(r['body'].encode()).hexdigest()==integrity['body_sha256'][r['id']],f'Prompt changed: {r["id"]}')
        require(r['categories'],'Missing categories')
        require(not any(s in r.get('comment','') for s in forbidden),'Boilerplate in comment')
        require(not any(key in r for key in ('pdf_page','page')),'Unverified viewer page leaked')
        require(not re.search(r'AIza[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}',r['body']),'Credential-like string')
        require('G:\\' not in json.dumps(r,ensure_ascii=False),'Private source path')
        require(not r['id'].startswith('AST'),'Unreleased book imported')
        if r.get('printed_page'):
            verified+=1
            require(r['page_verified'] is True and r['printed_page']>0,'Invalid printed page')
        for previous in r.get('previous_ids',[]):
            require(previous in rm and rm[previous]['group_id']==r['group_id'],'Missing/cross-group sequence')
    for b in books:
        for field in ('title','author','publisher','year','cover'):require(b.get(field),f'Missing book field {field}')
        require((ROOT/'src/bookcovers'/b['cover']).is_file(),'Missing book cover')
        require(any(b['stores'].values()),'Book missing store link')
        for link in b['stores'].values():
            if link:require(urlsplit(link).scheme in ('http','https') and urlsplit(link).netloc,'Invalid store URL')
    require(read_json(ROOT/'src/prompts/all.json')==compatibility_rows(books,records),'Compatibility export stale')
    require([p.name for p in (ROOT/'src/prompts').glob('*.json')]==['all.json'],'Obsolete category mirrors remain')
    manifest=read_json(ROOT/'generated-manifest.json')
    pages={}
    for path in manifest['files']:
        if path.endswith('.html'):
            raw=(ROOT/path).read_text(encoding='utf-8')
            require('@@' not in raw,'Unfilled template')
            require(not any(s in raw for s in ('같은 대화 맥락','책 구매하기','PDF 페이지:')),'Removed UI text remains')
            pages[path]=Page(raw)
    titles=collections.Counter(p.title for p in pages.values())
    require(not [t for t,n in titles.items() if n>1],'Duplicate page title')
    sitemap={e.text for e in ET.parse(ROOT/'sitemap.xml').findall('.//{*}loc')}
    for path,p in pages.items():
        require(p.h1==1,f'H1 count {p.h1}: {path}')
        if path=='404.html':continue
        for prompt_id,body in p.bodies.items():require(body==rm[prompt_id]['body'],f'HTML copy text changed: {path} {prompt_id}')
        url=ORIGIN+BASE+path.removesuffix('index.html')
        require(p.canonical()==url,f'Canonical mismatch: {path}')
        require(bool(p.meta('description')) and bool(p.title),f'Missing title/description: {path}')
        require((url in sitemap)==('noindex' not in p.meta('robots')),f'Sitemap/indexability mismatch: {path}')
        if path!='update_rule/index.html':
            require(p.meta('og:url')==url and p.meta('og:title')==p.title,'Social metadata mismatch')
            payload=next(json.loads(s) for a,s in p.scripts if a.get('id')=='page-data')
            require('records' not in payload,'Full dataset embedded')
        for attrs,text in p.scripts:
            if attrs.get('type') in ('application/json','application/ld+json'):json.loads(text)
        for tag,attrs in p.tags:
            for name in ('href','src'):
                value=attrs.get(name)
                if not value or value.startswith(('#','mailto:','tel:','data:')):continue
                resolved=urlsplit(urljoin(url,value))
                if resolved.netloc!='nanalab.kr' or not resolved.path.startswith(BASE):continue
                local=unquote(resolved.path[len(BASE):])
                target=ROOT/local
                if resolved.path.endswith('/'):target=target/'index.html';local+='index.html'
                require(target.is_file(),f'Broken local link: {path} -> {value}')
                if resolved.fragment and local in pages:
                    require(unquote(resolved.fragment) in pages[local].ids or resolved.fragment=='contact',f'Broken anchor: {value}')
            if 'store-icon' in attrs.get('class','').split():require(attrs.get('aria-label'),'Icon link lacks accessible name')
            if attrs.get('data-prompt-id'):
                r=rm[attrs['data-prompt-id']]
                require(attrs.get('data-printed-page','')==str(r.get('printed_page','')),'Printed page differs from source')
    for gid,turns in groups.items():
        path=detail_path(turns[0])[len(BASE):]+'index.html';p=pages[path]
        require({f'turn-{r["id"].lower()}' for r in turns}<=p.ids,'Missing detail turn')
        require(('noindex' not in p.meta('robots'))==is_indexable(turns),'Thin page indexing rule differs')
    require({ORIGIN+BASE+p.removesuffix('index.html') for p in pages if p!='404.html'}>=sitemap,'Sitemap has missing page')
    print(f'PASS: {len(records)} prompt bodies intact; {len(books)} books; {len(groups)} sequences; {verified} verified printed pages')
    print(f'PASS: {len(pages)} HTML pages; {len(sitemap)} sitemap URLs; canonical, metadata, JSON-LD, links, assets, source labels')

if __name__=='__main__':main()
