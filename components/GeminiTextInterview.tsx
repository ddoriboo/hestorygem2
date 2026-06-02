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
    <div className="os-card p-4 sm:p-6">
      <div className="mb-5">
        <h3 className="text-ink mb-1">텍스트로 이야기 나누기</h3>
        <p className="text-ink-48 text-sm">
          글로 천천히 회고하며 기록을 남길 수 있습니다.
        </p>
      </div>

      {!isStarted ? (
        <div className="text-center py-8">
          <button onClick={startInterview} disabled={isLoading} className="os-btn os-btn-primary">
            {isLoading ? '준비 중…' : '텍스트 인터뷰 시작'}
          </button>
        </div>
      ) : (
        <>
          {/* 메시지 목록 */}
          <div className="h-96 overflow-y-auto mb-4 p-4 os-card-2">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 p-3 rounded-md ${
                  message.role === 'assistant'
                    ? 'bg-sage/10 border-l-2 border-sage'
                    : 'bg-ember/10 border-l-2 border-ember ml-6'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`os-label-micro ${
                    message.role === 'assistant' ? 'text-sage' : 'text-ember'
                  }`}>
                    {message.role === 'assistant' ? '인터뷰어' : '내 이야기'}
                  </span>
                  <span className="text-xs text-ink-28">
                    {message.timestamp.toLocaleTimeString('ko-KR')}
                  </span>
                </div>
                <p className="text-ink whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}

            {isLoading && (
              <div className="mb-4 p-3 rounded-md bg-sage/10 border-l-2 border-sage">
                <div className="flex items-center gap-2">
                  <span className="os-label-micro text-sage">인터뷰어</span>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-sage rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-sage rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1.5 h-1.5 bg-sage rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
                <p className="text-ink-48 text-sm mt-1">생각하고 있어요…</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="flex gap-2 items-stretch">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="편안하게 이야기해 주세요…"
              className="os-input flex-1 resize-none !min-h-0 py-3"
              rows={3}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="os-btn os-btn-primary !px-5 shrink-0"
            >
              {isLoading ? '전송 중…' : '전송'}
            </button>
          </div>

          {/* 사용 팁 */}
          <div className="mt-4 os-card-2 p-3 text-sm text-ink-48">
            <p className="text-ink-72 mb-2">💡 이야기 팁</p>
            <ul className="space-y-1 text-xs">
              <li>• 자연스럽고 편안하게 대화하듯 답변해 주세요</li>
              <li>• Enter 키로 메시지를 전송할 수 있어요</li>
              <li>• 길고 자세한 답변일수록 더 풍성한 자서전이 완성됩니다</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}