#!/usr/bin/env python3
"""Build all five archive views together, with one physical copy of each file."""
from pathlib import Path
from urllib.parse import quote
from copy import deepcopy
import argparse, html, json, os, re, shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_site'
COURSES = (3, 4, 5, 6)
SHARED = ('Базовая часть', 'Общие дисциплины по выбору')
SITES = {
    'statphys': ('Статистическая физика', '', 'materials'),
    'quantum': ('Квантовая механика', 'quantum', 'departments/quantum/materials'),
    'math': ('Математическая физика', 'math', 'departments/math/materials'),
    'field': ('Квантовая теория поля', 'field', 'departments/field/materials'),
    'common': ('Общий архив', 'common', 'materials'),
}
ALLOWED = set('pdf djvu djv doc docx odt ppt pptx odp xls xlsx ods txt md tex ipynb py c cpp h csv zip 7z rar tar gz png jpg jpeg webp gif mp3 mp4 wav m4a webm epub'.split())

def urlpath(path):
    return '/'.join(quote(part, safe='') for part in path.parts)

def semname(n):
    return f'{n} семестр — '+('осенний' if n%2 else 'весенний')

def recount(node):
    node['count'] = len(node['files']) + sum(recount(c) for c in node['folders'])
    return node['count']

def scan_tree(base, public):
    def scan(path):
        if path.is_symlink(): raise ValueError(f'Symlink not allowed: {path}')
        rel=path.relative_to(base)
        node={'name':path.name,'path':rel.as_posix(),'folders':[],'files':[],'count':0}
        target=public/rel
        target.mkdir(parents=True,exist_ok=True)
        def key(p):
            m=re.match(r'^(\d+) семестр',p.name)
            return (0,int(m.group(1)),p.name) if m else (1,0,p.name.casefold(),p.name)
        for item in sorted(path.iterdir(),key=key):
            if item.is_symlink(): raise ValueError(f'Symlink not allowed: {item}')
            if item.name.startswith('.'): continue
            if item.is_dir():
                # Shared folders MUST NOT be duplicated in department-specific storage.
                if base != ROOT/'materials' and len(rel.parts)==2 and item.name in SHARED:
                    if any(p.is_file() and p.name!='.gitkeep' for p in item.rglob('*')):
                        raise ValueError(f'Move duplicate shared files to materials/: {item}')
                    continue
                node['folders'].append(scan(item))
            elif item.is_file():
                ext=item.suffix[1:].lower()
                if ext not in ALLOWED:
                    print('Skipped unsupported extension:',item.relative_to(ROOT));continue
                if item.stat().st_size > 100*1024**2: raise ValueError(f'File exceeds 100 MiB: {item}')
                with item.open('rb') as f:
                    if f.read(100).startswith(b'version https://git-lfs.github.com/spec/v1'):raise ValueError(f'Git LFS pointer not supported: {item}')
                shutil.copy2(item,target/item.name)
                node['files'].append({'name':item.name,'type':ext.upper(),'bytes':item.stat().st_size,'public':urlpath((target/item.name).relative_to(OUT))})
        recount(node);return node
    return {str(y):scan(base/str(y)) for y in COURSES}

def common_only(courses):
    result=deepcopy(courses)
    for year in result.values():
        year['files']=[];year['folders']=[s for s in year['folders'] if re.match(r'^\d+ семестр',s['name'])]
        for sem in year['folders']:
            sem['files']=[];sem['folders']=[c for c in sem['folders'] if c['name'] in SHARED]
        recount(year)
    return result

def merge_shared(local, common):
    result=deepcopy(local)
    for year, course in result.items():
        for shared_sem in common[year]['folders']:
            sem=next((s for s in course['folders'] if s['name']==shared_sem['name']),None)
            if sem is None: raise ValueError(f'Missing semester {year}/{shared_sem["name"]}')
            sem['folders']=[c for c in sem['folders'] if c['name'] not in SHARED]+deepcopy(shared_sem['folders'])
            # Baseline first, profile/electives/practice remain clearly separate.
            def priority(c):
                n=c['name'];return (0 if n==SHARED[0] else 1 if n.endswith(' — профильные дисциплины по выбору') else 2 if n==SHARED[1] else 3,n)
            sem['folders'].sort(key=priority)
        recount(course)
    return result

def with_urls(courses,prefix,dept):
    result=deepcopy(courses)
    def visit(node):
        for f in node['files']:
            f['url']=prefix+f.pop('public')
            if dept!='common' and len(node['path'].split('/'))>=3 and node['path'].split('/')[2] in SHARED:f['shared']=True
        for c in node['folders']:visit(c)
    for c in result.values():visit(c)
    return result

def build(repository='',branch='main'):
    if repository and not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repository):raise ValueError('Invalid repository')
    if OUT.exists():shutil.rmtree(OUT)
    OUT.mkdir();shutil.copytree(ROOT/'site',OUT,dirs_exist_ok=True,ignore=shutil.ignore_patterns('index.html'))
    stat=scan_tree(ROOT/'materials',OUT/'materials');common=common_only(stat)
    # Preserve legacy route names for statistical physics; other views share the same source.
    catalogues={'statphys':stat,'common':common}
    for k in ('quantum','math','field'):
        _,path,material=SITES[k]
        catalogues[k]=merge_shared(scan_tree(ROOT/material,OUT/path/'materials'),common)
    template=(ROOT/'site/index.html').read_text()
    assert template.count('__CATALOG_JSON__')==1
    for k,(name,path,material) in SITES.items():
        prefix='../' if path else './'
        urls=[{'id':i,'name':label,'url':prefix+(folder+'/' if folder else '')} for i,(label,folder,_) in SITES.items()]
        data={'department':{'id':k,'name':name},'courses':with_urls(catalogues[k],prefix,k),'archives':urls,'assetPrefix':prefix,'materialRoot':material,'repository':repository,'branch':branch,'upstream':prefix+'common/','sharedSynced':True,'sharedCategories':list(SHARED)}
        serialized=json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
        page=template.replace('__DEPARTMENT_ID__',k).replace('__DEPARTMENT_NAME__',html.escape(name,quote=True)).replace('__ASSET_PREFIX__',prefix).replace('__CATALOG_JSON__',serialized)
        target=OUT/path;target.mkdir(exist_ok=True);(target/'index.html').write_text(page,encoding='utf-8')
        # Also emit the catalogue as JSON for downstream tools (same relative URLs as the page).
        (target/'catalog.json').write_text(serialized,encoding='utf-8')
        print(k, sum(c['count'] for c in data['courses'].values()),'files indexed')
    (OUT/'.nojekyll').touch()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--repository',default=os.getenv('GITHUB_REPOSITORY',''));parser.add_argument('--branch',default=os.getenv('GITHUB_REF_NAME','main'));a=parser.parse_args();build(a.repository,a.branch)
