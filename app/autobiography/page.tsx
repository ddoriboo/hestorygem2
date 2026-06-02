'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Brand from '@/components/ui/Brand'

export default function AutobiographyPage() {
  const router = useRouter()
  const [autobiography, setAutobiography] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    fetchAutobiography()
  }, [router])

  const fetchAutobiography = async () => {
    try {
      const response = await fetch('/api/autobiography')
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/my-story')
        } else {
          router.push('/login')
        }
        return
      }
      const data = await response.json()
      setAutobiography(data.autobiography.content)
    } catch (error) {
      console.error('Error fetching autobiography:', error)
      router.push('/my-story')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(autobiography)
      setCopying(true)
      setTimeout(() => setCopying(false), 2000)
    } catch (error) {
      console.error('Error copying text:', error)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([autobiography], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '나의_자서전.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground">
        <div className="text-ink-72 text-xl">자서전을 불러오는 중…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ground">
      {/* 헤더 */}
      <header className="border-b border-line bg-surface/60 backdrop-blur print:hidden">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-4 flex justify-between items-center">
          <Brand size="sm" href="/" />
          <div className="flex gap-2">
            <Link href="/my-story" className="os-btn os-btn-ghost !min-h-[40px] !px-4 text-base">
              내 이야기로
            </Link>
            <Link href="/" className="os-btn os-btn-ghost !min-h-[40px] !px-4 text-base">
              홈으로
            </Link>
          </div>
        </div>
      </header>

      {/* 액션 버튼들 */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-8 print:hidden">
        <p className="os-label-micro mb-2">완성된 자서전</p>
        <h1 className="text-ink mb-5">나의 자서전</h1>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleCopy} className="os-btn os-btn-primary !min-h-[44px] text-base">
            {copying ? '복사됨!' : '전체 복사'}
          </button>
          <button onClick={handleDownload} className="os-btn os-btn-ghost !min-h-[44px] text-base">
            텍스트로 저장
          </button>
          <button onClick={handlePrint} className="os-btn os-btn-ghost !min-h-[44px] text-base">
            인쇄하기
          </button>
        </div>
      </div>

      {/* 자서전 내용 */}
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8 pb-16">
        <div className="os-card p-7 sm:p-10 print:border-0 print:bg-white">
          <div
            className="read-serif text-ink print:text-black"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {autobiography}
          </div>
        </div>
      </main>

      {/* 인쇄용 스타일 */}
      <style jsx global>{`
        @media print {
          body { background: white; color: black; }
        }
      `}</style>
    </div>
  )
}