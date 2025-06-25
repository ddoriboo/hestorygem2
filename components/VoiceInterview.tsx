'use client'

import { useState, useEffect, useRef } from 'react'
import { getSessionPrompt } from '@/lib/session-prompts'

interface VoiceInterviewProps {
  sessionId: string
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}

interface Conversation {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function VoiceInterview({ sessionId, sessionNumber, onConversationSave }: VoiceInterviewProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [connectionStatus, setConnectionStatus] = useState<string>('연결 준비 중...')
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [userResponse, setUserResponse] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const conversationRef = useRef<Conversation[]>([])

  useEffect(() => {
    conversationRef.current = conversations
  }, [conversations])

  const connectToRealtime = async () => {
    try {
      setConnectionStatus('음성 인터뷰 준비 중...')
      
      // Realtime API 설정 요청
      const response = await fetch('/api/interview/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber })
      })

      if (!response.ok) {
        throw new Error('인터뷰 설정에 실패했습니다.')
      }

      const { apiKey, sessionPrompt } = await response.json()

      // WebSocket 연결 (브라우저에서는 headers를 URL 파라미터로 전달할 수 없음)
      // 실제 구현에서는 서버에서 프록시 역할을 해야 함
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01&authorization=${encodeURIComponent(apiKey)}`
      )

      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        setConnectionStatus('음성 인터뷰 준비 완료')
        
        // 세션 설정
        const sessionUpdate = {
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
            }
          }
        }
        
        ws.send(JSON.stringify(sessionUpdate))
        
        // 초기 대화 시작
        ws.send(JSON.stringify({ type: 'response.create' }))
      }

      ws.onmessage = handleServerEvent
      
      ws.onerror = (error) => {
        console.error('WebSocket 오류:', error)
        setConnectionStatus('연결 오류가 발생했습니다.')
      }

      ws.onclose = () => {
        setIsConnected(false)
        setConnectionStatus('연결이 해제되었습니다.')
      }

      // 마이크 설정
      await setupAudio()

    } catch (error) {
      console.error('연결 오류:', error)
      setConnectionStatus(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  const setupAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          sampleSize: 16
        }
      })

      const audioContext = new AudioContext({ sampleRate: 24000 })
      audioContextRef.current = audioContext

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=pcm'
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const arrayBuffer = await event.data.arrayBuffer()
          const audioData = new Int16Array(arrayBuffer)
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData.buffer)))
          
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Audio
          }))
        }
      }

      mediaRecorder.onstart = () => setIsRecording(true)
      mediaRecorder.onstop = () => {
        setIsRecording(false)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.commit'
          }))
          wsRef.current.send(JSON.stringify({
            type: 'response.create'
          }))
        }
      }

    } catch (error) {
      console.error('오디오 설정 오류:', error)
      setConnectionStatus('마이크 액세스가 필요합니다.')
    }
  }

  const handleServerEvent = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      console.log('서버 이벤트:', data.type, data)
      
      switch (data.type) {
        case 'session.created':
          console.log('세션이 생성되었습니다.')
          break
          
        case 'response.audio_transcript.delta':
          // AI 응답 텍스트 실시간 업데이트
          setCurrentQuestion(prev => prev + data.delta)
          break
          
        case 'response.audio_transcript.done':
          // AI 응답 완료
          const aiMessage: Conversation = {
            role: 'assistant',
            content: data.transcript,
            timestamp: new Date()
          }
          setConversations(prev => [...prev, aiMessage])
          setCurrentQuestion('')
          break
          
        case 'response.audio.delta':
          // 오디오 데이터 수신 및 재생
          playAudioChunk(data.delta)
          break
          
        case 'input_audio_buffer.speech_started':
          setUserResponse('말씀하고 계십니다...')
          if (mediaRecorderRef.current?.state === 'inactive') {
            mediaRecorderRef.current.start(250) // 250ms 간격으로 데이터 전송
          }
          break
          
        case 'input_audio_buffer.speech_stopped':
          setUserResponse('')
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
          }
          break
          
        case 'conversation.item.input_audio_transcription.completed':
          // 사용자 응답 텍스트
          const userMessage: Conversation = {
            role: 'user',
            content: data.transcript,
            timestamp: new Date()
          }
          setConversations(prev => [...prev, userMessage])
          
          // 대화 저장
          const currentConversations = [...conversationRef.current, userMessage]
          if (currentConversations.length >= 2) {
            const lastAI = currentConversations.findLast(c => c.role === 'assistant')
            const lastUser = currentConversations.findLast(c => c.role === 'user')
            
            if (lastAI && lastUser) {
              onConversationSave(lastAI.content, lastUser.content)
            }
          }
          break
      }
    } catch (error) {
      console.error('서버 이벤트 처리 오류:', error)
    }
  }

  const playAudioChunk = (audioData: string) => {
    try {
      if (!audioContextRef.current) return
      
      const binaryString = atob(audioData)
      const audioBuffer = new ArrayBuffer(binaryString.length)
      const audioView = new Uint8Array(audioBuffer)
      
      for (let i = 0; i < binaryString.length; i++) {
        audioView[i] = binaryString.charCodeAt(i)
      }
      
      audioContextRef.current.decodeAudioData(audioBuffer)
        .then(decodedBuffer => {
          const source = audioContextRef.current!.createBufferSource()
          source.buffer = decodedBuffer
          source.connect(audioContextRef.current!.destination)
          source.start()
        })
        .catch(err => console.error('오디오 재생 오류:', err))
    } catch (error) {
      console.error('오디오 청크 처리 오류:', error)
    }
  }

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setIsConnected(false)
    setIsRecording(false)
    setConnectionStatus('연결 해제됨')
  }

  const startManualRecording = () => {
    if (mediaRecorderRef.current?.state === 'inactive') {
      mediaRecorderRef.current.start(250)
      setIsRecording(true)
    }
  }

  const stopManualRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">음성 인터뷰</h3>
        <p className="text-gray-600">{connectionStatus}</p>
      </div>

      {/* 연결 버튼 */}
      <div className="flex justify-center mb-6">
        {!isConnected ? (
          <button
            onClick={connectToRealtime}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            음성 인터뷰 시작
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            인터뷰 종료
          </button>
        )}
      </div>

      {/* 음성 상태 표시 */}
      {isConnected && (
        <div className="text-center mb-6">
          <div className={`inline-flex items-center px-4 py-2 rounded-full ${
            isRecording ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            <div className={`w-3 h-3 rounded-full mr-2 ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'
            }`} />
            {isRecording ? '말씀하고 계십니다...' : '인터뷰가 진행 중입니다'}
          </div>
        </div>
      )}

      {/* 현재 질문 표시 */}
      {currentQuestion && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-blue-800 font-medium">AI:</p>
          <p className="text-blue-700 mt-1">{currentQuestion}</p>
        </div>
      )}

      {/* 사용자 응답 상태 */}
      {userResponse && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-600 italic">{userResponse}</p>
        </div>
      )}

      {/* 수동 녹음 버튼 (VAD가 작동하지 않을 경우) */}
      {isConnected && (
        <div className="flex justify-center space-x-4 mb-6">
          {!isRecording ? (
            <button
              onClick={startManualRecording}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
            >
              🎤 수동 녹음 시작
            </button>
          ) : (
            <button
              onClick={stopManualRecording}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              🛑 녹음 정지
            </button>
          )}
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
                {conv.role === 'assistant' ? 'AI' : '아버님'}
              </span>
              <span className="text-xs text-gray-500">
                {conv.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <p className="text-gray-800">{conv.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}