import React, { useReducer, useState, useMemo, useEffect, useRef } from 'react';
import { supabase, isSubscriptionActive, daysRemaining, saveMatchToCloud, loadMatchHistory, loadTeams, syncTeamsToCloud, registerDevice, heartbeatDevice, getActiveDevices, logoutDevice, cleanupCurrentDevice, getDeviceToken, getDeviceLimit } from './supabase';

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
  { id:'kdh', name:'KEDAH',     color:'#CC0001', players:[] },
  { id:'png', name:'PENANG',    color:'#0057A8', players:[] },
  { id:'prk', name:'PERAK',     color:'#F5D000', players:[] },
  { id:'jhr', name:'JOHOR',     color:'#E32726', players:[] },
  { id:'sgr', name:'SELANGOR',  color:'#FFCC00', players:[] },
  { id:'kl',  name:'KL',        color:'#1A1A2E', players:[] },
  { id:'trg', name:'TERENGGANU', color:'#138808', players:[] },
  { id:'pkn', name:'PAHANG',    color:'#000000', players:[] },
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
function ShotPanel({zone, team, side, wave, clock, onRecord, onCancel, focusMode={}}) {
  const [pid, setPid] = useState(null);
  const [step, setStep] = useState('outcome'); // 'outcome' or 'assist'
  const [outcome, setOutcome] = useState(null);
  const OPTS = [
    {id:'GOAL',label:'GOAL',color:'#059669',icon:'⚽'},
    {id:'SAVE',label:'SAVE',color:'#DC2626',icon:'🧤'},
    {id:'MISS',label:'MISS',color:'#374151',icon:'✗'}
  ];

  const doRecord = (oc, assistPid=null)=>{
    onRecord({team:side, zone:zone.id, outcome:oc, pid:focusMode.players!==false?pid:null,
      assistPid:focusMode.assists!==false?assistPid:null,
      wave:wave==='ALL'?'3':wave, half:clock.half, clock:clock.seconds});
  };

  const handleOutcome = (oc)=>{
    if (oc==='GOAL' && pid && team.players.length>1 && focusMode.assists!==false) {
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
    {team.players.length > 0 && focusMode.players!==false && <>
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

// ═══ MATCH REPORT (Printable) ═════════════════════════════════
function MatchReport({events, teamA, teamB, scoreA, scoreB, clock, onClose}) {
  const Na  = useGlobalStats(events,'A','B');
  const Nb  = useGlobalStats(events,'B','A');
  const Na1 = useGlobalStats(events,'A','B','ALL',1);
  const Nb1 = useGlobalStats(events,'B','A','ALL',1);
  const Na2 = useGlobalStats(events,'A','B','ALL',2);
  const Nb2 = useGlobalStats(events,'B','A','ALL',2);
  const psA = usePlayerStats(events,'A',teamA.players);
  const psB = usePlayerStats(events,'B',teamB.players);
  const sA  = useTopScorers(events,'A',teamA.players);
  const sB  = useTopScorers(events,'B',teamB.players);
  const date = new Date().toLocaleDateString('en-MY',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  const PRINT_CSS = `
    @media print {
      html, body { background: white !important; margin: 0 !important; padding: 0 !important; height: auto !important; }
      body * { visibility: hidden !important; }
      #report-overlay, #report-overlay * { visibility: visible !important; }
      #report-overlay {
        position: static !important;
        background: white !important;
        padding: 0 !important;
        overflow: visible !important;
        height: auto !important;
        inset: auto !important;
      }
      #match-report {
        position: static !important;
        max-width: 100% !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .report-section {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      table { page-break-inside: avoid !important; }
      .no-print { display: none !important; }
      @page { margin: 1.2cm; size: A4; }
    }
  `;

  // Stat bar comparison
  const Bar = ({label, a, b, fmt=x=>x, higherBetter=true})=>{
    const total = (parseFloat(a)||0) + (parseFloat(b)||0);
    const pctA = total ? Math.round((parseFloat(a)||0)/total*100) : 50;
    const pctB = 100 - pctA;
    const aWins = higherBetter ? parseFloat(a)>=parseFloat(b) : parseFloat(a)<=parseFloat(b);
    return (
      <div style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
          <span style={{fontWeight:700,fontSize:15,color:aWins?teamA.color:'#333'}}>{fmt(a)}</span>
          <span style={{fontSize:10,color:'#888',letterSpacing:'0.1em',fontWeight:600}}>{label}</span>
          <span style={{fontWeight:700,fontSize:15,color:!aWins?teamB.color:'#333'}}>{fmt(b)}</span>
        </div>
        <div style={{display:'flex',borderRadius:4,overflow:'hidden',height:8}}>
          <div style={{width:pctA+'%',background:teamA.color,opacity:0.85}}/>
          <div style={{width:pctB+'%',background:teamB.color,opacity:0.85}}/>
        </div>
      </div>
    );
  };

  // Player row for table
  const PRow = ({r,team})=> r.G+r.A+r.Sh+r.TO+r.BL+r.ST+r.F===0 ? null : (
    <tr>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',color:team.color,fontWeight:700}}>#{r.p.no}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',fontWeight:600}}>{r.p.name}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',fontWeight:700,color:r.G>0?'#059669':'#999'}}>{r.G}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:r.A>0?'#2563EB':'#999'}}>{r.A}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:'#555'}}>{r.G}/{r.Sh}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:r.TO>0?'#D97706':'#999'}}>{r.TO}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:r.BL>0?'#2563EB':'#999'}}>{r.BL}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:r.ST>0?'#059669':'#999'}}>{r.ST}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:r.twoMin>0?'#DC2626':'#999'}}>{r.twoMin||0}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:r.Y>0?'#CA8A04':'#999'}}>{r.Y}</td>
      <td style={{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:r.R>0?'#991B1B':'#999'}}>{r.R}</td>
    </tr>
  );

  const Section = ({title,children,color='#1e3a5f'})=>(
    <div className="report-section" style={{marginBottom:20,pageBreakInside:'avoid'}}>
      <div style={{background:color,color:'white',padding:'6px 14px',borderRadius:'6px 6px 0 0',
        fontSize:11,fontWeight:800,letterSpacing:'0.15em'}}>{title}</div>
      <div style={{border:'1px solid #ddd',borderTop:'none',borderRadius:'0 0 6px 6px',padding:'14px'}}>{children}</div>
    </div>
  );

  return (
    <div id="report-overlay" style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:950,overflowY:'auto',padding:'20px'}}>
      <style>{PRINT_CSS}</style>
      <div id="match-report" style={{background:'white',maxWidth:800,margin:'0 auto',borderRadius:12,
        fontFamily:'Arial,sans-serif',color:'#1a1a1a',fontSize:13,lineHeight:1.4}}>

        {/* Action bar */}
        <div className="no-print" style={{background:'#f8f9fa',borderRadius:'12px 12px 0 0',padding:'12px 20px',
          display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #ddd'}}>
          <span style={{fontWeight:700,fontSize:14,color:'#555'}}>📄 Match Report — Preview</span>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>window.print()}
              style={{background:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'8px 18px',
                fontWeight:700,fontSize:13,cursor:'pointer'}}>🖨️ Print / Save PDF</button>
            <button onClick={onClose}
              style={{background:'#eee',border:'none',borderRadius:8,padding:'8px 14px',fontWeight:700,fontSize:13,cursor:'pointer'}}>✕ Close</button>
          </div>
        </div>

        {/* Report Content */}
        <div style={{padding:'24px 28px'}}>

          {/* Header */}
          <div style={{textAlign:'center',borderBottom:'3px solid #1e3a5f',paddingBottom:16,marginBottom:20}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.2em',color:'#888',marginBottom:6}}>HANDBALL MATCH REPORT</div>
            <div style={{fontSize:11,color:'#888',marginBottom:12}}>{date} · {halfLabel(clock.half)} · {fmtClock(clock.seconds)}</div>
            {/* Score hero */}
            <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',gap:16,marginBottom:10}}>
              <div style={{textAlign:'right'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:teamA.color,display:'inline-flex',
                  alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:18,marginBottom:6}}>
                  {teamA.name.slice(0,2).toUpperCase()}
                </div>
                <div style={{fontSize:18,fontWeight:900,color:teamA.color}}>{teamA.name.toUpperCase()}</div>
              </div>
              <div style={{textAlign:'center',padding:'10px 24px',background:'#f0f4f8',borderRadius:12}}>
                <div style={{fontSize:48,fontWeight:900,letterSpacing:6,color:'#1e3a5f',lineHeight:1}}>
                  {scoreA}<span style={{color:'#ccc',margin:'0 8px'}}>–</span>{scoreB}
                </div>
                <div style={{fontSize:11,color:'#888',marginTop:4,fontWeight:600}}>FINAL SCORE</div>
              </div>
              <div style={{textAlign:'left'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:teamB.color,display:'inline-flex',
                  alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:18,marginBottom:6}}>
                  {teamB.name.slice(0,2).toUpperCase()}
                </div>
                <div style={{fontSize:18,fontWeight:900,color:teamB.color}}>{teamB.name.toUpperCase()}</div>
              </div>
            </div>
          </div>

          {/* Key Stats Comparison */}
          <Section title="PERBANDINGAN UTAMA">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:12,color:teamA.color,textAlign:'center',padding:'4px',background:teamA.color+'15',borderRadius:6}}>{teamA.name.toUpperCase()}</div>
              <div style={{fontWeight:700,fontSize:12,color:teamB.color,textAlign:'center',padding:'4px',background:teamB.color+'15',borderRadius:6}}>{teamB.name.toUpperCase()}</div>
            </div>
            <Bar label="SHOOTING %" a={parseInt(Na.pctShoot)||0} b={parseInt(Nb.pctShoot)||0} fmt={x=>x+'%'}/>
            <Bar label="GOALS / SHOTS" a={Na.goals} b={Nb.goals} fmt={x=>x}/>
            <Bar label="GK SAVES" a={Na.saves.g} b={Nb.saves.g} fmt={x=>x}/>
            <Bar label="TURNOVERS" a={Na.to} b={Nb.to} fmt={x=>x} higherBetter={false}/>
            <Bar label="BLOCKS" a={Na.blocks} b={Nb.blocks} fmt={x=>x}/>
            <Bar label="STEALS" a={Na.steals} b={Nb.steals} fmt={x=>x}/>
          </Section>

          {/* Attack Breakdown */}
          <Section title="ANALISIS SERANGAN">
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#f0f4f8'}}>
                  <th style={{padding:'7px 10px',textAlign:'left',fontWeight:700,fontSize:10,letterSpacing:'0.1em',color:'#555'}}>JENIS SERANGAN</th>
                  <th style={{padding:'7px 10px',textAlign:'center',color:teamA.color,fontWeight:700}}>{teamA.name} (G/A)</th>
                  <th style={{padding:'7px 10px',textAlign:'center',color:teamA.color,fontWeight:700}}>%</th>
                  <th style={{padding:'7px 10px',textAlign:'center',color:teamB.color,fontWeight:700}}>{teamB.name} (G/A)</th>
                  <th style={{padding:'7px 10px',textAlign:'center',color:teamB.color,fontWeight:700}}>%</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Fastbreak (1st Wave)', Na.fast, Nb.fast],
                  ['Counter (2nd Wave)', useGlobalStats, useGlobalStats],
                  ['7-Meter Throw', Na.sevenM, Nb.sevenM],
                  ['Pivot / Breakthrough', Na.breakthrough, Nb.breakthrough],
                  ['Long Distance', Na.long, Nb.long],
                  ['Wing Shots', Na.clear, Nb.clear],
                ].map(([lbl,a,b],i)=>{
                  if(typeof a==='function') return null;
                  const pa=a.a?Math.round(a.g/a.a*100):0, pb=b.a?Math.round(b.g/b.a*100):0;
                  return <tr key={lbl} style={{background:i%2?'#fafafa':'white'}}>
                    <td style={{padding:'6px 10px',borderBottom:'1px solid #eee',fontWeight:600}}>{lbl}</td>
                    <td style={{padding:'6px 10px',borderBottom:'1px solid #eee',textAlign:'center',fontWeight:700,color:teamA.color}}>{a.g}/{a.a}</td>
                    <td style={{padding:'6px 10px',borderBottom:'1px solid #eee',textAlign:'center',
                      color:pa>=50?'#059669':'#DC2626',fontWeight:600}}>{pa}%</td>
                    <td style={{padding:'6px 10px',borderBottom:'1px solid #eee',textAlign:'center',fontWeight:700,color:teamB.color}}>{b.g}/{b.a}</td>
                    <td style={{padding:'6px 10px',borderBottom:'1px solid #eee',textAlign:'center',
                      color:pb>=50?'#059669':'#DC2626',fontWeight:600}}>{pb}%</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </Section>

          {/* Half Time Comparison */}
          <Section title="PERBANDINGAN SEPARUH MASA">
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{background:'#f0f4f8'}}>
                  <th style={{padding:'7px 10px',textAlign:'left',fontWeight:700,fontSize:10,color:'#555'}}>STATISTIK</th>
                  <th colSpan={2} style={{padding:'7px',textAlign:'center',fontWeight:700,fontSize:10,color:'#555',borderRight:'2px solid #ddd'}}>1ST HALF</th>
                  <th colSpan={2} style={{padding:'7px',textAlign:'center',fontWeight:700,fontSize:10,color:'#555'}}>2ND HALF</th>
                </tr>
                <tr style={{background:'#f8f8f8'}}>
                  <th style={{padding:'5px 10px'}}/>
                  <th style={{padding:'5px',textAlign:'center',color:teamA.color,fontWeight:700,fontSize:11}}>{teamA.name}</th>
                  <th style={{padding:'5px',textAlign:'center',color:teamB.color,fontWeight:700,fontSize:11,borderRight:'2px solid #ddd'}}>{teamB.name}</th>
                  <th style={{padding:'5px',textAlign:'center',color:teamA.color,fontWeight:700,fontSize:11}}>{teamA.name}</th>
                  <th style={{padding:'5px',textAlign:'center',color:teamB.color,fontWeight:700,fontSize:11}}>{teamB.name}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Goals', Na1.goals, Nb1.goals, Na2.goals, Nb2.goals],
                  ['Shots', Na1.total, Nb1.total, Na2.total, Nb2.total],
                  ['Shooting %', Na1.pctShoot, Nb1.pctShoot, Na2.pctShoot, Nb2.pctShoot],
                  ['Turnovers', Na1.to, Nb1.to, Na2.to, Nb2.to],
                  ['Fouls', Na1.fouls, Nb1.fouls, Na2.fouls, Nb2.fouls],
                ].map(([lbl,a1,b1,a2,b2],i)=>(
                  <tr key={lbl} style={{background:i%2?'#fafafa':'white'}}>
                    <td style={{padding:'6px 10px',borderBottom:'1px solid #eee',fontWeight:600}}>{lbl}</td>
                    <td style={{padding:'6px',textAlign:'center',borderBottom:'1px solid #eee',fontWeight:700,color:teamA.color}}>{a1}</td>
                    <td style={{padding:'6px',textAlign:'center',borderBottom:'1px solid #eee',fontWeight:700,color:teamB.color,borderRight:'2px solid #ddd'}}>{b1}</td>
                    <td style={{padding:'6px',textAlign:'center',borderBottom:'1px solid #eee',fontWeight:700,color:teamA.color}}>{a2}</td>
                    <td style={{padding:'6px',textAlign:'center',borderBottom:'1px solid #eee',fontWeight:700,color:teamB.color}}>{b2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Discipline */}
          {(Na.twoMin+Na.yellow+Na.red+Nb.twoMin+Nb.yellow+Nb.red)>0&&
          <Section title="DISIPLIN & KAD">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              {[{team:teamA,st:Na},{team:teamB,st:Nb}].map(({team,st})=>(
                <div key={team.id}>
                  <div style={{fontWeight:700,color:team.color,marginBottom:8}}>{team.name.toUpperCase()}</div>
                  <div style={{display:'flex',gap:10}}>
                    {[['2-Min',st.twoMin,'#DC2626'],['Yellow',st.yellow,'#CA8A04'],['Red',st.red,'#991B1B'],['Foul',st.fouls,'#6B7280']].map(([lbl,val,col])=>(
                      <div key={lbl} style={{textAlign:'center',padding:'8px 12px',background:'#f8f8f8',borderRadius:8,border:'1px solid #eee'}}>
                        <div style={{fontSize:20,fontWeight:900,color:col}}>{val}</div>
                        <div style={{fontSize:9,color:'#888',fontWeight:700,letterSpacing:'0.1em'}}>{lbl.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>}

          {/* Player Stats */}
          {[{team:teamA,ps:psA},{team:teamB,ps:psB}].map(({team,ps})=>(
            ps.filter(r=>r.G+r.A+r.Sh+r.TO+r.BL+r.ST+r.F>0).length > 0 &&
            <Section key={team.id} title={`STATISTIK PEMAIN — ${team.name.toUpperCase()}`} color={team.color}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead>
                  <tr style={{background:team.color+'15'}}>
                    {['#','NAMA','G','A','G/SH','TO','BL','ST','2′','YC','RC'].map(h=>(
                      <th key={h} style={{padding:'6px 8px',textAlign:h==='NAMA'?'left':'center',fontWeight:700,fontSize:9,letterSpacing:'0.1em',color:'#555',borderBottom:'2px solid '+team.color}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ps.map((r,i)=><PRow key={r.p.id} r={r} team={team}/>)}
                </tbody>
              </table>
            </Section>
          ))}

          {/* Top Scorers */}
          {(sA.length>0||sB.length>0)&&
          <Section title="PENJARING TERBANYAK">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              {[{sc:sA,team:teamA},{sc:sB,team:teamB}].map(({sc,team})=>(
                <div key={team.id}>
                  <div style={{fontWeight:700,color:team.color,marginBottom:8,fontSize:12}}>{team.name.toUpperCase()}</div>
                  {sc.length===0
                    ?<div style={{fontSize:11,color:'#aaa'}}>No goals recorded</div>
                    :sc.map((s,i)=>(
                      <div key={s.p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:'1px solid #f0f0f0'}}>
                        <div style={{width:22,height:22,borderRadius:'50%',background:team.color,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:900,fontSize:10}}>
                          {i+1}
                        </div>
                        <span style={{color:team.color,fontWeight:700}}>#{s.p.no}</span>
                        <span style={{flex:1,fontWeight:600}}>{s.p.name}</span>
                        <span style={{fontWeight:900,fontSize:16,color:'#1e3a5f'}}>{s.n} gol</span>
                      </div>
                    ))
                  }
                </div>
              ))}
            </div>
          </Section>}

          {/* Footer */}
          <div style={{textAlign:'center',paddingTop:14,borderTop:'2px solid #eee',color:'#aaa',fontSize:10,letterSpacing:'0.1em'}}>
            HANDBALL ANALYSIS SYSTEM · GENERATED {new Date().toLocaleString('en-MY')}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ OVERVIEW TAB ═════════════════════════════════════════════
function OverviewTab({events, teamA, teamB, clock, scoreA, scoreB, onPrintReport}) {
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
    {/* Print Report Button */}
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
      <button className="btn" onClick={onPrintReport}
        style={{background:'#1e3a5f',border:'none',borderRadius:10,padding:'9px 18px',
          display:'flex',alignItems:'center',gap:7,boxShadow:'0 2px 12px rgba(0,0,0,0.3)'}}>
        <span style={{fontSize:16}}>🖨️</span>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:'white',letterSpacing:'0.1em'}}>PRINT MATCH REPORT</span>
      </button>
    </div>
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
      {row('Shooting Efficiency',`${Na.goals}/${Na.total} (${Na.pctShoot})`,`${Nb.goals}/${Nb.total} (${Nb.pctShoot})`)}
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

// ═══ PRICING TAB ══════════════════════════════════════════════
const PRICING_DATA = {
  individual: { name:{BM:'Solo',EN:'Solo'}, sub:{BM:'Coach solo',EN:'Solo coach'},
    p1:10, p6:30, p12:45, devices:1, color:'#3B82F6', popular:false },
  team: { name:{BM:'Team',EN:'Team'}, sub:{BM:'Coaching staff pasukan',EN:'Coaching staff'},
    p1:15, p6:50, p12:65, devices:3, color:'#FF3DBD', popular:true },
  club: { name:{BM:'Club',EN:'Club'}, sub:{BM:'Kelab / persatuan',EN:'Club / association'},
    p1:25, p6:90, p12:120, devices:6, color:'#F59E0B', popular:false },
};

const PRICING_FEATURES = {
  BM: [
    { key:'devices',     label:'Peranti aktif serentak',     ind:'1 peranti', team:'3 peranti', club:'6 peranti' },
    { key:'analysis',    label:'Semua features analisis',    ind:true, team:true, club:true },
    { key:'report',      label:'Print match report',         ind:true, team:true, club:true },
    { key:'cloud',       label:'Cloud backup',               ind:'5 match terkini', team:'Tanpa had', club:'Tanpa had' },
    { key:'sync',        label:'Multi-device sync',          ind:false, team:true, club:true },
    { key:'export',      label:'Export CSV / PDF',           ind:'PDF sahaja', team:true, club:true },
    { key:'multiteam',   label:'Multiple teams',             ind:false, team:false, club:true },
    { key:'analytics',   label:'Cross-team analytics',       ind:false, team:false, club:true },
    { key:'branding',    label:'Custom branding kelab',      ind:false, team:false, club:true },
    { key:'support',     label:'Priority support',           ind:false, team:false, club:true },
  ],
  EN: [
    { key:'devices',     label:'Active devices',             ind:'1 device', team:'3 devices', club:'6 devices' },
    { key:'analysis',    label:'All analysis features',      ind:true, team:true, club:true },
    { key:'report',      label:'Print match report',         ind:true, team:true, club:true },
    { key:'cloud',       label:'Cloud backup',               ind:'Last 5 matches', team:'Unlimited', club:'Unlimited' },
    { key:'sync',        label:'Multi-device sync',          ind:false, team:true, club:true },
    { key:'export',      label:'Export CSV / PDF',           ind:'PDF only', team:true, club:true },
    { key:'multiteam',   label:'Multiple teams',             ind:false, team:false, club:true },
    { key:'analytics',   label:'Cross-team analytics',       ind:false, team:false, club:true },
    { key:'branding',    label:'Custom club branding',       ind:false, team:false, club:true },
    { key:'support',     label:'Priority support',           ind:false, team:false, club:true },
  ],
};

const PRICING_TXT = {
  BM: {
    title:'Pilih Plan Anda', sub:'30 hari percubaan percuma · Tanpa kad kredit · Batalkan bila-bila masa',
    monthly1:'1 Bulan', monthly6:'6 Bulan', yearly:'1 Tahun', saveBadge:'Jimat sehingga 62%',
    perBulan:'/bulan', selectPlan:'Pilih Plan Ini', startTrial:'Mulakan Trial 30 Hari', mostPopular:'Paling Popular',
    features:'Apa Yang Anda Dapat', compare:'Perbandingan Penuh',
    saveVsMonthly:'Jimat',
    faqTitle:'Soalan Lazim',
    faq:[
      {q:'Apa berlaku selepas 30 hari percuma?', a:'Selepas trial, anda perlu bayar untuk teruskan guna. Kalau tak bayar, akaun akan deactivate tapi data anda kekal disimpan 90 hari.'},
      {q:'Kenapa 1 tahun lebih jimat?', a:'Bayar 1 tahun lebih murah ~62% berbanding bayar bulanan. Sesuai untuk yang dah biasa guna dan nak save more.'},
      {q:'Boleh tukar antara plan?', a:'Boleh. Anda boleh upgrade bila-bila masa. Bayaran prorated mengikut baki tempoh.'},
      {q:'Macam mana cara bayar?', a:'FPX (online banking semua bank Malaysia), kad kredit, atau bank transfer. Bayaran proses dalam masa 1 hari.'},
      {q:'Boleh cancel subscription?', a:'Ya, bila-bila masa. Anda akan terus guna sampai tempoh berakhir. Tiada caj tambahan.'},
    ],
    contact:'Soalan lain? Hubungi kami:'
  },
  EN: {
    title:'Choose Your Plan', sub:'30-day free trial · No credit card required · Cancel anytime',
    monthly1:'1 Month', monthly6:'6 Months', yearly:'1 Year', saveBadge:'Save up to 62%',
    perBulan:'/month', selectPlan:'Select This Plan', startTrial:'Start 30-Day Trial', mostPopular:'Most Popular',
    features:'What You Get', compare:'Full Comparison',
    saveVsMonthly:'Save',
    faqTitle:'FAQ',
    faq:[
      {q:'What happens after the 30-day trial?', a:'After trial, you need to pay to continue. If unpaid, account deactivates but your data is kept for 90 days.'},
      {q:'Why is 1 year a better deal?', a:'Paying yearly is ~62% cheaper than monthly. Best for users who plan to use long-term.'},
      {q:'Can I switch between plans?', a:'Yes. You can upgrade anytime. Payment is prorated based on remaining period.'},
      {q:'How do I pay?', a:'FPX (Malaysian online banking), credit card, or bank transfer. Payment processed within 1 day.'},
      {q:'Can I cancel my subscription?', a:'Yes, anytime. You\'ll continue using until the period ends. No cancellation fees.'},
    ],
    contact:'Other questions? Contact us:'
  }
};

// ═══ TUTORIAL TAB ═══════════════════════════════════════════════
const MODULES = [
  {id:'start', icon:'🚀', label:{BM:'Mula Cepat',EN:'Quick Start'}, col:'#FF3DBD'},
  {id:'setup', icon:'👥', label:{BM:'Setup Team',EN:'Team Setup'}, col:'#3B82F6'},
  {id:'record', icon:'🎯', label:{BM:'Recording',EN:'Recording'}, col:'#34D399'},
  {id:'stats', icon:'📊', label:{BM:'Statistik',EN:'Statistics'}, col:'#F59E0B'},
  {id:'account', icon:'☁️', label:{BM:'Akaun',EN:'Account'}, col:'#A855F7'},
];

const STEPS = {
  start:[
    {badge:'PENGENALAN', title:{BM:'Selamat Datang ke Handball Analysis!',EN:'Welcome to Handball Analysis!'},
     desc:{BM:'App ini direka untuk coach dan pengadil bola baling — rakam data match secara masa nyata, analisis statistik, dan simpan rekod perlawanan dalam cloud.',
           EN:'This app is designed for handball coaches and referees — record match data in real-time, analyze statistics, and store match records in the cloud.'},
     tip:{BM:'Berfungsi pada mobile dan desktop. Sesuai guna semasa game berlangsung.',EN:'Works on mobile and desktop. Ideal for use during live games.'},
     vis:'welcome'},
    {badge:'NAVIGASI', title:{BM:'7 Tab Utama',EN:'7 Main Tabs'},
     desc:{BM:'App dibahagi kepada 7 bahagian. Setiap tab ada fungsi tersendiri.',EN:'The app is divided into 7 sections. Each tab has its own function.'},
     vis:'tabs',
     cards:{BM:[['📺','Tutorial','Panduan ini'],['OVERVIEW','Overview','Skor & ringkasan'],['ATTACK','Attack Chart','Record game'],['STATS','Statistics','Data terperinci'],['PLAYERS','Players','Stat individu'],['HISTORY','History','Rekod lama'],['⚙️','Team Setup','Urus pasukan']],
            EN:[['📺','Tutorial','This guide'],['OVERVIEW','Overview','Score & summary'],['ATTACK','Attack Chart','Record game'],['STATS','Statistics','Detailed data'],['PLAYERS','Players','Individual stats'],['HISTORY','History','Past records'],['⚙️','Team Setup','Manage teams']]}},
    {badge:'FLOW HARIAN', title:{BM:'Aliran Kerja Coach',EN:'Coach Workflow'},
     desc:{BM:'Setup → Record → Analisis → Save. Ikut turutan ni setiap kali ada match.',EN:'Setup → Record → Analyze → Save. Follow this sequence for every match.'},
     vis:'flow',
     tip:{BM:'Data disimpan cloud automatik bila "End Match" — selamat walaupun telefon flat.',EN:'Data auto-saves to cloud when "End Match" — safe even if your phone dies.'}},
  ],
  setup:[
    {badge:'TEAM SETUP', title:{BM:'Buka Tab Team Setup',EN:'Open Team Setup Tab'},
     desc:{BM:'Pergi tab ⚙️ TEAM SETUP untuk urus semua pasukan dan pemain. Wajib setup sebelum mulakan match.',EN:'Go to ⚙️ TEAM SETUP tab to manage all teams and players. Must set up before starting a match.'},
     vis:'teamsetup'},
    {badge:'TEAM SETUP', title:{BM:'Tambah Team Baru',EN:'Add New Team'},
     desc:{BM:'Klik "＋ TAMBAH TEAM" untuk buat pasukan baru. Masukkan nama pasukan dan pilih warna team. Warna ini akan muncul dalam semua statistik dan laporan.',EN:'Click "+ ADD TEAM" to create a new team. Enter team name and choose team color. This color appears in all statistics and reports.'},
     vis:'addteam',
     tip:{BM:'Pilih warna yang kontras antara dua pasukan supaya mudah bezakan dalam chart.',EN:'Choose contrasting colors between teams for easy differentiation in charts.'}},
    {badge:'TEAM SETUP', title:{BM:'Tambah Pemain',EN:'Add Players'},
     desc:{BM:'Expand team → klik "＋ PEMAIN". Masukkan no jersi dan nama. Pemain ini akan muncul dalam senarai semasa recording untuk track siapa yang score.',EN:'Expand team → click "+ PLAYER". Enter jersey number and name. These players appear during recording to track who scores.'},
     vis:'addplayer'},
    {badge:'TEAM SETUP', title:{BM:'Tetapkan Pasukan Match',EN:'Set Match Teams'},
     desc:{BM:'Scroll ke bahagian "MATCH SEKARANG" — pilih Team A dan Team B. Ini menentukan pasukan mana yang bertanding dalam match semasa.',EN:'Scroll to "CURRENT MATCH" section — select Team A and Team B. This sets which teams are competing in the current match.'},
     vis:'setmatch',
     tip:{BM:'Boleh tukar pasukan sebelum mula sahaja — tak boleh tukar semasa match sedang berjalan.',EN:'Teams can only be changed before starting — cannot change during an active match.'}},
  ],
  record:[
    {badge:'RECORDING', title:{BM:'Wave System — Fasa Serangan',EN:'Wave System — Attack Phase'},
     desc:{BM:'Wave menentukan fasa serangan. Pilih wave yang betul sebelum record tembakan untuk analisis lebih tepat.',EN:'Wave determines the attack phase. Select the correct wave before recording shots for more precise analysis.'},
     vis:'wave',
     cards:{BM:[['1ST','Fastbreak','Selepas rampasan bola terus ke gol'],['2ND','Counter','Serangan balas peralihan'],['3RD','Set Play','Serangan tersusun half-court'],['ALL','Semua','Tak filter wave']],
            EN:[['1ST','Fastbreak','Directly to goal after stealing'],['2ND','Counter','Transitional counter-attack'],['3RD','Set Play','Organized half-court attack'],['ALL','All','No wave filter']]}},
    {badge:'RECORDING', title:{BM:'10 Zone Tembakan di Court',EN:'10 Shooting Zones on Court'},
     desc:{BM:'Court dibahagi 10 zone. Klik mana-mana zone untuk record tembakan dari posisi itu. App akan tanya: Goal, Miss, atau Save?',EN:'The court is divided into 10 zones. Click any zone to record a shot from that position. The app will ask: Goal, Miss, or Save?'},
     vis:'court',
     tip:{BM:'BREAK = pintu masuk. SEVEN = 7-meter throw (penalti). WING = hujung. BACK = belakang.',EN:'BREAK = breakthrough. SEVEN = 7-meter throw (penalty). WING = sides. BACK = back court.'}},
    {badge:'RECORDING', title:{BM:'Goal / Miss / Save',EN:'Goal / Miss / Save'},
     desc:{BM:'Selepas klik zone, pop-up muncul untuk pilih hasil tembakan. Pilih pemain (optional) dan assistant (optional) sebelum confirm.',EN:'After clicking a zone, a popup appears to select the shot result. Choose player (optional) and assistant (optional) before confirming.'},
     vis:'shotresult',
     cards:{BM:[['✅','GOAL','Bola masuk gol'],['❌','MISS','Tembak tapi meleset/terkena bar'],['🧤','SAVE','Penjaga gol sekat bola']],
            EN:[['✅','GOAL','Ball enters the goal'],['❌','MISS','Shot missed or hit the bar'],['🧤','SAVE','Goalkeeper blocked the ball']]}},
    {badge:'RECORDING', title:{BM:'Block dan Steal',EN:'Block and Steal'},
     desc:{BM:'Guna butang BLOCK atau STEAL untuk record aksi pertahanan. Pilih pasukan mana yang buat aksi — app akan auto-kira dalam statistik pertahanan.',EN:'Use BLOCK or STEAL buttons to record defensive actions. Select which team made the action — the app auto-calculates in defensive statistics.'},
     vis:'blocksteal',
     cards:{BM:[['🛡️','BLOCK','Pengadang sekat tembakan sebelum masuk gol'],['🤚','STEAL','Rampas bola dari tangan lawan']],
            EN:[['🛡️','BLOCK','Defender blocks shot before goal'],['🤚','STEAL','Takes ball away from opponent']]}},
    {badge:'RECORDING', title:{BM:'Turnover — Hilang Bola',EN:'Turnover — Ball Loss'},
     desc:{BM:'Klik TURNOVER bila pasukan hilang bola tanpa tembakan. Pilih jenis kehilangan untuk analisis kelemahan pasukan.',EN:'Click TURNOVER when a team loses the ball without a shot. Select the type of loss to analyze team weaknesses.'},
     vis:'turnover',
     cards:{BM:[['🎯','Bad Pass','Hantaran salah'],['👟','Off Foul','Foul ofensif'],['🚶','Traveling','Langkah'],['✌️','Double','Double dribble'],['⚠️','Technical','Kesalahan teknikal'],['📦','Other','Lain-lain']],
            EN:[['🎯','Bad Pass','Wrong pass'],['👟','Off Foul','Offensive foul'],['🚶','Traveling','Traveling violation'],['✌️','Double','Double dribble'],['⚠️','Technical','Technical error'],['📦','Other','Other']]}},
    {badge:'RECORDING', title:{BM:'Foul dan Kad Disiplin',EN:'Foul and Disciplinary Cards'},
     desc:{BM:'Klik FOUL → pilih pasukan → pilih pemain → pilih jenis kad. Semua kad akan muncul dalam bahagian statistik dan laporan match.',EN:'Click FOUL → select team → select player → select card type. All cards appear in statistics and match report.'},
     vis:'foul',
     cards:{BM:[['⚠️','Warning','Amaran (kuning kecil)'],['⏱️','2-Min','Hukuman 2 minit'],['🟨','Yellow','Kad kuning'],['🟥','Red','Kad merah, disingkir']],
            EN:[['⚠️','Warning','Warning card (small yellow)'],['⏱️','2-Min','2-minute suspension'],['🟨','Yellow','Yellow card'],['🟥','Red','Red card, ejected']]}},
    {badge:'RECORDING', title:{BM:'Match Clock',EN:'Match Clock'},
     desc:{BM:'Clock terletak dalam tab Attack Chart. Guna butang ini untuk kawalan masa perlawanan semasa recording.',EN:'Clock is located in the Attack Chart tab. Use these buttons to control match time during recording.'},
     vis:'clock',
     cards:{BM:[['▶','Play/Pause','Mula/Berhenti jam'],['↩','Reset','Tetap semula ke 0:00'],['⏭','Next Half','Tukar ke separuh masa seterusnya'],['✏️','Edit','Klik nombor jam untuk set masa manual']],
            EN:[['▶','Play/Pause','Start/stop the clock'],['↩','Reset','Reset back to 0:00'],['⏭','Next Half','Switch to next half'],['✏️','Edit','Click clock number to set manually']]}},
    {badge:'RECORDING', title:{BM:'Undo — Buat Balik',EN:'Undo — Reverse Action'},
     desc:{BM:'Tertekan salah? Klik ↶ UNDO untuk padam event terakhir. Hanya boleh undo satu step ke belakang.',EN:'Pressed the wrong thing? Click ↶ UNDO to delete the last event. Only one step back.'},
     vis:'undo',
     tip:{BM:'Undo hanya padam event terakhir. Kalau dah undo, tak boleh redo. Semak sebelum undo.',EN:'Undo only deletes the last event. Cannot redo after undo. Check before undoing.'}},
  ],
  stats:[
    {badge:'STATISTIK', title:{BM:'Overview — Ringkasan Match',EN:'Overview — Match Summary'},
     desc:{BM:'Tab OVERVIEW tunjuk skor semasa, bar perbandingan utama, top scorers, dan butang print laporan. Ini pandangan pantas untuk semak status match.',EN:'OVERVIEW tab shows current score, main comparison bars, top scorers, and print report button. Quick view to check match status.'},
     vis:'overview'},
    {badge:'FORMULA', title:{BM:'Shooting % — Peratusan Tembakan',EN:'Shooting % — Shot Percentage'},
     desc:{BM:'Menunjukkan keberkesanan tembakan pasukan — berapa peratus tembakan yang berjaya jadi gol.',EN:'Shows team shooting effectiveness — what percentage of shots successfully scored.'},
     vis:'formula_shoot',
     formula:'Shooting % = (Goals ÷ Total Shots) × 100',
     example:{BM:'Contoh: KEDAH 5 gol / 11 tembakan = 45%',EN:'Example: KEDAH 5 goals / 11 shots = 45%'}},
    {badge:'FORMULA', title:{BM:'Attack Efficiency — Kecekapan Serangan',EN:'Attack Efficiency — Attack Effectiveness'},
     desc:{BM:'Lebih komprehensif dari Shooting %. Kira semua serangan termasuk turnover — berapa kali pasukan habiskan peluang jadi gol.',EN:'More comprehensive than Shooting %. Counts all attacks including turnovers — how often a team converts possession to goals.'},
     vis:'formula_attack',
     formula:'Attack Eff = Goals ÷ (Shots + Turnovers) × 100',
     example:{BM:'Contoh: 5 gol / (11 shots + 3 TO) = 35%',EN:'Example: 5 goals / (11 shots + 3 TO) = 35%'}},
    {badge:'STATISTIK', title:{BM:'Player Stats — Statistik Individu',EN:'Player Stats — Individual Statistics'},
     desc:{BM:'Tab PLAYERS tunjuk sumbangan setiap pemain dalam match. Setiap kolumn bermaksud sesuatu yang spesifik.',EN:'PLAYERS tab shows each player\'s contribution in the match. Each column means something specific.'},
     vis:'playerstats',
     cards:{BM:[['G','Goals','Jumlah gol'],['A','Assists','Bantu gol rakan'],['Sh','Shots','Total tembakan'],['TO','Turnovers','Hilang bola'],['BL','Blocks','Sekat tembakan'],['ST','Steals','Rampas bola'],['2\'','2-Min','Hukuman 2 minit'],['YC','Yellow','Kad kuning'],['RC','Red','Kad merah']],
            EN:[['G','Goals','Total goals'],['A','Assists','Assisted teammate goals'],['Sh','Shots','Total shots'],['TO','Turnovers','Ball losses'],['BL','Blocks','Blocked shots'],['ST','Steals','Ball steals'],['2\'','2-Min','2-min suspension'],['YC','Yellow','Yellow cards'],['RC','Red','Red cards']]}},
    {badge:'HISTORY', title:{BM:'Postmortem — Analisis Match Lama',EN:'Postmortem — Past Match Analysis'},
     desc:{BM:'Pergi tab HISTORY → klik 📂 BUKA MATCH → semua tab (Statistics, Players, Overview) akan tunjuk data match lama. Boleh print laporan juga.',EN:'Go to HISTORY tab → click 📂 OPEN MATCH → all tabs (Statistics, Players, Overview) will show past match data. Can also print report.'},
     vis:'history',
     tip:{BM:'Bila dalam Viewing Mode, banner ungu muncul atas. Klik ✕ EXIT VIEW untuk keluar.',EN:'When in Viewing Mode, a purple banner appears at top. Click ✕ EXIT VIEW to exit.'}},
    {badge:'LAPORAN', title:{BM:'Print Match Report',EN:'Print Match Report'},
     desc:{BM:'Pergi OVERVIEW → klik 🖨️ PRINT MATCH REPORT. Browser akan buka print dialog. Laporan A4 merangkumi: skor, perbandingan utama, analisis serangan, separuh masa, kad disiplin, dan statistik pemain.',EN:'Go to OVERVIEW → click 🖨️ PRINT MATCH REPORT. Browser opens print dialog. A4 report includes: score, main comparison, attack analysis, halftime, discipline, and player stats.'},
     vis:'printreport'},
  ],
  account:[
    {badge:'AKAUN', title:{BM:'Trial 30 Hari Percuma',EN:'30-Day Free Trial'},
     desc:{BM:'Setiap akaun baru dapat trial 30 hari — akses PENUH semua features. Tiada kad kredit diperlukan. Countdown hari trial muncul di atas app.',EN:'Every new account gets 30-day trial — FULL access to all features. No credit card required. Trial countdown appears at the top of the app.'},
     vis:'trial',
     tip:{BM:'Bila tinggal 7 hari, banner akan jadi MERAH sebagai amaran. Pergi tab PRICING untuk upgrade.',EN:'When 7 days remain, the banner turns RED as a warning. Go to PRICING tab to upgrade.'}},
    {badge:'CLOUD', title:{BM:'Cloud Sync — Data Selamat',EN:'Cloud Sync — Safe Data'},
     desc:{BM:'Setiap kali awak "End Match", data auto-save ke cloud. Indicator ☁️ SAVING akan muncul atas. Bila ✓ SAVED muncul — data selamat dalam server.',EN:'Every time you "End Match", data auto-saves to cloud. ☁️ SAVING indicator appears at top. When ✓ SAVED appears — data is safe on server.'},
     vis:'cloudsync',
     tip:{BM:'Login dari mana-mana device — semua match history akan load dari cloud automatik.',EN:'Login from any device — all match history will load from cloud automatically.'}},
    {badge:'AKAUN', title:{BM:'Lupa Password?',EN:'Forgot Password?'},
     desc:{BM:'Skrin login ada butang "Lupa password?". Masukkan email → check inbox → klik link reset → set password baru. Link hanya valid 1 jam.',EN:'Login screen has "Forgot password?" button. Enter email → check inbox → click reset link → set new password. Link valid for 1 hour only.'},
     vis:'resetpwd',
     tip:{BM:'Mesti guna link dari email TERBARU sahaja. Link lama tak boleh guna semula.',EN:'Must use link from the LATEST email only. Old links cannot be reused.'}},
    {badge:'AKAUN', title:{BM:'Log Out & Tukar Akaun',EN:'Log Out & Switch Account'},
     desc:{BM:'Pergi tab 💎 PRICING → scroll ke atas → ada card akaun dengan butang LOG OUT. Klik untuk keluar dari akaun semasa.',EN:'Go to 💎 PRICING tab → scroll to top → account card with LOG OUT button. Click to sign out of current account.'},
     vis:'logout'},
  ],
};

function TutorialVisual({type}) {
  const vs = { width:'100%', height:150, viewBox:'0 0 320 150' };
  const bg = { fill:'rgba(0,0,0,0.25)', rx:10 };
  switch(type) {
    case 'welcome': return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.2)"/>
      <circle cx={160} cy={60} r={38} fill="rgba(255,61,189,0.12)" stroke="rgba(255,61,189,0.3)" strokeWidth={2}/>
      <text x={160} y={67} textAnchor="middle" fill="#FF93D7" fontSize={32}>🤾</text>
      <text x={160} y={105} textAnchor="middle" fill="white" fontSize={13} fontWeight={600}>HANDBALL ANALYSIS</text>
      <text x={160} y={123} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={10}>Rakam · Analisis · Simpan</text>
    </svg>;
    case 'tabs': return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.2)"/>
      {[['📺',20],['OV',62],['AT',104],['ST',146],['PL',188],['HI',230],['⚙️',272]].map(([l,x],i)=>
        <g key={i}><rect x={x} y={55} width={38} height={38} rx={6} fill={i===0?'rgba(255,61,189,0.25)':'rgba(255,255,255,0.05)'} stroke={i===0?'rgba(255,61,189,0.5)':'rgba(255,255,255,0.08)'} strokeWidth={1}/>
        <text x={x+19} y={79} textAnchor="middle" fill={i===0?'#FF93D7':'rgba(255,255,255,0.6)'} fontSize={i<2?14:9} fontWeight={600}>{l}</text></g>)}
      <text x={160} y={125} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9}>7 tab utama — pilih fungsi yang diperlukan</text>
    </svg>;
    case 'flow': return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.2)"/>
      {[['⚙️ Setup',30,'#3B82F6'],['🎯 Record',110,'#FF3DBD'],['📊 Analisis',190,'#34D399'],['💾 Save',270,'#F59E0B']].map(([l,x,c],i)=><g key={i}>
        <rect x={x-28} y={55} width={56} height={36} rx={7} fill={`${c}22`} stroke={c} strokeWidth={1}/>
        <text x={x} y={78} textAnchor="middle" fill={c} fontSize={9} fontWeight={600}>{l}</text>
        {i<3&&<text x={x+37} y={76} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={14}>›</text>}
      </g>)}
      <text x={160} y={120} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9}>Turutan setiap match</text>
    </svg>;
    case 'court': return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.25)"/>
      {[['WING L',55,45,'#FF3DBD'],['BREAK',160,38,'#34D399'],['WING R',265,45,'#FF3DBD'],
        ['PIV L',90,85,'#FF93D7'],['PIV C',160,78,'#FF93D7'],['PIV R',230,85,'#FF93D7'],
        ['7M',160,112,'#FBBF24'],
        ['BACK L',70,128,'#A855F7'],['BACK C',160,128,'#A855F7'],['BACK R',250,128,'#A855F7']].map(([l,x,y,c],i)=>
        <g key={i}><circle cx={x} cy={y} r={l==='7M'?8:20} fill={`${c}20`} stroke={c} strokeWidth={1.5}/>
        <text x={x} y={y+3} textAnchor="middle" fill={c} fontSize={l==='7M'?7:7} fontWeight={700}>{l}</text></g>)}
      <text x={160} y={18} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10} fontWeight={600}>10 ZONE TEMBAKAN</text>
    </svg>;
    case 'wave': return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.2)"/>
      {[['ALL',30,'#888'],['1ST',100,'#FF3DBD'],['2ND',185,'#3B82F6'],['3RD',260,'#34D399']].map(([l,x,c])=>
        <g key={l}><rect x={x-30} y={50} width={60} height={50} rx={8} fill={`${c}22`} stroke={c} strokeWidth={1.5}/>
        <text x={x} y={80} textAnchor="middle" fill={c} fontSize={14} fontWeight={800}>{l}</text></g>)}
      <text x={100} y={122} textAnchor="middle" fill="rgba(255,61,189,0.8)" fontSize={8}>Fastbreak</text>
      <text x={185} y={122} textAnchor="middle" fill="rgba(59,130,246,0.8)" fontSize={8}>Counter</text>
      <text x={260} y={122} textAnchor="middle" fill="rgba(52,211,153,0.8)" fontSize={8}>Set Play</text>
    </svg>;
    case 'shotresult': return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.2)"/>
      {[['✅ GOAL',60,'#34D399'],['❌ MISS',160,'#EF4444'],['🧤 SAVE',260,'#3B82F6']].map(([l,x,c])=>
        <g key={l}><rect x={x-45} y={50} width={90} height={48} rx={9} fill={`${c}18`} stroke={c} strokeWidth={2}/>
        <text x={x} y={80} textAnchor="middle" fill={c} fontSize={11} fontWeight={700}>{l}</text></g>)}
      <text x={160} y={125} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9}>Pilih selepas klik zone di court</text>
    </svg>;
    case 'formula_shoot': return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.2)"/>
      <rect x={20} y={35} width={280} height={48} rx={8} fill="rgba(255,61,189,0.08)" stroke="rgba(255,61,189,0.25)" strokeWidth={1}/>
      <text x={160} y={65} textAnchor="middle" fill="#FF93D7" fontSize={13} fontWeight={600}>Shooting % = Goals ÷ Shots × 100</text>
      <rect x={60} y={100} width={90} height={36} rx={7} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth={1}/>
      <text x={105} y={121} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10}>5 ÷ 11 × 100</text>
      <text x={195} y={105} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={18}>＝</text>
      <rect x={220} y={100} width={60} height={36} rx={7} fill="rgba(52,211,153,0.1)" stroke="rgba(52,211,153,0.3)" strokeWidth={1}/>
      <text x={250} y={121} textAnchor="middle" fill="#34D399" fontSize={14} fontWeight={700}>45%</text>
    </svg>;
    case 'formula_attack': return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.2)"/>
      <rect x={10} y={35} width={300} height={48} rx={8} fill="rgba(245,158,11,0.08)" stroke="rgba(245,158,11,0.25)" strokeWidth={1}/>
      <text x={160} y={58} textAnchor="middle" fill="#F59E0B" fontSize={11} fontWeight={600}>Attack Eff = Goals ÷ (Shots + TO) × 100</text>
      <text x={160} y={75} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9}>Termasuk turnover — lebih komprehensif</text>
      <text x={160} y={118} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10}>5 ÷ (11 + 3) × 100 = <tspan fill="#34D399" fontWeight={700}>35%</tspan></text>
    </svg>;
    case 'foul': return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.2)"/>
      {[['⚠️ Warning',60,'#888888'],['⏱️ 2-Min',160,'#F59E0B'],['🟨 Yellow',220,'#EAB308'],['🟥 Red',275,'#EF4444']].map(([l,x,c])=>
        <g key={l}><rect x={x-32} y={50} width={64} height={42} rx={7} fill={`${c}18`} stroke={c} strokeWidth={1.5}/>
        <text x={x} y={75} textAnchor="middle" fill={c} fontSize={9} fontWeight={600}>{l}</text></g>)}
    </svg>;
    default: return <svg {...vs}><rect x={0} y={0} width={320} height={150} rx={10} fill="rgba(0,0,0,0.2)"/>
      <text x={160} y={80} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={12}>Visual</text></svg>;
  }
}

