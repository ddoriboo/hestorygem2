'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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

  // Refs
  const sessionRef = useRef<any>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const geminiClientRef = useRef<any>(null)

  useEffect(() => {
    // 클라이언트 사이드에서만 초기화
    if (typeof window !== 'undefined') {
      initializeGeminiLive()
    }

    return () => {
      disconnect()
    }
  }, [sessionNumber])

  const initializeGeminiLive = async () => {
    try {
      setConnectionStatus('Gemini Live API 초기화 중...')
      
      // 브라우저 호환성 확인
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 마이크 접근을 지원하지 않습니다.')
      }

      setConnectionStatus('API 설정 로딩 중...')
    } catch (error) {
      console.error('초기화 오류:', error)
      setConnectionStatus(`초기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  const connectToGemini = useCallback(async () => {
    try {
      setConnectionStatus('Gemini Live API 연결 중...')

      // API 설정 가져오기
      const configResponse = await fetch(`/api/gemini/live-websocket?sessionNumber=${sessionNumber}`)
      if (!configResponse.ok) {
        throw new Error('API 설정 가져오기 실패')
      }
      const config = await configResponse.json()

      // Dynamic import로 Gemini SDK 로드
      const { GoogleGenAI } = await import('@google/genai')
      
      // Gemini AI 초기화
      const genAI = new GoogleGenAI({ apiKey: config.apiKey })
      geminiClientRef.current = genAI
      
      console.log('Gemini Live 연결 시도:', config.model)
      
      // Live API 연결
      const session = await genAI.live.connect({
        model: config.model,
        config: {
          responseModalities: ["AUDIO"],
          systemInstruction: config.sessionPrompt,
          // 입력 음성 전사 활성화
          inputAudioTranscription: {},
          // 출력 음성 전사 활성화
          outputAudioTranscription: {},
          // Voice Activity Detection 설정
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              startOfSpeechSensitivity: "START_SENSITIVITY_MEDIUM",
              endOfSpeechSensitivity: "END_SENSITIVITY_MEDIUM"
            }
          }
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live 연결 성공')
            setIsConnected(true)
            setConnectionStatus('음성 인터뷰 준비 완료')
            // 연결 후 자동으로 녹음 시작
            setIsRecording(true)
          },
          onmessage: (message: any) => {
            console.log('Gemini Live 메시지:', message)
            handleGeminiMessage(message)
          },
          onerror: (error: any) => {
            console.error('Gemini Live 오류:', error)
            setConnectionStatus(`연결 오류: ${error.message || '알 수 없는 오류'}`)
            setIsConnected(false)
          },
          onclose: (reason: any) => {
            console.log('Gemini Live 연결 종료:', reason)
            setIsConnected(false)
            setConnectionStatus('연결 종료됨')
          }
        }
      })

      sessionRef.current = session

      // 오디오 설정
      await setupAudioCapture()

    } catch (error) {
      console.error('Gemini 연결 오류:', error)
      setConnectionStatus(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [sessionNumber])

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
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(1024, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        if (isRecording && sessionRef.current) {
          const inputBuffer = event.inputBuffer.getChannelData(0)
          
          // 오디오 레벨 확인 (소리가 들어오는지 체크)
          const audioLevel = Math.max(...inputBuffer.map(Math.abs))
          if (audioLevel > 0.01) {
            console.log('오디오 감지됨, 레벨:', audioLevel.toFixed(4))
          }
          
          // Float32 to Int16 conversion
          const pcmData = float32ToInt16(inputBuffer)
          
          // Gemini Live API에 오디오 데이터 전송
          sendAudioToGemini(pcmData)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

    } catch (error) {
      console.error('오디오 설정 오류:', error)
      setConnectionStatus('마이크 접근 실패')
    }
  }

  // Float32Array를 Int16Array로 변환
  const float32ToInt16 = (float32Array: Float32Array): Int16Array => {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const val = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = val < 0 ? val * 0x8000 : val * 0x7FFF
    }
    return int16Array
  }

  const sendAudioToGemini = async (audioData: Int16Array) => {
    if (!sessionRef.current) {
      console.log('세션이 없음, 오디오 전송 건너뜀')
      return
    }
    
    try {
      // Int16Array를 Uint8Array로 변환
      const bytes = new Uint8Array(audioData.buffer)
      
      // 더 안전한 base64 변환 (청크 단위로)
      let base64Audio = ''
      const chunkSize = 8192
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize)
        base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)))
      }
      
      // 전송 로그 (더 자세한 정보)
      console.log('오디오 전송 중...', {
        크기: audioData.length,
        바이트: bytes.length,
        base64길이: base64Audio.length
      })
      
      // Gemini Live API에 오디오 전송
      await sessionRef.current.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: "audio/pcm;rate=16000"
        }
      })
      
      console.log('오디오 전송 완료')
    } catch (error) {
      console.error('오디오 전송 오류:', error)
    }
  }

  const handleGeminiMessage = useCallback((message: any) => {
    console.log('Gemini 응답:', message)
    
    // 설정 완료 시 초기 인사
    if (message.setupComplete) {
      console.log('Gemini Live 설정 완료!')
      setTimeout(() => {
        if (sessionRef.current) {
          console.log('초기 인사 메시지 전송')
          sessionRef.current.sendClientContent({
            turns: [{ role: "user", parts: [{ text: "안녕하세요! 오늘은 어떤 이야기를 나눠볼까요?" }] }],
            turnComplete: true
          }).catch((error: any) => console.error('초기 메시지 전송 오류:', error))
        }
      }, 1000)
      return
    }
    
    // 서버 응답 처리
    if (message.serverContent) {
      const content = message.serverContent
      
      // 입력 전사 (사용자 음성 → 텍스트)
      if (content.inputTranscription) {
        console.log('사용자 음성 전사:', content.inputTranscription.text)
        const userMessage: Conversation = {
          role: 'user',
          content: content.inputTranscription.text,
          timestamp: new Date()
        }
        setConversations(prev => [...prev, userMessage])
      }
      
      // 텍스트 응답 처리
      if (content.modelTurn && content.modelTurn.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.text) {
            console.log('AI 텍스트 응답:', part.text)
            const assistantMessage: Conversation = {
              role: 'assistant',
              content: part.text,
              timestamp: new Date(),
              audioComplete: true
            }
            setConversations(prev => [...prev, assistantMessage])
            
            // 대화 저장
            onConversationSave('AI 질문', part.text).catch(console.error)
          }
          
          // 오디오 응답 처리
          if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
            console.log('AI 오디오 응답 수신')
            try {
              playAudioData(part.inlineData.data)
              setIsAISpeaking(true)
            } catch (error) {
              console.error('오디오 재생 오류:', error)
            }
          }
        }
      }
      
      // 출력 전사 (AI 음성 → 텍스트)
      if (content.outputTranscription) {
        console.log('AI 음성 전사:', content.outputTranscription.text)
      }
      
      // 턴 완료 처리
      if (content.turnComplete) {
        console.log('턴 완료')
        setIsAISpeaking(false)
      }
      
      // 인터럽트 처리
      if (content.interrupted) {
        console.log('AI 응답 인터럽트됨')
        setIsAISpeaking(false)
      }
    }
  }, [onConversationSave])

  const playAudioData = (base64AudioData: string) => {
    if (!audioContextRef.current) return

    try {
      // Base64 디코딩
      const binaryString = atob(base64AudioData)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const int16Data = new Int16Array(bytes.buffer)
      
      // Int16 to Float32 변환
      const floatData = new Float32Array(int16Data.length)
      for (let i = 0; i < int16Data.length; i++) {
        floatData[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7FFF)
      }
      
      // 오디오 버퍼 생성 및 재생 (24kHz)
      const audioContext = audioContextRef.current
      const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000)
      audioBuffer.getChannelData(0).set(floatData)

      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      source.start()
      
      source.onended = () => {
        setIsAISpeaking(false)
      }
    } catch (error) {
      console.error('오디오 재생 실패:', error)
    }
  }

  const startRecording = () => {
    if (!isConnected) {
      connectToGemini()
      return
    }
    
    setIsRecording(true)
    setConnectionStatus('음성 녹음 중...')
  }

  const stopRecording = () => {
    setIsRecording(false)
    setConnectionStatus('음성 인터뷰 준비 완료')
  }

  const disconnect = useCallback(async () => {
    console.log('Gemini Live 연결 해제 중...')

    // Gemini Live 세션 해제
    if (sessionRef.current) {
      try {
        sessionRef.current.close()
      } catch (error) {
        console.error('Gemini Live 세션 종료 오류:', error)
      }
      sessionRef.current = null
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
          Google의 최신 Gemini 2.5 Flash Native Audio Dialog 모델과 실시간 음성 대화를 나누세요
        </p>
        {isMobile && (
          <p className="text-xs sm:text-sm text-amber-600 mt-2">
            📱 모바일 환경입니다. Chrome 또는 Safari 브라우저 사용을 권장합니다.
          </p>
        )}
      </div>

      {/* 연결 상태 표시 */}
      <div className="flex items-center justify-center mb-4 sm:mb-6">
        <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span className="text-sm text-gray-600">
          {isConnected ? '연결됨' : '연결 안됨'}
        </span>
      </div>

      {/* 음성 인터뷰 컨트롤 */}
      <div className="flex flex-col items-center gap-4 mb-6">
        {!isConnected ? (
          <button
            onClick={connectToGemini}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
          >
            🎤 Gemini Live 연결
          </button>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={startRecording}
              disabled={isRecording || isAISpeaking}
              className={`font-bold py-3 px-6 rounded-lg text-lg transition-colors ${
                isRecording 
                  ? 'bg-red-600 text-white cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isRecording ? '🔴 녹음 중...' : '🎙️ 말하기 시작'}
            </button>
            <button
              onClick={stopRecording}
              disabled={!isRecording}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
            >
              ⏹️ 말하기 중단
            </button>
          </div>
        )}
      </div>

      {/* AI 응답 상태 */}
      {isAISpeaking && (
        <div className="text-center mb-4">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-blue-800 text-sm">AI가 응답 중입니다...</span>
          </div>
        </div>
      )}

      {/* 대화 내용 */}
      {conversations.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
          <h4 className="font-semibold text-gray-700 mb-3">실시간 대화 내용</h4>
          <div className="space-y-3">
            {conversations.map((conv, index) => (
              <div key={index} className={`flex ${conv.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  conv.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-800 border'
                }`}>
                  <p className="text-sm">{conv.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {conv.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 도움말 */}
      <div className="mt-6 text-xs text-gray-500">
        <p className="mb-2">💡 사용 방법:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>• "Gemini Live 연결" 버튼을 클릭하여 연결</li>
          <li>• "말하기 시작" 버튼을 누르고 자연스럽게 대화</li>
          <li>• AI가 실시간으로 음성으로 응답합니다</li>
          <li>• 브라우저가 마이크 권한을 요청하면 허용해주세요</li>
        </ul>
      </div>
    </div>
  )
}