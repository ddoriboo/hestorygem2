'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Session {
  id: string
  sessionNumber: number
  title: string
  description: string | null
  isCompleted: boolean
  conversationCount: number
}

export default function HomePage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetchUserAndSessions()
  }, [])

  const fetchUserAndSessions = async () => {
    try {
      // 사용자 정보 가져오기
      const userResponse = await fetch('/api/auth/me')
      if (!userResponse.ok) {
        router.push('/login')
        return
      }
      const userData = await userResponse.json()
      setUser(userData.user)

      // 세션 목록 가져오기
      const sessionsResponse = await fetch('/api/sessions')
      const sessionsData = await sessionsResponse.json()
      setSessions(sessionsData.sessions)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('정말로 이 세션을 삭제하시겠습니까?')) return

    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (response.ok) {
        await fetchUserAndSessions()
      }
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  const handleResetSession = async (sessionId: string) => {
    if (!confirm('이 세션의 모든 대화 내용이 삭제됩니다. 계속하시겠습니까?')) return

    try {
      const response = await fetch('/api/sessions/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (response.ok) {
        await fetchUserAndSessions()
      }
    } catch (error) {
      console.error('Error resetting session:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">He'story</h1>
            <div className="flex items-center space-x-4">
              <span className="text-lg text-gray-700">안녕하세요, {user?.username}님</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-lg bg-gray-200 hover:bg-gray-300 rounded transition"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-2xl font-semibold">인터뷰 세션 목록</h2>
          <Link
            href="/my-story"
            className="px-6 py-3 bg-green-600 text-white text-lg rounded hover:bg-green-700 transition"
          >
            내 이야기 보기
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  세션 {session.sessionNumber}
                </h3>
                {session.isCompleted && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded">
                    완료
                  </span>
                )}
              </div>
              
              <p className="text-gray-700 mb-4">{session.title}</p>
              
              {session.conversationCount > 0 && (
                <p className="text-sm text-gray-500 mb-4">
                  {session.conversationCount}개의 대화
                </p>
              )}

              <div className="flex flex-col space-y-2">
                <Link
                  href={`/interview/${session.id}`}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 transition"
                >
                  {session.conversationCount > 0 ? '계속하기' : '시작하기'}
                </Link>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleResetSession(session.id)}
                    className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
                  >
                    다시하기
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                  >
                    삭제하기
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
