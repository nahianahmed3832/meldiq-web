#!/usr/bin/env python3
"""Exercise validation against real corruption; no network or runtime icon library."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
from generate import CATALOGUE, read_catalogue, outputs, android_path

class CatalogueTests(unittest.TestCase):
    def mutate(self, change):
        with tempfile.TemporaryDirectory() as tmp:
            import shutil
            base=Path(tmp)/'icons';shutil.copytree(CATALOGUE,base)
            data=json.loads((base/'catalogue.json').read_text());change(data,base)
            (base/'catalogue.json').write_text(json.dumps(data))
            with self.assertRaises((AssertionError,KeyError,FileNotFoundError,ET.ParseError)):
                read_catalogue(base)
    def test_real_catalogue_and_all_android_paths(self):
        data,entries=read_catalogue()
        self.assertEqual(len(entries),33)
        for entry,nodes in entries:
            for tag,attrs in nodes:self.assertTrue(android_path(tag,attrs).startswith(('M','m')))
        self.assertEqual(len(outputs()),37)
    def test_duplicate_identifier(self):self.mutate(lambda d,b:d['icons'].append(copy.deepcopy(d['icons'][0])))
    def test_duplicate_geometry(self):self.mutate(lambda d,b:d['icons'][1].update(svg=d['icons'][0]['svg']))
    def test_missing_identifier(self):self.mutate(lambda d,b:d['icons'][0].pop('id'))
    def test_unlicensed_asset(self):self.mutate(lambda d,b:d['icons'][0].update(license='unknown'))
    def test_missing_license_notice(self):self.mutate(lambda d,b:(b/'LICENSE-lucide.txt').unlink())
    def test_missing_android_mapping(self):self.mutate(lambda d,b:d['icons'][0]['platforms'].pop('android'))
    def test_missing_desktop_mapping(self):self.mutate(lambda d,b:d['icons'][0]['platforms'].pop('desktop'))
    def test_wrong_size(self):self.mutate(lambda d,b:d['icons'][0].update(defaultDimensions=[32,32]))
    def test_wrong_stroke(self):self.mutate(lambda d,b:d['icons'][0].update(strokeWidth=1.65))
    def test_script_svg(self):self.mutate(lambda d,b:(b/d['icons'][0]['svg']).write_text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))
    def test_broken_svg(self):self.mutate(lambda d,b:(b/d['icons'][0]['svg']).write_text('<svg'))
    def test_remote_image_svg(self):self.mutate(lambda d,b:(b/d['icons'][0]['svg']).write_text('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/i.svg"/></svg>'))
    def test_round_rectangle_conversion(self):self.assertIn('a2,2',android_path('rect',{'x':'3','y':'3','width':'18','height':'18','rx':'2'}))

if __name__=='__main__':unittest.main()
