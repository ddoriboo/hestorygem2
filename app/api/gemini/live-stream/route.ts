import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'

export const runtime = 'nodejs'

// Gemini Live API 스트리밍 연결
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

    const { sessionNumber, audioData, messageType } = await request.json()

    if (sessionNumber < 1 || sessionNumber > 12) {
      return NextResponse.json({ error: '유효하지 않은 세션 번호입니다.' }, { status: 400 })
    }

    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: 'Google API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 세션별 프롬프트 가져오기
    const sessionPrompt = getSessionPrompt(sessionNumber)

    // Server-Sent Events 스트림 생성
    const stream = new ReadableStream({
      start(controller) {
        // Gemini Live API 연결 시뮬레이션
        // 실제로는 Google AI SDK를 사용해야 함
        controller.enqueue(`data: ${JSON.stringify({
          type: 'connected',
          message: 'Gemini Live API 연결됨'
        })}\n\n`)

        // 세션 설정 메시지
        controller.enqueue(`data: ${JSON.stringify({
          type: 'session_config',
          config: {
            model: 'gemini-2.0-flash-live-001',
            response_modalities: ['AUDIO', 'TEXT'],
            instructions: sessionPrompt,
            language: 'ko'
          }
        })}\n\n`)

        // 첫 인사 메시지
        setTimeout(() => {
          controller.enqueue(`data: ${JSON.stringify({
            type: 'text_response',
            text: '안녕하세요, 아버님. 저는 구글의 Gemini AI입니다. 오늘은 소중한 인생 이야기를 들려주시면 감사하겠습니다.'
          })}\n\n`)
        }, 1000)

        // 연결 유지를 위한 heartbeat
        const heartbeat = setInterval(() => {
          controller.enqueue(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now()
          })}\n\n`)
        }, 30000)

        // 정리 함수
        return () => {
          clearInterval(heartbeat)
        }
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })

  } catch (error) {
    console.error('Gemini Live 스트림 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// OPTIONS 메서드 처리 (CORS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}