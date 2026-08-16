import {NextResponse} from 'next/server'; export async function GET(){return NextResponse.json({status:'backend_pending',refresh_seconds:15});}
