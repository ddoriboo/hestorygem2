'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface DirectRealtimeVoiceInterviewProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}

interface Conversation {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  audioComplete?: boolean
}

export default function DirectRealtimeVoiceInterview({ sessionNumber, onConversationSave }: DirectRealtimeVoiceInterviewProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [connectionStatus, setConnectionStatus] = useState('연결 준비 중...')
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [isAISpeaking, setIsAISpeaking] = useState(false)

  // WebSocket and Audio refs
  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  const connectToRealtime = useCallback(async () => {
    try {
      setConnectionStatus('OpenAI API 키 가져오는 중...')

      // API 키 요청
      const tokenResponse = await fetch('/api/interview/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber })
      })

      if (!tokenResponse.ok) {
        throw new Error('API 키 요청에 실패했습니다.')
      }

      const { apiKey, sessionPrompt } = await tokenResponse.json()

      setConnectionStatus('마이크 권한 요청 중...')

      // 마이크 설정
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 24000,
            channelCount: 1
          }
        })
        localStreamRef.current = stream
        console.log('마이크 스트림 설정 완료')
      } catch (error) {
        console.error('마이크 액세스 실패:', error)
        setConnectionStatus('마이크 권한이 필요합니다.')
        return
      }

      setConnectionStatus('OpenAI Realtime API 연결 중...')

      // WebSocket 연결 (브라우저에서는 헤더를 URL에 포함해야 함)
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`
      )
      
      // Authorization 헤더는 WebSocket 연결 후 첫 메시지로 전송
      const authMessage = {
        type: 'session.auth',
        token: apiKey
      }

      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket 연결됨')
        setIsConnected(true)
        setConnectionStatus('음성 인터뷰 준비 완료')

        // 세션 설정
        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions: sessionPrompt,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            temperature: 0.7,
            max_response_output_tokens: 300
          }
        }

        ws.send(JSON.stringify(sessionConfig))

        // 오디오 녹음 설정
        setupAudioRecording()

        // 초기 응답 요청
        setTimeout(() => {
          ws.send(JSON.stringify({ type: 'response.create' }))
        }, 1000)
      }

      ws.onmessage = handleRealtimeEvent

      ws.onerror = (error) => {
        console.error('WebSocket 오류:', error)
        setConnectionStatus('연결 오류가 발생했습니다.')
      }

      ws.onclose = (event) => {
        console.log('WebSocket 연결 해제:', event.code, event.reason)
        setIsConnected(false)
        setConnectionStatus(`연결 해제됨 (${event.code})`)
      }

    } catch (error) {
      console.error('Realtime 연결 오류:', error)
      setConnectionStatus(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [sessionNumber])

  const setupAudioRecording = useCallback(async () => {
    if (!localStreamRef.current) return

    try {
      // AudioContext 설정
      const audioContext = new AudioContext({ sampleRate: 24000 })
      audioContextRef.current = audioContext

      // MediaRecorder 설정 (PCM16 형식)
      const mediaRecorder = new MediaRecorder(localStreamRef.current)
      mediaRecorderRef.current = mediaRecorder

      let audioChunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        if (audioChunks.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
          await sendAudioData(audioBlob)
          audioChunks = []
        }
        setIsRecording(false)
      }

      mediaRecorder.onstart = () => {
        setIsRecording(true)
        audioChunks = []
      }

    } catch (error) {
      console.error('오디오 녹음 설정 오류:', error)
    }
  }, [])

  const sendAudioData = useCallback(async (audioBlob: Blob) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    try {
      // Convert to base64 PCM16
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioData = new Uint8Array(arrayBuffer)
      const base64Audio = btoa(String.fromCharCode(...audioData))

      // Send audio data
      wsRef.current.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio
      }))

      // Commit audio buffer
      wsRef.current.send(JSON.stringify({
        type: 'input_audio_buffer.commit'
      }))

      // Request response
      wsRef.current.send(JSON.stringify({
        type: 'response.create'
      }))

    } catch (error) {
      console.error('오디오 데이터 전송 오류:', error)
    }
  }, [])

  const handleRealtimeEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      console.log('Realtime 이벤트:', data.type, data)

      switch (data.type) {
        case 'session.created':
          console.log('세션 생성됨:', data.session)
          break

        case 'session.updated':
          console.log('세션 업데이트됨')
          break

        case 'response.created':
          console.log('응답 생성 시작')
          setIsAISpeaking(true)
          break

        case 'response.audio_transcript.delta':
          // AI 응답 텍스트 실시간 업데이트
          setCurrentTranscript(prev => prev + data.delta)
          break

        case 'response.audio_transcript.done':
          // AI 응답 완료
          const assistantMessage: Conversation = {
            role: 'assistant',
            content: data.transcript,
            timestamp: new Date(),
            audioComplete: true
          }
          setConversations(prev => [...prev, assistantMessage])
          setCurrentTranscript('')
          setIsAISpeaking(false)
          break

        case 'response.audio.delta':
          // AI 응답 오디오 실시간 재생
          if (data.delta) {
            playAudioChunk(data.delta)
          }
          break

        case 'input_audio_buffer.speech_started':
          console.log('사용자 음성 감지 시작')
          setIsRecording(true)
          break

        case 'input_audio_buffer.speech_stopped':
          console.log('사용자 음성 감지 중지')
          setIsRecording(false)
          break

        case 'conversation.item.input_audio_transcription.completed':
          // 사용자 음성 텍스트 변환 완료
          const userMessage: Conversation = {
            role: 'user',
            content: data.transcript,
            timestamp: new Date()
          }
          setConversations(prev => {
            const newConversations = [...prev, userMessage]
            
            // 대화 저장 (질문-답변 쌍)
            if (newConversations.length >= 2) {
              const lastAssistant = newConversations[newConversations.length - 2]
              if (lastAssistant && lastAssistant.role === 'assistant') {
                onConversationSave(lastAssistant.content, userMessage.content)
              }
            }
            
            return newConversations
          })
          break

        case 'response.done':
          console.log('응답 완료:', data.response)
          setIsAISpeaking(false)
          break

        case 'error':
          console.error('Realtime API 오류:', data)
          setConnectionStatus(`오류: ${data.error?.message || '알 수 없는 오류'}`)
          break

        default:
          console.log('처리되지 않은 이벤트:', data.type)
      }
    } catch (error) {
      console.error('이벤트 처리 오류:', error)
    }
  }, [onConversationSave])

  const playAudioChunk = useCallback(async (audioData: string) => {
    try {
      if (!audioContextRef.current) return

      // Base64 디코딩
      const binaryString = atob(audioData)
      const len = binaryString.length
      const bytes = new Uint8Array(len)
      
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // PCM16 to Float32Array
      const pcmData = new Int16Array(bytes.buffer)
      const floatData = new Float32Array(pcmData.length)
      
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0
      }

      // AudioBuffer 생성 및 재생
      const audioBuffer = audioContextRef.current.createBuffer(1, floatData.length, 24000)
      audioBuffer.getChannelData(0).set(floatData)
      
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)
      source.start()
      
    } catch (error) {
      console.error('오디오 재생 오류:', error)
    }
  }, [])

  const disconnect = useCallback(() => {
    console.log('연결 해제 중...')

    // WebSocket 해제
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // 녹음 중지
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    // 스트림 해제
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    // AudioContext 해제
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsConnected(false)
    setIsRecording(false)
    setIsAISpeaking(false)
    setConnectionStatus('연결 해제됨')
  }, [])

  const interruptAI = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isAISpeaking) {
      wsRef.current.send(JSON.stringify({
        type: 'response.cancel'
      }))
      setIsAISpeaking(false)
    }
  }, [isAISpeaking])

  const startRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      mediaRecorderRef.current.start(100) // 100ms 간격으로 데이터 수집
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">🎤 실시간 음성 인터뷰 (Direct)</h3>
        <p className="text-gray-600">{connectionStatus}</p>
      </div>

      {/* 연결 버튼 */}
      <div className="flex justify-center mb-6 space-x-4">
        {!isConnected ? (
          <button
            onClick={connectToRealtime}
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
            {isAISpeaking && (
              <button
                onClick={interruptAI}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-medium"
              >
                ⏸️ AI 중단
              </button>
            )}
          </>
        )}
      </div>

      {/* 수동 녹음 버튼 */}
      {isConnected && (
        <div className="flex justify-center mb-6 space-x-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              🎙️ 수동 녹음 시작
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              ⏹️ 녹음 정지
            </button>
          )}
        </div>
      )}

      {/* 음성 상태 표시 */}
      {isConnected && (
        <div className="text-center mb-6">
          <div className="space-y-2">
            <div className={`inline-flex items-center px-4 py-2 rounded-full ${
              isRecording ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
            }`}>
              <div className={`w-3 h-3 rounded-full mr-2 ${
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
              }`} />
              {isRecording ? '🎤 말씀하고 계십니다...' : '🎧 AI 인터뷰어가 듣고 있습니다'}
            </div>
            
            {isAISpeaking && (
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800">
                <div className="w-3 h-3 rounded-full mr-2 bg-blue-500 animate-pulse" />
                🗣️ AI가 응답하고 있습니다...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 현재 AI 응답 표시 */}
      {currentTranscript && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
          <p className="text-blue-800 font-medium">AI (실시간):</p>
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
                {conv.role === 'assistant' ? '🤖 AI 인터뷰어' : '👤 아버님'}
                {conv.audioComplete && conv.role === 'assistant' && (
                  <span className="ml-2 text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded">음성 완료</span>
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
            <p className="text-sm mt-2">마이크 권한을 허용하고 AI의 질문을 기다려주세요.</p>
          </div>
        )}
      </div>

      {/* 사용 팁 */}
      {isConnected && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          <h4 className="font-medium text-gray-800 mb-2">💡 사용 팁:</h4>
          <ul className="space-y-1 text-xs">
            <li>• AI가 질문을 하면 자연스럽게 답변해주세요</li>
            <li>• 음성 감지가 자동으로 이루어집니다</li>
            <li>• 수동 녹음 버튼으로도 녹음할 수 있습니다</li>
            <li>• AI가 말하는 중에도 자연스럽게 대화할 수 있습니다</li>
            <li>• 답변이 길어도 괜찮습니다 - 편안하게 이야기해주세요</li>
          </ul>
        </div>
      )}
    </div>
  )
}