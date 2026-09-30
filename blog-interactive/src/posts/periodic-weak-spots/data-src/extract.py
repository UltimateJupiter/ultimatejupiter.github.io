#!/usr/bin/env python3
"""Build ../data.js (window.FIGDATA) from paper_figure_statistics.json.
All accuracies are converted to percent (2 decimals); relative changes keep 1 decimal; gate profiles 3 decimals."""
import json, sys, os, math, re
src = sys.argv[1]; here = os.path.dirname(os.path.abspath(__file__)); outdir = os.path.dirname(here)   # writes ../data.js
# run ids in the export carry an internal training-data tag; strip it on read so no output or source names it
d = json.loads(re.sub(r'_[A-Z]{3}\d+B(?:_swa_v2)?', '', open(src).read())); F = d['figures']
def pct(v, nd=2):
    return None if v is None else round(v*100, nd)
def r(v, nd):
    return None if v is None else round(v, nd)
def pl(a, nd=2):  return [pct(x, nd) for x in a]
def rl(a, nd):    return [r(x, nd) for x in a]
def rm(m, nd):    return [[(None if x is None else (int(round(x)) if nd==0 else round(x,nd))) for x in row] for row in m]

# ---------------- NIAH (DeepSeek) ----------------
names = {'flash_base':'DeepSeek-V4-Flash-Base','flash_full':'DeepSeek-V4-Flash-0731','pro_base':'DeepSeek-V4-Pro-Base',
         'pro_full':'DeepSeek-V4-Pro-0813','dsv41_flash_0910':'DeepSeek-V4.1-Flash'}
strides = {'flash_base':4,'flash_full':4,'pro_base':4,'pro_full':4,'dsv41_flash_0910':2}
niah = {'interval':'two-sided 95% Wilson', 'x':'residue r = t_K mod 8 of the target key position', 'y':'answer accuracy (%)',
        'prompt_tokens':128000, 'records':16000, 'models':[]}
for p in F['fig:v4_niah']['panels']:
    for t in p['traces']:
        a = t['phase_accuracy']
        niah['models'].append({'id':t['series_id'],'name':names[t['series_id']],'stage':t['checkpoint_stage'],'S':strides[t['series_id']],
            'n':t['samples_per_phase'],'correct':t['phase_correct'],'acc':pl(a),'lo':pl(t['wilson95_lower']),'hi':pl(t['wilson95_upper']),
            'mean':round(100*t['overall_correct']/t['overall_total'],2),'worst':pct(min(a)),'best':pct(max(a)),'gap':round(t['phase_range_pp'],2)})

# ---------------- controlled runs (group summaries) ----------------
friendly = {   # signature attributes only: window/stride, KV heads per layer, then whatever else differs
 'kvc_w8s8_1kv_baseline':'W8/S8 · 1 KV · seed 42',
 'kvc_w8s8_1kv_baseline_seed43':'W8/S8 · 1 KV · seed 43',
 'kvc_w8s8_1kv_baseline_seed44':'W8/S8 · 1 KV · seed 44',
 'kvc_w8s8_1kv_baseline_seed45':'W8/S8 · 1 KV · seed 45',
 'kvc_w8s8_2kv':'W8/S8 · 2 KV', 'kvc_w8s8_4kv':'W8/S8 · 4 KV', 'kvc_w8s8_8kv':'W8/S8 · 8 KV',
 'kvc_w4s4_1kv':'W4/S4 · 1 KV', 'kvc_w8s4':'W8/S4 · 1 KV', 'kvc_w8s6':'W8/S6 · 1 KV',
 'kvc_w12s12_1kv':'W12/S12 · 1 KV', 'kvc_w12s12_4kv':'W12/S12 · 4 KV',
 'kvc_w8s8_1kv_kvshare':'W8/S8 · 1 KV · tied K/V', 'kvc_w8s8_1kv_meanpool':'W8/S8 · 1 KV · uniform averaging',
 'kvc_w8s8_1kv_mean_kvshare_postnorm':'W8/S8 · 1 KV · uniform averaging · tied K/V · post-norm',
 'kvc_w8s8_1kv_vector':'W8/S8 · 1 KV · vector gates',
 'kvc_w8s8_1kv_noQKnorm':'W8/S8 · 1 KV · no Q/K norm', 'kvc_w8s8_1kv_nobias':'W8/S8 · 1 KV · no gate bias',
 'kvc_w8s8_1kv_nope':'W8/S8 · 1 KV · no RoPE', 'kvc_w8s8_1kv_rope16':'W8/S8 · 1 KV · RoPE on 16 dims',
 'kvc_w8s8_1kv_tail_concat':'W8/S8 · 1 KV · uncompressed tail', 'kvc_w8s8_8kv_tail_concat':'W8/S8 · 8 KV · uncompressed tail',
 'kvc_w8s4_dsv4kernel_1kv_rope16':'W8/S4 · 1 KV · DeepSeek-style kernel',
 'kvc_w8s4_dsv4kernel_1kv_scalar_rope16':'W8/S4 · 1 KV · DeepSeek-style kernel · scalar gates'}
