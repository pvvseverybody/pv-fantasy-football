import {NextResponse} from 'next/server';
import {CHALLENGE_COOKIE,GENERIC_LOGIN_MESSAGE,cookieOptions,opaqueToken,requiredAuthConfig,secureRequest} from '../../../../lib/participant-auth.mjs';
import {participantAuthService} from '../../../../lib/participant-auth-service';
import {authRequestKey,consumeAuthAttempt} from '../../../../lib/public-auth-throttle.mjs';
import {logServerFailure} from '../../../../lib/safe-server-log.mjs';

export async function POST(request){
  if(!secureRequest(request))return NextResponse.json({ok:false,code:'HTTPS_REQUIRED'},{status:400});
  if(!consumeAuthAttempt(authRequestKey(request,'register'),{limit:6}))return NextResponse.json({ok:false,code:'RATE_LIMITED',message:'Too many attempts. Wait a few minutes and try again.'},{status:429});
  try{
    requiredAuthConfig();const body=await request.json();const result=await participantAuthService().register(body);
    const response=NextResponse.json({ok:true,message:GENERIC_LOGIN_MESSAGE});response.cookies.set(CHALLENGE_COOKIE,result.challengeId||`AUTH-DECOY-${opaqueToken()}`,cookieOptions(10*60));return response;
  }catch(error){
    if(error.code==='AUTH_NOT_CONFIGURED')return NextResponse.json({ok:false,code:error.code,message:'Participant authentication is unavailable.'},{status:503});
    if(['INVALID_EMAIL','INVALID_NAME','INVALID_TEAM_NAME','TERMS_REQUIRED'].includes(error.code))return NextResponse.json({ok:false,code:error.code,message:error.message},{status:400});
    logServerFailure('participant-registration',error);const response=NextResponse.json({ok:true,message:GENERIC_LOGIN_MESSAGE});response.cookies.set(CHALLENGE_COOKIE,`AUTH-DECOY-${opaqueToken()}`,cookieOptions(10*60));return response;
  }
}
