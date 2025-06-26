import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'

export const runtime = 'nodejs'

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

    const { sessionNumber } = await request.json()

    if (!sessionNumber || sessionNumber < 1 || sessionNumber > 12) {
      return NextResponse.json({ error: '유효하지 않은 세션 번호입니다.' }, { status: 400 })
    }

    // 세션 프롬프트 가져오기
    const sessionPrompt = getSessionPrompt(sessionNumber)

    // Gemini API 키 반환 (클라이언트에서 직접 연결)
    return NextResponse.json({
      apiKey: process.env.GOOGLE_API_KEY,
      sessionPrompt,
      sessionNumber,
      model: 'gemini-2.5-flash-preview-native-audio-dialog'
    })

  } catch (error) {
    console.error('Realtime API setup error:', error)
    return NextResponse.json(
      { error: '음성 인터뷰 설정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}