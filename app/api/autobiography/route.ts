import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import OpenAI from 'openai'

export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    // 사용자의 모든 대화 내용 가져오기
    const sessions = await prisma.session.findMany({
      where: { userId: decoded.userId },
      orderBy: { sessionNumber: 'asc' },
      include: {
        conversations: {
          orderBy: { order: 'asc' }
        }
      }
    })

    // 대화 내용이 없으면 에러 반환
    const totalConversations = sessions.reduce((sum, session) => 
      sum + session.conversations.length, 0
    )
    
    if (totalConversations === 0) {
      return NextResponse.json(
        { error: '자서전을 생성할 대화 내용이 없습니다.' },
        { status: 400 }
      )
    }

    // 모든 대화 내용을 텍스트로 정리
    let conversationText = ''
    for (const session of sessions) {
      if (session.conversations.length > 0) {
        conversationText += `\n\n## ${session.title}\n\n`
        for (const conv of session.conversations) {
          conversationText += `질문: ${conv.question}\n`
          conversationText += `답변: ${conv.answer}\n\n`
        }
      }
    }

    // ChatGPT API 호출
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `너는 따뜻한 문체를 가진 자서전 작가야. 주어진 인터뷰 기록을 바탕으로 아름답고 감동적인 자서전을 작성해야 해. 

작성 지침:
1. 1인칭 시점으로 작성 (나는, 내가 등)
2. 시간의 흐름에 따라 자연스럽게 이야기를 전개
3. 단순한 Q&A 나열이 아닌, 하나의 완성된 이야기로 재구성
4. 감정과 느낌을 풍부하게 표현
5. 각 장(Chapter)은 의미 있는 제목을 가지도록 구성
6. 전체적으로 따뜻하고 희망적인 톤 유지
7. 한국어로 작성`
        },
        {
          role: "user",
          content: `다음은 한 사람의 인생 인터뷰 기록입니다. 이를 바탕으로 감동적인 자서전 초고를 작성해주세요:\n\n${conversationText}`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })

    const autobiographyContent = completion.choices[0].message.content || ''

    // 자서전 저장 또는 업데이트
    const existingAutobiography = await prisma.autobiography.findUnique({
      where: { userId: decoded.userId }
    })

    if (existingAutobiography) {
      await prisma.autobiography.update({
        where: { userId: decoded.userId },
        data: { content: autobiographyContent }
      })
    } else {
      await prisma.autobiography.create({
        data: {
          userId: decoded.userId,
          content: autobiographyContent
        }
      })
    }

    return NextResponse.json({ 
      message: '자서전이 성공적으로 생성되었습니다.',
      autobiography: autobiographyContent 
    })
  } catch (error) {
    console.error('Autobiography generation error:', error)
    return NextResponse.json(
      { error: '자서전 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 저장된 자서전 가져오기
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

    const autobiography = await prisma.autobiography.findUnique({
      where: { userId: decoded.userId }
    })

    if (!autobiography) {
      return NextResponse.json({ error: '자서전을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ autobiography })
  } catch (error) {
    console.error('Autobiography fetch error:', error)
    return NextResponse.json(
      { error: '자서전을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}