group_order = ['random_seed_replication','compression_geometry','native_kv_head_count','compression_operator','position_and_normalization','memory_policy_and_implementation']
group_titles = {'random_seed_replication':'Seeds','compression_geometry':'Window and stride','native_kv_head_count':'KV heads per layer',
                'compression_operator':'Compression operator','position_and_normalization':'Position and normalization','memory_policy_and_implementation':'Local memory and kernel'}
G = F['controlled_group_summaries']['groups']
paper_panel = {t['run_name']:(p['panel'],p['title']) for p in F['fig:phase-accuracy']['panels'][1:] for t in p['traces']}
runs = {}; groups = []
for gk in group_order:
    ids = []
    for ev, key in (('Prefix Padding','pp'),('In-sequence Padding','ip')):
        for x in G[gk]['evaluations'][ev]:
            rid = x['run_name']
            if rid not in runs:
                runs[rid] = {'id':rid,'name':friendly[rid],'group':gk,'W':x['window'],'S':x['stride'],'kv':x['kv_heads'],
                             'loss':round(x['validation_loss'],3),'layers':x['knockout_layers']}
                if rid in paper_panel: runs[rid]['paper_panel'] = paper_panel[rid][0]
            if key not in runs[rid]:
                runs[rid][key] = {'acc':pl(x['phase_accuracy']),'lo':pl(x['bootstrap95_lower']),'hi':pl(x['bootstrap95_upper']),
                    'mean':[pct(x['mean_accuracy_estimate'][k]) for k in ('value','lower','upper')],
                    'gap':[pct(x['phase_gap_estimate'][k]) for k in ('value','lower','upper')],
                    'ko':rm(x['knockout_relative_change_percent'],1)}
            if rid not in ids and runs[rid]['group'] == gk: ids.append(rid)
    groups.append({'key':gk,'title':group_titles[gk],'ids':ids})
order = [i for g in groups for i in g['ids']]
models = [runs[i] for i in order]

# ---------------- Figure 2 (accuracy) ----------------
pa = F['fig:phase-accuracy']['panels'][0]
acc = {'x':'source-key position mod 24','y':'full-vocabulary top-1 accuracy (%)','checkpoint_step':47518,
       'full':[{'id':t['run_name'],'name':'Full attention · '+t['legend'],
                'kv':int(t['legend'].split()[0]),'loss':round(t['validation_loss'],3),'acc':pl(t['phase_accuracy']),
                'lo':pl(t['wilson95_lower']),'hi':pl(t['wilson95_upper']),'gap':round(t['phase_range_pp'],2),
                'mean':round(100*sum(t['phase_accuracy'])/24,2)} for t in pa['traces']],
       'interval_full':'95% Wilson (prefix padding)','interval_models':'95% logical-example cluster bootstrap, 2000 replicates'}

# ---------------- Figure 3 (knockouts) ----------------
kp = F['fig:phase-knockouts']['panels']
ko = {'limit':100,'value':'relative accuracy change (%) = 100 × (knockout − clean) / clean',
      'full':{'name':'Full attention · 1 KV','layers':28,'kv':1,'cols':8,'rel':rm(kp[0]['relative_change_percent'],1)},
      'deepseek':{'name':'DeepSeek-V4-Flash-Base','layers':43,'kv':1,'cols':8,'S':4,'rel':rm(kp[2]['relative_change_percent'],1),
                  'note':"whole-layer attention output replaced over a band of final query positions; 256 prompts per residue"}}

