#!/usr/bin/env python3
# 生成 10 个风格子项目：每条 3 帧（Hook 10s / 功能全景 24s / CTA 11s ≈ 45s）
# 骨架统一，版式语言按 preset 参数化。
import os, re, shutil, json

ROOT = '/Users/zhihu/code/m_code/ai/look-me/promo'
TPL = f'{ROOT}/styles'          # init 模板项目
ASSETS_SRC = '/Users/zhihu/code/m_code/ai/look-me/site/assets'

# ---------- 统一内容（基于最新代码：v0.1.1） ----------
HOOK_LINE1 = '泪膜只能撑'
HOOK_NUM = '10 秒'
HOOK_LINE2 = '别等眼睛干掉'
FEATS = [
    ('眨眼守护', '盯屏 25 秒没眨眼，他带着眼泪来——陪我慢慢眨 2 下'),
    ('20-20-20 远眺', '每 20 分钟，望向 6 米外 20 秒，节奏他替你记着'),
    ('久坐起身', '他认得你真的站起来——30 分钟提醒，1–600 分钟可调'),
    ('哈欠镜像', '你打了个哈欠，他也跟着张嘴打一个'),
    ('待机小剧场', '拍手 · 坐下 · 转圈，没人理他的时候他自己玩'),
    ('守口如瓶', '检测全在本机——不上传 · 不保存 · 没有云端'),
]
CTA_MARK = 'LOOK ME'
CTA_CN = '看看我'
CTA_SUB = '猫咪伙伴住进你的桌面：提醒眨眼、远眺、起身'
CTA_BTN = ['macOS', 'Windows', 'Linux']
CTA_FINE = 'v0.1.1 · 个人健康习惯工具 · 不用于诊断或治疗干眼症'

