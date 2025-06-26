import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60초 타임아웃

// Gemini Live API 설정
const MODEL = "models/gemini-2.5-flash-preview-native-audio-dialog"

// 세션 저장소 (실제로는 Redis나 DB를 사용해야 함)
const sessions = new Map<string, any>()

// 세션 초기화
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

    const { action, sessionId, sessionNumber, audioData } = await request.json()

    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: 'Google API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // Action에 따른 처리
    switch (action) {
      case 'init':
        return handleInit(sessionNumber, googleApiKey, decoded.userId)
      
      case 'sendAudio':
        return handleSendAudio(sessionId, audioData, googleApiKey)
      
      case 'getResponse':
        return handleGetResponse(sessionId, googleApiKey)
      
      case 'close':
        return handleClose(sessionId)
      
      default:
        return NextResponse.json({ error: '알 수 없는 액션입니다.' }, { status: 400 })
    }

  } catch (error) {
    console.error('Gemini Realtime 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

async function handleInit(sessionNumber: number, apiKey: string, userId: string) {
  try {
    // 세션 ID 생성
    const sessionId = `gemini-${userId}-${Date.now()}`
    
    // 세션 프롬프트 가져오기
    const sessionPrompt = getSessionPrompt(sessionNumber)
    
    // Gemini 클라이언트 초기화
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // Live 모델 설정
    const model = genAI.getGenerativeModel({ 
      model: MODEL,
      generationConfig: {
        temperature: 0.8,
        candidateCount: 1,
      }
    })

    // 세션 정보 저장
    sessions.set(sessionId, {
      model,
      sessionNumber,
      userId,
      systemPrompt: sessionPrompt,
      conversationHistory: [],
      audioBuffer: [],
      createdAt: Date.now()
    })

    // 30분 후 자동 정리
    setTimeout(() => {
      sessions.delete(sessionId)
    }, 30 * 60 * 1000)

    return NextResponse.json({
      sessionId,
      message: 'Gemini Live 세션이 초기화되었습니다.',
      config: {
        model: MODEL,
        responseModalities: ['AUDIO', 'TEXT'],
        sampleRate: 16000,
        language: 'ko'
      }
    })

  } catch (error) {
    console.error('세션 초기화 오류:', error)
    throw error
  }
}

async function handleSendAudio(sessionId: string, audioData: number[], apiKey: string) {
  try {
    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 오디오 데이터를 버퍼에 추가
    session.audioBuffer.push(...audioData)

    // 버퍼가 충분히 쌓이면 처리 (약 1초 분량)
    if (session.audioBuffer.length >= 16000) {
      // 여기서 실제 Gemini Live API 호출이 필요
      // 현재는 시뮬레이션
      const response = await processAudioWithGemini(session, apiKey)
      
      // 버퍼 초기화
      session.audioBuffer = []
      
      return NextResponse.json({
        status: 'processing',
        bufferSize: session.audioBuffer.length,
        response
      })
    }

    return NextResponse.json({
      status: 'buffering',
      bufferSize: session.audioBuffer.length
    })

  } catch (error) {
    console.error('오디오 전송 오류:', error)
    throw error
  }
}

async function handleGetResponse(sessionId: string, apiKey: string) {
  try {
    const session = sessions.get(sessionId)
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 시뮬레이션된 응답 (실제로는 Gemini Live API에서 받아야 함)
    const mockResponse = {
      text: "네, 말씀해 주세요. 듣고 있습니다.",
      audioData: generateMockAudioData(),
      isComplete: true
    }

    return NextResponse.json(mockResponse)

  } catch (error) {
    console.error('응답 가져오기 오류:', error)
    throw error
  }
}

async function handleClose(sessionId: string) {
  try {
    sessions.delete(sessionId)
    return NextResponse.json({ message: '세션이 종료되었습니다.' })
  } catch (error) {
    console.error('세션 종료 오류:', error)
    throw error
  }
}

// Gemini와 오디오 처리 (시뮬레이션)
async function processAudioWithGemini(session: any, apiKey: string) {
  // 실제 구현에서는 Google의 Gemini Live API를 호출해야 함
  // 현재는 텍스트 기반 응답으로 시뮬레이션
  
  try {
    const { model, systemPrompt, conversationHistory } = session
    
    // 오디오를 텍스트로 변환했다고 가정
    const userText = "안녕하세요, 제 이야기를 들려드리겠습니다."
    
    // 대화 히스토리 구성
    const messages = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...conversationHistory,
      { role: 'user', parts: [{ text: userText }] }
    ]
    
    // Gemini 텍스트 응답 (Live API가 아닌 일반 API 사용)
    const chat = model.startChat({
      history: messages.slice(0, -1)
    })
    
    const result = await chat.sendMessage(userText)
    const response = await result.response
    const aiText = response.text()
    
    // 대화 기록 업데이트
    session.conversationHistory.push(
      { role: 'user', parts: [{ text: userText }] },
      { role: 'model', parts: [{ text: aiText }] }
    )
    
    return {
      text: aiText,
      userTranscript: userText
    }
    
  } catch (error) {
    console.error('Gemini 처리 오류:', error)
    return {
      text: "죄송합니다. 잠시 문제가 발생했습니다. 다시 말씀해 주시겠어요?",
      error: true
    }
  }
}

// 모의 오디오 데이터 생성 (24kHz PCM)
function generateMockAudioData(): number[] {
  // 실제로는 TTS를 사용해야 함
  const duration = 1 // 1초
  const sampleRate = 24000
  const samples = duration * sampleRate
  const data: number[] = []
  
  // 무음 데이터
  for (let i = 0; i < samples; i++) {
    data.push(0)
  }
  
  return data
}