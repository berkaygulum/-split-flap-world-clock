export const refreshFrequency = 1000;

export const command = `
  HIDDEN_FILE="$HOME/.worldclock_hidden"
  if [ -f "$HIDDEN_FILE" ]; then
    echo "HIDDEN $(date '+%H %M %S')"
  else
    echo "VISIBLE $(date '+%H %M %S')"
  fi
`;

export const className = `left: 0; top: 0; pointer-events: none;`;

const FONT = "'Oswald','Bebas Neue','Arial Narrow',sans-serif";
const W = 28, H = 40, FS = 30;
const LW = 28, LH = 40, LFS = 30;
const LABEL_LEN = 8;
const CHARSET   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SCRAMBLE_SECS = 12;

const CITIES = [
  { id: 'local',    label: null,        tz: null                },
  { id: 'istanbul', label: 'ISTANBUL',  tz: 'Europe/Istanbul'   },
  { id: 'newyork',  label: 'NEWYORK',   tz: 'America/New_York'  },
  { id: 'tokyo',    label: 'TOKYO',     tz: 'Asia/Tokyo'        },
];

const sGet = (k, d) => { try { const v = sessionStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const sSet = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };
const getPos   = () => sGet('wc_pos',   { x:60, y:60 });
const getScale = () => sGet('wc_scale', 1.0);

const getTime = (tz) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour:'2-digit', minute:'2-digit', second:'2-digit',
    hour12: false, ...(tz ? { timeZone: tz } : {}),
  });
  const p = fmt.formatToParts(new Date());
  const v = t => p.find(x => x.type === t)?.value || '00';
  const h = v('hour') === '24' ? '00' : v('hour');
  return [h, v('minute'), v('second')];
};

const tzCity = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g,' ').toUpperCase();
const padLabel = (name) =>
  (name || '').toUpperCase().padEnd(LABEL_LEN,' ').substring(0, LABEL_LEN).split('');
const isScrambling = () => (Math.floor(Date.now() / 1000) % 600) < SCRAMBLE_SECS;
const randChar = () => CHARSET[Math.floor(Math.random() * CHARSET.length)];

let _fetching = false;
const fetchCity = async () => {
  const apis = [
    () => fetch('https://freeipapi.com/api/json',{signal:AbortSignal.timeout(5000)}).then(r=>r.json()).then(d=>d.cityName||null),
    () => fetch('https://ipinfo.io/json',{signal:AbortSignal.timeout(5000)}).then(r=>r.json()).then(d=>d.city||null),
    () => fetch('https://ip-api.com/json?fields=city',{signal:AbortSignal.timeout(5000)}).then(r=>r.json()).then(d=>d.city||null),
  ];
  for (const api of apis) { try { const c = await api(); if (c) return c.toUpperCase(); } catch {} }
  return tzCity();
};
const initCity = () => {
  if (_fetching) return;
  const cached = sGet('wc_city', null);
  const ts = sGet('wc_city_t', 0);
  if (cached && (Date.now() - ts) < 3_600_000) return;
  _fetching = true;
  fetchCity().then(c => { sSet('wc_city', c); sSet('wc_city_t', Date.now()); _fetching = false; }).catch(() => { _fetching = false; });
};
const localCity = () => { initCity(); return sGet('wc_city', null) || tzCity(); };

