'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
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

  // Gemini Live refs
  const geminiClientRef = useRef<any>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  const connectToGemini = useCallback(async () => {
    try {
      setConnectionStatus('Gemini Live API 연결 중...')

      // API 설정 가져오기
      const configResponse = await fetch(`/api/gemini/live-websocket?sessionNumber=${sessionNumber}`)
      if (!configResponse.ok) {
        throw new Error('API 설정 가져오기 실패')
      }
      const config = await configResponse.json()

      // Dynamic import로 Gemini SDK 로드 (클라이언트 사이드에서만)
      const { GoogleGenAI, Modality } = await import('@google/genai')
      
      // Gemini AI 초기화
      const genAI = new GoogleGenAI({ apiKey: config.apiKey })
      
      // Live API 연결
      const session = await genAI.live.connect({
        model: "models/gemini-2.5-flash-preview-native-audio-dialog",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: config.sessionPrompt,
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live 연결 성공')
            setIsConnected(true)
            setConnectionStatus('음성 인터뷰 준비 완료')
          },
          onmessage: (message: any) => {
            console.log('Gemini Live 메시지:', message)
            handleGeminiResponse(message)
          },
          onerror: (error: any) => {
            console.error('Gemini Live 오류:', error)
            setConnectionStatus(`연결 오류: ${error.message || '알 수 없는 오류'}`)
          },
          onclose: (reason: any) => {
            console.log('Gemini Live 연결 종료:', reason)
            setIsConnected(false)
            setConnectionStatus('연결 종료됨')
          }
        }
      })

      geminiClientRef.current = session

      // 오디오 설정
      await setupAudioCapture()

    } catch (error) {
      console.error('Gemini 연결 오류:', error)
      setConnectionStatus(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [sessionNumber, handleGeminiResponse])

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
        if (isRecording && geminiClientRef.current) {
          const inputBuffer = event.inputBuffer.getChannelData(0)
          
          // Float32 to Int16 conversion using utility
          const pcmData = float32ToInt16(inputBuffer)

          // Gemini Live API에 오디오 데이터 전송
          sendAudioToGemini(pcmData)
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

  const sendAudioToGemini = async (audioData: Int16Array) => {
    if (!geminiClientRef.current) return
    
    try {
      // Int16Array를 Base64로 변환
      const bytes = new Uint8Array(audioData.buffer)
      const base64Audio = btoa(String.fromCharCode(...bytes))
      
      // Gemini Live API에 오디오 전송
      geminiClientRef.current.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: "audio/pcm;rate=16000"
        }
      })
    } catch (error) {
      console.error('오디오 전송 오류:', error)
    }
  }


  const handleGeminiResponse = useCallback((message: any) => {
    console.log('Gemini 응답:', message)
    
    // Gemini Live API 메시지 처리
    if (message.serverContent) {
      const content = message.serverContent
      
      // 텍스트 응답 처리
      if (content.modelTurn && content.modelTurn.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.text) {
            const assistantMessage: Conversation = {
              role: 'assistant',
              content: part.text,
              timestamp: new Date(),
              audioComplete: true
            }
            setConversations(prev => [...prev, assistantMessage])
          }
          
          // 오디오 응답 처리
          if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
            try {
              // Base64 디코딩 후 오디오 재생
              const binaryString = atob(part.inlineData.data)
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
        }
      }
      
      // 턴 완료 처리
      if (content.turnComplete) {
        console.log('턴 완료')
        setIsAISpeaking(false)
      }
    }
    
    // 사용자 메시지 처리
    if (message.clientContent) {
      const content = message.clientContent
      if (content.turns && content.turns.length > 0) {
        for (const turn of content.turns) {
          if (turn.role === 'user' && turn.parts) {
            for (const part of turn.parts) {
              if (part.text) {
                const userMessage: Conversation = {
                  role: 'user',
                  content: part.text,
                  timestamp: new Date()
                }
                setConversations(prev => [...prev, userMessage])
              }
            }
          }
        }
      }
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
    console.log('Gemini Live 연결 해제 중...')

    // Gemini Live 세션 해제
    if (geminiClientRef.current) {
      try {
        geminiClientRef.current.close()
      } catch (error) {
        console.error('Gemini Live 세션 종료 오류:', error)
      }
      geminiClientRef.current = null
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