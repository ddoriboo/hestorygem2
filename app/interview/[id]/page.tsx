'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import VoiceInterview from '@/components/VoiceInterview'
import TextInterview from '@/components/TextInterview'
import RealtimeVoiceInterview from '@/components/RealtimeVoiceInterview'

interface Conversation {
  id: string
  question: string
  answer: string
  order: number
}

interface Session {
  id: string
  sessionNumber: number
  title: string
  isCompleted: boolean
}

export default function InterviewPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  
  const [session, setSession] = useState<Session | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessionAndConversations()
  }, [sessionId, router])

  const fetchSessionAndConversations = async () => {
    try {
      // 세션 정보 가져오기
      const sessionsResponse = await fetch('/api/sessions')
      const sessionsData = await sessionsResponse.json()
      const currentSession = sessionsData.sessions.find((s: Session) => s.id === sessionId)
      
      if (!currentSession) {
        router.push('/')
        return
      }
      
      setSession(currentSession)

      // 기존 대화 내용 가져오기
      const conversationsResponse = await fetch(`/api/conversations?sessionId=${sessionId}`)
      const conversationsData = await conversationsResponse.json()
      setConversations(conversationsData.conversations || [])

      // 기존 대화 내용만 로드
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 음성 인터뷰 컴포넌트에서 대화 저장을 처리하므로 이 함수들은 제거

  const saveConversation = async (question: string, answer: string) => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, question, answer })
      })

      if (response.ok) {
        await fetchSessionAndConversations()
      }
    } catch (error) {
      console.error('Error saving conversation:', error)
    }
  }

  const handleCompleteSession = async () => {
    if (!confirm('이 세션을 완료하시겠습니까?')) return

    try {
      const response = await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (response.ok) {
        router.push('/')
      }
    } catch (error) {
      console.error('Error completing session:', error)
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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">세션 {session?.sessionNumber}</h1>
              <p className="text-lg text-gray-600 mt-1">{session?.title}</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-lg bg-gray-200 hover:bg-gray-300 rounded transition"
            >
              목록으로
            </button>
          </div>
        </div>
      </header>

      {/* 음성 인터뷰 영역 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 기존 대화 내용 표시 */}
        {conversations.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">이전 대화 기록</h3>
            <div className="max-h-60 overflow-y-auto space-y-4">
              {conversations.map((conv) => (
                <div key={conv.id} className="border-b border-gray-200 pb-4">
                  <div className="mb-2">
                    <p className="text-sm font-medium text-blue-700">AI:</p>
                    <p className="text-sm text-gray-700">{conv.question}</p>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-700">아버님:</p>
                    <p className="text-sm text-gray-700">{conv.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI 인터뷰 컴포넌트 - 텍스트 기반 (음성은 개발 중) */}
        <TextInterview
          sessionNumber={session?.sessionNumber || 1}
          onConversationSave={saveConversation}
        />
        
        {/* 실시간 음성 인터뷰 */}
        <div className="mt-6">
          <RealtimeVoiceInterview
            sessionNumber={session?.sessionNumber || 1}
            onConversationSave={saveConversation}
          />
        </div>

        {/* 개발용 컴포넌트들 */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-lg font-semibold text-gray-800 mb-2">🔧 개발자 도구</h4>
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer font-medium">이전 버전 컴포넌트들 (참고용)</summary>
            <div className="mt-4 space-y-4">
              <div className="p-3 bg-gray-100 rounded">
                <h5 className="font-medium text-gray-700 mb-2">기본 음성 인터뷰 컴포넌트:</h5>
                <VoiceInterview
                  sessionNumber={session?.sessionNumber || 1}
                  onConversationSave={saveConversation}
                />
              </div>
            </div>
          </details>
        </div>

        {/* 세션 완료 버튼 */}
        <div className="flex justify-center mt-6">
          <button
            onClick={handleCompleteSession}
            className="px-8 py-4 bg-green-600 text-white text-xl font-semibold rounded-lg hover:bg-green-700 transition shadow-lg"
          >
            세션 완료
          </button>
        </div>
      </main>
    </div>
  )
}