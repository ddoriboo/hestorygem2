import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    console.log('로그인 API 호출:', { username, password: '***' })

    if (!username || !password) {
      console.log('아이디 또는 비밀번호 누락')
      return NextResponse.json(
        { error: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    console.log('사용자 조회 중:', username)
    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user) {
      console.log('사용자를 찾을 수 없음:', username)
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    console.log('비밀번호 검증 중')
    const passwordValid = await verifyPassword(password, user.password)

    if (!passwordValid) {
      console.log('비밀번호 불일치')
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    console.log('JWT 토큰 생성 중')
    const token = generateToken(user.id)
    console.log('JWT 토큰 생성 완료:', token ? '토큰 생성됨' : '토큰 생성 실패')

    const response = NextResponse.json(
      { 
        message: '로그인 성공',
        user: {
          id: user.id,
          username: user.username
        }
      },
      { status: 200 }
    )

    // HTTP-only 쿠키로 토큰 설정
    console.log('쿠키 설정 중, NODE_ENV:', process.env.NODE_ENV)
    response.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: true, // Railway는 항상 HTTPS 사용
      sameSite: 'lax', // 같은 사이트 내 쿠키 허용
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/' // 모든 경로에서 쿠키 사용 가능
    })

    console.log('로그인 성공 응답 전송')
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}