#!/usr/bin/env python3
"""Plain-text rendering of the built blog page for reviewers: headings, paragraphs, lists, tables and figure captions.
Scripts, styles and interactive widgets are dropped; each figure is marked with its id so reviewers can screenshot it."""
import sys, re, html
from html.parser import HTMLParser
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
s = re.sub(r'<script\b.*?</script>', '', s, flags=re.S); s = re.sub(r'<style\b.*?</style>', '', s, flags=re.S)
s = re.sub(r'<nav\b.*?</nav>', '', s, flags=re.S)
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.o=[]; s.skip=0; s.cur=''; s.fig=None; s.incap=False; s.cells=[]
    def flush(s, prefix=''):
        t=re.sub(r'\s+',' ',s.cur).strip(); s.cur=''
        if t: s.o.append(prefix+t)
    def handle_starttag(s,tag,a):
        a=dict(a)
        if tag in ('h1','h2','h3','p','li','figcaption','tr','div') and tag!='div': s.flush()
        if tag=='figure': s.flush(); s.fig=a.get('id',''); s.o.append(f'\n[FIGURE id="{s.fig}" class="{a.get("class","")}"]')
        if tag in ('select','svg','button'): s.skip+=1
        if tag in ('td','th'): s.cur+=' | '
        if tag=='br': s.cur+=' / '
        s.tag=tag
    def handle_endtag(s,tag):
        if tag in ('select','svg','button'): s.skip=max(0,s.skip-1); return
        if tag=='h1': s.flush('# ')
        elif tag=='h2': s.flush('\n## ')
        elif tag=='h3': s.flush('### ')
        elif tag=='li': s.flush('- ')
        elif tag=='figcaption': s.flush('[CAPTION] ')
        elif tag=='tr': s.flush('  ')
        elif tag=='p': s.flush()
        elif tag=='figure': s.flush(); s.o.append('[/FIGURE]\n'); s.fig=None
    def handle_data(s,d):
        if not s.skip: s.cur+=d
p=P(); p.feed(s); p.flush()
txt='\n'.join(p.o)
txt=re.sub(r'\n{3,}','\n\n',txt)
open(out,'w',encoding='utf-8').write(txt); print(len(txt.split()),'words')
