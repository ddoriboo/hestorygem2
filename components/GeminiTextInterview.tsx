'use client'

import { useState, useRef, useEffect } from 'react'

interface GeminiTextInterviewProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function GeminiTextInterview({ sessionNumber, onConversationSave }: GeminiTextInterviewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const startInterview = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/gemini/text-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionNumber,
          conversationHistory: []
        })
      })

      if (response.ok) {
        const data = await response.json()
        const aiMessage: Message = {
          role: 'assistant',
          content: data.message,
          timestamp: new Date()
        }
        setMessages([aiMessage])
        setIsStarted(true)
      } else {
        const errorData = await response.json()
        alert(`오류: ${errorData.error}`)
      }
    } catch (error) {
      console.error('인터뷰 시작 오류:', error)
      alert('인터뷰를 시작할 수 없습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // 대화 히스토리 준비
      const conversationHistory = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await fetch('/api/gemini/text-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionNumber,
          userMessage: inputMessage,
          conversationHistory: conversationHistory.slice(0, -1) // 마지막 사용자 메시지 제외
        })
      })

      if (response.ok) {
        const data = await response.json()
        const aiMessage: Message = {
          role: 'assistant',
          content: data.message,
          timestamp: new Date()
        }
        
        setMessages(prev => [...prev, aiMessage])

        // 대화 저장 (질문-답변 쌍으로)
        await onConversationSave(aiMessage.content, userMessage.content)

      } else {
        const errorData = await response.json()
        alert(`오류: ${errorData.error}`)
      }
    } catch (error) {
      console.error('메시지 전송 오류:', error)
      alert('메시지를 전송할 수 없습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
          🤖 Gemini 텍스트 인터뷰
        </h3>
        <p className="text-sm sm:text-base text-gray-600">
          Google의 최신 Gemini 2.0 Flash 모델과 함께하는 인터뷰입니다.
        </p>
      </div>

      {!isStarted ? (
        <div className="text-center py-8">
          <button
            onClick={startInterview}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? '🤖 Gemini 준비 중...' : '🤖 Gemini 인터뷰 시작'}
          </button>
        </div>
      ) : (
        <>
          {/* 메시지 목록 */}
          <div className="h-96 overflow-y-auto mb-4 p-4 border rounded-lg bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 p-3 rounded-lg ${
                  message.role === 'assistant'
                    ? 'bg-blue-100 border-l-4 border-blue-500'
                    : 'bg-green-100 border-l-4 border-green-500 ml-8'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-semibold ${
                    message.role === 'assistant' ? 'text-blue-800' : 'text-green-800'
                  }`}>
                    {message.role === 'assistant' ? '🤖 Gemini 인터뷰어' : '👤 아버님'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            
            {isLoading && (
              <div className="mb-4 p-3 rounded-lg bg-blue-100 border-l-4 border-blue-500">
                <div className="flex items-center">
                  <span className="text-sm font-semibold text-blue-800 mr-2">🤖 Gemini 인터뷰어</span>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
                <p className="text-blue-700 text-sm mt-1">생각하고 있습니다...</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="flex space-x-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="편안하게 이야기해주세요..."
              className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              rows={3}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
            >
              {isLoading ? '전송 중...' : '전송'}
            </button>
          </div>

          {/* 사용 팁 */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <h4 className="font-medium text-gray-800 mb-2">💡 Gemini 인터뷰 팁:</h4>
            <ul className="space-y-1 text-xs">
              <li>• Google의 최신 Gemini 2.0 Flash 모델을 사용합니다</li>
              <li>• 자연스럽고 편안하게 대화하듯 답변해주세요</li>
              <li>• Enter 키로 메시지를 전송할 수 있습니다</li>
              <li>• 길고 자세한 답변일수록 더 풍성한 자서전이 완성됩니다</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}