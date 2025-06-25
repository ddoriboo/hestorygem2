import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

export const runtime = 'nodejs'

// WebSocket 연결을 위한 HTTP 업그레이드 처리
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return new Response('Unauthorized', { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return new Response('Invalid token', { status: 401 })
    }

    const url = new URL(request.url)
    const sessionNumber = parseInt(url.searchParams.get('sessionNumber') || '1')

    if (sessionNumber < 1 || sessionNumber > 12) {
      return new Response('Invalid session number', { status: 400 })
    }

    // WebSocket 업그레이드 헤더 확인
    const upgrade = request.headers.get('upgrade')
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 400 })
    }

    // Next.js의 경우 WebSocket 업그레이드를 직접 처리할 수 없으므로
    // 클라이언트에게 올바른 연결 정보를 제공
    return new Response(JSON.stringify({
      error: 'WebSocket upgrade not supported in Next.js API routes',
      suggestion: 'Use polling-based communication instead',
      endpoint: '/api/interview/realtime-polling'
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('WebSocket 처리 오류:', error)
    return new Response('Server error', { status: 500 })
  }
}