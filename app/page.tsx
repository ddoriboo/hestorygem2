'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { sessionPrompts } from '@/lib/session-prompts'

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
  const [user, setUser] = useState<{id: string, username: string, createdAt: string} | null>(null)
  const [selectedSessionNumber, setSelectedSessionNumber] = useState<number | null>(null)

  const fetchUserAndSessions = async () => {
    try {
      console.log('홈페이지 데이터 로딩 시작')
      // 사용자 정보 가져오기
      const userResponse = await fetch('/api/auth/me')
      console.log('사용자 인증 응답 상태:', userResponse.status)
      
      if (!userResponse.ok) {
        console.log('인증 실패, 로그인 페이지로 리다이렉트')
        router.push('/login')
        return
      }

      const userData = await userResponse.json()
      console.log('사용자 데이터:', userData)
      setUser(userData.user)

      // 세션 목록 가져오기
      const sessionResponse = await fetch('/api/sessions')
      console.log('세션 목록 응답 상태:', sessionResponse.status)
      
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json()
        console.log('세션 데이터:', sessionData)
        setSessions(sessionData.sessions)
      }
    } catch (error) {
      console.error('홈페이지 데이터 로딩 에러:', error)
      router.push('/login')
    } finally {
      setLoading(false)
      console.log('홈페이지 데이터 로딩 완료')
    }
  }

  useEffect(() => {
    fetchUserAndSessions()
  }, [router])


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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">He&apos;story</h1>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <span className="text-base sm:text-lg text-gray-700">안녕하세요, {user?.username}님</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-base sm:text-lg bg-gray-200 hover:bg-gray-300 rounded transition"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
          <h2 className="text-xl sm:text-2xl font-semibold">인터뷰 세션 목록</h2>
          <Link
            href="/my-story"
            className="px-4 py-2 sm:px-6 sm:py-3 bg-green-600 text-white text-base sm:text-lg rounded hover:bg-green-700 transition text-center"
          >
            내 이야기 보기
          </Link>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                  세션 {session.sessionNumber}
                </h3>
                {session.isCompleted && (
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-green-100 text-green-800 text-xs sm:text-sm rounded">
                    완료
                  </span>
                )}
              </div>
              
              <p 
                className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4 cursor-pointer hover:text-blue-600 transition-colors line-clamp-2"
                onClick={() => setSelectedSessionNumber(session.sessionNumber)}
                title="클릭하여 질문 목록 보기"
              >
                {session.title}
              </p>
              
              {session.conversationCount > 0 && (
                <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                  {session.conversationCount}개의 대화
                </p>
              )}

              <div className="flex flex-col space-y-2">
                <Link
                  href={`/interview/${session.id}`}
                  className="w-full px-3 py-2 sm:px-4 bg-blue-600 text-white text-center text-sm sm:text-base rounded hover:bg-blue-700 transition"
                >
                  {session.conversationCount > 0 ? '계속하기' : '시작하기'}
                </Link>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleResetSession(session.id)}
                    className="flex-1 px-3 py-1.5 sm:px-4 sm:py-2 bg-yellow-500 text-white text-sm sm:text-base rounded hover:bg-yellow-600 transition"
                  >
                    다시하기
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="flex-1 px-3 py-1.5 sm:px-4 sm:py-2 bg-red-500 text-white text-sm sm:text-base rounded hover:bg-red-600 transition"
                  >
                    삭제하기
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 세션 질문 미리보기 팝업 */}
      {selectedSessionNumber && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedSessionNumber(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 팝업 헤더 */}
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold">
                세션 {selectedSessionNumber}: {sessionPrompts[selectedSessionNumber]?.title}
              </h3>
              <button
                onClick={() => setSelectedSessionNumber(null)}
                className="text-white hover:text-gray-200 text-2xl"
              >
                ×
              </button>
            </div>

            {/* 팝업 내용 */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="mb-4">
                <p className="text-gray-600 mb-4">
                  이 세션에서는 아버님께서 다음과 같은 질문들을 통해 인생 이야기를 들려주시게 됩니다.
                </p>
              </div>

              <div className="space-y-3">
                {sessionPrompts[selectedSessionNumber]?.questions.map((question, index) => (
                  <div key={index} className="flex items-start">
                    <span className="text-blue-600 font-semibold mr-2 mt-0.5">
                      {index + 1}.
                    </span>
                    <p className="text-gray-700 flex-1">{question}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>팁:</strong> 편안한 마음으로 천천히 이야기해주세요. 
                  AI 인터뷰어가 아버님의 속도에 맞춰 대화를 이어갑니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
