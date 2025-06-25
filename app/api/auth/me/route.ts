import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log('인증 확인 API 호출됨')
    const token = request.cookies.get('auth-token')?.value
    console.log('쿠키에서 토큰 조회:', token ? '토큰 존재함' : '토큰 없음')

    if (!token) {
      console.log('토큰이 없어서 인증 실패')
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    console.log('토큰 검증 시작')
    const decoded = verifyToken(token)

    if (!decoded) {
      console.log('토큰 검증 실패')
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      )
    }

    console.log('토큰 검증 성공, 사용자 조회 시작:', decoded.userId)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        createdAt: true
      }
    })

    if (!user) {
      console.log('사용자를 찾을 수 없음:', decoded.userId)
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    console.log('인증 성공, 사용자 정보 반환:', user.username)
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: '인증 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}