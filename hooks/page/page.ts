/**
 * The mod's page, whole: a browser of every Claude Code session on this machine. The hub serves it inside its shell;
 * /hub.js gives it `window.hub` (the state the mod pushes, the actions the page sends, the hub's language and theme).
 * A raw template: backslashes stay as written, and there is no backtick or dollar-brace in here, so the page's own
 * script builds its strings by concatenation.
 * The page never rebuilds what is on screen: every render is morphed into the DOM that is there, so typing in the
 * search box, a new state from the mod or opening a card changes only what changed, and focus stays where it is.
 */
const SOURCE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sessions</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
:root{--bg:#F6F5F1;--surface:#FFFFFF;--surface2:#F0EEE9;--border:#E4E1DA;--border2:#D3CFC6;--text:#1E1D1A;--muted:#64625C;--faint:#77756E;--claude:#B9552F;--claude-soft:rgba(185,85,47,.08);--claude-line:rgba(185,85,47,.42);--sugg:#4351C7;--sugg-soft:rgba(67,81,199,.08);--sugg-line:rgba(67,81,199,.45);--warn:#8F5B00;--warn-soft:rgba(214,152,20,.11);--warn-dot:#D69814;--ok:#2A7A3D;--ok-soft:rgba(42,122,61,.09);--ok-dot:#2F9447;--bad:#B3261E;--hit:rgba(214,152,20,.30);--hit-cur:#E3A21A;--hit-cur-fg:#1E1D1A;--ring:rgba(67,81,199,.28);--on-accent:#FFFFFF;--shadow:0 1px 2px rgba(30,25,10,.04),0 6px 20px rgba(30,25,10,.05);--toast:#1E1D1A;--toast-fg:#F4F3EF;--bar:#D3CFC6;--paneh:744px;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#121211;--surface:#1A1A19;--surface2:#242422;--border:#2B2B29;--border2:#3A3A37;--text:#EDECE8;--muted:#A6A59F;--faint:#8C8B85;--claude:#E3845F;--claude-soft:rgba(227,132,95,.10);--claude-line:rgba(227,132,95,.45);--sugg:#AEB6FA;--sugg-soft:rgba(174,182,250,.10);--sugg-line:rgba(174,182,250,.45);--warn:#F2B735;--warn-soft:rgba(242,183,53,.09);--warn-dot:#F2B735;--ok:#66C47A;--ok-soft:rgba(102,196,122,.09);--ok-dot:#66C47A;--bad:#F2877E;--hit:rgba(242,183,53,.26);--hit-cur:#F2B735;--hit-cur-fg:#141413;--ring:rgba(174,182,250,.35);--on-accent:#17120F;--shadow:0 1px 2px rgba(0,0,0,.35);--toast:#EDECE8;--toast-fg:#141413;--bar:#3A3A37;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#121211;--surface:#1A1A19;--surface2:#242422;--border:#2B2B29;--border2:#3A3A37;--text:#EDECE8;--muted:#A6A59F;--faint:#8C8B85;--claude:#E3845F;--claude-soft:rgba(227,132,95,.10);--claude-line:rgba(227,132,95,.45);--sugg:#AEB6FA;--sugg-soft:rgba(174,182,250,.10);--sugg-line:rgba(174,182,250,.45);--warn:#F2B735;--warn-soft:rgba(242,183,53,.09);--warn-dot:#F2B735;--ok:#66C47A;--ok-soft:rgba(102,196,122,.09);--ok-dot:#66C47A;--bad:#F2877E;--hit:rgba(242,183,53,.26);--hit-cur:#F2B735;--hit-cur-fg:#141413;--ring:rgba(174,182,250,.35);--on-accent:#17120F;--shadow:0 1px 2px rgba(0,0,0,.35);--toast:#EDECE8;--toast-fg:#141413;--bar:#3A3A37;color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.45}
a{color:var(--sugg)}
button{font:inherit;cursor:pointer;color:inherit;border:0;background:none;padding:0}
button:disabled{cursor:default;opacity:.55}
:focus-visible{outline:2px solid var(--sugg);outline-offset:2px}
.rowbtn:focus-visible{outline-offset:-2px;border-radius:6px}
.ghost:hover:not(:disabled){background:var(--surface2)!important;color:var(--text)}
.btn-primary{background:var(--claude);color:var(--on-accent);transition:filter .15s,transform .1s}
.btn-primary:hover{filter:brightness(1.07)}
.btn-primary:active{transform:translateY(1px)}
.btn-primary kbd{background:transparent;color:inherit;border-color:rgba(255,255,255,.45)}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
kbd{font-family:'JetBrains Mono',monospace;font-size:11px;min-width:20px;height:20px;padding:0 5px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border2);border-bottom-width:2px;border-radius:5px;color:var(--muted);background:var(--surface)}
.seg{display:flex;background:var(--surface2);border-radius:9px;padding:3px;gap:2px}
.seg button{border:0;border-radius:7px;padding:4px 10px;font-size:12px;font-weight:600;transition:background .15s;color:var(--muted);background:transparent}
.seg button[aria-pressed="true"]{background:var(--surface);color:var(--text);box-shadow:var(--shadow)}
.sb{min-height:100vh;background:var(--bg);color:var(--text)}
.hdr{border-bottom:1px solid var(--border);background:var(--bg)}
.hdr-in{max-width:1440px;margin:0 auto;padding:10px 20px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px}
.brand{display:flex;align-items:center;gap:10px;flex:none}
.logo{width:32px;height:32px;border-radius:9px;background:var(--claude-soft);display:flex;align-items:center;justify-content:center;flex:none;color:var(--claude)}
.brand h1{margin:0;font-size:16px;font-weight:650;letter-spacing:-.01em}
.stats{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;flex:1 1 auto}
.stat{display:flex;align-items:baseline;gap:6px}
.stat .v{font-size:17px;font-weight:600}
.stat-l{font-size:12.5px;color:var(--muted)}
.spark{display:flex;align-items:flex-end;gap:2px;height:28px;padding:0 2px}
.spark span{width:5px;border-radius:2px 2px 0 0}
.hright{display:flex;align-items:center;gap:8px;flex:none;font-size:12px;color:var(--muted)}
.iconbtn{height:34px;border:1px solid var(--border);background:var(--surface);border-radius:9px;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--muted);padding:0 10px;font-size:12.5px}
.main{max-width:1440px;margin:0 auto;padding:14px 20px 20px;display:flex;flex-direction:column;gap:10px}
.srow{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch}
.tgls{display:contents}
.frow{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.pane{border:1px solid var(--border);background:var(--surface);border-radius:14px;height:var(--paneh);display:flex;flex-direction:column;min-width:0;overflow:hidden}
.scroll{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--border2) transparent}
.layout{display:grid;grid-template-columns:minmax(0,9fr) minmax(0,11fr);gap:16px;align-items:start}
.phead{flex:none;display:flex;align-items:center;gap:6px 8px;padding:10px 12px 10px 16px;border-bottom:1px solid var(--border);min-height:49px;flex-wrap:wrap}
.phead .fsel select{max-width:150px}
.phead{flex-wrap:nowrap}
.phead .lbl{min-width:0;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto}
.pfoot{flex:none;display:flex;flex-wrap:wrap;gap:4px 14px;padding:9px 16px;border-top:1px solid var(--border);font-size:11.5px;color:var(--muted)}
.pfoot span{display:inline-flex;align-items:center;gap:4px}
.lbl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);white-space:nowrap}
.trow{position:relative;display:flex;align-items:stretch;min-height:34px;border-radius:8px;margin:0 6px;transition:background .12s}
.trow:hover{background:var(--surface2)}
.trow.sel{background:var(--sugg-soft)}
.trow.sel .ttl{color:var(--sugg);font-weight:600}
.trow.dim{opacity:.55}
.trow.hrow{min-height:40px;margin-top:4px}
.pick{position:absolute;left:12px;top:0;bottom:0;width:22px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.pick input{accent-color:var(--sugg);width:15px;height:15px;margin:0;cursor:pointer}
.pick input:disabled{cursor:default;opacity:.45}
.trow.picked{background:var(--sugg-soft)}
.chev{width:22px;flex:none;border:0;background:transparent;display:flex;align-items:center;justify-content:center;color:var(--faint);padding:0;border-radius:6px}
.chev:hover{color:var(--text)}
.chev svg{transition:transform .15s}
.chev-sp{width:22px;flex:none}
.rowbtn{flex:1 1 auto;min-width:0;border:0;background:transparent;display:flex;align-items:center;gap:8px;padding:0 10px 0 2px;text-align:left;min-height:34px}
.rowbtn.two{flex-direction:column;align-items:stretch;justify-content:center;gap:3px;padding:6px 10px 6px 2px}
.rowbtn.two .r1{display:flex;align-items:flex-start;gap:8px;min-width:0}
.rowbtn.two .r1>.live-dot,.rowbtn.two .r1>.done-dot,.rowbtn.two .r1>.open-dot{margin-top:6px}
.rowbtn.two .r1>.arch-ic{margin-top:4px}
.rowbtn.two .r1>svg{margin-top:3px;flex:none}
.rowbtn.two .ttl{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.35;overflow-wrap:anywhere}
.rowbtn.two .r2{display:flex;align-items:center;gap:10px;padding-left:16px;min-width:0}
.rowbtn.two .r2 .c-br{flex:0 1 auto;max-width:none;margin-right:auto}
.rowbtn.two .r2 .c-fk,.rowbtn.two .r2 .c-n,.rowbtn.two .r2 .c-cost,.rowbtn.two .r2 .c-time{width:auto;font-size:11.5px}
.rowbtn.two .r2 .c-cost{color:var(--muted)}
.c-mem{flex:none;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--faint);white-space:nowrap}
.rail{width:18px;flex:none;position:relative}
.rail.line::before,.rail.tee::before,.rail.elbow::before{content:'';position:absolute;left:10px;top:0;bottom:0;border-left:1.5px solid var(--sugg-line)}
.rail.elbow::before{bottom:50%;border-bottom-left-radius:4px}
.rail.tee::after,.rail.elbow::after{content:'';position:absolute;left:10px;top:50%;width:8px;border-top:1.5px solid var(--sugg-line)}
.ttl{flex:1 1 auto;min-width:40px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13.5px}
.ttl.prompt{font-style:italic;color:var(--muted)}
.hint{flex:none;font-size:11.5px;color:var(--faint);white-space:nowrap}
.soon{flex:none;display:inline-flex;color:var(--warn)}
.c-br{flex:0 1 auto;max-width:118px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);background:var(--surface2);border-radius:6px;padding:1px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-fk{flex:none;width:30px;display:inline-flex;align-items:center;justify-content:flex-end;gap:2px;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--sugg)}
.c-n{flex:none;width:40px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--muted)}
.c-cost{flex:none;width:60px;text-align:right;font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--text)}
.c-time{flex:none;width:58px;text-align:right;font-size:12px;color:var(--muted);white-space:nowrap}
.meta{flex:none;font-size:12px;color:var(--muted);white-space:nowrap}
.pill{flex:none;display:inline-flex;align-items:center;gap:6px;height:20px;border-radius:999px;padding:0 8px;font-size:11.5px;font-weight:550;white-space:nowrap}
.pdot{width:6px;height:6px;border-radius:50%;background:currentColor}
.live-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--ok-dot);box-shadow:0 0 0 0 var(--ok-dot);animation:sbPulse 1.8s infinite}
.done-dot{flex:none;width:8px;height:8px;border-radius:50%;border:1.5px solid var(--border2)}
.open-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--ok-dot)}
.arch-ic{flex:none;display:inline-flex;color:var(--faint)}
@keyframes sbPulse{0%{box-shadow:0 0 0 0 rgba(47,148,71,.45)}70%{box-shadow:0 0 0 6px rgba(47,148,71,0)}100%{box-shadow:0 0 0 0 rgba(47,148,71,0)}}
.spin{flex:none;width:9px;height:9px;border:1.6px solid currentColor;border-right-color:transparent;border-radius:50%;animation:sbSpin .8s linear infinite}
@keyframes sbSpin{to{transform:rotate(360deg)}}
.sk{height:10px;border-radius:5px;background:linear-gradient(90deg,var(--surface2) 0%,var(--border) 50%,var(--surface2) 100%);background-size:200% 100%;animation:sbSk 1.4s infinite linear}
@keyframes sbSk{from{background-position:200% 0}to{background-position:-200% 0}}
mark{background:var(--hit);color:inherit;border-radius:3px;padding:0 1px}
mark.cur{background:var(--hit-cur);color:var(--hit-cur-fg);box-shadow:0 0 0 2px var(--hit-cur)}
.sbox{flex:1 1 520px;min-width:0;position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-height:44px;padding:4px 8px 4px 38px;border:1px solid var(--border);background:var(--surface);border-radius:12px;transition:border-color .15s,box-shadow .15s}
.sbox:focus-within{border-color:var(--sugg);box-shadow:0 0 0 3px var(--ring)}
.sbox>svg{position:absolute;left:13px;top:14px}
.chips{display:contents}
.sinput{flex:1 1 220px;min-width:140px;border:0;background:transparent;height:34px;font:inherit;font-size:14px;color:var(--text);outline:none}
.sinput::placeholder,.field::placeholder{color:var(--faint)}
.clr[hidden]{display:none}
.clr{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--muted)}
.chip{display:inline-flex;align-items:center;height:26px;border-radius:7px;background:var(--sugg-soft);border:1px solid var(--sugg-line);font-family:'JetBrains Mono',monospace;font-size:12px;padding:0 2px 0 8px;gap:1px;max-width:260px}
.chip-k{color:var(--muted)}
.chip-v{color:var(--sugg);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip-x{border:0;background:transparent;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:5px;color:var(--muted);padding:0}
.chip-x:hover{background:var(--sugg-soft);color:var(--text)}
.tgl{display:inline-flex;align-items:center;gap:8px;min-height:44px;border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:0 14px;font-size:13px;font-weight:550;color:var(--text);white-space:nowrap}
.tgl[aria-pressed="true"]{border-color:var(--sugg);background:var(--sugg-soft);color:var(--sugg)}
.tgl:hover{border-color:var(--border2)}
.fsel{display:inline-flex;align-items:center;gap:6px;height:32px;border:1px solid var(--border);background:var(--surface);border-radius:9px;padding:0 4px 0 10px;font-size:12.5px;color:var(--muted)}
.fsel select{border:0;background:transparent;color:var(--text);font:inherit;font-size:12.5px;font-weight:550;height:30px;cursor:pointer;max-width:200px}
.fsel select:focus-visible{outline:none}
.fsel select option{background:var(--surface);color:var(--text)}
.fsel:focus-within{border-color:var(--sugg);box-shadow:0 0 0 3px var(--ring)}
.fsel.on{border-color:var(--sugg-line);background:var(--sugg-soft)}
.fchk{display:inline-flex;align-items:center;gap:7px;height:32px;border:1px solid var(--border);background:var(--surface);border-radius:9px;padding:0 10px;font-size:12.5px;color:var(--text);cursor:pointer}
.fchk input,.tgl input{accent-color:var(--sugg);width:15px;height:15px;margin:0}
.sec{border:1px solid var(--border);border-radius:12px;padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px;min-width:0}
.sec h3{margin:0;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.cgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.span2{grid-column:1 / -1}
.kvr{display:grid;grid-template-columns:minmax(118px,42%) minmax(0,1fr);gap:12px;font-size:13px;align-items:baseline}
.kvr>span:first-child{color:var(--muted)}
.dash{color:var(--faint)}
.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.linkbtn{border:0;background:transparent;padding:0;color:var(--sugg);font-weight:550;text-align:left;text-decoration:underline;text-decoration-color:var(--sugg-line);text-underline-offset:3px}
.linkbtn:hover{text-decoration-color:var(--sugg)}
.toolrow{display:flex;align-items:center;gap:8px;width:100%;border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:6px 10px;font-family:'JetBrains Mono',monospace;font-size:12px;text-align:left;color:var(--muted)}
.toolrow:hover{border-color:var(--border2);color:var(--text)}
.res-snip{display:flex;flex-direction:column;gap:3px;width:100%;border:0;background:transparent;border-radius:8px;padding:7px 10px;text-align:left;font-size:13px;line-height:1.5}
.res-snip:hover{background:var(--surface2)}
.back{display:none!important}
.abtn{flex:none;height:44px;border:1px solid var(--border2);background:var(--surface);border-radius:11px;padding:0 14px;font-size:13px;font-weight:550;display:inline-flex;align-items:center;gap:8px;color:var(--text);text-decoration:none}
.abtn.warn{border-color:var(--warn-dot);color:var(--warn)}
.sbtn{flex:none;height:30px;border:1px solid var(--border2);background:var(--surface);border-radius:8px;padding:0 10px;font-size:12.5px;font-weight:550;display:inline-flex;align-items:center;gap:6px;color:var(--text);white-space:nowrap}
.qbtn{flex:none;height:26px;border:1px dashed var(--sugg-line);background:transparent;border-radius:999px;padding:0 10px;font-size:12px;font-weight:500;color:var(--sugg);white-space:nowrap}
.qbtn:hover{background:var(--sugg-soft)}
.bulk{flex:none;border-top:1px solid var(--border);padding:10px 12px 10px 16px;display:flex;flex-direction:column;gap:8px;background:var(--surface)}
.fails{border-radius:10px;background:var(--warn-soft);color:var(--warn);padding:8px 10px 9px 12px;display:flex;flex-direction:column;gap:5px;font-size:12.5px}
.fails ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px;max-height:132px;overflow:auto}
.fails li{display:flex;gap:6px;min-width:0;color:var(--text)}
.fails li>span:last-child{color:var(--muted)}
.opnote{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--sugg)}
.fadein{animation:sbIn .25s cubic-bezier(.2,.7,.3,1)}
@keyframes sbIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10;background:var(--toast);color:var(--toast-fg);border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:calc(100vw - 32px);animation:sbToast .3s cubic-bezier(.2,.7,.3,1)}
@keyframes sbToast{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:40px 32px}
.empty h2{margin:4px 0 0;font-size:18px;font-weight:650}
.empty p{margin:0;color:var(--muted);max-width:400px;font-size:13.5px}
.note{margin:2px 12px 6px 48px;border-radius:10px;background:var(--warn-soft);color:var(--warn);padding:8px 10px 8px 12px;display:flex;align-items:center;gap:10px;font-size:12.5px}
.bubble{align-self:flex-start;max-width:100%;border-radius:4px 12px 12px 12px;padding:8px 12px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13.5px;line-height:1.55}
.msg{display:flex;gap:10px;align-items:flex-start}
.msg.copied{opacity:.78}
.av{width:28px;height:28px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:650}
.ctag{font-size:10.5px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--sugg);background:var(--sugg-soft);border-radius:5px;padding:1px 5px}
.flash{animation:sbFlash 1.6s ease-out}
@keyframes sbFlash{0%,40%{background:var(--sugg-soft)}100%{background:transparent}}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:1180px){.c-n{display:none}.spark{display:none!important}}
@media (max-width:980px){.layout{grid-template-columns:minmax(0,1fr)}.card-col{display:none}.sb.show-card .card-col{display:flex}.sb.show-card .tree-col{display:none}.back{display:inline-flex!important}}
@media (max-width:700px){.cgrid{grid-template-columns:minmax(0,1fr)}.c-br:not(.r2 .c-br){display:none}.stat-l{display:none}.main,.hdr-in{padding-left:16px;padding-right:16px}}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
</head>
<body>
<div class="sb" id="root">
<header class="hdr"><div class="hdr-in" id="hdr"></div></header>
<div class="main">
<div class="srow">
<div class="sbox">
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--faint)" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.6"></circle><path d="M10.5 10.5L14 14"></path></svg>
<span class="chips" id="chips"></span>
<input id="sb-search" class="sinput" type="text" autocomplete="off" spellcheck="false">
<button class="ghost clr" id="clr" data-act="clr" hidden><svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8"></path></svg></button>
<kbd style="margin-right:4px">/</kbd>
</div>
<span class="tgls" id="tgls"></span>
</div>
<div class="frow" id="frow"></div>
<div class="layout">
<section class="pane tree-col" id="left">
<div class="phead" id="phead"></div>
<div id="ftsbar"></div>
<div class="scroll" id="tbody"></div>
<div id="bulk"></div>
<div class="pfoot" id="pfoot"></div>
</section>
<section class="pane card-col" id="card"></section>
</div>
</div>
<div id="toast" aria-live="polite"></div>
</div>
<script src="/hub.js"></script>
<script>
(function () {
var DAY = 86400000, MIN = 60000, SOON = 7 * DAY

function pl(n, f) { var a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return f[2]; if (b > 1 && b < 5) return f[1]; if (b === 1) return f[0]; return f[2] }

var TEXTS = {
  ru: {
    page: 'Сессии', spendPeriod: 'Период расходов',
    pToday: 'Сегодня', pWeek: 'Неделя', pMonth: 'Месяц', spendFor: { today: 'за сегодня', week: 'за неделю', month: 'за месяц' },
    sparkLabel: function (v) { return 'Расходы по дням за 30 дней, всего ' + v }, sparkNote: 'расход сессии отнесён ко дню её последней активности',
    searchPh: 'Название, промпт, ветка, проект, файл…', searchPhMore: 'добавить условие…', searchLabel: 'Поиск по сессиям', clearSearch: 'Очистить поиск',
    inText: 'Искать в тексте', ftsHint: 'Полнотекстовый поиск по переписке (Enter)', semantic: 'Поиск по смыслу', semanticNote: 'использует модель, тратит токены',
    semanticOn: 'Поиск по смыслу включён — запрос уходит модели и тратит токены', semModel: function (m) { return 'модель: ' + m },
    fHost: 'Хост', fProj: 'Проект', fPeriod: 'Период', fModel: 'Модель', fStatus: 'Статус', all: 'Все', pAll: 'Всё время', p1: 'Сегодня', p7: '7 дней', p30: '30 дней',
    stAll: 'Все', onlyForks: 'Только с форками', soon: 'Скоро удалятся', reset: 'Сбросить',
    treeLabel: 'Дерево сессий', treeHead: 'Хост → проект → сессия', sort: 'Сортировка', sLast: 'Последняя активность', sCost: 'Стоимость', sCreated: 'Дата создания',
    expandAll: 'Развернуть всё', collapseAll: 'Свернуть всё', found: function (n) { return 'найдено: ' + n },
    online: 'онлайн', offline: 'недоступен', indexing: 'индексирую',
    sessions: function (n) { return n + ' ' + pl(n, ['сессия', 'сессии', 'сессий']) },
    sumTip: function (p) { return 'Расходы ' + p }, noMatches: 'нет совпадений',
    msgsTip: 'Сообщений', forksTip: function (n) { return 'Дочерних форков: ' + n },
    hint: { prompt: 'в промпте', branch: 'в ветке', project: 'в пути', file: 'в файлах', id: 'в ID', text: 'в переписке' },
    noSession: 'Нет сессии Claude Code с этим модом — данные не обновляются, а действия подождут, пока она запустится.', retry: 'Обновить',
    firstSync: 'Первая синхронизация', syncWait: 'читаю ~/.claude/projects…',
    expand: 'Развернуть', collapse: 'Свернуть',
    kNav: 'дерево', kFold: 'свернуть', kSearch: 'поиск', kOpen: 'открыть', kCopy: 'resume', keysLabel: 'Клавиши',
    cardLabel: 'Карточка сессии', backList: 'К списку', copyResume: 'Скопировать', copied: 'Скопировано', showChat: 'Показать переписку',
    sessionId: 'ID', copyId: 'Скопировать ID', copy: 'Скопировать',
    runLocal: function (p) { return 'Выполнить в ' + p }, noCwd: 'папка неизвестна — выполнить где угодно',
    forkDepth: function (d) { return d === 1 ? 'Форк' : 'Форк ' + d + '-го уровня' },
    secTime: 'Время', start: 'Начало', lastAct: 'Последняя активность', duration: 'Длительность', modelTime: 'Работа модели', toolTime: 'Работа инструментов', stillGoing: 'идёт',
    delAt: 'Удалится', delIn: function (n) { return n < 1 ? 'сегодня' : 'через ' + n + ' дн.' }, delLive: 'идёт сейчас — не удаляется', soonTip: function (d) { return 'Удалится ' + d },
    keep: function (n) { return 'хранятся ' + n + ' дн.' }, keepTip: 'Claude Code удаляет файл сессии через столько дней после последнего изменения (cleanupPeriodDays)',
    refresh: 'Обновить', refreshTip: 'Перечитать сессии', refreshing: 'Обновляю список сессий…', updated: function (v) { return 'обновлено ' + v },
    secModel: 'Модель и режим', models: 'Модели', effort: 'Effort', perm: 'Разрешения', origin: 'Где запущена', version: 'Версия Claude Code',
    permD: { 'default': 'default — спрашивать', acceptEdits: 'acceptEdits — правки без вопросов', auto: 'auto — одобрять безопасное', plan: 'plan — только план', bypassPermissions: 'bypass — без проверок' },
    originD: { cli: 'CLI (терминал)', 'claude-desktop': 'Desktop', 'claude-vscode': 'VS Code', 'sdk-ts': 'SDK (TypeScript)', 'sdk-py': 'SDK (Python)' },
    secMoney: 'Деньги и токены', perMsg: function (v) { return '≈ ' + v + ' за сообщение' }, tIn: 'Вход', tOut: 'Выход', tCr: 'Чтение кеша', tCw: 'Запись в кеш', tTh: 'Размышления', byModel: 'По моделям', webSearch: 'Веб-поиски',
    costUnknown: 'Цена одной из моделей неизвестна — сумма неполная',
    secWork: 'Что делалось', firstPrompt: 'Первый промпт', lastPrompt: 'Последний промпт', msgsMine: 'Моих', msgsClaude: 'Ответов Claude', lines: 'Строки', subagents: 'Сабагенты',
    toolsL: 'Инструменты', noTools: 'не вызывались', filesL: 'Изменённые файлы', moreFiles: function (n) { return 'ещё ' + n },
    secLinks: 'Связи', parent: 'Родитель', notFork: 'не форк, корневая сессия', forkedAt: function (n) { return 'ответвилась на сообщении №' + n }, fromMsg: function (n) { return 'с №' + n },
    missing: 'нет в списке', showPlace: 'показать место', children: 'Дочерние форки', forkTree: 'Дерево форков', treeTotal: 'Всего', root: 'корень',
    backCard: 'К карточке', findIn: 'Найти в переписке', prev: 'Предыдущее совпадение', next: 'Следующее совпадение', nOf: function (a, b) { return a + ' из ' + b }, noHits: 'нет совпадений',
    you: 'Вы', showTools: 'Инструменты', gap: function (n) { return 'Свёрнуто ' + n + ' ' + pl(n, ['сообщение', 'сообщения', 'сообщений']) },
    forkHere: function (t) { return 'Здесь ответвился форк «' + t + '»' }, open: 'Открыть', openParent: 'Открыть родителя', copiedTag: 'из родителя',
    forkStart: function (t, n) { return 'Форк от «' + t + '», продолжение после сообщения №' + n }, working: 'Claude работает…',
    readerMeta: function (n, h) { return n + ' ' + pl(n, ['сообщение', 'сообщения', 'сообщений']) + ' · ' + h },
    ftsTitle: 'В тексте переписки', withTools: 'Включая вывод инструментов', backToTree: 'К дереву', toolOut: 'вывод', toolCall: 'вызов', ftsNoneTitle: function (q) { return 'В переписке нет «' + q + '»' },
    ftsNoneHint: 'Попробуйте другую формулировку или снимите фильтры.', ftsSearching: 'ищу…', ftsNeedQuery: 'Введите, что искать в тексте',
    ftsStats: function (s, ms) { return 'просмотрено ' + s + ' ' + pl(s, ['сессия', 'сессии', 'сессий']) + ' · ' + ms + ' мс' }, ftsCut: 'показаны не все совпадения',
    semTitle: 'По смыслу', semRun: 'Спрашиваю модель…', semNone: 'Модель ничего не нашла', semCost: function (v) { return 'запрос стоил ≈ ' + v }, error: 'Ошибка',
    emptyTitle: 'Ничего не найдено', emptyHint: function (q) { return 'Ни одна сессия не подходит под ' + q + '. Можно поискать в самом тексте переписки или сбросить фильтры.' },
    tryText: 'Искать в тексте переписки', resetFilters: 'Сбросить фильтры', offlineMiss: function (h) { return h + ' недоступен — список мог устареть.' },
    noneTitle: 'Сессий пока нет', noneHint: 'Они появятся здесь сами после первого запуска claude в любом проекте. Хаб читает ~/.claude/projects на этом компьютере.',
    pickTitle: 'Выберите сессию', pickHint: 'Слева — дерево сессий. ↑↓ — перемещение, Enter — открыть.',
    loading: 'Подгружаю сообщения…', now: 'сейчас', yesterday: 'вчера', u: { m: 'мин', h: 'ч', d: 'д' },
    mon: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'], removeChip: 'Убрать условие',
    actL: { working: 'работает', open: 'открыта', archived: 'в архиве', closed: 'закрыта' },
    actTip: { working: 'Процесс запущен, и Claude сейчас работает', open: 'Процесс запущен, но простаивает: Claude Desktop держит его, пока чат не в архиве, и он занимает память', archived: 'В архиве Claude Desktop: процесса нет, переписка сохранена, сессию можно вернуть', closed: 'Процесса нет' },
    stWorking: 'Работают', stOpen: 'Открыты', stArch: 'В архиве', stClosed: 'Закрыты',
    hWorking: function (n) { return pl(n, ['работает', 'работают', 'работают']) }, hOpen: function (n) { return pl(n, ['открыта', 'открыты', 'открыты']) },
    hWorkingTip: 'Сессии, в которых Claude работает прямо сейчас',
    hOpenTip: 'Открыты, но простаивают: Claude Desktop держит процесс каждой сессии, пока её чат не в архиве, и этот процесс занимает память',
    hMemTip: 'Память всех запущенных процессов сессий (в RAM и в свопе). Архивирование в Claude Desktop завершает процесс и освобождает её',
    mb: 'МБ', gb: 'ГБ', memHeld: 'памяти у процессов', stateL: 'Состояние', memL: 'Память процесса', sMem: 'Память', sIdle: 'Дольше простаивает',
    openApp: 'Открыть в Claude Desktop', openAppNote: 'Ссылка срабатывает, когда хаб открыт в обычном браузере (Chrome и т. п.); встроенный браузер Claude такие ссылки не открывает',
    archive: 'Архивировать', unarchive: 'Вернуть из архива',
    archiveTip: 'Claude Desktop завершит процесс сессии; переписка останется, сессию можно вернуть из архива. Подтвердить нужно в окне Claude Desktop',
    unarchiveTip: 'Вернуть сессию из архива Claude Desktop. Подтвердить нужно в окне Claude Desktop',
    appUnknown: 'Claude Desktop не знает эту сессию', appNoState: 'Claude Desktop не сообщил, в архиве ли эта сессия', appWait: 'Жду ответа от Claude Desktop…', appOld: 'Страницу заполняет старая версия мода в другой сессии Claude Code — обновите мод там или перезапустите ту сессию',
    appUnavail: function (e) { return 'Claude Desktop недоступен' + (e ? ': ' + e : '') },
    appNote: function (e) { return 'Архивирование и открытие в Claude Desktop недоступны' + (e ? ': ' + e : '') },
    opBusy: 'Дождитесь окончания текущей операции',
    confirmWorking: 'Claude сейчас работает в этой сессии. Всё равно архивировать?\n\nClaude Desktop откажется архивировать сессию посреди ответа, закреплённую или открытую на экране.',
    confirmWorkingN: function (n) { return 'Claude сейчас работает в ' + n + ' ' + pl(n, ['выбранной сессии', 'выбранных сессиях', 'выбранных сессиях']) + '. Всё равно архивировать?\n\nClaude Desktop откажется архивировать сессии посреди ответа, закреплённые или открытые на экране.' },
    confirmApp: 'Подтвердите в окне Claude Desktop',
    opRun: function (k, n) { return (k === 'archive' ? 'Архивирую ' : 'Возвращаю из архива ') + n + '… подтвердите в Claude Desktop' },
    opDone: function (k, a, n) { return (k === 'archive' ? 'Заархивировано ' : 'Возвращено из архива ') + a + ' из ' + n },
    opErr: function (k) { return k === 'archive' ? 'Не удалось архивировать' : 'Не удалось вернуть из архива' },
    opFails: function (k) { return k === 'archive' ? 'Не заархивированы' : 'Не возвращены' }, noReason: 'причина не указана', dismiss: 'Скрыть',
    select: 'Выбрать', selectTip: 'Выбрать несколько сессий, чтобы архивировать или вернуть их разом',
    selCount: function (n) { return 'Выбрано ' + n }, pickL: function (s) { return 'Выбрать: ' + s },
    pickIdle: 'Открытые, простаивают > 1 дня', pickOpen: 'Все открытые, кроме работающих', cancel: 'Отмена'
  },
  uk: {
    page: 'Сесії', spendPeriod: 'Період витрат',
    pToday: 'Сьогодні', pWeek: 'Тиждень', pMonth: 'Місяць', spendFor: { today: 'за сьогодні', week: 'за тиждень', month: 'за місяць' },
    sparkLabel: function (v) { return 'Витрати по днях за 30 днів, усього ' + v }, sparkNote: 'витрати сесії віднесено до дня її останньої активності',
    searchPh: 'Назва, промпт, гілка, проєкт, файл…', searchPhMore: 'додати умову…', searchLabel: 'Пошук по сесіях', clearSearch: 'Очистити пошук',
    inText: 'Шукати в тексті', ftsHint: 'Повнотекстовий пошук у листуванні (Enter)', semantic: 'Пошук за змістом', semanticNote: 'використовує модель, витрачає токени',
    semanticOn: 'Пошук за змістом увімкнено — запит іде моделі й витрачає токени', semModel: function (m) { return 'модель: ' + m },
    fHost: 'Хост', fProj: 'Проєкт', fPeriod: 'Період', fModel: 'Модель', fStatus: 'Статус', all: 'Усі', pAll: 'Увесь час', p1: 'Сьогодні', p7: '7 днів', p30: '30 днів',
    stAll: 'Усі', onlyForks: 'Лише з форками', soon: 'Скоро буде видалено', reset: 'Скинути',
    treeLabel: 'Дерево сесій', treeHead: 'Хост → проєкт → сесія', sort: 'Сортування', sLast: 'Остання активність', sCost: 'Вартість', sCreated: 'Дата створення',
    expandAll: 'Розгорнути все', collapseAll: 'Згорнути все', found: function (n) { return 'знайдено: ' + n },
    online: 'онлайн', offline: 'недоступний', indexing: 'індексую',
    sessions: function (n) { return n + ' ' + pl(n, ['сесія', 'сесії', 'сесій']) },
    sumTip: function (p) { return 'Витрати ' + p }, noMatches: 'немає збігів',
    msgsTip: 'Повідомлень', forksTip: function (n) { return 'Дочірніх форків: ' + n },
    hint: { prompt: 'у промпті', branch: 'у гілці', project: 'у шляху', file: 'у файлах', id: 'в ID', text: 'у листуванні' },
    noSession: 'Немає сесії Claude Code з цим модом — дані не оновлюються, а дії зачекають, доки вона запуститься.', retry: 'Оновити',
    firstSync: 'Перша синхронізація', syncWait: 'читаю ~/.claude/projects…',
    expand: 'Розгорнути', collapse: 'Згорнути',
    kNav: 'дерево', kFold: 'згорнути', kSearch: 'пошук', kOpen: 'відкрити', kCopy: 'resume', keysLabel: 'Клавіші',
    cardLabel: 'Картка сесії', backList: 'До списку', copyResume: 'Скопіювати', copied: 'Скопійовано', showChat: 'Показати листування',
    sessionId: 'ID', copyId: 'Скопіювати ID', copy: 'Скопіювати',
    runLocal: function (p) { return 'Виконати в ' + p }, noCwd: 'тека невідома — виконати будь-де',
    forkDepth: function (d) { return d === 1 ? 'Форк' : 'Форк ' + d + '-го рівня' },
    secTime: 'Час', start: 'Початок', lastAct: 'Остання активність', duration: 'Тривалість', modelTime: 'Робота моделі', toolTime: 'Робота інструментів', stillGoing: 'триває',
    delAt: 'Буде видалено', delIn: function (n) { return n < 1 ? 'сьогодні' : 'через ' + n + ' дн.' }, delLive: 'триває зараз — не видаляється', soonTip: function (d) { return 'Буде видалено ' + d },
    keep: function (n) { return 'зберігаються ' + n + ' дн.' }, keepTip: 'Claude Code видаляє файл сесії через стільки днів після останньої зміни (cleanupPeriodDays)',
    refresh: 'Оновити', refreshTip: 'Перечитати сесії', refreshing: 'Оновлюю список сесій…', updated: function (v) { return 'оновлено ' + v },
    secModel: 'Модель і режим', models: 'Моделі', effort: 'Effort', perm: 'Дозволи', origin: 'Де запущено', version: 'Версія Claude Code',
    permD: { 'default': 'default — питати', acceptEdits: 'acceptEdits — правки без питань', auto: 'auto — схвалювати безпечне', plan: 'plan — лише план', bypassPermissions: 'bypass — без перевірок' },
    originD: { cli: 'CLI (термінал)', 'claude-desktop': 'Desktop', 'claude-vscode': 'VS Code', 'sdk-ts': 'SDK (TypeScript)', 'sdk-py': 'SDK (Python)' },
    secMoney: 'Гроші й токени', perMsg: function (v) { return '≈ ' + v + ' за повідомлення' }, tIn: 'Вхід', tOut: 'Вихід', tCr: 'Читання кешу', tCw: 'Запис у кеш', tTh: 'Міркування', byModel: 'За моделями', webSearch: 'Вебпошуки',
    costUnknown: 'Ціна однієї з моделей невідома — сума неповна',
    secWork: 'Що робилося', firstPrompt: 'Перший промпт', lastPrompt: 'Останній промпт', msgsMine: 'Моїх', msgsClaude: 'Відповідей Claude', lines: 'Рядки', subagents: 'Субагенти',
    toolsL: 'Інструменти', noTools: 'не викликалися', filesL: 'Змінені файли', moreFiles: function (n) { return 'ще ' + n },
    secLinks: 'Зв’язки', parent: 'Батьківська', notFork: 'не форк, коренева сесія', forkedAt: function (n) { return 'відгалузилася на повідомленні №' + n }, fromMsg: function (n) { return 'з №' + n },
    missing: 'немає в списку', showPlace: 'показати місце', children: 'Дочірні форки', forkTree: 'Дерево форків', treeTotal: 'Усього', root: 'корінь',
    backCard: 'До картки', findIn: 'Знайти в листуванні', prev: 'Попередній збіг', next: 'Наступний збіг', nOf: function (a, b) { return a + ' з ' + b }, noHits: 'немає збігів',
    you: 'Ви', showTools: 'Інструменти', gap: function (n) { return 'Згорнуто ' + n + ' ' + pl(n, ['повідомлення', 'повідомлення', 'повідомлень']) },
    forkHere: function (t) { return 'Тут відгалузився форк «' + t + '»' }, open: 'Відкрити', openParent: 'Відкрити батьківську', copiedTag: 'з батьківської',
    forkStart: function (t, n) { return 'Форк від «' + t + '», продовження після повідомлення №' + n }, working: 'Claude працює…',
    readerMeta: function (n, h) { return n + ' ' + pl(n, ['повідомлення', 'повідомлення', 'повідомлень']) + ' · ' + h },
    ftsTitle: 'У тексті листування', withTools: 'Разом із виводом інструментів', backToTree: 'До дерева', toolOut: 'вивід', toolCall: 'виклик', ftsNoneTitle: function (q) { return 'У листуванні немає «' + q + '»' },
    ftsNoneHint: 'Спробуйте інше формулювання або зніміть фільтри.', ftsSearching: 'шукаю…', ftsNeedQuery: 'Введіть, що шукати в тексті',
    ftsStats: function (s, ms) { return 'переглянуто ' + s + ' ' + pl(s, ['сесію', 'сесії', 'сесій']) + ' · ' + ms + ' мс' }, ftsCut: 'показано не всі збіги',
    semTitle: 'За змістом', semRun: 'Питаю модель…', semNone: 'Модель нічого не знайшла', semCost: function (v) { return 'запит коштував ≈ ' + v }, error: 'Помилка',
    emptyTitle: 'Нічого не знайдено', emptyHint: function (q) { return 'Жодна сесія не підходить під ' + q + '. Можна пошукати в самому тексті листування або скинути фільтри.' },
    tryText: 'Шукати в тексті листування', resetFilters: 'Скинути фільтри', offlineMiss: function (h) { return h + ' недоступний — список міг застаріти.' },
    noneTitle: 'Сесій поки немає', noneHint: 'Вони з’являться тут самі після першого запуску claude у будь-якому проєкті. Хаб читає ~/.claude/projects на цьому комп’ютері.',
    pickTitle: 'Оберіть сесію', pickHint: 'Ліворуч — дерево сесій. ↑↓ — переміщення, Enter — відкрити.',
    loading: 'Підвантажую повідомлення…', now: 'зараз', yesterday: 'учора', u: { m: 'хв', h: 'год', d: 'д' },
    mon: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'], removeChip: 'Прибрати умову',
    actL: { working: 'працює', open: 'відкрита', archived: 'в архіві', closed: 'закрита' },
    actTip: { working: 'Процес запущено, і Claude зараз працює', open: 'Процес запущено, але він простоює: Claude Desktop тримає його, доки чат не в архіві, і він займає пам’ять', archived: 'В архіві Claude Desktop: процесу немає, листування збережено, сесію можна повернути', closed: 'Процесу немає' },
    stWorking: 'Працюють', stOpen: 'Відкриті', stArch: 'В архіві', stClosed: 'Закриті',
    hWorking: function (n) { return pl(n, ['працює', 'працюють', 'працюють']) }, hOpen: function (n) { return pl(n, ['відкрита', 'відкриті', 'відкритих']) },
    hWorkingTip: 'Сесії, у яких Claude працює просто зараз',
    hOpenTip: 'Відкриті, але простоюють: Claude Desktop тримає процес кожної сесії, доки її чат не в архіві, і цей процес займає пам’ять',
    hMemTip: 'Пам’ять усіх запущених процесів сесій (у RAM і у свопі). Архівування в Claude Desktop завершує процес і звільняє її',
    mb: 'МБ', gb: 'ГБ', memHeld: 'пам’яті в процесів', stateL: 'Стан', memL: 'Пам’ять процесу', sMem: 'Пам’ять', sIdle: 'Найдовше простоює',
    openApp: 'Відкрити в Claude Desktop', openAppNote: 'Посилання спрацьовує, коли хаб відкрито у звичайному браузері (Chrome тощо); вбудований браузер Claude такі посилання не відкриває',
    archive: 'Архівувати', unarchive: 'Повернути з архіву',
    archiveTip: 'Claude Desktop завершить процес сесії; листування залишиться, сесію можна повернути з архіву. Підтвердити треба у вікні Claude Desktop',
    unarchiveTip: 'Повернути сесію з архіву Claude Desktop. Підтвердити треба у вікні Claude Desktop',
    appUnknown: 'Claude Desktop не знає цієї сесії', appNoState: 'Claude Desktop не повідомив, чи ця сесія в архіві', appWait: 'Чекаю на відповідь від Claude Desktop…', appOld: 'Сторінку заповнює стара версія мода в іншій сесії Claude Code — оновіть мод там або перезапустіть ту сесію',
    appUnavail: function (e) { return 'Claude Desktop недоступний' + (e ? ': ' + e : '') },
    appNote: function (e) { return 'Архівування й відкриття в Claude Desktop недоступні' + (e ? ': ' + e : '') },
    opBusy: 'Дочекайтеся завершення поточної операції',
    confirmWorking: 'Claude зараз працює в цій сесії. Усе одно архівувати?\n\nClaude Desktop відмовиться архівувати сесію посеред відповіді, закріплену або відкриту на екрані.',
    confirmWorkingN: function (n) { return 'Claude зараз працює в ' + n + ' ' + pl(n, ['вибраній сесії', 'вибраних сесіях', 'вибраних сесіях']) + '. Усе одно архівувати?\n\nClaude Desktop відмовиться архівувати сесії посеред відповіді, закріплені або відкриті на екрані.' },
    confirmApp: 'Підтвердіть у вікні Claude Desktop',
    opRun: function (k, n) { return (k === 'archive' ? 'Архівую ' : 'Повертаю з архіву ') + n + '… підтвердіть у Claude Desktop' },
    opDone: function (k, a, n) { return (k === 'archive' ? 'Заархівовано ' : 'Повернуто з архіву ') + a + ' з ' + n },
    opErr: function (k) { return k === 'archive' ? 'Не вдалося архівувати' : 'Не вдалося повернути з архіву' },
    opFails: function (k) { return k === 'archive' ? 'Не заархівовано' : 'Не повернуто' }, noReason: 'причину не вказано', dismiss: 'Сховати',
    select: 'Вибрати', selectTip: 'Вибрати кілька сесій, щоб архівувати чи повернути їх разом',
    selCount: function (n) { return 'Вибрано ' + n }, pickL: function (s) { return 'Вибрати: ' + s },
    pickIdle: 'Відкриті, простоюють > 1 дня', pickOpen: 'Усі відкриті, крім тих, що працюють', cancel: 'Скасувати'
  },
  en: {
    page: 'Sessions', spendPeriod: 'Spend period',
    pToday: 'Today', pWeek: 'Week', pMonth: 'Month', spendFor: { today: 'today', week: 'this week', month: 'this month' },
    sparkLabel: function (v) { return 'Daily spend over 30 days, total ' + v }, sparkNote: "a session's cost is counted on the day of its last activity",
    searchPh: 'Title, prompt, branch, project, file…', searchPhMore: 'add a condition…', searchLabel: 'Search sessions', clearSearch: 'Clear search',
    inText: 'Search in text', ftsHint: 'Full-text search across conversations (Enter)', semantic: 'Search by meaning', semanticNote: 'uses a model, spends tokens',
    semanticOn: 'Search by meaning is on — the query goes to a model and spends tokens', semModel: function (m) { return 'model: ' + m },
    fHost: 'Host', fProj: 'Project', fPeriod: 'Period', fModel: 'Model', fStatus: 'Status', all: 'All', pAll: 'All time', p1: 'Today', p7: '7 days', p30: '30 days',
    stAll: 'All', onlyForks: 'Only with forks', soon: 'Deleted soon', reset: 'Reset',
    treeLabel: 'Session tree', treeHead: 'Host → project → session', sort: 'Sort', sLast: 'Last activity', sCost: 'Cost', sCreated: 'Date created',
    expandAll: 'Expand all', collapseAll: 'Collapse all', found: function (n) { return n + ' found' },
    online: 'online', offline: 'unreachable', indexing: 'indexing',
    sessions: function (n) { return n + (n === 1 ? ' session' : ' sessions') },
    sumTip: function (p) { return 'Spend ' + p }, noMatches: 'no matches',
    msgsTip: 'Messages', forksTip: function (n) { return 'Child forks: ' + n },
    hint: { prompt: 'in prompt', branch: 'in branch', project: 'in path', file: 'in files', id: 'in ID', text: 'in conversation' },
    noSession: 'No Claude Code session with this mod is running — the data is not updating, and actions wait until one starts.', retry: 'Refresh',
    firstSync: 'First sync', syncWait: 'reading ~/.claude/projects…',
    expand: 'Expand', collapse: 'Collapse',
    kNav: 'tree', kFold: 'fold', kSearch: 'search', kOpen: 'open', kCopy: 'resume', keysLabel: 'Keys',
    cardLabel: 'Session card', backList: 'Back to list', copyResume: 'Copy', copied: 'Copied', showChat: 'Show conversation',
    sessionId: 'ID', copyId: 'Copy ID', copy: 'Copy',
    runLocal: function (p) { return 'Run in ' + p }, noCwd: 'folder unknown — run anywhere',
    forkDepth: function (d) { return d === 1 ? 'Fork' : 'Level-' + d + ' fork' },
    secTime: 'Time', start: 'Started', lastAct: 'Last activity', duration: 'Duration', modelTime: 'Model time', toolTime: 'Tool time', stillGoing: 'running',
    delAt: 'Will be deleted', delIn: function (n) { return n < 1 ? 'today' : 'in ' + n + (n === 1 ? ' day' : ' days') }, delLive: 'running now — not deleted', soonTip: function (d) { return 'Will be deleted ' + d },
    keep: function (n) { return 'kept ' + n + ' days' }, keepTip: 'Claude Code deletes a session file this many days after its last change (cleanupPeriodDays)',
    refresh: 'Refresh', refreshTip: 'Re-read the sessions', refreshing: 'Refreshing the session list…', updated: function (v) { return 'updated ' + v },
    secModel: 'Model & mode', models: 'Models', effort: 'Effort', perm: 'Permissions', origin: 'Started from', version: 'Claude Code version',
    permD: { 'default': 'default — ask', acceptEdits: 'acceptEdits — edits without asking', auto: 'auto — approve safe actions', plan: 'plan — plan only', bypassPermissions: 'bypass — no checks' },
    originD: { cli: 'CLI (terminal)', 'claude-desktop': 'Desktop', 'claude-vscode': 'VS Code', 'sdk-ts': 'SDK (TypeScript)', 'sdk-py': 'SDK (Python)' },
    secMoney: 'Cost & tokens', perMsg: function (v) { return '≈ ' + v + ' per message' }, tIn: 'Input', tOut: 'Output', tCr: 'Cache read', tCw: 'Cache write', tTh: 'Thinking', byModel: 'By model', webSearch: 'Web searches',
    costUnknown: "One of the models' price is unknown — the sum is incomplete",
    secWork: 'What happened', firstPrompt: 'First prompt', lastPrompt: 'Last prompt', msgsMine: 'Mine', msgsClaude: 'Claude replies', lines: 'Lines', subagents: 'Subagents',
    toolsL: 'Tools', noTools: 'none called', filesL: 'Changed files', moreFiles: function (n) { return n + ' more' },
    secLinks: 'Relations', parent: 'Parent', notFork: 'not a fork, root session', forkedAt: function (n) { return 'branched off at message #' + n }, fromMsg: function (n) { return 'from #' + n },
    missing: 'not in the list', showPlace: 'show the spot', children: 'Child forks', forkTree: 'Fork tree', treeTotal: 'Total', root: 'root',
    backCard: 'Back to card', findIn: 'Find in conversation', prev: 'Previous match', next: 'Next match', nOf: function (a, b) { return a + ' of ' + b }, noHits: 'no matches',
    you: 'You', showTools: 'Tools', gap: function (n) { return n + (n === 1 ? ' message' : ' messages') + ' collapsed' },
    forkHere: function (t) { return 'Fork “' + t + '” branched off here' }, open: 'Open', openParent: 'Open parent', copiedTag: 'from parent',
    forkStart: function (t, n) { return 'Fork of “' + t + '”, continuing after message #' + n }, working: 'Claude is working…',
    readerMeta: function (n, h) { return n + (n === 1 ? ' message' : ' messages') + ' · ' + h },
    ftsTitle: 'In conversation text', withTools: 'Include tool output', backToTree: 'Back to tree', toolOut: 'output', toolCall: 'call', ftsNoneTitle: function (q) { return 'No “' + q + '” in any conversation' },
    ftsNoneHint: 'Try different wording or clear the filters.', ftsSearching: 'searching…', ftsNeedQuery: 'Type something to search for',
    ftsStats: function (s, ms) { return s + (s === 1 ? ' session' : ' sessions') + ' scanned · ' + ms + ' ms' }, ftsCut: 'not all matches are shown',
    semTitle: 'By meaning', semRun: 'Asking the model…', semNone: 'The model found nothing', semCost: function (v) { return 'the query cost ≈ ' + v }, error: 'Error',
    emptyTitle: 'Nothing found', emptyHint: function (q) { return 'No session matches ' + q + '. Try searching the conversation text, or reset the filters.' },
    tryText: 'Search conversation text', resetFilters: 'Reset filters', offlineMiss: function (h) { return h + ' is unreachable — the list may be out of date.' },
    noneTitle: 'No sessions yet', noneHint: 'They show up here on their own after you first run claude in any project. The hub reads ~/.claude/projects on this computer.',
    pickTitle: 'Pick a session', pickHint: 'The session tree is on the left. ↑↓ to move, Enter to open.',
    loading: 'Loading messages…', now: 'now', yesterday: 'yesterday', u: { m: 'min', h: 'h', d: 'd' },
    mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], removeChip: 'Remove condition',
    actL: { working: 'working', open: 'open', archived: 'archived', closed: 'closed' },
    actTip: { working: 'Its process runs and Claude is working in it now', open: 'Its process runs but is idle: Claude Desktop keeps it alive while the chat is not archived, and it holds memory', archived: 'Archived in Claude Desktop: no process, the conversation is kept, the session can be restored', closed: 'No process' },
    stWorking: 'Working', stOpen: 'Open', stArch: 'Archived', stClosed: 'Closed',
    hWorking: function (n) { return 'working' }, hOpen: function (n) { return 'open' },
    hWorkingTip: 'Sessions Claude is working in right now',
    hOpenTip: 'Open but idle: Claude Desktop keeps a process alive for every session whose chat is not archived, and that process holds memory',
    hMemTip: 'Memory held by all running session processes (in RAM and swap). Archiving in Claude Desktop ends the process and frees it',
    mb: 'MB', gb: 'GB', memHeld: 'held by processes', stateL: 'State', memL: 'Process memory', sMem: 'Memory', sIdle: 'Idle longest',
    openApp: 'Open in Claude Desktop', openAppNote: "The link works when the hub is open in a regular browser (Chrome etc.); Claude's built-in browser does not open such links",
    archive: 'Archive', unarchive: 'Restore from archive',
    archiveTip: 'Claude Desktop ends the session process; the conversation stays and the session can be restored. You approve it in the Claude Desktop window',
    unarchiveTip: 'Restore the session from the Claude Desktop archive. You approve it in the Claude Desktop window',
    appUnknown: 'Claude Desktop does not know this session', appNoState: 'Claude Desktop did not say whether this session is archived', appWait: 'Waiting for Claude Desktop…', appOld: 'An older version of the mod in another Claude Code session fills this page: update the mod there or restart that session',
    appUnavail: function (e) { return 'Claude Desktop is unavailable' + (e ? ': ' + e : '') },
    appNote: function (e) { return 'Archiving and opening in Claude Desktop are unavailable' + (e ? ': ' + e : '') },
    opBusy: 'Wait until the current operation finishes',
    confirmWorking: 'Claude is working in this session right now. Archive it anyway?\n\nClaude Desktop refuses to archive a session mid-turn, pinned or open on screen.',
    confirmWorkingN: function (n) { return 'Claude is working in ' + n + ' of the selected sessions right now. Archive anyway?\n\nClaude Desktop refuses to archive sessions mid-turn, pinned or open on screen.' },
    confirmApp: 'Approve it in the Claude Desktop window',
    opRun: function (k, n) { return (k === 'archive' ? 'Archiving ' : 'Restoring ') + n + '… approve it in Claude Desktop' },
    opDone: function (k, a, n) { return (k === 'archive' ? 'Archived ' : 'Restored ') + a + ' of ' + n },
    opErr: function (k) { return k === 'archive' ? 'Archiving failed' : 'Restoring failed' },
    opFails: function (k) { return k === 'archive' ? 'Not archived' : 'Not restored' }, noReason: 'no reason given', dismiss: 'Dismiss',
    select: 'Select', selectTip: 'Select several sessions to archive or restore them at once',
    selCount: function (n) { return n + ' selected' }, pickL: function (s) { return 'Select: ' + s },
    pickIdle: 'Open, idle > 1 day', pickOpen: 'All open except working', cancel: 'Cancel'
  }
}
var LOCALE = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-US' }

/* ---------- icons ---------- */
var FORK_P = '<circle cx="4.5" cy="3.5" r="1.6"></circle><circle cx="4.5" cy="12.5" r="1.6"></circle><circle cx="11.5" cy="5.5" r="1.6"></circle><path d="M4.5 5.1v5.8M11.5 7.1c0 2.6-2.2 3.4-5.4 4.2"></path>'
function fork(sz, color, w) { return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 16 16" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="' + (w || 1.6) + '" stroke-linecap="round" aria-hidden="true" style="flex:none">' + FORK_P + '</svg>' }
function chev(rot) { return '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform:rotate(' + rot + 'deg)"><path d="M6 3.5L10.5 8 6 12.5"></path></svg>' }
var IC = {
  logo: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="var(--claude)" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M8 2v12M2.8 5l10.4 6M2.8 11l10.4-6"></path></svg>',
  claude: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M8 2v12M2.8 5l10.4 6M2.8 11l10.4-6"></path></svg>',
  host: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" style="flex:none"><rect x="2" y="2.5" width="12" height="4.5" rx="1.3"></rect><rect x="2" y="9" width="12" height="4.5" rx="1.3"></rect><path d="M4.5 4.75h.01M4.5 11.25h.01"></path></svg>',
  hostS: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="2.5" width="12" height="4.5" rx="1.3"></rect><rect x="2" y="9" width="12" height="4.5" rx="1.3"></rect></svg>',
  folder: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M1.8 4.2c0-.7.5-1.2 1.2-1.2h3l1.5 1.6h5.5c.7 0 1.2.5 1.2 1.2v6.2c0 .7-.5 1.2-1.2 1.2H3c-.7 0-1.2-.5-1.2-1.2z"></path></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="2"></rect><path d="M11 3.2V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6.5A1.5 1.5 0 0 0 3 11h.2"></path></svg>',
  copyS: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="2"></rect><path d="M11 3.2V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6.5A1.5 1.5 0 0 0 3 11h.2"></path></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"></path></svg>',
  checkS: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"></path></svg>',
  back: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"></path></svg>',
  x: '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8"></path></svg>',
  clock: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"></circle><path d="M8 4.8V8l2.2 1.6"></path></svg>',
  chat: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M2 3.5c0-.8.7-1.5 1.5-1.5h9c.8 0 1.5.7 1.5 1.5v6c0 .8-.7 1.5-1.5 1.5H7l-3 3v-3h-.5C2.7 11 2 10.3 2 9.5z"></path></svg>',
  refresh: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5V5H5"></path></svg>',
  textsearch: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3.5h7M2.5 6.5h9M2.5 9.5h5"></path><circle cx="11.3" cy="11" r="2.4"></circle><path d="M13 12.8l1.6 1.6"></path></svg>',
  expand: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 6L8 2.5 11.5 6M4.5 10L8 13.5 11.5 10"></path></svg>',
  collapse: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 2.5L8 6l3.5-3.5M4.5 13.5L8 10l3.5 3.5"></path></svg>',
  up: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10l4-4 4 4"></path></svg>',
  down: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"></path></svg>',
  offline: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" style="flex:none"><path d="M2 6.2a8.5 8.5 0 0 1 12 0M4.3 8.6a5.2 5.2 0 0 1 7.4 0M2 2l12 12"></path><circle cx="8" cy="12" r=".6" fill="currentColor"></circle></svg>',
  info: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" style="flex:none"><circle cx="8" cy="8" r="6"></circle><path d="M8 4.8v3.6M8 10.9v.1"></path></svg>',
  emptySearch: '<svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.6"></circle><path d="M10.5 10.5L14 14M5.3 5.3l3.4 3.4M8.7 5.3L5.3 8.7"></path></svg>',
  term: '<svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="var(--claude)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.8" y="2.8" width="12.4" height="10.4" rx="2"></rect><path d="M4.5 6.5l2 1.6-2 1.6M8.5 10h3"></path></svg>',
  pick: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border2)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M9 4v16M12.5 9h5M12.5 12.5h5M12.5 16h3"></path></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--faint)" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" style="position:absolute;left:10px;top:10px"><circle cx="7" cy="7" r="4.6"></circle><path d="M10.5 10.5L14 14"></path></svg>',
  arch: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><rect x="1.8" y="2.5" width="12.4" height="3.5" rx="1"></rect><path d="M2.8 6v6.3c0 .7.5 1.2 1.2 1.2h8c.7 0 1.2-.5 1.2-1.2V6M6.5 8.8h3"></path></svg>',
  archS: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.8" y="2.5" width="12.4" height="3.5" rx="1"></rect><path d="M2.8 6v6.3c0 .7.5 1.2 1.2 1.2h8c.7 0 1.2-.5 1.2-1.2V6M6.5 8.8h3"></path></svg>',
  unarch: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M2.8 7v5.3c0 .7.5 1.2 1.2 1.2h8c.7 0 1.2-.5 1.2-1.2V7M8 11.5V4M5.5 6.3L8 3.8l2.5 2.5M1.8 4.5V3.5c0-.6.4-1 1-1h2.5M14.2 4.5V3.5c0-.6-.4-1-1-1h-2.5"></path></svg>',
  ext: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M12 9.5v3c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5v-7C2 4.7 2.7 4 3.5 4h3"></path></svg>',
  boxes: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><rect x="2" y="2" width="12" height="12" rx="3"></rect><path d="M5.3 8.2l1.9 1.9 3.6-4"></path></svg>',
  spark: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M8 1.8l1.6 4.1 4.1 1.6-4.1 1.6L8 13.2 6.4 9.1 2.3 7.5l4.1-1.6z"></path></svg>'
}

/* ---------- state ---------- */
var state = null, D = null
var online = { hub: true, session: true }
var S = {
  query: '', chips: [], fHost: 'all', fProj: 'all', fPeriod: 'all', fModel: 'all', fStatus: 'all', fForks: false, fSoon: false,
  ftsMode: false, semantic: false, withTools: false, sort: 'last', spend: 'week', collapsed: {}, sel: null, focus: null,
  view: 'card', narrowOpen: false, results: false, showFts: false, showSem: false,
  ftsId: null, ftsData: null, semId: null, semData: null,
  readReq: null, readerData: null, readScroll: null, rq: '', rIdx: 0, showTools: true, openTools: {},
  filesOpen: false, filesAll: false, promptOpen: {}, toast: '', toastPlain: false, toastBad: false, copied: '', picked: false, cardKey: '', leftKey: '',
  selMode: false, picks: {}, op: null, fails: null
}
var rowKeys = [], rowInfo = {}, hitCount = 0, hitMsgs = []
var toastTimer = 0, copiedTimer = 0

function $(id) { return document.getElementById(id) }
function lang() { return TEXTS[hub.lang] ? hub.lang : 'en' }
function T() { return TEXTS[lang()] }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
function send(action) { try { var p = hub.send(action); if (p && p.catch) p.catch(function () {}) } catch (e) {} }

/* ---------- numbers and times ---------- */
function money(v) { return v == null || isNaN(v) ? '—' : '$' + Number(v).toFixed(2) }
function moneyFine(v) { return v == null || isNaN(v) ? '—' : (v > 0 && v < 0.01 ? '$' + Number(v).toFixed(4) : money(v)) }
function tok(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n >= 1e4 ? Math.round(n / 1e3) : (n / 1e3).toFixed(1).replace(/\.0$/, '')) + 'k'
  return String(n)
}
function int(n) { if (n == null || isNaN(n)) return '—'; try { return new Intl.NumberFormat(LOCALE[lang()]).format(n) } catch (e) { return String(n) } }
function dayOf(ms) { var d = new Date(ms); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY) }
function pad(n) { return (n < 10 ? '0' : '') + n }
function date(ms, withTime) {
  if (!ms) return null
  var t = T(), d = new Date(ms), s = lang() === 'en' ? t.mon[d.getMonth()] + ' ' + d.getDate() : d.getDate() + ' ' + t.mon[d.getMonth()]
  if (d.getFullYear() !== new Date().getFullYear()) s += ' ' + d.getFullYear()
  return withTime ? s + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : s
}
function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()) }
function rel(ms) {
  if (!ms) return '—'
  var t = T(), now = Date.now(), mins = Math.floor((now - ms) / MIN)
  if (mins < 1) return t.now
  if (mins < 60) return mins + ' ' + t.u.m
  var dd = dayOf(now) - dayOf(ms)
  if (dd === 0) return Math.floor(mins / 60) + ' ' + t.u.h
  if (dd === 1) return t.yesterday
  return date(ms, false)
}
function dur(ms) {
  if (ms == null || isNaN(ms) || ms < 0) return null
  var u = T().u, min = Math.round(ms / MIN), d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60
  if (d) return d + ' ' + u.d + ' ' + h + ' ' + u.h
  if (h) return h + ' ' + u.h + ' ' + m + ' ' + u.m
  return (ms < MIN ? '< 1' : m) + ' ' + u.m
}
function daysLeft(x) { return x.deleteAt == null ? null : Math.ceil((x.deleteAt - Date.now()) / DAY) }
function isSoon(x) { return x.deleteAt != null && x.deleteAt - Date.now() <= SOON }

