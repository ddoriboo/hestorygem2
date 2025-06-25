import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

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

    // 사용자의 모든 세션과 대화 내용 가져오기
    const sessions = await prisma.session.findMany({
      where: { userId: decoded.userId },
      orderBy: { sessionNumber: 'asc' },
      include: {
        conversations: {
          orderBy: { order: 'asc' }
        }
      }
    })

    // 각 세션별로 대화 요약 생성
    const sessionsWithSummary = sessions.map(session => {
      const conversationCount = session.conversations.length
      const firstConversation = session.conversations[0]
      const lastConversation = session.conversations[conversationCount - 1]
      
      return {
        ...session,
        summary: {
          conversationCount,
          firstQuestion: firstConversation?.question || '',
          lastAnswer: lastConversation?.answer || '',
        }
      }
    })

    return NextResponse.json({ sessions: sessionsWithSummary })
  } catch (error) {
    console.error('All conversations fetch error:', error)
    return NextResponse.json(
      { error: '대화 내용을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}