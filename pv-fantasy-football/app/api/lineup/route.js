import {NextResponse} from 'next/server';
import {readSheetRange} from '../../../lib/google-sheets';
import {LINEUP_SLOTS, saveLineupSubmission} from '../../../lib/lineup-submissions';
import {dateToSheetsSerial, promoteLineupSubmission} from '../../../lib/authoritative-lineups';
import {AUTH_COOKIE,bindAuthenticatedLineup,cookieValue,requiredAuthConfig,secureRequest} from '../../../lib/participant-auth.mjs';
import {participantAuthService} from '../../../lib/participant-auth-service';

const SLOT_POS = {
  RB:['RB'], WR:['WR'], TE:['TE'], 'Offensive Flex':['QB','RB','WR','TE'],
  DL:['DL'], LB:['LB'], DB:['DB'], 'Defensive Flex':['DL','LB','DB']
};

export async function POST(request) {
  let rawSaved = false;
  try {
    if(!secureRequest(request))return NextResponse.json({accepted:false,code:'HTTPS_REQUIRED',message:'A secure connection is required.'},{status:400});
    requiredAuthConfig();
    const authenticated=await participantAuthService().authenticate(cookieValue(request,AUTH_COOKIE));
    if(!authenticated)return NextResponse.json({accepted:false,code:'UNAUTHENTICATED',message:'Sign in again before submitting a lineup.'},{status:401});
    const body = await request.json();
    const {email,gameId,picks}=bindAuthenticatedLineup(body,authenticated);

    if (!gameId) return NextResponse.json({accepted:false,code:'INVALID_GAME',message:'Choose a game.'},{status:400});

    const games = await readSheetRange('Games!A3:M40', {valueRenderOption:'UNFORMATTED_VALUE'});
    const [gh,...gr] = games; const gi = Object.fromEntries(gh.map((v,i)=>[v,i]));
    const game = gr.find(r => String(r[gi['Game ID']]||'') === gameId);
    if (!game) return NextResponse.json({accepted:false,code:'INVALID_GAME',message:'Game not found.'},{status:400});
    if (String(game[gi['Pick Status']]||'').toUpperCase() !== 'OPEN')
      return NextResponse.json({accepted:false,code:'PICKS_CLOSED',message:'Picks are not open for this game.'},{status:409});
    const submittedAt = new Date();
    const kickoffSerial = Number(game[gi['Kickoff (CT)']]);
    if (!Number.isFinite(kickoffSerial) || dateToSheetsSerial(submittedAt) >= kickoffSerial)
      return NextResponse.json({accepted:false,code:'LATE_SUBMISSION',message:'The submission cutoff has passed.'},{status:409});

    const rows = await readSheetRange('Players!A3:H1000');
    const [ph,...pr] = rows; const pi = Object.fromEntries(ph.map((v,i)=>[v,i]));
    const players = new Map(pr.filter(r=>String(r[pi['Active']]||'').toUpperCase()==='YES').map(r=>[
      String(r[pi['Player ID']]||''), {name:String(r[pi['Player Name']]||''), position:String(r[pi['Position']]||'')}
    ]));

    const ids = [];
    const normalizedPicks = {};
    for (const slot of LINEUP_SLOTS) {
      const id = String(picks[slot] || '').trim();
      if (!id) return NextResponse.json({accepted:false,code:'INVALID_LINEUP',message:`Missing ${slot}.`},{status:400});
      const p = players.get(id);
      if (!p) return NextResponse.json({accepted:false,code:'INVALID_LINEUP',message:`Unknown or inactive player in ${slot}.`},{status:400});
      if (!SLOT_POS[slot].includes(p.position))
        return NextResponse.json({accepted:false,code:'INVALID_LINEUP',message:`${p.name} is not eligible for ${slot}.`},{status:400});
      ids.push(id);
      normalizedPicks[slot] = id;
    }
    if (new Set(ids).size !== 8)
      return NextResponse.json({accepted:false,code:'INVALID_LINEUP',message:'A player cannot be used twice.'},{status:400});

    const saved = await saveLineupSubmission({email, gameId, picks: normalizedPicks, submittedAt});
    rawSaved = true;
    const promoted = await promoteLineupSubmission({
      submissionId:saved.submissionId,
      email,
      gameId,
      week:String(game[gi['Week']] || ''),
      kickoffSerial,
      picks:normalizedPicks,
      submittedAt,
    });
    return NextResponse.json({
      accepted:true,
      validated:true,
      saved:true,
      duplicate:promoted.duplicate,
      raw_duplicate:saved.duplicate,
      code:promoted.duplicate ? 'LINEUP_ALREADY_ACCEPTED' : 'LINEUP_ACCEPTED',
      message:promoted.duplicate ? 'This lineup was already accepted.' : 'Lineup submitted and accepted.',
      game_id:gameId,
      submitted_at:saved.submittedAt || submittedAt.toISOString(),
      submission_id:saved.submissionId,
      version:promoted.version
    }, {status:promoted.duplicate ? 200 : 201});
  } catch (error) {
    console.error('POST /api/lineup failed:', error);
    const code = error.code || 'SERVER_ERROR';
    const status = code === 'AUTH_NOT_CONFIGURED' ? 503 : ['INVALID_IDENTITY','IDENTITY_REVIEW_REQUIRED'].includes(code) ? 400 :
      code === 'LATE_SUBMISSION' ? 409 : 500;
    const message = code === 'AUTH_NOT_CONFIGURED' ? 'Participant authentication is unavailable.' : code === 'INVALID_IDENTITY' ? 'This authenticated participant is not eligible for lineup entry.' :
      code === 'IDENTITY_REVIEW_REQUIRED' ? 'This identity requires commissioner review.' :
      code === 'LATE_SUBMISSION' ? 'The submission cutoff has passed.' :
      'The lineup was recorded but could not be promoted to the authoritative lineup. Please retry.';
    return NextResponse.json({accepted:false,saved:rawSaved,code,message},{status});
  }
}