/* ---------- the data ---------- */
function arr(v) { return Array.isArray(v) ? v : [] }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {} }
function num(v) { return typeof v === 'number' && !isNaN(v) ? v : 0 }
function nnum(v) { return typeof v === 'number' && !isNaN(v) ? v : null }
function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)) }
var ACTS = { working: 1, open: 1, archived: 1, closed: 1 }
function normSession(x) {
  x = obj(x)
  var act = ACTS[x.activity] === 1 ? x.activity : x.live ? 'working' : x.archived === true ? 'archived' : 'closed'
  return {
    id: str(x.id), folder: str(x.folder), cwd: str(x.cwd), parent: x.parent ? str(x.parent) : null, forkN: num(x.forkN), n: num(x.n),
    title: str(x.title), first: str(x.first), lastPrompt: str(x.lastPrompt), start: num(x.start), last: num(x.last), live: !!x.live,
    branches: arr(x.branches).map(str).filter(Boolean), models: arr(x.models).map(str).filter(Boolean), effort: str(x.effort), perm: str(x.perm), entry: str(x.entry), version: str(x.version),
    prompts: nnum(x.prompts), answers: nnum(x.answers), tools: obj(x.tools), files: Array.isArray(x.files) ? x.files.map(str) : null, web: nnum(x.web),
    subagents: x.subagents == null ? null : obj(x.subagents), subagentCost: nnum(x.subagentCost), cost: num(x.cost), costKnown: x.costKnown !== false,
    tokens: obj(x.tokens), byModel: obj(x.byModel), apiMs: nnum(x.apiMs), toolMs: nnum(x.toolMs), added: nnum(x.added), removed: nnum(x.removed),
    deleteAt: nnum(x.deleteAt), app: x.app ? str(x.app) : null, memMb: nnum(x.memMb), appLink: x.appLink ? str(x.appLink) : null,
    archived: typeof x.archived === 'boolean' ? x.archived : null, activity: act
  }
}
function normalize(next) {
  var n = obj(next)
  return {
    host: str(n.host) || 'local', at: num(n.at), keepDays: nnum(n.keepDays), isIndexing: next == null ? true : !!n.isIndexing,
    sessions: arr(n.sessions).map(normSession).filter(function (x) { return x.id }),
    fts: n.fts && typeof n.fts === 'object' ? n.fts : null, semantic: n.semantic && typeof n.semantic === 'object' ? n.semantic : null,
    reader: n.reader && typeof n.reader === 'object' ? n.reader : null, semanticModel: str(n.semanticModel),
    appOld: next != null && !('app' in n),
    app: n.app && typeof n.app === 'object' ? { status: n.app.status === 'ok' ? 'ok' : 'unavailable', error: str(n.app.error), at: num(n.app.at) } : null,
    op: n.op && typeof n.op === 'object' && n.op.id != null ? {
      id: num(n.op.id), kind: n.op.kind === 'unarchive' ? 'unarchive' : 'archive', status: str(n.op.status),
      results: arr(n.op.results).map(function (r) { r = obj(r); return { sid: str(r.sid), ok: !!r.ok, message: str(r.message) } })
    } : null
  }
}
/* ---------- activity, memory, Claude Desktop ---------- */
function hasProc(x) { return x.activity === 'working' || x.activity === 'open' }
function dot(x, small) {
  var a = x ? x.activity : 'closed', st = small ? ' style="width:6px;height:6px"' : ''
  if (a === 'working') return '<span class="live-dot" aria-hidden="true"' + st + '></span>'
  if (a === 'open') return '<span class="open-dot" aria-hidden="true"' + st + '></span>'
  if (a === 'archived') return '<span class="arch-ic" aria-hidden="true">' + IC.archS + '</span>'
  return '<span class="done-dot" aria-hidden="true"' + st + '></span>'
}
function mbText(v) { return v == null ? null : int(Math.round(v)) + ' ' + T().mb }
function gbText(v) {
  var g = (v || 0) / 1024, s
  try { s = new Intl.NumberFormat(LOCALE[lang()], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(g) } catch (e) { s = g.toFixed(1) }
  return s + ' ' + T().gb
}
function memSum(list) { return list.reduce(function (a, x) { return a + (hasProc(x) && x.memMb != null ? x.memMb : 0) }, 0) }
function appOk() { return !!(state && state.app && state.app.status === 'ok') }
/* Why the session cannot be archived or restored from here; '' when it can. */
function actBlock(x) {
  var t = T()
  if (state && state.appOld) return t.appOld
  if (!state || !state.app) return t.appWait
  if (state.app.status !== 'ok') return t.appUnavail(state.app.error)
  if (!x.app) return t.appUnknown
  if (x.archived == null) return t.appNoState
  return ''
}
function opBusy() { return !!(S.op && S.op.status === 'running') }
function safeLink(u) { return !!u && !/^\s*(javascript|data|vbscript):/i.test(u) }
function shortPath(p) {
  if (!p) return ''
  var m = /^(\/home\/[^\/]+|\/Users\/[^\/]+|\/root)(?=\/|$)/.exec(p)
  return m ? '~' + p.slice(m[1].length) : p
}
function derive() {
  var list = state.sessions, byId = {}, kids = {}, ep = {}, projOf = {}, projects = {}, models = {}, hay = {}
  list.forEach(function (x) { byId[x.id] = x })
  list.forEach(function (x) {
    var p = x.parent, ok = !!(p && byId[p] && p !== x.id), seen = {}, c = p, guard = 0
    seen[x.id] = 1
    while (ok && c && byId[c] && guard++ < 10000) { if (seen[c]) { ok = false; break } seen[c] = 1; c = byId[c].parent }
    ep[x.id] = ok ? p : null
    if (ok) (kids[p] = kids[p] || []).push(x)
  })
  Object.keys(kids).forEach(function (k) { kids[k].sort(function (a, b) { return (a.forkN - b.forkN) || (a.start - b.start) }) })
  function rootOf(id) { var c = id, g = 0; while (ep[c] && g++ < 10000) c = ep[c]; return c }
  list.forEach(function (x) {
    var r = byId[rootOf(x.id)], key = r.cwd || r.folder || '?'
    projOf[x.id] = key
    var p = projects[key] || (projects[key] = { key: key, path: r.cwd ? shortPath(r.cwd) : (r.folder || '?'), full: r.cwd || r.folder || '', ids: [] })
    p.ids.push(x.id)
    x.models.forEach(function (m) { models[m] = 1 })
    hay[x.id] = {
      title: (x.title || x.first || '').toLowerCase(), prompt: (x.first + '\n' + x.lastPrompt).toLowerCase(), branch: x.branches.join('\n').toLowerCase(),
      project: (x.cwd + '\n' + shortPath(x.cwd) + '\n' + p.path).toLowerCase(), file: (x.files || []).join('\n').toLowerCase(), id: x.id.toLowerCase()
    }
  })
  D = { byId: byId, kids: kids, ep: ep, rootOf: rootOf, projOf: projOf, projects: projects, models: Object.keys(models).sort(), hay: hay }
}
function titleOf(x) { return x ? (x.title || (x.first ? x.first.replace(/\s+/g, ' ').trim() : '') || x.id) : '—' }
function isPromptTitle(x) { return !x.title && !!x.first }
function kidsOf(id) { return (D && D.kids[id]) || [] }
function lastBranch(x) { return x.branches.length ? x.branches[x.branches.length - 1] : '' }

/* ---------- search: operators, filters ---------- */
function parseInput(v, force) {
  var chips = []
  v = v.replace(/"([^"]+)"/g, function (m, p) { chips.push({ k: 'phrase', v: p }); return ' ' })
  var endsSpace = /\s$/.test(v) || force, parts = v.split(/\s+/), keep = []
  parts.forEach(function (p, i) {
    var last = i === parts.length - 1 && !endsSpace
    var m = /^(host|project|branch|after|before|model|status):(.+)$/i.exec(p)
    if (m && !last) chips.push({ k: m[1].toLowerCase(), v: m[2] })
    else if (p) keep.push(p)
  })
  var text = keep.join(' ')
  if (/\s$/.test(v) && text && !force) text += ' '
  return { chips: chips, text: text }
}
function textQuery() { return S.query.split(/\s+/).filter(function (w) { return w && !/^\w+:/.test(w) }).join(' ').trim() }
function isFiltering() {
  return !!(textQuery() || S.chips.length || S.fHost !== 'all' || S.fProj !== 'all' || S.fPeriod !== 'all' || S.fModel !== 'all' || S.fStatus !== 'all' || S.fForks || S.fSoon)
}
function where(x, q) {
  q = q.toLowerCase()
  var h = D.hay[x.id]
  if (h.title.indexOf(q) >= 0) return 'title'
  if (h.prompt.indexOf(q) >= 0) return 'prompt'
  if (h.branch.indexOf(q) >= 0) return 'branch'
  if (h.project.indexOf(q) >= 0) return 'project'
  if (h.file.indexOf(q) >= 0) return 'file'
  if (h.id.indexOf(q) >= 0) return 'id'
  return null
}
function dayStart(v) { var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : NaN }
function passes(x, ignoreText) {
  var s = S
  if (s.fHost !== 'all' && s.fHost !== state.host) return false
  if (s.fProj !== 'all' && D.projOf[x.id] !== s.fProj) return false
  if (s.fModel !== 'all' && x.models.indexOf(s.fModel) < 0) return false
  if (s.fStatus !== 'all' && x.activity !== s.fStatus) return false
  if (s.fForks && !(D.ep[x.id] || kidsOf(x.id).length)) return false
  if (s.fSoon && !isSoon(x)) return false
  if (s.fPeriod !== 'all') {
    var today = dayOf(Date.now()), lim = s.fPeriod === 'd1' ? today : today - (s.fPeriod === 'd7' ? 6 : 29)
    if (dayOf(x.last) < lim) return false
  }
  for (var i = 0; i < s.chips.length; i++) {
    var c = s.chips[i], v = c.v.toLowerCase(), ok = true, d
    if (c.k === 'host') ok = state.host.toLowerCase().indexOf(v) >= 0
    else if (c.k === 'project') ok = D.hay[x.id].project.indexOf(v) >= 0
    else if (c.k === 'branch') ok = D.hay[x.id].branch.indexOf(v) >= 0
    else if (c.k === 'model') ok = x.models.some(function (m) { return m.toLowerCase().indexOf(v) >= 0 })
    else if (c.k === 'after') { d = dayStart(c.v); ok = isNaN(d) || x.last >= d }
    else if (c.k === 'before') { d = dayStart(c.v); ok = isNaN(d) || x.start < d }
    else if (c.k === 'status') ok = statusIs(x, v)
    else if (c.k === 'phrase') ok = !!where(x, c.v)
    if (!ok) return false
  }
  if (!ignoreText) { var q = textQuery(); if (q) return where(x, q) || false }
  return 'ok'
}
function statusIs(x, v) {
  if (/arch|архив|архів/.test(v)) return x.activity === 'archived'
  if (/open|idle|откр|відкр|прост/.test(v)) return x.activity === 'open'
  if (/work|работ|прац/.test(v)) return x.activity === 'working'
  if (/clos|done|fin|закр|заверш/.test(v)) return x.activity === 'closed'
  if (/live|run|ид|трив|жив/.test(v)) return hasProc(x)
  return x.activity === v
}
function memOf(x) { return x.memMb == null ? -1 : x.memMb }
function sortFn(a, b) {
  if (S.sort === 'cost') return b.cost - a.cost
  if (S.sort === 'created') return b.start - a.start
  if (S.sort === 'mem') return (memOf(b) - memOf(a)) || (b.last - a.last)
  if (S.sort === 'idle') {
    var ao = a.activity === 'open', bo = b.activity === 'open'
    if (ao !== bo) return ao ? -1 : 1
    return ao ? a.last - b.last : b.last - a.last
  }
  return b.last - a.last
}
function segs(text, q, ctx, n) {
  text = text == null ? '' : String(text)
  if (!q) return esc(text)
  var out = '', lo = text.toLowerCase(), ql = q.toLowerCase(), pos = 0, k
  while ((k = lo.indexOf(ql, pos)) >= 0) {
    out += esc(text.slice(pos, k))
    if (ctx) { out += '<mark id="hit-' + ctx.i + '"' + (ctx.i === ctx.cur ? ' class="cur"' : '') + '>'; ctx.msgs.push(n); ctx.i++ } else out += '<mark>'
    out += esc(text.slice(k, k + q.length)) + '</mark>'
    pos = k + q.length
  }
  return out + esc(text.slice(pos))
}

