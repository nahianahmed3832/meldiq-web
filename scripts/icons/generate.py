#!/usr/bin/env python3
"""Validate the canonical subset and deterministically generate local platform adapters."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
CATALOGUE = ROOT / 'shared/icons'
ALLOWED = {'path': {'d'}, 'line': {'x1','y1','x2','y2'}, 'polyline': {'points'}, 'polygon': {'points'}, 'circle': {'cx','cy','r'}, 'rect': {'x','y','width','height','rx','ry'}, 'ellipse': {'cx','cy','rx','ry'}}
ROOT_ATTRS = {'width','height','viewBox','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','aria-hidden'}

def read_catalogue(base=CATALOGUE):
    data = json.loads((base / 'catalogue.json').read_text())
    assert data['schemaVersion'] == 1
    assert data['tokens']['sizes'] == [16,18,20,24,32]
    assert data['tokens']['strokeWidth'] == 2
    ids, shapes, android = set(), set(), set()
    result = []
    for entry in data['icons']:
        name = entry['id']
        assert re.fullmatch(r'[a-z]+\.[a-z]+', name), f'Invalid semantic identifier: {name}'
        assert name not in ids, f'Duplicate identifier: {name}'
        ids.add(name)
        assert entry['license'] == 'ISC AND MIT' and entry['collection'] == 'Lucide', f'Unreviewed license/family: {name}'
        assert entry['sourceVersion'] == 'lucide-react@1.59.0'
        assert (base / entry['licenseFile']).is_file(), f'Missing license: {name}'
        assert entry['defaultDimensions'] == [24,24] and entry['strokeWidth'] == 2 and entry['variants'] == ['outline']
        mapping = entry['platforms']
        assert mapping['web'] == mapping['desktop']['renderer'] == name, f'Web/desktop mapping missing: {name}'
        assert mapping['desktop']['native'] == 'platform-conventions'
        resource = mapping['android']
        assert resource == 'mi_' + name.replace('.','_') and resource not in android, f'Android mapping: {name}'
        android.add(resource)
        path = base / entry['svg']
        assert path.resolve().is_relative_to(base.resolve())
        raw = path.read_text()
        assert not re.search(r'<!|<\?|url\(|https?://(?!www.w3.org/2000/svg)', raw, re.I), f'Unsafe SVG: {name}'
        svg = ET.fromstring(raw)
        assert svg.tag == '{http://www.w3.org/2000/svg}svg'
        assert set(svg.attrib) <= ROOT_ATTRS, f'Unexpected SVG attributes: {name}'
        expected={'viewBox':'0 0 24 24','width':'24','height':'24','fill':'none','stroke':'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round'}
        assert all(svg.get(k)==v for k,v in expected.items()), f'Invalid size/stroke: {name}'
        nodes=[]
        for child in svg:
            tag = child.tag.removeprefix('{http://www.w3.org/2000/svg}')
            assert tag in ALLOWED and set(child.attrib) <= ALLOWED[tag] | {'fill'}, f'Unsafe element: {name}'
            assert not list(child) and not (child.text or '').strip()
            assert child.attrib, f'Empty geometry: {name}'
            # Only finite numeric geometry and SVG path commands are accepted.
            for k,v in child.attrib.items():
                if k == 'fill':
                    assert v == 'currentColor', f'Unsafe fill: {name}'
                    continue
                pattern = r'[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+' if k=='d' else r'[0-9eE+.,\s-]+'
                assert re.fullmatch(pattern,v), f'Invalid geometry: {name}/{k}'
                if k not in ('d','points'): assert float(v) >= 0
            nodes.append((tag,dict(child.attrib)))
        assert nodes, f'Empty SVG: {name}'
        digest=hashlib.sha256(json.dumps(nodes,sort_keys=True).encode()).hexdigest()
        assert digest not in shapes, f'Duplicate icon geometry: {name}; use an explicit semantic alias instead'
        shapes.add(digest)
        result.append((entry,nodes))
    assert result, 'Empty catalogue'
    return data,result

def android_path(tag,a):
    if tag=='path': return a['d']
    if tag=='line': return f"M{a['x1']},{a['y1']} L{a['x2']},{a['y2']}"
    if tag in ('polyline','polygon'):
        nums=re.findall(r'-?\d+(?:\.\d+)?',a['points'])
        assert len(nums)>=4 and len(nums)%2==0
        return 'M'+','.join(nums[:2])+' L'+' '.join(','.join(nums[i:i+2]) for i in range(2,len(nums),2))+(' Z' if tag=='polygon' else '')
    if tag in ('circle','ellipse'):
        cx,cy=float(a['cx']),float(a['cy']);rx=float(a.get('r',a.get('rx',0)));ry=float(a.get('r',a.get('ry',0)))
        return f'M{cx-rx:g},{cy:g} a{rx:g},{ry:g} 0 1,0 {2*rx:g},0 a{rx:g},{ry:g} 0 1,0 {-2*rx:g},0'
    x,y=float(a.get('x',0)),float(a.get('y',0));w,h=float(a['width']),float(a['height'])
    rx=min(float(a.get('rx',a.get('ry',0))),w/2);ry=min(float(a.get('ry',a.get('rx',0))),h/2)
    if not rx or not ry:return f'M{x:g},{y:g} h{w:g} v{h:g} h{-w:g} Z'
    return f'M{x+rx:g},{y:g} H{x+w-rx:g} a{rx:g},{ry:g} 0 0,1 {rx:g},{ry:g} V{y+h-ry:g} a{rx:g},{ry:g} 0 0,1 {-rx:g},{ry:g} H{x+rx:g} a{rx:g},{ry:g} 0 0,1 {-rx:g},{-ry:g} V{y+ry:g} a{rx:g},{ry:g} 0 0,1 {rx:g},{-ry:g} Z'

def outputs():
    data,entries=read_catalogue()
    header='// Generated by scripts/icons/generate.py. Edit shared/icons/catalogue.json and SVG sources.\n// Lucide ISC + Feather MIT; see shared/icons/LICENSE-lucide.txt.\n'
    web=header+'import { createElement, type SVGProps } from "react";\n\nexport const ICON_NAMES = '+json.dumps([e['id'] for e,n in entries])+' as const;\nexport type IconName = (typeof ICON_NAMES)[number];\nexport type IconSize = 16 | 18 | 20 | 24 | 32;\nexport type IconState = "inactive" | "active" | "disabled";\n'
    web+='export type IconProps = Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height" | "viewBox" | "strokeWidth" | "children" | "dangerouslySetInnerHTML"> & { name: IconName; size?: IconSize; state?: IconState; label?: string };\n'
    web+='const geometry = '+json.dumps({e['id']:n for e,n in entries},separators=(',',':'))+' as const;\n'
    web+='''
/** Decorative by default; icon-only controls must provide their accessible name on the control. */
export function Icon({ name, size = 24, state = "inactive", label, style, ...props }: IconProps) {
  return createElement("svg", {
    ...props, "data-icon": name, "data-icon-state": state, width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
    focusable: "false", role: label ? "img" : undefined, "aria-label": label, "aria-hidden": label ? undefined : true,
    style: { ...style, flexShrink: 0, ...(state === "disabled" ? { opacity: 0.38 } : {}) },
  }, geometry[name].map(([tag, attrs], key) => createElement(tag, { ...attrs, key })));
}
'''
    out={'src/ui/icons/Icon.tsx':web,'public/icon-licenses.txt':(CATALOGUE/'LICENSE-lucide.txt').read_text()}
    kotlin=header+'package com.meldiq.android.ui.icons\n\nimport androidx.annotation.DrawableRes\nimport com.meldiq.android.R\n\n/** Stable semantic identity; resource geometry is generated from the same SVG as web. */\nenum class MeldiqIcon(val semanticId: String, @get:DrawableRes val drawable: Int) {\n'
    for e,nodes in entries:
        resource=e['platforms']['android'];enum=''.join(v.capitalize() for v in e['id'].split('.'))
        kotlin+=f'    {enum}("{e["id"]}", R.drawable.{resource}),\n'
        vector='<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n'
        for tag,a in nodes:
            p=android_path(tag,a)
            fill='#FF000000' if a.get('fill')=='currentColor' else '#00000000'
            vector+=f'    <path android:pathData="{p}" android:fillColor="{fill}" android:strokeColor="#FF000000" android:strokeWidth="2" android:strokeLineCap="round" android:strokeLineJoin="round" />\n'
        vector+='</vector>\n'
        out[f'platforms/android/res/drawable/{resource}.xml']=vector
    kotlin+='}\n'
    out['platforms/android/MeldiqIcon.kt']=kotlin
    files = {'catalogue.json': (CATALOGUE/'catalogue.json').read_bytes(), 'LICENSE-lucide.txt': (CATALOGUE/'LICENSE-lucide.txt').read_bytes(), **{e['svg']: (CATALOGUE/e['svg']).read_bytes() for e,n in entries}, '../../src/ui/icons/Icon.tsx': web.encode()}
    out['shared/icons/manifest.json'] = json.dumps({k: hashlib.sha256(v).hexdigest() for k,v in files.items()}, indent=2) + '\n'
    return out

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');p.add_argument('--android',type=Path);p.add_argument('--desktop',type=Path)
    a=p.parse_args(); generated=outputs()
    for path,content in generated.items():
        target=ROOT/path
        if a.check: assert target.is_file() and target.read_text()==content, f'Generated file drift: {path}'
        else:target.parent.mkdir(parents=True,exist_ok=True);target.write_text(content)
    if a.android:
        android=a.android.resolve()
        for path,content in generated.items():
            if path.startswith('platforms/android/res/'):target=android/'app/src/main'/path.removeprefix('platforms/android/')
            elif path=='platforms/android/MeldiqIcon.kt':target=android/'app/src/main/java/com/meldiq/android/ui/icons/MeldiqIcon.kt'
            elif path=='public/icon-licenses.txt':target=android/'app/src/main/assets/icon-licenses.txt'
            else:continue
            if a.check:assert target.read_text()==content, f'Android drift: {target}'
            else:target.parent.mkdir(parents=True,exist_ok=True);target.write_text(content)
    if a.desktop:
        desktop=a.desktop.resolve()
        for path in ['shared/icons/catalogue.json','shared/icons/LICENSE-lucide.txt','shared/icons/manifest.json',*[f'shared/icons/{e["svg"]}' for e,n in read_catalogue()[1]],'src/ui/icons/Icon.tsx','public/icon-licenses.txt']:
            source=ROOT/path; target=desktop/'packages/web'/path
            if a.check:assert source.read_bytes()==target.read_bytes(), f'Desktop drift: {path}'
            else:target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
    ids = {e['id'] for e,n in read_catalogue()[1]}
    for path in (ROOT/'src').rglob('*.tsx'):
        for name in re.findall(r'<Icon\s+name=[\"\']([a-z]+\.[a-z]+)[\"\']', path.read_text()):
            assert name in ids, f'Unknown semantic usage {name}: {path}'
    print(f'{len(read_catalogue()[1])} licensed SVGs validated; {len(generated)} generated files '+('verified' if a.check else 'written'))

if __name__=='__main__': main()