function TutorialTab() {
  const [lang, setLang] = useState('BM');
  const [mod, setMod] = useState('start');
  const [step, setStep] = useState(0);
  const [done, setDone] = useState({});

  const steps = STEPS[mod];
  const cur = steps[step];
  const total = steps.length;
  const modInfo = MODULES.find(m=>m.id===mod);

  const goStep = (n)=>{
    const s = Math.max(0, Math.min(total-1, n));
    setStep(s);
    if(s===total-1) setDone(d=>({...d,[mod]:true}));
  };

  const switchMod = (id)=>{ setMod(id); setStep(0); };

  return <div className="sc" style={{overflowY:'auto',padding:'16px',maxWidth:700,margin:'0 auto'}}>
    {/* Header */}
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
      <div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.4)',letterSpacing:'0.18em'}}>📺 PANDUAN INTERAKTIF</div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:'white',marginTop:2}}>Cara Guna Aplikasi</div>
      </div>
      <div style={{display:'flex',gap:3,background:'rgba(255,255,255,0.04)',borderRadius:8,padding:3}}>
        {['BM','EN'].map(l=><button key={l} onClick={()=>setLang(l)}
          style={{padding:'5px 12px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,letterSpacing:'0.1em',
            background:lang===l?'rgba(255,61,189,0.18)':'transparent',color:lang===l?'#FF93D7':'rgba(255,255,255,0.4)'}}>{l}</button>)}
      </div>
    </div>

    {/* Module selector */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:14}}>
      {MODULES.map(m=><button key={m.id} onClick={()=>switchMod(m.id)}
        style={{background:mod===m.id?`${m.col}22`:'rgba(255,255,255,0.03)',border:`1px solid ${mod===m.id?m.col+'55':'rgba(255,255,255,0.07)'}`,
          borderRadius:10,padding:'8px 4px',cursor:'pointer',position:'relative'}}>
        <div style={{fontSize:16,marginBottom:2}}>{m.icon}</div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:9,color:mod===m.id?m.col:'rgba(255,255,255,0.5)',letterSpacing:'0.05em'}}>{m.label[lang]}</div>
        <div style={{fontFamily:'Barlow',fontSize:8,color:'rgba(255,255,255,0.3)',marginTop:1}}>{STEPS[m.id].length} steps</div>
        {done[m.id]&&<div style={{position:'absolute',top:4,right:5,fontSize:8,color:'#34D399'}}>✓</div>}
      </button>)}
    </div>

    {/* Step card */}
    <div style={{background:`linear-gradient(135deg, ${modInfo.col}08, rgba(155,43,251,0.05))`,
      border:`1px solid ${modInfo.col}30`,borderRadius:14,overflow:'hidden'}}>
      
      {/* Visual */}
      <div style={{background:'rgba(0,0,0,0.25)',padding:'16px'}}>
        <TutorialVisual type={cur.vis}/>
      </div>

      {/* Content */}
      <div style={{padding:'16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{background:`${modInfo.col}30`,color:modInfo.col,padding:'3px 8px',borderRadius:5,fontFamily:'Barlow Condensed',fontWeight:800,fontSize:9,letterSpacing:'0.12em'}}>{cur.badge}</span>
          <span style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)'}}>Step {step+1} / {total}</span>
        </div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,color:'white',marginBottom:8,lineHeight:1.2}}>{cur.title[lang]}</div>
        <div style={{fontFamily:'Barlow',fontSize:13,color:'rgba(255,255,255,0.7)',lineHeight:1.6,marginBottom:cur.formula||cur.cards||cur.tip?12:0}}>{cur.desc[lang]}</div>

        {cur.formula&&<div style={{background:'rgba(0,0,0,0.3)',border:`1px solid ${modInfo.col}40`,borderRadius:8,padding:'10px 12px',fontFamily:'ui-monospace,monospace',fontSize:12,color:modInfo.col,marginBottom:8}}>{cur.formula}</div>}
        {cur.example&&<div style={{background:'rgba(52,211,153,0.06)',border:'0.5px solid rgba(52,211,153,0.2)',borderRadius:8,padding:'8px 12px',fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.7)',marginBottom:8}}>💡 {cur.example[lang]}</div>}

        {cur.cards&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:6,marginBottom:8}}>
          {cur.cards[lang].map(([ico,lbl,desc],i)=><div key={i} style={{background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'8px 10px'}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,color:'white',marginBottom:2}}>{ico} {lbl}</div>
            <div style={{fontFamily:'Barlow',fontSize:10,color:'rgba(255,255,255,0.5)',lineHeight:1.4}}>{desc}</div>
          </div>)}
        </div>}

        {cur.tip&&<div style={{background:'rgba(52,211,153,0.06)',border:'0.5px solid rgba(52,211,153,0.2)',borderRadius:8,padding:'10px 12px',display:'flex',gap:8,marginBottom:12}}>
          <span style={{fontSize:14,color:'#34D399'}}>💡</span>
          <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.7)',lineHeight:1.5,flex:1}}>{cur.tip[lang]}</div>
        </div>}

        {/* Progress dots */}
        <div style={{display:'flex',gap:4,justifyContent:'center',marginBottom:12}}>
          {steps.map((_,i)=><div key={i} onClick={()=>goStep(i)} style={{cursor:'pointer',
            width:i===step?20:6,height:6,borderRadius:3,transition:'all 0.2s',
            background:i===step?modInfo.col:i<step?`${modInfo.col}60`:'rgba(255,255,255,0.1)'}}/>)}
        </div>

        {/* Nav buttons */}
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>goStep(step-1)} disabled={step===0}
            style={{flex:1,padding:'10px',borderRadius:9,border:'0.5px solid rgba(255,255,255,0.1)',cursor:step===0?'not-allowed':'pointer',
              background:'rgba(255,255,255,0.04)',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11,color:'rgba(255,255,255,0.6)',letterSpacing:'0.08em',opacity:step===0?0.4:1}}>
            ◀ {lang==='BM'?'SEBELUM':'PREV'}
          </button>
          {step<total-1
            ? <button onClick={()=>goStep(step+1)} style={{flex:2,padding:'10px',borderRadius:9,border:'none',cursor:'pointer',
                background:`linear-gradient(90deg,${modInfo.col},#9B2BFB)`,fontFamily:'Barlow Condensed',fontWeight:900,
                fontSize:11,color:'white',letterSpacing:'0.08em',boxShadow:`0 2px 10px ${modInfo.col}40`}}>
                {lang==='BM'?'SETERUSNYA':'NEXT'} ▶
              </button>
            : <button onClick={()=>{setDone(d=>({...d,[mod]:true})); const next=MODULES.findIndex(m=>m.id===mod)+1; if(next<MODULES.length)switchMod(MODULES[next].id);}}
                style={{flex:2,padding:'10px',borderRadius:9,border:'none',cursor:'pointer',
                  background:'linear-gradient(90deg,#34D399,#059669)',fontFamily:'Barlow Condensed',fontWeight:900,
                  fontSize:11,color:'white',letterSpacing:'0.08em',boxShadow:'0 2px 10px rgba(52,211,153,0.4)'}}>
                {lang==='BM'?'✓ MODUL SELESAI':'✓ MODULE DONE'}
              </button>}
        </div>
      </div>
    </div>

    {/* Progress summary */}
    <div style={{marginTop:12,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'rgba(255,255,255,0.02)',border:'0.5px solid rgba(255,255,255,0.06)',borderRadius:10}}>
      <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.5)'}}>
        {Object.keys(done).length}/{MODULES.length} {lang==='BM'?'modul selesai':'modules done'}
      </div>
      <div style={{display:'flex',gap:6}}>
        {MODULES.map(m=><div key={m.id} style={{width:8,height:8,borderRadius:'50%',background:done[m.id]?m.col:'rgba(255,255,255,0.1)'}}/>)}
      </div>
    </div>
  </div>;
}