# ---------------- Figure 4 (gates vs knockouts) ----------------
_pp = {x['run_name']:x for g in G.values() for x in g['evaluations']['Prefix Padding']}
def fold_ko(m):
    """Knockout by phase mod S for each [layer][head], folded from the group-summary mod-24 maps (identical to Figure 3).
    Falls back to the overlay export (which folds slightly differently, < 1 pp) if the run is missing."""
    rid, S, kv = m['run_name'], m['stride'], m['kv_heads']
    if rid not in _pp: return [[rl(h,1) for h in L] for L in m['prefix_padding_relative_change_percent']]
    ko = _pp[rid]['knockout_relative_change_percent']; k = 24 // S
    return [[[round(sum(ko[l*kv+h][c+j*S] for j in range(k))/k, 1) for c in range(S)] for h in range(kv)] for l in range(m['layers'])]
gates = {'lines':'gate profile g(r) = gate mass at phase r divided by its uniform share; 1 = uniform gate',
         'value_note':'value profile already rolled by −1: vg[r] is the value gate at phase r+1, aligned with the key at phase r',
         'ko':'prefix-padding relative accuracy change (%) under KV-head knockout, folded to phase mod S','models':[]}
for ok, O in F['gate_knockout']['overlays'].items():
    for m in O['models']:
        gates['models'].append({'id':m['run_name'],'name':friendly.get(m['run_name'],m['title']),'W':m['window'],'S':m['stride'],'kv':m['kv_heads'],'layers':m['layers'],
            'mode':m['gate_mode'],'tied':m['kv_sharing'],
            'kg':[[rl(h,3) for h in L] for L in m['key_gate_profile']],
            'vg':[[rl(h,3) for h in L] for L in m['value_gate_profile']],
            'ko':fold_ko(m)})
gates['highlight'] = {'kvc_w8s8_1kv_baseline':[9,10,14]}

# ---------------- Figure 5 (gate cycling) ----------------
cyc = {'x':'source-key phase mod S (24 raw phases folded)','y':'full-vocabulary top-1 accuracy (%)',
       'interval':'95% matched logical-family bootstrap, 2000 replicates','runs':[],
       'default':{'run':'kvc_w12s12_4kv','d':1}}
kvmap = {'kvc_w12s12_1kv':1,'kvc_w12s12_4kv':4}
for R in F['fig:phase-cycling-models']['runs']:
    run = {'id':R['run_id'],'name':friendly.get(R['run_id'],R['label']),'S':R['stride'],'kv':kvmap.get(R['run_id'],1),
           'clean':{'acc':pl(R['clean_accuracy']),'lo':pl(R['clean_bootstrap95_lower']),'hi':pl(R['clean_bootstrap95_upper'])},'conds':[]}
    for c in R['conditions']:
        run['conds'].append({'d':c['delta'],'boundary':c['boundary_phases'],
            'obs':pl(c['observed_accuracy']),'lo':pl(c['observed_bootstrap95_lower']),'hi':pl(c['observed_bootstrap95_upper']),
            'pred':pl(c['predicted_accuracy']),'pc':pl(c['predicted_change']),'oc':pl(c['observed_change']),
            'r2x':[r(c['excl_last_phase_r_squared'],3)]+rl(c['excl_last_phase_r_squared_ci95'],3),
            'r2i':[r(c['interior_r_squared'],3)]+rl(c['interior_r_squared_ci95'],3),
            'r2a':[r(c['all_phase_r_squared'],3)]+rl(c['all_phase_r_squared_ci95'],3),
            'maeA':[r(c['all_phase_mae_pp'],2)]+rl(c['all_phase_mae_pp_ci95'],2),
            'maeI':[r(c['interior_mae_pp'],2)]+rl(c['interior_mae_pp_ci95'],2),
            'dAcc':[r(c['accuracy_change_pp'],2)]+rl(c['accuracy_change_pp_ci95'],2),
            'accPct':r(c['accuracy_pct'],2)})
    cyc['runs'].append(run)

