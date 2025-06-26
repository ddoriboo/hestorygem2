import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'

// Gemini 텍스트 인터뷰 API
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

    const { sessionNumber, userMessage, conversationHistory } = await request.json()

    if (sessionNumber < 1 || sessionNumber > 12) {
      return NextResponse.json({ error: '유효하지 않은 세션 번호입니다.' }, { status: 400 })
    }

    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: 'Google API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // Google AI 클라이언트 초기화
    const genAI = new GoogleGenerativeAI(googleApiKey)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.8,
        topP: 0.9,
        maxOutputTokens: 1000,
      }
    })

    // 세션별 시스템 프롬프트
    const sessionPrompt = getSessionPrompt(sessionNumber)

    // 대화 히스토리 구성
    const messages = [
      {
        role: 'user',
        parts: [{ text: sessionPrompt }]
      }
    ]

    // 기존 대화 추가
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: any) => {
        messages.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })
      })
    }

    // 사용자 메시지 추가
    if (userMessage) {
      messages.push({
        role: 'user',
        parts: [{ text: userMessage }]
      })
    }

    // Gemini에게 응답 요청
    const chat = model.startChat({
      history: messages.slice(0, -1), // 마지막 메시지 제외하고 히스토리로 설정
    })

    const result = await chat.sendMessage(userMessage || "대화를 시작해주세요.")
    const response = await result.response
    const aiMessage = response.text()

    return NextResponse.json({
      message: aiMessage,
      sessionNumber,
      model: 'gemini-2.0-flash-exp',
      success: true
    })

  } catch (error) {
    console.error('Gemini 인터뷰 오류:', error)
    
    // Gemini API 특정 오류 처리
    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        return NextResponse.json(
          { error: 'Google API 키 오류입니다.' },
          { status: 401 }
        )
      }
      if (error.message.includes('QUOTA_EXCEEDED')) {
        return NextResponse.json(
          { error: 'API 할당량이 초과되었습니다.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}