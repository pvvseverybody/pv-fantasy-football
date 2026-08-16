import {NextResponse} from 'next/server'; export async function GET(){return NextResponse.json({players:[],status:'backend_pending'});}
