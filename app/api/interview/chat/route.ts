import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

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

    interface ConversationItem {
      role: 'user' | 'assistant'
      content: string
    }

    // Gemini 모델 초기화
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.8,
        topP: 0.9,
        maxOutputTokens: 500,
      }
    })

    // 대화 히스토리를 Gemini 형식으로 변환
    const history = conversationHistory.map((conv: ConversationItem) => ({
      role: conv.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: conv.content }]
    }))

    console.log('Gemini API 호출 중:', { sessionNumber, historyCount: history.length })

    // Gemini 채팅 시작
    const chat = model.startChat({
      history,
      systemInstruction: sessionPrompt
    })

    // Gemini API 호출
    const result = await chat.sendMessage(userMessage || "대화를 시작해주세요.")
    const response = await result.response
    const aiResponse = response.text()

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