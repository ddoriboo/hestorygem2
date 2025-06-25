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

      const { sessionToken, sessionId } = await tokenResponse.json()
      console.log('세션 토큰 받음:', sessionId)

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
        audioStreamRef.current = stream
        console.log('마이크 스트림 설정 완료')
      } catch (error) {
        console.error('마이크 액세스 실패:', error)
        setConnectionStatus('마이크 권한이 필요합니다.')
        return
      }

      setConnectionStatus('OpenAI Realtime API 연결 중...')

      // WebRTC 설정
      await setupWebRTC(sessionToken)

    } catch (error) {
      console.error('Realtime 연결 오류:', error)
      setConnectionStatus(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [sessionNumber])

  const setupWebRTC = useCallback(async (sessionToken: string) => {
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
        setConnectionStatus('음성 인터뷰 준비 완료')
        setIsRecording(true)

        // 첫 번째 응답 요청
        setTimeout(() => {
          sendMessage({ type: 'response.create' })
        }, 1000)
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
          'Authorization': `Bearer ${sessionToken}`,
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
          setCurrentTranscript(prev => prev + (data.delta || ''))
          break

        case 'response.audio_transcript.done':
          // AI 응답 완료
          const assistantMessage: Conversation = {
            role: 'assistant',
            content: data.transcript || '',
            timestamp: new Date(),
            audioComplete: true
          }
          setConversations(prev => [...prev, assistantMessage])
          setCurrentTranscript('')
          setIsAISpeaking(false)
          break

        case 'conversation.item.created':
          // 사용자 음성 메시지 생성됨
          if (data.item?.type === 'message' && data.item?.role === 'user') {
            const content = data.item.content
            if (content && content.length > 0) {
              const transcript = content.map((c: any) => c.text || c.transcript || '').filter(Boolean).join(' ')
              if (transcript) {
                const userMessage: Conversation = {
                  role: 'user',
                  content: transcript,
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
              }
            }
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
          
          // 응답에서 메시지 추출
          if (data.response?.output && data.response.output.length > 0) {
            const output = data.response.output[0]
            if (output.type === 'message' && output.role === 'assistant') {
              const content = output.content
              if (content && content.length > 0) {
                const transcript = content.map((c: any) => c.text || c.transcript || '').filter(Boolean).join(' ')
                if (transcript) {
                  const assistantMessage: Conversation = {
                    role: 'assistant',
                    content: transcript,
                    timestamp: new Date(),
                    audioComplete: true
                  }
                  setConversations(prev => [...prev, assistantMessage])
                }
              }
            }
          }
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

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">🎤 OpenAI Realtime 음성 인터뷰</h3>
        <p className="text-gray-600">{connectionStatus}</p>
      </div>

      {/* 연결 버튼 */}
      <div className="flex justify-center mb-6 space-x-4">
        {!isConnected ? (
          <button
            onClick={connectToRealtime}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            🎤 OpenAI 음성 인터뷰 시작
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