/* ---------- spend ---------- */
function windowStart(p) { var today = dayOf(Date.now()); return p === 'today' ? today : p === 'week' ? today - 6 : today - 29 }
function spendOf(list, p) { var from = windowStart(p), sum = 0; list.forEach(function (x) { if (x.last && dayOf(x.last) >= from) sum += x.cost }); return sum }

/* ---------- morph: the render goes into the DOM that is there ---------- */
function keyOf(node) { return node.nodeType === 1 ? node.getAttribute('data-key') : null }
function morphNode(from, to) {
  var i, a
  for (i = from.attributes.length - 1; i >= 0; i--) { a = from.attributes[i]; if (!to.hasAttribute(a.name)) from.removeAttribute(a.name) }
  for (i = 0; i < to.attributes.length; i++) { a = to.attributes[i]; if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value) }
  if (from.tagName === 'INPUT') { if (from.type === 'checkbox') from.checked = to.hasAttribute('checked'); return }
  if (from.tagName === 'TEXTAREA') return
  morphChildren(from, to)
  if (from.tagName === 'SELECT') { var o = to.querySelector('option[selected]'); if (o) from.value = o.getAttribute('value') }
}
function morphChildren(from, to) {
  var next = Array.prototype.slice.call(to.childNodes), wanted = {}, keyed = {}
  next.forEach(function (n) { var k = keyOf(n); if (k) wanted[k] = true })
  Array.prototype.slice.call(from.childNodes).forEach(function (n) {
    var k = keyOf(n)
    if (k && !wanted[k]) from.removeChild(n)
    else if (k) keyed[k] = n
  })
  for (var i = 0; i < next.length; i++) {
    var n = next[i], k = keyOf(n), here = from.childNodes[i] || null, match = null
    if (k) { match = keyed[k] || null; if (match && match.nodeName !== n.nodeName) match = null }
    else if (here && !keyOf(here) && here.nodeName === n.nodeName) match = here
    if (match) {
      if (match !== here) from.insertBefore(match, here)
      if (match.nodeType === 1) morphNode(match, n)
      else if (match.nodeValue !== n.nodeValue) match.nodeValue = n.nodeValue
    } else from.insertBefore(n, here)
  }
  while (from.childNodes.length > next.length) from.removeChild(from.lastChild)
}
function paint(el, html) { var t = document.createElement('div'); t.innerHTML = html; morphChildren(el, t) }

