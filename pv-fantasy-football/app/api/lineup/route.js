import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../lib/google-sheets';

const REQUIRED = ['RB','WR','TE','Offensive Flex','DL','LB','DB','Defensive Flex'];
const SLOT_POS = {
  RB:['RB'], WR:['WR'], TE:['TE'], 'Offensive Flex':['QB','RB','WR','TE'],
  DL:['DL'], LB:['LB'], DB:['DB'], 'Defensive Flex':['DL','LB','DB']
};

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const gameId = String(body.game_id || '').trim();
    const picks = body.picks || {};

    if (!email || !email.includes('@')) return NextResponse.json({accepted:false,code:'INVALID_IDENTITY',message:'Enter a valid email.'},{status:400});
    if (!gameId) return NextResponse.json({accepted:false,code:'INVALID_GAME',message:'Choose a game.'},{status:400});

    const games = await readSheetRange('Games!A3:M40');
    const [gh,...gr] = games; const gi = Object.fromEntries(gh.map((v,i)=>[v,i]));
    const game = gr.find(r => String(r[gi['Game ID']]||'') === gameId);
    if (!game) return NextResponse.json({accepted:false,code:'INVALID_GAME',message:'Game not found.'},{status:400});
    if (String(game[gi['Pick Status']]||'').toUpperCase() !== 'OPEN')
      return NextResponse.json({accepted:false,code:'PICKS_CLOSED',message:'Picks are not open for this game.'},{status:409});

    const rows = await readSheetRange('Players!A3:H1000');
    const [ph,...pr] = rows; const pi = Object.fromEntries(ph.map((v,i)=>[v,i]));
    const players = new Map(pr.filter(r=>String(r[pi['Active']]||'').toUpperCase()==='YES').map(r=>[
      String(r[pi['Player ID']]||''), {name:String(r[pi['Player Name']]||''), position:String(r[pi['Position']]||'')}
    ]));

    const ids = [];
    for (const slot of REQUIRED) {
      const id = String(picks[slot] || '');
      if (!id) return NextResponse.json({accepted:false,code:'INVALID_LINEUP',message:`Missing ${slot}.`},{status:400});
      const p = players.get(id);
      if (!p) return NextResponse.json({accepted:false,code:'INVALID_LINEUP',message:`Unknown or inactive player in ${slot}.`},{status:400});
      if (!SLOT_POS[slot].includes(p.position))
        return NextResponse.json({accepted:false,code:'INVALID_LINEUP',message:`${p.name} is not eligible for ${slot}.`},{status:400});
      ids.push(id);
    }
    if (new Set(ids).size !== 8)
      return NextResponse.json({accepted:false,code:'INVALID_LINEUP',message:'A player cannot be used twice.'},{status:400});

    // Phase 2 checkpoint: validation is authoritative and server-side.
    // Durable WriterGate/AtomicWriter persistence is the next patch.
    return NextResponse.json({
      accepted:false,
      validated:true,
      code:'VALIDATED_NOT_SAVED',
      message:'Lineup passed server validation. Durable submission writing is not enabled yet.',
      game_id:gameId
    }, {status:202});
  } catch (error) {
    console.error(error);
    return NextResponse.json({accepted:false,code:'SERVER_ERROR',message:'Unable to validate lineup.'},{status:500});
  }
}
