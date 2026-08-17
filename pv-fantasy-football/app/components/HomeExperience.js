'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';

export default function HomeExperience(){
  const [email,setEmail]=useState('');const [games,setGames]=useState([]);const router=useRouter();
  useEffect(()=>{setEmail(sessionStorage.getItem('pv-participant-email')||'');fetch('/api/game-hub').then(r=>r.json()).then(data=>setGames(data.games||[])).catch(()=>{});},[]);
  const next=games.find(game=>game.pick_status==='OPEN')||games[0];
  function identify(event){event.preventDefault();sessionStorage.setItem('pv-participant-email',email.trim().toLowerCase());router.push('/lineup');}
  return <>
    <section className="homeHero"><div><p className="eyebrow">2026 PV FANTASY FOOTBALL</p><h1>Your eight.<br/><em>Your game.</em></h1><p>Build a balanced offense and defense from Prairie View’s roster, then follow every fantasy point.</p></div>{next&&<article className="nextGame"><span>{next.week} • {next.site}</span><strong>PV vs {next.opponent}</strong><small>{next.kickoff_ct}</small><b className={next.pick_status==='OPEN'?'statusOpen':'statusLocked'}>{next.pick_status}</b></article>}</section>
    <section className="identifyCard"><div><p className="eyebrow">START HERE</p><h2>Identify your entry</h2><p>Use the email registered with PV Fantasy Football.</p></div><form onSubmit={identify}><label><span>Email</span><input required type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com"/></label><button>Continue to lineup</button></form></section>
    <section className="howGrid"><article><b>01</b><h3>Pick a game</h3><p>See the opponent, kickoff, and live lineup deadline.</p></article><article><b>02</b><h3>Build eight</h3><p>Four offense and four defense. No duplicate players.</p></article><article><b>03</b><h3>Track results</h3><p>Follow player points, weekly rank, and season standings.</p></article></section>
  </>;
}