# ---------- 10 个风格（版式语言参数化） ----------
# font: (display栈, body栈, mono栈)；色板见各 preset FRAME.md frontmatter
S = {
 'biennale-yellow': dict(
   name='双年展黄', canvas='#f6efdd', ink='#24243b', accent='#f2c94c', soft='#e5dcc4',
   fdisp='"Georgia","Times New Roman",serif', fbody='"Helvetica Neue",Arial,sans-serif', fmono='"SF Mono",Menlo,monospace',
   container='border:1px solid rgba(36,36,59,.35); border-radius:0; background:transparent',
   title='font-weight:400; letter-spacing:-.01em', upper=False, tagstyle='background:#f2c94c; color:#24243b; padding:2px 10px',
   deco='radial yellow bloom behind display word'),
 'blockframe': dict(
   name='新粗野', canvas='#fdf3e7', ink='#111111', accent='#ff5d8f', soft='#9ad9ea',
   fdisp='"Arial Black","Helvetica Neue",Arial,sans-serif', fbody='"Helvetica Neue",Arial,sans-serif', fmono='"SF Mono",Menlo,monospace',
   container='border:4px solid #111; border-radius:0; box-shadow:8px 8px 0 #111; background:#fff',
   title='font-weight:900; text-transform:uppercase; letter-spacing:-.02em', upper=True, tagstyle='background:#111; color:#fdf3e7; padding:4px 10px',
   deco='tilted candy squares'),
 'blue-professional': dict(
   name='钴蓝顾问', canvas='#faf7f0', ink='#1c1c1e', accent='#1e2bfa', soft='#e8e4d8',
   fdisp='"Helvetica Neue",Arial,sans-serif', fbody='"Helvetica Neue",Arial,sans-serif', fmono='"SF Mono",Menlo,monospace',
   container='border:1px solid rgba(28,28,30,.2); border-radius:12px; background:rgba(28,28,30,.04)',
   title='font-weight:600; letter-spacing:-.015em', upper=False, tagstyle='background:#1e2bfa; color:#fff; border-radius:100px; padding:3px 12px',
   deco='cobalt progress hairline'),
 'bold-poster': dict(
   name='海报红', canvas='#faf5ea', ink='#2b1d16', accent='#c8352a', soft='#e7ddc9',
   fdisp='Georgia,"Times New Roman",serif', fbody='Georgia,serif', fmono='"SF Mono",Menlo,monospace',
   container='border:3px solid #2b1d16; border-left:14px solid #c8352a; border-radius:0; background:#fff; box-shadow:inset 0 0 0 1.5px #faf5ea, inset 0 0 0 3px #2b1d16',
   title='font-weight:700; letter-spacing:0', upper=False, tagstyle='background:#c8352a; color:#faf5ea; padding:3px 10px',
   deco='double-rule grid lines'),
 'broadside': dict(
   name='宣言橙', canvas='#f4f1ea', ink='#131313', accent='#ff4d00', soft='#ddd6c8',
   fdisp='"Helvetica Neue",Arial,sans-serif', fbody='"Helvetica Neue",Arial,sans-serif', fmono='"IBM Plex Mono","SF Mono",Menlo,monospace',
   container='border:1px solid #131313; border-radius:0; background:transparent',
   title='font-weight:900; letter-spacing:-.03em; text-transform:lowercase', upper=False, tagstyle='border:1px solid #131313; color:#131313; padding:3px 10px; letter-spacing:.14em',
   deco='fire-orange sole accent planes'),
 'capsule': dict(
   name='胶囊糖', canvas='#fbf6ec', ink='#20242c', accent='#ff7d5c', soft='#bde3d4',
   fdisp='Georgia,serif', fbody='"Helvetica Neue",Arial,sans-serif', fmono='"SF Mono",Menlo,monospace',
   container='border:2px solid #20242c; border-radius:999px; background:#fff',
   title='font-weight:600; letter-spacing:0', upper=False, tagstyle='background:#20242c; color:#fbf6ec; border-radius:999px; padding:4px 14px',
   deco='floating pill wallpaper dots'),
 'cartesian': dict(
   name='坐标纸', canvas='#ede8e0', ink='#1a1a1a', accent='#8a8178', soft='#e2dbd1',
   fdisp='"Playfair Display",Georgia,serif', fbody='"Helvetica Neue",Arial,sans-serif', fmono='"SF Mono",Menlo,monospace',
   container='border:1px solid #8a8178; border-radius:0; background:transparent',
   title='font-weight:400; letter-spacing:.01em', upper=False, tagstyle='border:1px solid #1a1a1a; color:#1a1a1a; padding:3px 10px; letter-spacing:.12em',
   deco='compass-drafted circles, graph hairlines'),
 'cobalt-grid': dict(
   name='钴蓝格纸', canvas='#f7f4ec', ink='#0f2bb8', accent='#0f2bb8', soft='#dcd7c9',
   fdisp='Georgia,serif', fbody='"Helvetica Neue",Arial,sans-serif', fmono='"IBM Plex Mono","SF Mono",Menlo,monospace',
   container='border:1px solid rgba(15,43,184,.35); border-radius:0; background:rgba(15,43,184,.03)',
   title='font-weight:400; letter-spacing:0', upper=False, tagstyle='background:#0f2bb8; color:#f7f4ec; padding:3px 10px; letter-spacing:.1em',
   deco='permanent graph-paper grid + top/bottom cobalt rules'),
 'coral': dict(
   name='珊瑚硬边', canvas='#f4ede2', ink='#141414', accent='#ff5a4e', soft='#e3d9c8',
   fdisp='"Arial Black",Arial,sans-serif', fbody='"Helvetica Neue",Arial,sans-serif', fmono='"SF Mono",Menlo,monospace',
   container='border:0; border-radius:0; background:#fff; outline:2px solid #141414',
   title='font-weight:900; letter-spacing:.02em; text-transform:uppercase', upper=True, tagstyle='background:#ff5a4e; color:#141414; padding:4px 10px',
   deco='45° diagonal hatch patch, hard color edges'),
 'editorial-forest': dict(
   name='森林绿', canvas='#f2efe6', ink='#173f35', accent='#c96f85', soft='#e0dccf',
   fdisp='"Playfair Display",Georgia,serif', fbody='"Helvetica Neue",Arial,sans-serif', fmono='"SF Mono",Menlo,monospace',
   container='border:1px solid rgba(23,63,53,.25); border-radius:8px; background:rgba(255,255,255,.6)',
   title='font-weight:500; letter-spacing:0', upper=False, tagstyle='background:#173f35; color:#f2efe6; padding:3px 10px',
   deco='monogram circle stamp, 2px hairline rules'),
}

