import {NextResponse} from 'next/server';
import {authorizeAdmin} from './lib/admin-auth.mjs';

export function middleware(request) {
  const authorization = authorizeAdmin(request.headers.get('authorization'));
  if (authorization.authorized) return NextResponse.next();

  if (!authorization.configured) {
    return NextResponse.json(
      {readiness: 'BLOCKED', reasons: ['ADMIN_AUTH_NOT_CONFIGURED']},
      {status: 503, headers: {'Cache-Control': 'no-store'}}
    );
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'Cache-Control': 'no-store',
      'WWW-Authenticate': 'Basic realm="PV Fantasy Operations", charset="UTF-8"',
    },
  });
}

export const config = {matcher: ['/admin/:path*', '/api/admin/:path*']};
