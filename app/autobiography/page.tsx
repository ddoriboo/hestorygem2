'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AutobiographyPage() {
  const router = useRouter()
  const [autobiography, setAutobiography] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    fetchAutobiography()
  }, [])

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">자서전을 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">나의 자서전</h1>
            <div className="flex space-x-4">
              <Link
                href="/my-story"
                className="px-4 py-2 text-lg bg-gray-200 hover:bg-gray-300 rounded transition"
              >
                내 이야기로
              </Link>
              <Link
                href="/"
                className="px-4 py-2 text-lg bg-gray-200 hover:bg-gray-300 rounded transition"
              >
                홈으로
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 액션 버튼들 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden">
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={handleCopy}
            className="px-6 py-3 bg-blue-600 text-white text-lg rounded hover:bg-blue-700 transition"
          >
            {copying ? '복사됨!' : '전체 복사'}
          </button>
          <button
            onClick={handleDownload}
            className="px-6 py-3 bg-green-600 text-white text-lg rounded hover:bg-green-700 transition"
          >
            텍스트 파일로 저장
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-purple-600 text-white text-lg rounded hover:bg-purple-700 transition"
          >
            인쇄하기
          </button>
        </div>
      </div>

      {/* 자서전 내용 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none">
          <div 
            className="prose prose-lg max-w-none"
            style={{ 
              whiteSpace: 'pre-wrap',
              lineHeight: '1.8',
              fontSize: '18px',
              fontFamily: 'serif'
            }}
          >
            {autobiography}
          </div>
        </div>
      </main>

      {/* 인쇄용 스타일 */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .prose {
            max-width: none;
            font-size: 14pt;
            line-height: 1.6;
          }
        }
      `}</style>
    </div>
  )
}