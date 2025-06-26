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
  const responseQueueRef = useRef<any[]>([])
  const messageHandlersRef = useRef<((data: any) => void)[]>([])

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

  // 공식 예제 패턴: 메시지 대기 함수
  const waitMessage = useCallback(async () => {
    let done = false
    let message = undefined
    while (!done) {
      message = responseQueueRef.current.shift()
      if (message) {
        done = true
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
    return message
  }, [])

  // 공식 예제 패턴: 턴 처리 함수
  const handleTurn = useCallback(async () => {
    const turns = []
    let done = false
    while (!done) {
      const message = await waitMessage()
      turns.push(message)
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true
      }
    }
    return turns
  }, [waitMessage])

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
      const { GoogleGenAI, Modality } = await import('@google/genai')
      
      // Gemini AI 초기화
      const genAI = new GoogleGenAI({ apiKey: config.apiKey })
      geminiClientRef.current = genAI
      
      console.log('Gemini Live 연결 시도:', config.model)
      
      // 응답 큐 초기화
      responseQueueRef.current = []
      
      // Live API 연결 (공식 예제 패턴)
      const session = await genAI.live.connect({
        model: config.model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: config.sessionPrompt
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live 연결 성공')
            setIsConnected(true)
            setConnectionStatus('음성 인터뷰 준비 완료')
          },
          onmessage: (message: any) => {
            console.log('Gemini Live 메시지:', message)
            // 공식 예제 패턴: 메시지를 큐에 추가
            responseQueueRef.current.push(message)
            // 즉시 UI 업데이트를 위한 핸들러 호출
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
      // 공식 예제 패턴: Int16Array를 base64로 변환
      const buffer = Buffer.from(audioData.buffer)
      const base64Audio = buffer.toString('base64')
      
      // 전송 로그
      console.log('오디오 전송 중...', {
        크기: audioData.length,
        바이트: audioData.buffer.byteLength,
        base64길이: base64Audio.length
      })
      
      // 공식 예제와 동일한 형식으로 전송
      sessionRef.current.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: "audio/pcm;rate=16000"
        }
      })
      
      console.log('오디오 전송 완료')
    } catch (error) {
      console.error('오디오 전송 오류:', error)
      
      // 브라우저에서 Buffer가 없을 경우 대안 방식
      try {
        console.log('대안 방식으로 재시도...')
        const bytes = new Uint8Array(audioData.buffer)
        let base64Audio = ''
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize)
          base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)))
        }
        
        sessionRef.current.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: "audio/pcm;rate=16000"
          }
        })
        console.log('대안 방식으로 전송 성공')
      } catch (retryError) {
        console.error('재시도도 실패:', retryError)
      }
    }
  }

  const handleGeminiMessage = useCallback((message: any) => {
    console.log('Gemini 응답:', message)
    
    // 설정 완료
    if (message.setupComplete) {
      console.log('Gemini Live 설정 완료! 이제 수동으로 테스트할 수 있습니다.')
      return
    }
    
    // 서버 응답 처리 (실시간 스트리밍용)
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
      
      // 텍스트 응답 처리 (실시간 스트리밍)
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
          
          // 오디오 응답 처리 (실시간 스트리밍)
          if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
            console.log('AI 오디오 응답 수신 (실시간)')
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

  const playAudioData = (audioData: number[] | string) => {
    if (!audioContextRef.current) return

    try {
      let int16Data: Int16Array

      if (typeof audioData === 'string') {
        // Base64 문자열인 경우
        const binaryString = atob(audioData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        int16Data = new Int16Array(bytes.buffer)
      } else {
        // 숫자 배열인 경우 (공식 예제 패턴)
        int16Data = new Int16Array(audioData)
      }
      
      // Int16 to Float32 변환
      const floatData = new Float32Array(int16Data.length)
      for (let i = 0; i < int16Data.length; i++) {
        floatData[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7FFF)
      }
      
      // 오디오 버퍼 생성 및 재생 (24kHz - 공식 예제와 동일)
      const audioContext = audioContextRef.current
      const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000)
      audioBuffer.getChannelData(0).set(floatData)

      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      source.start()
      
      source.onended = () => {
        setIsAISpeaking(false)
        console.log('오디오 재생 완료')
      }

      console.log('오디오 재생 시작됨, 지속시간:', audioBuffer.duration, '초')
    } catch (error) {
      console.error('오디오 재생 실패:', error)
      setIsAISpeaking(false)
    }
  }

  const startRecording = () => {
    if (!isConnected) {
      console.log('연결되지 않음, 녹음 시작 불가')
      return
    }
    
    setIsRecording(true)
    setConnectionStatus('음성 녹음 중...')
  }

  const stopRecording = () => {
    setIsRecording(false)
    setConnectionStatus('음성 인터뷰 준비 완료')
  }

  const sendTestMessage = async () => {
    if (!sessionRef.current) {
      console.log('세션이 없어서 테스트 메시지 전송 불가')
      return
    }

    try {
      console.log('테스트 메시지 전송 중...')
      setIsAISpeaking(true)
      
      // 텍스트 메시지 전송
      await sessionRef.current.sendClientContent({
        turns: [{ role: "user", parts: [{ text: "안녕하세요! 간단한 인사말을 해주세요." }] }],
        turnComplete: true
      })
      console.log('테스트 메시지 전송 완료')

      // 공식 예제 패턴: 응답 대기
      console.log('AI 응답 대기 중...')
      const turns = await handleTurn()
      console.log('AI 응답 수신:', turns)

      // 응답 처리
      let combinedAudio: number[] = []
      for (const turn of turns) {
        if (turn.data) {
          console.log('오디오 데이터 수신, 크기:', turn.data.length)
          // Base64 데이터를 Int16Array로 변환
          const binaryString = atob(turn.data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          const int16Array = new Int16Array(bytes.buffer)
          combinedAudio = combinedAudio.concat(Array.from(int16Array))
        }
      }

      if (combinedAudio.length > 0) {
        console.log('오디오 재생 시작, 전체 크기:', combinedAudio.length)
        playAudioData(combinedAudio)
      }

      setIsAISpeaking(false)
    } catch (error) {
      console.error('테스트 메시지 전송 오류:', error)
      setIsAISpeaking(false)
    }
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
          <div className="flex flex-col gap-3">
            {/* 텍스트 테스트 버튼 */}
            <button
              onClick={sendTestMessage}
              disabled={isAISpeaking}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              💬 텍스트 메시지 테스트 (AI가 음성으로 응답)
            </button>
            
            {/* 음성 녹음 컨트롤 */}
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
                {isRecording ? '🔴 녹음 중...' : '🎙️ 음성 녹음 시작'}
              </button>
              <button
                onClick={stopRecording}
                disabled={!isRecording}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
              >
                ⏹️ 녹음 중단
              </button>
            </div>
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
        <p className="mb-2">💡 테스트 순서:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>• 1단계: "Gemini Live 연결" 버튼으로 연결</li>
          <li>• 2단계: "텍스트 메시지 테스트" 버튼으로 AI 음성 응답 확인</li>
          <li>• 3단계: "음성 녹음 시작" 버튼으로 음성 입력 테스트</li>
          <li>• 브라우저가 마이크 권한을 요청하면 허용해주세요</li>
          <li>• 콘솔 로그에서 상세한 진행 상황을 확인할 수 있습니다</li>
        </ul>
      </div>
    </div>
  )
}