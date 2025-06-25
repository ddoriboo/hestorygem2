'use client'

import { useState, useEffect, useRef } from 'react'

interface TextInterviewProps {
  sessionId: string
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}

interface Conversation {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function TextInterview({ sessionId, sessionNumber, onConversationSave }: TextInterviewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const [userInput, setUserInput] = useState('')
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, currentMessage])

  const startInterview = async () => {
    setIsLoading(true)
    setIsStarted(true)

    try {
      // 인터뷰 시작 - 초기 인사말 요청
      const response = await fetch('/api/interview/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionNumber,
          conversationHistory: []
        })
      })

      if (!response.ok) {
        throw new Error('인터뷰 시작에 실패했습니다.')
      }

      const data = await response.json()
      
      const aiMessage: Conversation = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      }
      
      setConversations([aiMessage])

    } catch (error) {
      console.error('인터뷰 시작 오류:', error)
      alert('인터뷰 시작 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!userInput.trim() || isLoading) return

    const userMessage: Conversation = {
      role: 'user',
      content: userInput.trim(),
      timestamp: new Date()
    }

    const newConversations = [...conversations, userMessage]
    setConversations(newConversations)
    setUserInput('')
    setIsLoading(true)

    try {
      // AI 응답 요청
      const response = await fetch('/api/interview/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionNumber,
          userMessage: userMessage.content,
          conversationHistory: conversations
        })
      })

      if (!response.ok) {
        throw new Error('AI 응답 요청에 실패했습니다.')
      }

      const data = await response.json()
      
      const aiMessage: Conversation = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      }
      
      setConversations(prev => [...prev, aiMessage])

      // 대화 저장 (질문-답변 쌍)
      const lastAI = conversations[conversations.length - 1] // 이전 AI 질문
      if (lastAI && lastAI.role === 'assistant') {
        await onConversationSave(lastAI.content, userMessage.content)
      }

    } catch (error) {
      console.error('메시지 전송 오류:', error)
      alert('메시지 전송 중 오류가 발생했습니다.')
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
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">AI 인터뷰</h3>
        <p className="text-gray-600">
          {!isStarted 
            ? 'AI와 함께하는 인생 이야기 인터뷰를 시작해보세요.' 
            : '편안하게 답변해주시면 됩니다.'
          }
        </p>
      </div>

      {/* 시작 버튼 */}
      {!isStarted && (
        <div className="flex justify-center mb-6">
          <button
            onClick={startInterview}
            disabled={isLoading}
            className="px-8 py-4 bg-blue-600 text-white text-xl font-semibold rounded-lg hover:bg-blue-700 transition shadow-lg disabled:bg-gray-400"
          >
            {isLoading ? '준비 중...' : '인터뷰 시작하기'}
          </button>
        </div>
      )}

      {/* 대화 영역 */}
      {isStarted && (
        <>
          <div className="h-96 overflow-y-auto mb-4 p-4 border rounded-lg bg-gray-50">
            {conversations.map((conv, index) => (
              <div
                key={index}
                className={`mb-4 ${conv.role === 'assistant' ? 'text-left' : 'text-right'}`}
              >
                <div
                  className={`inline-block max-w-3/4 p-3 rounded-lg ${
                    conv.role === 'assistant'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-green-100 text-green-900'
                  }`}
                >
                  <div className="text-xs text-gray-600 mb-1">
                    {conv.role === 'assistant' ? 'AI 인터뷰어' : '아버님'}
                  </div>
                  <div className="whitespace-pre-wrap">{conv.content}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {conv.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="text-left mb-4">
                <div className="inline-block bg-gray-100 text-gray-600 p-3 rounded-lg">
                  AI가 응답을 준비하고 있습니다...
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="flex space-x-2">
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="답변을 입력해주세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
              className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!userInput.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              전송
            </button>
          </div>
        </>
      )}
    </div>
  )
}