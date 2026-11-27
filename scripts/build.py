#!/usr/bin/env python3
"""Build a self-contained static catalogue from materials/. No dependencies."""
from pathlib import Path
from urllib.parse import quote
import argparse
import json
import os
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
COURSES = (3, 4, 5, 6)
ALLOWED = {'.pdf', '.djvu', '.djv', '.doc', '.docx', '.odt', '.ppt', '.pptx', '.odp', '.xls', '.xlsx', '.ods', '.txt', '.md', '.tex', '.ipynb', '.py', '.c', '.cpp', '.h', '.csv', '.zip', '.7z', '.rar', '.tar', '.gz', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.mp4', '.wav', '.m4a', '.webm', '.epub'}


def urlpath(path):
    return '/'.join(quote(part, safe='') for part in path.parts)


def build(out, repository='', branch='main'):
    out = out.resolve()
    if out != ROOT / '_site':
        raise ValueError('Build output must be the project _site directory')
    if out.exists():
        shutil.rmtree(out)
    out.mkdir()
    shutil.copytree(ROOT / 'site', out, dirs_exist_ok=True)
    base = ROOT / 'materials'
    if repository and not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid repository; expected owner/name')
    ignored = []

    def scan(path):
        if path.is_symlink():
            raise ValueError(f'Symlink not permitted: {path}')
        relative = path.relative_to(base)
        target = out / 'materials' / relative
        target.mkdir(parents=True, exist_ok=True)
        node = {'name': path.name, 'path': relative.as_posix(), 'folders': [], 'files': [], 'count': 0}
        def sort_key(item):
            # Keep the two semesters in chronological order (including 9 → 10).
            if len(relative.parts) == 1:
                match = re.fullmatch(r'(\d+) семестр — (осенний|весенний)', item.name)
                if match and item.is_dir():
                    return (0, int(match.group(1)), item.name.casefold(), item.name)
            return (1, 0, item.name.casefold(), item.name)

        for item in sorted(path.iterdir(), key=sort_key):
            if item.name.startswith('.'):
                continue
            if item.is_symlink():
                raise ValueError(f'Symlink not permitted: {item}')
            if item.is_dir():
                node['folders'].append(scan(item))
            elif item.is_file():
                if item.suffix.lower() not in ALLOWED:
                    ignored.append(str(item.relative_to(ROOT)))
                    continue
                if item.stat().st_size > 100 * 1024**2:
                    raise ValueError(f'File exceeds 100 MiB: {item}')
                with item.open('rb') as stream:
                    if stream.read(100).startswith(b'version https://git-lfs.github.com/spec/v1'):
                        raise ValueError(f'Git LFS pointer not supported: {item}')
                shutil.copy2(item, target / item.name)
                node['files'].append({'name': item.name, 'type': item.suffix[1:].upper(), 'bytes': item.stat().st_size, 'url': urlpath(item.relative_to(ROOT))})
        node['count'] = len(node['files']) + sum(child['count'] for child in node['folders'])
        return node

    courses = {}
    for course in COURSES:
        folder = base / str(course)
        if not folder.is_dir():
            raise ValueError(f'Missing course folder: {folder}')
        courses[str(course)] = scan(folder)
    payload = {'courses': courses, 'repository': repository, 'branch': branch}
    data = json.dumps(payload, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    template = (out / 'index.html').read_text(encoding='utf-8')
    marker = '__CATALOG_JSON__'
    if template.count(marker) != 1:
        raise ValueError('Catalogue marker missing or duplicated')
    (out / 'index.html').write_text(template.replace(marker, data), encoding='utf-8')
    (out / '.nojekyll').touch()
    for item in ignored:
        print(f'Skipped unsupported extension: {item}')
    print(f'Built {sum(x["count"] for x in courses.values())} files in {out}')
    return payload


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', default=os.getenv('GITHUB_REPOSITORY', ''))
    parser.add_argument('--branch', default=os.getenv('GITHUB_REF_NAME', 'main'))
    args = parser.parse_args()
    build(ROOT / '_site', args.repository, args.branch)
