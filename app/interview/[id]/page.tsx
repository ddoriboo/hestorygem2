'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSessionPrompt } from '@/lib/session-prompts'

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
  const [isRecording, setIsRecording] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [userAnswer, setUserAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [aiResponse, setAiResponse] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchSessionAndConversations()
  }, [sessionId, router])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, currentQuestion])

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

      // 세션이 시작되지 않았으면 초기 메시지 설정
      if (!conversationsData.conversations || conversationsData.conversations.length === 0) {
        const systemPrompt = getSessionPrompt(currentSession.sessionNumber)
        const initialMessage = systemPrompt.split('세션을 시작하세요.')[1].trim()
        setCurrentQuestion(initialMessage)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartConversation = async () => {
    if (!session) return
    
    setIsRecording(true)
    // 여기서는 일단 텍스트 입력으로 대체
    // 실제로는 음성 녹음 기능을 구현해야 함
  }

  const handleStopConversation = async () => {
    setIsRecording(false)
    
    if (!userAnswer.trim()) return

    // 대화 저장
    await saveConversation(currentQuestion, userAnswer)
    
    // AI 응답 생성 (여기서는 간단한 응답으로 대체)
    // 실제로는 OpenAI API를 호출해야 함
    setAiResponse('아버님의 소중한 이야기 감사합니다. 다음 질문으로 넘어가겠습니다.')
    
    // 다음 질문 설정 (임시)
    setCurrentQuestion('다음 질문입니다...')
    setUserAnswer('')
  }

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

      {/* 대화 영역 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6" style={{ minHeight: '400px', maxHeight: '600px', overflowY: 'auto' }}>
          {/* 기존 대화 내용 표시 */}
          {conversations.map((conv) => (
            <div key={conv.id} className="mb-6">
              <div className="mb-3">
                <p className="text-lg font-medium text-blue-700">AI:</p>
                <p className="text-lg text-gray-800 mt-1">{conv.question}</p>
              </div>
              <div className="ml-8">
                <p className="text-lg font-medium text-green-700">아버님:</p>
                <p className="text-lg text-gray-800 mt-1">{conv.answer}</p>
              </div>
            </div>
          ))}

          {/* 현재 질문 */}
          {currentQuestion && (
            <div className="mb-6">
              <div className="mb-3">
                <p className="text-lg font-medium text-blue-700">AI:</p>
                <p className="text-lg text-gray-800 mt-1">{currentQuestion}</p>
              </div>
            </div>
          )}

          {/* AI 응답 */}
          {aiResponse && (
            <div className="mb-6">
              <p className="text-lg text-gray-600 italic">{aiResponse}</p>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 입력 영역 (임시 텍스트 입력) */}
        {isRecording && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="답변을 입력하세요..."
              className="w-full p-4 text-lg border rounded resize-none"
              rows={4}
            />
          </div>
        )}

        {/* 버튼 영역 */}
        <div className="flex justify-center space-x-4">
          {!isRecording ? (
            <button
              onClick={handleStartConversation}
              className="px-8 py-4 bg-blue-600 text-white text-xl font-semibold rounded-lg hover:bg-blue-700 transition shadow-lg"
            >
              대화 시작하기
            </button>
          ) : (
            <button
              onClick={handleStopConversation}
              className="px-8 py-4 bg-red-600 text-white text-xl font-semibold rounded-lg hover:bg-red-700 transition shadow-lg"
            >
              답변 완료
            </button>
          )}
          
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