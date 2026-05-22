import React, { useReducer, useState, useMemo, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
//  HANDBALL ANALYSIS SYSTEM v6 — Professional Edition
//  + Game clock & halves
//  + Fouls/cards (warning/2min/yellow/red)
//  + Defensive events (block/steal)
//  + Assists tracking
//  + Turnover types
//  + Player individual stats
//  + Match overview dashboard
// ═══════════════════════════════════════════════════════════════

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
.btn{cursor:pointer;border:none;transition:all 0.12s;font-family:'Barlow Condensed',sans-serif}
.btn:active{transform:scale(0.96)}
.zone-g{cursor:pointer}
.zone-g:hover rect{filter:brightness(1.15)}
.tab{cursor:pointer;padding:9px 11px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:11px;letter-spacing:0.13em;background:none;border:none;border-bottom:2px solid transparent;color:rgba(255,255,255,0.4);transition:all 0.15s;white-space:nowrap}
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
.wave-btn{cursor:pointer;border:none;border-radius:8px;padding:5px 11px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:10px;letter-spacing:0.08em;color:white;transition:all 0.12s;white-space:nowrap}
.wave-btn:active{transform:scale(0.96)}
.endbtn{cursor:pointer;border:none;border-radius:8px;padding:5px 14px;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:12px;letter-spacing:0.1em;color:white;background:rgba(220,38,38,0.2);border:1px solid rgba(220,38,38,0.4);transition:all 0.15s}
.endbtn:hover{background:rgba(220,38,38,0.4)}
.act-btn{cursor:pointer;border:none;border-radius:9px;padding:8px 10px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:11px;letter-spacing:0.05em;color:white;transition:all 0.12s;display:flex;flex-direction:column;align-items:center;gap:3px}
.act-btn:active{transform:scale(0.96)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:900;display:flex;align-items:flex-end;justify-content:center}
.sheet{background:#131d35;border-top-left-radius:20px;border-top-right-radius:20px;padding:20px;width:100%;max-height:85vh;overflow-y:auto;border:1px solid rgba(255,255,255,0.1)}
.modal{background:#131d35;border-radius:16px;padding:22px;max-width:480px;width:90vw;max-height:85vh;overflow-y:auto;border:1px solid rgba(255,255,255,0.12);box-shadow:0 20px 60px rgba(0,0,0,0.6)}
.tbl{width:100%;border-collapse:collapse;font-family:'Barlow',sans-serif}
.tbl th{padding:8px 6px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:10px;letter-spacing:0.1em;color:rgba(255,255,255,0.4);text-align:center;border-bottom:1px solid rgba(255,255,255,0.1)}
.tbl td{padding:7px 6px;font-size:13px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.04)}
@media(max-width:768px){
  .r2{grid-template-columns:1fr!important}
  .tab{padding:9px 8px;font-size:10px;letter-spacing:0.08em}
  .wave-btn{padding:4px 8px;font-size:9px}
  .endbtn{padding:4px 8px;font-size:10px}
  .tbl th,.tbl td{padding:5px 3px;font-size:11px}
}
.overlay-c{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px}
`;

// ═══ HOOKS ════════════════════════════════════════════════════
function useIsMobile(bp=768) {
  const [m, setM] = useState(typeof window!=='undefined'?window.innerWidth<bp:false);
  useEffect(()=>{const h=()=>setM(window.innerWidth<bp);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h);},[bp]);
  return m;
}

function useClock() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [half, setHalf] = useState(1);
  useEffect(()=>{
    if(!running) return;
    const id = setInterval(()=>setSeconds(s=>s+1), 1000);
    return ()=>clearInterval(id);
  },[running]);
  return { seconds, running, half, setHalf, setSeconds, setRunning };
}

const fmtClock = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
const halfLabel = h => h===1?'1ST HALF':h===2?'2ND HALF':`OT ${h-2}`;

// ═══ PROJECTION + ZONES ═══════════════════════════════════════
const P = (fx, fy) => ({ x: Math.round(148 + fx * 30 + fy * 32), y: Math.round(175 + fy * 18 - fx * 5) });

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

const arc = (r,a0,a1,n=14) =>
  Array.from({length:n+1},(_,i)=>{const t=((a0+(a1-a0)*i/n)*Math.PI)/180;return P(r*Math.sin(t),r*Math.cos(t));})
    .map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');

const COURT_PATH = (()=>{
  const pts=Array.from({length:15},(_,i)=>{const t=((-65+148*i/14)*Math.PI)/180;return P(9.5*Math.sin(t),9.5*Math.cos(t));});
  const lp=P(-7,0),rp=P(7,0),gL=P(-1.5,0),gR=P(1.5,0);
  return[`M${gL.x} ${gL.y}`,`L${lp.x} ${lp.y}`,...pts.map(p=>`L${p.x} ${p.y}`),`L${rp.x} ${rp.y}`,`L${gR.x} ${gR.y}`,'Z'].join(' ');
})();

// ═══ CONSTANTS ════════════════════════════════════════════════
const WAVES = [
  { id:'ALL', label:'ALL',      color:'rgba(255,255,255,0.2)' },
  { id:'1',   label:'1ST WAVE',color:'#059669' },
  { id:'2',   label:'2ND WAVE',color:'#D97706' },
  { id:'3',   label:'3RD WAVE',color:'#7C3AED' },
];

const FOUL_TYPES = [
  { id:'warning', label:'Warning',   short:'⚠', color:'#FBBF24' },
  { id:'2min',    label:'2-Minute',  short:'2′', color:'#DC2626' },
  { id:'yellow',  label:'Yellow',    short:'YC', color:'#EAB308' },
  { id:'red',     label:'Red',       short:'RC', color:'#991B1B' },
];

const TO_TYPES = [
  { id:'bad_pass',   label:'Bad Pass' },
  { id:'off_foul',   label:'Off. Foul' },
  { id:'traveling',  label:'Traveling' },
  { id:'double',     label:'Double Dribble' },
  { id:'technical',  label:'Technical' },
  { id:'other',      label:'Other' },
];

// ═══ DEFAULT DATABASE ═════════════════════════════════════════
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

// ═══ REDUCER ══════════════════════════════════════════════════
function evReducer(ev, a) {
  if (a.type==='ADD') {
    return [...ev, {
      ...a.ev,
      id: Date.now()+Math.random(),
      ts: new Date().toLocaleTimeString(),
    }];
  }
  if (a.type==='UNDO')  return ev.slice(0,-1);
  if (a.type==='CLEAR') return [];
  return ev;
}

// ═══ SELECTORS ════════════════════════════════════════════════
const pct = (g,a) => a ? `${Math.round(g/a*100)}%` : '0%';

function useZoneStats(events, tid, wave) {
  return useMemo(() => {
    const f = events.filter(e=>e.team===tid&&e.zone&&(wave==='ALL'||e.wave===wave));
    return ZONES.reduce((m,z)=>{
      const zs=f.filter(s=>s.zone===z.id);
      m[z.id]={g:zs.filter(x=>x.outcome==='GOAL').length, a:zs.length};
      return m;
    },{});
  },[events,tid,wave]);
}

function useGlobalStats(events, tid, opp, wave='ALL', half=null) {
  return useMemo(()=>{
    let f = events;
    if (wave!=='ALL') f = f.filter(e=>e.wave===wave);
    if (half!==null) f = f.filter(e=>e.half===half);
    const sh = f.filter(e=>e.team===tid&&e.zone);
    const g  = sh.filter(s=>s.outcome==='GOAL').length;
    const faced = f.filter(e=>e.team===opp&&e.zone);
    const bz = (...zs)=>{const z=sh.filter(s=>zs.includes(s.zone));return{g:z.filter(x=>x.outcome==='GOAL').length,a:z.length};};
    const to = f.filter(e=>e.team===tid&&e.kind==='TO').length;
    const fouls = f.filter(e=>e.team===tid&&e.kind==='FOUL');
    const cards = (sev)=>fouls.filter(x=>x.severity===sev).length;
    return {
      goals:g, total:sh.length, pctShoot:pct(g,sh.length),
      fast:bz('BREAK'), sevenM:bz('SEVEN'), long:bz('BACK_L','BACK_C','BACK_R'),
      breakthrough:bz('BREAK','PIV_L','PIV_C','PIV_R'),
      clear:bz('WING_L','WING_R','PIV_L','PIV_C','PIV_R'),
      saves:{g:faced.filter(s=>s.outcome==='SAVE').length, a:faced.length},
      to, attackEff:{g, a:sh.length+to},
      blocks: f.filter(e=>e.team===tid&&e.kind==='BLOCK').length,
      steals: f.filter(e=>e.team===tid&&e.kind==='STEAL').length,
      fouls: fouls.length,
      warnings: cards('warning'),
      twoMin: cards('2min'),
      yellow: cards('yellow'),
      red: cards('red'),
    };
  },[events,tid,opp,wave,half]);
}

function useTopScorers(events, tid, players) {
  return useMemo(()=>{
    const c=events.filter(e=>e.team===tid&&e.outcome==='GOAL'&&e.pid)
      .reduce((m,e)=>{m[e.pid]=(m[e.pid]||0)+1;return m;},{});
    return Object.entries(c).map(([pid,n])=>({p:players.find(x=>x.id===pid),n}))
      .filter(x=>x.p).sort((a,b)=>b.n-a.n).slice(0,5);
  },[events,tid,players]);
}

function usePlayerStats(events, tid, players) {
  return useMemo(()=>{
    return players.map(p=>{
      const myEv = events.filter(e=>e.team===tid&&e.pid===p.id);
      const shots = myEv.filter(e=>e.zone);
      const goals = shots.filter(s=>s.outcome==='GOAL').length;
      const assists = events.filter(e=>e.team===tid&&e.assistPid===p.id&&e.outcome==='GOAL').length;
      const fouls = myEv.filter(e=>e.kind==='FOUL');
      return {
        p,
        G: goals,
        A: assists,
        Sh: shots.length,
        Sv: shots.filter(s=>s.outcome==='SAVE').length,
        Ms: shots.filter(s=>s.outcome==='MISS').length,
        TO: myEv.filter(e=>e.kind==='TO').length,
        BL: myEv.filter(e=>e.kind==='BLOCK').length,
        ST: myEv.filter(e=>e.kind==='STEAL').length,
        F: fouls.length,
        twoMin: fouls.filter(x=>x.severity==='2min').length,
        Y: fouls.filter(x=>x.severity==='yellow').length,
        R: fouls.filter(x=>x.severity==='red').length,
      };
    });
  },[events,tid,players]);
}

// ═══ BADGE ════════════════════════════════════════════════════
const Badge = ({team,size=28}) => (
  <div style={{width:size,height:size,borderRadius:'50%',background:team.color,flexShrink:0,
    display:'flex',alignItems:'center',justifyContent:'center',
    fontFamily:'Barlow Condensed',fontWeight:900,fontSize:Math.round(size*.38),
    color:team.color==='#F5D000'?'#000':'white',
    border:'2px solid rgba(255,255,255,0.2)',boxShadow:`0 0 10px ${team.color}50`}}>
    {team.name.slice(0,2).toUpperCase()}
  </div>
);

// ═══ CLOCK ════════════════════════════════════════════════════
function Clock({clock, mobile}) {
  const {seconds, running, half, setHalf, setSeconds, setRunning} = clock;
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');

  const startEdit = ()=>{setRunning(false);setEditVal(fmtClock(seconds));setEditing(true);};
  const saveEdit = ()=>{
    const [m,s] = editVal.split(':').map(x=>parseInt(x)||0);
    setSeconds(m*60+s);
    setEditing(false);
  };

  const nextHalf = ()=>{
    setRunning(false);
    if(half===1){setHalf(2);setSeconds(0);}
    else if(half===2){if(window.confirm('Start overtime?'))setHalf(3);}
    else setHalf(h=>h+1);
  };

  return (
    <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.04)',
      borderRadius:10,padding:'5px 10px',border:'1px solid rgba(255,255,255,0.06)'}}>
      <button className="btn" onClick={()=>setHalf(h=>h===1?2:h===2?1:h)}
        style={{background:half===1?'rgba(255,255,255,0.08)':'rgba(255,61,189,0.15)',
          border:`1px solid ${half>=2?'rgba(255,61,189,0.4)':'rgba(255,255,255,0.1)'}`,
          borderRadius:6,padding:'4px 8px',fontFamily:'Barlow Condensed',fontWeight:800,
          fontSize:10,color:'white',letterSpacing:'0.1em'}}>
        {halfLabel(half)}
      </button>
      {editing
        ? <input value={editVal} onChange={e=>setEditVal(e.target.value)}
            onBlur={saveEdit} onKeyDown={e=>e.key==='Enter'&&saveEdit()} autoFocus
            style={{width:60,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,61,189,0.4)',
              borderRadius:5,color:'white',fontFamily:'Barlow Condensed',fontWeight:900,
              fontSize:20,textAlign:'center',padding:'2px 4px',outline:'none'}}/>
        : <span onClick={startEdit} style={{fontFamily:'Barlow Condensed',fontWeight:900,
            fontSize:mobile?20:24,color:running?'#34D399':'white',letterSpacing:1,cursor:'pointer',
            minWidth:60,textAlign:'center'}}>{fmtClock(seconds)}</span>
      }
      <button className="btn" onClick={()=>setRunning(r=>!r)}
        style={{background:running?'#DC2626':'#059669',borderRadius:6,padding:'4px 8px',
          fontSize:14,color:'white',width:30,height:26}}>
        {running?'⏸':'▶'}
      </button>
      <button className="btn" onClick={()=>{if(window.confirm('Reset clock to 0?'))setSeconds(0);}}
        style={{background:'rgba(255,255,255,0.06)',borderRadius:6,padding:'4px 6px',
          fontSize:12,color:'rgba(255,255,255,0.6)'}}>↻</button>
      <button className="btn" onClick={nextHalf}
        style={{background:'rgba(255,61,189,0.12)',border:'1px solid rgba(255,61,189,0.3)',
          borderRadius:6,padding:'4px 8px',fontFamily:'Barlow Condensed',fontWeight:700,
          fontSize:10,color:'#FF93D7',letterSpacing:'0.1em'}}>
        NEXT ▸
      </button>
    </div>
  );
}

// ═══ END MATCH MODAL ══════════════════════════════════════════
function EndMatchModal({teamA, teamB, scoreA, scoreB, onConfirm, onCancel}) {
  return (
    <div className="overlay-c">
      <div className="modal pop" style={{textAlign:'center'}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:22,color:'white',marginBottom:6}}>END MATCH?</div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:32,color:'white',letterSpacing:4,margin:'12px 0'}}>
          <span style={{color:teamA.color}}>{teamA.name}</span>
          <span style={{color:'rgba(255,255,255,0.4)',margin:'0 10px'}}>{scoreA}–{scoreB}</span>
          <span style={{color:teamB.color}}>{teamB.name}</span>
        </div>
        <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:20}}>Match akan disimpan ke History</div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn" onClick={onCancel}
            style={{flex:1,padding:'10px',borderRadius:10,background:'rgba(255,255,255,0.07)',
              border:'1px solid rgba(255,255,255,0.1)',fontWeight:700,fontSize:14,color:'rgba(255,255,255,0.6)'}}>CANCEL</button>
          <button className="btn" onClick={onConfirm}
            style={{flex:1,padding:'10px',borderRadius:10,background:'#DC2626',
              border:'none',fontWeight:900,fontSize:14,color:'white',boxShadow:'0 4px 16px rgba(220,38,38,0.4)'}}>END MATCH</button>
        </div>
      </div>
    </div>
  );
}

// ═══ ACTION MODAL (Foul/Block/Steal/Turnover) ═════════════════
function ActionModal({action, team, side, clock, onRecord, onCancel}) {
  const [pid, setPid] = useState(null);
  const [subType, setSubType] = useState(null);
  const needsSubType = action==='FOUL' || action==='TO';
  const options = action==='FOUL' ? FOUL_TYPES : action==='TO' ? TO_TYPES : null;

  const title = action==='FOUL'?'RECORD FOUL':action==='BLOCK'?'RECORD BLOCK':action==='STEAL'?'RECORD STEAL':'RECORD TURNOVER';
  const ic = action==='FOUL'?'⚠':action==='BLOCK'?'🛡':action==='STEAL'?'🤚':'↻';

  const canSubmit = pid && (!needsSubType || subType);
  const submit = ()=>{
    if (!canSubmit) return;
    const ev = {team:side, kind:action, pid, half:clock.half, clock:clock.seconds};
    if (action==='FOUL') ev.severity = subType;
    if (action==='TO') ev.toType = subType;
    onRecord(ev);
  };

  return (
    <div className="overlay-c" onClick={(e)=>{if(e.target===e.currentTarget)onCancel();}}>
      <div className="modal pop">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
          <div>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:20,color:'white'}}>
              <span style={{marginRight:8}}>{ic}</span>{title}
            </div>
            <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:3}}>
              {team.name} — {halfLabel(clock.half)} {fmtClock(clock.seconds)}
            </div>
          </div>
          <button className="btn" onClick={onCancel}
            style={{background:'rgba(255,255,255,0.07)',borderRadius:7,color:'rgba(255,255,255,0.5)',padding:'4px 10px',fontSize:14}}>✕</button>
        </div>

        {/* Player picker */}
        <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:10,color:'rgba(255,255,255,0.4)',letterSpacing:'0.2em',marginBottom:7}}>SELECT PLAYER</div>
        {team.players.length===0
          ? <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.3)',padding:'12px',
              background:'rgba(255,255,255,0.03)',borderRadius:8,textAlign:'center'}}>No players in roster — add players in Team Database</div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:14}}>
              {team.players.map(p=><button key={p.id} className="btn" onClick={()=>setPid(p.id)}
                style={{background:pid===p.id?team.color:'rgba(255,255,255,0.06)',
                  border:`1px solid ${pid===p.id?team.color:'rgba(255,255,255,0.08)'}`,
                  borderRadius:8,padding:'7px 3px',display:'flex',flexDirection:'column',alignItems:'center'}}>
                <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:'white',lineHeight:1}}>{p.no}</span>
                <span style={{fontFamily:'Barlow',fontSize:7,color:'rgba(255,255,255,0.5)',textAlign:'center',lineHeight:1.1,marginTop:2}}>{p.name.split(' ')[0]}</span>
              </button>)}
            </div>
        }

        {/* Sub-type picker */}
        {needsSubType && <>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:10,color:'rgba(255,255,255,0.4)',letterSpacing:'0.2em',marginBottom:7}}>
            {action==='FOUL'?'SEVERITY':'TURNOVER TYPE'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:action==='FOUL'?'repeat(4,1fr)':'repeat(3,1fr)',gap:6,marginBottom:14}}>
            {options.map(o=><button key={o.id} className="btn" onClick={()=>setSubType(o.id)}
              style={{background:subType===o.id?(o.color||'rgba(255,255,255,0.15)'):'rgba(255,255,255,0.05)',
                border:`1px solid ${subType===o.id?(o.color||'rgba(255,255,255,0.25)'):'rgba(255,255,255,0.08)'}`,
                borderRadius:8,padding:'10px 5px',fontFamily:'Barlow Condensed',fontWeight:800,
                fontSize:12,color:'white'}}>
              {o.short && <div style={{fontSize:16,marginBottom:2}}>{o.short}</div>}
              {o.label}
            </button>)}
          </div>
        </>}

        <button className="btn" onClick={submit} disabled={!canSubmit}
          style={{width:'100%',padding:'12px',borderRadius:10,
            background:canSubmit?'linear-gradient(90deg,#FF3DBD,#9B2BFB)':'rgba(255,255,255,0.05)',
            border:'none',fontWeight:900,fontSize:14,color:canSubmit?'white':'rgba(255,255,255,0.3)',
            letterSpacing:'0.1em',cursor:canSubmit?'pointer':'not-allowed',
            boxShadow:canSubmit?'0 4px 16px rgba(255,61,189,0.3)':'none'}}>
          RECORD
        </button>
      </div>
    </div>
  );
}

// ═══ COURT SVG ════════════════════════════════════════════════
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

// ═══ SHOT PANEL (with assist) ═════════════════════════════════
function ShotPanel({zone, team, side, wave, clock, onRecord, onCancel}) {
  const [pid, setPid] = useState(null);
  const [step, setStep] = useState('outcome'); // 'outcome' or 'assist'
  const [outcome, setOutcome] = useState(null);
  const OPTS = [
    {id:'GOAL',label:'GOAL',color:'#059669',icon:'⚽'},
    {id:'SAVE',label:'SAVE',color:'#DC2626',icon:'🧤'},
    {id:'MISS',label:'MISS',color:'#374151',icon:'✗'}
  ];

  const doRecord = (oc, assistPid=null)=>{
    onRecord({team:side, zone:zone.id, outcome:oc, pid, assistPid,
      wave:wave==='ALL'?'3':wave, half:clock.half, clock:clock.seconds});
  };

  const handleOutcome = (oc)=>{
    if (oc==='GOAL' && pid && team.players.length>1) {
      setOutcome(oc);
      setStep('assist');
    } else {
      doRecord(oc);
    }
  };

  if (step==='assist') {
    return <div className="pop" style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:'white'}}>ASSIST?</div>
          <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:3}}>Optional — siapa hantar bola untuk gol ni?</div>
        </div>
        <button className="btn" onClick={onCancel} style={{background:'rgba(255,255,255,0.07)',borderRadius:7,color:'rgba(255,255,255,0.5)',padding:'4px 10px',fontSize:14}}>✕</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
        {team.players.filter(p=>p.id!==pid).map(p=><button key={p.id} className="btn" onClick={()=>doRecord('GOAL',p.id)}
          style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:8,padding:'7px 3px',display:'flex',flexDirection:'column',alignItems:'center'}}>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,color:'white',lineHeight:1}}>{p.no}</span>
          <span style={{fontFamily:'Barlow',fontSize:7,color:'rgba(255,255,255,0.5)',textAlign:'center',lineHeight:1.1}}>{p.name.split(' ')[0]}</span>
        </button>)}
      </div>
      <button className="btn" onClick={()=>doRecord('GOAL')}
        style={{padding:'9px',borderRadius:10,background:'rgba(255,255,255,0.07)',
          border:'1px solid rgba(255,255,255,0.1)',fontWeight:700,fontSize:13,
          color:'rgba(255,255,255,0.6)',letterSpacing:'0.08em'}}>NO ASSIST — SKIP</button>
    </div>;
  }

  return <div className="pop" style={{display:'flex',flexDirection:'column',gap:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
      <div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:20,color:'white',lineHeight:1}}>{zone.lbl.toUpperCase()}</div>
        <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:3}}>
          {team.name} — {halfLabel(clock.half)} {fmtClock(clock.seconds)}
        </div>
      </div>
      <button className="btn" onClick={onCancel} style={{background:'rgba(255,255,255,0.07)',borderRadius:7,color:'rgba(255,255,255,0.5)',padding:'4px 10px',fontSize:14}}>✕</button>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
      {OPTS.map(o=><button key={o.id} className="btn" onClick={()=>handleOutcome(o.id)}
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

// ═══ SIDEBAR SUMMARY ══════════════════════════════════════════
function SidebarSummary({stats}) {
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
    </div>
    {/* Defensive + discipline row */}
    <div style={{marginTop:8,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
      {[['BL',stats.blocks,'#3B82F6'],['ST',stats.steals,'#10B981'],['TO',stats.to,'#F59E0B']].map(([lbl,val,col])=>
        <div key={lbl} style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'7px',textAlign:'center'}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:col,lineHeight:1}}>{val}</div>
          <div style={{fontFamily:'Barlow',fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.15em',marginTop:2}}>{lbl}</div>
        </div>
      )}
    </div>
    {(stats.twoMin+stats.yellow+stats.red>0)&&<div style={{marginTop:8,display:'flex',gap:5,flexWrap:'wrap'}}>
      {stats.twoMin>0&&<span style={{background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',
        borderRadius:6,padding:'3px 9px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'#F87171'}}>2′ × {stats.twoMin}</span>}
      {stats.yellow>0&&<span style={{background:'rgba(234,179,8,0.15)',border:'1px solid rgba(234,179,8,0.3)',
        borderRadius:6,padding:'3px 9px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'#FACC15'}}>YC × {stats.yellow}</span>}
      {stats.red>0&&<span style={{background:'rgba(153,27,27,0.2)',border:'1px solid rgba(153,27,27,0.4)',
        borderRadius:6,padding:'3px 9px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'#FCA5A5'}}>RC × {stats.red}</span>}
    </div>}
  </div>;
}

// ═══ OVERVIEW TAB ═════════════════════════════════════════════
function OverviewTab({events, teamA, teamB, clock, scoreA, scoreB}) {
  const Na = useGlobalStats(events,'A','B');
  const Nb = useGlobalStats(events,'B','A');
  const sA = useTopScorers(events,'A',teamA.players);
  const sB = useTopScorers(events,'B',teamB.players);

  const statTile = (label, valA, valB, fmt=null)=>
    <div style={{background:'rgba(255,255,255,0.03)',borderRadius:10,padding:'10px',border:'1px solid rgba(255,255,255,0.05)'}}>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:9,color:'rgba(255,255,255,0.35)',letterSpacing:'0.18em',marginBottom:6,textAlign:'center'}}>{label}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:20,color:teamA.color}}>{fmt?fmt(valA):valA}</div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:20,color:teamB.color}}>{fmt?fmt(valB):valB}</div>
        </div>
      </div>
    </div>;

  return<div className="sc" style={{overflowY:'auto',padding:'14px',maxWidth:720,margin:'0 auto'}}>
    {/* Score + clock hero */}
    <div style={{background:'rgba(255,255,255,0.03)',borderRadius:14,padding:'18px',
      border:'1px solid rgba(255,255,255,0.07)',marginBottom:14,textAlign:'center'}}>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:'0.2em',marginBottom:6}}>
        {halfLabel(clock.half)} — {fmtClock(clock.seconds)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:10}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
          <Badge team={teamA} size={42}/>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:teamA.color}}>{teamA.name.toUpperCase()}</span>
        </div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:60,color:'white',lineHeight:1,letterSpacing:6}}>
          {scoreA}<span style={{color:'rgba(255,255,255,0.3)'}}> – </span>{scoreB}
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
          <Badge team={teamB} size={42}/>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:teamB.color}}>{teamB.name.toUpperCase()}</span>
        </div>
      </div>
    </div>

    {/* Key stat tiles */}
    <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:8}}>KEY STATS</div>
    <div className="r2" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
      {statTile('SHOOTING %', Na.pctShoot, Nb.pctShoot)}
      {statTile('SHOTS', `${Na.goals}/${Na.total}`, `${Nb.goals}/${Nb.total}`)}
      {statTile('SAVES', `${Na.saves.g}`, `${Nb.saves.g}`)}
      {statTile('TURNOVERS', Na.to, Nb.to)}
      {statTile('FASTBREAK', `${Na.fast.g}/${Na.fast.a}`, `${Nb.fast.g}/${Nb.fast.a}`)}
      {statTile('7-METER', `${Na.sevenM.g}/${Na.sevenM.a}`, `${Nb.sevenM.g}/${Nb.sevenM.a}`)}
      {statTile('BLOCKS', Na.blocks, Nb.blocks)}
      {statTile('STEALS', Na.steals, Nb.steals)}
      {statTile('2-MIN', Na.twoMin, Nb.twoMin)}
    </div>

    {/* Top performer */}
    <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:8}}>TOP PERFORMERS</div>
    <div className="r2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
      {[{sc:sA,t:teamA},{sc:sB,t:teamB}].map(({sc,t})=>
        <div key={t.id} style={{background:'rgba(255,255,255,0.03)',borderRadius:10,padding:'12px',border:`1px solid ${t.color}30`}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <Badge team={t} size={18}/>
            <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:t.color}}>{t.name.toUpperCase()}</span>
          </div>
          {sc.length===0
            ?<div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.2)'}}>No goals yet</div>
            :sc.slice(0,3).map(s=><div key={s.p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:14,color:t.color}}>#{s.p.no}</span>
                <span style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.65)'}}>{s.p.name}</span>
              </div>
              <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:'white'}}>{s.n}</span>
            </div>)
          }
        </div>
      )}
    </div>
  </div>;
}

// ═══ STATISTICS TAB ═══════════════════════════════════════════
function StatisticsTab({events,teamA,teamB,mobile}) {
  const [halfFilter, setHalfFilter] = useState(null); // null=all, 1, 2
  const Na = useGlobalStats(events,'A','B','ALL',halfFilter);
  const Nb = useGlobalStats(events,'B','A','ALL',halfFilter);
  const Na1 = useGlobalStats(events,'A','B','ALL',1);
  const Nb1 = useGlobalStats(events,'B','A','ALL',1);
  const Na2 = useGlobalStats(events,'A','B','ALL',2);
  const Nb2 = useGlobalStats(events,'B','A','ALL',2);

  const card=(title,children)=>
    <div style={{background:'rgba(255,255,255,0.02)',borderRadius:12,padding:'14px 16px',marginBottom:12,border:'1px solid rgba(255,255,255,0.06)'}}>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:10}}>{title}</div>
      {children}
    </div>;

  const row=(label,a,b)=>
    <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:'white',textAlign:'right'}}>{a}</div>
      <div style={{fontFamily:'Barlow',fontSize:10,color:'rgba(255,255,255,0.28)',textAlign:'center',minWidth:100}}>{label}</div>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:'white'}}>{b}</div>
    </div>;

  const attackCard = (team, stats) => {
    const rows = [['Fastbreaks',stats.fast],['7-M Throw',stats.sevenM],['Fast',stats.breakthrough],['Long Distance',stats.long]];
    return<div style={{background:'rgba(255,255,255,0.02)',borderRadius:12,padding:'14px',border:`1px solid ${team.color}30`,flex:1}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <Badge team={team} size={24}/>
        <div>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:15,color:team.color}}>{team.name.toUpperCase()}</div>
          <div className="pill" style={{display:'inline-block',borderRadius:4,padding:'1px 8px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:9,color:'white',letterSpacing:'0.15em',marginTop:2}}>ATTACK CHART</div>
        </div>
      </div>
      {rows.map(([label,s])=>{const p=s.a?Math.round(s.g/s.a*100):0;
        return<div key={label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
          <span style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.6)'}}>{label}</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:'white',background:'rgba(255,255,255,0.06)',borderRadius:6,padding:'2px 8px',minWidth:40,textAlign:'center'}}>{s.g}/{s.a}</span>
            <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,minWidth:36,color:p>=50?'#34D399':'rgba(255,255,255,0.4)'}}>{p}%</span>
          </div>
        </div>;
      })}
    </div>;
  };

  const f=s=>`${s.g}/${s.a} (${pct(s.g,s.a)})`;

  return<div className="sc" style={{overflowY:'auto',padding:'16px',maxWidth:720,margin:'0 auto'}}>
    {/* Half filter */}
    <div style={{display:'flex',gap:6,marginBottom:12}}>
      {[[null,'OVERALL'],[1,'1ST HALF'],[2,'2ND HALF']].map(([v,lbl])=>
        <button key={lbl} className="btn" onClick={()=>setHalfFilter(v)}
          style={{flex:1,padding:'7px',borderRadius:8,
            background:halfFilter===v?'rgba(255,61,189,0.15)':'rgba(255,255,255,0.04)',
            border:`1px solid ${halfFilter===v?'rgba(255,61,189,0.4)':'rgba(255,255,255,0.08)'}`,
            fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,
            color:halfFilter===v?'#FF93D7':'rgba(255,255,255,0.55)',letterSpacing:'0.12em'}}>
          {lbl}
        </button>
      )}
    </div>

    <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:10}}>ATTACK CHART SUMMARY</div>
    <div style={{display:'flex',flexDirection:mobile?'column':'row',gap:12,marginBottom:16}}>
      {attackCard(teamA, Na)}
      {attackCard(teamB, Nb)}
    </div>

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

    {card('SHOOTING & ATTACK',<>
      {row('Shooting Efficiency',f(Na),f(Nb))}
      {row('Attack Efficiency',f(Na.attackEff),f(Nb.attackEff))}
      {row('7-Meter',`${Na.sevenM.g}/${Na.sevenM.a}`,`${Nb.sevenM.g}/${Nb.sevenM.a}`)}
      {row('Long Distance',`${Na.long.g}/${Na.long.a}`,`${Nb.long.g}/${Nb.long.a}`)}
      {row('Breakthrough',`${Na.breakthrough.g}/${Na.breakthrough.a}`,`${Nb.breakthrough.g}/${Nb.breakthrough.a}`)}
    </>)}

    {card('DEFENSE & DISCIPLINE',<>
      {row('Blocks',Na.blocks,Nb.blocks)}
      {row('Steals',Na.steals,Nb.steals)}
      {row('GK Saves',f(Na.saves),f(Nb.saves))}
      {row('Turnovers',Na.to,Nb.to)}
      {row('Total Fouls',Na.fouls,Nb.fouls)}
      {row('2-Min Suspensions',Na.twoMin,Nb.twoMin)}
      {row('Yellow Cards',Na.yellow,Nb.yellow)}
      {row('Red Cards',Na.red,Nb.red)}
    </>)}

    {card('HALF-TIME COMPARISON',<>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11,color:'rgba(255,255,255,0.45)',letterSpacing:'0.1em',marginBottom:6,textAlign:'center'}}>1ST HALF</div>
      {row('Goals',Na1.goals,Nb1.goals)}
      {row('Shooting %',Na1.pctShoot,Nb1.pctShoot)}
      {row('Turnovers',Na1.to,Nb1.to)}
      <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11,color:'rgba(255,255,255,0.45)',letterSpacing:'0.1em',marginBottom:6,marginTop:10,textAlign:'center'}}>2ND HALF</div>
      {row('Goals',Na2.goals,Nb2.goals)}
      {row('Shooting %',Na2.pctShoot,Nb2.pctShoot)}
      {row('Turnovers',Na2.to,Nb2.to)}
    </>)}
  </div>;
}

// ═══ PLAYERS TAB ══════════════════════════════════════════════
function PlayersTab({events, teamA, teamB, mobile}) {
  const [tab, setTab] = useState('A');
  const team = tab==='A' ? teamA : teamB;
  const ps = usePlayerStats(events, tab, team.players);
  const totals = ps.reduce((m,r)=>{
    Object.keys(r).filter(k=>k!=='p').forEach(k=>{m[k]=(m[k]||0)+r[k];});
    return m;
  },{});

  return<div className="sc" style={{overflowY:'auto',padding:'14px',maxWidth:900,margin:'0 auto'}}>
    {/* Team switcher */}
    <div style={{display:'flex',gap:6,marginBottom:14}}>
      {['A','B'].map(side=>{const t=side==='A'?teamA:teamB;return<button key={side} className="btn"
        onClick={()=>setTab(side)}
        style={{flex:1,padding:'10px',borderRadius:10,
          background:tab===side?t.color:'rgba(255,255,255,0.04)',
          border:`1px solid ${tab===side?t.color:'rgba(255,255,255,0.08)'}`,
          display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        <Badge team={t} size={20}/>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:'white'}}>{t.name.toUpperCase()}</span>
      </button>;})}
    </div>

    {team.players.length===0
      ? <div style={{padding:'30px 0',textAlign:'center',fontFamily:'Barlow',fontSize:13,color:'rgba(255,255,255,0.3)'}}>
          No players in this team. Add players via Team Database tab.</div>
      : <div style={{overflowX:'auto',background:'rgba(255,255,255,0.02)',borderRadius:12,
          border:'1px solid rgba(255,255,255,0.06)',padding:mobile?'4px':'10px'}}>
          <table className="tbl">
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:10}}>#</th>
              <th style={{textAlign:'left'}}>NAME</th>
              <th>G</th><th>A</th><th>SH</th>
              <th>TO</th><th>BL</th><th>ST</th>
              <th>F</th><th>2′</th><th>YC</th><th>RC</th>
            </tr></thead>
            <tbody>
              {ps.map(r=><tr key={r.p.id}>
                <td style={{textAlign:'left',paddingLeft:10,fontFamily:'Barlow Condensed',fontWeight:900,fontSize:14,color:team.color}}>#{r.p.no}</td>
                <td style={{textAlign:'left',fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.85)'}}>{r.p.name}</td>
                <td style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:r.G>0?'#34D399':'rgba(255,255,255,0.4)'}}>{r.G}</td>
                <td style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:r.A>0?'#60A5FA':'rgba(255,255,255,0.4)'}}>{r.A}</td>
                <td style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.55)'}}>{r.G}/{r.Sh}</td>
                <td style={{color:r.TO>0?'#F59E0B':'rgba(255,255,255,0.4)'}}>{r.TO}</td>
                <td style={{color:r.BL>0?'#3B82F6':'rgba(255,255,255,0.4)'}}>{r.BL}</td>
                <td style={{color:r.ST>0?'#10B981':'rgba(255,255,255,0.4)'}}>{r.ST}</td>
                <td style={{color:r.F>0?'#FBBF24':'rgba(255,255,255,0.4)'}}>{r.F}</td>
                <td style={{color:r.twoMin>0?'#F87171':'rgba(255,255,255,0.4)'}}>{r.twoMin}</td>
                <td style={{color:r.Y>0?'#FACC15':'rgba(255,255,255,0.4)'}}>{r.Y}</td>
                <td style={{color:r.R>0?'#FCA5A5':'rgba(255,255,255,0.4)'}}>{r.R}</td>
              </tr>)}
              <tr style={{background:'rgba(255,255,255,0.04)',borderTop:'2px solid rgba(255,255,255,0.1)'}}>
                <td colSpan={2} style={{textAlign:'left',paddingLeft:10,fontFamily:'Barlow Condensed',fontWeight:900,fontSize:12,color:'rgba(255,255,255,0.5)',letterSpacing:'0.15em'}}>TOTAL</td>
                <td style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:15,color:'white'}}>{totals.G||0}</td>
                <td style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:15,color:'white'}}>{totals.A||0}</td>
                <td style={{fontFamily:'Barlow',fontSize:11,color:'white'}}>{totals.G||0}/{totals.Sh||0}</td>
                <td style={{color:'white'}}>{totals.TO||0}</td>
                <td style={{color:'white'}}>{totals.BL||0}</td>
                <td style={{color:'white'}}>{totals.ST||0}</td>
                <td style={{color:'white'}}>{totals.F||0}</td>
                <td style={{color:'white'}}>{totals.twoMin||0}</td>
                <td style={{color:'white'}}>{totals.Y||0}</td>
                <td style={{color:'white'}}>{totals.R||0}</td>
              </tr>
            </tbody>
          </table>
        </div>
    }

    <div style={{marginTop:12,padding:'10px 14px',background:'rgba(255,255,255,0.02)',borderRadius:10,
      fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.45)',lineHeight:1.6,border:'1px solid rgba(255,255,255,0.04)'}}>
      <strong style={{color:'rgba(255,255,255,0.6)'}}>Legend:</strong> G=Goals · A=Assists · SH=Shot ratio · TO=Turnovers · BL=Blocks · ST=Steals · F=Fouls · 2′=2-Min · YC=Yellow · RC=Red
    </div>
  </div>;
}

curTeam} side={activeTeam} wave={wave} clock={clock}
            onRecord={handleShot} onCancel={()=>setSelZone(null)}/>
          :<><div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.28)',letterSpacing:'0.2em',marginBottom:12}}>
              {curTeam.name.toUpperCase()} SUMMARY{wave!=='ALL'?` — ${WAVES.find(w=>w.id===wave)?.label}`:''}
            </div>
            <SidebarSummary stats={activeTeam==='A'?statsA:statsB}/></>
        }
      </div>}
      {/* Mobile bottom sheet */}
      {mobile&&selZone&&<div className="overlay" onClick={(e)=>{if(e.target===e.currentTarget)setSelZone(null);}}>
        <div className="sheet pop">
          <ShotPanel zone={selZone} team={curTeam} side={activeTeam} wave={wave} clock={clock}
            onRecord={handleShot} onCancel={()=>setSelZone(null)}/>
        </div>
      </div>}
    </div>}

    {tab==='stats'&&<StatisticsTab events={events} teamA={teamA} teamB={teamB} mobile={mobile}/>}
    {tab==='players'&&<PlayersTab events={events} teamA={teamA} teamB={teamB} mobile={mobile}/>}
    {tab==='history'&&<HistoryTab events={events} teamA={teamA} teamB={teamB} matchHistory={matchHistory} dispatch={dispatch}/>}
    {tab==='db'&&<DatabaseTab teamDB={teamDB} setTeamDB={setTeamDB} matchTeams={matchTeams} setMatchTeams={setMatchTeams}/>}
  </div>;
}
