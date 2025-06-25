import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/register')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const isAuthApi = request.nextUrl.pathname.startsWith('/api/auth/')

  // API 라우트 보호
  if (isApiRoute && !isAuthApi) {
    if (!token || !verifyToken(token)) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
  }

  // 페이지 라우트 보호
  if (!isApiRoute) {
    if (!token || !verifyToken(token)) {
      if (!isAuthPage) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } else {
      if (isAuthPage) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}