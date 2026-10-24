"""Generate crawlable pages and immutable, on-demand data from canonical content."""
import argparse
import collections
import hashlib
import html
import json
import math
import pathlib
import re
import sys
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape
from content_model import (ROOT, BASE, ORIGIN, CATEGORIES, STORES, load_content,
                           json_text, detail_path, record_url, is_indexable, compatibility_rows)

PAGE_SIZE = 20
LASTMOD = '2026-10-24'
OUTPUTS = {}

def esc(value):
    return html.escape(str(value), quote=True)

def prompt_html(value):
    # Preserve every copied character while keeping source lines free of trailing whitespace.
    return re.sub(r'[ \t]+(?=\n|$)', lambda m: ''.join('&#32;' if c==' ' else '&#9;' for c in m[0]), esc(value))

def safe_json(value):
    return json_text(value).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')

def asset(path):
    return BASE + quote(path, safe='/')

def emit(path, content):
    OUTPUTS[path] = content.encode('utf-8') if isinstance(content,str) else content

def fingerprint(stem, data, extension):
    raw = data.encode('utf-8') if isinstance(data,str) else data
    path = f'src/generated/{stem}.{hashlib.sha256(raw).hexdigest()[:12]}.{extension}'
    emit(path, raw)
    return BASE + path

def store_links(book):
    links = []
    for store,(name,filename) in STORES.items():
        if not book['stores'].get(store): continue
        links.append(f'<a class="store-icon" href="{esc(book["stores"][store])}" target="_blank" rel="noopener noreferrer" aria-label="{name} 도서 보기"><img src="{asset("src/store_logo/"+filename)}" width="28" height="28" alt=""></a>')
    return '<div class="store-links" aria-label="도서 서점 링크">' + ''.join(links) + '</div>'

def page_label(record):
    return f'본문 {record["printed_page"]}p.' if record.get('page_verified') and record.get('printed_page') else ''

def book_panel(book, record=None):
    label = page_label(record) if record else ''
    return f'''<aside class="book-panel">
    <img class="book-panel-cover" src="{asset('src/bookcovers/'+book['cover'])}" alt="{esc(book['title'])} 표지" width="150" height="210" loading="lazy">
    <div><h2><a href="{BASE}books/{book['id']}/">{esc(book['title'])}</a></h2>
    <p>{esc(book['author'])}</p><p>{book['year']} · {esc(book['publisher'])}</p>
    {f'<p class="source-page">{label}</p>' if label else ''}{store_links(book)}</div></aside>'''

def tags(categories):
    return '<div class="prompt-tags">' + ' '.join(f'<a class="hashtag" href="{BASE}categories/{c}/">#{esc(CATEGORIES[c])}</a>' for c in categories) + '</div>'

def card(record, book, group, detail=False, step=1):
    label = page_label(record)
    screen = f'<img src="{asset("src/screenshots/"+record["screenshot"])}" class="card-screenshot" alt="{esc(record["title"])} 예시" loading="lazy">' if record.get('screenshot') and (ROOT/'src/screenshots'/record['screenshot']).is_file() else ''
    title = f'입력 {step}' if detail else record['title']
    heading = esc(title) if detail else f'<a href="{record_url(record)}">{esc(title)}</a>'
    return f'''<article class="prompt-card" id="turn-{record['id'].lower()}" data-prompt-id="{record['id']}" data-book-id="{record['book_id']}" data-group-id="{record['group_id']}" data-printed-page="{record.get('printed_page','')}" tabindex="0" aria-label="{esc(record['title'])}">
    <h2 class="prompt-title">{heading}</h2>{screen}
    <div class="prompt-text" data-copy-text>{prompt_html(record['body'])}</div>{tags(record['categories'])}
    <div class="card-actions"><button type="button" class="source-button" data-open-source hidden>복사·출처</button>
    {f'<a href="{record_url(record)}">입력 {len(group)}개 · 상세 보기</a>' if not detail else ''}</div>
    {f'<p class="card-comment">{esc(record["comment"])}</p>' if record.get('comment') else ''}
    <p class="card-footer"><a href="{BASE}books/{book['id']}/">{esc(book['title'])}</a> ({book['year']}){f' · {label}' if label else ''}</p></article>'''

def pagination(prefix, page, count):
    if count <= 1: return ''
    def url(number): return BASE + prefix + (f'page/{number}/' if number > 1 else '')
    links = []
    if page > 1: links.append(f'<a href="{url(page-1)}" rel="prev">이전</a>')
    for number in sorted({1,count,*range(max(1,page-2),min(count,page+2)+1)}):
        links.append(f'<a href="{url(number)}"'+(' aria-current="page"' if number==page else '')+f'>{number}</a>')
    if page < count: links.append(f'<a href="{url(page+1)}" rel="next">다음</a>')
    return '<nav class="pagination" aria-label="목록 페이지">' + ''.join(links) + '</nav>'