function ActiveDevicesSection({user, subscription, lang}) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentToken = getDeviceToken();
  const limit = getDeviceLimit(subscription);

  const loadDevices = async ()=>{
    setLoading(true);
    const list = await getActiveDevices(user.id);
    setDevices(list);
    setLoading(false);
  };

  useEffect(()=>{ loadDevices(); },[user?.id]);

  const handleLogoutDevice = async (deviceId, isCurrent)=>{
    if (!window.confirm(isCurrent
      ? (lang==='BM'?'Logout dari device ini?':'Logout from this device?')
      : (lang==='BM'?'Logout device ini?':'Logout this device?'))) return;
    await logoutDevice(deviceId);
    if (isCurrent) {
      await supabase.auth.signOut();
    } else {
      loadDevices();
    }
  };

  const formatTime = (iso)=>{
    if (!iso) return '-';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang==='BM'?'Baru sekejap':'Just now';
    if (mins < 60) return `${mins} ${lang==='BM'?'minit lalu':'min ago'}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ${lang==='BM'?'jam lalu':'h ago'}`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} ${lang==='BM'?'hari lalu':'days ago'}`;
    return d.toLocaleDateString();
  };

  return (
    <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:12,padding:'12px 14px',marginBottom:20}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:6}}>
        <div>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:'0.18em'}}>📱 {lang==='BM'?'DEVICE AKTIF':'ACTIVE DEVICES'}</div>
          <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>
            {devices.length}/{limit} {lang==='BM'?'device dibenarkan':'devices allowed'}
          </div>
        </div>
        <button onClick={loadDevices}
          style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,
            padding:'4px 10px',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:10,
            color:'rgba(255,255,255,0.5)',letterSpacing:'0.1em',cursor:'pointer'}}>
          ↻ {lang==='BM'?'REFRESH':'REFRESH'}
        </button>
      </div>

      {loading
        ? <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'10px'}}>{lang==='BM'?'Memuatkan...':'Loading...'}</div>
        : devices.length===0
          ? <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'10px'}}>{lang==='BM'?'Tiada device lain':'No other devices'}</div>
          : <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {devices.map(d=>{
                const isCurrent = d.device_token === currentToken;
                return <div key={d.id} style={{display:'flex',alignItems:'center',gap:10,
                  background:isCurrent?'rgba(52,211,153,0.05)':'rgba(255,255,255,0.02)',
                  border:`1px solid ${isCurrent?'rgba(52,211,153,0.2)':'rgba(255,255,255,0.05)'}`,
                  borderRadius:8,padding:'8px 10px',flexWrap:'wrap'}}>
                  <div style={{fontSize:16,width:24,textAlign:'center'}}>
                    {d.device_label?.includes('iPhone')||d.device_label?.includes('Android')?'📱':'💻'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                      <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'white'}}>{d.device_label||'Unknown'}</span>
                      {isCurrent&&<span style={{background:'rgba(52,211,153,0.15)',color:'#34D399',padding:'1px 6px',borderRadius:4,fontFamily:'Barlow Condensed',fontWeight:700,fontSize:9,letterSpacing:'0.1em'}}>{lang==='BM'?'INI':'THIS'}</span>}
                    </div>
                    <div style={{fontFamily:'Barlow',fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:1}}>
                      {lang==='BM'?'Aktif':'Active'}: {formatTime(d.last_seen_at)}
                    </div>
                  </div>
                  <button onClick={()=>handleLogoutDevice(d.id, isCurrent)}
                    style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:6,
                      padding:'5px 10px',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:10,
                      color:'rgba(252,129,129,0.8)',letterSpacing:'0.1em',cursor:'pointer'}}>
                    {lang==='BM'?'LOGOUT':'LOGOUT'}
                  </button>
                </div>;
              })}
            </div>
      }
    </div>
  );
}

function PricingTab({onSelectPlan, user, subscription, onLogout}) {
  const [lang, setLang] = useState('BM');
  const [period, setPeriod] = useState('p12'); // 'p1' | 'p6' | 'p12'
  const [expandFaq, setExpandFaq] = useState(null);
  const mobile = useIsMobile();
  const t = PRICING_TXT[lang];

  const planCard = (key, plan)=>{
    const price = plan[period];
    const months = period==='p1'?1:period==='p6'?6:12;
    const perMonth = (price/months).toFixed(2);
    // Saving vs monthly rate × months
    const fullPrice = plan.p1 * months;
    const saving = fullPrice - price;
    const savePct = months>1 ? Math.round((saving/fullPrice)*100) : 0;
    return (
      <div key={key} style={{background:'rgba(255,255,255,0.03)',
        border:plan.popular?`2px solid ${plan.color}`:'1px solid rgba(255,255,255,0.07)',
        borderRadius:14,padding:'20px 18px',position:'relative',display:'flex',flexDirection:'column',gap:14}}>
        {plan.popular&&<div style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',
          background:plan.color,padding:'3px 14px',borderRadius:6,fontFamily:'Barlow Condensed',
          fontWeight:900,fontSize:10,color:'white',letterSpacing:'0.15em',whiteSpace:'nowrap'}}>{t.mostPopular.toUpperCase()}</div>}

        <div>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:22,color:'white'}}>{plan.name[lang]}</div>
          <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.45)',marginTop:2}}>{plan.sub[lang]}</div>
        </div>

        <div>
          <div style={{display:'flex',alignItems:'baseline',gap:5}}>
            <span style={{fontFamily:'Barlow',fontSize:14,color:'rgba(255,255,255,0.5)'}}>RM</span>
            <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:40,color:'white',lineHeight:1}}>{price}</span>
            <span style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.4)'}}>/{period==='p1'?'bln':period==='p6'?'6 bln':'tahun'}</span>
          </div>
          <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:3}}>≈ RM {perMonth}{t.perBulan}</div>
          {savePct>0&&<div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'#34D399',
            background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.25)',
            borderRadius:6,padding:'3px 8px',marginTop:6,display:'inline-block',letterSpacing:'0.05em'}}>
            {t.saveVsMonthly} {savePct}% (RM {saving})
          </div>}
        </div>

        <div style={{background:plan.color+'15',border:`1px solid ${plan.color}40`,borderRadius:8,padding:'7px 10px',display:'flex',alignItems:'center',gap:7}}>
          <span style={{fontSize:14}}>📱</span>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,color:plan.color,letterSpacing:'0.05em'}}>
            {plan.devices} {lang==='BM'?'peranti aktif serentak':'devices active'}
          </span>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:7,flex:1}}>
          {PRICING_FEATURES[lang].slice(0,6).map(f=>{
            const v = f[key==='individual'?'ind':key];
            const has = v===true || (typeof v==='string');
            return <div key={f.key} style={{display:'flex',alignItems:'flex-start',gap:7}}>
              <span style={{color:has?'#34D399':'rgba(255,255,255,0.2)',fontSize:14,lineHeight:1.2,flexShrink:0}}>{has?'✓':'✗'}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Barlow',fontSize:12,color:has?'rgba(255,255,255,0.7)':'rgba(255,255,255,0.3)',lineHeight:1.35}}>{f.label}</div>
                {typeof v==='string'&&<div style={{fontFamily:'Barlow',fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:1}}>{v}</div>}
              </div>
            </div>;
          })}
        </div>

        {/* Context-aware button based on subscription status */}
        {(() => {
          const status = subscription?.status;
          const userPlan = subscription?.plan;
          const inTrial = status === 'trial';
          const isMyPlan = status === 'active' && userPlan === key;
          
          let btnText, btnDisabled = false, btnAction = ()=>onSelectPlan&&onSelectPlan({plan:key, period, price});
          let btnBg = plan.popular?plan.color:'rgba(255,255,255,0.07)';
          
          if (!user) {
            btnText = t.startTrial.toUpperCase();
          } else if (isMyPlan) {
            btnText = (lang==='BM'?'✓ Plan Anda Sekarang':'✓ Your Current Plan').toUpperCase();
            btnDisabled = true;
            btnBg = 'rgba(52,211,153,0.15)';
          } else if (inTrial) {
            const days = subscription?.trial_ends_at ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now())/86400000)) : 0;
            btnText = (lang==='BM'?`SEDANG TRIAL (${days} HARI LAGI)`:`TRIAL ACTIVE (${days} DAYS LEFT)`);
            btnBg = 'rgba(168,85,247,0.15)';
            btnDisabled = false;
            // still allow upgrade to plan during trial (will be paid plan after)
          } else {
            btnText = t.selectPlan.toUpperCase();
          }
          
          return <button className="btn" disabled={btnDisabled} onClick={btnDisabled?undefined:btnAction}
            style={{background:btnBg,
              border:plan.popular&&!btnDisabled?'none':`1px solid ${plan.color}80`,
              borderRadius:10,padding:'11px',fontFamily:'Barlow Condensed',fontWeight:900,
              fontSize:13,color:'white',letterSpacing:'0.1em',marginTop:'auto',
              boxShadow:plan.popular&&!btnDisabled?`0 4px 16px ${plan.color}40`:'none',
              cursor:btnDisabled?'default':'pointer',opacity:btnDisabled?0.85:1}}>
            {btnText}
          </button>;
        })()}
      </div>
    );
  };

  return (
    <div className="sc" style={{overflowY:'auto',overflowX:'hidden',padding:'20px 16px',
      maxWidth:980,margin:'0 auto',width:'100%',minWidth:0,boxSizing:'border-box'}}>
      {/* Account info card */}
      {user&&<div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:12,padding:'12px 14px',marginBottom:20,display:'flex',alignItems:'center',
        justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flex:1}}>
          <div style={{flexShrink:0,width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#FF3DBD,#9B2BFB)',
            display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Barlow Condensed',fontWeight:900,fontSize:15,color:'white'}}>
            {(user.email||'?').charAt(0).toUpperCase()}
          </div>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:'white',
              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>
            <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>
              {subscription?.status==='trial'
                ? `Trial · ${daysRemaining(subscription)} hari lagi`
                : subscription?.status==='active'
                  ? `${subscription.plan} · sehingga ${new Date(subscription.paid_until).toLocaleDateString('en-MY')}`
                  : 'Plan: trial'}
            </div>
          </div>
        </div>
        {onLogout&&<button onClick={onLogout}
          style={{flexShrink:0,background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:8,
            padding:'7px 14px',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11,
            color:'rgba(252,129,129,0.8)',letterSpacing:'0.1em',cursor:'pointer'}}>
          LOG OUT
        </button>}
      </div>}

      {/* Active Devices section */}
      {user&&<ActiveDevicesSection user={user} subscription={subscription} lang={lang}/>}

      {/* Header with language toggle */}
      <div style={{textAlign:'center',marginBottom:20,position:'relative'}}>
        {/* Lang toggle (top right) */}
        <div style={{position:'absolute',right:0,top:0,display:'flex',gap:4,background:'rgba(255,255,255,0.05)',padding:3,borderRadius:8}}>
          {['BM','EN'].map(l=><button key={l} className="btn" onClick={()=>setLang(l)}
            style={{background:lang===l?'rgba(255,255,255,0.15)':'transparent',
              border:'none',borderRadius:6,padding:'4px 10px',
              fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,
              color:lang===l?'white':'rgba(255,255,255,0.4)'}}>{l}</button>)}
        </div>

        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:32,color:'white',letterSpacing:'0.02em'}}>{t.title}</div>
        <div style={{fontFamily:'Barlow',fontSize:13,color:'rgba(255,255,255,0.5)',marginTop:6,maxWidth:500,margin:'6px auto 0'}}>{t.sub}</div>
      </div>

      {/* Billing period selector (3 options) */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        <div style={{display:'flex',background:'rgba(255,255,255,0.04)',borderRadius:10,padding:3,border:'1px solid rgba(255,255,255,0.06)'}}>
          {[['p1',t.monthly1],['p6',t.monthly6],['p12',t.yearly]].map(([id,lbl])=>{
            const active = period===id;
            return <button key={id} onClick={()=>setPeriod(id)}
              style={{padding:'8px 16px',borderRadius:7,border:'none',cursor:'pointer',
                background:active?'rgba(255,61,189,0.18)':'transparent',
                fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,letterSpacing:'0.1em',
                color:active?'#FF93D7':'rgba(255,255,255,0.5)',transition:'all 0.15s',whiteSpace:'nowrap'}}>
              {lbl}
              {id==='p12'&&<span style={{marginLeft:6,fontSize:9,background:'rgba(52,211,153,0.2)',color:'#34D399',padding:'1px 5px',borderRadius:4}}>BEST</span>}
            </button>;
          })}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'repeat(3, 1fr)',gap:14,marginBottom:30}}>
        {planCard('individual', PRICING_DATA.individual)}
        {planCard('team', PRICING_DATA.team)}
        {planCard('club', PRICING_DATA.club)}
      </div>

      {/* Full comparison table */}
      <div style={{marginTop:30,marginBottom:30}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:'white',marginBottom:14,textAlign:'center'}}>{t.compare}</div>
        <div style={{background:'rgba(255,255,255,0.02)',borderRadius:12,padding:'4px',border:'1px solid rgba(255,255,255,0.06)',overflowX:'auto'}}>
          <table className="tbl" style={{width:'100%'}}>
            <thead><tr>
              <th style={{textAlign:'left',paddingLeft:14,padding:'12px',minWidth:180}}>{lang==='BM'?'Feature':'Feature'}</th>
              {Object.entries(PRICING_DATA).map(([k,p])=>
                <th key={k} style={{padding:'12px',color:p.color,minWidth:90}}>{p.name[lang]}</th>
              )}
            </tr></thead>
            <tbody>
              {PRICING_FEATURES[lang].map((f,i)=>
                <tr key={f.key} style={{background:i%2?'rgba(255,255,255,0.02)':'transparent'}}>
                  <td style={{textAlign:'left',paddingLeft:14,padding:'10px 14px',fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.7)'}}>{f.label}</td>
                  {[['ind',PRICING_DATA.individual.color],['team',PRICING_DATA.team.color],['club',PRICING_DATA.club.color]].map(([k,col])=>{
                    const v = f[k];
                    return <td key={k} style={{padding:'10px',textAlign:'center'}}>
                      {v===true ? <span style={{color:'#34D399',fontSize:16,fontWeight:900}}>✓</span>
                       : v===false ? <span style={{color:'rgba(255,255,255,0.2)',fontSize:14}}>—</span>
                       : <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11,color:col}}>{v}</span>}
                    </td>;
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div style={{marginBottom:30}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:'white',marginBottom:14,textAlign:'center'}}>{t.faqTitle}</div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {t.faq.map((f,i)=><div key={i} style={{background:'rgba(255,255,255,0.03)',borderRadius:10,border:'1px solid rgba(255,255,255,0.06)',overflow:'hidden'}}>
            <div onClick={()=>setExpandFaq(expandFaq===i?null:i)} style={{padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}}>
              <span style={{fontFamily:'Barlow',fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.85)'}}>{f.q}</span>
              <span style={{fontFamily:'Barlow Condensed',fontSize:18,color:'rgba(255,255,255,0.4)',marginLeft:10}}>{expandFaq===i?'−':'+'}</span>
            </div>
            {expandFaq===i&&<div style={{padding:'0 16px 14px',fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.55)',lineHeight:1.6,borderTop:'1px solid rgba(255,255,255,0.04)',paddingTop:10}}>{f.a}</div>}
          </div>)}
        </div>
      </div>

      {/* Footer */}
      <div style={{textAlign:'center',padding:'20px 0',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:10}}>{t.contact}</div>
        <div style={{display:'flex',justifyContent:'center',gap:14,flexWrap:'wrap'}}>
          <a href="mailto:support@handballapp.my" style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'#FF93D7',textDecoration:'none',letterSpacing:'0.05em'}}>📧 support@handballapp.my</a>
          <a href="https://wa.me/60123456789" style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'#34D399',textDecoration:'none',letterSpacing:'0.05em'}}>💬 WhatsApp</a>
        </div>
        <div style={{marginTop:14,display:'flex',justifyContent:'center',gap:10,opacity:0.6}}>
          {['FPX','VISA','MASTER'].map(b=><div key={b} style={{background:'rgba(255,255,255,0.06)',padding:'4px 10px',borderRadius:5,fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.6)',letterSpacing:'0.1em'}}>{b}</div>)}
        </div>
      </div>
    </div>
  );
}

// ═══ HISTORY TAB ══════════════════════════════════════════════
function HistoryTab({events, teamA, teamB, matchHistory, dispatch, onViewMatch}) {
  const [expandId, setExpandId] = useState(null);
  const waveColor = w=>WAVES.find(x=>x.id===w)?.color||'rgba(255,255,255,0.1)';
  const waveLabel = w=>WAVES.find(x=>x.id===w)?.label||'';

  const renderEvent = (e, idx, tA, tB)=>{
    const team = e.team==='A' ? tA : tB;
    const player = e.pid ? team.players.find(p=>p.id===e.pid) : null;
    const z = ZONES.find(zn=>zn.id===e.zone);
    const fouln = e.kind==='FOUL' ? FOUL_TYPES.find(f=>f.id===e.severity) : null;
    const ton = e.kind==='TO' ? TO_TYPES.find(tt=>tt.id===e.toType) : null;
    let label, color;
    if (e.kind==='FOUL') { label = fouln?.label||'Foul'; color = fouln?.color||'#FBBF24'; }
    else if (e.kind==='TO') { label = 'Turnover'+(ton?' — '+ton.label:''); color = '#D97706'; }
    else if (e.kind==='BLOCK') { label = 'BLOCK'; color = '#3B82F6'; }
    else if (e.kind==='STEAL') { label = 'STEAL'; color = '#10B981'; }
    else { label = e.outcome||'?'; color = e.outcome==='GOAL'?'#34D399':e.outcome==='SAVE'?'#F87171':'#6B7280'; }
    return (
      <div key={e.id||idx} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',
        marginBottom:4,background:'rgba(255,255,255,0.02)',borderRadius:10,
        border:'1px solid rgba(255,255,255,0.04)',borderLeft:'3px solid '+color}}>
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
            <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:color}}>{label}</span>
            {z&&<span style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)'}}>— {z.lbl}</span>}
            {e.wave&&e.wave!=='ALL'&&<span style={{fontFamily:'Barlow Condensed',fontSize:9,fontWeight:700,
              color:waveColor(e.wave),background:waveColor(e.wave)+'20',borderRadius:4,padding:'1px 5px'}}>{waveLabel(e.wave)}</span>}
          </div>
          {(e.half!==undefined||e.clock!==undefined)&&<div style={{fontFamily:'Barlow',fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:1}}>
            {e.half?halfLabel(e.half):''} {e.clock!==undefined?fmtClock(e.clock):''}
          </div>}
        </div>
      </div>
    );
  };

  return (
    <div className="sc" style={{overflowY:'auto',padding:'16px',maxWidth:720,margin:'0 auto'}}>
      {matchHistory.length>0&&<>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:10}}>COMPLETED MATCHES</div>
        {matchHistory.map(m=><div key={m.id} style={{background:'rgba(255,255,255,0.03)',borderRadius:12,padding:'14px',marginBottom:10,border:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setExpandId(expandId===m.id?null:m.id)}>
            <div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,color:'white'}}>
                <span style={{color:m.teamA.color}}>{m.teamA.name}</span>
                <span style={{color:'rgba(255,255,255,0.4)',margin:'0 10px'}}>{m.score.A}–{m.score.B}</span>
                <span style={{color:m.teamB.color}}>{m.teamB.name}</span>
              </div>
              <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:3}}>{m.date} · {m.events.length} events</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {onViewMatch&&<button className="btn" onClick={(e)=>{e.stopPropagation();onViewMatch(m.id);}}
                style={{background:'linear-gradient(90deg,#FF3DBD,#9B2BFB)',border:'none',
                  borderRadius:8,padding:'7px 14px',fontFamily:'Barlow Condensed',fontWeight:900,
                  fontSize:11,color:'white',letterSpacing:'0.1em',boxShadow:'0 2px 10px rgba(255,61,189,0.3)'}}>
                📂 BUKA MATCH
              </button>}
              <div style={{fontFamily:'Barlow Condensed',fontSize:18,color:'rgba(255,255,255,0.3)'}}>{expandId===m.id?'▲':'▼'}</div>
            </div>
          </div>
          {expandId===m.id&&<div style={{marginTop:12,borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:12}}>
            {[...m.events].reverse().slice(0,30).map((e,i)=>renderEvent(e,i,m.teamA,m.teamB))}
          </div>}
        </div>)}
      </>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,marginTop:matchHistory.length?16:0}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em'}}>CURRENT MATCH ({events.length} events)</div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn" onClick={()=>dispatch({type:'UNDO'})} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:8,padding:'5px 10px',fontWeight:700,fontSize:11,color:'rgba(252,129,129,0.75)'}}>↶ UNDO</button>
          <button className="btn" onClick={()=>{if(window.confirm('Clear all?'))dispatch({type:'CLEAR'});}} style={{background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.15)',borderRadius:8,padding:'5px 10px',fontWeight:700,fontSize:11,color:'rgba(252,129,129,0.6)'}}>CLEAR</button>
        </div>
      </div>
      {events.length===0&&<div style={{textAlign:'center',padding:'30px 0',fontFamily:'Barlow',fontSize:13,color:'rgba(255,255,255,0.2)'}}>No events yet</div>}
      {[...events].reverse().map((e,i)=>renderEvent(e,i,teamA,teamB))}
    </div>
  );
}

// ═══ DATABASE TAB ═════════════════════════════════════════════
function DatabaseTab({teamDB, setTeamDB, matchTeams, setMatchTeams, focusMode, setFocusMode}) {
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const startEdit = (t)=>{ setEditId(t.id); setDraft(JSON.parse(JSON.stringify(t))); };
  const startNew  = ()=>{ const t={id:mkId(),name:'New Team',color:'#3B82F6',players:[]}; setTeamDB(d=>[...d,t]); setEditId(t.id); setDraft(t); };
  const saveEdit  = ()=>{ setTeamDB(d=>d.map(t=>t.id===editId?draft:t)); setEditId(null); };
  const delTeam   = (id)=>{ if(!window.confirm('Delete team?'))return; setTeamDB(d=>d.filter(t=>t.id!==id)); };
  const upP=(pid,f,v)=>setDraft(d=>({...d,players:d.players.map(p=>p.id===pid?{...p,[f]:v}:p)}));
  const addP=()=>{if(draft.players.length>=16)return;setDraft(d=>({...d,players:[...d.players,{id:mkId(),no:'',name:''}]}));};
  const delP=(pid)=>setDraft(d=>({...d,players:d.players.filter(p=>p.id!==pid)}));

  return (
    <div className="sc" style={{overflowY:'auto',padding:'16px',maxWidth:720,margin:'0 auto'}}>
      <div style={{background:'rgba(255,255,255,0.03)',borderRadius:12,padding:'16px',marginBottom:16,border:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:12}}>MATCH SETUP — PILIH TEAM</div>
        <div className="r2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {['A','B'].map(side=><div key={side}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11,color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em',marginBottom:6}}>TEAM {side}</div>
            <select className="sel" value={matchTeams[side]} onChange={e=>setMatchTeams(m=>({...m,[side]:e.target.value}))}>
              {teamDB.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {(()=>{const tm=teamDB.find(x=>x.id===matchTeams[side]);if(!tm)return null;return<div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
              <Badge team={tm} size={28}/>
              <div>
                <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:tm.color}}>{tm.name}</div>
                <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.35)'}}>{tm.players.length} players</div>
              </div>
            </div>;})()}
          </div>)}
        </div>
      </div>

      {/* ─── FOCUS MODE ─── */}
      {setFocusMode&&(()=>{
        const presets = {
          quick:    { players:false, assists:false, blockSteal:false, turnover:true,  foul:false, wave:true,  label:'Quick',    desc:'Hanya shots + wave' },
          tactical: { players:true,  assists:true,  blockSteal:false, turnover:true,  foul:false, wave:true,  label:'Tactical', desc:'Players + serangan' },
          defensive:{ players:true,  assists:false, blockSteal:true,  turnover:false, foul:true,  wave:false, label:'Defensive',desc:'Block, steal, foul' },
          full:     { players:true,  assists:true,  blockSteal:true,  turnover:true,  foul:true,  wave:true,  label:'Full',     desc:'Semua features' },
        };
        const currentPreset = Object.keys(presets).find(k=>{
          const p = presets[k];
          return p.players===focusMode.players && p.assists===focusMode.assists &&
                 p.blockSteal===focusMode.blockSteal && p.turnover===focusMode.turnover &&
                 p.foul===focusMode.foul && p.wave===focusMode.wave;
        }) || 'custom';
        const toggles = [
          {key:'players',    icon:'👤', label:'Assign Player',  desc:'Track siapa shoot'},
          {key:'assists',    icon:'🎯', label:'Assists',        desc:'Track passer yang assist gol'},
          {key:'blockSteal', icon:'🛡', label:'Block & Steal',  desc:'Defensive plays'},
          {key:'turnover',   icon:'↻', label:'Turnover',       desc:'Hilang bola tanpa shoot'},
          {key:'foul',       icon:'⚠', label:'Foul & Cards',   desc:'Disciplinary actions'},
          {key:'wave',       icon:'⚡', label:'Wave Selector',  desc:'1st/2nd/3rd wave filter'},
        ];
        const activeCount = Object.values(focusMode).filter(Boolean).length;
        return <div style={{background:'rgba(255,61,189,0.04)',border:'1px solid rgba(255,61,189,0.15)',borderRadius:14,padding:'14px',marginBottom:18}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8,flexWrap:'wrap'}}>
            <div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'#FF93D7',letterSpacing:'0.18em'}}>🎯 FOCUS ANALISIS</div>
              <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>Pilih apa yang nak ditrack. Lagi sedikit = lagi tepat.</div>
            </div>
            <div style={{background:'rgba(255,61,189,0.15)',border:'1px solid rgba(255,61,189,0.3)',borderRadius:6,padding:'3px 9px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'#FF93D7',letterSpacing:'0.1em'}}>
              {activeCount}/6 AKTIF
            </div>
          </div>

          {/* Preset buttons */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(85px,1fr))',gap:5,marginBottom:12}}>
            {Object.entries(presets).map(([k,p])=><button key={k} className="btn" onClick={()=>setFocusMode({...p, label:undefined, desc:undefined})}
              style={{background:currentPreset===k?'rgba(255,61,189,0.2)':'rgba(255,255,255,0.04)',
                border:`1px solid ${currentPreset===k?'rgba(255,61,189,0.4)':'rgba(255,255,255,0.07)'}`,
                borderRadius:8,padding:'7px 6px',display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:currentPreset===k?'#FF93D7':'rgba(255,255,255,0.7)',letterSpacing:'0.05em'}}>{p.label}</div>
              <div style={{fontFamily:'Barlow',fontSize:8,color:'rgba(255,255,255,0.35)',textAlign:'center',lineHeight:1.2}}>{p.desc}</div>
            </button>)}
            {currentPreset==='custom'&&<div style={{background:'rgba(168,85,247,0.2)',border:'1px solid rgba(168,85,247,0.4)',borderRadius:8,padding:'7px 6px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'#C084FC',letterSpacing:'0.05em'}}>Custom</div>
              <div style={{fontFamily:'Barlow',fontSize:8,color:'rgba(255,255,255,0.35)'}}>Manual</div>
            </div>}
          </div>

          {/* Toggle items */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:6}}>
            {toggles.map(t=><button key={t.key} className="btn" onClick={()=>setFocusMode(m=>({...m,[t.key]:!m[t.key]}))}
              style={{background:focusMode[t.key]?'rgba(52,211,153,0.08)':'rgba(255,255,255,0.03)',
                border:`1px solid ${focusMode[t.key]?'rgba(52,211,153,0.25)':'rgba(255,255,255,0.06)'}`,
                borderRadius:9,padding:'9px 10px',display:'flex',alignItems:'center',gap:8,textAlign:'left'}}>
              <div style={{width:18,height:18,borderRadius:5,background:focusMode[t.key]?'#34D399':'rgba(255,255,255,0.06)',
                border:focusMode[t.key]?'none':'1px solid rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11,color:'white',fontWeight:700}}>
                {focusMode[t.key]?'✓':''}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:focusMode[t.key]?'white':'rgba(255,255,255,0.5)',letterSpacing:'0.05em'}}>
                  {t.icon} {t.label}
                </div>
                <div style={{fontFamily:'Barlow',fontSize:9,color:'rgba(255,255,255,0.4)',marginTop:1,lineHeight:1.3}}>{t.desc}</div>
              </div>
            </button>)}
          </div>
        </div>;
      })()}

      <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:10}}>SENARAI TEAM ({teamDB.length})</div>
      {teamDB.map(t=><div key={t.id} style={{background:'rgba(255,255,255,0.03)',borderRadius:12,marginBottom:8,border:'1px solid '+(editId===t.id?t.color+'50':'rgba(255,255,255,0.06)'),overflow:'hidden'}}>
        {editId===t.id&&draft
          ?<div style={{padding:'14px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,marginBottom:12}}>
              <div><div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:5}}>Team Name</div>
                <input className="inp" value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></div>
              <div><div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:5}}>Color</div>
                <input type="color" value={draft.color} onChange={e=>setDraft(d=>({...d,color:e.target.value}))}
                  style={{width:52,height:36,borderRadius:8,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',cursor:'pointer',padding:2}}/></div>
            </div>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.2em',marginBottom:8}}>PLAYERS ({draft.players.length}/16)</div>
            <div className="r2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
              {draft.players.map(p=><div key={p.id} style={{display:'flex',gap:5,alignItems:'center'}}>
                <input className="inp" value={p.no} type="number" onChange={e=>upP(p.id,'no',e.target.value)} placeholder="#" style={{width:44,textAlign:'center',padding:'7px 3px',flexShrink:0}}/>
                <input className="inp" value={p.name} onChange={e=>upP(p.id,'name',e.target.value)} placeholder="Name" style={{flex:1,fontSize:12}}/>
                <button className="btn" onClick={()=>delP(p.id)} style={{background:'rgba(220,38,38,0.12)',border:'none',borderRadius:6,color:'#F87171',padding:'6px 8px',fontSize:12,flexShrink:0}}>×</button>
              </div>)}
            </div>
            {draft.players.length<16&&<button className="btn" onClick={addP} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'7px 12px',fontWeight:700,fontSize:11,color:'rgba(255,255,255,0.6)',marginBottom:12}}>+ ADD PLAYER</button>}
            <div style={{display:'flex',gap:8}}>
              <button className="btn" onClick={saveEdit} style={{flex:1,background:'#059669',borderRadius:10,padding:'9px',fontWeight:900,fontSize:14,color:'white'}}>SAVE</button>
              <button className="btn" onClick={()=>setEditId(null)} style={{flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'9px',fontWeight:700,fontSize:13,color:'rgba(255,255,255,0.5)'}}>CANCEL</button>
            </div>
          </div>
          :<div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px'}}>
            <Badge team={t} size={32}/>
            <div style={{flex:1}}>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:15,color:'white'}}>{t.name}</div>
              <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.35)'}}>{t.players.length} players registered</div>
            </div>
            <button className="btn" onClick={()=>startEdit(t)} style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'6px 12px',fontWeight:700,fontSize:12,color:'rgba(255,255,255,0.6)'}}>EDIT</button>
            <button className="btn" onClick={()=>delTeam(t.id)} style={{background:'rgba(220,38,38,0.1)',border:'none',borderRadius:8,padding:'6px 10px',fontWeight:700,fontSize:12,color:'rgba(252,129,129,0.7)'}}>×</button>
          </div>
        }
      </div>)}
      <button className="btn" onClick={startNew} style={{width:'100%',padding:'12px',borderRadius:12,background:'rgba(255,255,255,0.05)',border:'1px dashed rgba(255,255,255,0.15)',fontWeight:800,fontSize:13,color:'rgba(255,255,255,0.5)',letterSpacing:'0.1em'}}>+ TAMBAH TEAM BARU</button>
    </div>
  );
}

// ═══ MAIN APP (after auth) ═══════════════════════════════════
function MainApp({ user, subscription, onLogout }) {
  const [events, dispatch] = useReducer(evReducer, []);
  const [teamDB, setTeamDB] = useState(DEFAULT_DB);
  const [matchTeams, setMatchTeams] = useState({A:'kdh', B:'png'});
  const [matchHistory, setMatchHistory] = useState([]);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);
  const [focusMode, setFocusMode] = useState({
    players:   true,  // assign shot/event to specific player
    assists:   true,  // track assists on goals
    blockSteal:true,  // BLOCK & STEAL buttons
    turnover:  true,  // TURNOVER button
    foul:      true,  // FOUL button & cards
    wave:      true,  // wave selector (1st/2nd/3rd)
  });

  // Load match history from Supabase on startup
  useEffect(()=>{
    if (!user) return;
    setCloudLoading(true);
    loadMatchHistory(user.id)
      .then(history => {
        if (history.length > 0) setMatchHistory(history);
      })
      .finally(()=>setCloudLoading(false));
  },[user]);

  // ─── TEAMS: Load from cloud on user mount ───
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsSyncing, setTeamsSyncing] = useState(false);
  const teamsSkipNextSync = useRef(false);

  useEffect(()=>{
    if (!user) return;
    setTeamsLoading(true);
    loadTeams(user.id).then(async (cloudTeams)=>{
      if (cloudTeams.length > 0) {
        // User has teams in cloud — use those
        teamsSkipNextSync.current = true;
        setTeamDB(cloudTeams);
      } else {
        // First-time user — seed cloud with current local defaults
        teamsSkipNextSync.current = true;
        await syncTeamsToCloud(teamDB, user.id);
      }
    }).finally(()=>setTeamsLoading(false));
  },[user?.id]);

  // ─── TEAMS: Debounced sync to cloud on change ───
  useEffect(()=>{
    if (!user || teamsLoading) return;
    if (teamsSkipNextSync.current) {
      teamsSkipNextSync.current = false;
      return;
    }
    const timer = setTimeout(async ()=>{
      setTeamsSyncing(true);
      await syncTeamsToCloud(teamDB, user.id);
      setTeamsSyncing(false);
    }, 1500);
    return ()=>clearTimeout(timer);
  },[teamDB, user?.id, teamsLoading]);
  const [activeTeam, setActiveTeam] = useState('A');
  const [selZone, setSelZone] = useState(null);
  const [tab, setTab] = useState('overview');
  const [wave, setWave] = useState('ALL');
  const [showEndModal, setShowEndModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [viewingMatchId, setViewingMatchId] = useState(null);
  const mobile = useIsMobile();
  const clock = useClock();

  // ─── Derived state: current OR viewing past match ───
  const viewMatch = viewingMatchId ? matchHistory.find(m=>m.id===viewingMatchId) : null;
  const isViewing = !!viewMatch;

  const teamA = isViewing ? viewMatch.teamA : (teamDB.find(t=>t.id===matchTeams.A) || teamDB[0]);
  const teamB = isViewing ? viewMatch.teamB : (teamDB.find(t=>t.id===matchTeams.B) || teamDB[1]);
  const curTeam = activeTeam==='A' ? teamA : teamB;

  const displayEvents = isViewing ? viewMatch.events : events;
  const goalA = isViewing ? viewMatch.score.A : events.filter(e=>e.team==='A'&&e.outcome==='GOAL').length;
  const goalB = isViewing ? viewMatch.score.B : events.filter(e=>e.team==='B'&&e.outcome==='GOAL').length;
  const statsA = useGlobalStats(displayEvents,'A','B',wave);
  const statsB = useGlobalStats(displayEvents,'B','A',wave);

  // When viewing past match, freeze clock to show final state
  const displayClock = isViewing
    ? { seconds: viewMatch.events[viewMatch.events.length-1]?.clock || 0,
        half: viewMatch.events[viewMatch.events.length-1]?.half || 2,
        running:false, setSeconds:()=>{}, setHalf:()=>{}, setRunning:()=>{} }
    : clock;

  const handleShot = (ev)=>{ if(isViewing) return; dispatch({type:'ADD',ev}); setSelZone(null); };
  const handleAction = (ev)=>{ if(isViewing) return; dispatch({type:'ADD',ev}); setActionModal(null); };

  const enterViewMode = (matchId)=>{
    setViewingMatchId(matchId);
    setTab('overview');
  };
  const exitViewMode = ()=>{ setViewingMatchId(null); setTab('history'); };

  const confirmEnd = async ()=>{
    const matchData = {
      id: Date.now(),
      date: new Date().toLocaleString('en-MY'),
      teamA: {...teamA},
      teamB: {...teamB},
      score: {A:goalA, B:goalB},
      events: [...events],
    };

    // 1. Save locally first (instant)
    setMatchHistory(h=>[matchData,...h]);
    dispatch({type:'CLEAR'});
    clock.setSeconds(0); clock.setHalf(1); clock.setRunning(false);
    setShowEndModal(false);
    setTab('history');

    // 2. Save to cloud (background)
    if (user) {
      setCloudSaving(true);
      const startTime = Date.now();
      const result = await saveMatchToCloud(matchData, user.id);
      // Ensure SAVING indicator visible at least 800ms
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) await new Promise(r=>setTimeout(r, 800-elapsed));
      setCloudSaving(false);

      if (result.success) {
        setMatchHistory(h => h.map(m =>
          m.id === matchData.id ? {...m, id: result.matchId} : m
        ));
        // Show ✓ Saved for 3 seconds
        setCloudSaved(true);
        setTimeout(()=>setCloudSaved(false), 3000);
      } else {
        console.error('Cloud save failed, data kept locally:', result.error);
        alert('⚠️ Match disimpan lokal je. Cloud save gagal — cuba lagi nanti.\n\n'+result.error);
      }
    }
  };

  return (
  <div style={{background:'#0A1020',minHeight:'100vh',width:'100vw',maxWidth:'100%',overflowX:'hidden',display:'flex',flexDirection:'column',fontFamily:'Barlow,sans-serif'}}>
    <style>{CSS}</style>
    {showEndModal&&<EndMatchModal teamA={teamA} teamB={teamB} scoreA={goalA} scoreB={goalB} onConfirm={confirmEnd} onCancel={()=>setShowEndModal(false)}/>}
    {showReport&&<MatchReport events={displayEvents} teamA={teamA} teamB={teamB} scoreA={goalA} scoreB={goalB} clock={displayClock} onClose={()=>setShowReport(false)}/>}
    {actionModal&&<ActionModal action={actionModal.action} team={actionModal.teamSide==='A'?teamA:teamB} side={actionModal.teamSide} clock={clock} onRecord={handleAction} onCancel={()=>setActionModal(null)}/>}

    {/* HEADER */}
    <div style={{background:'#0E1528',borderBottom:'1px solid rgba(255,255,255,0.07)',
      padding:mobile?'6px 10px':'8px 14px',display:'flex',alignItems:'center',gap:mobile?6:10,flexWrap:'wrap'}}>
      <div style={{flex:1,display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end',minWidth:0}}>
        {!mobile&&<span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:16,color:'white',whiteSpace:'nowrap'}}>{teamA.name.toUpperCase()}</span>}
        <Badge team={teamA} size={mobile?24:30}/>
      </div>
      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:10,padding:mobile?'3px 10px':'4px 14px',textAlign:'center'}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?26:32,color:'white',lineHeight:1,letterSpacing:3}}>{goalA}–{goalB}</div>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',gap:6,minWidth:0}}>
        <Badge team={teamB} size={mobile?24:30}/>
        {!mobile&&<span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:16,color:'white',whiteSpace:'nowrap'}}>{teamB.name.toUpperCase()}</span>}
      </div>
      <button className="endbtn" onClick={()=>isViewing?exitViewMode():setShowEndModal(true)}
        style={isViewing?{background:'rgba(168,85,247,0.2)',border:'1px solid rgba(168,85,247,0.4)'}:{}}>
        {isViewing?(mobile?'✕':'✕ EXIT VIEW'):(mobile?'⏹':'⏹ END MATCH')}
      </button>
      {/* Cloud status indicators */}
      {cloudSaving&&<div style={{display:'flex',alignItems:'center',gap:5,
        background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.3)',
        borderRadius:7,padding:'4px 10px'}}>
        <span className="pulse" style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'#34D399'}}/>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,
          color:'#34D399',letterSpacing:'0.12em'}}>{mobile?'☁':'☁ SAVING'}</span>
      </div>}
      {cloudSaved&&!cloudSaving&&<div className="pop" style={{display:'flex',alignItems:'center',gap:5,
        background:'rgba(52,211,153,0.15)',border:'1px solid rgba(52,211,153,0.35)',
        borderRadius:7,padding:'4px 10px'}}>
        <span style={{fontSize:12,color:'#34D399'}}>✓</span>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,
          color:'#34D399',letterSpacing:'0.12em'}}>{mobile?'OK':'SAVED'}</span>
      </div>}
      {cloudLoading&&<div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:9,
        color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em'}}>
        {!mobile&&'LOADING...'}
      </div>}
      {teamsSyncing&&!cloudSaving&&<div style={{display:'flex',alignItems:'center',gap:4,
        background:'rgba(168,85,247,0.1)',border:'1px solid rgba(168,85,247,0.25)',
        borderRadius:6,padding:'3px 8px'}}>
        <span className="pulse" style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:'#A855F7'}}/>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:9,
          color:'#C084FC',letterSpacing:'0.1em'}}>{mobile?'⚙':'TEAMS'}</span>
      </div>}
    </div>

    {/* ─── TRIAL COUNTDOWN BANNER ─── */}
    {subscription?.status==='trial'&&(()=>{
      const days = daysRemaining(subscription);
      const urgent = days<=7;
      return <div style={{background:urgent?'rgba(220,38,38,0.12)':'rgba(255,61,189,0.08)',
        borderBottom:`1px solid ${urgent?'rgba(220,38,38,0.3)':'rgba(255,61,189,0.2)'}`,
        padding:'7px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap',fontSize:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:14}}>{urgent?'⚠️':'✨'}</span>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:urgent?'#FCA5A5':'#FF93D7',letterSpacing:'0.1em'}}>
            TRIAL {urgent?'TINGGAL':'AKTIF —'} <span style={{fontSize:14,marginLeft:3}}>{days} HARI {urgent?'LAGI':''}</span>
          </span>
        </div>
        <button onClick={()=>setTab('pricing')}
          style={{background:urgent?'#DC2626':'rgba(255,61,189,0.2)',
            border:`1px solid ${urgent?'transparent':'rgba(255,61,189,0.4)'}`,borderRadius:7,
            padding:'4px 12px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,
            color:'white',letterSpacing:'0.1em',cursor:'pointer'}}>
          UPGRADE NOW →
        </button>
      </div>;
    })()}

    {/* ─── VIEWING MODE BANNER ─── */}
    {isViewing&&<div style={{background:'linear-gradient(90deg, rgba(168,85,247,0.15), rgba(155,43,251,0.15))',
      borderBottom:'1px solid rgba(168,85,247,0.3)',padding:'8px 16px',
      display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:10,color:'#C084FC',
          background:'rgba(168,85,247,0.2)',padding:'3px 8px',borderRadius:5,letterSpacing:'0.2em'}}>📂 VIEWING MODE</span>
        <span style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.7)'}}>
          <strong style={{color:teamA.color}}>{teamA.name}</strong> vs <strong style={{color:teamB.color}}>{teamB.name}</strong>
          <span style={{color:'rgba(255,255,255,0.4)',marginLeft:8}}>· {viewMatch.date}</span>
        </span>
      </div>
      <span style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.45)',fontStyle:'italic'}}>
        Read-only · Recording disabled
      </span>
    </div>}

    {/* TABS */}
    <div style={{background:'#0E1528',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',overflowX:'auto'}}>
      {[['tutorial','📺'],['overview','OVERVIEW'],['attack','ATTACK CHART'],['stats','STATISTICS'],['players','PLAYERS'],['history','HISTORY'],['db','TEAM SETUP'],['pricing','💎 PRICING']]
        .map(([id,lbl])=><button key={id} className={`tab ${tab===id?'on':''}`} onClick={()=>setTab(id)}>{lbl}</button>)}
    </div>

    {tab==='overview'&&<OverviewTab events={displayEvents} teamA={teamA} teamB={teamB} clock={displayClock} scoreA={goalA} scoreB={goalB} onPrintReport={()=>setShowReport(true)}/>}

    {/* ATTACK TAB */}
    {tab==='attack'&&<div style={{flex:1,display:mobile?'flex':'grid',flexDirection:'column',gridTemplateColumns:mobile?'1fr':'1fr 300px',overflow:'hidden',minHeight:0}}>
      <div style={{padding:mobile?'10px':'12px',display:'flex',flexDirection:'column',gap:9,overflowY:'auto',flex:mobile?1:undefined}}>
        {/* Waves */}
        {focusMode.wave&&<div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          {WAVES.map(w=><button key={w.id} className="wave-btn" onClick={()=>{setWave(w.id);setSelZone(null);}}
            style={{background:wave===w.id?w.id==='ALL'?'rgba(255,255,255,0.2)':w.color:'rgba(255,255,255,0.06)',
              border:`1px solid ${wave===w.id?(w.id==='ALL'?'rgba(255,255,255,0.25)':w.color):'rgba(255,255,255,0.07)'}`,
              opacity:wave===w.id?1:0.6}}>{w.label}</button>)}
        </div>}
        {/* Team toggle (for action buttons context — shots use dual court below) */}
        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:8,color:'rgba(255,255,255,0.25)',letterSpacing:'0.15em'}}>ACTIONS BY:</span>
          {['A','B'].map(side=>{const t=side==='A'?teamA:teamB;return<button key={side} className="btn"
            onClick={()=>{setActiveTeam(side);setSelZone(null);}}
            style={{background:activeTeam===side?t.color:'rgba(255,255,255,0.04)',
              border:`1px solid ${activeTeam===side?t.color:'rgba(255,255,255,0.07)'}`,
              borderRadius:6,padding:'3px 8px',display:'flex',alignItems:'center',gap:4}}>
            <Badge team={t} size={11}/>
            <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'white'}}>{t.name.toUpperCase()}</span>
          </button>;})}
          <div style={{flex:1}}/>
          <button className="btn" onClick={()=>dispatch({type:'UNDO'})}
            style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:8,padding:'5px 10px',fontWeight:700,fontSize:11,color:'rgba(252,129,129,0.7)'}}>↶ UNDO</button>
        </div>
        {/* ─── MATCH CLOCK ─── (prominent placement so coach tak terlepas) */}
        <div style={{background:'linear-gradient(90deg, rgba(255,61,189,0.08), rgba(155,43,251,0.08))',
          border:'1px solid rgba(255,61,189,0.2)',borderRadius:12,padding:'10px 12px',
          display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.18em'}}>⏱ MATCH CLOCK</span>
            {clock.running&&<span className="pulse" style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:'#34D399'}}/>}
          </div>
          <Clock clock={clock} mobile={mobile}/>
        </div>
        {/* Court — DUAL VIEW (both teams visible simultaneously) */}
        <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:mobile?14:10,width:'100%'}}>
          {[{side:'A',team:teamA},{side:'B',team:teamB}].map(({side,team})=>{
            const isActiveSide = activeTeam===side;
            return <div key={side} style={{display:'flex',flexDirection:'column',gap:6}}>
              {/* Team header above each court */}
              <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',
                background:`${team.color}${isActiveSide?'25':'10'}`,
                border:`1px solid ${team.color}${isActiveSide?'70':'30'}`,
                borderRadius:8,justifyContent:'center',transition:'all 0.15s'}}>
                <Badge team={team} size={14}/>
                <span style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:12,color:team.color,letterSpacing:'0.1em'}}>
                  {team.name.toUpperCase()}
                </span>
                {isActiveSide&&<span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:9,color:team.color,letterSpacing:'0.15em',opacity:0.7}}>● ACTIVE</span>}
              </div>
              <CourtSVG events={displayEvents} teamA={teamA} teamB={teamB} activeTeam={side}
                onZoneClick={isViewing?()=>{}:(z)=>{setActiveTeam(side);setSelZone(z);}}
                selZone={isActiveSide?selZone:null} wave={wave} mobile={mobile}/>
            </div>;
          })}
        </div>
        {/* Quick action buttons — Cara A (context-aware auto-assign) */}
        {(()=>{
          const oppSide = activeTeam==='A'?'B':'A';
          const oppTeam = activeTeam==='A'?teamB:teamA;
          // BLOCK/STEAL → opponent gets credit | TO/FOUL → attacking team gets credit
          const allActions = [
            {action:'BLOCK',  icon:'🛡', label:'BLOCK',    teamSide:oppSide,    assignTo:oppTeam,  bg:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.3)', col:'#93C5FD', hint:'defender', focus:'blockSteal'},
            {action:'STEAL',  icon:'🤚', label:'STEAL',    teamSide:oppSide,    assignTo:oppTeam,  bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)', col:'#6EE7B7', hint:'defender', focus:'blockSteal'},
            {action:'TO',     icon:'↻',  label:'TURNOVER', teamSide:activeTeam, assignTo:curTeam,  bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)', col:'#FCD34D', hint:'attacker', focus:'turnover'},
            {action:'FOUL',   icon:'⚠',  label:'FOUL',     teamSide:activeTeam, assignTo:curTeam,  bg:'rgba(220,38,38,0.12)',  border:'rgba(220,38,38,0.3)',  col:'#FCA5A5', hint:'attacker', focus:'foul'},
          ];
          const actions = allActions.filter(a=>focusMode[a.focus]);
          return actions.map(({action,icon,label,teamSide,assignTo,bg,border,col,hint})=>(
            <button key={action} className="btn" onClick={()=>!isViewing&&setActionModal({action,teamSide})}
              disabled={isViewing}
              style={{background:bg,border:'1px solid '+border,borderRadius:10,padding:'8px 10px',
                display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left',
                opacity:isViewing?0.4:1,cursor:isViewing?'not-allowed':'pointer'}}>
              <span style={{fontSize:18,minWidth:22}}>{icon}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:13,color:col,letterSpacing:'0.08em'}}>{label}</div>
                <div style={{display:'flex',alignItems:'center',gap:4,marginTop:2}}>
                  <span style={{fontFamily:'Barlow',fontSize:9,color:'rgba(255,255,255,0.3)'}}>→</span>
                  <Badge team={assignTo} size={12}/>
                  <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:10,color:assignTo.color}}>{assignTo.name.toUpperCase()}</span>
                  <span style={{fontFamily:'Barlow',fontSize:9,color:'rgba(255,255,255,0.25)'}}>({hint})</span>
                </div>
              </div>
            </button>
          ));
        })()}
        {/* Label */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <Badge team={curTeam} size={20}/>
          <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:'white'}}>{curTeam.name.toUpperCase()}</span>
          <div className="pill" style={{borderRadius:5,padding:'2px 10px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'white',letterSpacing:'0.18em'}}>ATTACK CHART</div>
        </div>
      </div>
      {/* Right panel — desktop */}
      {!mobile&&<div style={{background:'#0E1528',borderLeft:'1px solid rgba(255,255,255,0.07)',padding:'14px',overflowY:'auto'}}>
        {selZone
          ?<ShotPanel zone={selZone} team={curTeam} side={activeTeam} wave={wave} clock={clock}
            onRecord={handleShot} onCancel={()=>setSelZone(null)} focusMode={focusMode}/>
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
            onRecord={handleShot} onCancel={()=>setSelZone(null)} focusMode={focusMode}/>
        </div>
      </div>}
    </div>}

    {tab==='stats'&&<StatisticsTab events={displayEvents} teamA={teamA} teamB={teamB} mobile={mobile}/>}
    {tab==='players'&&<PlayersTab events={displayEvents} teamA={teamA} teamB={teamB} mobile={mobile}/>}
    {tab==='history'&&<HistoryTab events={events} teamA={teamA} teamB={teamB} matchHistory={matchHistory} dispatch={dispatch} onViewMatch={enterViewMode}/>}
    {tab==='tutorial'&&<TutorialTab/>}
    {tab==='db'&&<DatabaseTab teamDB={teamDB} setTeamDB={setTeamDB} matchTeams={matchTeams} setMatchTeams={setMatchTeams} focusMode={focusMode} setFocusMode={setFocusMode}/>}
    {tab==='pricing'&&<PricingTab user={user} subscription={subscription} onLogout={onLogout} onSelectPlan={(p)=>{
      const periodLabel = p.period==='p1'?'1 bulan':p.period==='p6'?'6 bulan':'1 tahun';
      alert(`Plan dipilih: ${p.plan} (${periodLabel}) — RM${p.price}\n\nUntuk activate, hubungi admin via WhatsApp dengan receipt pembayaran!`);
    }}/>}
  </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AUTH COMPONENTS (Login / Sign Up / Paywall / Wrapper)
// ═══════════════════════════════════════════════════════════════

function LoadingScreen({msg='Loading...'}) {
  return (
    <div style={{background:'#0A1020',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Barlow,sans-serif',color:'white'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
        @keyframes spn{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        .spn{animation:spn 1s linear infinite}`}</style>
      <div style={{textAlign:'center'}}>
        <div className="spn" style={{width:48,height:48,borderRadius:'50%',border:'3px solid rgba(255,61,189,0.2)',borderTopColor:'#FF3DBD',margin:'0 auto'}}/>
        <div style={{marginTop:16,fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,letterSpacing:'0.2em',color:'rgba(255,255,255,0.5)'}}>{msg}</div>
      </div>
    </div>
  );
}

