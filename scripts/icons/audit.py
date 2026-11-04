#!/usr/bin/env python3
"""Read source roots without entering generated builds, secrets, dependencies or old releases."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
rows=[]
roots=sorted(Path('/Volumes/code_files').glob('meldiq*'))+[ROOT,ROOT.parent/'universal-icons-desktop',Path('/Volumes/code_files/meldiq_server_status/platform')]
for repo in roots:
    source=repo/'packages/web' if (repo/'packages/web/src').is_dir() else repo
    dirs=[p for p in [source/'src',source/'public',repo/'android/app/src/main'] if p.is_dir()]
    if not dirs:
        if repo.name in ('meldiq_ios','meldiq_bots'):rows.append({'path':str(repo),'implementation':'No client source present'})
        continue
    imports={};inline=[];bad=[];hashes={};vectors=0;files=0
    for directory in dirs:
        for p in directory.rglob('*'):
            if not p.is_file() or p.suffix not in ('.ts','.tsx','.kt','.svg','.xml','.css','.html'):continue
            files+=1;s=p.read_text(errors='replace')
            for family in ['lucide-react','@tabler','@phosphor','@fortawesome','@iconify','androidx.compose.material.icons']:
                if family in s:imports[family]=imports.get(family,0)+1
            if '<svg' in s and p.suffix!='.svg':inline.append(str(p.relative_to(repo)))
            if p.suffix=='.svg':
                try:ET.fromstring(s)
                except ET.ParseError:bad.append(str(p.relative_to(repo)))
                digest=hashlib.sha256(s.encode()).hexdigest();hashes.setdefault(digest,[]).append(str(p.relative_to(repo)))
            if '<vector' in s and p.suffix=='.xml':vectors+=1
    r=subprocess.run(['git','-C',str(repo),'rev-parse','HEAD'],capture_output=True,text=True)
    package={}
    if (source/'package.json').exists():package=json.loads((source/'package.json').read_text())
    rows.append({'path':str(repo),'head':r.stdout.strip() if r.returncode==0 else None,'sourceFiles':files,'iconLibraryFiles':imports,'inlineSvgFiles':len(inline),'inlineSvgExamples':inline[:8],'localSvgs':sum(map(len,hashes.values())),'duplicateSvgGroups':[v for v in hashes.values() if len(v)>1][:15],'brokenSvgs':bad,'androidVectors':vectors,'buildScripts':package.get('scripts',{}).get('build')})
out=ROOT/'docs/universal-icons/inventory.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps([{k:r[k] for k in ('path','sourceFiles','iconLibraryFiles','inlineSvgFiles','localSvgs','androidVectors') if k in r} for r in rows],indent=2))
