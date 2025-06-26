'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface OpenAIRealtimeVoiceInterviewProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}

interface Conversation {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  audioComplete?: boolean
}

export default function OpenAIRealtimeVoiceInterview({ sessionNumber, onConversationSave }: OpenAIRealtimeVoiceInterviewProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [connectionStatus, setConnectionStatus] = useState('연결 준비 중...')
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [isAISpeaking, setIsAISpeaking] = useState(false)

  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  const connectToRealtime = useCallback(async () => {
    try {
      setConnectionStatus('세션 토큰을 가져오는 중...')

      // OpenAI Realtime API 세션 토큰 요청
      const tokenResponse = await fetch('/api/interview/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber })
      })

      if (!tokenResponse.ok) {
        throw new Error('세션 토큰 요청에 실패했습니다.')
      }

      const { apiKey, sessionPrompt, model, voice } = await tokenResponse.json()
      console.log('API 설정 받음:', { model, voice })

      setConnectionStatus('마이크 권한 요청 중...')

      // 마이크 설정 (모바일 호환성 개선)
      try {
        // 모바일에서도 호환되는 간단한 constraints 사용
        const audioConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // 모바일에서 문제가 될 수 있는 설정들 제거
            ...(typeof window !== 'undefined' && !navigator.userAgent.match(/iPhone|iPad|iPod|Android/i) && {
              sampleRate: 24000,
              channelCount: 1
            })
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia(audioConstraints)
        audioStreamRef.current = stream
        console.log('마이크 스트림 설정 완료')
      } catch (error: any) {
        console.error('마이크 액세스 실패:', error)
        
        // 더 구체적인 오류 메시지
        if (error.name === 'NotAllowedError') {
          setConnectionStatus('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.')
        } else if (error.name === 'NotFoundError') {
          setConnectionStatus('마이크가 감지되지 않습니다.')
        } else if (error.name === 'NotSupportedError') {
          setConnectionStatus('이 브라우저는 음성 기능을 지원하지 않습니다.')
        } else {
          setConnectionStatus(`마이크 오류: ${error.message || '알 수 없는 오류'}`)
        }
        return
      }

      setConnectionStatus('OpenAI Realtime API 연결 중...')

      // WebRTC 설정
      await setupWebRTC(apiKey, sessionPrompt, model, voice)

    } catch (error) {
      console.error('Realtime 연결 오류:', error)
      setConnectionStatus(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [sessionNumber])

  const setupWebRTC = useCallback(async (apiKey: string, sessionPrompt: string, model: string, voice: string) => {
    try {
      // RTCPeerConnection 생성
      const peerConnection = new RTCPeerConnection()
      peerConnectionRef.current = peerConnection

      // 오디오 출력 설정
      const audioElement = document.createElement('audio')
      audioElement.autoplay = true
      
      peerConnection.ontrack = (event) => {
        console.log('원격 오디오 트랙 수신:', event.streams[0])
        audioElement.srcObject = event.streams[0]
      }

      // 로컬 오디오 스트림 추가
      if (audioStreamRef.current) {
        const audioTrack = audioStreamRef.current.getTracks()[0]
        peerConnection.addTrack(audioTrack, audioStreamRef.current)
      }

      // 데이터 채널 설정
      const dataChannel = peerConnection.createDataChannel('oai-events')
      dataChannelRef.current = dataChannel

      dataChannel.onopen = () => {
        console.log('데이터 채널 연결됨')
        setIsConnected(true)
        setConnectionStatus('세션 설정 중...')

        // 1. 세션 설정: 음성 전사 활성화 및 시스템 프롬프트 설정
        const sessionUpdateMessage = {
          type: 'session.update',
          session: {
            instructions: sessionPrompt,
            voice: voice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200
            },
            tools: [],
            tool_choice: 'auto',
            temperature: 0.8,
            max_response_output_tokens: 4096
          }
        }

        console.log('세션 설정 메시지 전송:', sessionUpdateMessage)
        dataChannel.send(JSON.stringify(sessionUpdateMessage))

        // 2. 잠시 대기 후 첫 번째 응답 요청
        setTimeout(() => {
          setConnectionStatus('음성 인터뷰 준비 완료')
          setIsRecording(true)
          console.log('첫 번째 응답 요청 전송')
          sendMessage({ type: 'response.create' })
        }, 1500)
      }

      dataChannel.onmessage = handleRealtimeEvent
      dataChannel.onerror = (error) => {
        console.error('데이터 채널 오류:', error)
        setConnectionStatus('데이터 채널 오류가 발생했습니다.')
      }

      dataChannel.onclose = () => {
        console.log('데이터 채널 연결 해제')
        setIsConnected(false)
        setConnectionStatus('연결 해제됨')
      }

      // ICE 상태 변화 모니터링
      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE 연결 상태:', peerConnection.iceConnectionState)
        if (peerConnection.iceConnectionState === 'failed') {
          setConnectionStatus('네트워크 연결에 실패했습니다.')
        }
      }

      // SDP Offer 생성
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      // OpenAI Realtime API에 SDP offer 전송
      const realtimeResponse = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      })

      if (!realtimeResponse.ok) {
        throw new Error(`Realtime API 연결 실패: ${realtimeResponse.status}`)
      }

      const answerSdp = await realtimeResponse.text()
      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      })

      console.log('OpenAI Realtime API WebRTC 연결 완료')

    } catch (error) {
      console.error('WebRTC 설정 오류:', error)
      setConnectionStatus(`WebRTC 설정 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [])

  const addUserMessage = useCallback(async (transcript: string) => {
    const userMessage: Conversation = {
      role: 'user',
      content: transcript,
      timestamp: new Date()
    }
    
    setConversations(prev => {
      // 중복 메시지 방지
      const lastMessage = prev[prev.length - 1]
      if (lastMessage && lastMessage.role === 'user' && lastMessage.content === transcript) {
        return prev
      }
      
      const newConversations = [...prev, userMessage]
      
      // 대화 저장 (가장 최근 AI 질문과 사용자 답변 쌍으로 저장)
      const lastAssistant = newConversations
        .slice()
        .reverse()
        .find(conv => conv.role === 'assistant')
      
      if (lastAssistant) {
        console.log('💾 대화 저장 시도:', lastAssistant.content, userMessage.content)
        // 비동기로 저장하되 에러는 무시 (UI 차단 방지)
        onConversationSave(lastAssistant.content, userMessage.content)
          .then(() => console.log('✅ 대화 저장 성공'))
          .catch((error) => {
            console.error('❌ 대화 저장 실패:', error)
            // 저장 실패해도 대화는 계속 진행 (사용자 경험 우선)
          })
      }
      
      return newConversations
    })
  }, [onConversationSave])

  const handleRealtimeEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      console.log('🔄 Realtime 이벤트:', data.type, data)

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
          setCurrentTranscript(prev => prev + (data.delta || ''))
          break

        case 'response.audio_transcript.done':
          // AI 응답 완료 (메시지 추가는 여기서만 처리)
          if (data.transcript && data.transcript.trim()) {
            const assistantMessage: Conversation = {
              role: 'assistant',
              content: data.transcript.trim(),
              timestamp: new Date(),
              audioComplete: true
            }
            setConversations(prev => [...prev, assistantMessage])
          }
          setCurrentTranscript('')
          setIsAISpeaking(false)
          break

        case 'conversation.item.input_audio_transcription.completed':
          // 사용자 음성 텍스트 변환 완료
          console.log('🎙️ 사용자 음성 텍스트 변환 완료:', data)
          if (data.transcript && data.transcript.trim()) {
            addUserMessage(data.transcript.trim())
          }
          break

        case 'conversation.item.created':
          // 대화 아이템 생성됨 (사용자 메시지 포함)
          console.log('💬 대화 아이템 생성됨:', data)
          if (data.item?.type === 'message' && data.item?.role === 'user') {
            const content = data.item.content
            if (content && content.length > 0) {
              const transcript = content
                .map((c: any) => c.text || c.transcript || c.audio?.transcript || '')
                .filter(Boolean)
                .join(' ')
              if (transcript && transcript.trim()) {
                addUserMessage(transcript.trim())
              }
            }
          }
          break

        case 'item.input_audio_transcription.completed':
          // 다른 형태의 사용자 음성 텍스트 변환 완료 이벤트
          console.log('🎤 음성 변환 완료 (다른 형태):', data)
          if (data.transcript && data.transcript.trim()) {
            addUserMessage(data.transcript.trim())
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

        case 'response.done':
          console.log('응답 완료:', data.response)
          setIsAISpeaking(false)
          // 메시지 추가는 response.audio_transcript.done에서만 처리하므로 여기서는 제거
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
  }, [addUserMessage])

  const sendMessage = useCallback((message: any) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message))
    }
  }, [])

  const disconnect = useCallback(() => {
    console.log('연결 해제 중...')

    // 데이터 채널 해제
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }

    // 피어 연결 해제
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // 오디오 스트림 해제
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }

    setIsConnected(false)
    setIsRecording(false)
    setIsAISpeaking(false)
    setConnectionStatus('연결 해제됨')
  }, [])

  const interruptAI = useCallback(() => {
    if (isAISpeaking) {
      sendMessage({ type: 'response.cancel' })
      setIsAISpeaking(false)
    }
  }, [isAISpeaking, sendMessage])

  // 모바일 브라우저 체크
  const isMobile = typeof window !== 'undefined' && navigator.userAgent.match(/iPhone|iPad|iPod|Android/i)
  const isIOS = typeof window !== 'undefined' && navigator.userAgent.match(/iPhone|iPad|iPod/i)

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">🎤 OpenAI Realtime 음성 인터뷰</h3>
        <p className="text-sm sm:text-base text-gray-600">{connectionStatus}</p>
        {isMobile && (
          <p className="text-xs sm:text-sm text-amber-600 mt-2">
            📱 모바일 환경입니다. {isIOS ? 'Safari' : 'Chrome'} 브라우저 사용을 권장합니다.
          </p>
        )}
      </div>

      {/* 연결 버튼 */}
      <div className="flex justify-center mb-4 sm:mb-6 space-x-2 sm:space-x-4">
        {!isConnected ? (
          <button
            onClick={connectToRealtime}
            className="px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition font-medium"
          >
            🎤 OpenAI 음성 인터뷰 시작
          </button>
        ) : (
          <>
            <button
              onClick={disconnect}
              className="px-4 py-2 sm:px-6 sm:py-3 bg-red-600 text-white text-sm sm:text-base rounded-lg hover:bg-red-700 transition font-medium"
            >
              🛑 인터뷰 종료
            </button>
            {isAISpeaking && (
              <button
                onClick={interruptAI}
                className="px-4 py-2 sm:px-6 sm:py-3 bg-yellow-600 text-white text-sm sm:text-base rounded-lg hover:bg-yellow-700 transition font-medium"
              >
                ⏸️ AI 중단
              </button>
            )}
          </>
        )}
      </div>

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
            <p>OpenAI Realtime 인터뷰가 곧 시작됩니다...</p>
            <p className="text-sm mt-2">마이크 권한을 허용하고 AI의 질문을 기다려주세요.</p>
          </div>
        )}
      </div>

      {/* 사용 팁 */}
      {isConnected && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          <h4 className="font-medium text-gray-800 mb-2">💡 사용 팁:</h4>
          <ul className="space-y-1 text-xs">
            <li>• OpenAI Realtime API로 실시간 음성 대화가 가능합니다</li>
            <li>• 음성 감지가 자동으로 이루어집니다 (VAD)</li>
            <li>• AI가 말하는 중에도 자연스럽게 대화할 수 있습니다</li>
            <li>• 답변이 길어도 괜찮습니다 - 편안하게 이야기해주세요</li>
            <li>• WebRTC 기술로 낮은 지연시간을 제공합니다</li>
          </ul>
        </div>
      )}
    </div>
  )
}