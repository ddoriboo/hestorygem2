import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

// 클라이언트가 Gemini Live API에 연결하기 위한 설정 반환
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

  const googleApiKey = process.env.GOOGLE_API_KEY
  if (!googleApiKey) {
    return NextResponse.json({ error: 'Google API 키가 설정되지 않았습니다.' }, { status: 500 })
  }

  // 세션 프롬프트 가져오기
  const sessionPrompt = getSessionPrompt(sessionNumber)

  return NextResponse.json({
    apiKey: googleApiKey,
    sessionPrompt,
    model: 'gemini-2.5-flash-preview-native-audio-dialog'
  })
}