FONT_FACE = '''@font-face { font-family: "PingFang SC"; src: local("PingFang SC"); }
    @font-face { font-family: "SF Mono"; src: local("SF Mono"), local("Menlo"); }
    @font-face { font-family: "IBM Plex Mono"; src: local("IBM Plex Mono"), local("SF Mono"), local("Menlo"); }
    @font-face { font-family: "Playfair Display"; src: local("Playfair Display"), local("Georgia"); }
    @font-face { font-family: "Georgia"; src: local("Georgia"); }
    @font-face { font-family: "Arial Black"; src: local("Arial Black"), local("Arial"); }'''

def frame1_hook(st, pid):  # 10s
    return f'''<template>
  <style>
    {FONT_FACE}
    #root {{ position:absolute; inset:0; width:1920px; height:1080px; overflow:hidden;
      font-family:{st['fbody']}; color:{st['ink']}; background:{st['canvas']}; }}
    #root .bg {{ position:absolute; inset:0; background:{st['canvas']}; }}
    #root .bloom {{ position:absolute; left:50%; top:44%; width:900px; height:560px;
      transform:translate(-50%,-50%); border-radius:50%;
      background:radial-gradient(closest-side, {st['accent']}55 0%, transparent 72%); opacity:0; }}
    #root .kicker {{ position:absolute; left:0; right:0; top:170px; text-align:center;
      font-family:{st['fmono']}; font-size:26px; letter-spacing:.34em; opacity:0; color:{st['ink']}; }}
    #root .h1 {{ position:absolute; left:0; right:0; top:300px; text-align:center;
      font-family:{st['fdisp']}; font-size:150px; line-height:1.04; {st['title']}; }}
    #root .h1 .num {{ color:{st['ink']}; }}
    #root .h1 .w {{ display:inline-block; opacity:0; }}
    #root .h2 {{ position:absolute; left:0; right:0; top:660px; text-align:center;
      font-family:{st['fdisp']}; font-size:64px; {st['title']}; opacity:0; }}
    #root .pet {{ position:absolute; left:50%; bottom:120px; width:190px; height:238px;
      transform:translateX(-50%); opacity:0; }}
    #root .pet img {{ width:100%; height:100%; object-fit:contain; object-position:bottom; }}
    #root .tag {{ position:absolute; right:150px; bottom:150px; font-size:22px; opacity:0;
      font-family:{st['fmono']}; {st['tagstyle']}; }}
  </style>
  <div id="root" data-composition-id="01-hook" data-width="1920" data-height="1080" data-duration="10">
    <div id="01-hook-bg" class="clip bg" data-start="0" data-duration="10" data-track-index="0"></div>
    <div id="01-hook-bloom" class="clip bloom" data-start="0.3" data-duration="9.7" data-track-index="1"></div>
    <div id="01-hook-kicker" class="clip kicker" data-start="0.2" data-duration="9.8" data-track-index="2">LOOK ME · 看看我</div>
    <div id="01-hook-h1" class="clip h1" data-start="0.4" data-duration="9.6" data-track-index="3">
      <span class="w">{HOOK_LINE1}</span><span class="w num">{HOOK_NUM}</span>
    </div>
    <div id="01-hook-h2" class="clip h2" data-start="4.6" data-duration="5.4" data-track-index="4">{HOOK_LINE2}</div>
    <div id="01-hook-pet" class="clip pet" data-start="5.6" data-duration="4.4" data-track-index="5">
      <img src="assets/heterochromia-cat-idle.png" alt="">
    </div>
    <div id="01-hook-tag" class="clip tag" data-start="8.4" data-duration="1.6" data-track-index="6">他替你记着</div>
  </div>
  <script>
    window.__timelines = window.__timelines || {{}};
    (function () {{
      var $ = function (id) {{ return document.getElementById(id); }};
      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: "power3.out" }} }});
      tl.fromTo($("01-hook-kicker"), {{opacity:0, y:14}}, {{opacity:.85, y:0, duration:.5}}, 0.2);
      tl.to($("01-hook-bloom"), {{opacity:1, duration:.9}}, 0.4);
      tl.fromTo("#root .h1 .w", {{opacity:0, y:60}}, {{opacity:1, y:0, duration:.7, stagger:.55}}, 0.5);
      tl.fromTo($("01-hook-h2"), {{opacity:0, y:26}}, {{opacity:1, y:0, duration:.55}}, 4.7);
      tl.fromTo($("01-hook-pet"), {{opacity:0, y:40}}, {{opacity:1, y:0, duration:.65}}, 5.7);
      tl.fromTo($("01-hook-tag"), {{opacity:0, scale:.86}}, {{opacity:1, scale:1, duration:.4}}, 8.5);
      window.__timelines["01-hook"] = tl;
    }})();
  </script>
</template>'''

