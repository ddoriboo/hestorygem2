'use client'

import { useState, useCallback } from 'react'

interface SimpleVoiceInterviewProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}

interface Conversation {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function SimpleVoiceInterview({ sessionNumber, onConversationSave }: SimpleVoiceInterviewProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [connectionStatus, setConnectionStatus] = useState('음성 인터뷰 준비됨')
  const [currentTranscript, setCurrentTranscript] = useState('')

  const startInterview = useCallback(async () => {
    try {
      setConnectionStatus('인터뷰를 시작합니다...')
      setIsConnected(true)

      // 첫 AI 질문 요청
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
      setConnectionStatus('AI 질문이 준비되었습니다. 음성 버튼을 눌러 답변해주세요.')

    } catch (error) {
      console.error('인터뷰 시작 오류:', error)
      setConnectionStatus('인터뷰 시작 중 오류가 발생했습니다.')
    }
  }, [sessionNumber])

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setConnectionStatus('이 브라우저는 음성 인식을 지원하지 않습니다.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'ko-KR'

    recognition.onstart = () => {
      setIsListening(true)
      setConnectionStatus('말씀해 주세요...')
      setCurrentTranscript('')
    }

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setCurrentTranscript(transcript)

      if (event.results[event.results.length - 1].isFinal) {
        handleUserSpeech(transcript)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('음성 인식 오류:', event.error)
      setIsListening(false)
      setConnectionStatus(`음성 인식 오류: ${event.error}`)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    try {
      recognition.start()
    } catch (error) {
      console.error('음성 인식 시작 오류:', error)
      setConnectionStatus('음성 인식을 시작할 수 없습니다.')
    }
  }, [])

  const handleUserSpeech = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return

    setCurrentTranscript('')
    setConnectionStatus('AI가 응답을 준비하고 있습니다...')

    const userMessage: Conversation = {
      role: 'user',
      content: transcript.trim(),
      timestamp: new Date()
    }

    const newConversations = [...conversations, userMessage]
    setConversations(newConversations)

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

      // 대화 저장
      const lastAI = conversations[conversations.length - 1]
      if (lastAI && lastAI.role === 'assistant') {
        await onConversationSave(lastAI.content, userMessage.content)
      }

      // AI 응답을 음성으로 읽기
      speakText(data.message)

    } catch (error) {
      console.error('AI 응답 오류:', error)
      setConnectionStatus('AI 응답 중 오류가 발생했습니다.')
    }
  }, [conversations, sessionNumber, onConversationSave])

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setConnectionStatus('이 브라우저는 음성 합성을 지원하지 않습니다.')
      return
    }

    setIsSpeaking(true)
    setConnectionStatus('AI가 응답하고 있습니다...')

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.9
    
    utterance.onend = () => {
      setIsSpeaking(false)
      setConnectionStatus('음성 버튼을 눌러 답변해주세요.')
    }
    
    utterance.onerror = () => {
      setIsSpeaking(false)
      setConnectionStatus('음성 합성 오류가 발생했습니다.')
    }
    
    window.speechSynthesis.speak(utterance)
  }, [])

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      setConnectionStatus('음성 버튼을 눌러 답변해주세요.')
    }
  }, [])

  const disconnect = useCallback(() => {
    setIsConnected(false)
    setIsListening(false)
    setIsSpeaking(false)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setConnectionStatus('인터뷰가 종료되었습니다.')
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">🎤 음성 인터뷰</h3>
        <p className="text-gray-600">{connectionStatus}</p>
      </div>

      {/* 연결 버튼 */}
      <div className="flex justify-center mb-6 space-x-4">
        {!isConnected ? (
          <button
            onClick={startInterview}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            🎤 음성 인터뷰 시작
          </button>
        ) : (
          <>
            <button
              onClick={disconnect}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
            >
              🛑 인터뷰 종료
            </button>
            
            {!isListening && !isSpeaking && (
              <button
                onClick={startListening}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                🎙️ 음성으로 답변
              </button>
            )}
            
            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium"
              >
                ⏭️ AI 건너뛰기
              </button>
            )}
          </>
        )}
      </div>

      {/* 음성 상태 표시 */}
      {isConnected && (
        <div className="text-center mb-6">
          {isListening && (
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-red-100 text-red-800">
              <div className="w-3 h-3 rounded-full mr-2 bg-red-500 animate-pulse" />
              🎤 듣고 있습니다...
            </div>
          )}
          
          {isSpeaking && (
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800">
              <div className="w-3 h-3 rounded-full mr-2 bg-blue-500 animate-pulse" />
              🗣️ AI가 말하고 있습니다...
            </div>
          )}
        </div>
      )}

      {/* 실시간 음성 인식 표시 */}
      {currentTranscript && (
        <div className="mb-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
          <p className="text-green-800 font-medium">실시간 음성 인식:</p>
          <p className="text-green-700 mt-1">{currentTranscript}</p>
        </div>
      )}

      {/* 대화 기록 */}
      <div className="max-h-96 overflow-y-auto space-y-4">
        {conversations.map((conv, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              conv.role === 'assistant' 
                ? 'bg-blue-50 border-l-4 border-blue-400' 
                : 'bg-green-50 border-l-4 border-green-400'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`font-medium ${
                conv.role === 'assistant' ? 'text-blue-800' : 'text-green-800'
              }`}>
                {conv.role === 'assistant' ? '🤖 AI 인터뷰어' : '👤 아버님'}
              </span>
              <span className="text-xs text-gray-500">
                {conv.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <p className="text-gray-800 whitespace-pre-wrap">{conv.content}</p>
          </div>
        ))}

        {conversations.length === 0 && isConnected && (
          <div className="text-center text-gray-500 py-8">
            <p>인터뷰가 준비되었습니다.</p>
            <p className="text-sm mt-2">위의 질문을 읽고 음성 버튼을 눌러 답변해주세요.</p>
          </div>
        )}
      </div>

      {/* 사용 팁 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
        <h4 className="font-medium text-gray-800 mb-2">💡 사용 팁:</h4>
        <ul className="space-y-1 text-xs">
          <li>• AI 질문을 읽고 "🎙️ 음성으로 답변" 버튼을 눌러주세요</li>
          <li>• 답변을 마치면 자동으로 다음 질문이 생성됩니다</li>
          <li>• AI가 말하는 중에 "⏭️ AI 건너뛰기"로 바로 답변할 수 있습니다</li>
          <li>• Chrome, Edge, Safari 등의 최신 브라우저에서 사용해주세요</li>
        </ul>
      </div>
    </div>
  )
}