function AuthScreen({onSuccess, onBack}) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e)=>{
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode==='login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess&&onSuccess();
      } else {
        if (!fullName.trim()) throw new Error('Sila masukkan nama penuh');
        if (password.length < 6) throw new Error('Password mesti sekurang-kurangnya 6 aksara');
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, phone } }
        });
        if (error) throw error;
        setInfo('Akaun berjaya didaftar! Sila check email anda untuk verify (kalau setting Supabase memerlukan email confirmation). Atau cuba login sekarang.');
        setMode('login');
      }
    } catch(err) {
      setError(err.message||'Berlaku ralat. Cuba lagi.');
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async ()=>{
    setError(''); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider:'google',
        options:{ redirectTo: window.location.origin + window.location.pathname }
      });
      if (error) throw error;
    } catch(err) { setError(err.message); setLoading(false); }
  };

  const handleForgotPwd = async ()=>{
    if (!email) { setError('Sila masukkan email anda dulu'); return; }
    setError(''); setLoading(true);
    try {
      const redirectUrl = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setInfo('Link reset password telah dihantar ke email anda');
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{background:'#0A1020',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:'Barlow,sans-serif',position:'relative'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap');`}</style>
      {onBack&&<button onClick={onBack} style={{position:'absolute',top:20,left:20,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'8px 14px',color:'rgba(255,255,255,0.7)',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,letterSpacing:'0.1em',cursor:'pointer'}}>← BACK</button>}
      <div style={{background:'linear-gradient(180deg, rgba(255,61,189,0.05), transparent)',width:'100%',maxWidth:420,borderRadius:18,padding:'30px 28px',border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
        {/* Logo / Title */}
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{display:'inline-block',background:'linear-gradient(135deg,#FF3DBD,#9B2BFB)',
            width:54,height:54,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:28,marginBottom:14,boxShadow:'0 4px 16px rgba(255,61,189,0.3)'}}>🤾</div>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:24,color:'white',letterSpacing:'0.02em'}}>
            HANDBALL ANALYSIS
          </div>
          <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:4}}>
            {mode==='login'?'Sign in to continue':'Create your account · 30 days free trial'}
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{display:'flex',background:'rgba(255,255,255,0.04)',borderRadius:10,padding:3,marginBottom:18}}>
          {[['login','LOGIN'],['signup','SIGN UP']].map(([id,lbl])=>
            <button key={id} onClick={()=>{setMode(id);setError('');setInfo('');}}
              style={{flex:1,padding:'9px',borderRadius:7,border:'none',cursor:'pointer',
                background:mode===id?'rgba(255,61,189,0.15)':'transparent',
                fontFamily:'Barlow Condensed',fontWeight:800,fontSize:12,
                color:mode===id?'#FF93D7':'rgba(255,255,255,0.4)',letterSpacing:'0.15em'}}>{lbl}</button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {mode==='signup'&&<>
            <div style={{marginBottom:10}}>
              <label style={{display:'block',fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:4}}>Nama Penuh *</label>
              <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Ahmad bin Abdullah" required
                style={inpStyle}/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{display:'block',fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:4}}>No. Telefon (optional)</label>
              <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="012-3456789"
                style={inpStyle}/>
            </div>
          </>}
          <div style={{marginBottom:10}}>
            <label style={{display:'block',fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:4}}>Email *</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="anda@example.com" required
              style={inpStyle}/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:4}}>Password *</label>
            <div style={{position:'relative'}}>
              <input type={showPwd?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 aksara" required minLength={6}
                style={{...inpStyle,paddingRight:42}}/>
              <button type="button" onClick={()=>setShowPwd(!showPwd)} 
                style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:14}}>
                {showPwd?'👁':'👁‍🗨'}
              </button>
            </div>
            {mode==='login'&&<button type="button" onClick={handleForgotPwd}
              style={{background:'none',border:'none',color:'#FF93D7',fontSize:11,cursor:'pointer',marginTop:6,padding:0,fontFamily:'Barlow'}}>
              Lupa password?
            </button>}
          </div>

          {error&&<div style={{background:'rgba(220,38,38,0.12)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:8,padding:'8px 12px',color:'#FCA5A5',fontSize:12,fontFamily:'Barlow',marginBottom:12}}>⚠ {error}</div>}
          {info&&<div style={{background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:8,padding:'8px 12px',color:'#6EE7B7',fontSize:12,fontFamily:'Barlow',marginBottom:12}}>✓ {info}</div>}

          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:loading?'wait':'pointer',
              background:'linear-gradient(90deg,#FF3DBD,#9B2BFB)',
              fontFamily:'Barlow Condensed',fontWeight:900,fontSize:14,color:'white',letterSpacing:'0.1em',
              boxShadow:'0 4px 16px rgba(255,61,189,0.3)',opacity:loading?0.6:1}}>
            {loading?'TUNGGU...':mode==='login'?'LOGIN':'CREATE ACCOUNT'}
          </button>
        </form>

        {/* Divider */}
        <div style={{display:'flex',alignItems:'center',gap:10,margin:'16px 0'}}>
          <div style={{flex:1,height:1,background:'rgba(255,255,255,0.08)'}}/>
          <span style={{fontFamily:'Barlow',fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.15em'}}>ATAU</span>
          <div style={{flex:1,height:1,background:'rgba(255,255,255,0.08)'}}/>
        </div>

        {/* Google login */}
        <button onClick={handleGoogleLogin} disabled={loading}
          style={{width:'100%',padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.12)',
            background:'rgba(255,255,255,0.04)',cursor:loading?'wait':'pointer',
            fontFamily:'Barlow',fontWeight:600,fontSize:13,color:'white',
            display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <span style={{fontSize:16}}>🇬</span>
          <span>Continue with Google</span>
        </button>

        {/* Trial info for signup */}
        {mode==='signup'&&<div style={{marginTop:16,padding:'10px 12px',background:'rgba(255,61,189,0.06)',borderRadius:8,border:'1px solid rgba(255,61,189,0.15)'}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'#FF93D7',letterSpacing:'0.1em',marginBottom:4}}>✨ 30 HARI PERCUMA</div>
          <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.55)',lineHeight:1.45}}>
            Trial start automatic bila daftar. Akses semua features tanpa kad kredit.
          </div>
        </div>}
      </div>
    </div>
  );
}

