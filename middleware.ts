import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/register')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const isAuthApi = request.nextUrl.pathname.startsWith('/api/auth/')

  // 정적 파일과 API 라우트는 처리하지 않음
  if (isApiRoute) {
    return NextResponse.next()
  }

  // 페이지 라우트만 보호 (JWT 검증은 각 페이지에서 처리)
  if (!isApiRoute) {
    // 토큰이 없고 로그인/회원가입 페이지가 아니라면 로그인으로 리다이렉트
    if (!token && !isAuthPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // 토큰이 있고 로그인/회원가입 페이지라면 홈으로 리다이렉트
    if (token && isAuthPage) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}