'use client';
import {useEffect,useMemo,useState} from 'react';

const SLOTS = ['RB','WR','TE','Offensive Flex','DL','LB','DB','Defensive Flex'];

export default function LineupBuilder(){
  const [players,setPlayers]=useState([]);
  const [games,setGames]=useState([]);
  const [email,setEmail]=useState('');
  const [game,setGame]=useState('');
  const [picks,setPicks]=useState({});
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{Promise.all([
    fetch('/api/players').then(r=>r.json()),
    fetch('/api/game-hub').then(r=>r.json())
  ]).then(([p,g])=>{setPlayers(p.players||[]);setGames((g.games||[]).filter(x=>x.pick_status==='OPEN'));});},[]);

  const used=useMemo(()=>new Set(Object.values(picks)),[picks]);
  function options(slot){
    return players.filter(p=>p.eligible_slots.includes(slot) && (!used.has(p.player_key) || picks[slot]===p.player_key));
  }
  async function submit(e){
    e.preventDefault(); setBusy(true); setMsg('');
    const r=await fetch('/api/lineup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,game_id:game,picks})});
    const d=await r.json(); setMsg(d.message||'No response'); setBusy(false);
  }

  return <main className="lineupPage">
    <section className="lineupHero">
      <div className="eyebrow">PV FANTASY FOOTBALL</div>
      <h1>Build Your Lineup</h1>
      <p>Choose one player for every slot. Players cannot be used twice.</p>
    </section>
    <form className="lineupCard" onSubmit={submit}>
      <div className="lineupIdentity">
        <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <label>Game<select required value={game} onChange={e=>setGame(e.target.value)}>
          <option value="">Select game</option>
          {games.map(g=><option key={g.game_id} value={g.game_id}>{g.week} — {g.opponent} — {g.kickoff_ct}</option>)}
        </select></label>
      </div>
      <div className="slotGrid">
        {SLOTS.map(slot=><label className="slot" key={slot}>
          <span>{slot}</span>
          <select required value={picks[slot]||''} onChange={e=>setPicks({...picks,[slot]:e.target.value})}>
            <option value="">Select player</option>
            {options(slot).map(p=><option key={p.player_key} value={p.player_key}>{p.display_name} — {p.position} — {p.class_year}</option>)}
          </select>
        </label>)}
      </div>
      <button className="submitLineup" disabled={busy}>{busy?'Submitting…':'Submit Lineup'}</button>
      {msg && <div className="lineupMessage">{msg}</div>}
    </form>
  </main>
}
