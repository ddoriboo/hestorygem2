import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'
import OpenAI from 'openai'

export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
    }

    const { sessionNumber, userMessage, conversationHistory = [] } = await request.json()

    if (!sessionNumber || sessionNumber < 1 || sessionNumber > 12) {
      return NextResponse.json({ error: '유효하지 않은 세션 번호입니다.' }, { status: 400 })
    }

    // 세션 프롬프트 가져오기
    const sessionPrompt = getSessionPrompt(sessionNumber)

    interface OpenAIMessage {
      role: 'system' | 'user' | 'assistant'
      content: string
    }

    interface ConversationItem {
      role: 'user' | 'assistant'
      content: string
    }

    // 대화 기록을 OpenAI 메시지 형식으로 변환
    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: sessionPrompt
      }
    ]

    // 기존 대화 기록 추가
    conversationHistory.forEach((conv: ConversationItem) => {
      messages.push({
        role: conv.role === 'assistant' ? 'assistant' : 'user',
        content: conv.content
      })
    })

    // 사용자 메시지 추가 (있을 경우)
    if (userMessage) {
      messages.push({
        role: 'user',
        content: userMessage
      })
    }

    console.log('OpenAI API 호출 중:', { sessionNumber, messageCount: messages.length })

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 음성이 아닌 텍스트 모델 사용
      messages,
      temperature: 0.7,
      max_tokens: 500
    })

    const aiResponse = completion.choices[0].message.content || ''

    console.log('AI 응답 생성 완료')

    return NextResponse.json({
      message: aiResponse,
      sessionNumber,
      success: true
    })

  } catch (error) {
    console.error('Chat API 오류:', error)
    return NextResponse.json(
      { error: '인터뷰 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}