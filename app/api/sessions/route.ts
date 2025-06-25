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

    let sessions = await prisma.session.findMany({
      where: { userId: decoded.userId },
      orderBy: { sessionNumber: 'asc' },
      include: {
        conversations: {
          select: { id: true }
        }
      }
    })

    // 세션이 12개 미만이면 누락된 세션들을 생성
    if (sessions.length < 12) {
      const sessionTitles = [
        '프롤로그 - 나의 뿌리와 세상의 시작',
        '제1장 - 기억의 첫 페이지, 유년 시절',
        '제2장 - 꿈과 방황의 시간, 학창 시절',
        '제3장 - 세상으로 나아가다, 군대와 첫 직장',
        '제4장 - 운명의 만남, 사랑과 결혼',
        '제5장 - 아버지가 되다, 가족의 탄생',
        '제6장 - 인생의 절정, 일과 성취',
        '제7장 - 폭풍우를 견디다, 시련과 극복',
        '제8장 - 지혜의 계절, 나이 들어감의 의미',
        '제9장 - 못다 이룬 꿈, 후회와 화해',
        '제10장 - 사랑하는 이들에게 남기는 말',
        '에필로그 - 내 삶이라는 책을 덮으며'
      ]

      const existingSessionNumbers = sessions.map(s => s.sessionNumber)
      const missingSessions = []

      for (let i = 1; i <= 12; i++) {
        if (!existingSessionNumbers.includes(i)) {
          missingSessions.push({
            sessionNumber: i,
            title: sessionTitles[i - 1],
            userId: decoded.userId
          })
        }
      }

      if (missingSessions.length > 0) {
        await prisma.session.createMany({
          data: missingSessions
        })

        // 세션 목록 다시 조회
        sessions = await prisma.session.findMany({
          where: { userId: decoded.userId },
          orderBy: { sessionNumber: 'asc' },
          include: {
            conversations: {
              select: { id: true }
            }
          }
        })
      }
    }

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