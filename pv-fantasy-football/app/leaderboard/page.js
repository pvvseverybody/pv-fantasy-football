'use client';
import {useEffect,useState} from 'react';
import SiteHeader from '../components/SiteHeader';

export default function Leaderboard(){
  const [data,setData]=useState(null),[tab,setTab]=useState('weekly'),[error,setError]=useState(''),[me,setMe]=useState(''),[week,setWeek]=useState('');
  async function load(selected=''){
    setError('');
    try{
      const response=await fetch(`/api/leaderboard${selected?`?week=${encodeURIComponent(selected)}`:''}`);
      if(!response.ok)throw new Error();
      const standings=await response.json();
      setData(standings);setWeek(standings.week||selected);
    }catch{setError('Standings are temporarily unavailable.');}
  }
  useEffect(()=>{Promise.all([load(),fetch('/api/results',{method:'POST'}).then(response=>response.ok?response.json():null).catch(()=>null)]).then(([,personal])=>setMe(personal?.display_name||''));},[]);
  const rows=tab==='weekly'?data?.weekly:data?.cumulative;
  const myRow=rows?.find(row=>me&&row.participant===me);
  return <main className="publicPage"><SiteHeader/><section className="contentShell">
    <div className="pageIntro compactIntro"><p className="eyebrow">PV FANTASY STANDINGS</p><h1>LEADERBOARD</h1><p>Weekly performance and the cumulative season race.</p></div>
    {data&&data.available_weeks?.length>0&&<div className="weekPicker"><label htmlFor="leaderboard-week">VIEW WEEK</label><select id="leaderboard-week" value={week} onChange={event=>load(event.target.value)}>{data.available_weeks.map(item=><option value={item} key={item}>{item}</option>)}</select></div>}
    {data&&<div className="boardMeta"><b>{data.status_label}</b><span>{data.week||'Current week'}</span>{myRow&&<strong>YOUR RANK: #{myRow.rank}</strong>}</div>}
    <div className="tabBar" role="tablist" aria-label="Leaderboard view"><button role="tab" aria-selected={tab==='weekly'} className={tab==='weekly'?'active':''} onClick={()=>setTab('weekly')}>Weekly</button><button role="tab" aria-selected={tab==='cumulative'} className={tab==='cumulative'?'active':''} onClick={()=>setTab('cumulative')}>Season total</button></div>
    {error&&<div className="stateMessage failure"><strong>Unable to load standings</strong><p>{error}</p></div>}
    {!data&&!error&&<div className="emptyState loadingCard"><b className="loadingDot"/><p>Loading the standings…</p></div>}
    {data&&rows?.length===0&&<div className="emptyState"><span className="emptyIcon">▥</span><h2>STANDINGS ARE COMING</h2><p>No published participant scores are available yet. Check back after authoritative scoring begins.</p></div>}
    {rows?.length>0&&<div className="leaderHead" aria-hidden="true"><span>RANK</span><span>FANTASY TEAM</span><span>{tab==='weekly'?'PTS':'TOTAL'}</span></div>}
    <div className="leaderList">{rows?.map(row=><article className={`${me&&row.participant===me?'isMe':''} ${row.rank<=3?`topRank rank${row.rank}`:''}`} key={`${tab}-${row.rank}-${row.participant}`}><b>{row.rank<=3?<span aria-label={`Rank ${row.rank}`}>{row.rank}</span>:row.rank}</b><strong>{row.participant}{me&&row.participant===me&&<small>YOU</small>}</strong><div><em>{(tab==='weekly'?row.points:row.season_points).toFixed(1)}</em>{tab==='cumulative'&&<span>{row.average.toFixed(1)} avg through {data.week}</span>}</div></article>)}</div>
    <a className="textLink" href="/results">View my player-by-player results →</a>
  </section></main>;
}
