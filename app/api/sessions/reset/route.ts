import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
    }

    const { sessionId } = await request.json()

    // 해당 세션이 사용자의 것인지 확인
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: decoded.userId
      }
    })

    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 세션의 모든 대화 삭제
    await prisma.conversation.deleteMany({
      where: { sessionId }
    })

    // 세션 완료 상태 초기화
    await prisma.session.update({
      where: { id: sessionId },
      data: { isCompleted: false }
    })

    return NextResponse.json({ message: '세션이 초기화되었습니다.' })
  } catch (error) {
    console.error('Session reset error:', error)
    return NextResponse.json(
      { error: '세션 초기화 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}