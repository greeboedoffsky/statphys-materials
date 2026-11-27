#!/usr/bin/env python3
"""Safely import the old quantum repository. Dry run unless --apply is passed."""
import argparse
from pathlib import Path
import shutil, hashlib
ROOT=Path(__file__).resolve().parents[1]
SHARED={'Базовая часть','Общие дисциплины по выбору'}

def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.digest()

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('old_repo',type=Path);ap.add_argument('--apply',action='store_true');a=ap.parse_args()
    source=a.old_repo.resolve()/'materials'
    if not source.is_dir() or source.is_relative_to(ROOT):raise SystemExit('Specify the old separate quantum repository, containing materials/')
    jobs=[]; conflicts=[]; skipped=0
    for path in sorted(source.rglob('*')):
        if path.is_symlink():raise SystemExit(f'Symlink not allowed: {path}')
        if not path.is_file():continue
        rel=path.relative_to(source)
        if len(rel.parts)<2 or rel.parts[0] not in {'3','4','5','6'}:raise SystemExit(f'Unexpected path: {rel}')
        if any(part.startswith('.') and part!='.gitkeep' for part in rel.parts):continue
        dest=(ROOT/'materials' if len(rel.parts)>=3 and rel.parts[2] in SHARED else ROOT/'departments/quantum/materials')/rel
        if dest.exists():
            if dest.is_file() and digest(path)==digest(dest):skipped+=1
            else:conflicts.append((path,dest))
        else:jobs.append((path,dest))
    if conflicts:
        for p,d in conflicts:print(f'CONFLICT: {p} -> {d}')
        raise SystemExit('No files copied. Resolve conflicts manually, then rerun.')
    for p,d in jobs:
        print(f'{p.relative_to(source)} -> {d.relative_to(ROOT)}')
    print(f'{len(jobs)} new files, {skipped} identical files skipped.')
    if not a.apply:print('Dry run only. Use --apply to copy.');return
    for p,d in jobs:
        d.parent.mkdir(parents=True,exist_ok=True)
        # Exclusive creation prevents overwriting a file even if it appeared after planning.
        with p.open('rb') as src,d.open('xb') as out:shutil.copyfileobj(src,out)
    print('Imported. Original repository untouched.')
if __name__=='__main__':main()
