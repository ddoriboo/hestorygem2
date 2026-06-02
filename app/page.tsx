'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { sessionPrompts } from '@/lib/session-prompts'
import Brand from '@/components/ui/Brand'

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
      <div className="min-h-screen flex items-center justify-center bg-ground">
        <div className="text-ink-72 text-xl">불러오는 중…</div>
      </div>
    )
  }

  const completedCount = sessions.filter((s) => s.isCompleted).length
  const progress = sessions.length ? Math.round((completedCount / sessions.length) * 100) : 0

  return (
    <div className="min-h-screen bg-ground">
      {/* 헤더 */}
      <header className="border-b border-line bg-surface/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex justify-between items-center">
          <Brand size="sm" href="/" />
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden sm:inline text-ink-72">{user?.username}님</span>
            <button onClick={handleLogout} className="os-btn os-btn-ghost !min-h-[40px] !px-4 text-base">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="mb-8">
          <p className="os-label-micro mb-2">나의 자서전 여정</p>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
            <div>
              <h1 className="text-ink">열두 번의 이야기</h1>
              <p className="text-ink-72 mt-2">
                지나온 인생을 한 장(章)씩 기록합니다 · {completedCount}/{sessions.length} 완료
              </p>
            </div>
            <Link href="/my-story" className="os-btn os-btn-ghost self-start sm:self-auto">
              내 이야기 보기
            </Link>
          </div>
          {/* 진행 타임라인 */}
          <div className="mt-5 h-1.5 w-full rounded-pill bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-pill bg-ember transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="os-card p-5 sm:p-6 flex flex-col transition hover:border-line-strong"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="font-mono text-sm text-ink-48">
                  CHAPTER {String(session.sessionNumber).padStart(2, '0')}
                </span>
                {session.isCompleted && (
                  <span className="os-chip border-sage/30 text-sage">완료</span>
                )}
              </div>

              <h3
                className="text-ink mb-2 cursor-pointer hover:text-ember transition-colors line-clamp-2"
                onClick={() => setSelectedSessionNumber(session.sessionNumber)}
                title="눌러서 질문 미리보기"
              >
                {session.title}
              </h3>

              <p className="text-ink-48 text-sm mb-5">
                {session.conversationCount > 0
                  ? `${session.conversationCount}개의 대화 기록`
                  : '아직 시작하지 않았어요'}
              </p>

              <div className="mt-auto flex flex-col gap-2">
                <Link
                  href={`/interview/${session.id}`}
                  className="os-btn os-btn-primary w-full"
                >
                  {session.conversationCount > 0 ? '이어서 이야기하기' : '이야기 시작하기'}
                </Link>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResetSession(session.id)}
                    className="os-btn os-btn-ghost flex-1 !min-h-[44px] !px-3 text-base"
                  >
                    다시하기
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="os-btn os-btn-ghost flex-1 !min-h-[44px] !px-3 text-base !text-danger !border-danger/30"
                  >
                    삭제
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedSessionNumber(null)}
        >
          <div
            className="os-card max-w-2xl w-full max-h-[82vh] overflow-hidden bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 팝업 헤더 */}
            <div className="p-5 flex justify-between items-center border-b border-line">
              <div>
                <span className="font-mono text-xs text-ink-48">
                  CHAPTER {String(selectedSessionNumber).padStart(2, '0')}
                </span>
                <h3 className="text-ink mt-1">
                  {sessionPrompts[selectedSessionNumber]?.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSessionNumber(null)}
                className="text-ink-48 hover:text-ink text-3xl leading-none px-2"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {/* 팝업 내용 */}
            <div className="p-6 overflow-y-auto max-h-[calc(82vh-88px)]">
              <p className="text-ink-72 mb-5">
                이번 장에서는 다음과 같은 질문들을 통해 인생 이야기를 들려주시게 됩니다.
              </p>

              <div className="space-y-3">
                {sessionPrompts[selectedSessionNumber]?.questions.map((question, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="font-mono text-ember text-sm mt-1">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <p className="text-ink flex-1">{question}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 os-card-2 p-4 border-sage/20">
                <p className="text-sm text-sage">
                  💡 편안한 마음으로 천천히 이야기해 주세요. AI 인터뷰어가 속도에 맞춰 대화를 이어갑니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