const prev = {};
const FlipCard = ({ id, char, w, h, fs, dim }) => {
  const old = prev[id] || char; prev[id] = char;
  const topBg = dim ? 'linear-gradient(180deg,#2e2e2e,#272727)' : 'linear-gradient(180deg,#3c3c3c,#303030)';
  const botBg = dim ? 'linear-gradient(180deg,#262626,#1f1f1f)' : 'linear-gradient(180deg,#2a2a2a,#222)';
  const clr = dim ? '#aaa' : '#fff';
  const clrBot = dim ? '#777' : '#bbb';
  const half = { position:'absolute', left:0, width:'100%', overflow:'hidden' };
  const Char = ({ color, ch }) => (
    <div style={{ position:'absolute', top:0, left:0, width:w, height:h, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
      <span style={{ fontSize:fs, fontFamily:FONT, fontWeight:200, lineHeight:1, color, letterSpacing:1, userSelect:'none' }}>{ch}</span>
    </div>
  );
  return (
    <div style={{ position:'relative', width:w, height:h, flexShrink:0, borderRadius:4, boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.6)' }}>
      <div style={{ ...half, top:0, height:h/2, background:topBg, borderRadius:'4px 4px 0 0' }}><Char color={clr} ch={char} /></div>
      <div style={{ ...half, bottom:0, height:h/2, background:botBg, borderRadius:'0 0 4px 4px' }}>
        <div style={{ position:'absolute', top:-(h/2), left:0, width:'100%', height:h, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:fs, fontFamily:FONT, fontWeight:200, lineHeight:1, color:clrBot, letterSpacing:1, userSelect:'none' }}>{char}</span>
        </div>
      </div>
      <div style={{ position:'absolute', top:h/2-1, left:0, width:'100%', height:2, background:'#080808', zIndex:10 }} />
      <div key={`${id}:${char}`} style={{ ...half, top:0, height:h/2, background:topBg, borderRadius:'4px 4px 0 0', transformOrigin:'50% 100%', zIndex:5, animation:'flapOut 0.3s cubic-bezier(0.55,0,1,1) forwards', boxShadow:'0 4px 12px rgba(0,0,0,0.7)' }}>
        <Char color={clr} ch={old} />
      </div>
    </div>
  );
};

const TimeRow = ({ cityId, label, tz, scramble }) => {
  const [hr, mn, sc] = getTime(tz);
  const timeChars = [...hr, ...mn, ...sc];
  const timeIds = ['h0','h1','m0','m1','s0','s1'].map(d => `${cityId}-${d}`);
  const rawName = label ?? localCity();
  const nameChars = padLabel(rawName);
  const nameIds = nameChars.map((_,i) => `${cityId}-l${i}`);
  const displayName = nameChars.map(c => (scramble && c !== ' ') ? randChar() : c);
  const Dots = () => (
    <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', gap:H*0.14, height:H, width:14, flexShrink:0 }}>
      {[0,1].map(i => <div key={i} style={{ width:4, height:4, borderRadius:'50%', background:'#555' }} />)}
    </div>
  );
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3 }}>
      {nameChars.map((_, i) => (<FlipCard key={nameIds[i]} id={nameIds[i]} char={displayName[i]} w={LW} h={LH} fs={LFS} dim={true} />))}
      <div style={{ width:10, flexShrink:0 }} />
      <FlipCard id={timeIds[0]} char={timeChars[0]} w={W} h={H} fs={FS} dim={true} />
      <FlipCard id={timeIds[1]} char={timeChars[1]} w={W} h={H} fs={FS} dim={true} />
      <Dots />
      <FlipCard id={timeIds[2]} char={timeChars[2]} w={W} h={H} fs={FS} dim={true} />
      <FlipCard id={timeIds[3]} char={timeChars[3]} w={W} h={H} fs={FS} dim={true} />
      <Dots />
      <FlipCard id={timeIds[4]} char={timeChars[4]} w={W} h={H} fs={FS} dim={true} />
      <FlipCard id={timeIds[5]} char={timeChars[5]} w={W} h={H} fs={FS} dim={true} />
    </div>
  );
};

let _ox=0,_oy=0,_ss=0,_sx=0;
const onDrag = e => {
  if (e.target.closest('[data-nodrag]')) return;
  const p = getPos(); _ox = e.clientX-p.x; _oy = e.clientY-p.y;
  const mv = e => { const n={x:e.clientX-_ox,y:e.clientY-_oy}; sSet('wc_pos',n); const el=document.getElementById('wcr'); if(el){el.style.left=n.x+'px';el.style.top=n.y+'px';} };
  const up = () => { window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); };
  window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
};
const onResize = e => {
  e.stopPropagation(); _ss=getScale(); _sx=e.clientX;
  const mv = e => { const ns=Math.max(0.5,Math.min(2.5,_ss+(e.clientX-_sx)/300)); sSet('wc_scale',ns); const el=document.getElementById('wcr'); if(el) el.style.transform=`scale(${ns})`; };
  const up = () => { window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); };
  window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
};
const onClose = e => {
  e.stopPropagation();
  const el = document.getElementById('wcr'); if(el) el.style.display='none';
  window.run && window.run('touch ~/.worldclock_hidden', ()=>{});
};

export const render = ({ output }) => {
  if (!output) return <div />;
  if (output.startsWith('HIDDEN')) return <div />;
  const pos = getPos(); const scale = getScale(); const scramble = isScrambling();
  return (
    <div style={{ pointerEvents:'all' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@200;300&display=swap');
        @keyframes flapOut { 0% { transform:rotateX(0deg); } 100% { transform:rotateX(-90deg); } }
      `}</style>
      <div id="wcr" onMouseDown={onDrag} style={{ position:'fixed', left:pos.x, top:pos.y, transformOrigin:'top left', transform:`scale(${scale})`, cursor:'grab', userSelect:'none', background:'rgba(22,22,24,0.93)', borderRadius:20, boxShadow:'0 20px 60px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(255,255,255,0.08)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 14px 7px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontFamily:FONT, fontSize:11, fontWeight:300, color:'rgba(255,255,255,0.35)', letterSpacing:3, userSelect:'none' }}>WORLD CLOCK</span>
          <div data-nodrag="1" onMouseDown={onClose} style={{ width:14, height:14, borderRadius:'50%', background:'rgba(255,69,58,0.7)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.8)', lineHeight:1, userSelect:'none', fontFamily:'system-ui' }}>x</span>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:5, padding:'10px 14px 14px' }}>
          {CITIES.map(c => (<TimeRow key={c.id} cityId={c.id} label={c.label} tz={c.tz} scramble={scramble} />))}
        </div>
        <div data-nodrag="1" onMouseDown={onResize} style={{ position:'absolute', bottom:4, right:6, cursor:'nwse-resize', padding:4 }}>
          <svg width="9" height="9" viewBox="0 0 9 9"><path d="M8 1L1 8M8 4.5L4.5 8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
      </div>
    </div>
  );
};
