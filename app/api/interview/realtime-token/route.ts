import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'

// OpenAI Realtime API 세션 생성
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

    const { sessionNumber } = await request.json()

    if (sessionNumber < 1 || sessionNumber > 12) {
      return NextResponse.json({ error: '유효하지 않은 세션 번호입니다.' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 세션별 프롬프트
    const sessionPrompt = `당신은 노인 분들의 인생 이야기를 듣는 친근한 AI 인터뷰어입니다. 
세션 ${sessionNumber}에 맞는 질문을 하세요.

대화 규칙:
- 자연스럽고 따뜻한 대화를 나누세요
- 한 번에 하나의 질문만 하세요  
- 응답을 충분히 들어주세요
- 추가 질문으로 더 깊이 있는 이야기를 이끌어내세요
- 존댓말을 사용하고 "아버님" 또는 "어머님"으로 호칭하세요

첫 인사를 시작해주세요.`

    // OpenAI Realtime API 세션 생성
    const sessionResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'sol',
        instructions: sessionPrompt + "\n\n말할 때는 자연스럽고 빠르게 말해주세요.",
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800
        },
        temperature: 0.7,
        max_response_output_tokens: 150
      })
    })

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text()
      console.error('OpenAI 세션 생성 실패:', errorText)
      return NextResponse.json({ 
        error: `OpenAI 세션 생성 실패: ${sessionResponse.status}` 
      }, { status: 500 })
    }

    const sessionData = await sessionResponse.json()
    
    return NextResponse.json({ 
      sessionToken: sessionData.client_secret.value,
      sessionId: sessionData.id
    })

  } catch (error) {
    console.error('세션 생성 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}