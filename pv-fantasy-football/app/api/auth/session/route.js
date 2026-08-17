import {NextResponse} from 'next/server';
import {AUTH_COOKIE,cookieValue,requiredAuthConfig} from '../../../../lib/participant-auth.mjs';
import {participantAuthService} from '../../../../lib/participant-auth-service';
export async function GET(request){try{requiredAuthConfig();const participant=await participantAuthService().authenticate(cookieValue(request,AUTH_COOKIE));if(!participant)return NextResponse.json({authenticated:false},{status:401});return NextResponse.json({authenticated:true,display_name:participant.displayName},{headers:{'Cache-Control':'no-store'}});}catch(error){return NextResponse.json({authenticated:false,code:error.code==='AUTH_NOT_CONFIGURED'?error.code:'AUTH_FAILED'},{status:error.code==='AUTH_NOT_CONFIGURED'?503:500});}}