const inpStyle = {
  width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',
  borderRadius:8,padding:'10px 12px',color:'white',fontFamily:'Barlow,sans-serif',fontSize:13,
  outline:'none',boxSizing:'border-box',
};

function PaywallScreen({user, subscription, onLogout}) {
  return (
    <div style={{background:'#0A1020',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:'Barlow,sans-serif'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap');`}</style>
      <div style={{maxWidth:480,width:'100%',background:'rgba(255,255,255,0.03)',borderRadius:18,padding:'28px 26px',border:'1px solid rgba(255,255,255,0.08)',textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:14}}>⏰</div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:22,color:'white',marginBottom:8}}>
          Trial Telah Tamat
        </div>
        <div style={{fontFamily:'Barlow',fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:20,lineHeight:1.5}}>
          Trial 30 hari anda telah berakhir.<br/>
          Untuk teruskan guna sistem, sila pilih plan dan buat pembayaran.
        </div>

        <div style={{background:'rgba(255,61,189,0.08)',border:'1px solid rgba(255,61,189,0.2)',borderRadius:10,padding:'14px',marginBottom:18,textAlign:'left'}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.5)',letterSpacing:'0.2em',marginBottom:8}}>AKAUN ANDA</div>
          <div style={{fontFamily:'Barlow',fontSize:13,color:'white',marginBottom:4}}>{user?.email}</div>
          <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.45)'}}>
            Trial tamat: {subscription?.trial_end ? new Date(subscription.trial_end).toLocaleDateString('en-MY') : '-'}
          </div>
        </div>

        <div style={{background:'rgba(255,255,255,0.02)',borderRadius:10,padding:'14px',marginBottom:18,textAlign:'left'}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:10,color:'rgba(255,255,255,0.5)',letterSpacing:'0.2em',marginBottom:10}}>CARA AKTIFKAN</div>
          <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:1.6}}>
            1. Pilih plan yang sesuai (Individual / Team / Club)<br/>
            2. Buat pembayaran via FPX / online banking<br/>
            3. Hantar receipt ke admin via WhatsApp<br/>
            4. Admin approve dalam masa 1 hari
          </div>
        </div>

        <div style={{display:'flex',gap:8,flexDirection:'column'}}>
          <a href="https://wa.me/60123456789?text=Saya%20nak%20activate%20handball%20app"
            style={{padding:'12px',borderRadius:10,background:'linear-gradient(90deg,#FF3DBD,#9B2BFB)',
              fontFamily:'Barlow Condensed',fontWeight:900,fontSize:13,color:'white',letterSpacing:'0.1em',
              textDecoration:'none',boxShadow:'0 4px 16px rgba(255,61,189,0.3)'}}>
            💬 HUBUNGI ADMIN VIA WHATSAPP
          </a>
          <button onClick={onLogout}
            style={{padding:'10px',borderRadius:10,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',
              fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'rgba(255,255,255,0.5)',letterSpacing:'0.1em',cursor:'pointer'}}>
            LOG OUT
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordResetScreen({onComplete}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e)=>{
    e.preventDefault();
    if (password !== confirm) { setError('Password tidak sama'); return; }
    if (password.length < 6) { setError('Password mesti sekurang-kurangnya 6 aksara'); return; }
    setError(''); setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Clear URL hash so user doesn't get stuck
      window.history.replaceState(null, '', window.location.pathname);
      alert('✓ Password berjaya direset! Sila login dengan password baru.');
      await supabase.auth.signOut();
      onComplete();
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{background:'#0A1020',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:'Barlow,sans-serif'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap');`}</style>
      <div style={{background:'linear-gradient(180deg, rgba(255,61,189,0.05), transparent)',width:'100%',maxWidth:420,borderRadius:18,padding:'30px 28px',border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{display:'inline-block',background:'linear-gradient(135deg,#FF3DBD,#9B2BFB)',
            width:54,height:54,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:28,marginBottom:14,boxShadow:'0 4px 16px rgba(255,61,189,0.3)'}}>🔒</div>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:22,color:'white',letterSpacing:'0.02em'}}>
            RESET PASSWORD
          </div>
          <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:4}}>
            Set password baru anda
          </div>
        </div>

        <form onSubmit={handleReset}>
          <div style={{marginBottom:12}}>
            <label style={{display:'block',fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:4}}>Password Baru</label>
            <input type={showPwd?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 aksara" required minLength={6} style={inpStyle}/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:4}}>Confirm Password</label>
            <input type={showPwd?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Ulang password baru" required style={inpStyle}/>
            <button type="button" onClick={()=>setShowPwd(!showPwd)} style={{background:'none',border:'none',color:'#FF93D7',fontSize:11,cursor:'pointer',marginTop:6,padding:0,fontFamily:'Barlow'}}>
              {showPwd?'Sembunyi password':'Tunjuk password'}
            </button>
          </div>
          {error&&<div style={{background:'rgba(220,38,38,0.12)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:8,padding:'8px 12px',color:'#FCA5A5',fontSize:12,fontFamily:'Barlow',marginBottom:12}}>⚠ {error}</div>}
          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:loading?'wait':'pointer',
              background:'linear-gradient(90deg,#FF3DBD,#9B2BFB)',
              fontFamily:'Barlow Condensed',fontWeight:900,fontSize:14,color:'white',letterSpacing:'0.1em',
              boxShadow:'0 4px 16px rgba(255,61,189,0.3)',opacity:loading?0.6:1}}>
            {loading?'PROCESSING...':'SET PASSWORD BARU'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══ LANDING PAGE (Public Marketing Site) ════════════════════
function LandingPage({onGetStarted, onLogin}) {
  const [lang, setLang] = useState('BM');
  const [openFaq, setOpenFaq] = useState(null);
  const mobile = useIsMobile();

  const TXT = {
    BM:{
      nav:{features:'Features', howit:'Cara Guna', pricing:'Harga', faq:'FAQ', login:'Log Masuk'},
      hero:{
        eyebrow:'🏆 ANALISIS HANDBALL MALAYSIA',
        title1:'Analisis Match',
        title2:'Macam Pro',
        sub:'Track shots, assists, fouls. Auto-generate match reports. Live statistics untuk coach Malaysia.',
        cta:'Mulakan Free Trial',
        ctaSub:'30 hari percuma · Tanpa kad kredit · Setup 2 minit',
      },
      features:{
        title:'SEMUA YANG COACH PERLU',
        subtitle:'Tools handball analytics yang real, bukan sekadar tracking shot.',
        list:[
          {ic:'🎯',t:'Court Tracking',d:'10 zon court dengan WAVE system (1st/2nd/3rd) untuk classify counter-attack vs set play.'},
          {ic:'⚽',t:'Shot Analysis',d:'Track GOAL, SAVE, MISS per pemain. Auto-calculate shooting efficiency.'},
          {ic:'📊',t:'Live Statistics',d:'Stats update real-time bila record event. Pemain breakdown, team comparison, foul tracking.'},
          {ic:'☁️',t:'Cloud Sync',d:'Match data auto-save ke cloud. Akses dari phone, tablet, laptop — semua sync.'},
          {ic:'📄',t:'PDF Reports',d:'Auto-generate match report yang professional untuk print, share, atau archive.'},
          {ic:'🇲🇾',t:'Made in Malaysia',d:'Bahasa Malaysia native. Design untuk handball Malaysia. Support tempatan.'},
        ],
      },
      how:{
        title:'CARA DIA BERFUNGSI',
        subtitle:'Dari setup ke insights dalam 3 langkah.',
        steps:[
          {n:'01',t:'Setup Team',d:'Tambah pemain dengan jersey number dan nama. Setup home & away.'},
          {n:'02',t:'Record Match',d:'Tap zone kat court, capture setiap shot, save, foul. Real-time tracking.'},
          {n:'03',t:'Get Insights',d:'Lihat statistics live atau generate PDF report untuk briefing.'},
        ],
      },
      pricing:{
        title:'HARGA YANG BERPATUTAN',
        subtitle:'Trial 30 hari percuma. Tanpa kad kredit.',
        cta:'Lihat Semua Plan',
      },
      faq:{
        title:'SOALAN LAZIM',
        items:[
          {q:'Adakah trial percuma sebenarnya?',a:'Ya, 30 hari penuh percuma. Tak perlu masukkan kad kredit. Tiada caj tersembunyi. Selepas 30 hari, awak pilih untuk subscribe atau tidak.'},
          {q:'Berapa device boleh login serentak?',a:'Solo: 1 device. Team: 3 devices. Club: 6 devices. Kalau login dari device baru lebih limit, device paling lama akan auto-logout.'},
          {q:'Macam mana data saya selamat?',a:'Semua data encrypted, disimpan di Supabase (powered by AWS). Hanya awak boleh akses match data sendiri. Backup automatik setiap hari.'},
          {q:'Boleh print match report?',a:'Ya. Setiap match boleh generate PDF report yang professional — termasuk statistics, shot chart, pemain breakdown. Sesuai untuk briefing atau archive.'},
          {q:'Kalau saya cancel, data hilang?',a:'Tidak. Selepas cancel subscription, awak masih boleh access dan export semua data lama. Data hanya delete kalau awak request manual.'},
        ],
      },
      finalCta:{
        title:'Sedia mula analisis handball?',
        sub:'Join coaches Malaysia yang dah upgrade dari pen & paper ke digital tracking.',
        btn:'Mulakan Free Trial 30 Hari',
      },
      footer:{
        tag:'Built with ❤️ in Malaysia',
        copy:'© 2026 Handball Analysis. All rights reserved.',
      },
    },
    EN:{
      nav:{features:'Features', howit:'How It Works', pricing:'Pricing', faq:'FAQ', login:'Log In'},
      hero:{
        eyebrow:'🏆 MALAYSIAN HANDBALL ANALYTICS',
        title1:'Pro-Level',
        title2:'Match Analysis',
        sub:'Track shots, assists, fouls. Auto-generate match reports. Live statistics for handball coaches.',
        cta:'Start Free Trial',
        ctaSub:'30 days free · No credit card · 2-min setup',
      },
      features:{
        title:'EVERYTHING COACHES NEED',
        subtitle:'Real handball analytics tools, not just shot tracking.',
        list:[
          {ic:'🎯',t:'Court Tracking',d:'10 court zones with WAVE system (1st/2nd/3rd) to classify counter-attack vs set play.'},
          {ic:'⚽',t:'Shot Analysis',d:'Track GOAL, SAVE, MISS per player. Auto-calculate shooting efficiency.'},
          {ic:'📊',t:'Live Statistics',d:'Stats update in real-time as you record. Player breakdown, team comparison, foul tracking.'},
          {ic:'☁️',t:'Cloud Sync',d:'Match data auto-saves to cloud. Access from phone, tablet, laptop — all in sync.'},
          {ic:'📄',t:'PDF Reports',d:'Auto-generate professional match reports for printing, sharing, or archiving.'},
          {ic:'🇲🇾',t:'Made in Malaysia',d:'Bahasa Malaysia native. Designed for Malaysian handball. Local support.'},
        ],
      },
      how:{
        title:'HOW IT WORKS',
        subtitle:'From setup to insights in 3 steps.',
        steps:[
          {n:'01',t:'Setup Team',d:'Add players with jersey numbers and names. Set up home & away teams.'},
          {n:'02',t:'Record Match',d:'Tap court zones, capture every shot, save, foul. Real-time tracking.'},
          {n:'03',t:'Get Insights',d:'View live statistics or generate PDF reports for briefings.'},
        ],
      },
      pricing:{
        title:'AFFORDABLE PRICING',
        subtitle:'30-day free trial. No credit card required.',
        cta:'See All Plans',
      },
      faq:{
        title:'FREQUENTLY ASKED',
        items:[
          {q:'Is the trial really free?',a:'Yes, full 30 days free. No credit card required. No hidden charges. After 30 days, you choose whether to subscribe.'},
          {q:'How many devices can I use?',a:'Solo: 1 device. Team: 3 devices. Club: 6 devices. If you log in from a new device beyond your limit, the oldest device auto-logs out.'},
          {q:'How is my data secured?',a:'All data is encrypted, stored on Supabase (powered by AWS). Only you can access your match data. Automatic daily backups.'},
          {q:'Can I print match reports?',a:'Yes. Every match can generate a professional PDF report — including statistics, shot chart, player breakdown. Perfect for briefings or archives.'},
          {q:'If I cancel, do I lose my data?',a:'No. After canceling, you can still access and export all old data. Data is only deleted if you request manual deletion.'},
        ],
      },
      finalCta:{
        title:'Ready to start handball analysis?',
        sub:'Join Malaysian coaches upgrading from pen & paper to digital tracking.',
        btn:'Start 30-Day Free Trial',
      },
      footer:{
        tag:'Built with ❤️ in Malaysia',
        copy:'© 2026 Handball Analysis. All rights reserved.',
      },
    },
  };
  const t = TXT[lang];

  const sectionStyle = {padding:mobile?'40px 16px':'60px 24px', maxWidth:1100, margin:'0 auto'};
  const titleStyle = {fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?22:30,color:'white',letterSpacing:'0.05em',textAlign:'center',marginBottom:8};
  const subtitleStyle = {fontFamily:'Barlow',fontSize:14,color:'rgba(255,255,255,0.5)',textAlign:'center',marginBottom:mobile?28:40};

  return (
    <div style={{background:'#0A1020',minHeight:'100vh',width:'100vw',maxWidth:'100%',overflowX:'hidden',fontFamily:'Barlow,sans-serif',color:'white'}}>
      {/* ─── NAV ─── */}
      <nav style={{position:'sticky',top:0,zIndex:10,background:'rgba(10,16,32,0.85)',backdropFilter:'blur(12px)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <div style={{maxWidth:1100,margin:'0 auto',padding:mobile?'12px 16px':'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg, #FF3DBD, #A855F7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🤾</div>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,letterSpacing:'0.05em'}}>HANDBALL<span style={{color:'#FF3DBD'}}>.MY</span></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:mobile?6:18}}>
            {!mobile&&<>
              <a href="#features" style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'rgba(255,255,255,0.6)',textDecoration:'none',letterSpacing:'0.1em'}}>{t.nav.features.toUpperCase()}</a>
              <a href="#howit" style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'rgba(255,255,255,0.6)',textDecoration:'none',letterSpacing:'0.1em'}}>{t.nav.howit.toUpperCase()}</a>
              <a href="#pricing" style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'rgba(255,255,255,0.6)',textDecoration:'none',letterSpacing:'0.1em'}}>{t.nav.pricing.toUpperCase()}</a>
              <a href="#faq" style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'rgba(255,255,255,0.6)',textDecoration:'none',letterSpacing:'0.1em'}}>{t.nav.faq.toUpperCase()}</a>
            </>}
            <div style={{display:'flex',background:'rgba(255,255,255,0.05)',padding:2,borderRadius:6}}>
              {['BM','EN'].map(l=><button key={l} onClick={()=>setLang(l)}
                style={{padding:'4px 8px',borderRadius:4,border:'none',background:lang===l?'#FF3DBD':'transparent',color:'white',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:10,letterSpacing:'0.1em',cursor:'pointer'}}>{l}</button>)}
            </div>
            <button onClick={onLogin} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'6px 14px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'white',letterSpacing:'0.1em',cursor:'pointer'}}>
              {t.nav.login.toUpperCase()}
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{...sectionStyle,paddingTop:mobile?40:80,paddingBottom:mobile?40:80,textAlign:'center'}}>
        <div style={{display:'inline-block',background:'rgba(255,61,189,0.1)',border:'1px solid rgba(255,61,189,0.25)',borderRadius:20,padding:'5px 14px',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:11,color:'#FF93D7',letterSpacing:'0.18em',marginBottom:20}}>
          {t.hero.eyebrow}
        </div>
        <h1 style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?42:72,lineHeight:0.95,letterSpacing:'-0.02em',margin:0,marginBottom:16}}>
          {t.hero.title1}<br/>
          <span style={{background:'linear-gradient(135deg, #FF3DBD, #A855F7)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{t.hero.title2}</span>
        </h1>
        <p style={{fontFamily:'Barlow',fontSize:mobile?15:18,color:'rgba(255,255,255,0.6)',maxWidth:600,margin:'0 auto 28px',lineHeight:1.5}}>
          {t.hero.sub}
        </p>
        <button onClick={onGetStarted} style={{background:'linear-gradient(135deg, #FF3DBD, #A855F7)',border:'none',borderRadius:10,padding:'14px 32px',fontFamily:'Barlow Condensed',fontWeight:900,fontSize:14,color:'white',letterSpacing:'0.12em',cursor:'pointer',boxShadow:'0 8px 32px rgba(255,61,189,0.3)'}}>
          🚀 {t.hero.cta.toUpperCase()} →
        </button>
        <div style={{fontFamily:'Barlow',fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:14}}>
          {t.hero.ctaSub}
        </div>

        {/* Visual mockup */}
        <div style={{marginTop:48,padding:mobile?'14px':'24px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:16,maxWidth:700,margin:`${mobile?32:48}px auto 0`}}>
          <svg viewBox="0 0 700 320" style={{width:'100%',height:'auto',display:'block'}}>
            <rect width="700" height="320" fill="#101830" rx="12"/>
            {/* Court outline */}
            <rect x="60" y="60" width="580" height="200" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" rx="100"/>
            <line x1="350" y1="60" x2="350" y2="260" stroke="rgba(255,255,255,0.15)" strokeWidth="2"/>
            {/* Zones with sample data */}
            <g>
              <circle cx="120" cy="160" r="28" fill="rgba(52,211,153,0.2)" stroke="#34D399" strokeWidth="2"/>
              <text x="120" y="158" textAnchor="middle" fill="white" fontFamily="Barlow Condensed" fontWeight="900" fontSize="14">8/12</text>
              <text x="120" y="172" textAnchor="middle" fill="#34D399" fontFamily="Barlow Condensed" fontWeight="800" fontSize="9">67%</text>
              <circle cx="220" cy="120" r="22" fill="rgba(245,158,11,0.2)" stroke="#F59E0B" strokeWidth="2"/>
              <text x="220" y="125" textAnchor="middle" fill="white" fontFamily="Barlow Condensed" fontWeight="900" fontSize="11">3/8</text>
              <circle cx="220" cy="200" r="22" fill="rgba(220,38,38,0.2)" stroke="#DC2626" strokeWidth="2"/>
              <text x="220" y="205" textAnchor="middle" fill="white" fontFamily="Barlow Condensed" fontWeight="900" fontSize="11">2/9</text>
              <circle cx="480" cy="120" r="22" fill="rgba(245,158,11,0.2)" stroke="#F59E0B" strokeWidth="2"/>
              <text x="480" y="125" textAnchor="middle" fill="white" fontFamily="Barlow Condensed" fontWeight="900" fontSize="11">4/7</text>
              <circle cx="480" cy="200" r="22" fill="rgba(52,211,153,0.2)" stroke="#34D399" strokeWidth="2"/>
              <text x="480" y="205" textAnchor="middle" fill="white" fontFamily="Barlow Condensed" fontWeight="900" fontSize="11">5/8</text>
              <circle cx="580" cy="160" r="28" fill="rgba(220,38,38,0.2)" stroke="#DC2626" strokeWidth="2"/>
              <text x="580" y="158" textAnchor="middle" fill="white" fontFamily="Barlow Condensed" fontWeight="900" fontSize="14">2/6</text>
              <text x="580" y="172" textAnchor="middle" fill="#FCA5A5" fontFamily="Barlow Condensed" fontWeight="800" fontSize="9">33%</text>
            </g>
            {/* Header overlay */}
            <rect x="0" y="0" width="700" height="40" fill="rgba(255,255,255,0.03)"/>
            <text x="20" y="25" fill="white" fontFamily="Barlow Condensed" fontWeight="900" fontSize="14">KEDAH</text>
            <text x="350" y="25" textAnchor="middle" fill="white" fontFamily="Barlow Condensed" fontWeight="900" fontSize="18">25 - 22</text>
            <text x="680" y="25" textAnchor="end" fill="white" fontFamily="Barlow Condensed" fontWeight="900" fontSize="14">PENANG</text>
            {/* Bottom stats bar */}
            <rect x="0" y="280" width="700" height="40" fill="rgba(255,255,255,0.03)"/>
            <text x="60" y="305" fill="rgba(255,255,255,0.5)" fontFamily="Barlow Condensed" fontWeight="700" fontSize="11" letterSpacing="0.1em">SHOOTING EFFICIENCY 56%</text>
            <text x="340" y="305" fill="rgba(255,255,255,0.5)" fontFamily="Barlow Condensed" fontWeight="700" fontSize="11" letterSpacing="0.1em">ASSISTS 14</text>
            <text x="460" y="305" fill="rgba(255,255,255,0.5)" fontFamily="Barlow Condensed" fontWeight="700" fontSize="11" letterSpacing="0.1em">FOULS 8</text>
            <text x="580" y="305" fill="rgba(255,255,255,0.5)" fontFamily="Barlow Condensed" fontWeight="700" fontSize="11" letterSpacing="0.1em">T.O 5</text>
          </svg>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" style={sectionStyle}>
        <h2 style={titleStyle}>{t.features.title}</h2>
        <p style={subtitleStyle}>{t.features.subtitle}</p>
        <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'repeat(auto-fit, minmax(280px, 1fr))',gap:14}}>
          {t.features.list.map((f,i)=>
            <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:14,padding:'20px 18px'}}>
              <div style={{fontSize:32,marginBottom:10}}>{f.ic}</div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:16,color:'white',marginBottom:6,letterSpacing:'0.03em'}}>{f.t}</div>
              <div style={{fontFamily:'Barlow',fontSize:13,color:'rgba(255,255,255,0.55)',lineHeight:1.5}}>{f.d}</div>
            </div>
          )}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="howit" style={{...sectionStyle,background:'rgba(255,255,255,0.02)'}}>
        <h2 style={titleStyle}>{t.how.title}</h2>
        <p style={subtitleStyle}>{t.how.subtitle}</p>
        <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'repeat(3, 1fr)',gap:14}}>
          {t.how.steps.map((s,i)=>
            <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:14,padding:'24px 20px',position:'relative'}}>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:36,background:'linear-gradient(135deg, #FF3DBD, #A855F7)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',lineHeight:1,marginBottom:10,letterSpacing:'-0.02em'}}>{s.n}</div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:'white',marginBottom:6,letterSpacing:'0.03em'}}>{s.t}</div>
              <div style={{fontFamily:'Barlow',fontSize:13,color:'rgba(255,255,255,0.55)',lineHeight:1.5}}>{s.d}</div>
            </div>
          )}
        </div>
      </section>

      {/* ─── PRICING TEASER ─── */}
      <section id="pricing" style={sectionStyle}>
        <h2 style={titleStyle}>{t.pricing.title}</h2>
        <p style={subtitleStyle}>{t.pricing.subtitle}</p>
        <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'repeat(3, 1fr)',gap:14,marginBottom:24}}>
          {Object.entries(PRICING_DATA).map(([k,p])=>
            <div key={k} style={{background:p.popular?`linear-gradient(180deg, ${p.color}10, transparent)`:'rgba(255,255,255,0.03)',border:`1px solid ${p.popular?p.color+'40':'rgba(255,255,255,0.06)'}`,borderRadius:14,padding:'20px 18px',textAlign:'center',position:'relative'}}>
              {p.popular&&<div style={{position:'absolute',top:-9,left:'50%',transform:'translateX(-50%)',background:p.color,color:'white',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:9,padding:'3px 10px',borderRadius:6,letterSpacing:'0.12em'}}>BEST</div>}
              <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,color:'white',marginBottom:4}}>{p.name[lang]||p.name.BM}</div>
              <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:14}}>{p.sub[lang]||p.sub.BM}</div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:34,color:'white',lineHeight:1}}>RM{p.p12}</div>
              <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:14}}>/{lang==='BM'?'tahun':'year'}</div>
            </div>
          )}
        </div>
        <div style={{textAlign:'center'}}>
          <button onClick={onGetStarted} style={{background:'rgba(255,61,189,0.15)',border:'1px solid rgba(255,61,189,0.3)',borderRadius:10,padding:'11px 28px',fontFamily:'Barlow Condensed',fontWeight:900,fontSize:13,color:'#FF93D7',letterSpacing:'0.1em',cursor:'pointer'}}>
            {t.pricing.cta.toUpperCase()} →
          </button>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" style={{...sectionStyle,background:'rgba(255,255,255,0.02)'}}>
        <h2 style={titleStyle}>{t.faq.title}</h2>
        <div style={{maxWidth:700,margin:'24px auto 0',display:'flex',flexDirection:'column',gap:8}}>
          {t.faq.items.map((f,i)=>
            <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,overflow:'hidden'}}>
              <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{width:'100%',background:'none',border:'none',padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',textAlign:'left',gap:10}}>
                <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:'white',letterSpacing:'0.02em'}}>{f.q}</span>
                <span style={{color:'#FF3DBD',fontSize:16,flexShrink:0,transform:openFaq===i?'rotate(45deg)':'rotate(0)',transition:'transform 0.2s'}}>+</span>
              </button>
              {openFaq===i&&<div style={{padding:'0 16px 14px',fontFamily:'Barlow',fontSize:13,color:'rgba(255,255,255,0.55)',lineHeight:1.6}}>{f.a}</div>}
            </div>
          )}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section style={{...sectionStyle,textAlign:'center',paddingTop:60,paddingBottom:60}}>
        <h2 style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?28:42,color:'white',marginBottom:12,lineHeight:1.1}}>{t.finalCta.title}</h2>
        <p style={{fontFamily:'Barlow',fontSize:15,color:'rgba(255,255,255,0.55)',maxWidth:500,margin:'0 auto 24px'}}>{t.finalCta.sub}</p>
        <button onClick={onGetStarted} style={{background:'linear-gradient(135deg, #FF3DBD, #A855F7)',border:'none',borderRadius:10,padding:'14px 32px',fontFamily:'Barlow Condensed',fontWeight:900,fontSize:14,color:'white',letterSpacing:'0.12em',cursor:'pointer',boxShadow:'0 8px 32px rgba(255,61,189,0.3)'}}>
          🚀 {t.finalCta.btn.toUpperCase()} →
        </button>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{borderTop:'1px solid rgba(255,255,255,0.05)',padding:'24px 16px',textAlign:'center'}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'rgba(255,255,255,0.5)',letterSpacing:'0.05em',marginBottom:4}}>{t.footer.tag}</div>
        <div style={{fontFamily:'Barlow',fontSize:11,color:'rgba(255,255,255,0.3)'}}>{t.footer.copy}</div>
      </footer>
    </div>
  );
}

