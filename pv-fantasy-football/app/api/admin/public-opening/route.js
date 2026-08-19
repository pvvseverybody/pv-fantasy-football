import {NextResponse} from 'next/server';
import {getPublicOpeningGate} from '../../../../lib/public-opening-service';
export const dynamic='force-dynamic';
export async function GET(){try{return NextResponse.json(await getPublicOpeningGate(),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({status:'BLOCKED',checks:[],note:'Public-opening evaluation is unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
