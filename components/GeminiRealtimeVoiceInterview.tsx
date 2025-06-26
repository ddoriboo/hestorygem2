'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { float32ToInt16, int16ToFloat32 } from '@/lib/audio-utils'

interface GeminiRealtimeVoiceInterviewProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}

interface Conversation {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  audioComplete?: boolean
}

export default function GeminiRealtimeVoiceInterview({ 
  sessionNumber, 
  onConversationSave 
}: GeminiRealtimeVoiceInterviewProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [connectionStatus, setConnectionStatus] = useState('연결 준비 중...')
  const [isAISpeaking, setIsAISpeaking] = useState(false)

  // Session and Audio refs
  const sessionIdRef = useRef<string | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  const connectToGemini = useCallback(async () => {
    try {
      setConnectionStatus('Gemini Live API 연결 중...')

      // 세션 ID 생성
      const sessionId = `gemini-${Date.now()}`
      sessionIdRef.current = sessionId
      
      // 오디오 설정
      await setupAudioCapture()
      
      // Server-Sent Events 연결
      const eventSource = new EventSource(`/api/gemini/live-websocket?sessionId=${sessionId}&sessionNumber=${sessionNumber}`)
      
      eventSource.onopen = () => {
        console.log('Gemini Live SSE 연결됨')
        setIsConnected(true)
        setConnectionStatus('음성 인터뷰 준비 완료')
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleGeminiResponse(data)
        } catch (error) {
          console.error('SSE 메시지 파싱 오류:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE 연결 오류:', error)
        setConnectionStatus('연결 오류 발생')
        eventSource.close()
        setIsConnected(false)
      }

      // cleanup 함수에서 사용할 수 있도록 ref에 저장
      ;(sessionIdRef as any).eventSource = eventSource

    } catch (error) {
      console.error('Gemini 연결 오류:', error)
      setConnectionStatus(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [sessionNumber, setupAudioCapture, handleGeminiResponse])

  const setupAudioCapture = async () => {
    try {
      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      
      audioStreamRef.current = stream

      // AudioContext 설정
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(1024, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        if (isRecording && sessionIdRef.current) {
          const inputBuffer = event.inputBuffer.getChannelData(0)
          
          // Float32 to Int16 conversion using utility
          const pcmData = float32ToInt16(inputBuffer)

          // Gemini Live API에 오디오 데이터 전송
          sendAudioToGemini(Array.from(pcmData))
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setIsRecording(true)

    } catch (error) {
      console.error('오디오 설정 오류:', error)
      setConnectionStatus('마이크 접근 실패')
    }
  }

  const sendAudioToGemini = async (audioData: number[]) => {
    if (!sessionIdRef.current) return
    
    try {
      const response = await fetch('/api/gemini/live-websocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendAudio',
          sessionId: sessionIdRef.current,
          audioData
        })
      })
      
      if (!response.ok) {
        console.error('오디오 전송 실패:', response.statusText)
      }
    } catch (error) {
      console.error('오디오 전송 오류:', error)
    }
  }


  const handleGeminiResponse = useCallback((response: any) => {
    console.log('Gemini 응답:', response)
    
    switch (response.type) {
      case 'connected':
        console.log('Gemini Live 연결됨:', response.message)
        break
        
      case 'text_response':
        if (response.text) {
          const assistantMessage: Conversation = {
            role: 'assistant',
            content: response.text,
            timestamp: new Date(),
            audioComplete: true
          }
          setConversations(prev => [...prev, assistantMessage])
        }
        break
        
      case 'audio_response':
        if (response.audioData) {
          try {
            // Base64 디코딩 후 오디오 재생
            const binaryString = atob(response.audioData)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const int16Data = new Int16Array(bytes.buffer)
            playAudioData(Array.from(int16Data))
            setIsAISpeaking(true)
          } catch (error) {
            console.error('오디오 데이터 처리 오류:', error)
          }
        }
        break
        
      case 'raw_response':
        // 원시 Gemini 응답 - 디버깅용
        console.log('원시 Gemini 응답:', response.data)
        break
        
      case 'error':
        console.error('Gemini 오류:', response.message)
        setConnectionStatus(`오류: ${response.message}`)
        if (response.details) {
          console.error('오류 세부사항:', response.details)
        }
        break
        
      case 'heartbeat':
        // 연결 유지 확인
        break
        
      default:
        console.log('처리되지 않은 응답:', response)
    }
  }, [])

  const playAudioData = (audioData: number[]) => {
    if (!audioContextRef.current) return

    const audioContext = audioContextRef.current
    const int16Data = new Int16Array(audioData)
    
    // 24kHz에서 16kHz로 리샘플링 (AudioContext가 16kHz인 경우)
    // Int16 to Float32 conversion using utility
    const floatData = int16ToFloat32(int16Data)
    
    // 오디오 버퍼 생성 (24kHz 데이터를 그대로 재생)
    const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000)
    audioBuffer.getChannelData(0).set(floatData)

    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)
    source.start()
    
    // 오디오 재생 완료 시 상태 업데이트
    source.onended = () => {
      setIsAISpeaking(false)
    }
  }


  const disconnect = useCallback(async () => {
    console.log('Gemini 연결 해제 중...')

    // EventSource 해제
    const eventSource = (sessionIdRef as any).eventSource
    if (eventSource) {
      eventSource.close()
      ;(sessionIdRef as any).eventSource = null
    }

    // 세션 종료
    if (sessionIdRef.current) {
      try {
        await fetch('/api/gemini/live-websocket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'disconnect',
            sessionId: sessionIdRef.current
          })
        })
      } catch (error) {
        console.error('세션 종료 오류:', error)
      }
      sessionIdRef.current = null
    }

    // 오디오 스트림 해제
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }

    // AudioContext 해제
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Processor 해제
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    setIsConnected(false)
    setIsRecording(false)
    setIsAISpeaking(false)
    setConnectionStatus('연결 해제됨')
  }, [])

  const isMobile = typeof window !== 'undefined' && navigator.userAgent.match(/iPhone|iPad|iPod|Android/i)

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
          🎤 Gemini Live 실시간 음성 인터뷰
        </h3>
        <p className="text-sm sm:text-base text-gray-600 mb-2">{connectionStatus}</p>
        <p className="text-xs text-gray-500">
          Google의 최신 Gemini 2.5 Flash 모델과 실시간 음성 대화를 나누세요
        </p>
        {isMobile && (
          <p className="text-xs sm:text-sm text-amber-600 mt-2">
            📱 모바일 환경입니다. Chrome 또는 Safari 브라우저 사용을 권장합니다.
          </p>
        )}
      </div>

      {/* 연결 버튼 */}
      <div className="flex justify-center mb-4 sm:mb-6 space-x-2 sm:space-x-4">
        {!isConnected ? (
          <button
            onClick={connectToGemini}
            className="px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm sm:text-base rounded-lg hover:from-blue-700 hover:to-purple-700 transition font-medium shadow-lg"
          >
            🎤 Gemini Live 실시간 대화 시작
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="px-4 py-2 sm:px-6 sm:py-3 bg-red-600 text-white text-sm sm:text-base rounded-lg hover:bg-red-700 transition font-medium"
          >
            🛑 실시간 대화 종료
          </button>
        )}
      </div>

      {/* 음성 상태 표시 */}
      {isConnected && (
        <div className="text-center mb-4 sm:mb-6">
          <div className="space-y-2">
            <div className={`inline-flex items-center px-4 py-2 rounded-full ${
              isRecording ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
            }`}>
              <div className={`w-3 h-3 rounded-full mr-2 ${
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
              }`} />
              {isRecording ? '🎤 말씀하고 계십니다...' : '🎧 Gemini가 듣고 있습니다'}
            </div>
            
            {isAISpeaking && (
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800">
                <div className="w-3 h-3 rounded-full mr-2 bg-blue-500 animate-pulse" />
                🗣️ Gemini가 응답하고 있습니다...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 현재 AI 응답 표시 */}
      {currentTranscript && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
          <p className="text-blue-800 font-medium">Gemini (실시간):</p>
          <p className="text-blue-700 mt-1">{currentTranscript}</p>
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
                {conv.role === 'assistant' ? '🤖 Gemini 인터뷰어' : '👤 아버님'}
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
            <p>Gemini Live 인터뷰가 곧 시작됩니다...</p>
            <p className="text-sm mt-2">마이크 권한을 허용하고 Gemini의 질문을 기다려주세요.</p>
          </div>
        )}
      </div>

      {/* 사용 팁 */}
      {isConnected && (
        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg text-sm text-gray-600 border border-blue-200">
          <h4 className="font-medium text-gray-800 mb-2">💡 Gemini Live 실시간 대화 가이드:</h4>
          <ul className="space-y-1 text-xs">
            <li>🎯 <strong>자연스럽게 말하세요</strong> - 마치 친구와 대화하듯 편안하게</li>
            <li>🎪 <strong>실시간 응답</strong> - AI가 즉시 음성으로 답변합니다</li>
            <li>🌍 <strong>한국어 완벽 지원</strong> - 자연스러운 한국어 대화가 가능합니다</li>
            <li>🎧 <strong>헤드폰 권장</strong> - 에코 방지를 위해 헤드폰 사용을 권장합니다</li>
            <li>✨ <strong>풍부한 이야기</strong> - 자세하게 말씀하실수록 더 좋은 자서전이 완성됩니다</li>
          </ul>
        </div>
      )}
    </div>
  )
}