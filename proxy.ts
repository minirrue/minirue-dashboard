import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE = 'mr-auth'
const PUBLIC = ['/login']

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // API calls are authenticated by the backend. The dashboard page guard must
  // not redirect same-origin `/v1` requests before the external rewrite runs.
  if (pathname === '/v1' || pathname.startsWith('/v1/') || pathname === '/health') {
    return NextResponse.next()
  }
  const isPublic = PUBLIC.some(p => pathname.startsWith(p))
  const isAuthed = request.cookies.has(AUTH_COOKIE)

  if (!isAuthed && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isAuthed && pathname === '/login') {
    return NextResponse.redirect(new URL('/overview', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
