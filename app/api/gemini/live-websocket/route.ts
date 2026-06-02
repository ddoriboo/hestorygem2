import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'gemini-2.5-flash-preview-native-audio-dialog'

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

  // 영구 API 키를 클라이언트로 노출하지 않고, 단명(single-use, ~30분 만료)
  // ephemeral token을 발급해 전달한다. 클라이언트는 이 토큰으로만 Live API에 연결한다.
  try {
    const ai = new GoogleGenAI({ apiKey: googleApiKey, httpOptions: { apiVersion: 'v1alpha' } })
    const ephemeral = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      },
    })

    return NextResponse.json({
      apiKey: ephemeral.name, // ephemeral token (영구 키 아님)
      sessionPrompt,
      model: MODEL,
    })
  } catch (error) {
    console.error('ephemeral token 발급 오류:', error)
    return NextResponse.json({ error: '음성 세션 토큰 발급에 실패했습니다.' }, { status: 502 })
  }
}