// ═══ ROOT WRAPPER (Auth + Subscription Check) ═════════════════
export default function HandballApp() {
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'unauth' | 'expired' | 'ok' | 'recovery'
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [showAuth, setShowAuth] = useState(false); // false = show landing, true = show auth screen

  const checkAuth = async ()=>{
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setAuthState('unauth'); return; }
      setUser(session.user);

      const { data: sub, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') console.error('Sub load error:', error);
      setSubscription(sub);
      const active = isSubscriptionActive(sub);
      setAuthState(active ? 'ok' : 'expired');
      // Register this device (only if subscription is active)
      if (active) registerDevice(session.user.id, sub);
    } catch(err) {
      console.error('Auth check failed:', err);
      setAuthState('unauth');
    }
  };

  useEffect(()=>{
    // Check if we're in password recovery flow FIRST
    const isRecovery = window.location.hash.includes('type=recovery');
    if (isRecovery) {
      setAuthState('recovery');
    } else {
      checkAuth();
    }

    const { data: { subscription: listener } } = supabase.auth.onAuthStateChange((event)=>{
      // CRITICAL: If URL still has recovery hash, lock to recovery mode
      // (don't let SIGNED_IN event override it)
      if (window.location.hash.includes('type=recovery')) {
        setAuthState('recovery');
        return;
      }
      if (event==='SIGNED_OUT') {
        setUser(null); setSubscription(null); setAuthState('unauth');
      } else if (event==='PASSWORD_RECOVERY') {
        setAuthState('recovery');
      } else if (event==='SIGNED_IN' || event==='TOKEN_REFRESHED') {
        checkAuth();
      }
    });
    return ()=>listener?.unsubscribe();
  },[]);

  // ─── Heartbeat: keep last_seen_at fresh + fallback kick detection ───
  useEffect(()=>{
    if (authState !== 'ok' || !user) return;
    const checkValid = async ()=>{
      const valid = await heartbeatDevice(user.id);
      if (!valid) {
        alert('⚠️ Akaun anda telah login di device lain.\n\nSila login semula.');
        await supabase.auth.signOut();
      }
    };
    const interval = setInterval(checkValid, 30000); // every 30 seconds (fallback)
    return ()=>clearInterval(interval);
  },[authState, user?.id]);

  // ─── INSTANT kick detection via Supabase Realtime ───
  useEffect(()=>{
    if (authState !== 'ok' || !user) return;
    const currentToken = getDeviceToken();
    const channel = supabase
      .channel('device-kick-'+user.id)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'device_sessions',
        filter: `user_id=eq.${user.id}`,
      }, (payload)=>{
        // Our session was deleted → instant kick
        if (payload.old?.device_token === currentToken) {
          alert('⚠️ Akaun anda baru saja login di device lain.\n\nSila login semula.');
          supabase.auth.signOut().then(()=>setAuthState('unauth'));
        }
      })
      .subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[authState, user?.id]);

  const handleLogout = async ()=>{
    if (user) await cleanupCurrentDevice(user.id);
    await supabase.auth.signOut();
    setAuthState('unauth');
  };

  if (authState==='recovery') return <PasswordResetScreen onComplete={()=>setAuthState('unauth')}/>;
  if (authState==='loading') return <LoadingScreen msg="Loading..."/>;
  if (authState==='unauth') {
    if (!showAuth) {
      return <LandingPage onGetStarted={()=>setShowAuth(true)} onLogin={()=>setShowAuth(true)}/>;
    }
    return <AuthScreen onSuccess={checkAuth} onBack={()=>setShowAuth(false)}/>;
  }
  if (authState==='expired') return <PaywallScreen user={user} subscription={subscription} onLogout={handleLogout}/>;
  
  return <MainApp user={user} subscription={subscription} onLogout={handleLogout}/>;
}
