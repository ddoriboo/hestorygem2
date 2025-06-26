import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'

export const runtime = 'nodejs'

// Gemini Live API 세션 생성
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

    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({ error: 'Google API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 세션별 상세 프롬프트 사용
    const sessionPrompt = getSessionPrompt(sessionNumber)

    // Gemini API 키와 설정을 클라이언트에 안전하게 전달
    
    return NextResponse.json({ 
      apiKey: googleApiKey,
      sessionPrompt: sessionPrompt + "\n\n말할 때는 자연스럽고 빠르게 말해주세요.",
      model: 'gemini-2.5-flash-preview-native-audio-dialog'
    })

  } catch (error) {
    console.error('세션 생성 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}