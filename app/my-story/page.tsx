'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Conversation {
  id: string
  question: string
  answer: string
  order: number
  createdAt: string
}

interface SessionWithConversations {
  id: string
  sessionNumber: number
  title: string
  isCompleted: boolean
  conversations: Conversation[]
  summary: {
    conversationCount: number
    firstQuestion: string
    lastAnswer: string
  }
}

export default function MyStoryPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionWithConversations[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [generatingStory, setGeneratingStory] = useState(false)

  useEffect(() => {
    fetchAllConversations()
  }, [router])

  const fetchAllConversations = async () => {
    try {
      const response = await fetch('/api/conversations/all')
      if (!response.ok) {
        router.push('/login')
        return
      }
      const data = await response.json()
      setSessions(data.sessions)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  const handleGenerateAutobiography = async () => {
    setGeneratingStory(true)
    try {
      const response = await fetch('/api/autobiography', {
        method: 'POST'
      })
      
      if (response.ok) {
        router.push('/autobiography')
      } else {
        alert('자서전 생성 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('Error generating autobiography:', error)
      alert('자서전 생성 중 오류가 발생했습니다.')
    } finally {
      setGeneratingStory(false)
    }
  }

  const totalConversations = sessions.reduce((sum, session) => 
    sum + session.conversations.length, 0
  )

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
            <h1 className="text-3xl font-bold text-gray-900">내 이야기</h1>
            <Link
              href="/"
              className="px-4 py-2 text-lg bg-gray-200 hover:bg-gray-300 rounded transition"
            >
              홈으로
            </Link>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 통계 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-blue-600">{sessions.length}</p>
              <p className="text-lg text-gray-600">전체 세션</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600">
                {sessions.filter(s => s.isCompleted).length}
              </p>
              <p className="text-lg text-gray-600">완료된 세션</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-purple-600">{totalConversations}</p>
              <p className="text-lg text-gray-600">총 대화 수</p>
            </div>
          </div>
        </div>

        {/* 자서전 생성 버튼 */}
        {totalConversations > 0 && (
          <div className="text-center mb-8">
            <button
              onClick={handleGenerateAutobiography}
              disabled={generatingStory}
              className="px-8 py-4 bg-green-600 text-white text-xl font-semibold rounded-lg hover:bg-green-700 transition shadow-lg disabled:bg-gray-400"
            >
              {generatingStory ? '자서전 생성 중...' : '자서전 초고 만들기'}
            </button>
          </div>
        )}

        {/* 세션별 대화 내용 */}
        <div className="space-y-6">
          {sessions.map((session) => (
            <div key={session.id} className="bg-white rounded-lg shadow">
              <div
                className="p-6 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleSession(session.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      세션 {session.sessionNumber}: {session.title}
                    </h2>
                    <p className="text-gray-600 mt-1">
                      {session.summary.conversationCount}개의 대화
                      {session.isCompleted && (
                        <span className="ml-2 text-green-600">(완료됨)</span>
                      )}
                    </p>
                  </div>
                  <div className="text-2xl">
                    {expandedSessions.has(session.id) ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {expandedSessions.has(session.id) && (
                <div className="border-t px-6 py-4 bg-gray-50">
                  {session.conversations.length === 0 ? (
                    <p className="text-gray-500">아직 대화가 없습니다.</p>
                  ) : (
                    <div className="space-y-4">
                      {session.conversations.map((conv) => (
                        <div key={conv.id} className="border-l-4 border-blue-400 pl-4">
                          <div className="mb-2">
                            <p className="font-medium text-blue-700">AI:</p>
                            <p className="text-gray-800">{conv.question}</p>
                          </div>
                          <div className="ml-4">
                            <p className="font-medium text-green-700">아버님:</p>
                            <p className="text-gray-800">{conv.answer || '(답변 없음)'}</p>
                          </div>
                          <p className="text-sm text-gray-500 mt-2">
                            {new Date(conv.createdAt).toLocaleString('ko-KR')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {sessions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-600">아직 시작된 세션이 없습니다.</p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              세션 시작하기
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}