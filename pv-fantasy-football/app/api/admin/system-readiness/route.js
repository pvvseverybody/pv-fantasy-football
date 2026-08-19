import {NextResponse} from 'next/server';
import {getSystemReadiness} from '../../../../lib/system-readiness-service';

export const dynamic='force-dynamic';

export async function GET(){
  try{return NextResponse.json(await getSystemReadiness(),{headers:{'Cache-Control':'no-store'}})}
  catch{return NextResponse.json({status:'BLOCKED',safe_to_open_to_participants:false,reasons:['SYSTEM_READINESS_UNAVAILABLE']},{status:503,headers:{'Cache-Control':'no-store'}})}
}