def build_outputs():
    OUTPUTS.clear()
    books, records, groups = load_content()
    bm = {b['id']:b for b in books}
    ordered = sorted(groups, key=lambda gid:min(r['order'] for r in groups[gid]))
    counts = collections.Counter(c for r in records for c in r['categories'])
    category_order = sorted(counts, key=lambda c:(-counts[c],c))
    style_url = fingerprint('site', (ROOT/'style.css').read_text(encoding='utf-8'), 'css')
    script_text = '/* Generated: edit src/js/portal.js and src/js/contact.js. */\n' + '\n'.join((ROOT/'src/js'/name).read_text(encoding='utf-8') for name in ('portal.js','contact.js'))
    script_url = fingerprint('site', script_text, 'js')
    emit('script.js', script_text)
    group_urls = {gid:fingerprint('data/'+gid.lower(),json_text({'book_id':turns[0]['book_id'],'records':turns}), 'json') for gid,turns in groups.items()}
    search = [{'id':gid,'title':groups[gid][0]['title'],'url':detail_path(groups[gid][0]),
               'book':bm[groups[gid][0]['book_id']]['title'],
               'categories':sorted({c for r in groups[gid] for c in r['categories']}),
               'text':'\n'.join(r['body'] for r in groups[gid])} for gid in ordered]
    search_url = fingerprint('search', json_text(search), 'json')
    catalog = {'total_prompts':len(records),'total_recipes':len(groups),'book_count':len(books),
               'categories':dict(counts),'search_url':search_url}
    fingerprint('catalog',json_text(catalog),'json')
    template = (ROOT/'templates/base.html').read_text(encoding='utf-8')
    sitemap = []

    def render(path, title, description, content, group_ids=(), active='', crumbs=(), indexable=True, structured=None, image=None):
        canonical = ORIGIN + BASE + path
        selected_books = {groups[gid][0]['book_id'] for gid in group_ids}
        payload = {'books':{bid:bm[bid] for bid in sorted(selected_books)},
                   'groups':{gid:group_urls[gid] for gid in group_ids}, 'search_url':search_url, 'base':BASE}
        nav = f'<li><a href="{BASE}"'+(' class="active"' if active=='new' else '')+'>New</a></li>'
        nav += f'<li><a href="{BASE}prompts/"'+(' class="active"' if active=='all' else '')+'>ALL</a></li>'
        for cat in category_order:
            nav += f'<li><a href="{BASE}categories/{cat}/"'+(' class="active"' if active==cat else '')+f'>{esc(CATEGORIES[cat])}</a></li>'
        breadcrumb = '<nav class="breadcrumbs" aria-label="현재 위치"><a href="/ppp/">PPP</a>' + ''.join(f' <span aria-hidden="true">/</span> <a href="{esc(url)}">{esc(name)}</a>' for name,url in crumbs) + '</nav>' if crumbs else ''
        search_form = f'<form class="search-form" action="{BASE}search/" method="get" role="search"><label for="portal-search">프롬프트 검색</label><input id="portal-search" name="q" type="search" placeholder="프롬프트·책·주제 검색"><button type="submit">검색</button></form>'
        main = f'''<div id="main-content-wrapper"><div class="announcement-bar"><p>도서로 출간된 프롬프트만 모았습니다! 믿고 사용하세요!</p></div>
        <nav class="categories-nav" aria-label="프롬프트 분류"><div class="container nav-wrapper"><button class="nav-btn" id="nav-prev" aria-label="이전 분류">&lt;</button><ul id="categories-list">{nav}</ul><button class="nav-btn" id="nav-next" aria-label="다음 분류">&gt;</button></div></nav>
        <main class="site-content"><div class="container">{breadcrumb}{search_form}{content}</div></main></div>
        <script id="page-data" type="application/json">{safe_json(payload)}</script>'''
        image = image or BASE+'src/assets/og-image.png'
        meta = f'''<link rel="canonical" href="{esc(canonical)}"><meta name="robots" content="{'index,follow' if indexable else 'noindex,follow'}">
        <meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{esc(canonical)}"><meta property="og:image" content="{ORIGIN}{esc(image)}"><meta property="og:locale" content="ko_KR">
        <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)}"><meta name="twitter:description" content="{esc(description)}"><meta name="twitter:image" content="{ORIGIN}{esc(image)}"><link rel="sitemap" type="application/xml" href="{ORIGIN}{BASE}sitemap.xml">'''
        schemas = []
        if crumbs:
            schemas.append({'@context':'https://schema.org','@type':'BreadcrumbList','itemListElement':
                [{'@type':'ListItem','position':i+1,'name':name,'item':ORIGIN+url} for i,(name,url) in enumerate([('PPP',BASE),*crumbs])]})
        if structured: schemas.append(structured)
        if schemas: meta += '<script type="application/ld+json">'+safe_json(schemas)+'</script>'
        rendered = template
        if structured:
            rendered = rendered.replace('<body>', '<body class="detail-page">')
        for key,value in {'MAIN_CONTENT':main,'TITLE':esc(title),'DESCRIPTION':esc(description),'META':meta,
                          'STYLE_URL':style_url,'SCRIPT_URL':script_url,'COUNT':str(len(records))}.items():
            rendered = rendered.replace('@@'+key+'@@',value)
        rendered = rendered.replace('</footer>',f'<p class="sitemap-link"><a href="{BASE}sitemap.xml">사이트맵</a></p></footer>')
        rendered = re.sub(r'(?m)^[ \t]+$', '', rendered)
        emit(path+'index.html', rendered)
        if indexable: sitemap.append(canonical)

    def listing(prefix, group_ids, title, description, active, crumbs=(), book=None):
        pages = max(1,math.ceil(len(group_ids)/PAGE_SIZE))
        for page in range(1,pages+1):
            subset = group_ids[(page-1)*PAGE_SIZE:page*PAGE_SIZE]
            content = f'<section class="page-intro"><h1>{esc(title)}</h1><p>{esc(description)}</p><p>{len(group_ids)}개 레시피 · {sum(len(groups[g]) for g in group_ids)}개 입력</p></section>'
            if book and page==1: content += book_panel(book)
            content += '<div id="prompts-grid" class="prompts-grid">'+''.join(card(groups[g][0],bm[groups[g][0]['book_id']],groups[g]) for g in subset)+'</div>'
            content += pagination(prefix,page,pages)
            path=prefix+(f'page/{page}/' if page>1 else '')
            render(path, title+('' if page==1 else f' · {page}페이지')+' | PPP',description,content,subset,active,crumbs)

    listing('',ordered[:10],'최근 추가된 프롬프트',f'{len(books)}권에 수록된 {len(records)}개 입력 중 최근 추가된 프롬프트입니다. 전체 목록과 분류·도서별 페이지에서 모든 본문을 읽을 수 있습니다.','new')
    listing('prompts/',ordered,'전체 프롬프트',f'출간 도서 {len(books)}권의 프롬프트와 대화 레시피를 모았습니다.','all',[('전체 프롬프트',BASE+'prompts/')])
    for cat in category_order:
        gids=[g for g in ordered if any(cat in r['categories'] for r in groups[g])]
        listing('categories/'+cat+'/',gids,CATEGORIES[cat]+' 프롬프트',f'{CATEGORIES[cat]}에 활용할 수 있는 출간 도서의 프롬프트와 출처입니다.',cat,[(CATEGORIES[cat],BASE+'categories/'+cat+'/')])
    for book in books:
        gids=[g for g in ordered if groups[g][0]['book_id']==book['id']]
        listing('books/'+book['id']+'/',gids,book['title'],f'{book["author"]} · {book["publisher"]} · {book["year"]}. 이 책에 수록된 프롬프트와 서지정보입니다.','', [('도서',BASE+'books/'),(book['title'],BASE+'books/'+book['id']+'/')],book)
    book_cards=''.join(f'<article class="book-list-card">{book_panel(b)}<p>{sum(r["book_id"]==b["id"] for r in records)}개 입력</p></article>' for b in books)
    render('books/','출처 도서 | PPP',f'프롬프트 출처 도서 {len(books)}권의 저자·출판사·서점 링크입니다.', '<section class="page-intro"><h1>출처 도서</h1></section><div class="book-list">'+book_cards+'</div>',crumbs=[('도서',BASE+'books/')])
    for gid in ordered:
        turns=groups[gid];root=turns[0];book=bm[root['book_id']]
        description=f'{book["title"]}에 수록된 프롬프트입니다. 입력 {len(turns)}개와 출처 도서 정보를 제공합니다. '+root['title']
        content=f'<section class="page-intro"><h1>{esc(root["title"])}</h1><p><a href="{BASE}books/{book["id"]}/">{esc(book["title"])}</a> · 입력 {len(turns)}개</p></section>'
        content+='<div id="prompts-grid" class="prompts-grid">'+''.join(card(r,book,turns,True,i+1) for i,r in enumerate(turns))+'</div>'+book_panel(book,root)
        related=[g for g in ordered if g!=gid and groups[g][0]['book_id']==book['id']][:3]
        if related:content+='<nav class="related-prompts" aria-label="같은 책의 다른 프롬프트"><h2>같은 책의 다른 프롬프트</h2><ul>'+''.join(f'<li><a href="{detail_path(groups[g][0])}">{esc(groups[g][0]["title"])}</a></li>' for g in related)+'</ul></nav>'
        schema={'@context':'https://schema.org','@type':'CreativeWork','name':root['title'],'inLanguage':'ko',
                'text':'\n\n'.join(r['body'] for r in turns),'url':ORIGIN+detail_path(root),
                'isPartOf':{'@type':'Book','name':book['title'],'url':ORIGIN+BASE+'books/'+book['id']+'/',
                            'author':[{'@type':'Person','name':name.strip()} for name in book['author'].split(',')],
                            'publisher':{'@type':'Organization','name':book['publisher']}}}
        if book.get('isbn'):schema['isPartOf']['isbn']=book['isbn']
        duplicate_title = sum(groups[g][0]['title']==root['title'] and groups[g][0]['book_id']==root['book_id'] for g in ordered)>1
        page_title = root['title']+' | '+book['title']+(f' · {gid}' if duplicate_title else '')+' | PPP'
        render('prompts/'+gid.lower()+'/',page_title,description,content,[gid],crumbs=[('전체 프롬프트',BASE+'prompts/'),(root['title'],detail_path(root))],indexable=is_indexable(turns),structured=schema,image=asset('src/bookcovers/'+book['cover']))
    render('search/','프롬프트 검색 | PPP','출간 도서의 프롬프트·책·주제를 검색합니다.', '<section class="page-intro"><h1>프롬프트 검색</h1><p id="search-status" aria-live="polite">검색어를 입력하세요.</p><noscript>검색 기능에는 JavaScript가 필요합니다. <a href="/ppp/prompts/">전체 목록</a>이나 분류·도서 링크로 모든 본문을 읽을 수 있습니다.</noscript></section><div id="search-results" class="search-results"></div>',indexable=False)
    guide = (ROOT/'templates/submission.html').read_text(encoding='utf-8')
    guide = guide.replace('@@COUNT@@',str(len(records))).replace('@@STYLE_URL@@',style_url)
    emit('update_rule/index.html',guide)
    sitemap.append(ORIGIN+BASE+'update_rule/')
    emit('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'<url><loc>{xml_escape(url)}</loc><lastmod>{LASTMOD}</lastmod></url>\n' for url in sorted(set(sitemap)))+'</urlset>\n')
    emit('.nojekyll','')
    emit('404.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="robots" content="noindex"><title>페이지를 찾을 수 없습니다 | PPP</title><h1>페이지를 찾을 수 없습니다</h1><p><a href="/ppp/">PPP로 돌아가기</a></p></html>\n')
    emit('src/prompts/all.json',json_text(compatibility_rows(books,records),True))
    return {'prompts':len(records),'books':len(books),'recipes':len(groups),'indexable_recipes':sum(is_indexable(g) for g in groups.values()),'sitemap_urls':len(set(sitemap))}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    stats=build_outputs();manifest_path=ROOT/'generated-manifest.json'
    previous=read_manifest(manifest_path)
    stale=set(previous)-set(OUTPUTS)
    changed=[path for path,raw in OUTPUTS.items() if not (ROOT/path).is_file() or (ROOT/path).read_bytes()!=raw]
    expected=json_text({'files':sorted(OUTPUTS),'stats':stats},True).encode()
    if args.check:
        if changed or stale or not manifest_path.exists() or manifest_path.read_bytes()!=expected:
            print(f'FAIL: {len(changed)} changed/missing; {len(stale)} stale generated files');sys.exit(1)
        print('PASS: generated HTML, hashed assets/data and sitemap are current');return
    for path,raw in OUTPUTS.items():
        target=(ROOT/path).resolve()
        if not target.is_relative_to(ROOT):raise ValueError('Output escapes repository')
        target.parent.mkdir(parents=True,exist_ok=True)
        if path in changed:target.write_bytes(raw)
    for path in stale:
        target=(ROOT/path).resolve()
        if target.is_relative_to(ROOT) and target.is_file():target.unlink()
    manifest_path.write_bytes(expected)
    print(json.dumps({**stats,'generated_files':len(OUTPUTS),'written':len(changed)},ensure_ascii=False))

def read_manifest(path):
    return json.loads(path.read_text(encoding='utf-8')).get('files',[]) if path.exists() else []

if __name__=='__main__':main()