/* ---------- header ---------- */
function renderHeader() {
  var t = T(), list = state ? state.sessions : []
  var nWork = list.filter(function (x) { return x.activity === 'working' }).length, nOpen = list.filter(function (x) { return x.activity === 'open' }).length
  var today = dayOf(Date.now()), daily = [], i
  for (i = 29; i >= 0; i--) daily.push({ d: today - i, v: 0 })
  list.forEach(function (x) { if (!x.last) return; var b = daily[dayOf(x.last) - (today - 29)]; if (b) b.v += x.cost })
  var max = Math.max.apply(null, daily.map(function (b) { return b.v })) || 1, from = windowStart(S.spend), month = spendOf(list, 'month')
  var spark = daily.map(function (b) {
    var ms = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime() - (today - b.d) * DAY + 12 * 3600000
    return '<span title="' + esc(date(ms, false) + ' · ' + money(b.v) + ' — ' + t.sparkNote) + '" style="height:' + Math.max(2, Math.round(b.v / max * 26)) + 'px;background:' + (b.d >= from ? 'var(--claude)' : 'var(--bar)') + '"></span>'
  }).join('')
  var tabs = [['today', t.pToday], ['week', t.pWeek], ['month', t.pMonth]].map(function (o) {
    return '<button data-act="spend" data-v="' + o[0] + '" aria-pressed="' + (S.spend === o[0]) + '">' + esc(o[1]) + '</button>'
  }).join('')
  var html = '<div class="brand"><div class="logo">' + IC.logo + '</div><span style="font-size:13px;color:var(--muted)">Claude Hub</span><span aria-hidden="true" style="color:var(--faint)">/</span><h1>' + esc(t.page) + '</h1></div>' +
    '<div class="stats">' +
      '<div class="stat"><span class="mono v">' + list.length + '</span><span class="stat-l">' + esc(t.sessions(list.length).replace(/^\d+\s/, '')) + '</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:1px">' +
        '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px 10px">' +
        '<span class="stat" style="align-items:center;gap:5px" title="' + esc(t.hWorkingTip) + '"><span class="live-dot" aria-hidden="true"></span><span class="mono v">' + nWork + '</span><span class="stat-l">' + esc(t.hWorking(nWork)) + '</span></span>' +
        '<span class="stat" style="align-items:center;gap:5px" title="' + esc(t.hOpenTip) + '"><span class="open-dot" aria-hidden="true"></span><span class="mono v">' + nOpen + '</span><span class="stat-l">' + esc(t.hOpen(nOpen)) + '</span></span></div>' +
        '<span title="' + esc(t.hMemTip) + '" style="font-size:12px;color:var(--muted);white-space:nowrap"><span class="mono" style="font-weight:600;color:var(--text)">≈ ' + esc(gbText(memSum(list))) + '</span> ' + esc(t.memHeld) + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:10px"><div class="seg" role="group" aria-label="' + esc(t.spendPeriod) + '">' + tabs + '</div>' +
      '<span class="mono" style="font-size:17px;font-weight:600;color:var(--claude)" title="' + esc(t.sumTip(t.spendFor[S.spend]) + ' — ' + t.sparkNote) + '">' + money(spendOf(list, S.spend)) + '</span></div>' +
      '<div class="spark" role="img" aria-label="' + esc(t.sparkLabel(money(month)) + ' (' + t.sparkNote + ')') + '">' + spark + '</div>' +
    '</div>' +
    '<div class="hright">' +
      (state && state.keepDays != null ? '<span title="' + esc(t.keepTip) + '" style="display:inline-flex;align-items:center;gap:5px">' + IC.clock + esc(t.keep(state.keepDays)) + '</span>' : '') +
      (state && state.at ? '<span class="stat-l">· ' + esc(t.updated(hhmm(state.at))) + '</span>' : '') +
      '<button class="ghost iconbtn" data-act="refresh" title="' + esc(t.refreshTip) + '">' + IC.refresh + '<span>' + esc(t.refresh) + '</span></button>' +
    '</div>'
  paint($('hdr'), html)
}

