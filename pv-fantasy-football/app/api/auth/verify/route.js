import {NextResponse} from 'next/server';
import {AUTH_COOKIE,CHALLENGE_COOKIE,cookieOptions,cookieValue,requiredAuthConfig,secureRequest} from '../../../../lib/participant-auth.mjs';
import {participantAuthService} from '../../../../lib/participant-auth-service';
import {authRequestKey,consumeAuthAttempt} from '../../../../lib/public-auth-throttle.mjs';
import {logServerFailure} from '../../../../lib/safe-server-log.mjs';
export async function POST(request){
  if(!secureRequest(request))return NextResponse.json({authenticated:false,code:'HTTPS_REQUIRED'},{status:400});
  if(!consumeAuthAttempt(authRequestKey(request,'verify'),{limit:20}))return NextResponse.json({authenticated:false,code:'RATE_LIMITED',message:'Too many attempts. Wait a few minutes and try again.'},{status:429});
  try{requiredAuthConfig();const {code}=await request.json();const verified=await participantAuthService().verify(cookieValue(request,CHALLENGE_COOKIE),code);if(!verified)return NextResponse.json({authenticated:false,code:'INVALID_OR_EXPIRED_CODE',message:'The code is invalid or expired.'},{status:401});const response=NextResponse.json({authenticated:true,display_name:verified.displayName});response.cookies.set(AUTH_COOKIE,verified.token,cookieOptions(7*24*60*60));response.cookies.set(CHALLENGE_COOKIE,'',cookieOptions(0));return response;}
  catch(error){if(error.code==='AUTH_NOT_CONFIGURED')return NextResponse.json({authenticated:false,code:error.code},{status:503});if(['DUPLICATE_TEAM_NAME','DUPLICATE_EMAIL','PARTICIPANT_ID_CONFLICT'].includes(error.code))return NextResponse.json({authenticated:false,code:error.code,message:error.message},{status:409});logServerFailure('participant-verification',error);return NextResponse.json({authenticated:false,code:'AUTH_FAILED'},{status:500});}
}
