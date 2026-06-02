'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Brand from '@/components/ui/Brand'

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
      <div className="min-h-screen flex items-center justify-center bg-ground">
        <div className="text-ink-72 text-xl">불러오는 중…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ground">
      {/* 헤더 */}
      <header className="border-b border-line bg-surface/60 backdrop-blur">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex justify-between items-center">
          <Brand size="sm" href="/" />
          <Link href="/" className="os-btn os-btn-ghost !min-h-[40px] !px-4 text-base">
            홈으로
          </Link>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="mb-8">
          <p className="os-label-micro mb-2">내가 남긴 기록</p>
          <h1 className="text-ink">내 이야기</h1>
        </div>

        {/* 통계 */}
        <div className="os-card p-6 mb-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-display text-3xl font-bold text-ink">{sessions.length}</p>
              <p className="text-ink-48 text-sm mt-1">전체 장(章)</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-sage">
                {sessions.filter(s => s.isCompleted).length}
              </p>
              <p className="text-ink-48 text-sm mt-1">완료한 장</p>
            </div>
            <div>
              <p className="font-display text-3xl font-bold text-ember">{totalConversations}</p>
              <p className="text-ink-48 text-sm mt-1">기억 조각</p>
            </div>
          </div>
        </div>

        {/* 자서전 생성 버튼 */}
        {totalConversations > 0 && (
          <div className="text-center mb-8">
            <button
              onClick={handleGenerateAutobiography}
              disabled={generatingStory}
              className="os-btn os-btn-primary !px-10 !min-h-[56px] text-lg"
            >
              {generatingStory ? '자서전 엮는 중…' : '자서전 초고 엮기'}
            </button>
          </div>
        )}

        {/* 세션별 대화 내용 */}
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="os-card overflow-hidden">
              <div
                className="p-5 sm:p-6 cursor-pointer hover:bg-surface-2 transition-colors"
                onClick={() => toggleSession(session.id)}
              >
                <div className="flex justify-between items-center gap-4">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-ink-48">
                      CHAPTER {String(session.sessionNumber).padStart(2, '0')}
                    </span>
                    <h3 className="text-ink truncate">{session.title}</h3>
                    <p className="text-ink-48 text-sm mt-1">
                      {session.summary.conversationCount}개의 기억
                      {session.isCompleted && <span className="ml-2 text-sage">· 완료</span>}
                    </p>
                  </div>
                  <div className="text-ink-48 text-lg shrink-0">
                    {expandedSessions.has(session.id) ? '▾' : '▸'}
                  </div>
                </div>
              </div>

              {expandedSessions.has(session.id) && (
                <div className="border-t border-line px-5 sm:px-6 py-4 bg-surface-2/50">
                  {session.conversations.length === 0 ? (
                    <p className="text-ink-48">아직 대화가 없습니다.</p>
                  ) : (
                    <div className="space-y-5">
                      {session.conversations.map((conv) => (
                        <div key={conv.id} className="border-l-2 border-ember/40 pl-4">
                          <p className="os-label-micro text-sage mb-1">인터뷰어</p>
                          <p className="text-ink-72 mb-3">{conv.question}</p>
                          <p className="os-label-micro text-ember mb-1">내 이야기</p>
                          <p className="text-ink">{conv.answer || '(답변 없음)'}</p>
                          <p className="text-xs text-ink-28 mt-2">
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
          <div className="text-center py-16">
            <p className="text-xl text-ink-72">아직 시작된 이야기가 없습니다.</p>
            <Link href="/" className="os-btn os-btn-primary mt-5">
              첫 이야기 시작하기
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}