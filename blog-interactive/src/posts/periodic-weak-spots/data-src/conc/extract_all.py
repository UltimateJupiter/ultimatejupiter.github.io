import fitz, json, sys, math, numpy as np
from matplotlib import cm
A=sys.argv[1]; out=sys.argv[2]
p=fitz.open(A+'/Appendix/Figures/gate_concentration_all_models.pdf')[0]
dr=p.get_drawings()
spans=[(s['text'],fitz.Rect(s['bbox'])) for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
# panels = dashed diagonals; their bbox spans the data range 1..W on both axes
diags=[d for d in dr if d.get('dashes') and '1.54' in d['dashes']]
markers=[d for d in dr if d['items'] and all(i[0]=='c' for i in d['items']) and d['rect'].width<4]
xt=[d for d in dr if len(d['items'])==1 and d['items'][0][0]=='l' and abs(d['rect'].height-2.0)<0.05 and d['rect'].width<0.01]
yt=[d for d in dr if len(d['items'])==1 and d['items'][0][0]=='l' and abs(d['rect'].width-2.0)<0.05 and d['rect'].height<0.01]
print('diags',len(diags),'markers',len(markers),'xticks',len(xt),'yticks',len(yt))
num=lambda t: t.strip().replace('−','-')
labels=[(float(num(t)),r) for t,r in spans if num(t).lstrip('-').isdigit()]
titles=[(t,r) for t,r in spans if not num(t).lstrip('-').isdigit()]
panels=[]
for dg in sorted(diags,key=lambda d:(round(d['rect'].y0),d['rect'].x0)):
    R=dg['rect']
    # axis region: slightly larger than the diagonal box
    box=fitz.Rect(R.x0-6,R.y0-8,R.x1+8,R.y1+6)
    # x calibration from x tick marks under this panel + their labels
    xs=[]; 
    for d in xt:
        x=d['rect'].x0; y=d['rect'].y1
        if box.x0-4<x<box.x1+4 and R.y1-2<y<R.y1+12:
            lab=[v for v,r in labels if abs((r.x0+r.x1)/2-x)<2.5 and -3<r.y0-y<8]
            if lab: xs.append((x,lab[0]))
    ys=[]
    for d in yt:
        y=d['rect'].y0; x=d['rect'].x0
        if box.y0-4<y<box.y1+4 and R.x0-12<x<R.x0+2:
            lab=[v for v,r in labels if abs((r.y0+r.y1)/2-y)<2.5 and -3<x-r.x1<8]
            if lab: ys.append((y,lab[0]))
    xs=sorted(set(xs)); ys=sorted(set(ys))
    ax=np.polyfit([a for a,_ in xs],[b for _,b in xs],1); ay=np.polyfit([a for a,_ in ys],[b for _,b in ys],1)
    resx=max(abs(np.polyval(ax,a)-b) for a,b in xs); resy=max(abs(np.polyval(ay,a)-b) for a,b in ys)
    # diagonal endpoints in data coordinates (should be (1,1) .. (W,W))
    d0=(np.polyval(ax,R.x0),np.polyval(ay,R.y1)); d1=(np.polyval(ax,R.x1),np.polyval(ay,R.y0))
    tt=sorted([(r.y0,t) for t,r in titles if R.x0-10<(r.x0+r.x1)/2<R.x1+10 and R.y0-30<r.y0<R.y0])
    title=' / '.join(t for _,t in tt)
    ms=[m for m in markers if R.x0-3<(m['rect'].x0+m['rect'].x1)/2<R.x1+3 and R.y0-3<(m['rect'].y0+m['rect'].y1)/2<R.y1+3]
    panels.append(dict(title=title,R=R,ax=ax,ay=ay,resx=resx,resy=resy,diag=(d0,d1),ms=ms,xs=xs,ys=ys))
print('panels',len(panels))
# layer decoding via viridis: find the normalisation that fits all colours best
cols=np.array([m['fill'] for P in panels for m in P['ms']])
best=None
for lo,hi,n in [(0,27,28),(-0.5,27.5,28),(0,28,28)]:
    lut=np.array([cm.viridis((l-lo)/(hi-lo))[:3] for l in range(28)])
    dist=np.min(np.linalg.norm(cols[:,None,:]-lut[None,:,:],axis=2),axis=1)
    print('norm',lo,hi,'max colour distance',dist.max().round(4))
    if best is None or dist.max()<best[0]: best=(dist.max(),lo,hi,lut)
lut=best[3]
res=[]
for P in panels:
    pts=[]
    for m in P['ms']:
        cx=(m['rect'].x0+m['rect'].x1)/2; cy=(m['rect'].y0+m['rect'].y1)/2
        c=np.array(m['fill']); l=int(np.argmin(np.linalg.norm(lut-c,axis=1)))
        pts.append([round(float(np.polyval(P['ax'],cx)),3),round(float(np.polyval(P['ay'],cy)),3),l])
    layers=[q[2] for q in pts]
    order_ok=all(layers[i]<=layers[i+1] for i in range(len(layers)-1))
    print(f"{P['title']:40s} n={len(pts):3d} resx={P['resx']:.3f} resy={P['resy']:.3f} diag=({P['diag'][0][0]:.2f},{P['diag'][0][1]:.2f})-({P['diag'][1][0]:.2f},{P['diag'][1][1]:.2f}) layer-sorted={order_ok} minx={min(q[0] for q in pts):.2f}")
    res.append(dict(title=P['title'],pts=pts,layer_sorted=order_ok))
json.dump(res,open(out,'w'))
