'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Brand from '@/components/ui/Brand'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('로그인 폼 제출 시작:', formData)
    setError('')
    setLoading(true)

    try {
      console.log('API 호출 중...')
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      console.log('API 응답 상태:', response.status)
      const data = await response.json()
      console.log('API 응답 데이터:', data)

      if (!response.ok) {
        console.log('로그인 실패:', data.error)
        throw new Error(data.error || '로그인에 실패했습니다.')
      }

      console.log('로그인 성공, 리다이렉트 시작')
      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('로그인 에러:', err)
      setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      console.log('로그인 처리 완료')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ground px-5 py-12">
      <div className="max-w-md w-full os-card p-8 sm:p-10">
        <div className="flex flex-col items-center gap-2 mb-8">
          <Brand size="lg" subtitle="우리 모두의 이야기" />
          <h2 className="mt-4 text-center text-ink">로그인</h2>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-danger">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-ink-72 mb-2">
                아이디
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="os-input"
                placeholder="아이디를 입력하세요"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-ink-72 mb-2">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="os-input"
                placeholder="비밀번호를 입력하세요"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="os-btn os-btn-primary w-full">
            {loading ? '로그인 중...' : '로그인'}
          </button>

          <div className="text-center">
            <Link href="/register" className="text-ember">
              계정이 없으신가요? 회원가입
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}