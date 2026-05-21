import React, { useReducer, useState, useMemo, useCallback, useEffect } from 'react';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
.btn{cursor:pointer;border:none;transition:all 0.12s;font-family:'Barlow Condensed',sans-serif}
.btn:active{transform:scale(0.96)}
.zone-g{cursor:pointer}
.zone-g:hover rect{filter:brightness(1.15)}
.tab{cursor:pointer;padding:10px 13px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:12px;letter-spacing:0.15em;background:none;border:none;border-bottom:2px solid transparent;color:rgba(255,255,255,0.4);transition:all 0.15s;white-space:nowrap}
.tab:hover{color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.03)}
.tab.on{color:white;border-bottom-color:#FF3DBD}
.inp{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;color:white;font-family:'Barlow',sans-serif;font-size:13px;width:100%;outline:none}
.inp:focus{border-color:rgba(255,255,255,0.4)}
.sel{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;color:white;font-family:'Barlow',sans-serif;font-size:13px;width:100%;outline:none;cursor:pointer}
.sel option{background:#1a2035;color:white}
.sc::-webkit-scrollbar{width:4px}
.sc::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:4px}
.pill{background:linear-gradient(90deg,#FF3DBD,#9B2BFB);box-shadow:0 0 20px rgba(255,61,189,0.3)}
@keyframes pop{0%{transform:scale(0.85);opacity:0}100%{transform:scale(1);opacity:1}}
.pop{animation:pop 0.18s ease-out}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.pulse{animation:pulse 1.5s ease-in-out infinite}
.wave-btn{cursor:pointer;border:none;border-radius:8px;padding:6px 12px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:11px;letter-spacing:0.08em;color:white;transition:all 0.12s;white-space:nowrap}
.wave-btn:active{transform:scale(0.96)}
.endbtn{cursor:pointer;border:none;border-radius:8px;padding:6px 16px;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:13px;letter-spacing:0.1em;color:white;background:rgba(220,38,38,0.2);border:1px solid rgba(220,38,38,0.4);transition:all 0.15s}
.endbtn:hover{background:rgba(220,38,38,0.4)}
.endbtn:active{transform:scale(0.96)}
@media(max-width:768px){.r2{grid-template-columns:1fr!important}
  .tab{padding:10px 10px;font-size:11px;letter-spacing:0.1em}
  .wave-btn{padding:5px 10px;font-size:10px}
  .endbtn{padding:5px 10px;font-size:11px}
}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:900;display:flex;align-items:flex-end}
.sheet{background:#131d35;border-top-left-radius:20px;border-top-right-radius:20px;padding:20px;width:100%;max-height:85vh;overflow-y:auto;border:1px solid rgba(255,255,255,0.1)}
`;


// ── Mobile detection ───────────────────────────────────────────
function useIsMobile(bp=768) {
  const [m, setM] = useState(typeof window!=='undefined'?window.innerWidth<bp:false);
  useEffect(()=>{const h=()=>setM(window.innerWidth<bp);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h);},[bp]);
  return m;
}
// ── Projection ─────────────────────────────────────────────────
const P = (fx, fy) => ({ x: Math.round(148 + fx * 30 + fy * 32), y: Math.round(175 + fy * 18 - fx * 5) });

// ── Zones ──────────────────────────────────────────────────────
const ZONES = [
  { id:'BREAK',  lbl:'Breakthrough', fx:0,    fy:3   },
  { id:'WING_L', lbl:'Left Wing',    fx:-5.5, fy:4   },
  { id:'WING_R', lbl:'Right Wing',   fx:5.5,  fy:4   },
  { id:'PIV_L',  lbl:'Pivot Left',   fx:-2,   fy:5.5 },
  { id:'PIV_C',  lbl:'Pivot',        fx:0.5,  fy:5.5 },
  { id:'PIV_R',  lbl:'Pivot Right',  fx:3,    fy:5.5 },
  { id:'SEVEN',  lbl:'7-Meter',      fx:0,    fy:7   },
  { id:'BACK_L', lbl:'Left Back',    fx:-3.5, fy:8.5 },
  { id:'BACK_C', lbl:'Center Back',  fx:1,    fy:9   },
  { id:'BACK_R', lbl:'Right Back',   fx:5,    fy:8   },
].map(z => ({ ...z, ...P(z.fx, z.fy) }));

// ── Arcs & court path ──────────────────────────────────────────
const arc = (r,a0,a1,n=14) =>
  Array.from({length:n+1},(_,i)=>{const t=((a0+(a1-a0)*i/n)*Math.PI)/180;return P(r*Math.sin(t),r*Math.cos(t));})
    .map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');

const COURT_PATH = (()=>{
  const pts=Array.from({length:15},(_,i)=>{const t=((-65+148*i/14)*Math.PI)/180;return P(9.5*Math.sin(t),9.5*Math.cos(t));});
  const lp=P(-7,0),rp=P(7,0),gL=P(-1.5,0),gR=P(1.5,0);
  return[`M${gL.x} ${gL.y}`,`L${lp.x} ${lp.y}`,...pts.map(p=>`L${p.x} ${p.y}`),`L${rp.x} ${rp.y}`,`L${gR.x} ${gR.y}`,'Z'].join(' ');
})();

// ── Waves ──────────────────────────────────────────────────────
const WAVES = [
  { id:'ALL', label:'ALL',      color:'rgba(255,255,255,0.2)' },
  { id:'1',   label:'1ST WAVE',color:'#059669' },
  { id:'2',   label:'2ND WAVE',color:'#D97706' },
  { id:'3',   label:'3RD WAVE',color:'#7C3AED' },
];

// ── Team Database (default) ────────────────────────────────────
const mkId = () => Math.random().toString(36).slice(2,7);

const DEFAULT_DB = [
  { id:'kdh', name:'KEDAH',       color:'#CC0001', players:[] },
  { id:'png', name:'PENANG',      color:'#0057A8', players:[] },
  { id:'prk', name:'PERAK',       color:'#F5D000', players:[] },
  { id:'jhr', name:'JOHOR',       color:'#E32726', players:[] },
  { id:'kl',  name:'KL',          color:'#1A1A2E', players:[] },
  { id:'ned', name:'Netherlands', color:'#E86500', players:[
    {id:'a1',no:1,name:'Ten Holte (GK)'},{id:'a2',no:7,name:'Dulfer'},
    {id:'a3',no:9,name:'Nüsser'},{id:'a4',no:19,name:'Freriks'},
    {id:'a5',no:26,name:'Malestein'},{id:'a6',no:48,name:'Housheer'},
    {id:'a7',no:79,name:'Polman'},
  ]},
  { id:'nor', name:'Norway',      color:'#C0392B', players:[
    {id:'b1',no:9,name:'Mørk'},{id:'b2',no:15,name:'Ingstad'},
    {id:'b3',no:16,name:'Lunde (GK)'},{id:'b4',no:25,name:'Reistad'},
    {id:'b5',no:26,name:'Hovden'},{id:'b6',no:33,name:'Deila'},
  ]},
];

// ── Reducers ───────────────────────────────────────────────────
function evReducer(ev, a) {
  if (a.type==='ADD')   return [...ev, {...a.ev, id:Date.now()+Math.random(), ts:new Date().toLocaleTimeString()}];
  if (a.type==='UNDO')  return ev.slice(0,-1);
  if (a.type==='CLEAR') return [];
  return ev;
}

// ── Selectors ──────────────────────────────────────────────────
const pct = (g,a) => a ? `${Math.round(g/a*100)}%` : '0%';

function useZoneStats(events, tid, wave) {
  return useMemo(() => {
    const f = events.filter(e=>e.team===tid&&(wave==='ALL'||e.wave===wave));
    return ZONES.reduce((m,z)=>{
      const zs=f.filter(s=>s.zone===z.id);
      m[z.id]={g:zs.filter(x=>x.outcome==='GOAL').length, a:zs.length};
      return m;
    },{});
  },[events,tid,wave]);
}

function useGlobalStats(events, tid, opp, wave) {
  return useMemo(()=>{
    const f = (wave==='ALL') ? events : events.filter(e=>e.wave===wave);
    const sh = f.filter(e=>e.team===tid&&e.zone);
    const g  = sh.filter(s=>s.outcome==='GOAL').length;
    const faced = f.filter(e=>e.team===opp&&e.zone);
    const bz = (...zs)=>{const z=sh.filter(s=>zs.includes(s.zone));return{g:z.filter(x=>x.outcome==='GOAL').length,a:z.length};};
    const to = events.filter(e=>e.team===tid&&e.type==='TO'&&(wave==='ALL'||e.wave===wave)).length;
    return {
      goals:g, total:sh.length, pctShoot:pct(g,sh.length),
      fast:bz('BREAK'), sevenM:bz('SEVEN'), long:bz('BACK_L','BACK_C','BACK_R'),
      breakthrough:bz('BREAK','PIV_L','PIV_C','PIV_R'),
      clear:bz('WING_L','WING_R','PIV_L','PIV_C','PIV_R'),
      saves:{g:faced.filter(s=>s.outcome==='SAVE').length, a:faced.length},
      to, attackEff:{g, a:sh.length+to},
    };
  },[events,tid,opp,wave]);
}

function useTopScorers(events, tid, players) {
  return useMemo(()=>{
    const c=events.filter(e=>e.team===tid&&e.outcome==='GOAL'&&e.pid)
      .reduce((m,e)=>{m[e.pid]=(m[e.pid]||0)+1;return m;},{});
    return Object.entries(c).map(([pid,n])=>({p:players.find(x=>x.id===pid),n}))
      .filter(x=>x.p).sort((a,b)=>b.n-a.n).slice(0,5);
  },[events,tid,players]);
}

// ── Badge ──────────────────────────────────────────────────────
const Badge = ({team,size=28}) => (
  <div style={{width:size,height:size,borderRadius:'50%',background:team.color,flexShrink:0,
    display:'flex',alignItems:'center',justifyContent:'center',
    fontFamily:'Barlow Condensed',fontWeight:900,fontSize:Math.round(size*.38),
    color:team.color==='#F5D000'?'#000':'white',
    border:'2px solid rgba(255,255,255,0.2)',boxShadow:`0 0 10px ${team.color}50`}}>
    {team.name.slice(0,2).toUpperCase()}
  </div>
);

// ── End Match confirmation ─────────────────────────────────────
function EndMatchModal({teamA, teamB, scoreA, scoreB, onConfirm, onCancel}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',
      alignItems:'center',justifyContent:'center',zIndex:999}}>
      <div className="pop" style={{background:'#131d35',border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:16,padding:28,minWidth:300,textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:22,color:'white',marginBottom:6}}>
          END MATCH?
        </div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:32,color:'white',
          letterSpacing:4,margin:'12px 0'}}>
          <span style={{color:teamA.color}}>{teamA.name}</span>
          <span style={{color:'rgba(255,255,255,0.4)',margin:'0 10px'}}>{scoreA}–{scoreB}</span>
          <span style={{color:teamB.color}}>{teamB.name}</span>
        </div>
        <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:20}}>
          Match akan disimpan ke History
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn" onClick={onCancel}
            style={{flex:1,padding:'10px',borderRadius:10,background:'rgba(255,255,255,0.07)',
              border:'1px solid rgba(255,255,255,0.1)',fontWeight:700,fontSize:14,color:'rgba(255,255,255,0.6)'}}>
            CANCEL
          </button>
          <button className="btn" onClick={onConfirm}
            style={{flex:1,padding:'10px',borderRadius:10,background:'#DC2626',
              border:'none',fontWeight:900,fontSize:14,color:'white',boxShadow:'0 4px 16px rgba(220,38,38,0.4)'}}>
            END MATCH
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Court SVG ──────────────────────────────────────────────────
function CourtSVG({events, teamA, teamB, activeTeam, onZoneClick, selZone, wave, mobile}) {
  const team = activeTeam==='A' ? teamA : teamB;
  const zs = useZoneStats(events, activeTeam, wave);
  const shots = events.filter(e=>e.team===activeTeam&&e.zone&&(wave==='ALL'||e.wave===wave));
  return (
    <svg viewBox="0 0 680 370" style={{width:'100%',display:'block',borderRadius:12}}>
      <rect width="680" height="370" fill="#0D1528" rx="10"/>
      <path d={COURT_PATH} fill="rgba(230,240,235,0.09)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <path d={arc(6,-65,82)} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
      <path d={arc(9,-62,80)} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeDasharray="7 5"/>
      {(()=>{const sp=P(0,7);return<><line x1={sp.x-6} y1={sp.y} x2={sp.x+6} y2={sp.y} stroke="rgba(255,255,255,0.6)" strokeWidth="1.8"/><line x1={sp.x} y1={sp.y-4} x2={sp.x} y2={sp.y+4} stroke="rgba(255,255,255,0.6)" strokeWidth="1.8"/></>;})()}
      {(()=>{const gL=P(-1.5,0),gR=P(1.5,0),dL=P(-1.5,-0.6),dR=P(1.5,-0.6);return<>
        <polygon points={`${dL.x},${dL.y} ${dR.x},${dR.y} ${gR.x},${gR.y} ${gL.x},${gL.y}`} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
        <line x1={gL.x} y1={gL.y} x2={dL.x} y2={dL.y} stroke="#E53E3E" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1={gR.x} y1={gR.y} x2={dR.x} y2={dR.y} stroke="#E53E3E" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1={gL.x} y1={gL.y} x2={gR.x} y2={gR.y} stroke="#E53E3E" strokeWidth="3.5"/>
        <line x1={dL.x} y1={dL.y} x2={dR.x} y2={dR.y} stroke="#E53E3E" strokeWidth="2"/>
      </>;})()}
      {shots.slice(-50).map((e,i)=>{const z=ZONES.find(z=>z.id===e.zone);if(!z)return null;
        const jx=Math.sin(i*2.3+1)*11,jy=Math.cos(i*1.9+2)*9;
        const col=e.outcome==='GOAL'?'#34D399':e.outcome==='SAVE'?'#F87171':'#6B7280';
        return<circle key={e.id} cx={z.x+jx} cy={z.y+jy} r="4" fill={col} stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" opacity="0.8"/>;
      })}
      {ZONES.map(z=>{const s=zs[z.id]||{g:0,a:0};const sel=selZone?.id===z.id;const has=s.a>0;
        return<g key={z.id} className="zone-g" onClick={()=>onZoneClick(z)}>
          <circle cx={z.x} cy={z.y} r={mobile?28:22} fill="transparent"/>
          <rect x={z.x-22} y={z.y-11} width={44} height={22} rx={11}
            fill={sel?team.color:has?'white':'rgba(255,255,255,0.85)'}
            stroke={sel?'white':has?team.color:'rgba(255,255,255,0.3)'}
            strokeWidth={sel?2:has?1.5:0.5} opacity={sel?1:0.92}/>
          <text x={z.x} y={z.y+5} textAnchor="middle" fill={sel?'white':'#0A1020'}
            fontSize="11" fontWeight="800" fontFamily="Barlow Condensed,sans-serif"
            style={{pointerEvents:'none'}}>{s.a>0?`${s.g}/${s.a}`:'–'}</text>
        </g>;
      })}
      <rect x="10" y="358" width="660" height="8" rx="4" fill={team.color} opacity="0.4"/>
      {[['#34D399','Goal'],['#F87171','Save'],['#6B7280','Miss']].map(([c,l],i)=>
        <g key={l} transform={`translate(560,${16+i*14})`}>
          <circle cx="8" cy="5" r="4" fill={c} opacity="0.85"/>
          <text x="16" y="9" fontSize="10" fill="rgba(255,255,255,0.5)" fontFamily="Barlow,sans-serif" style={{pointerEvents:'none'}}>{l}</text>
        </g>
      )}
    </svg>
  );
}

// ── Shot panel ─────────────────────────────────────────────────
function ShotPanel({zone, team, side, wave, onRecord, onCancel}) {
  const [pid,setPid] = useState(null);
  const OPTS = [{id:'GOAL',label:'GOAL',color:'#059669',icon:'⚽'},{id:'SAVE',label:'SAVE',color:'#DC2626',icon:'🧤'},{id:'MISS',label:'MISS',color:'#374151',icon:'✗'}];
  return<div className="pop" style={{display:'flex',flexDirection:'column',gap:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
      <div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:20,color:'white',lineHeight:1}}>{zone.lbl.toUpperCase()}</div>
        <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:3}}>
          {team.name} — {WAVES.find(w=>w.id===wave)?.label||'ALL'}
        </div>
      </div>
      <button className="btn" onClick={onCancel} style={{background:'rgba(255,255,255,0.07)',borderRadius:7,color:'rgba(255,255,255,0.5)',padding:'4px 10px',fontSize:14}}>✕</button>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
      {OPTS.map(o=><button key={o.id} className="btn" onClick={()=>onRecord(zone.id,o.id,pid,side)}
        style={{background:o.color,borderRadius:12,padding:'16px 8px',display:'flex',flexDirection:'column',alignItems:'center',gap:5,boxShadow:`0 4px 16px ${o.color}55`}}>
        <span style={{fontSize:24}}>{o.icon}</span>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,color:'white',letterSpacing:'0.08em'}}>{o.label}</span>
      </button>)}
    </div>
    {team.players.length > 0 && <>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:10,color:'rgba(255,255,255,0.35)',letterSpacing:'0.2em',marginBottom:4}}>PLAYER (OPTIONAL)</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
        {team.players.map(p=><button key={p.id} className="btn" onClick={()=>setPid(pid===p.id?null:p.id)}
          style={{background:pid===p.id?team.color:'rgba(255,255,255,0.06)',
            border:`1px solid ${pid===p.id?team.color:'rgba(255,255,255,0.08)'}`,
            borderRadius:8,padding:'7px 3px',display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:'white',lineHeight:1}}>{p.no}</span>
          <span style={{fontFamily:'Barlow',fontSize:7,color:'rgba(255,255,255,0.5)',textAlign:'center',lineHeight:1.1}}>{p.name.split(' ')[0]}</span>
        </button>)}
      </div>
    </>}
  </div>;
}

// ── Sidebar summary ────────────────────────────────────────────
function SidebarSummary({stats, wave}) {
  const row=(label,s)=>{const p=s.a?Math.round(s.g/s.a*100):0;return<div key={label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
    <span style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.65)'}}>{label}</span>
    <div style={{display:'flex',alignItems:'center',gap:7}}>
      <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:'white'}}>{s.g}/{s.a}</span>
      <div style={{background:'rgba(255,255,255,0.07)',borderRadius:5,padding:'2px 7px',minWidth:40,textAlign:'center'}}>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,color:p>=50?'#34D399':'rgba(255,255,255,0.5)'}}>{p}%</span>
      </div>
    </div>
  </div>;};
  return<div>
    {row('Fastbreaks',stats.fast)}
    {row('7-M Throw',stats.sevenM)}
    {row('Long Distance',stats.long)}
    {row('Clear Shots',stats.clear)}
    {row('GK Saves vs',stats.saves)}
    <div style={{marginTop:10,padding:'10px',background:'rgba(255,255,255,0.02)',borderRadius:10,border:'1px solid rgba(255,255,255,0.06)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
        <span style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.45)'}}>Shooting Efficiency</span>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,color:'white'}}>{stats.goals}/{stats.total} ({stats.pctShoot})</span>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.45)'}}>Attack Efficiency</span>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,color:'white'}}>{stats.attackEff.g}/{stats.attackEff.a} ({pct(stats.attackEff.g,stats.attackEff.a)})</span>
      </div>
      <div style={{fontFamily:'Barlow',fontSize:9,color:'rgba(255,255,255,0.25)',marginTop:5,lineHeight:1.5}}>
        Shooting = Goals÷Shots · Attack = Goals÷(Shots+TO)
      </div>
    </div>
  </div>;
}

// ── Statistics tab ─────────────────────────────────────────────
function StatisticsTab({events,teamA,teamB,mobile}) {
  const Na=useGlobalStats(events,'A','B','ALL');
  const Nb=useGlobalStats(events,'B','A','ALL');
  const sA=useTopScorers(events,'A',teamA.players);
  const sB=useTopScorers(events,'B',teamB.players);

  const card=(title,children)=>
    <div style={{background:'rgba(255,255,255,0.02)',borderRadius:12,padding:'14px 16px',
      marginBottom:12,border:'1px solid rgba(255,255,255,0.06)'}}>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,
        color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:10}}>{title}</div>
      {children}
    </div>;

  const row=(label,a,b)=>
    <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',
      gap:8,padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:'white',textAlign:'right'}}>{a}</div>
      <div style={{fontFamily:'Barlow',fontSize:10,color:'rgba(255,255,255,0.28)',textAlign:'center',minWidth:100}}>{label}</div>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:'white'}}>{b}</div>
    </div>;

  // Attack chart summary per team (like the broadcast image)
  const attackCard = (team, stats, side) => {
    const rows = [
      ['Fastbreaks',   stats.fast],
      ['7-M Throw',    stats.sevenM],
      ['Fast',         stats.breakthrough],
      ['Long Distance',stats.long],
    ];
    return<div style={{background:'rgba(255,255,255,0.02)',borderRadius:12,padding:'14px',
      border:`1px solid ${team.color}30`,flex:1}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <Badge team={team} size={24}/>
        <div>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:15,color:team.color}}>
            {team.name.toUpperCase()}
          </div>
          <div className="pill" style={{display:'inline-block',borderRadius:4,padding:'1px 8px',
            fontFamily:'Barlow Condensed',fontWeight:800,fontSize:9,color:'white',letterSpacing:'0.15em',marginTop:2}}>
            ATTACK CHART
          </div>
        </div>
      </div>
      {rows.map(([label,s])=>{
        const p=s.a?Math.round(s.g/s.a*100):0;
        return<div key={label} style={{display:'flex',alignItems:'center',
          justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
          <span style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.6)'}}>{label}</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:'white',
              background:'rgba(255,255,255,0.06)',borderRadius:6,padding:'2px 8px',minWidth:40,textAlign:'center'}}>
              {s.g}/{s.a}
            </span>
            <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,minWidth:36,
              color:p>=50?'#34D399':'rgba(255,255,255,0.4)'}}>
              {p}%
            </span>
          </div>
        </div>;
      })}
    </div>;
  };

  const f=s=>`${s.g}/${s.a} (${pct(s.g,s.a)})`;

  return<div className="sc" style={{overflowY:'auto',padding:'16px',maxWidth:720,margin:'0 auto'}}>
    {/* ATTACK CHART SUMMARY — TOP, per team */}
    <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.3)',
      letterSpacing:'0.2em',marginBottom:10}}>ATTACK CHART SUMMARY</div>
    <div style={{display:'flex',flexDirection:mobile?'column':'row',gap:12,marginBottom:16}}>
      {attackCard(teamA, Na, 'A')}
      {attackCard(teamB, Nb, 'B')}
    </div>

    {/* Headers */}
    <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:mobile?4:8,marginBottom:8}}>
      <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:teamA.color}}>{teamA.name.toUpperCase()}</span>
        <Badge team={teamA} size={24}/>
      </div>
      <div style={{fontFamily:'Barlow',fontSize:10,color:'rgba(255,255,255,0.2)',textAlign:'center',letterSpacing:'0.15em'}}>VS</div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <Badge team={teamB} size={24}/>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:teamB.color}}>{teamB.name.toUpperCase()}</span>
      </div>
    </div>

    {card('SHOOTING STATISTICS',<>
      {row('Shooting Efficiency',f(Na),f(Nb))}
      {row('Attack Efficiency',f(Na.attackEff),f(Nb.attackEff))}
      {row('7-Meter',`${Na.sevenM.g}/${Na.sevenM.a}`,`${Nb.sevenM.g}/${Nb.sevenM.a}`)}
      {row('Long Distance',`${Na.long.g}/${Na.long.a}`,`${Nb.long.g}/${Nb.long.a}`)}
      {row('Clear Shots',`${Na.clear.g}/${Na.clear.a}`,`${Nb.clear.g}/${Nb.clear.a}`)}
      {row('GK Saves',f(Na.saves),f(Nb.saves))}
      {row('Turnovers',Na.to,Nb.to)}
    </>)}

    {card('TOP SCORERS',
      <div className="r2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {[{sc:sA,t:teamA},{sc:sB,t:teamB}].map(({sc,t})=>
          <div key={t.id||t.name}>{sc.length===0
            ?<div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.2)'}}>No goals yet</div>
            :sc.map(s=><div key={s.p.id} style={{display:'flex',alignItems:'center',
              justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
              <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:14,color:t.color}}>#{s.p.no}</span>
              <span style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.6)',flex:1,marginLeft:6}}>{s.p.name}</span>
              <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:20,color:'white'}}>{s.n}</span>
            </div>)
          }</div>
        )}
      </div>
    )}

    {/* GK Saves per shooter */}
    {card('GOALKEEPER SAVES',
      <div className="r2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {[{att:teamB,def:teamA,attSide:'B'},{att:teamA,def:teamB,attSide:'A'}].map(({att,def,attSide})=>{
          // Shots faced by def GK = shots from att team
          const faced=events.filter(e=>e.team===attSide&&e.zone&&e.pid);
          if(faced.length===0) return<div key={def.id||def.name} style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.2)'}}>No shots recorded with player</div>;
          // Group by shooter pid
          const byPlayer=faced.reduce((m,e)=>{
            if(!m[e.pid]) m[e.pid]={saves:0,total:0};
            m[e.pid].total++;
            if(e.outcome==='SAVE') m[e.pid].saves++;
            return m;
          },{});
          const rows=Object.entries(byPlayer)
            .map(([pid,s])=>({p:att.players.find(x=>x.id===pid),s}))
            .filter(x=>x.p).sort((a,b)=>b.s.total-a.s.total);
          return<div key={def.id||def.name}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
              <Badge team={def} size={18}/>
              <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,color:def.color}}>
                {def.name} GK</span>
            </div>
            {rows.length===0
              ?<div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.2)'}}>—</div>
              :rows.map(({p,s})=>{
                const pct=s.total?Math.round(s.saves/s.total*100):0;
                return<div key={p.id} style={{display:'flex',alignItems:'center',gap:8,
                  padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,
                    color:att.color,minWidth:32}}>#{p.no}</span>
                  <span style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.5)',flex:1,
                    overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{p.name}</span>
                  <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:'white',minWidth:36,textAlign:'right'}}>
                    {s.saves}/{s.total}</span>
                  <div style={{background:pct>=50?'rgba(248,113,113,0.15)':'rgba(255,255,255,0.05)',
                    borderRadius:5,padding:'2px 7px',minWidth:40,textAlign:'center'}}>
                    <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,
                      color:pct>=50?'#F87171':'rgba(255,255,255,0.4)'}}>{pct}%</span>
                  </div>
                </div>;
              })
            }
          </div>;
        })}
      </div>
    )}
  </div>;
}

// ── History tab ─────────────────────────────────────────────────
function HistoryTab({events, teamA, teamB, matchHistory, dispatch}) {
  const [expandId, setExpandId] = useState(null);
  const waveColor = w=>WAVES.find(x=>x.id===w)?.color||'rgba(255,255,255,0.1)';
  const waveLabel = w=>WAVES.find(x=>x.id===w)?.label||'';

  return<div className="sc" style={{overflowY:'auto',padding:'16px',maxWidth:720,margin:'0 auto'}}>
    {/* Past matches */}
    {matchHistory.length>0&&<>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,
        color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:10}}>COMPLETED MATCHES</div>
      {matchHistory.map(m=><div key={m.id} style={{background:'rgba(255,255,255,0.03)',
        borderRadius:12,padding:'14px',marginBottom:10,border:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}
          onClick={()=>setExpandId(expandId===m.id?null:m.id)}>
          <div>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,color:'white'}}>
              <span style={{color:m.teamA.color}}>{m.teamA.name}</span>
              <span style={{color:'rgba(255,255,255,0.4)',margin:'0 10px'}}>{m.score.A}–{m.score.B}</span>
              <span style={{color:m.teamB.color}}>{m.teamB.name}</span>
            </div>
            <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:3}}>{m.date} · {m.events.length} events</div>
          </div>
          <div style={{fontFamily:'Barlow Condensed',fontSize:18,color:'rgba(255,255,255,0.3)'}}>{expandId===m.id?'▲':'▼'}</div>
        </div>
        {expandId===m.id&&<div style={{marginTop:12,borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:12}}>
          {[...m.events].reverse().slice(0,20).map((e,i)=>{
            const z=ZONES.find(z=>z.id===e.zone);
            const col=e.outcome==='GOAL'?'#34D399':e.outcome==='SAVE'?'#F87171':'#6B7280';
            const tColor=e.team==='A'?m.teamA.color:m.teamB.color;
            const tName=e.team==='A'?m.teamA.name:m.teamB.name;
            return<div key={e.id||i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',
              borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
              <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:10,color:'rgba(255,255,255,0.3)',minWidth:55}}>{e.ts}</span>
              <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,color:tColor}}>{tName}</span>
              <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,color:col}}>{e.type==='TO'?'TURNOVER':e.outcome}</span>
              {z&&<span style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)'}}>— {z.lbl}</span>}
              {e.wave&&e.wave!=='ALL'&&<span style={{fontFamily:'Barlow Condensed',fontSize:9,fontWeight:700,
                color:waveColor(e.wave),background:`${waveColor(e.wave)}20`,borderRadius:4,padding:'1px 5px'}}>{waveLabel(e.wave)}</span>}
            </div>;
          })}
        </div>}
      </div>)}
    </>}

    {/* Current match events */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,marginTop:matchHistory.length?16:0}}>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,
        color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em'}}>
        CURRENT MATCH ({events.length} events)
      </div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn" onClick={()=>dispatch({type:'UNDO'})}
          style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(220,38,38,0.2)',
            borderRadius:8,padding:'5px 10px',fontWeight:700,fontSize:11,color:'rgba(252,129,129,0.75)'}}>↶ UNDO</button>
        <button className="btn" onClick={()=>{if(window.confirm('Clear all current events?'))dispatch({type:'CLEAR'});}}
          style={{background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.15)',
            borderRadius:8,padding:'5px 10px',fontWeight:700,fontSize:11,color:'rgba(252,129,129,0.6)'}}>CLEAR</button>
      </div>
    </div>

    {events.length===0&&<div style={{textAlign:'center',padding:'30px 0',fontFamily:'Barlow',
      fontSize:13,color:'rgba(255,255,255,0.2)'}}>No events yet</div>}
    {[...events].reverse().map((e,i)=>{
      const team=e.team==='A'?teamA:teamB;
      const player=e.pid?team.players.find(p=>p.id===e.pid):null;
      const z=ZONES.find(z=>z.id===e.zone);
      const col=e.outcome==='GOAL'?'#34D399':e.outcome==='SAVE'?'#F87171':'#6B7280';
      return<div key={e.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',
        marginBottom:4,background:'rgba(255,255,255,0.02)',borderRadius:10,
        border:'1px solid rgba(255,255,255,0.04)',
        borderLeft:`3px solid ${e.type==='TO'?'#D97706':col}`}}>
        <div style={{minWidth:44,textAlign:'center'}}>
          {player
            ?<><div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:20,color:team.color,lineHeight:1}}>#{player.no}</div>
              <div style={{fontFamily:'Barlow',fontSize:8,color:'rgba(255,255,255,0.3)',lineHeight:1.2,overflow:'hidden',whiteSpace:'nowrap'}}>{player.name.split(' ')[0]}</div></>
            :<div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:18,color:'rgba(255,255,255,0.15)'}}>—</div>
          }
        </div>
        <Badge team={team} size={20}/>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            {e.type==='TO'
              ?<span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:'#D97706'}}>TURNOVER</span>
              :<><span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:col}}>{e.outcome}</span>
                {z&&<span style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)'}}>— {z.lbl}</span>}</>
            }
            {e.wave&&e.wave!=='ALL'&&<span style={{fontFamily:'Barlow Condensed',fontSize:9,fontWeight:700,
              color:waveColor(e.wave),background:`${waveColor(e.wave)}20`,borderRadius:4,padding:'1px 5px'}}>
              {waveLabel(e.wave)}</span>}
          </div>
        </div>
      </div>;
    })}
  </div>;
}

// ── Team Database Editor ────────────────────────────────────────
function DatabaseTab({teamDB, setTeamDB, matchTeams, setMatchTeams}) {
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);

  const startEdit = (t) => { setEditId(t.id); setDraft(JSON.parse(JSON.stringify(t))); };
  const startNew  = () => { const t={id:mkId(),name:'',color:'#3B82F6',players:[]}; setEditId(t.id); setDraft(t); setTeamDB(d=>[...d,t]); };
  const saveEdit  = () => { setTeamDB(d=>d.map(t=>t.id===editId?draft:t)); setEditId(null); };
  const delTeam   = (id) => { if(!window.confirm('Delete team?'))return; setTeamDB(d=>d.filter(t=>t.id!==id)); };
  const upP=(pid,f,v)=>setDraft(d=>({...d,players:d.players.map(p=>p.id===pid?{...p,[f]:v}:p)}));
  const addP=()=>{if(draft.players.length>=16)return;setDraft(d=>({...d,players:[...d.players,{id:mkId(),no:'',name:''}]}));};
  const delP=(pid)=>setDraft(d=>({...d,players:d.players.filter(p=>p.id!==pid)}));

  return<div className="sc" style={{overflowY:'auto',padding:'16px',maxWidth:720,margin:'0 auto'}}>
    {/* Match setup — pick which teams play */}
    <div style={{background:'rgba(255,255,255,0.03)',borderRadius:12,padding:'16px',
      marginBottom:16,border:'1px solid rgba(255,255,255,0.07)'}}>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'rgba(255,255,255,0.3)',
        letterSpacing:'0.2em',marginBottom:12}}>MATCH SETUP — PILIH TEAM</div>
      <div className="r2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {['A','B'].map(side=><div key={side}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11,
            color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em',marginBottom:6}}>TEAM {side}</div>
          <select className="sel" value={matchTeams[side]}
            onChange={e=>setMatchTeams(m=>({...m,[side]:e.target.value}))}>
            {teamDB.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {(()=>{const t=teamDB.find(x=>x.id===matchTeams[side]);if(!t)return null;return<div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
            <Badge team={t} size={28}/>
            <div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:t.color}}>{t.name}</div>
              <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.35)'}}>{t.players.length} players</div>
            </div>
          </div>;})()}
        </div>)}
      </div>
    </div>

    {/* Team database list */}
    <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'rgba(255,255,255,0.3)',
      letterSpacing:'0.2em',marginBottom:10}}>TEAM DATABASE ({teamDB.length})</div>
    {teamDB.map(t=><div key={t.id} style={{background:'rgba(255,255,255,0.03)',borderRadius:12,
      marginBottom:8,border:`1px solid ${editId===t.id?t.color+'50':'rgba(255,255,255,0.06)'}`,overflow:'hidden'}}>
      {editId===t.id&&draft
        /* Edit view */
        ?<div style={{padding:'14px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,marginBottom:12}}>
            <div><div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:5}}>Team Name</div>
              <input className="inp" value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></div>
            <div><div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:5}}>Color</div>
              <input type="color" value={draft.color} onChange={e=>setDraft(d=>({...d,color:e.target.value}))}
                style={{width:52,height:36,borderRadius:8,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',cursor:'pointer',padding:2}}/></div>
          </div>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.3)',
            letterSpacing:'0.2em',marginBottom:8}}>PLAYERS ({draft.players.length}/16)</div>
          <div className="r2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
            {draft.players.map(p=><div key={p.id} style={{display:'flex',gap:5,alignItems:'center'}}>
              <input className="inp" value={p.no} type="number" onChange={e=>upP(p.id,'no',e.target.value)}
                placeholder="#" style={{width:44,textAlign:'center',padding:'7px 3px',flexShrink:0}}/>
              <input className="inp" value={p.name} onChange={e=>upP(p.id,'name',e.target.value)}
                placeholder="Name" style={{flex:1,fontSize:12}}/>
              <button className="btn" onClick={()=>delP(p.id)}
                style={{background:'rgba(220,38,38,0.12)',border:'none',borderRadius:6,
                  color:'#F87171',padding:'6px 8px',fontSize:12,flexShrink:0}}>×</button>
            </div>)}
          </div>
          {draft.players.length<16&&<button className="btn" onClick={addP}
            style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:8,padding:'7px 12px',fontWeight:700,fontSize:11,color:'rgba(255,255,255,0.6)',marginBottom:12}}>
            + ADD PLAYER</button>}
          <div style={{display:'flex',gap:8}}>
            <button className="btn" onClick={saveEdit}
              style={{flex:1,background:'#059669',borderRadius:10,padding:'9px',fontWeight:900,fontSize:14,color:'white'}}>SAVE</button>
            <button className="btn" onClick={()=>setEditId(null)}
              style={{flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:10,padding:'9px',fontWeight:700,fontSize:13,color:'rgba(255,255,255,0.5)'}}>CANCEL</button>
          </div>
        </div>
        /* List view */
        :<div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px'}}>
          <Badge team={t} size={32}/>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:15,color:'white'}}>{t.name}</div>
            <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.35)'}}>{t.players.length} players registered</div>
          </div>
          <button className="btn" onClick={()=>startEdit(t)}
            style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:8,padding:'6px 12px',fontWeight:700,fontSize:12,color:'rgba(255,255,255,0.6)'}}>EDIT</button>
          <button className="btn" onClick={()=>delTeam(t.id)}
            style={{background:'rgba(220,38,38,0.1)',border:'none',borderRadius:8,
              padding:'6px 10px',fontWeight:700,fontSize:12,color:'rgba(252,129,129,0.7)'}}>×</button>
        </div>
      }
    </div>)}
    <button className="btn" onClick={startNew}
      style={{width:'100%',padding:'12px',borderRadius:12,background:'rgba(255,255,255,0.05)',
        border:'1px dashed rgba(255,255,255,0.15)',fontWeight:800,fontSize:13,
        color:'rgba(255,255,255,0.5)',letterSpacing:'0.1em'}}>+ TAMBAH TEAM BARU</button>
  </div>;
}

// ── Root ───────────────────────────────────────────────────────
export default function HandballApp() {
  const [events, dispatch] = useReducer(evReducer, []);
  const [teamDB, setTeamDB] = useState(DEFAULT_DB);
  const [matchTeams, setMatchTeams] = useState({A:'ned', B:'nor'});
  const [matchHistory, setMatchHistory] = useState([]);
  const [activeTeam, setActiveTeam] = useState('A');
  const [selZone, setSelZone] = useState(null);
  const [tab, setTab] = useState('attack');
  const [wave, setWave] = useState('ALL');
  const [showEndModal, setShowEndModal] = useState(false);
  const mobile = useIsMobile();

  const teamA = teamDB.find(t=>t.id===matchTeams.A) || teamDB[0];
  const teamB = teamDB.find(t=>t.id===matchTeams.B) || teamDB[1];
  const curTeam = activeTeam==='A' ? teamA : teamB;

  const goalA = events.filter(e=>e.team==='A'&&e.outcome==='GOAL').length;
  const goalB = events.filter(e=>e.team==='B'&&e.outcome==='GOAL').length;
  const statsA = useGlobalStats(events,'A','B',wave);
  const statsB = useGlobalStats(events,'B','A',wave);

  const handleRecord = (zoneId, outcome, pid) => {
    dispatch({type:'ADD', ev:{team:activeTeam, zone:zoneId, outcome, pid, wave:wave==='ALL'?'3':wave}});
    setSelZone(null);
  };

  const confirmEnd = () => {
    setMatchHistory(h=>[{
      id:Date.now(), date:new Date().toLocaleString(),
      teamA:{...teamA}, teamB:{...teamB},
      score:{A:goalA, B:goalB}, events:[...events],
    },...h]);
    dispatch({type:'CLEAR'});
    setShowEndModal(false);
    setTab('history');
  };

  return<div style={{background:'#0A1020',minHeight:'100vh',display:'flex',flexDirection:'column',fontFamily:'Barlow,sans-serif'}}>
    <style>{CSS}</style>
    {showEndModal&&<EndMatchModal teamA={teamA} teamB={teamB} scoreA={goalA} scoreB={goalB}
      onConfirm={confirmEnd} onCancel={()=>setShowEndModal(false)}/>}

    {/* HEADER */}
    <div style={{background:'#0E1528',borderBottom:'1px solid rgba(255,255,255,0.07)',
      padding:mobile?'6px 10px':'8px 16px',display:'flex',alignItems:'center',gap:mobile?6:10}}>
      <div style={{flex:1,display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
        {!mobile&&<span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:17,color:'white'}}>{teamA.name.toUpperCase()}</span>}
        <Badge team={teamA} size={mobile?26:32}/>
      </div>
      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:mobile?'4px 12px':'5px 16px',textAlign:'center',minWidth:mobile?80:100}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?28:34,color:'white',lineHeight:1,letterSpacing:3}}>{goalA}–{goalB}</div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,marginTop:2}}>
          <div className="pulse" style={{width:6,height:6,borderRadius:'50%',background:'#FF3DBD'}}/>
          <span style={{fontFamily:'Barlow',fontSize:9,color:'rgba(255,255,255,0.35)',letterSpacing:'0.2em'}}>LIVE</span>
        </div>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',gap:6}}>
        <Badge team={teamB} size={mobile?26:32}/>
        {!mobile&&<span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:17,color:'white'}}>{teamB.name.toUpperCase()}</span>}
      </div>
      <button className="endbtn" onClick={()=>setShowEndModal(true)}>{mobile?'⏹':'⏹ END MATCH'}</button>
    </div>

    {/* TABS */}
    <div style={{background:'#0E1528',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',overflowX:'auto'}}>
      {[['attack','ATTACK CHART'],['stats','STATISTICS'],['history','HISTORY'],['db','TEAM DATABASE']]
        .map(([id,lbl])=><button key={id} className={`tab ${tab===id?'on':''}`} onClick={()=>setTab(id)}>{lbl}</button>)}
    </div>

    {/* ATTACK */}
    {tab==='attack'&&<div style={{flex:1,display:mobile?'flex':'grid',flexDirection:'column',gridTemplateColumns:mobile?'1fr':'1fr 300px',overflow:'hidden',minHeight:0}}>
      <div style={{padding:mobile?'10px':'12px',display:'flex',flexDirection:'column',gap:9,overflowY:'auto',flex:mobile?1:undefined}}>
        {/* Waves */}
        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          {WAVES.map(w=><button key={w.id} className="wave-btn" onClick={()=>{setWave(w.id);setSelZone(null);}}
            style={{background:wave===w.id?w.id==='ALL'?'rgba(255,255,255,0.2)':w.color:'rgba(255,255,255,0.06)',
              border:`1px solid ${wave===w.id?(w.id==='ALL'?'rgba(255,255,255,0.25)':w.color):'rgba(255,255,255,0.07)'}`,
              opacity:wave===w.id?1:0.6}}>
            {w.label}
          </button>)}
        </div>
        {/* Team toggle */}
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.15em'}}>RECORDING:</span>
          {['A','B'].map(side=>{const t=side==='A'?teamA:teamB;return<button key={side} className="btn"
            onClick={()=>{setActiveTeam(side);setSelZone(null);}}
            style={{background:activeTeam===side?t.color:'rgba(255,255,255,0.06)',
              border:`1px solid ${activeTeam===side?t.color:'rgba(255,255,255,0.08)'}`,
              borderRadius:8,padding:'5px 12px',display:'flex',alignItems:'center',gap:5}}>
            <Badge team={t} size={14}/>
            <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,color:'white'}}>{t.name.toUpperCase()}</span>
          </button>;})}
          <div style={{flex:1}}/>
          <button className="btn" onClick={()=>dispatch({type:'ADD',ev:{team:activeTeam,type:'TO',wave:wave==='ALL'?'3':wave}})}
            style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:8,padding:'5px 10px',fontWeight:700,fontSize:11,color:'rgba(255,255,255,0.55)'}}>+ TURNOVER</button>
          <button className="btn" onClick={()=>dispatch({type:'UNDO'})}
            style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(220,38,38,0.2)',
              borderRadius:8,padding:'5px 10px',fontWeight:700,fontSize:11,color:'rgba(252,129,129,0.7)'}}>↶ UNDO</button>
        </div>
        {/* Court */}
        <div style={{maxWidth:580,width:'100%',alignSelf:'center'}}>
          <CourtSVG events={events} teamA={teamA} teamB={teamB} activeTeam={activeTeam}
            onZoneClick={setSelZone} selZone={selZone} wave={wave} mobile={mobile}/>
        </div>
        {/* Label */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Badge team={curTeam} size={20}/>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:'white'}}>{curTeam.name.toUpperCase()}</span>
          <div className="pill" style={{borderRadius:5,padding:'2px 10px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'white',letterSpacing:'0.18em'}}>ATTACK CHART</div>
        </div>
      </div>
      {/* Right panel — desktop sidebar / mobile hidden unless zone selected */}
      {!mobile&&<div style={{background:'#0E1528',borderLeft:'1px solid rgba(255,255,255,0.07)',padding:'14px',overflowY:'auto'}}>
        {selZone
          ?<ShotPanel zone={selZone} team={curTeam} side={activeTeam} wave={wave}
            onRecord={handleRecord} onCancel={()=>setSelZone(null)}/>
          :<><div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,
              color:'rgba(255,255,255,0.28)',letterSpacing:'0.2em',marginBottom:12}}>
              {curTeam.name.toUpperCase()} SUMMARY{wave!=='ALL'?` — ${WAVES.find(w=>w.id===wave)?.label}`:''}
            </div>
            <SidebarSummary stats={activeTeam==='A'?statsA:statsB} wave={wave}/></>
        }
      </div>}
      {/* Mobile bottom sheet for shot entry */}
      {mobile&&selZone&&<div className="overlay" onClick={(e)=>{if(e.target===e.currentTarget)setSelZone(null);}}>
        <div className="sheet pop">
          <ShotPanel zone={selZone} team={curTeam} side={activeTeam} wave={wave}
            onRecord={handleRecord} onCancel={()=>setSelZone(null)}/>
        </div>
      </div>}
    </div>}

    {tab==='stats'   &&<StatisticsTab events={events} teamA={teamA} teamB={teamB} mobile={mobile}/>}
    {tab==='history' &&<HistoryTab events={events} teamA={teamA} teamB={teamB} matchHistory={matchHistory} dispatch={dispatch}/>}
    {tab==='db'      &&<DatabaseTab teamDB={teamDB} setTeamDB={setTeamDB} matchTeams={matchTeams} setMatchTeams={setMatchTeams}/>}
  </div>;
}
