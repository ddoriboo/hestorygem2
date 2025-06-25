import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
    }

    const sessions = await prisma.session.findMany({
      where: { userId: decoded.userId },
      orderBy: { sessionNumber: 'asc' },
      include: {
        conversations: {
          select: { id: true }
        }
      }
    })

    const sessionsWithStatus = sessions.map(session => ({
      ...session,
      conversationCount: session.conversations.length,
      conversations: undefined
    }))

    return NextResponse.json({ sessions: sessionsWithStatus })
  } catch (error) {
    console.error('Sessions fetch error:', error)
    return NextResponse.json(
      { error: '세션 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 세션 삭제
export async function DELETE(request: NextRequest) {
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

    // 세션과 관련된 대화 삭제
    await prisma.conversation.deleteMany({
      where: { sessionId }
    })

    // 세션 삭제
    await prisma.session.delete({
      where: { id: sessionId }
    })

    return NextResponse.json({ message: '세션이 삭제되었습니다.' })
  } catch (error) {
    console.error('Session delete error:', error)
    return NextResponse.json(
      { error: '세션 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}