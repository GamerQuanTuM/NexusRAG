import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const isAuth = request.cookies.has('nexus_auth');
  const path = request.nextUrl.pathname;
  const isAuthPage = path === '/auth' || path === '/reset-password';

  if (!isAuth && !isAuthPage) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  
  if (isAuth && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