/* ---------- search bar, toggles, filters ---------- */
function renderSearch() {
  var t = T(), input = $('sb-search')
  paint($('chips'), S.chips.map(function (ch, i) {
    var k = ch.k === 'phrase' ? '' : ch.k + ':', v = ch.k === 'phrase' ? '"' + ch.v + '"' : ch.v
    return '<span class="chip"><span class="chip-k">' + esc(k) + '</span><span class="chip-v">' + esc(v) + '</span><button class="chip-x" data-act="chipx" data-i="' + i + '" aria-label="' + esc(t.removeChip + ' ' + k + v) + '">' + IC.x + '</button></span>'
  }).join(''))
  var ph = S.chips.length ? t.searchPhMore : t.searchPh
  if (input.placeholder !== ph) input.placeholder = ph
  input.setAttribute('aria-label', t.searchLabel)
  var clr = $('clr'); clr.hidden = !(S.query || S.chips.length); clr.setAttribute('aria-label', t.clearSearch)
  var model = state && state.semanticModel ? ' · ' + t.semModel(state.semanticModel) : ''
  paint($('tgls'),
    '<button class="tgl" data-act="fts" aria-pressed="' + S.ftsMode + '" title="' + esc(t.ftsHint) + '">' + IC.textsearch + esc(t.inText) + '<kbd>↵</kbd></button>' +
    '<label class="tgl" style="cursor:pointer;font-weight:500;gap:9px"><input type="checkbox" data-ch="semantic"' + (S.semantic ? ' checked' : '') + '>' +
    '<span style="display:flex;flex-direction:column;line-height:1.25"><span style="font-weight:550">' + esc(t.semantic) + '</span><span style="font-size:11px;color:var(--warn);font-weight:500">$ · ' + esc(t.semanticNote + model) + '</span></span></label>')
}
function opts(list, cur) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>' }).join('') }
function fsel(label, ch, cur, list) { return '<label class="fsel' + (cur !== 'all' ? ' on' : '') + '"><span>' + esc(label) + '</span><select data-ch="' + ch + '">' + opts(list, cur) + '</select></label>' }
function renderFilters() {
  var t = T(), projs = D ? Object.keys(D.projects).map(function (k) { return D.projects[k] }).sort(function (a, b) { return a.path < b.path ? -1 : 1 }) : []
  var html = fsel(t.fHost, 'host', S.fHost, [['all', t.all]].concat(state ? [[state.host, state.host]] : [])) +
    fsel(t.fProj, 'proj', S.fProj, [['all', t.all]].concat(projs.map(function (p) { return [p.key, p.path] }))) +
    fsel(t.fPeriod, 'period', S.fPeriod, [['all', t.pAll], ['d1', t.p1], ['d7', t.p7], ['d30', t.p30]]) +
    fsel(t.fModel, 'model', S.fModel, [['all', t.all]].concat((D ? D.models : []).map(function (m) { return [m, m] }))) +
    '<div class="seg" role="group" aria-label="' + esc(t.fStatus) + '">' + [['all', t.stAll], ['working', t.stWorking], ['open', t.stOpen], ['archived', t.stArch], ['closed', t.stClosed]].map(function (o) {
      return '<button data-act="status" data-v="' + o[0] + '" aria-pressed="' + (S.fStatus === o[0]) + '" style="height:26px">' + esc(o[1]) + '</button>'
    }).join('') + '</div>' +
    '<label class="fchk"><input type="checkbox" data-ch="forks"' + (S.fForks ? ' checked' : '') + '>' + fork(14, 'var(--sugg)', 1.5) + esc(t.onlyForks) + '</label>' +
    '<label class="fchk"><input type="checkbox" data-ch="soon"' + (S.fSoon ? ' checked' : '') + '><span style="color:var(--warn);display:inline-flex">' + IC.clock + '</span>' + esc(t.soon) + '</label>' +
    (isFiltering() ? '<button class="ghost" data-act="reset" style="height:32px;border-radius:9px;padding:0 10px;font-size:12.5px;color:var(--muted);display:inline-flex;align-items:center;gap:6px">' + IC.refresh + esc(t.reset) + '</button>' : '') +
    '<span style="flex:1 1 auto"></span><span class="mono" style="font-size:11.5px;color:var(--faint)">host: project: branch: after: before: model: status: "…"</span>'
  paint($('frow'), html)
}

