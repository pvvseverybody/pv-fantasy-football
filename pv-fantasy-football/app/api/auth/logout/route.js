import {NextResponse} from 'next/server';
import {AUTH_COOKIE,cookieOptions,cookieValue} from '../../../../lib/participant-auth.mjs';
import {participantAuthService} from '../../../../lib/participant-auth-service';
export async function POST(request){try{await participantAuthService().logout(cookieValue(request,AUTH_COOKIE));}catch{}const response=NextResponse.json({authenticated:false});response.cookies.set(AUTH_COOKIE,'',cookieOptions(0));return response;}
