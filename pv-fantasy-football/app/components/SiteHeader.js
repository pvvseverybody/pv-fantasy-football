'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import OfficialLogo from './OfficialLogo';

const links=[
  ['/','Home','⌂'],
  ['/lineup','Lineup','8'],
  ['/results','Results','↗'],
  ['/leaderboard','Leaders','▥']
];

export default function SiteHeader(){
  const pathname=usePathname();
  const [moreOpen,setMoreOpen]=useState(false);
  const moreActive=pathname.startsWith('/players')||pathname.startsWith('/rules');

  useEffect(()=>setMoreOpen(false),[pathname]);

  return <>
    <header className="siteHeader">
      <Link className="brand" href="/" aria-label="PV Fantasy Football home">
        <OfficialLogo kind="pv-fantasy" compact/>
        <div><strong>Fantasy Football</strong><small>PV vs Everybody</small></div>
      </Link>
      <div className="brandTag">Play. Cheer. Win. It’s PV.</div>
    </header>

    <nav className="siteNav" aria-label="Primary navigation">
      {links.map(([href,label,icon])=>{
        const active=href==='/'?pathname===href:pathname.startsWith(href);
        return <Link href={href} key={href} className={active?'active':''} aria-current={active?'page':undefined}>
          <i aria-hidden="true">{icon}</i><span>{label}</span>
        </Link>
      })}

      <div className={`moreNav ${moreOpen?'open':''}`}>
        <button
          type="button"
          className={moreActive?'active':''}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          onClick={()=>setMoreOpen(open=>!open)}
        >
          <i aria-hidden="true">•••</i><span>More</span>
        </button>

        {moreOpen&&<div className="moreMenu" role="menu">
          <Link href="/players" role="menuitem">Players</Link>
          <Link href="/rules" role="menuitem">Rules & scoring</Link>
        </div>}
      </div>
    </nav>
  </>
}