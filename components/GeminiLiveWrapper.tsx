'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

interface GeminiLiveWrapperProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}

// 완전한 SSR 비활성화로 클라이언트 사이드에서만 로드
const GeminiRealtimeVoiceInterview = dynamic(
  () => import('./GeminiRealtimeVoiceInterview'),
  { 
    ssr: false,
    loading: () => (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Gemini Live API 로딩 중...</p>
        </div>
      </div>
    )
  }
)

export default function GeminiLiveWrapper({ sessionNumber, onConversationSave }: GeminiLiveWrapperProps) {
  const [isClient, setIsClient] = useState(false)

  // 클라이언트 사이드에서만 렌더링
  if (typeof window === 'undefined') {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Gemini Live API 초기화 중...</p>
        </div>
      </div>
    )
  }

  return (
    <GeminiRealtimeVoiceInterview 
      sessionNumber={sessionNumber}
      onConversationSave={onConversationSave}
    />
  )
}