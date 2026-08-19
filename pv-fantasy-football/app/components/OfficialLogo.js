'use client';
import {useEffect,useState} from 'react';
import {officialAsset} from '../../lib/official-assets.mjs';

export default function OfficialLogo({kind,opponent='',className='',compact=false}){
  const asset=officialAsset(kind,opponent);
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[asset.src]);
  if(!asset.approved||!asset.src||failed)return <span className={`officialLogo required ${compact?'compact':''} ${className}`.trim()} role="img" aria-label={`${asset.label} logo required`}><b>ASSET</b><small>REQUIRED</small></span>;
  return <span className={`officialLogo ${compact?'compact':''} ${className}`.trim()}><img src={asset.src} alt={`${asset.label} logo`} onError={()=>setFailed(true)}/></span>;
}