def frame2_feats(st, pid):  # 24s, 7 feature cards
    cards = ''
    tl_reveals = ''
    t = 0.9
    for i, (title, desc) in enumerate(FEATS):
        x = 210 + (i % 2) * 760
        y = 300 + (i // 2) * 190
        cards += f'''
    <div id="02-feats-c{i}" class="clip fcard" data-start="{t:.2f}" data-duration="{24-t:.2f}" data-track-index="{2+i}"
      style="left:{x}px; top:{y}px;">
      <span class="ftag">{title}</span>
      <span class="fdesc">{desc}</span>
    </div>'''
        tl_reveals += f'''
      tl.fromTo($("02-feats-c{i}"), {{opacity:0, y:38}}, {{opacity:1, y:0, duration:.5}}, {t:.2f});'''
        t += 3.1
    return f'''<template>
  <style>
    {FONT_FACE}
    #root {{ position:absolute; inset:0; width:1920px; height:1080px; overflow:hidden;
      font-family:{st['fbody']}; color:{st['ink']}; background:{st['canvas']}; }}
    #root .bg {{ position:absolute; inset:0; background:{st['canvas']}; }}
    #root .title {{ position:absolute; left:0; right:0; top:120px; text-align:center;
      font-family:{st['fdisp']}; font-size:74px; {st['title']}; }}
    #root .title .w {{ display:inline-block; opacity:0; margin:0 .1em; }}
    #root .fcard {{ position:absolute; width:740px; height:168px; padding:26px 34px;
      display:flex; flex-direction:column; justify-content:center; gap:14px; opacity:0;
      font-size:27px; line-height:1.45; {st['container']}; }}
    #root .ftag {{ align-self:flex-start; font-size:23px; font-family:{st['fmono']}; {st['tagstyle']}; }}
    #root .fdesc {{ color:{st['ink']}; opacity:.88; }}
    #root .pet {{ position:absolute; left:50%; bottom:100px; width:150px; height:188px;
      transform:translateX(-50%); opacity:0; }}
    #root .pet img {{ width:100%; height:100%; object-fit:contain; object-position:bottom; }}
  </style>
  <div id="root" data-composition-id="02-feats" data-width="1920" data-height="1080" data-duration="24">
    <div id="02-feats-bg" class="clip bg" data-start="0" data-duration="24" data-track-index="0"></div>
    <div id="02-feats-title" class="clip title" data-start="0.2" data-duration="23.8" data-track-index="1">
      <span class="w">他为你做的事</span>
    </div>{cards}
    <div id="02-feats-pet" class="clip pet" data-start="22.0" data-duration="2.0" data-track-index="20">
      <img src="assets/heterochromia-cat-idle.png" alt="">
    </div>
  </div>
  <script>
    window.__timelines = window.__timelines || {{}};
    (function () {{
      var $ = function (id) {{ return document.getElementById(id); }};
      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: "power3.out" }} }});
      tl.fromTo("#root .title .w", {{opacity:0, y:30}}, {{opacity:1, y:0, duration:.55}}, 0.25);{tl_reveals}
      tl.fromTo($("02-feats-pet"), {{opacity:0, y:30}}, {{opacity:1, y:0, duration:.5}}, 22.1);
      window.__timelines["02-feats"] = tl;
    }})();
  </script>
</template>'''

def frame3_cta(st, pid):  # 11s
    btns = ''
    for i, b in enumerate(CTA_BTN):
        btns += f'\n      <span class="btn" id="03-cta-b{i}">{b}</span>'
    return f'''<template>
  <style>
    {FONT_FACE}
    #root {{ position:absolute; inset:0; width:1920px; height:1080px; overflow:hidden;
      font-family:{st['fbody']}; color:{st['ink']}; background:{st['canvas']}; }}
    #root .bg {{ position:absolute; inset:0; background:{st['canvas']}; }}
    #root .pet {{ position:absolute; left:50%; top:180px; width:250px; height:312px;
      transform:translateX(-50%); opacity:0; }}
    #root .pet img {{ width:100%; height:100%; object-fit:contain; object-position:bottom; }}
    #root .mark {{ position:absolute; left:0; right:0; top:560px; text-align:center;
      font-family:{st['fdisp']}; font-size:100px; {st['title']}; }}
    #root .mark .w {{ display:inline-block; opacity:0; margin:0 .12em; }}
    #root .cn {{ position:absolute; left:0; right:0; top:726px; text-align:center;
      font-size:44px; opacity:0; font-family:{st['fdisp']}; }}
    #root .sub {{ position:absolute; left:0; right:0; top:800px; text-align:center;
      font-size:29px; opacity:0; }}
    #root .btns {{ position:absolute; left:0; right:0; top:866px; display:flex; justify-content:center; gap:24px; }}
    #root .btn {{ padding:14px 36px; font-size:24px; font-weight:600; opacity:0;
      border:2px solid {st['ink']}; color:{st['ink']}; border-radius:{'999px' if 'capsule' in pid or 'blue' in pid else '0px'}; }}
    #root .fine {{ position:absolute; left:0; right:0; top:946px; text-align:center;
      font-size:19px; opacity:0; font-family:{st['fmono']}; }}
  </style>
  <div id="root" data-composition-id="03-cta" data-width="1920" data-height="1080" data-duration="11">
    <div id="03-cta-bg" class="clip bg" data-start="0" data-duration="11" data-track-index="0"></div>
    <div id="03-cta-pet" class="clip pet" data-start="0.15" data-duration="10.85" data-track-index="1">
      <img src="assets/heterochromia-cat-idle.png" alt="">
    </div>
    <div id="03-cta-mark" class="clip mark" data-start="0.9" data-duration="10.1" data-track-index="2">
      <span class="w">LOOK</span><span class="w">ME</span>
    </div>
    <div id="03-cta-cn" class="clip cn" data-start="1.9" data-duration="9.1" data-track-index="3">· {CTA_CN} ·</div>
    <div id="03-cta-sub" class="clip sub" data-start="2.7" data-duration="8.3" data-track-index="4">{CTA_SUB}</div>
    <div id="03-cta-btns" class="clip btns" data-start="3.6" data-duration="7.4" data-track-index="5">{btns}
    </div>
    <div id="03-cta-fine" class="clip fine" data-start="7.4" data-duration="3.6" data-track-index="6">{CTA_FINE}</div>
  </div>
  <script>
    window.__timelines = window.__timelines || {{}};
    (function () {{
      var $ = function (id) {{ return document.getElementById(id); }};
      var tl = gsap.timeline({{ paused: true, defaults: {{ ease: "power3.out" }} }});
      tl.fromTo($("03-cta-pet"), {{opacity:0, y:46}}, {{opacity:1, y:0, duration:.75}}, 0.2);
      tl.fromTo("#root .mark .w", {{opacity:0, y:40}}, {{opacity:1, y:0, duration:.55, stagger:.22}}, 1.0);
      tl.fromTo($("03-cta-cn"), {{opacity:0}}, {{opacity:1, duration:.45}}, 2.0);
      tl.fromTo($("03-cta-sub"), {{opacity:0, y:16}}, {{opacity:.9, y:0, duration:.45}}, 2.8);
      ["03-cta-b0","03-cta-b1","03-cta-b2"].forEach(function (b, i) {{
        tl.fromTo($(b), {{opacity:0, y:26}}, {{opacity:1, y:0, duration:.42}}, 3.8 + i * .3);
      }});
      tl.fromTo($("03-cta-fine"), {{opacity:0}}, {{opacity:.8, duration:.4}}, 7.5);
      window.__timelines["03-cta"] = tl;
    }})();
  </script>
</template>'''

def storyboard(st):
    return f'''---
format: 1920x1080
duration: 45s
message: "Look Me · {st['name']}风格样片——泪膜只能撑 10 秒，猫咪伙伴替你记着"
arc: PAS（数字钩子 → 全功能展示 → CTA）
audience: 长时间盯屏的开发者与办公人群
mode: autonomous
music: none
---

## Frame 1 — Hook · {st['name']}

- scene: {st['name']}风格开场：径向光斑衬底，「泪膜只能撑 10 秒」display 字落，猫咪登场
- duration: 10s
- transition_in: cut
- status: outline
- src: compositions/frames/01-hook.html

## Frame 2 — 他为你做的事（6 项功能全景）

- scene: {st['name']}风格容器逐张点亮：眨眼守护/远眺/起身/哈欠镜像/小剧场/守口如瓶
- duration: 24s
- transition_in: cut
- status: outline
- src: compositions/frames/02-feats.html

## Frame 3 — CTA

- scene: {st['name']}风格字标 LOOK ME + 三平台按钮 + v0.1.1 边界声明
- duration: 11s
- transition_in: cut
- status: outline
- src: compositions/frames/03-cta.html
'''

# ---------- 生成 ----------
os.makedirs(f'{TPL}/compositions/frames', exist_ok=True)
for pid, st in S.items():
    proj = f'{ROOT}/s-{pid}'
    # 从模板复制项目骨架
    if os.path.exists(proj): shutil.rmtree(proj)
    os.makedirs(f'{proj}/compositions/frames', exist_ok=True)
    for f in ['hyperframes.json', 'package.json', 'AGENTS.md', 'CLAUDE.md', 'index.html']:
        src = f'{TPL}/{f}'
        if os.path.exists(src): shutil.copy(src, f'{proj}/{f}')
    meta = json.load(open(f'{TPL}/meta.json')) if os.path.exists(f'{TPL}/meta.json') else {}
    meta['id'] = pid; meta['name'] = f's-{pid}'
    json.dump(meta, open(f'{proj}/meta.json', 'w'), indent=2)
    # assets
    os.makedirs(f'{proj}/assets', exist_ok=True)
    shutil.copy(f'{ASSETS_SRC}/heterochromia-cat-idle.png', f'{proj}/assets/')
    # storyboard + frames
    open(f'{proj}/STORYBOARD.md', 'w').write(storyboard(st))
    open(f'{proj}/compositions/frames/01-hook.html', 'w').write(frame1_hook(st, pid))
    open(f'{proj}/compositions/frames/02-feats.html', 'w').write(frame2_feats(st, pid))
    open(f'{proj}/compositions/frames/03-cta.html', 'w').write(frame3_cta(st, pid))
    print(f'{proj}: 3 frames')
print('done')
