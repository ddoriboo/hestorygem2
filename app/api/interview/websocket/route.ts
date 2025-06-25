import { NextRequest, NextResponse } from 'next/server'
import { WebSocket } from 'ws'
import { verifyToken } from '@/lib/auth'
import { getSessionPrompt } from '@/lib/session-prompts'

export const runtime = 'nodejs'

// WebSocket 프록시 서버 (실제 구현에서는 별도 서버가 필요할 수 있음)
export async function GET(request: NextRequest) {
  // WebSocket 업그레이드는 Next.js API Routes에서 직접 지원하지 않음
  // 대신 간단한 텍스트 기반 인터뷰로 대체 구현을 제공

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

    if (sessionNumber < 1 || sessionNumber > 12) {
      return NextResponse.json({ error: '유효하지 않은 세션 번호입니다.' }, { status: 400 })
    }

    // 현재는 WebSocket 프록시 대신 HTTP 기반 대화 시스템 사용을 안내
    return NextResponse.json({
      message: 'WebSocket 프록시는 현재 개발 중입니다. 텍스트 기반 인터뷰를 사용해주세요.',
      fallbackUrl: '/api/interview/chat'
    })

  } catch (error) {
    console.error('WebSocket 프록시 오류:', error)
    return NextResponse.json(
      { error: '연결 설정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}