/* ---------- the tree ---------- */
function computeTree() {
  var t = T(), rows = [], keys = [], info = {}, list = state.sessions, filtering = isFiltering(), tq = textQuery()
  var passMap = {}, shown = {}
  list.forEach(function (x) { passMap[x.id] = filtering ? passes(x) : 'ok' })
  function calc(x) { var any = false; kidsOf(x.id).forEach(function (c) { if (calc(c)) any = true }); shown[x.id] = !!passMap[x.id] || any; return shown[x.id] }
  list.filter(function (x) { return !D.ep[x.id] }).forEach(calc)
  var matched = list.filter(function (x) { return passMap[x.id] }).length
  function push(html, key, inf) { rows.push(html); if (key) { keys.push(key); info[key] = inf } }
  var spendL = t.spendFor[S.spend]
  var hk = 'h-host', hasMatch = !filtering || list.some(function (x) { return shown[x.id] })
  var expanded = !S.collapsed[hk] && (hasMatch || !list.length)
  var hostWork = list.filter(function (x) { return x.activity === 'working' }).length, hostOpen = list.filter(function (x) { return x.activity === 'open' }).length
  var off = !online.session || !online.hub, syncing = state.isIndexing
  var st = syncing ? { c: 'var(--sugg)', b: 'var(--sugg-soft)', l: t.indexing } : off ? { c: 'var(--warn)', b: 'var(--warn-soft)', l: t.offline } : { c: 'var(--ok)', b: 'var(--ok-soft)', l: t.online }
  var hdim = filtering && !hasMatch
  var countL = !list.length ? '—' : hdim ? t.noMatches : (filtering ? matched + ' / ' : '') + t.sessions(list.length)
  push('<div class="trow hrow' + (hdim ? ' dim' : '') + '" data-key="' + hk + '" style="padding-left:4px">' +
    '<button class="chev" tabindex="-1" data-act="tog" data-k="' + hk + '" aria-label="' + esc((expanded ? t.collapse : t.expand) + ' ' + state.host) + '">' + chev(expanded ? 90 : 0) + '</button>' +
    '<button class="rowbtn" id="row-' + hk + '" data-act="tog" data-k="' + hk + '" role="treeitem" aria-level="1" aria-expanded="' + expanded + '" tabindex="-1">' + IC.host +
    '<span class="mono" style="font-weight:600;font-size:13.5px;white-space:nowrap">' + esc(state.host) + '</span>' +
    '<span class="pill" style="color:' + st.c + ';background:' + st.b + '">' + (syncing ? '<span class="spin" aria-hidden="true"></span>' : '<span class="pdot" aria-hidden="true"></span>') + esc(st.l) + '</span>' +
    '<span style="flex:1 1 auto"></span><span class="meta">' + esc(countL) + '</span>' +
    (hostWork && !hdim ? '<span class="meta" style="color:var(--ok);display:inline-flex;align-items:center;gap:5px" title="' + esc(t.hWorkingTip) + '"><span class="live-dot" aria-hidden="true" style="width:6px;height:6px"></span>' + hostWork + '</span>' : '') +
    (hostOpen && !hdim ? '<span class="meta" style="color:var(--ok);display:inline-flex;align-items:center;gap:5px" title="' + esc(t.hOpenTip) + '"><span class="open-dot" aria-hidden="true" style="width:6px;height:6px"></span>' + hostOpen + '</span>' : '') +
    '<span class="c-cost" style="font-weight:600" title="' + esc(t.sumTip(spendL)) + '">' + (list.length ? money(spendOf(list, S.spend)) : '—') + '</span></button></div>', hk,
    { canExpand: true, expanded: expanded, parent: null, act: function () { toggleKey(hk, expanded) } })
  if (!expanded) return { rows: rows, keys: keys, info: info, matched: matched, filtering: filtering }
  if (off) push('<div class="note" data-key="note">' + IC.offline + '<span style="flex:1 1 auto;min-width:0">' + esc(t.noSession) + '</span><button data-act="refresh" style="flex:none;height:28px;border:1px solid currentColor;background:transparent;border-radius:7px;padding:0 10px;font-size:12px;font-weight:600;color:var(--warn)">' + esc(t.retry) + '</button></div>')
  if (state.app && state.app.status !== 'ok') push('<div class="note" data-key="appnote" style="background:var(--surface2);color:var(--muted)">' + IC.info + '<span style="flex:1 1 auto;min-width:0">' + esc(t.appNote(state.app.error)) + '</span></div>')
  if (syncing && !list.length) {
    push('<div data-key="sync" style="margin:2px 12px 6px 48px;display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--muted)"><span style="display:flex;justify-content:space-between;gap:10px"><span>' + esc(t.firstSync) + '</span><span class="mono">' + esc(t.syncWait) + '</span></span><span aria-hidden="true" class="sk" style="height:5px;border-radius:3px"></span></div>')
    ;[62, 48, 70, 55, 66].forEach(function (w, i) {
      push('<div aria-hidden="true" data-key="sk' + i + '" style="display:flex;align-items:center;gap:10px;height:34px;margin:0 16px 0 70px"><span class="sk" style="width:8px;height:8px;border-radius:50%"></span><span class="sk" style="width:' + w + '%"></span><span style="flex:1 1 auto"></span><span class="sk" style="width:44px"></span><span class="sk" style="width:40px"></span></div>')
    })
    return { rows: rows, keys: keys, info: info, matched: matched, filtering: filtering }
  }
  var projs = Object.keys(D.projects).map(function (k) { return D.projects[k] })
  function best(p) {
    var ss = p.ids.map(function (id) { return D.byId[id] })
    if (S.sort === 'cost') return ss.reduce(function (a, x) { return a + x.cost }, 0)
    if (S.sort === 'mem') return memSum(ss)
    if (S.sort === 'idle') { var op = ss.filter(function (x) { return x.activity === 'open' }); if (op.length) return 1e15 - Math.min.apply(null, op.map(function (x) { return x.last })) }
    return Math.max.apply(null, ss.map(function (x) { return S.sort === 'created' ? x.start : x.last }))
  }
  projs.sort(function (a, b) { return best(b) - best(a) })
  projs.forEach(function (p) {
    var ps = p.ids.map(function (id) { return D.byId[id] })
    var pk = 'p-' + p.key, pMatch = !filtering || ps.some(function (x) { return shown[x.id] })
    var pExp = pMatch && !S.collapsed[pk], pDim = filtering && !pMatch
    var parts = p.path.split('/'), long = p.path.charAt(0) === '~' ? parts.length > 3 : parts.length > 4
    var pre = long ? (p.path.charAt(0) === '~' ? '~/…/' : '…/') : '', name = long ? parts.slice(-2).join('/') : p.path
    push('<div class="trow' + (pDim ? ' dim' : '') + '" data-key="' + esc(pk) + '" style="padding-left:22px">' +
      '<button class="chev" tabindex="-1" data-act="tog" data-k="' + esc(pk) + '" aria-label="' + esc((pExp ? t.collapse : t.expand) + ' ' + p.path) + '">' + chev(pExp ? 90 : 0) + '</button>' +
      '<button class="rowbtn" id="row-' + esc(pk) + '" data-act="tog" data-k="' + esc(pk) + '" role="treeitem" aria-level="2" aria-expanded="' + pExp + '" tabindex="-1" title="' + esc(p.full) + '">' + IC.folder +
      '<span class="mono" style="font-size:12.5px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:var(--faint)">' + esc(pre) + '</span><span style="font-weight:600">' + esc(name) + '</span></span>' +
      '<span style="flex:1 1 auto"></span><span class="meta">' + esc(pDim ? t.noMatches : (filtering ? ps.filter(function (x) { return passMap[x.id] }).length + ' / ' : '') + ps.length) + '</span>' +
      '<span class="c-cost" style="color:var(--muted)" title="' + esc(t.sumTip(spendL)) + '">' + money(spendOf(ps, S.spend)) + '</span></button></div>', pk,
      { canExpand: true, expanded: pExp, parent: hk, act: function () { toggleKey(pk, pExp) } })
    if (!pExp) return
    function walk(x, depth, cont, isLast, parentKey) {
      if (filtering && !shown[x.id]) return
      var kids = kidsOf(x.id).filter(function (c) { return !filtering || shown[c.id] }).slice().sort(sortFn)
      var allKids = kidsOf(x.id).length, sk = 's-' + x.id, kExp = kids.length > 0 && !S.collapsed[sk]
      var rails = ''
      for (var i = 0; i < depth; i++) rails += '<span class="rail ' + (i < depth - 1 ? (cont[i + 1] ? 'line' : '') : (isLast ? 'elbow' : 'tee')) + '" aria-hidden="true"></span>'
      var pm = passMap[x.id], dim = filtering && !pm
      var hint = pm && pm !== 'ok' && pm !== 'title' && tq ? t.hint[pm] : ''
      var title = titleOf(x), sel = S.sel === x.id, status = t.actL[x.activity], mem = mbText(x.memMb)
      var picked = S.selMode && !!S.picks[x.id], block = S.selMode ? actBlock(x) : ''
      var pick = S.selMode ? '<label class="pick" title="' + esc(block || t.pickL(title)) + '"><input type="checkbox" tabindex="-1" data-ch="pick" data-id="' + esc(x.id) + '"' + (picked ? ' checked' : '') + (block ? ' disabled' : '') + '><span class="sr">' + esc(t.pickL(title)) + '</span></label>' : ''
      var soon = isSoon(x) ? '<span class="soon" title="' + esc(t.soonTip(date(x.deleteAt, true))) + '" aria-label="' + esc(t.soonTip(date(x.deleteAt, true))) + '">' + IC.clock + '</span>' : ''
      push('<div class="trow' + (sel ? ' sel' : '') + (picked && !sel ? ' picked' : '') + (dim ? ' dim' : '') + '" data-key="' + esc(sk) + '" style="padding-left:40px">' + pick + rails +
        (allKids ? '<button class="chev" tabindex="-1" data-act="tog" data-k="' + esc(sk) + '" aria-label="' + esc((kExp ? t.collapse : t.expand) + ' ' + title) + '">' + chev(kExp ? 90 : 0) + '</button>' : '<span class="chev-sp" aria-hidden="true"></span>') +
        '<button class="rowbtn two" id="row-' + esc(sk) + '" data-act="open" data-id="' + esc(x.id) + '" role="treeitem" aria-level="' + (3 + depth) + '" aria-selected="' + sel + '"' + (allKids ? ' aria-expanded="' + kExp + '"' : '') +
        (S.selMode && !block ? ' aria-checked="' + picked + '"' : '') +
        ' aria-label="' + esc(title + ', ' + status + (mem ? ', ' + mem : '') + ', ' + money(x.cost)) + '" tabindex="-1" title="' + esc(title + ' · ' + t.actTip[x.activity] + (mem ? ' · ' + mem : '')) + '">' +
        '<span class="r1">' +
        dot(x) +
        (D.ep[x.id] ? fork(13, 'var(--sugg)') : '') +
        '<span class="ttl' + (isPromptTitle(x) ? ' prompt' : '') + '">' + segs(title, tq && pm === 'title' ? tq : '') + '</span>' +
        (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + soon + '</span>' +
        '<span class="r2">' +
        '<span class="c-br" title="' + esc(x.branches.join(' → ') || '—') + '">' + esc(lastBranch(x) || '—') + '</span>' +
        (allKids ? '<span class="c-fk" title="' + esc(t.forksTip(allKids)) + '">' + fork(12) + allKids + '</span>' : '') +
        '<span class="c-n" title="' + esc(t.msgsTip) + '">' + x.n + '</span>' +
        (mem ? '<span class="c-mem" title="' + esc(t.memL) + '">' + esc(mem) + '</span>' : '') +
        '<span class="c-cost">' + money(x.cost) + '</span><span class="c-time">' + esc(rel(x.last)) + '</span></span></button></div>', sk,
        { canExpand: kids.length > 0, expanded: kExp, parent: parentKey, act: function () { select(x.id) } })
      if (kExp) kids.forEach(function (c, ci) { walk(c, depth + 1, cont.concat([!isLast]), ci === kids.length - 1, sk) })
    }
    var roots = ps.filter(function (x) { return !D.ep[x.id] }).sort(sortFn)
    roots.forEach(function (x, i) { walk(x, 0, [], i === roots.length - 1, pk) })
  })
  return { rows: rows, keys: keys, info: info, matched: matched, filtering: filtering }
}
function toggleKey(k, expanded) { S.collapsed[k] = expanded; S.focus = k; render() }

/* ---------- left pane ---------- */
function renderLeft() {
  var t = T(), list = state ? state.sessions : []
  var tree = state ? computeTree() : null
  var leftKey = S.results ? 'res' : 'tree'
  if (S.results && state) {
    var f = S.showFts ? S.ftsData : null, sm = S.showSem ? S.semData : null
    paint($('phead'), '<button class="ghost" data-act="backtree" style="height:28px;border-radius:8px;padding:0 8px 0 4px;font-size:12.5px;color:var(--muted);display:inline-flex;align-items:center;gap:4px">' + IC.back + esc(t.backToTree) + '</button>' +
      '<span style="font-size:13px;font-weight:600;flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(f ? t.ftsTitle : t.semTitle) + ' <span style="color:var(--claude)">«' + esc(f ? f.q : sm ? sm.q : '') + '»</span></span>' +
      (S.showFts ? '<label class="fchk" style="height:28px;font-size:12px"><input type="checkbox" data-ch="withtools"' + (S.withTools ? ' checked' : '') + '>' + esc(t.withTools) + '</label>' : ''))
    var bar = ''
    if (f) {
      var hitsN = f.hits ? f.hits.length : 0
      bar += '<span style="display:inline-flex;align-items:center;gap:7px;height:28px;border:1px solid var(--border);border-radius:8px;padding:0 10px;font-size:12.5px;background:' + (f.status === 'error' ? 'var(--warn-soft)' : 'var(--surface)') + ';color:var(--muted)"><span class="mono" style="font-weight:600;color:var(--text)">' + esc(state.host) + '</span>' +
        (f.status === 'running' ? '<span class="spin" style="color:var(--sugg)" aria-hidden="true"></span><span style="color:var(--sugg)">' + esc(t.ftsSearching) + '</span>' + (f.scanned ? '<span class="mono" style="color:var(--sugg)">' + int(f.scanned) + '</span>' : '')
          : f.status === 'error' ? '<span style="color:var(--warn)">— ' + esc(t.error) + '</span>'
          : '<span style="color:var(--ok);display:inline-flex">' + IC.checkS + '</span><span class="mono" style="color:var(--ok)">' + hitsN + '</span>') + '</span>'
    }
    if (S.showSem) bar += '<span style="display:inline-flex;align-items:center;gap:6px;min-height:28px;border-radius:8px;padding:2px 10px;font-size:12px;background:var(--warn-soft);color:var(--warn)">' + esc(t.semanticOn) + (state && state.semanticModel ? ' · ' + esc(t.semModel(state.semanticModel)) : '') + '</span>'
    paint($('ftsbar'), '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;border-bottom:1px solid var(--border)">' + bar + '</div>')
    paint($('tbody'), '<div data-key="res" style="padding:8px 8px 16px">' + resultsHTML(f, sm) + '</div>')
    $('tbody').removeAttribute('role')
  } else {
    var found = tree && tree.filtering ? '<span style="font-size:12px;color:var(--sugg);background:var(--sugg-soft);border-radius:999px;padding:1px 8px;white-space:nowrap">' + esc(t.found(tree.matched)) + '</span>' : ''
    paint($('phead'), '<span class="lbl">' + esc(t.treeHead) + '</span>' + found + '<span style="flex:1 1 auto"></span>' +
      '<label class="fsel" style="height:28px"><span>' + esc(t.sort) + '</span><select data-ch="sort">' + opts([['last', t.sLast], ['cost', t.sCost], ['created', t.sCreated], ['mem', t.sMem], ['idle', t.sIdle]], S.sort) + '</select></label>' +
      '<button class="ghost" data-act="selmode" aria-pressed="' + S.selMode + '"' + (!S.selMode && !appOk() ? ' disabled' : '') + ' title="' + esc(!S.selMode && !appOk() ? (state && state.app ? t.appUnavail(state.app.error) : state && state.appOld ? t.appOld : t.appWait) : t.selectTip) + '" style="flex:none;height:28px;border:1px solid ' + (S.selMode ? 'var(--sugg)' : 'var(--border)') + ';background:' + (S.selMode ? 'var(--sugg-soft)' : 'var(--surface)') + ';color:' + (S.selMode ? 'var(--sugg)' : 'var(--muted)') + ';border-radius:8px;padding:0 9px;font-size:12.5px;font-weight:550;display:inline-flex;align-items:center;gap:5px;white-space:nowrap">' + IC.boxes + esc(t.select) + '</button>' +
      '<button class="ghost" data-act="expand" aria-label="' + esc(t.expandAll) + '" title="' + esc(t.expandAll) + '" style="width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + IC.expand + '</button>' +
      '<button class="ghost" data-act="collapse" aria-label="' + esc(t.collapseAll) + '" title="' + esc(t.collapseAll) + '" style="width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + IC.collapse + '</button>')
    paint($('ftsbar'), '')
    var body
    var emptySearch = tree && tree.filtering && list.length > 0 && tree.matched === 0
    if (state && !state.isIndexing && !list.length) {
      body = '<div class="empty fadein" data-key="none"><div style="width:64px;height:64px;border-radius:20px;background:var(--claude-soft);display:flex;align-items:center;justify-content:center">' + IC.term + '</div>' +
        '<h2>' + esc(t.noneTitle) + '</h2><p>' + esc(t.noneHint) + '</p>' +
        '<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--border);background:var(--surface2);border-radius:10px;padding:6px 6px 6px 14px;margin-top:4px"><span class="mono" style="font-size:13px"><span style="color:var(--faint)">$ </span>cd ~/workspace/my-project &amp;&amp; claude</span>' +
        '<button class="ghost" data-act="starter" aria-label="' + esc(t.copy) + '" style="width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + IC.copy + '</button></div></div>'
    } else if (emptySearch) {
      var qd = []
      var tq = textQuery()
      if (tq) qd.push('«' + tq + '»')
      S.chips.forEach(function (ch) { qd.push(ch.k === 'phrase' ? '"' + ch.v + '"' : ch.k + ':' + ch.v) })
      body = '<div class="empty fadein" data-key="nores"><div style="width:56px;height:56px;border-radius:18px;background:var(--surface2);display:flex;align-items:center;justify-content:center">' + IC.emptySearch + '</div>' +
        '<h2>' + esc(t.emptyTitle) + '</h2><p style="max-width:380px">' + esc(t.emptyHint(qd.join(' + ') || '—')) + '</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px">' +
        '<button class="btn-primary" data-act="trytext" style="height:36px;border-radius:9px;padding:0 14px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:8px">' + esc(t.tryText) + '<kbd>↵</kbd></button>' +
        '<button class="ghost" data-act="reset" style="height:36px;border:1px solid var(--border2);background:var(--surface);border-radius:9px;padding:0 14px;font-size:13px;font-weight:500">' + esc(t.resetFilters) + '</button></div>' +
        (!online.session ? '<p style="margin:8px 0 0;font-size:12.5px;color:var(--warn);background:var(--warn-soft);border-radius:9px;padding:8px 12px;max-width:400px">' + esc(t.offlineMiss(state.host)) + '</p>' : '') + '</div>'
    } else if (!state) {
      var nst = normalize(null)
      var saved = state; state = nst; derive(); var tr = computeTree(); state = saved; D = null
      body = '<div data-key="tree" style="padding:2px 0 12px">' + tr.rows.join('') + '</div>'
    } else body = '<div data-key="tree" style="padding:2px 0 12px">' + tree.rows.join('') + '</div>'
    paint($('tbody'), body)
    $('tbody').setAttribute('role', 'tree'); $('tbody').setAttribute('aria-label', t.treeLabel)
  }
  renderBulk()
  if (S.leftKey !== leftKey) { $('tbody').scrollTop = 0; S.leftKey = leftKey }
  $('left').setAttribute('aria-label', t.treeLabel)
  rowKeys = tree && !S.results ? tree.keys : []
  rowInfo = tree && !S.results ? tree.info : {}
  var fk = rowKeys.indexOf(S.focus) >= 0 ? S.focus : rowKeys[0]
  rowKeys.forEach(function (k) { var el = $('row-' + k); if (el) el.tabIndex = k === fk ? 0 : -1 })
  paint($('pfoot'), '<span><kbd>↑</kbd><kbd>↓</kbd>' + esc(t.kNav) + '</span><span><kbd>←</kbd><kbd>→</kbd>' + esc(t.kFold) + '</span><span><kbd>/</kbd>' + esc(t.kSearch) + '</span><span><kbd>↵</kbd>' + esc(t.kOpen) + '</span><span><kbd>c</kbd>' + esc(t.kCopy) + '</span>')
  $('pfoot').setAttribute('aria-label', t.keysLabel)
}
function pickedList() { return D ? Object.keys(S.picks).map(function (id) { return D.byId[id] }).filter(function (x) { return x && !actBlock(x) }) : [] }
function failsHTML(where) {
  var t = T(), f = S.fails
  if (!f || f.origin !== where) return ''
  return '<div class="fails fadein" data-key="fails" role="status"><span style="display:flex;align-items:center;gap:8px"><span style="font-weight:600;flex:1 1 auto">' + esc(f.error ? t.opErr(f.kind) : t.opFails(f.kind) + ': ' + f.items.length) + '</span>' +
    '<button class="ghost" data-act="dismiss" aria-label="' + esc(t.dismiss) + '" title="' + esc(t.dismiss) + '" style="width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;color:var(--warn)">' + IC.x + '</button></span>' +
    (f.items.length ? '<ul>' + f.items.map(function (r) {
      var x = D && D.byId[r.sid]
      return '<li><span style="flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:550' + (x && isPromptTitle(x) ? ';font-style:italic' : '') + '">' + esc(x ? titleOf(x) : r.sid) + '</span><span style="flex:1 1 auto;min-width:0">— ' + esc(r.message || t.noReason) + '</span></li>'
    }).join('') + '</ul>' : '') + '</div>'
}
function renderBulk() {
  var t = T(), html = ''
  if (S.selMode && state && !S.results) {
    var picked = pickedList(), mem = memSum(picked), busy = opBusy()
    var toArch = picked.filter(function (x) { return x.archived === false }).length, toUn = picked.filter(function (x) { return x.archived === true }).length
    var sum = picked.reduce(function (a, x) { return a + (x.memMb || 0) }, 0)
    html += '<div class="bulk" data-key="bar" role="region" aria-label="' + esc(t.select) + '">' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px"><span style="flex:1 1 auto;font-size:13px;font-weight:600;white-space:nowrap" aria-live="polite">' + esc(t.selCount(picked.length)) + (sum ? ' <span class="mono" style="font-weight:500;color:var(--muted)" title="' + esc(t.hMemTip) + '">· ≈ ' + esc(mbText(mem)) + '</span>' : '') + '</span>' +
        '<button class="btn-primary" data-act="bulk" data-v="archive"' + (toArch && !busy ? '' : ' disabled') + ' title="' + esc(busy ? t.opBusy : t.archiveTip) + '" style="height:30px;border-radius:8px;padding:0 12px;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px">' + IC.archS + esc(t.archive) + (toArch ? ' <span class="mono">' + toArch + '</span>' : '') + '</button>' +
        '<button class="ghost sbtn" data-act="bulk" data-v="unarchive"' + (toUn && !busy ? '' : ' disabled') + ' title="' + esc(busy ? t.opBusy : t.unarchiveTip) + '">' + esc(t.unarchive) + (toUn ? ' <span class="mono">' + toUn + '</span>' : '') + '</button>' +
        '<button class="ghost sbtn" data-act="selcancel" style="border-color:transparent;color:var(--muted)">' + esc(t.cancel) + '</button></div>' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">' +
        '<button class="qbtn" data-act="pickq" data-v="idle">' + esc(t.pickIdle) + '</button><button class="qbtn" data-act="pickq" data-v="open">' + esc(t.pickOpen) + '</button>' +
        (busy && S.op.origin === 'bulk' ? '<span class="opnote" style="margin-left:auto"><span class="spin" aria-hidden="true"></span>' + esc(t.confirmApp) + '</span>' : '') + '</div>' +
      failsHTML('bulk') + '</div>'
  } else if (S.fails && S.fails.origin === 'bulk') html = '<div class="bulk" data-key="bar">' + failsHTML('bulk') + '</div>'
  paint($('bulk'), html)
}
function whoOf(h) {
  var t = T()
  if (h.role === 'user') return { l: t.you, c: 'var(--text)', mono: false }
  if (h.role === 'claude') return { l: 'Claude', c: 'var(--claude)', mono: false }
  return { l: (h.tool || 'tool') + ' · ' + (h.role === 'output' ? t.toolOut : t.toolCall), c: 'var(--muted)', mono: true }
}
function resultsHTML(f, sm) {
  var t = T(), out = ''
  if (sm) {
    out += '<section data-key="sem" style="border-bottom:1px solid var(--border);padding:6px 0 10px;display:flex;flex-direction:column;gap:4px">' +
      '<span style="display:flex;align-items:center;gap:6px;padding:4px 10px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)">' + IC.spark + esc(t.semTitle) + '</span>'
    if (sm.status === 'running') out += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;color:var(--sugg);font-size:13px"><span class="spin" aria-hidden="true"></span>' + esc(t.semRun) + '</div>'
    else if (sm.status === 'error') out += '<div style="margin:4px 10px;border-radius:9px;background:var(--warn-soft);color:var(--warn);padding:8px 12px;font-size:12.5px">' + esc(t.error + ': ' + (sm.error || '—')) + '</div>'
    else {
      var res = arr(sm.results).filter(function (r) { var x = D.byId[r.sid]; return !x || passes(x, true) })
      if (!res.length) out += '<div style="padding:8px 10px;color:var(--muted);font-size:13px">' + esc(t.semNone) + '</div>'
      res.forEach(function (r) {
        var x = D.byId[r.sid]
        out += '<button class="res-snip fadein" data-act="open" data-id="' + esc(r.sid) + '" style="background:' + (S.sel === r.sid ? 'var(--sugg-soft)' : 'transparent') + '">' +
          '<span style="display:flex;align-items:center;gap:8px;min-width:0">' + dot(x) +
          '<span style="flex:1 1 auto;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' + (x && isPromptTitle(x) ? ';font-style:italic' : '') + '">' + esc(x ? titleOf(x) : r.sid) + '</span>' +
          (x ? '<span class="c-cost">' + money(x.cost) + '</span><span class="c-time">' + esc(rel(x.last)) + '</span>' : '') + '</span>' +
          '<span style="font-size:12.5px;color:var(--muted);padding-left:16px">' + esc(r.why || '—') + '</span></button>'
      })
    }
    var meta = []
    if (sm.model) meta.push(t.semModel(sm.model))
    if (sm.usd != null) meta.push(t.semCost(moneyFine(sm.usd)))
    if (meta.length) out += '<div style="padding:4px 10px;font-size:11.5px;color:var(--faint)">' + esc(meta.join(' · ')) + '</div>'
    out += '</section>'
  }
  if (f) {
    if (f.status === 'error') out += '<div data-key="ftserr" style="margin:10px;border-radius:9px;background:var(--warn-soft);color:var(--warn);padding:8px 12px;font-size:12.5px">' + esc(t.error + ': ' + (f.error || '—')) + '</div>'
    var by = {}, order = []
    arr(f.hits).forEach(function (h) {
      if (!h || !h.sid) return
      var x = D.byId[h.sid]
      if (x && !passes(x, true)) return
      if (!by[h.sid]) { by[h.sid] = []; order.push(h.sid) }
      by[h.sid].push(h)
    })
    order.sort(function (a, b) { var x = D.byId[a], y = D.byId[b]; if (x && y) return sortFn(x, y); return x ? -1 : y ? 1 : 0 })
    order.forEach(function (sid) {
      var x = D.byId[sid], list = by[sid], proj = x ? D.projects[D.projOf[sid]] : null
      out += '<article class="fadein" data-key="g-' + esc(sid) + '" style="border-bottom:1px solid var(--border);padding:6px 0 10px">' +
        '<button class="res-snip" data-act="open" data-id="' + esc(sid) + '" style="flex-direction:row;align-items:center;gap:8px;padding:8px 10px;background:' + (S.sel === sid ? 'var(--sugg-soft)' : 'transparent') + '">' +
        dot(x) +
        '<span style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column"><span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' + (x && isPromptTitle(x) ? ';font-style:italic' : '') + '">' + esc(x ? titleOf(x) : sid) + '</span>' +
        '<span class="mono" style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(state.host + ' · ' + (proj ? proj.path : '—') + ' · ' + (x ? lastBranch(x) || '—' : '—')) + '</span></span>' +
        '<span class="mono" style="font-size:12px;color:var(--muted)">×' + list.length + '</span><span class="c-cost">' + (x ? money(x.cost) : '—') + '</span><span class="c-time">' + (x ? esc(rel(x.last)) : '—') + '</span></button>'
      list.slice(0, 3).forEach(function (h) {
        var w = whoOf(h), sn = arr(h.snip)
        out += '<button class="res-snip" data-act="snip" data-id="' + esc(sid) + '" data-n="' + num(h.n) + '" style="padding-left:26px">' +
          '<span style="font-size:11.5px;color:var(--muted);display:flex;gap:6px;align-items:center"><span style="font-weight:600;color:' + w.c + '">' + esc(w.l) + '</span><span class="mono">№' + num(h.n) + '</span></span>' +
          '<span style="color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere;' + (w.mono ? "font-family:'JetBrains Mono',monospace;font-size:12px" : 'font-size:13px') + '">' + esc(sn[0]) + '<mark>' + esc(sn[1]) + '</mark>' + esc(sn[2]) + '</span></button>'
      })
      out += '</article>'
    })
    if (f.status === 'done' && !order.length) out += '<div data-key="ftsnone" style="padding:48px 24px;text-align:center;color:var(--muted);display:flex;flex-direction:column;gap:6px;align-items:center"><span style="font-weight:600;color:var(--text)">' + esc(t.ftsNoneTitle(f.q)) + '</span><span style="font-size:13px">' + esc(t.ftsNoneHint) + '</span></div>'
    if (f.status === 'done') out += '<div data-key="ftsstat" style="padding:10px 10px 0;font-size:11.5px;color:var(--faint)">' + esc(t.ftsStats(num(f.scanned), num(f.ms))) + (f.isCut ? ' · <span style="color:var(--warn)">' + esc(t.ftsCut) + '</span>' : '') + '</div>'
  }
  return out
}

/* ---------- the card ---------- */
function dashed(v) { return v == null || v === '' ? '<span class="dash">—</span>' : esc(v) }
function kv(l, v, color) { return '<div class="kvr"><span>' + esc(l) + '</span><span' + (color && v != null && v !== '' ? ' style="color:' + color + '"' : '') + '>' + dashed(v) + '</span></div>' }
function relPath(f, cwd) { return cwd && f.indexOf(cwd + '/') === 0 ? f.slice(cwd.length + 1) : shortPath(f) }
function resumeCmd(x) { return (x.cwd ? 'cd ' + (/^[\w@%+=:,.\/~-]+$/.test(shortPath(x.cwd)) ? shortPath(x.cwd) : "'" + x.cwd.replace(/'/g, "'\\''") + "'") + ' && ' : '') + 'claude --resume ' + x.id }
function cardHTML(x) {
  var t = T(), host = state.host, path = x.cwd ? shortPath(x.cwd) : '', proj = D.projects[D.projOf[x.id]]
  var chain = [], cur = x, depth = 0
  while (D.ep[cur.id]) { cur = D.byId[D.ep[cur.id]]; chain.unshift(cur); depth++ }
  var root = cur, tree = '', treeTotal = 0, treeN = 0
  function tw(n, d) {
    treeTotal += n.cost; treeN++
    var me = n.id === x.id
    tree += '<button class="ghost" data-act="open" data-id="' + esc(n.id) + '" aria-current="' + me + '" style="background:' + (me ? 'var(--sugg-soft)' : 'transparent') + ';border-radius:7px;padding:4px 8px 4px ' + (8 + d * 18) + 'px;display:flex;align-items:center;gap:8px;text-align:left;font-size:12.5px;min-height:28px;width:100%">' +
      (d > 0 ? '<span aria-hidden="true" class="mono" style="color:var(--sugg-line)">└</span>' : '') + (hasProc(n) ? dot(n, true) : '') +
      '<span style="flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:' + (me ? 600 : 400) + ';color:' + (me ? 'var(--sugg)' : 'var(--text)') + '">' + esc(titleOf(n)) + '</span>' +
      '<span style="font-size:11.5px;color:var(--muted);white-space:nowrap">' + esc(d ? t.fromMsg(n.forkN) : t.root) + '</span><span class="mono" style="width:56px;text-align:right;font-size:12px">' + money(n.cost) + '</span></button>'
    kidsOf(n.id).forEach(function (k) { tw(k, d + 1) })
  }
  tw(root, 0)
  var tk = x.tokens, cw = (tk.cw5 || 0) + (tk.cw1 || 0), haveTok = Object.keys(tk).length > 0
  var tokRows = [['tIn', tk.in, 'var(--sugg)'], ['tOut', tk.out, 'var(--claude)'], ['tCr', tk.cr, 'var(--ok-dot)'], ['tCw', haveTok ? cw : null, 'var(--warn-dot)'], ['tTh', tk.think, 'var(--muted)']]
  var tokMax = Math.max.apply(null, tokRows.map(function (r) { return r[1] || 0 })) || 1
  var models = Object.keys(x.byModel), modelsSum = models.reduce(function (a, m) { return a + num(x.byModel[m].cost) }, 0) || 1
  var msgs = (x.prompts || 0) + (x.answers || 0)
  var files = x.files || [], shownFiles = S.filesAll ? files : files.slice(0, 6), filesOpen = S.filesOpen && files.length > 0
  var tools = Object.keys(x.tools).map(function (k) { return [k, num(x.tools[k])] }).sort(function (a, b) { return b[1] - a[1] })
  var subs = null
  if (x.subagents) {
    var sk = Object.keys(x.subagents), total = sk.reduce(function (a, k) { return a + num(x.subagents[k]) }, 0)
    subs = sk.length ? total + ': ' + sk.map(function (k) { return k + ' ×' + num(x.subagents[k]) }).join(' · ') + (x.subagentCost ? ' · ≈ ' + money(x.subagentCost) : '') : '0'
  }
  var left = daysLeft(x), del
  if (x.deleteAt == null) del = hasProc(x) ? esc(t.delLive) : '<span class="dash">—</span>'
  else del = '<span' + (isSoon(x) ? ' style="color:var(--warn);display:inline-flex;align-items:center;gap:5px">' + IC.clock : '>') + esc(date(x.deleteAt, true) + ' · ' + t.delIn(left)) + '</span>'
  function prompt(key, label, text, n) {
    var open = !!S.promptOpen[key], long = text && text.length > 150
    return '<div style="display:flex;flex-direction:column;gap:5px;background:var(--surface2);border-radius:10px;padding:10px 12px;min-width:0">' +
      '<span style="font-size:12px;color:var(--muted);display:flex;justify-content:space-between;gap:8px"><span>' + esc(label) + '</span><span class="mono">' + (n ? '№' + n : '') + '</span></span>' +
      '<p class="' + (text ? '' : 'dash ') + (long && !open ? 'clamp' : '') + '" style="margin:0;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere">' + (text ? esc(text) : '—') + '</p>' +
      (long ? '<button class="linkbtn" data-act="prompt" data-k="' + key + '" aria-expanded="' + open + '" style="align-self:flex-start;font-size:12px">' + esc(open ? t.collapse : t.expand) + '</button>' : '') + '</div>'
  }
  var copied = S.copied === 'resume'
  var cmd = resumeCmd(x)
  var parentId = x.parent, parent = parentId ? D.byId[parentId] : null
  var kids = kidsOf(x.id)
  var block = actBlock(x), busy = opBusy(), isArch = x.archived === true
  var mineRunning = busy && S.op.sids.indexOf(x.id) >= 0
  var appActions = (safeLink(x.appLink) ? '<a class="ghost abtn" href="' + esc(x.appLink) + '" title="' + esc(t.openAppNote) + '">' + IC.ext + esc(t.openApp) + '</a>' : '') +
    '<span title="' + esc(block || (busy ? t.opBusy : isArch ? t.unarchiveTip : t.archiveTip)) + '" style="display:inline-flex">' +
    '<button class="ghost abtn' + (!isArch && x.activity === 'working' ? ' warn' : '') + '" data-act="' + (isArch ? 'unarchive' : 'archive') + '" data-id="' + esc(x.id) + '"' + (block || busy ? ' disabled' : '') + '>' + (isArch ? IC.unarch : IC.arch) + esc(isArch ? t.unarchive : t.archive) + '</button></span>'
  var h = '<div class="scroll" data-key="card-' + esc(x.id) + '" id="cscroll" style="padding:16px 20px 28px;display:flex;flex-direction:column;gap:16px">' +
    '<button class="ghost back" data-act="closenarrow" style="align-self:flex-start;height:32px;border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:0 12px 0 8px;font-size:13px;color:var(--text);align-items:center;gap:4px">' + IC.back + esc(t.backList) + '</button>' +
    '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<div class="mono" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:12px;color:var(--muted)">' +
        '<span style="display:inline-flex;align-items:center;gap:5px">' + IC.hostS + esc(host) + '</span><span aria-hidden="true" style="color:var(--faint)">·</span>' +
        '<span title="' + esc(x.cwd || x.folder) + '">' + dashed(path) + '</span><span aria-hidden="true" style="color:var(--faint)">·</span>' +
        '<span style="display:inline-flex;align-items:center;gap:5px">' + fork(13, null, 1.5) + dashed(x.branches.join(', ')) + '</span></div>' +
      '<div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px 12px"><h2 style="margin:0;font-size:22px;font-weight:650;letter-spacing:-0.015em;line-height:1.25;flex:1 1 300px;min-width:0;overflow-wrap:anywhere;font-style:' + (isPromptTitle(x) ? 'italic' : 'normal') + '">' + esc(titleOf(x)) + '</h2>' +
        '<span class="pill" title="' + esc(t.actTip[x.activity]) + '" style="height:26px;padding:0 11px;font-size:12.5px;color:' + (hasProc(x) ? 'var(--ok)' : 'var(--muted)') + ';background:' + (hasProc(x) ? 'var(--ok-soft)' : 'var(--surface2)') + '">' + (x.activity === 'closed' ? IC.checkS : dot(x)) + esc(t.actL[x.activity]) + '</span></div>' +
      (depth ? '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;font-size:12.5px;color:var(--muted)">' + fork(13, 'var(--sugg)') + '<span style="color:var(--sugg);font-weight:600">' + esc(t.forkDepth(depth)) + '</span>' +
        chain.map(function (a) { return '<button class="linkbtn" data-act="open" data-id="' + esc(a.id) + '" style="font-weight:500">' + esc(titleOf(a)) + '</button><span aria-hidden="true" style="color:var(--faint)">›</span>' }).join('') +
        '<span style="color:var(--text)">' + esc(titleOf(x)) + '</span></div>' : '') +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:stretch">' +
      '<div style="flex:1 1 380px;min-width:0;display:flex;align-items:stretch;border:1px solid var(--claude-line);border-radius:11px;overflow:hidden;background:var(--surface)">' +
        '<code class="mono" style="flex:1 1 auto;min-width:0;display:flex;align-items:center;padding:0 12px;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)" title="' + esc(cmd) + '"><span style="color:var(--faint)">$&#160;</span>' + esc(cmd) + '</code>' +
        '<button class="btn-primary" data-act="resume" data-id="' + esc(x.id) + '" style="flex:none;padding:0 14px;height:42px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:8px">' + (copied ? IC.check + esc(t.copied) : IC.copy + esc(t.copyResume)) + '<kbd>c</kbd></button></div>' +
      '<button class="ghost abtn" data-act="reader" data-id="' + esc(x.id) + '">' + IC.chat + esc(t.showChat) + '</button>' + appActions + '</div>' +
      (mineRunning ? '<div class="opnote" role="status"><span class="spin" aria-hidden="true"></span>' + esc(t.confirmApp) + '</div>' : '') +
      failsHTML('card') +
      (safeLink(x.appLink) ? '<div style="display:flex;align-items:flex-start;gap:6px;font-size:12px;color:var(--faint)">' + IC.info.replace('width="15" height="15"', 'width="13" height="13"') + '<span>' + esc(t.openAppNote) + '</span></div>' : '') +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;font-size:12px;color:var(--muted)"><span>' + esc(path ? t.runLocal(path) : t.noCwd) + '</span>' +
        '<span style="display:inline-flex;align-items:center;gap:4px"><span>' + esc(t.sessionId) + '</span><span class="mono" style="color:var(--text)">' + esc(x.id) + '</span><button class="ghost" data-act="copyid" data-id="' + esc(x.id) + '" aria-label="' + esc(t.copyId) + '" title="' + esc(t.copyId) + '" style="width:24px;height:24px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;color:var(--muted)">' + IC.copyS + '</button></span></div></div>' +
    '<div class="cgrid">' +
      '<section class="sec"><h3>' + esc(t.secTime) + '</h3>' +
        '<div class="kvr"><span>' + esc(t.stateL) + '</span><span style="display:inline-flex;align-items:center;gap:7px" title="' + esc(t.actTip[x.activity]) + '">' + dot(x) + esc(t.actL[x.activity]) + '</span></div>' +
        kv(t.memL, mbText(x.memMb)) +
        kv(t.start, date(x.start, true)) + kv(t.lastAct, x.last ? (x.activity === 'working' ? t.now + ' · ' : '') + date(x.last, true) : null) +
        kv(t.duration, x.start && x.last ? dur(x.last - x.start) + (x.activity === 'working' ? ' · ' + t.stillGoing : '') : null) + kv(t.modelTime, dur(x.apiMs)) + kv(t.toolTime, dur(x.toolMs)) +
        '<div class="kvr"><span>' + esc(t.delAt) + '</span><span>' + del + '</span></div></section>' +
      '<section class="sec"><h3>' + esc(t.secModel) + '</h3>' +
        '<div class="kvr"><span>' + esc(t.models) + '</span><span style="display:flex;flex-wrap:wrap;align-items:center;gap:4px">' + (x.models.length ? x.models.map(function (m, i) { return (i ? '<span aria-hidden="true" style="color:var(--faint)">→</span>' : '') + '<span class="mono" style="font-size:12px">' + esc(m) + '</span>' }).join('') : '<span class="dash">—</span>') + '</span></div>' +
        kv(t.effort, x.effort) + kv(t.perm, x.perm ? (t.permD[x.perm] || x.perm) : null, /bypass/.test(x.perm) ? 'var(--warn)' : null) +
        kv(t.origin, x.entry ? (t.originD[x.entry] || x.entry) : null) + kv(t.version, x.version) + '</section>' +
      '<section class="sec span2"><h3>' + esc(t.secMoney) + '</h3><div style="display:flex;flex-wrap:wrap;gap:20px 32px;align-items:flex-start">' +
        '<div style="display:flex;flex-direction:column;gap:2px;min-width:150px"><span class="mono" style="font-size:34px;font-weight:600;letter-spacing:-0.02em;line-height:1.1;color:var(--claude)">≈ ' + money(x.cost) + '</span>' +
        '<span style="font-size:12.5px;color:var(--muted)">' + esc(t.perMsg(money(x.cost / Math.max(1, msgs)))) + '</span>' +
        '<span style="font-size:12.5px;color:var(--muted);margin-top:6px">' + esc(t.webSearch) + ': <span class="mono" style="color:var(--text)">' + dashed(x.web == null ? null : String(x.web)) + '</span></span>' +
        (!x.costKnown ? '<span style="font-size:12px;color:var(--warn);margin-top:6px;max-width:220px">' + esc(t.costUnknown) + '</span>' : '') + '</div>' +
        '<div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:7px">' + tokRows.map(function (r) {
          var v = r[1] == null ? null : r[1], tip = r[0] === 'tCw' && haveTok ? t.tCw + ': ' + int(cw) + ' (5m ' + int(tk.cw5 || 0) + ' · 1h ' + int(tk.cw1 || 0) + ')' : t[r[0]] + ': ' + int(v)
          return '<div style="display:grid;grid-template-columns:minmax(110px,30%) minmax(0,1fr) 72px;gap:10px;align-items:center;font-size:12.5px" title="' + esc(tip) + '"><span style="color:var(--muted)">' + esc(t[r[0]]) + '</span>' +
            '<span aria-hidden="true" style="height:6px;border-radius:3px;background:var(--surface2);overflow:hidden"><span style="display:block;height:6px;width:' + (v ? Math.max(1.5, v / tokMax * 100) : 0) + '%;border-radius:3px;background:' + r[2] + '"></span></span>' +
            '<span class="mono' + (v == null ? ' dash' : '') + '" style="text-align:right">' + tok(v) + '</span></div>'
        }).join('') + '</div></div>' +
        (models.length > 1 ? '<div style="border-top:1px solid var(--border);padding-top:10px;display:flex;flex-direction:column;gap:7px"><span style="font-size:12px;color:var(--muted)">' + esc(t.byModel) + '</span>' + models.map(function (m) {
          var b = obj(x.byModel[m])
          return '<div style="display:grid;grid-template-columns:minmax(150px,30%) minmax(0,1fr) auto 72px;gap:10px;align-items:center;font-size:12.5px"><span class="mono" style="overflow:hidden;text-overflow:ellipsis">' + esc(m) + '</span>' +
            '<span aria-hidden="true" style="height:6px;border-radius:3px;background:var(--surface2);overflow:hidden"><span style="display:block;height:6px;width:' + (num(b.cost) / modelsSum * 100) + '%;border-radius:3px;background:var(--claude)"></span></span>' +
            '<span class="mono" style="color:var(--muted);font-size:11.5px">' + tok(b.in) + ' / ' + tok(b.out) + '</span><span class="mono" style="text-align:right;font-weight:600">' + money(b.cost) + '</span></div>'
        }).join('') + '</div>' : '') + '</section>' +
      '<section class="sec span2"><h3>' + esc(t.secWork) + '</h3>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">' + prompt('first', t.firstPrompt, x.first, x.first ? 1 : 0) + prompt('last', t.lastPrompt, x.lastPrompt, 0) + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px 28px;font-size:13px">' +
          '<span style="display:flex;gap:6px;align-items:baseline"><span style="color:var(--muted)">' + esc(t.msgsMine) + '</span><span class="mono" style="font-weight:600">' + int(x.prompts) + '</span></span>' +
          '<span style="display:flex;gap:6px;align-items:baseline"><span style="color:var(--muted)">' + esc(t.msgsClaude) + '</span><span class="mono" style="font-weight:600">' + int(x.answers) + '</span></span>' +
          '<span style="display:flex;gap:6px;align-items:baseline"><span style="color:var(--muted)">' + esc(t.lines) + '</span>' + (x.added == null && x.removed == null ? '<span class="dash">—</span>' : '<span class="mono" style="font-weight:600;color:var(--ok)">' + (x.added == null ? '—' : '+' + int(x.added)) + '</span><span class="mono" style="font-weight:600;color:var(--bad)">' + (x.removed == null ? '' : '−' + int(x.removed)) + '</span>') + '</span>' +
          '<span style="display:flex;gap:6px;align-items:baseline;min-width:0"><span style="color:var(--muted)">' + esc(t.subagents) + '</span><span style="font-weight:500">' + dashed(subs) + '</span></span></div>' +
        '<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:12px;color:var(--muted)">' + esc(t.toolsL) + '</span><div style="display:flex;flex-wrap:wrap;gap:6px">' +
          (tools.length ? tools.map(function (q) { return '<span class="mono" style="display:inline-flex;align-items:center;gap:6px;height:26px;border:1px solid var(--border);border-radius:7px;padding:0 8px;font-size:12px"><span>' + esc(q[0]) + '</span><span style="color:var(--claude);font-weight:600">' + q[1] + '</span></span>' }).join('') : '<span class="dash">— ' + esc(t.noTools) + '</span>') + '</div></div>' +
        '<div style="display:flex;flex-direction:column;gap:6px"><button class="ghost" data-act="files" aria-expanded="' + filesOpen + '"' + (files.length ? '' : ' disabled') + ' style="align-self:flex-start;border-radius:7px;padding:2px 6px 2px 0;font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:4px">' +
          '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform:rotate(' + (filesOpen ? 90 : 0) + 'deg);transition:transform .15s"><path d="M6 3.5L10.5 8 6 12.5"></path></svg>' + esc(t.filesL) + ' <span class="mono" style="color:var(--text)">' + (x.files == null ? '—' : files.length) + '</span></button>' +
          (filesOpen ? '<ul style="list-style:none;margin:0;padding:0 0 0 16px;display:flex;flex-direction:column;gap:3px">' + shownFiles.map(function (f) {
            var r = relPath(f, x.cwd), i = r.lastIndexOf('/')
            return '<li class="mono" style="font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(f) + '"><span style="color:var(--faint)">' + esc(r.slice(0, i + 1)) + '</span>' + esc(r.slice(i + 1)) + '</li>'
          }).join('') + (files.length > shownFiles.length ? '<li><button class="linkbtn" data-act="morefiles" style="font-size:12px">' + esc(t.moreFiles(files.length - shownFiles.length)) + '</button></li>' : '') + '</ul>' : '') + '</div></section>' +
      '<section class="sec span2"><h3>' + esc(t.secLinks) + '</h3>' +
        '<div class="kvr"><span>' + esc(t.parent) + '</span><span>' + (parentId ? (parent ? '<button class="linkbtn" data-act="open" data-id="' + esc(parentId) + '">' + esc(titleOf(parent)) + '</button>' : '<span class="mono" style="font-size:12px">' + esc(parentId) + '</span> <span class="dash">(' + esc(t.missing) + ')</span>') +
          '<span style="color:var(--muted)"> · ' + esc(t.forkedAt(x.forkN)) + '</span>' + (parent ? ' <button class="ghost" data-act="readerat" data-id="' + esc(parentId) + '" data-n="' + x.forkN + '" style="border-radius:6px;padding:1px 6px;font-size:12px;color:var(--sugg)">' + esc(t.showPlace) + '</button>' : '')
          : '<span class="dash">— </span><span style="color:var(--muted);font-size:12.5px">' + esc(t.notFork) + '</span>') + '</span></div>' +
        '<div class="kvr"><span>' + esc(t.children) + '</span><span>' + (kids.length ? '<span style="display:flex;flex-direction:column;gap:4px">' + kids.map(function (k) {
          return '<span style="display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline"><button class="linkbtn" data-act="open" data-id="' + esc(k.id) + '">' + esc(titleOf(k)) + '</button><span style="font-size:12px;color:var(--muted)">' + esc(t.fromMsg(k.forkN)) + ' · <span class="mono">' + money(k.cost) + '</span> · ' + esc(rel(k.last)) + '</span></span>'
        }).join('') + '</span>' : '<span class="dash">—</span>') + '</span></div>' +
        '<div style="border-top:1px solid var(--border);padding-top:10px;display:flex;flex-direction:column;gap:2px"><span style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px"><span style="font-size:12px;color:var(--muted)">' + esc(t.forkTree + ' · ' + t.sessions(treeN)) + '</span><span style="font-size:12.5px;color:var(--muted)">' + esc(t.treeTotal) + ' <span class="mono" style="font-size:15px;font-weight:600;color:var(--claude)">' + money(treeTotal) + '</span></span></span>' + tree + '</div></section>' +
    '</div></div>'
  return h
}

/* ---------- the reader ---------- */
function readerHTML(x) {
  var t = T(), r = S.readerData && S.readerData.sid === x.id ? S.readerData : null, q = S.rq.trim()
  var ctx = { i: 0, cur: S.rIdx, msgs: [] }, body = ''
  var waiting = !r || (S.readReq && r.id !== S.readReq.id) || (r.status === 'running' && !arr(r.items).length)
  if (waiting) body = '<div data-key="load" style="display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;padding:24px 0"><span class="spin" style="color:var(--sugg)" aria-hidden="true"></span>' + esc(t.loading) + '</div>' +
    [70, 45, 60].map(function (w, i) { return '<div aria-hidden="true" data-key="lsk' + i + '" style="display:flex;gap:10px;align-items:center"><span class="sk" style="width:28px;height:28px;border-radius:50%"></span><span class="sk" style="width:' + w + '%;height:34px;border-radius:10px"></span></div>' }).join('')
  else if (r.status === 'error') body = '<div data-key="rerr" style="border-radius:10px;background:var(--warn-soft);color:var(--warn);padding:9px 12px;font-size:12.5px">' + esc(t.error + ': ' + (r.error || '—')) + '</div>'
  else {
    var items = arr(r.items), start = num(r.start) || 1, total = num(r.total)
    var kidsAt = {}
    kidsOf(x.id).forEach(function (k) { (kidsAt[k.forkN] = kidsAt[k.forkN] || []).push(k) })
    var parent = D.ep[x.id] ? D.byId[D.ep[x.id]] : null
    if (start > 1) body += '<button class="ghost" data-act="gap" data-start="' + Math.max(1, start - 200) + '" data-dir="up" style="align-self:center;border:1px dashed var(--border2);background:transparent;border-radius:999px;padding:4px 14px;font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:6px">' + IC.expand.replace('width="14" height="14"', 'width="12" height="12"') + esc(t.gap(start - 1)) + '</button>'
    var group = null
    function flush() {
      if (!group) return
      var g = group, me = g.role === 'user'
      group = null
      var toolsHTML = ''
      if (S.showTools) g.tools.forEach(function (it) {
        var tk = x.id + '-' + it.n, open = !!S.openTools[tk]
        toolsHTML += '<div id="m-' + it.n + '" style="display:flex;flex-direction:column;max-width:100%">' +
          '<button class="toolrow" data-act="tool" data-k="' + esc(tk) + '" aria-expanded="' + open + '"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;transform:rotate(' + (open ? 90 : 0) + 'deg);transition:transform .15s"><path d="M6 3.5L10.5 8 6 12.5"></path></svg>' +
          '<span style="color:var(--claude);font-weight:600;flex:none">' + esc(it.tool || 'tool') + '</span><span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)">' + segs(it.text, q, ctx, it.n) + '</span>' +
          '<span class="mono" style="margin-left:auto;flex:none;font-size:11px;color:var(--faint)">№' + it.n + '</span></button>' +
          (open ? '<pre class="mono fadein" style="margin:4px 0 0;padding:8px 12px;background:var(--surface2);border-radius:8px;font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text);overflow-x:auto">' + segs(it.out == null || it.out === '' ? '—' : it.out, q, ctx, it.n) + '</pre>' : '') + '</div>'
      })
      if (!g.text && !toolsHTML) return
      body += '<div class="msg' + (g.copied ? ' copied' : '') + '" id="m-' + g.n + '">' +
        '<span aria-hidden="true" class="av" style="background:' + (me ? 'var(--surface2)' : 'var(--claude-soft)') + ';color:' + (me ? 'var(--muted)' : 'var(--claude)') + '">' + (me ? esc(t.you.charAt(0)) : IC.claude) + '</span>' +
        '<div style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font-size:12px;color:var(--muted);display:flex;gap:8px;align-items:center"><span style="font-weight:600;color:' + (me ? 'var(--text)' : 'var(--claude)') + '">' + esc(me ? t.you : 'Claude') + '</span><span class="mono">№' + g.n + '</span>' +
        (g.at ? '<span>' + esc(date(g.at, true)) + '</span>' : '') + (g.copied ? '<span class="ctag">' + esc(t.copiedTag) + '</span>' : '') + '</span>' +
        (g.text ? '<div class="bubble" style="background:' + (me ? 'var(--surface2)' : 'var(--claude-soft)') + ';border:1px solid ' + (me ? 'transparent' : 'var(--claude-line)') + '">' + segs(g.text.text, q, ctx, g.text.n) + '</div>' : '') +
        toolsHTML + '</div></div>'
    }
    items.forEach(function (it) {
      it = obj(it)
      var n = num(it.n), role = it.role
      if (role === 'tool') {
        if (!group || group.role !== 'claude' || group.copied !== !!it.copied) { flush(); group = { role: 'claude', n: n, at: it.at, copied: !!it.copied, text: null, tools: [] } }
        group.tools.push({ n: n, tool: str(it.tool), text: str(it.text), out: it.out == null ? null : str(it.out) })
      } else {
        flush()
        group = { role: role === 'user' ? 'user' : 'claude', n: n, at: it.at, copied: !!it.copied, text: { n: n, text: str(it.text) }, tools: [] }
        if (role === 'user') flush()
      }
      if (parent && x.forkN && n === x.forkN) {
        flush()
        body += '<div style="display:flex;align-items:center;gap:10px;border:1px dashed var(--sugg-line);background:var(--sugg-soft);border-radius:10px;padding:9px 12px;font-size:12.5px;color:var(--sugg)">' + fork(14) +
          '<span style="flex:1 1 auto">' + esc(t.forkStart(titleOf(parent), x.forkN)) + '</span><button class="linkbtn" data-act="readerat" data-id="' + esc(parent.id) + '" data-n="' + x.forkN + '" style="font-size:12.5px">' + esc(t.openParent) + '</button></div>'
      }
      if (kidsAt[n]) {
        flush()
        kidsAt[n].forEach(function (k) {
          body += '<div style="display:flex;align-items:center;gap:10px;color:var(--sugg);font-size:12.5px"><span aria-hidden="true" style="flex:1 1 20px;border-top:1.5px dashed var(--sugg-line)"></span>' +
            '<span style="display:inline-flex;align-items:center;gap:8px;background:var(--sugg-soft);border:1px solid var(--sugg-line);border-radius:999px;padding:4px 6px 4px 12px;max-width:80%">' + fork(13) +
            '<span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.forkHere(titleOf(k))) + '</span>' +
            '<button data-act="open" data-id="' + esc(k.id) + '" style="flex:none;background:var(--sugg);color:var(--surface);border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600">' + esc(t.open) + '</button></span>' +
            '<span aria-hidden="true" style="flex:1 1 20px;border-top:1.5px dashed var(--sugg-line)"></span></div>'
        })
      }
    })
    flush()
    var lastN = items.length ? num(obj(items[items.length - 1]).n) : start - 1
    if (total > lastN) body += '<button class="ghost" data-act="gap" data-start="' + (lastN + 1) + '" data-dir="down" style="align-self:center;border:1px dashed var(--border2);background:transparent;border-radius:999px;padding:4px 14px;font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:6px">' + IC.expand.replace('width="14" height="14"', 'width="12" height="12"') + esc(t.gap(total - lastN)) + '</button>'
    else if (x.activity === 'working') body += '<div style="display:flex;gap:10px;align-items:center"><span aria-hidden="true" class="av" style="background:var(--claude-soft);color:var(--claude)">' + IC.claude + '</span><span style="display:inline-flex;align-items:center;gap:8px;background:var(--ok-soft);color:var(--ok);border-radius:4px 12px 12px 12px;padding:7px 12px;font-size:13px"><span class="live-dot" aria-hidden="true"></span>' + esc(t.working) + '</span></div>'
    if (r.status === 'running') body += '<div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12.5px"><span class="spin" aria-hidden="true"></span>' + esc(t.loading) + '</div>'
  }
  hitCount = ctx.i; hitMsgs = ctx.msgs
  if (S.rIdx >= hitCount) S.rIdx = 0
  var countL = q ? (hitCount ? t.nOf(Math.min(S.rIdx + 1, hitCount), hitCount) : t.noHits) : ''
  var total2 = r && r.status !== 'error' ? num(r.total) || x.n : x.n
  return '<div data-key="rhead" style="display:flex;flex-direction:column;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border)">' +
    '<div style="display:flex;align-items:center;gap:10px;min-width:0">' +
      '<button class="ghost" data-act="closereader" style="flex:none;height:30px;border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:0 10px 0 6px;font-size:12.5px;display:inline-flex;align-items:center;gap:4px">' + IC.back + esc(t.backCard) + '</button>' +
      '<div style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column"><span style="font-weight:650;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' + (isPromptTitle(x) ? ';font-style:italic' : '') + '">' + esc(titleOf(x)) + '</span><span style="font-size:12px;color:var(--muted)">' + esc(t.readerMeta(total2, state.host)) + '</span></div>' +
      '<button class="btn-primary" data-act="resume" data-id="' + esc(x.id) + '" title="' + esc(resumeCmd(x)) + '" style="flex:none;height:30px;border-radius:8px;padding:0 10px;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px">' + IC.copyS + 'resume</button></div>' +
    '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">' +
      '<div style="position:relative;flex:1 1 240px;min-width:0">' + IC.search + '<input id="sb-rq" data-key="rq" class="field" type="text" placeholder="' + esc(t.findIn) + '" aria-label="' + esc(t.findIn) + '" autocomplete="off" style="width:100%;height:34px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:9px;padding:0 10px 0 30px;font:inherit;font-size:13px;outline:none"></div>' +
      '<span class="mono" aria-live="polite" style="font-size:12px;color:' + (q && !hitCount ? 'var(--warn)' : 'var(--muted)') + ';min-width:64px;text-align:center">' + esc(countL) + '</span>' +
      '<button class="ghost" data-act="rprev"' + (hitCount ? '' : ' disabled') + ' aria-label="' + esc(t.prev) + '" title="' + esc(t.prev) + ' (Shift+↵)" style="width:32px;height:32px;border:1px solid var(--border);background:var(--surface);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + IC.up + '</button>' +
      '<button class="ghost" data-act="rnext"' + (hitCount ? '' : ' disabled') + ' aria-label="' + esc(t.next) + '" title="' + esc(t.next) + ' (↵)" style="width:32px;height:32px;border:1px solid var(--border);background:var(--surface);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted)">' + IC.down + '</button>' +
      '<label class="fchk" style="height:32px;font-size:12px"><input type="checkbox" data-ch="showtools"' + (S.showTools ? ' checked' : '') + '>' + esc(t.showTools) + '</label></div></div>' +
    '<div class="scroll" data-key="rbody" id="rscroll" style="padding:16px 20px 28px;display:flex;flex-direction:column;gap:14px">' + body + '</div>'
}

function renderCard() {
  var t = T(), x = state && D && S.sel ? D.byId[S.sel] : null, el = $('card'), key
  el.setAttribute('aria-label', t.cardLabel)
  if (!x) {
    key = 'pick'
    paint(el, '<div data-key="pick" style="flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:40px;color:var(--muted)">' + IC.pick +
      '<span style="font-size:15px;font-weight:600;color:var(--text)">' + esc(t.pickTitle) + '</span><span style="font-size:13px;max-width:340px">' + esc(t.pickHint) + '</span></div>')
  } else if (S.view === 'reader') {
    key = 'reader-' + x.id
    paint(el, readerHTML(x))
  } else {
    key = 'card-' + x.id
    paint(el, cardHTML(x))
  }
  if (S.cardKey !== key) { var sc = el.querySelector('.scroll'); if (sc && S.view !== 'reader') sc.scrollTop = 0; S.cardKey = key }
  $('root').className = 'sb' + (S.narrowOpen && x ? ' show-card' : '')
}

function renderToast() {
  var t = T(), html = ''
  if (S.toast) html = '<div class="toast" role="status">' + (S.toastBad ? IC.info : IC.check) + '<span class="' + (S.toastPlain ? '' : 'mono') + '" style="font-size:' + (S.toastPlain ? 13 : 12.5) + 'px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(S.toast) + '</span></div>'
  else if (opBusy()) html = '<div class="toast" role="status"><span class="spin" aria-hidden="true"></span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.opRun(S.op.kind, S.op.sids.length)) + '</span></div>'
  paint($('toast'), html)
}

function fit() {
  var l = document.querySelector('.layout')
  if (!l) return
  var top = l.getBoundingClientRect().top + window.scrollY
  var h = Math.max(440, window.innerHeight - top - 20)
  document.documentElement.style.setProperty('--paneh', h + 'px')
}

function render() {
  document.documentElement.lang = lang()
  document.title = T().page
  renderHeader(); renderSearch(); renderFilters(); renderLeft(); renderCard(); renderToast(); fit()
}
var queued = false
function schedule() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; render() }) }

/* ---------- actions ---------- */
function toast(text, ms, plain, bad) {
  S.toast = text; S.toastPlain = !!plain; S.toastBad = !!bad; renderToast()
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { S.toast = ''; renderToast() }, ms || 2200)
}
/* ---------- archive / restore in Claude Desktop ---------- */
function startOp(kind, sids, origin) {
  if (!sids.length || opBusy()) return
  var id = Date.now()
  S.op = { id: id, kind: kind, sids: sids, origin: origin, status: 'running', results: [] }
  S.fails = null; S.toast = ''
  send({ type: kind, id: id, sids: sids })
  render()
}
function cardOp(kind, id) {
  var x = D && D.byId[id], t = T()
  if (!x || actBlock(x) || opBusy()) return
  if (kind === 'archive' && x.activity === 'working' && !window.confirm(t.confirmWorking)) return
  startOp(kind, [id], 'card')
}
function bulkOp(kind) {
  var t = T(), list = pickedList().filter(function (x) { return kind === 'archive' ? x.archived === false : x.archived === true })
  if (!list.length || opBusy()) return
  var busyN = kind === 'archive' ? list.filter(function (x) { return x.activity === 'working' }).length : 0
  if (busyN && !window.confirm(busyN === 1 && list.length === 1 ? t.confirmWorking : t.confirmWorkingN(busyN))) return
  startOp(kind, list.map(function (x) { return x.id }), 'bulk')
}
function finishOp() {
  var o = S.op, t = T(), done = o.results.filter(function (r) { return r.ok }).length
  var bad = o.results.filter(function (r) { return !r.ok })
  S.fails = bad.length || o.status === 'error' ? { kind: o.kind, origin: o.origin, error: o.status === 'error', items: bad } : null
  if (o.status === 'error') toast(t.opErr(o.kind) + (bad.length ? '' : ' — ' + t.noReason), 5000, true, true)
  else toast(t.opDone(o.kind, done, o.sids.length), 5000, true, bad.length > 0)
  if (o.origin === 'bulk') S.picks = {}
}
function quickPick(kind) {
  var now = Date.now(), f = isFiltering()
  S.picks = {}
  state.sessions.forEach(function (x) {
    if (x.activity !== 'open' || actBlock(x) || (f && !passes(x))) return
    if (kind === 'idle' && x.last && now - x.last < DAY) return
    S.picks[x.id] = true
  })
  render()
}
function togglePick(id) {
  var x = D && D.byId[id]
  if (!x || actBlock(x)) return
  if (S.picks[id]) delete S.picks[id]; else S.picks[id] = true
  render()
}
function copyText(text, tag) {
  function done() {
    S.copied = tag; toast(T().copied + ': ' + text); renderCard()
    clearTimeout(copiedTimer); copiedTimer = setTimeout(function () { if (S.copied === tag) { S.copied = ''; renderCard() } }, 1600)
  }
  function fallback() {
    var ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0'
    var had = document.activeElement
    document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy') } catch (e) {}
    document.body.removeChild(ta)
    if (had && had.focus) had.focus({ preventScroll: true })
    done()
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback)
    else fallback()
  } catch (e) { fallback() }
}
function copyResume(id) { var x = D && D.byId[id || S.sel]; if (x) copyText(resumeCmd(x), 'resume') }
function reveal(id) {
  var c = id, g = 0
  while (c && g++ < 10000) { var p = D.ep[c]; if (p) S.collapsed['s-' + p] = false; c = p }
  S.collapsed['p-' + D.projOf[id]] = false; S.collapsed['h-host'] = false
}
function select(id, keepView) {
  if (!D || !D.byId[id]) return
  if (S.sel !== id) { S.filesOpen = false; S.filesAll = false; S.promptOpen = {} }
  S.sel = id; S.focus = 's-' + id; S.narrowOpen = true
  if (!keepView) S.view = 'card'
  reveal(id)
  render()
  var el = $('row-s-' + id); if (el && !S.results) el.scrollIntoView({ block: 'nearest' })
}
function requestRead(sid, start) {
  var id = Date.now()
  S.readReq = { id: id, sid: sid, start: start }
  send({ type: 'read', id: id, sid: sid, start: start, count: 200, tools: true })
}
function openReader(sid, n, q) {
  var x = D && D.byId[sid]; if (!x) return
  select(sid, true)
  S.view = 'reader'; S.rq = q || ''; S.rIdx = 0
  var total = x.n || 0, start = n ? Math.max(1, n - 100) : Math.max(1, total - 199)
  S.readScroll = n ? { n: n, q: !!q } : { bottom: true }
  var rd = S.readerData
  if (!(rd && rd.sid === sid && rd.status === 'done' && (S.readReq && rd.id === S.readReq.id) && n && n >= rd.start && n < rd.start + arr(rd.items).length)) requestRead(sid, start)
  render()
  var input = $('sb-rq'); if (input) input.value = S.rq
  applyReadScroll()
}
function applyReadScroll() {
  var rd = S.readerData, sc = $('rscroll')
  if (!S.readScroll || !sc || S.view !== 'reader' || !rd || rd.sid !== S.sel || (S.readReq && rd.id !== S.readReq.id) || rd.status === 'running') return
  var want = S.readScroll; S.readScroll = null
  if (want.n) {
    if (want.q && hitCount) {
      var i = 0; while (i < hitMsgs.length && hitMsgs[i] < want.n) i++
      if (i < hitCount) { S.rIdx = i; renderCard(); scrollHit(i); return }
    }
    var el = $('m-' + want.n)
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash') }, 1700) }
  } else if (want.top) sc.scrollTop = 0
  else if (want.bottom) sc.scrollTop = sc.scrollHeight
}
function scrollHit(i) { var el = $('hit-' + i); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
function stepHit(d) { if (!hitCount) return; S.rIdx = (S.rIdx + d + hitCount) % hitCount; renderCard(); scrollHit(S.rIdx) }
function ftsQueryText() {
  var q = textQuery()
  if (q) return q
  var ph = S.chips.filter(function (c) { return c.k === 'phrase' })[0]
  return ph ? ph.v : ''
}
function commitSearch() {
  var input = $('sb-search'), r = parseInput(input.value, true)
  S.chips = S.chips.concat(r.chips); S.query = r.text; input.value = r.text
}
function startSearches() {
  var q = ftsQueryText(), t = T()
  if (!S.ftsMode && !S.semantic) { render(); return }
  if (!q) { toast(t.ftsNeedQuery); render(); $('sb-search').focus(); return }
  if (S.ftsMode) startFts(q)
  if (S.semantic) startSem(q)
  S.results = true
  render()
}
function startFts(q) {
  var id = Date.now()
  S.ftsId = id; S.showFts = true
  S.ftsData = { id: id, q: q, tools: S.withTools, status: 'running', hits: [], scanned: 0, sessions: 0, ms: 0, isCut: false, error: '' }
  send({ type: 'fts', id: id, q: q, tools: S.withTools })
}
function startSem(q) {
  var id = Date.now() + 1
  S.semId = id; S.showSem = true
  S.semData = { id: id, q: q, status: 'running', results: [], model: state ? state.semanticModel : '', usd: null, error: '' }
  send({ type: 'semantic', id: id, q: q })
}
function resetAll() {
  S.query = ''; S.chips = []; S.fHost = 'all'; S.fProj = 'all'; S.fPeriod = 'all'; S.fModel = 'all'; S.fStatus = 'all'; S.fForks = false; S.fSoon = false; S.results = false
  $('sb-search').value = ''
  render()
}
function focusRow(key) {
  if (!key) return
  S.focus = key
  rowKeys.forEach(function (k) { var el = $('row-' + k); if (el) el.tabIndex = k === key ? 0 : -1 })
  var el = $('row-' + key); if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }) }
}

