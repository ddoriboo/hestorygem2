'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface WebSpeechVoiceInterviewProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}

interface Conversation {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isListening?: boolean
  isSpeaking?: boolean
}

// Web Speech API 타입 정의
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export default function WebSpeechVoiceInterview({ sessionNumber, onConversationSave }: WebSpeechVoiceInterviewProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [connectionStatus, setConnectionStatus] = useState('음성 인터뷰 준비됨')
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')

  // Speech API refs
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    // Speech Recognition 초기화
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ko-KR'
        
        recognition.onstart = () => {
          setIsListening(true)
          setConnectionStatus('음성을 듣고 있습니다...')
        }
        
        recognition.onresult = (event: any) => {
          let interim = ''
          let final = ''
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              final += transcript
            } else {
              interim += transcript
            }
          }
          
          setInterimTranscript(interim)
          if (final) {
            setCurrentTranscript(final)
            handleUserSpeech(final)
          }
        }
        
        recognition.onerror = (event: any) => {
          console.error('음성 인식 오류:', event.error)
          setConnectionStatus(`음성 인식 오류: ${event.error}`)
        }
        
        recognition.onend = () => {
          setIsListening(false)
          if (isConnected && !isSpeaking) {
            // 자동으로 다시 듣기 시작
            setTimeout(() => {
              if (recognitionRef.current && isConnected) {
                recognitionRef.current.start()
              }
            }, 500)
          }
        }
        
        recognitionRef.current = recognition
      }
      
      // Speech Synthesis 초기화
      synthRef.current = window.speechSynthesis
    }

    return () => {
      stopListening()
      stopSpeaking()
    }
  }, [isConnected, isSpeaking])

  const startInterview = useCallback(async () => {
    try {
      setConnectionStatus('인터뷰를 시작합니다...')
      setIsConnected(true)

      // 첫 번째 AI 질문 요청
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
        timestamp: new Date(),
        isSpeaking: true
      }
      
      setConversations([aiMessage])
      
      // AI 음성으로 질문 읽기
      speakText(data.message)
      
      setConnectionStatus('AI 질문을 말하고 있습니다...')

    } catch (error) {
      console.error('인터뷰 시작 오류:', error)
      setConnectionStatus('인터뷰 시작 중 오류가 발생했습니다.')
    }
  }, [sessionNumber])

  const handleUserSpeech = useCallback(async (transcript: string) => {
    if (!transcript.trim() || !isConnected) return

    setCurrentTranscript('')
    setInterimTranscript('')
    
    const userMessage: Conversation = {
      role: 'user',
      content: transcript.trim(),
      timestamp: new Date()
    }

    const newConversations = [...conversations, userMessage]
    setConversations(newConversations)
    
    setConnectionStatus('AI가 응답을 준비하고 있습니다...')
    stopListening()

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
        timestamp: new Date(),
        isSpeaking: true
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
      startListening() // 오류 시 다시 듣기 시작
    }
  }, [conversations, isConnected, onConversationSave])

  const speakText = useCallback((text: string) => {
    if (!synthRef.current) return

    // 이전 음성 중지
    stopSpeaking()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    utterance.rate = 0.9
    utterance.pitch = 1.0
    
    utterance.onstart = () => {
      setIsSpeaking(true)
      setConnectionStatus('AI가 말하고 있습니다...')
    }
    
    utterance.onend = () => {
      setIsSpeaking(false)
      currentUtteranceRef.current = null
      
      // AI가 말을 마치면 사용자 음성 듣기 시작
      if (isConnected) {
        setTimeout(() => {
          startListening()
        }, 1000)
      }
    }
    
    utterance.onerror = (event) => {
      console.error('음성 합성 오류:', event)
      setIsSpeaking(false)
      if (isConnected) {
        startListening()
      }
    }
    
    currentUtteranceRef.current = utterance
    synthRef.current.speak(utterance)
  }, [isConnected])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !isSpeaking) {
      try {
        recognitionRef.current.start()
        setConnectionStatus('말씀해 주세요...')
      } catch (error) {
        console.error('음성 인식 시작 오류:', error)
      }
    }
  }, [isListening, isSpeaking])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }, [isListening])

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current = null
    }
    setIsSpeaking(false)
  }, [])

  const disconnect = useCallback(() => {
    setIsConnected(false)
    stopListening()
    stopSpeaking()
    setConnectionStatus('인터뷰가 종료되었습니다.')
  }, [stopListening, stopSpeaking])

  const skipToListening = useCallback(() => {
    stopSpeaking()
    startListening()
  }, [stopSpeaking, startListening])

  // Web Speech API 지원 확인
  const isWebSpeechSupported = typeof window !== 'undefined' && 
    (window.SpeechRecognition || window.webkitSpeechRecognition) && 
    window.speechSynthesis

  if (!isWebSpeechSupported) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">음성 인터뷰 지원되지 않음</h3>
          <p className="text-gray-600 mb-4">
            이 브라우저는 Web Speech API를 지원하지 않습니다.
          </p>
          <p className="text-sm text-gray-500">
            Chrome, Edge, Safari 등의 최신 브라우저를 사용해주세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">🎤 음성 인터뷰 (Web Speech API)</h3>
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
            {isSpeaking && (
              <button
                onClick={skipToListening}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium"
              >
                ⏭️ AI 건너뛰기
              </button>
            )}
            {!isListening && !isSpeaking && (
              <button
                onClick={startListening}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                🎙️ 다시 듣기
              </button>
            )}
          </>
        )}
      </div>

      {/* 음성 상태 표시 */}
      {isConnected && (
        <div className="text-center mb-6">
          <div className="space-y-2">
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

            {!isListening && !isSpeaking && (
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-600">
                <div className="w-3 h-3 rounded-full mr-2 bg-gray-400" />
                ⏸️ 대기 중...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 실시간 음성 인식 표시 */}
      {(currentTranscript || interimTranscript) && (
        <div className="mb-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
          <p className="text-green-800 font-medium">실시간 음성 인식:</p>
          <p className="text-green-700 mt-1">
            {currentTranscript}
            <span className="text-gray-500 italic">{interimTranscript}</span>
          </p>
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
                {conv.isSpeaking && (
                  <span className="ml-2 text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded animate-pulse">
                    말하는 중
                  </span>
                )}
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
            <p>인터뷰가 곧 시작됩니다...</p>
            <p className="text-sm mt-2">AI의 질문을 듣고 자연스럽게 답변해주세요.</p>
          </div>
        )}
      </div>

      {/* 사용 팁 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
        <h4 className="font-medium text-gray-800 mb-2">💡 사용 팁:</h4>
        <ul className="space-y-1 text-xs">
          <li>• AI가 질문을 말하면 자동으로 음성 인식이 시작됩니다</li>
          <li>• 답변을 마치면 잠시 기다려주세요 (자동으로 다음 질문)</li>
          <li>• AI가 말하는 중에 "AI 건너뛰기"로 바로 답변할 수 있습니다</li>
          <li>• 마이크 권한을 허용해주세요</li>
          <li>• 조용한 환경에서 사용하시면 더 정확합니다</li>
        </ul>
      </div>
    </div>
  )
}