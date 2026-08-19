import {NextResponse} from 'next/server';
import {readBetaAcceptance} from '../../../../lib/beta-acceptance-service';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(readBetaAcceptance(),{headers:{'Cache-Control':'no-store'}})}
