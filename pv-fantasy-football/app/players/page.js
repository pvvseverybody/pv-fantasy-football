'use client';

import {useEffect,useState} from 'react';
import SiteHeader from '../components/SiteHeader';

const points = value => value === null || value === undefined ? '—' : Number(value).toFixed(1);

export default function Players(){
  const [players,setPlayers]=useState([]);
  const [filter,setFilter]=useState('ALL');
  const [week,setWeek]=useState('');
  const [statusLabel,setStatusLabel]=useState('');
  const [error,setError]=useState('');
  const [selectedPlayer,setSelectedPlayer]=useState(null);

  useEffect(()=>{
    fetch('/api/players')
      .then(async response=>{
        if(!response.ok)throw new Error();
        return response.json();
      })
      .then(data=>{
        setPlayers(data.players||[]);
        setWeek(data.week||'');
        setStatusLabel(data.status_label||'');
      })
      .catch(()=>setError('The live player directory is temporarily unavailable.'));
  },[]);

  const visible=players.filter(player=>filter==='ALL'||player.side===filter);

  return <main className="publicPage">
    <SiteHeader/>

    <section className="contentShell">
      <div className="pageIntro compactIntro">
        <p className="eyebrow">OFFICIAL PV PLAYER POOL</p>
        <h1>PLAYER DIRECTORY</h1>
        <p>Compare eligible Prairie View players and track their official fantasy production throughout the season.</p>
      </div>

      <div className="playerDirectoryMeta">
        <div>
          <span>{week||'CURRENT WEEK'}</span>
          <strong>{statusLabel||'LOADING'}</strong>
        </div>
        <p>Weekly fantasy points appear after the lineup window closes. Season totals include weeks once their lineup window has closed.</p>
      </div>

      <div className="tabBar" role="tablist" aria-label="Player side">
        <button role="tab" aria-selected={filter==='ALL'} className={filter==='ALL'?'active':''} onClick={()=>setFilter('ALL')}>All</button>
        <button role="tab" aria-selected={filter==='OFF'} className={filter==='OFF'?'active':''} onClick={()=>setFilter('OFF')}>Offense</button>
        <button role="tab" aria-selected={filter==='DEF'} className={filter==='DEF'?'active':''} onClick={()=>setFilter('DEF')}>Defense</button>
      </div>

      {error&&<div className="stateMessage failure"><p>{error}</p></div>}

      <div className="playerDirectory">
        {visible.map(player=><article key={player.player_key}>
          <div className="positionBadge">{player.position}</div>

          <div className="playerDirectoryIdentity">
            <strong>{player.display_name}</strong>
            <small>{[player.jersey?`#${player.jersey}`:'',player.class_year].filter(Boolean).join(' • ')||'Prairie View A&M'}</small>
          </div>

          <span className="playerEligibility">Eligible: {player.eligible_slots.join(' / ')}</span>

          <div className="playerFantasy">
            <div>
              <span>{week||'WEEK'}</span>
              <strong>{points(player.week_points)}</strong>
            </div>
            <div>
              <span>SEASON</span>
              <strong>{points(player.season_points)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="playerHistoryToggle"
            aria-expanded={selectedPlayer?.player_key===player.player_key}
            onClick={()=>setSelectedPlayer(player)}
          >
            View weekly points
          </button>
        </article>)}
      </div>
    </section>

    {selectedPlayer&&<>
      <button
        type="button"
        className="playerStatsBackdrop"
        aria-label="Close player stats"
        onClick={()=>setSelectedPlayer(null)}
      />

      <aside
        className="playerStatsDrawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedPlayer.display_name} fantasy history`}
      >
        <div className="playerStatsHead">
          <div className="positionBadge">{selectedPlayer.position}</div>
          <div>
            <span>PLAYER FANTASY HISTORY</span>
            <h2>{selectedPlayer.display_name}</h2>
            <small>{selectedPlayer.eligible_slots.join(' / ')}</small>
          </div>
          <button
            type="button"
            className="pickerClose"
            aria-label="Close player stats"
            onClick={()=>setSelectedPlayer(null)}
          >
            ×
          </button>
        </div>

        <div className="playerStatsSummary">
          <div>
            <span>{week||'WEEK'}</span>
            <strong>{points(selectedPlayer.week_points)}</strong>
          </div>
          <div>
            <span>SEASON</span>
            <strong>{points(selectedPlayer.season_points)}</strong>
          </div>
        </div>

        <div className="playerHistory">
          <div className="playerHistoryHead">
            <strong>WEEKLY FANTASY POINTS</strong>
            <span>Official scoring history</span>
          </div>

          {(selectedPlayer.history||[]).length
            ? (selectedPlayer.history||[]).map(item=><div className="playerHistoryRow" key={`${selectedPlayer.player_key}-${item.week}`}>
                <span>{item.week}</span>
                <strong>{points(item.points)}</strong>
              </div>)
            : <div className="playerHistoryEmpty">No completed weeks yet.</div>}
        </div>
      </aside>
    </>}
  </main>
}