import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE = 'mr-auth'
const PUBLIC = ['/login']

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC.some(p => pathname.startsWith(p))
  const isAuthed = request.cookies.has(AUTH_COOKIE)

  if (!isAuthed && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isAuthed && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
