import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import WebSocket from 'ws'

export const runtime = 'nodejs'

interface SessionMessage {
  type: string
  timestamp: number
  [key: string]: unknown
}

// 활성 세션을 저장하는 Map
const activeSessions = new Map<string, {
  ws: WebSocket,
  messageQueue: SessionMessage[],
  lastActivity: number
}>()

// 5분 후 비활성 세션 정리
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > 5 * 60 * 1000) {
      session.ws.close()
      activeSessions.delete(sessionId)
    }
  }
}, 60000) // 1분마다 확인

// 세션 시작
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

    const { sessionNumber, action, data } = await request.json()
    const sessionId = `${decoded.userId}_${sessionNumber}`

    if (action === 'start') {
      // 기존 세션이 있으면 종료
      const existingSession = activeSessions.get(sessionId)
      if (existingSession) {
        existingSession.ws.close()
        activeSessions.delete(sessionId)
      }

      // OpenAI Realtime API WebSocket 연결
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (!openaiApiKey) {
        return NextResponse.json({ error: 'OpenAI API 키가 설정되지 않았습니다.' }, { status: 500 })
      }

      const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      })

      const messageQueue: SessionMessage[] = []

      ws.on('open', () => {
        console.log(`세션 ${sessionId} OpenAI Realtime API 연결됨`)
        
        // 세션 설정
        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions: `당신은 노인 분들의 인생 이야기를 듣는 친근한 AI 인터뷰어입니다. 
세션 ${sessionNumber}에 맞는 질문을 하세요.
- 자연스럽고 따뜻한 대화를 나누세요
- 한 번에 하나의 질문만 하세요  
- 응답을 충분히 들어주세요
- 추가 질문으로 더 깊이 있는 이야기를 이끌어내세요`,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            temperature: 0.7,
            max_response_output_tokens: 300
          }
        }

        ws.send(JSON.stringify(sessionConfig))
        
        // 초기 응답 요청
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'response.create' }))
        }, 1000)
      })

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as Record<string, unknown>
          messageQueue.push({
            type: message.type as string,
            ...message,
            timestamp: Date.now()
          })
        } catch (error) {
          console.error('메시지 파싱 오류:', error)
        }
      })

      ws.on('error', (error) => {
        console.error(`세션 ${sessionId} 오류:`, error)
        messageQueue.push({
          type: 'error',
          error: { message: error.message },
          timestamp: Date.now()
        })
      })

      ws.on('close', () => {
        console.log(`세션 ${sessionId} 연결 종료`)
        activeSessions.delete(sessionId)
      })

      // 세션 저장
      activeSessions.set(sessionId, {
        ws,
        messageQueue,
        lastActivity: Date.now()
      })

      return NextResponse.json({ success: true, sessionId })
    
    } else if (action === 'send') {
      // 메시지 전송
      const session = activeSessions.get(sessionId)
      if (!session) {
        return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
      }

      session.lastActivity = Date.now()
      session.ws.send(JSON.stringify(data))
      
      return NextResponse.json({ success: true })
    
    } else if (action === 'close') {
      // 세션 종료
      const session = activeSessions.get(sessionId)
      if (session) {
        session.ws.close()
        activeSessions.delete(sessionId)
      }
      
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '유효하지 않은 액션입니다.' }, { status: 400 })

  } catch (error) {
    console.error('Realtime 폴링 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 메시지 폴링
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

    const url = new URL(request.url)
    const sessionNumber = parseInt(url.searchParams.get('sessionNumber') || '1')
    const lastTimestamp = parseInt(url.searchParams.get('lastTimestamp') || '0')
    
    const sessionId = `${decoded.userId}_${sessionNumber}`
    const session = activeSessions.get(sessionId)
    
    if (!session) {
      return NextResponse.json({ messages: [], connected: false })
    }

    session.lastActivity = Date.now()

    // 새로운 메시지만 반환
    const newMessages = session.messageQueue.filter(msg => msg.timestamp > lastTimestamp)
    
    return NextResponse.json({ 
      messages: newMessages,
      connected: true,
      lastTimestamp: session.messageQueue.length > 0 
        ? Math.max(...session.messageQueue.map(m => m.timestamp))
        : Date.now()
    })

  } catch (error) {
    console.error('메시지 폴링 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}