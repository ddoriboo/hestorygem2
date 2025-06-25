import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'

// 대화 내용 저장
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

    const { sessionId, question, answer } = await request.json()

    // 세션이 사용자의 것인지 확인
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: decoded.userId
      }
    })

    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 현재 세션의 마지막 대화 순서 찾기
    const lastConversation = await prisma.conversation.findFirst({
      where: { sessionId },
      orderBy: { order: 'desc' }
    })

    const order = lastConversation ? lastConversation.order + 1 : 1

    // 대화 저장
    const conversation = await prisma.conversation.create({
      data: {
        sessionId,
        userId: decoded.userId,
        question,
        answer: answer || '',
        order
      }
    })

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('Conversation save error:', error)
    return NextResponse.json(
      { error: '대화 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 세션의 대화 내용 가져오기
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

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: '세션 ID가 필요합니다.' }, { status: 400 })
    }

    // 세션이 사용자의 것인지 확인
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: decoded.userId
      }
    })

    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    const conversations = await prisma.conversation.findMany({
      where: { sessionId },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Conversations fetch error:', error)
    return NextResponse.json(
      { error: '대화 내용을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}