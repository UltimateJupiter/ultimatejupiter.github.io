import fitz, json, sys, numpy as np
A,out,allpts=sys.argv[1],sys.argv[2],sys.argv[3]
p=fitz.open(A+'/figures/specialization_dynamics_3head.pdf')[0]
dr=[d for d in p.get_drawings() if d['rect'].x1<175]
spans=[(s['text'],fitz.Rect(s['bbox'])) for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'] if s['bbox'][0]<175]
dark=(0.149,0.149,0.149)
close=lambda a,b:a is not None and all(abs(x-y)<0.01 for x,y in zip(a,b))
xt=[d for d in dr if close(d.get('color'),dark) and abs(d['rect'].height-2.2)<0.1 and d['rect'].width<0.01]
yt=[d for d in dr if close(d.get('color'),dark) and abs(d['rect'].width-2.2)<0.1 and d['rect'].height<0.01]
lab=[(float(t),r) for t,r in spans if t.strip().isdigit()]
xs=[];ys=[]
for d in xt:
    x=d['rect'].x0; m=[v for v,r in lab if abs((r.x0+r.x1)/2-x)<2.5 and -3<r.y0-d['rect'].y1<8]; xs+= [(x,m[0])] if m else []
for d in yt:
    y=d['rect'].y0; m=[v for v,r in lab if abs((r.y0+r.y1)/2-y)<2.5 and -3<d['rect'].x0-r.x1<8]; ys+= [(y,m[0])] if m else []
ax=np.polyfit(*zip(*xs),1); ay=np.polyfit(*zip(*ys),1)
print('x ticks',xs,'resid',max(abs(np.polyval(ax,a)-b) for a,b in xs)); print('y ticks',ys,'resid',max(abs(np.polyval(ay,a)-b) for a,b in ys))
X=lambda v:float(np.polyval(ax,v)); Y=lambda v:float(np.polyval(ay,v))
cols={'L9':(0.0,0.447,0.698),'L10':(0.0,0.62,0.451),'L14':(0.835,0.369,0.0)}
traj={}
for k,c in cols.items():
    L=[d for d in dr if close(d.get('color'),c) and d['items'] and d['items'][0][0]=='l' and len(d['items'])>20][0]
    pts=[L['items'][0][1]]+[it[2] for it in L['items']]
    traj[k]=[[round(X(q.x),3),round(Y(q.y),3)] for q in pts]
    # end marker: filled colour circle with dark edge; start marker: white fill, colour stroke
    end=[d for d in dr if close(d.get('fill'),c) and d['items'][0][0]=='c'][0]['rect']
    start=[d for d in dr if close(d.get('color'),c) and close(d.get('fill'),(1,1,1)) and d['items'][0][0]=='c'][0]['rect']
    e=(X((end.x0+end.x1)/2),Y((end.y0+end.y1)/2)); s=(X((start.x0+start.x1)/2),Y((start.y0+start.y1)/2))
    print(k,'vertices',len(pts),'path start',traj[k][0],'start marker',[round(v,3) for v in s],'path end',traj[k][-1],'end marker',[round(v,3) for v in e])
    traj[k+'_start']=[round(s[0],3),round(s[1],3)]; traj[k+'_end']=[round(e[0],3),round(e[1],3)]
grey=[d for d in dr if close(d.get('fill'),(0.659,0.659,0.659)) and d['items'][0][0]=='c' and d['rect'].width<3.5]
gp=[[round(X((d['rect'].x0+d['rect'].x1)/2),3),round(Y((d['rect'].y0+d['rect'].y1)/2),3)] for d in grey]
print('grey points',len(gp))
ref=[q for q in json.load(open(allpts)) if q['title']=='W8/S8 / 1 KV · seed 42'][0]['pts']
# match grey points to appendix final points (same run, same checkpoint)
import itertools
used=set(); md=0
for x,y in gp:
    j=min((i for i in range(len(ref)) if i not in used),key=lambda i:(ref[i][0]-x)**2+(ref[i][1]-y)**2); used.add(j)
    md=max(md,((ref[j][0]-x)**2+(ref[j][1]-y)**2)**.5)
print('grey vs appendix seed-42 final points: max distance',round(md,4))
for k,l in (('L9',9),('L10',10),('L14',14)):
    print(k,'end marker',traj[k+'_end'],'appendix',ref[l][:2])
json.dump({'traj':{k:traj[k] for k in cols},'start':{k:traj[k+'_start'] for k in cols},'end':{k:traj[k+'_end'] for k in cols},'grey':gp},open(out,'w'))
