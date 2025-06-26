import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'
import { GeminiLiveClient } from '@/lib/gemini-live'

export const runtime = 'nodejs'
export const maxDuration = 60

// 활성 세션 저장소
const activeSessions = new Map<string, GeminiLiveClient>()

// Server-Sent Events를 사용한 실시간 스트리밍
export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const sessionNumber = parseInt(url.searchParams.get('sessionNumber') || '1')
  const sessionId = url.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: '세션 ID가 필요합니다.' }, { status: 400 })
  }

  const googleApiKey = process.env.GOOGLE_API_KEY
  if (!googleApiKey) {
    return NextResponse.json({ error: 'Google API 키가 설정되지 않았습니다.' }, { status: 500 })
  }

  // Server-Sent Events 스트림 생성
  const stream = new ReadableStream({
    start(controller) {
      let geminiClient: GeminiLiveClient | null = null

      const cleanup = () => {
        if (geminiClient) {
          geminiClient.disconnect()
          activeSessions.delete(sessionId)
        }
      }

      // 초기화
      const init = async () => {
        try {
          geminiClient = new GeminiLiveClient(googleApiKey)
          activeSessions.set(sessionId, geminiClient)

          // 세션 프롬프트 가져오기
          const sessionPrompt = getSessionPrompt(sessionNumber)

          // 메시지 수신 처리 설정 (연결 전에 설정)
          geminiClient.onMessage((response) => {
            console.log('Gemini Live WebSocket 응답:', response)
            
            // 다양한 응답 타입 처리
            if (response.setupComplete) {
              controller.enqueue(`data: ${JSON.stringify({
                type: 'connected',
                sessionId,
                message: 'Gemini Live 연결 완료'
              })}\n\n`)
              
              // 초기 인사 메시지 전송
              setTimeout(() => {
                geminiClient!.sendText('안녕하세요! 오늘은 어떤 소중한 이야기를 들려주실까요?')
              }, 500)
            }
            
            if (response.serverContent) {
              const content = response.serverContent
              
              // 텍스트 응답
              if (content.modelTurn && content.modelTurn.parts) {
                for (const part of content.modelTurn.parts) {
                  if (part.text) {
                    controller.enqueue(`data: ${JSON.stringify({
                      type: 'text_response',
                      text: part.text
                    })}\n\n`)
                  }
                  
                  if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
                    controller.enqueue(`data: ${JSON.stringify({
                      type: 'audio_response',
                      audioData: part.inlineData.data
                    })}\n\n`)
                  }
                }
              }
            }
            
            // 기타 응답
            controller.enqueue(`data: ${JSON.stringify({
              type: 'raw_response',
              data: response
            })}\n\n`)
          })

          // Gemini Live 연결
          await geminiClient.connect({
            model: "models/gemini-2.5-flash-preview-native-audio-dialog",
            systemPrompt: sessionPrompt,
            responseModalities: ["AUDIO", "TEXT"]
          })

          console.log('Gemini Live WebSocket 초기화 완료')

        } catch (error) {
          console.error('Gemini Live 초기화 오류:', error)
          controller.enqueue(`data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : '초기화 실패',
            details: error
          })}\n\n`)
        }
      }

      // 하트비트
      const heartbeat = setInterval(() => {
        controller.enqueue(`data: ${JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        })}\n\n`)
      }, 30000)

      // 초기화 실행
      init()

      // 정리 함수
      return () => {
        cleanup()
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

// 오디오 데이터 전송
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

    const { sessionId, audioData, action } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: '세션 ID가 필요합니다.' }, { status: 400 })
    }

    const geminiClient = activeSessions.get(sessionId)
    if (!geminiClient) {
      return NextResponse.json({ error: '활성 세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    switch (action) {
      case 'sendAudio':
        if (audioData && Array.isArray(audioData)) {
          try {
            // Array를 Int16Array로 변환
            const int16Data = new Int16Array(audioData)
            await geminiClient.sendAudio(int16Data)
            return NextResponse.json({ status: 'audio_sent', length: audioData.length })
          } catch (error) {
            console.error('오디오 전송 실패:', error)
            return NextResponse.json({ error: '오디오 전송 실패', details: error }, { status: 500 })
          }
        }
        break

      case 'sendText':
        const { text } = await request.json()
        if (text) {
          try {
            await geminiClient.sendText(text)
            return NextResponse.json({ status: 'text_sent', text })
          } catch (error) {
            console.error('텍스트 전송 실패:', error)
            return NextResponse.json({ error: '텍스트 전송 실패', details: error }, { status: 500 })
          }
        }
        break

      case 'disconnect':
        try {
          await geminiClient.disconnect()
          activeSessions.delete(sessionId)
          return NextResponse.json({ status: 'disconnected' })
        } catch (error) {
          console.error('연결 해제 실패:', error)
          return NextResponse.json({ error: '연결 해제 실패', details: error }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: '알 수 없는 액션입니다.' }, { status: 400 })
    }

    return NextResponse.json({ status: 'success' })

  } catch (error) {
    console.error('Gemini Live 처리 오류:', error)
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}