# ---------------- Concentration plane: static exp(H(E[a])) vs per-window E[exp(H(a))] ----------------
CONC = os.path.join(here, 'conc')
conc = None
if os.path.exists(os.path.join(CONC, 'all_points.json')):
    title2id = {'W8/S8 / 1 KV · seed 42':'kvc_w8s8_1kv_baseline','W8/S8 / 1 KV · seed 43':'kvc_w8s8_1kv_baseline_seed43',
      'W8/S8 / 1 KV · seed 44':'kvc_w8s8_1kv_baseline_seed44','W8/S8 / 1 KV · seed 45':'kvc_w8s8_1kv_baseline_seed45',
      'W8/S8 / 2 KV':'kvc_w8s8_2kv','W8/S8 / 4 KV':'kvc_w8s8_4kv','W8/S8 / 8 KV':'kvc_w8s8_8kv',
      'W4/S4 / 1 KV':'kvc_w4s4_1kv','W8/S4 / 1 KV':'kvc_w8s4','W8/S6 / 1 KV':'kvc_w8s6',
      'W12/S12 / 1 KV':'kvc_w12s12_1kv','W12/S12 / 4 KV':'kvc_w12s12_4kv',
      'W8/S8 / shared KV':'kvc_w8s8_1kv_kvshare','W8/S8 / no QK norm':'kvc_w8s8_1kv_noQKnorm',
      'W8/S8 / no Z bias':'kvc_w8s8_1kv_nobias','W8/S8 / NoPE':'kvc_w8s8_1kv_nope','W8/S8 / RoPE-16':'kvc_w8s8_1kv_rope16',
      'Tail concat / 1 KV':'kvc_w8s8_1kv_tail_concat','Tail concat / 8 KV':'kvc_w8s8_8kv_tail_concat',
      'DSV4 kernel / scalar gate':'kvc_w8s4_dsv4kernel_1kv_scalar_rope16'}
    geomv = {'kvc_w12s12_4kv':(12,12,4)}
    for m in models: geomv[m['id']] = (m['W'], m['S'], m['kv'])
    cgroups = [('Seeds',['kvc_w8s8_1kv_baseline','kvc_w8s8_1kv_baseline_seed43','kvc_w8s8_1kv_baseline_seed44','kvc_w8s8_1kv_baseline_seed45']),
               ('Window and stride',['kvc_w4s4_1kv','kvc_w8s4','kvc_w8s6','kvc_w12s12_1kv','kvc_w12s12_4kv']),
               ('KV heads per layer',['kvc_w8s8_2kv','kvc_w8s8_4kv','kvc_w8s8_8kv']),
               ('Compression operator',['kvc_w8s8_1kv_kvshare']),
               ('Position and normalization',['kvc_w8s8_1kv_noQKnorm','kvc_w8s8_1kv_nobias','kvc_w8s8_1kv_nope','kvc_w8s8_1kv_rope16']),
               ('Local memory and kernel',['kvc_w8s8_1kv_tail_concat','kvc_w8s8_8kv_tail_concat','kvc_w8s4_dsv4kernel_1kv_scalar_rope16'])]
    pts = {title2id[p['title']]: p['pts'] for p in json.load(open(os.path.join(CONC, 'all_points.json')))}
    cm = []
    for gt, ids in cgroups:
        for i in ids:
            W, S, kv = geomv[i]
            cm.append({'id':i,'name':friendly[i],'group':gt,'W':W,'S':S,'kv':kv,'layers':28,
                       'pts':[[round(x,3),round(y,3)] for x,y,l in pts[i]]})   # row = layer*kv + head
    dyn = json.load(open(os.path.join(CONC, 'dyn_points.json')))
    conc = {'x':'static effective number of offsets exp(H(E[α])) of the key gate','y':'per-window effective number E[exp(H(α))] of the key gate',
            'checkpoint_step':47518,'groups':[{'title':g,'ids':ids} for g,ids in cgroups],'models':cm,
            'default':'kvc_w8s8_1kv_baseline',
            'traj':{'run':'kvc_w8s8_1kv_baseline','from':'step 1','to':'step 47,518',
                    'heads':[{'layer':int(k[1:]),'path':[[round(x,3),round(y,3)] for x,y in dyn['traj'][k]],'start':dyn['start'][k],'end':dyn['end'][k]} for k in ('L9','L10','L14')]},
            'source':"digitized from the paper's vector figures (Figure 4a and the appendix figure of final key-gate concentration); static values agree with the exported gate profiles to within 0.002",
            'omitted':'uniform averaging (no learned gates) and the vector-gate runs'}

data = {'niah':niah,'runs':{'groups':groups,'models':models,'default':'kvc_w8s8_1kv_baseline'},
        'acc':acc,'ko':ko,'gates':gates,'cyc':cyc,'conc':conc,
        'meta':{'source':'paper_figure_statistics.json (schema 1, generated '+d['generated_at']+')','checkpoint_step':47518}}
js = 'window.FIGDATA=' + json.dumps(data, separators=(',',':'), ensure_ascii=False) + ';\n'
tmp=os.path.join(outdir,'.data.js.tmp'); open(tmp,'w').write(js); os.replace(tmp,os.path.join(outdir,'data.js'))
print('data.js bytes', len(js.encode()))
for k,v in data.items(): print(' ',k, len(json.dumps(v,separators=(',',':'))))
print('models', len(models), [m['name'] for m in models])
