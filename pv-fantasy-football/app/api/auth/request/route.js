import {NextResponse} from 'next/server';
import {CHALLENGE_COOKIE,GENERIC_LOGIN_MESSAGE,cookieOptions,opaqueToken,requiredAuthConfig,secureRequest} from '../../../../lib/participant-auth.mjs';
import {participantAuthService} from '../../../../lib/participant-auth-service';
export async function POST(request){
  if(!secureRequest(request))return NextResponse.json({ok:false,code:'HTTPS_REQUIRED'},{status:400});
  try{requiredAuthConfig();const {email}=await request.json();const result=await participantAuthService().request(email);const response=NextResponse.json({ok:true,message:GENERIC_LOGIN_MESSAGE});response.cookies.set(CHALLENGE_COOKIE,result.challengeId||`AUTH-DECOY-${opaqueToken()}`,cookieOptions(10*60));return response;}
  catch(error){if(error.code==='AUTH_NOT_CONFIGURED')return NextResponse.json({ok:false,code:error.code,message:'Participant authentication is unavailable.'},{status:503});console.error('Participant login request failed:',error);const response=NextResponse.json({ok:true,message:GENERIC_LOGIN_MESSAGE});response.cookies.set(CHALLENGE_COOKIE,`AUTH-DECOY-${opaqueToken()}`,cookieOptions(10*60));return response;}
}