document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('[data-act]') : null
  if (!el || el.disabled) return
  var a = el.getAttribute('data-act'), id = el.getAttribute('data-id'), k = el.getAttribute('data-k'), v = el.getAttribute('data-v'), t = T()
  if (a === 'tog') { var info = rowInfo[k]; toggleKey(k, info ? info.expanded : !S.collapsed[k]); var r = $('row-' + k); if (r && el.classList.contains('rowbtn')) r.focus({ preventScroll: true }) }
  else if (a === 'open') select(id)
  else if (a === 'spend') { S.spend = v; render() }
  else if (a === 'status') { S.fStatus = v; render() }
  else if (a === 'chipx') { S.chips.splice(+el.getAttribute('data-i'), 1); render(); $('sb-search').focus() }
  else if (a === 'clr') { S.query = ''; S.chips = []; S.results = false; $('sb-search').value = ''; render(); $('sb-search').focus() }
  else if (a === 'fts') {
    S.ftsMode = !S.ftsMode
    if (S.ftsMode) { commitSearch(); if (ftsQueryText()) { startFts(ftsQueryText()); S.results = true } render() }
    else { S.showFts = false; if (!S.showSem) S.results = false; render() }
  }
  else if (a === 'trytext') { S.ftsMode = true; commitSearch(); startSearches() }
  else if (a === 'reset') resetAll()
  else if (a === 'expand') { S.collapsed = {}; render() }
  else if (a === 'collapse') { var c = {}; rowKeys.forEach(function (rk) { if (rk.indexOf('p-') === 0 || (rk.indexOf('s-') === 0 && kidsOf(rk.slice(2)).length)) c[rk] = true }); S.collapsed = c; render() }
  else if (a === 'backtree') { S.results = false; render() }
  else if (a === 'refresh') { send({ type: 'refresh' }); toast(t.refreshing) }
  else if (a === 'starter') copyText('cd ~/workspace/my-project && claude', 'starter')
  else if (a === 'resume') copyResume(id)
  else if (a === 'copyid') copyText(id, 'id')
  else if (a === 'reader') openReader(id)
  else if (a === 'readerat') openReader(id, +el.getAttribute('data-n') || 0)
  else if (a === 'snip') openReader(id, +el.getAttribute('data-n') || 0, S.ftsData ? S.ftsData.q : '')
  else if (a === 'closereader') { S.view = 'card'; render() }
  else if (a === 'closenarrow') { S.narrowOpen = false; render(); focusRow(S.focus) }
  else if (a === 'prompt') { S.promptOpen[k] = !S.promptOpen[k]; renderCard() }
  else if (a === 'files') { S.filesOpen = !S.filesOpen; renderCard() }
  else if (a === 'morefiles') { S.filesAll = true; renderCard() }
  else if (a === 'tool') { S.openTools[k] = !S.openTools[k]; renderCard() }
  else if (a === 'gap') { var st = +el.getAttribute('data-start') || 1; S.readScroll = el.getAttribute('data-dir') === 'up' ? { bottom: true } : { top: true }; requestRead(S.sel, st); renderCard() }
  else if (a === 'archive' || a === 'unarchive') cardOp(a, id)
  else if (a === 'selmode') { S.selMode = !S.selMode; if (!S.selMode) S.picks = {}; render() }
  else if (a === 'selcancel') { S.selMode = false; S.picks = {}; render(); focusRow(S.focus) }
  else if (a === 'pickq') quickPick(v)
  else if (a === 'bulk') bulkOp(v)
  else if (a === 'dismiss') { S.fails = null; render() }
  else if (a === 'rprev') stepHit(-1)
  else if (a === 'rnext') stepHit(1)
})
document.addEventListener('change', function (e) {
  var el = e.target, ch = el.getAttribute && el.getAttribute('data-ch')
  if (!ch) return
  if (ch === 'host') S.fHost = el.value
  else if (ch === 'proj') S.fProj = el.value
  else if (ch === 'period') S.fPeriod = el.value
  else if (ch === 'model') S.fModel = el.value
  else if (ch === 'sort') S.sort = el.value
  else if (ch === 'forks') S.fForks = el.checked
  else if (ch === 'soon') S.fSoon = el.checked
  else if (ch === 'semantic') { S.semantic = el.checked; if (!S.semantic) { S.showSem = false; if (!S.showFts) S.results = false } }
  else if (ch === 'withtools') { S.withTools = el.checked; if (S.showFts && S.ftsData && S.ftsData.q) startFts(S.ftsData.q) }
  else if (ch === 'showtools') S.showTools = el.checked
  else if (ch === 'pick') { var pid = el.getAttribute('data-id'); if (el.checked) S.picks[pid] = true; else delete S.picks[pid] }
  render()
})
document.addEventListener('input', function (e) {
  var el = e.target
  if (el.id === 'sb-search') {
    var r = parseInput(el.value, false)
    if (r.chips.length) { S.chips = S.chips.concat(r.chips); el.value = r.text }
    S.query = r.text
    schedule()
  } else if (el.id === 'sb-rq') {
    S.rq = el.value; S.rIdx = 0
    renderCard()
    if (hitCount) scrollHit(0)
  }
})
document.addEventListener('focusin', function (e) {
  var id = e.target && e.target.id
  if (id && id.indexOf('row-') === 0 && rowInfo[id.slice(4)]) {
    S.focus = id.slice(4)
    rowKeys.forEach(function (k) { var el = $('row-' + k); if (el) el.tabIndex = k === S.focus ? 0 : -1 })
  }
})
document.addEventListener('keydown', function (e) {
  var tg = e.target || {}, id = tg.id || '', tag = tg.tagName
  if (id === 'sb-search') {
    if (e.key === 'Enter') { e.preventDefault(); commitSearch(); startSearches() }
    else if (e.key === 'Backspace' && !tg.value && S.chips.length) { e.preventDefault(); S.chips.pop(); render() }
    else if (e.key === 'Escape') { e.preventDefault(); if (S.query || S.chips.length) { S.query = ''; S.chips = []; S.results = false; tg.value = ''; render() } else tg.blur() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(rowKeys.indexOf(S.focus) >= 0 ? S.focus : rowKeys[0]) }
    return
  }
  if (id === 'sb-rq') {
    if (e.key === 'Enter') { e.preventDefault(); stepHit(e.shiftKey ? -1 : 1) }
    else if (e.key === 'Escape') { e.preventDefault(); tg.blur() }
    return
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === '/') { e.preventDefault(); $('sb-search').focus(); return }
  if (e.key === 'c') { e.preventDefault(); copyResume(); return }
  if (e.key === 'Escape') { if (S.view === 'reader') { S.view = 'card'; render() } else if (S.narrowOpen) { S.narrowOpen = false; render(); focusRow(S.focus) } else if (S.selMode) { S.selMode = false; S.picks = {}; render(); focusRow(S.focus) } return }
  if (id.indexOf('row-') !== 0) return
  var key = id.slice(4), i = rowKeys.indexOf(key), info = rowInfo[key]
  if (!info) return
  if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(rowKeys[Math.min(rowKeys.length - 1, i + 1)]) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(rowKeys[Math.max(0, i - 1)]) }
  else if (e.key === 'Home') { e.preventDefault(); focusRow(rowKeys[0]) }
  else if (e.key === 'End') { e.preventDefault(); focusRow(rowKeys[rowKeys.length - 1]) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); if (info.canExpand && !info.expanded) { toggleKey(key, false); focusRow(key) } else if (info.canExpand) focusRow(rowKeys[i + 1]) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); if (info.canExpand && info.expanded) { toggleKey(key, true); focusRow(key) } else if (info.parent) focusRow(info.parent) }
  else if (e.key === ' ' && S.selMode && key.indexOf('s-') === 0) { e.preventDefault(); togglePick(key.slice(2)); focusRow(key) }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); info.act(); if (key.indexOf('s-') !== 0) focusRow(key) }
})
window.addEventListener('resize', fit)
try { var ro = new ResizeObserver(function () { requestAnimationFrame(fit) }); ro.observe($('hdr')); ro.observe($('frow')); ro.observe(document.querySelector('.srow')) } catch (e) {}
try { document.fonts.ready.then(fit) } catch (e) {}
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { render() }) } catch (e) {}

/* ---------- the hub ---------- */
var firstState = true
hub.onState(function (next) {
  state = normalize(next)
  derive()
  var f = state.fts, sm = state.semantic, rd = state.reader
  if (f && (S.ftsId == null ? true : f.id === S.ftsId)) { S.ftsData = f; if (S.ftsId == null && firstState) { S.showFts = true; S.results = true; S.withTools = !!f.tools } }
  if (sm && (S.semId == null ? true : sm.id === S.semId)) { S.semData = sm; if (S.semId == null && firstState) { S.showSem = true; S.results = true } }
  if (rd && S.readReq && rd.id === S.readReq.id) S.readerData = rd
  var op = state.op
  if (op && S.op && op.id === S.op.id) {
    var was = S.op.status
    S.op.status = op.status === 'running' || op.status === 'done' ? op.status : 'error'; S.op.results = op.results
    if (was === 'running' && S.op.status !== 'running') finishOp()
  }
  if (S.sel && !D.byId[S.sel]) { S.sel = null; S.view = 'card' }
  if (firstState && state.sessions.length) firstState = false
  render()
  if (!S.sel && !S.picked && state.sessions.length && window.innerWidth > 980) {
    var first = rowKeys.filter(function (k) { return k.indexOf('s-') === 0 })[0]
    if (first) { S.picked = true; S.sel = first.slice(2); S.focus = first; render() }
  }
  applyReadScroll()
})
hub.onOnline(function (next) { online = next || online; render() })
hub.onLang(function () { render() })
hub.onTheme(function (th) { document.documentElement.dataset.theme = th })
$('sb-search').value = ''
render()
})()
</script>
</body>
</html>
`

export const PAGE = SOURCE
