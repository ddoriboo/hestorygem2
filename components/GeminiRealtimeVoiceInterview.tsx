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
  const [audioLevel, setAudioLevel] = useState(0)
  const [voiceDetected, setVoiceDetected] = useState(false)
  const [processorActive, setProcessorActive] = useState(false)

  // Refs
  const sessionRef = useRef<any>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const geminiClientRef = useRef<any>(null)
  const responseQueueRef = useRef<any[]>([])
  const messageHandlersRef = useRef<((data: any) => void)[]>([])

  useEffect(() => {
    // 클라이언트 사이드에서만 초기화
    if (typeof window !== 'undefined') {
      initializeGeminiLive()
      // 마이크 설정을 독립적으로 초기화
      initializeAudioCapture()
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

  const initializeAudioCapture = async () => {
    try {
      console.log('🎯 독립적 마이크 초기화 시작...')
      setConnectionStatus('마이크 시스템 초기화 중...')
      
      // 브라우저 지원 확인
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 마이크를 지원하지 않습니다.')
      }
      
      console.log('✅ 브라우저 마이크 지원 확인됨')
      
      // HTTPS 확인 (보안 컨텍스트)
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn('⚠️ HTTPS가 아닌 환경에서는 마이크 접근이 제한될 수 있습니다.')
      }
      
      console.log('🌐 현재 URL:', location.href)
      console.log('🔒 보안 컨텍스트:', window.isSecureContext)
      
      setConnectionStatus('마이크 초기화 완료')
      console.log('✅ 마이크 시스템 초기화 완료!')
      
    } catch (error) {
      console.error('❌ 마이크 초기화 실패:', error)
      setConnectionStatus(`마이크 초기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
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
            // 실시간 스트리밍용 즉시 처리
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

      // 마이크 설정은 독립적으로 이미 초기화되었으므로 제거
      console.log('🎤 Gemini 연결 완료, 마이크는 독립적으로 관리됨')

    } catch (error) {
      console.error('Gemini 연결 오류:', error)
      setConnectionStatus(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [sessionNumber])

  const setupAudioCapture = async () => {
    try {
      console.log('🎙️ =================================')
      console.log('🎙️ 오디오 캡처 설정 시작!')
      console.log('🎙️ =================================')
      
      // 이미 설정되어 있다면 정리 후 재설정
      if (audioStreamRef.current || audioContextRef.current || analyserRef.current || processorRef.current) {
        console.log('🔄 기존 오디오 설정 정리 중...')
        
        // ScriptProcessorNode 정리
        if (processorRef.current) {
          processorRef.current.disconnect()
          processorRef.current = null
        }
        
        // AnalyserNode 정리
        if (analyserRef.current) {
          if ((analyserRef.current as any).intervalId) {
            clearInterval((analyserRef.current as any).intervalId)
          }
          analyserRef.current.disconnect()
          analyserRef.current = null
        }
        
        // AudioStream 정리
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop())
          audioStreamRef.current = null
        }
        
        // AudioContext 정리
        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        
        setProcessorActive(false)
        setAudioLevel(0)
        setVoiceDetected(false)
      }
      
      console.log('1️⃣ 마이크 권한 요청 중...')
      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      
      console.log('✅ 마이크 권한 허용됨!')
      console.log('2️⃣ 스트림 정보 분석 중...')
      console.log('활성 트랙 수:', stream.getAudioTracks().length)
      
      stream.getAudioTracks().forEach((track, index) => {
        console.log(`트랙 ${index + 1}:`, {
          라벨: track.label,
          활성화: track.enabled,
          준비상태: track.readyState,
          설정: track.getSettings()
        })
      })
      
      audioStreamRef.current = stream

      console.log('3️⃣ AudioContext 생성 중...')
      // AudioContext 설정 (브라우저 호환성)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContextClass({
        sampleRate: 16000
      })
      
      console.log('AudioContext 생성됨, 상태:', audioContext.state)
      console.log('샘플레이트:', audioContext.sampleRate)
      
      // AudioContext가 suspended 상태면 resume
      if (audioContext.state === 'suspended') {
        console.log('4️⃣ AudioContext 활성화 중...')
        await audioContext.resume()
        console.log('AudioContext 활성화됨, 현재 상태:', audioContext.state)
      }
      
      audioContextRef.current = audioContext

      console.log('5️⃣ 오디오 노드 생성 중...')
      const source = audioContext.createMediaStreamSource(stream)
      console.log('MediaStreamSource 생성됨')
      
      // AnalyserNode 사용 (UI 레벨 표시용)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.3
      analyserRef.current = analyser
      console.log('AnalyserNode 생성됨 (fftSize: 2048) - UI 레벨 표시용')

      console.log('6️⃣ 실제 PCM 오디오 캡처용 ScriptProcessorNode 설정 중...')
      
      // ScriptProcessorNode로 RAW PCM 데이터 캡처 (Gemini 요구사항)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      console.log('✅ ScriptProcessorNode 생성됨 (RAW PCM 캡처용)')

      let audioSendCount = 0
      let processorCallCount = 0
      
      processor.onaudioprocess = (event) => {
        processorCallCount++
        
        // 처음 몇 번은 로그 출력
        if (processorCallCount <= 5) {
          console.log(`📊 PCM 프로세서 호출 #${processorCallCount}`)
        }
        
        const inputBuffer = event.inputBuffer.getChannelData(0)
        
        // 실시간으로 Gemini에 PCM 데이터 전송
        if (isRecording && sessionRef.current) {
          // RMS 레벨 계산 (음성 감지용)
          let sum = 0
          for (let i = 0; i < inputBuffer.length; i++) {
            sum += inputBuffer[i] * inputBuffer[i]
          }
          const rmsLevel = Math.sqrt(sum / inputBuffer.length)
          
          // 일정 레벨 이상일 때만 전송 (노이즈 필터링)
          if (rmsLevel > 0.01) {
            audioSendCount++
            console.log(`🎤 PCM 데이터 전송 #${audioSendCount}, RMS: ${rmsLevel.toFixed(4)}`)
            
            // Float32를 Int16 PCM으로 변환
            const pcmData = float32ToInt16(inputBuffer)
            
            // Gemini Live API에 RAW PCM 데이터 전송
            sendPCMToGemini(pcmData)
          }
        }
      }
      
      console.log('7️⃣ UI용 오디오 분석 타이머 설정 중...')
      
      // setInterval을 사용하여 주기적으로 오디오 레벨 확인 (UI용)
      const audioAnalysisInterval = setInterval(() => {
        if (!analyser || !audioStreamRef.current) {
          console.log('⚠️ 분석 중단: analyser 또는 stream이 없음')
          return
        }
        
        processorCallCount++
        
        // 프로세서가 활성화되었음을 UI에 표시
        if (processorCallCount === 1) {
          setProcessorActive(true)
          console.log('🔄 오디오 분석기 시작됨!')
        }
        
        // 처음 몇 번은 로그 출력
        if (processorCallCount <= 5) {
          console.log(`📊 오디오 분석 #${processorCallCount}`)
        }
        
        // 주파수 도메인 데이터 가져오기
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        analyser.getByteFrequencyData(dataArray)
        
        // 평균 레벨 계산
        const sum = dataArray.reduce((a, b) => a + b)
        const average = sum / bufferLength
        const max = Math.max(...dataArray)
        
        // 0-255 범위를 0-1 범위로 정규화
        const currentAudioLevel = average / 255
        
        // 처음 몇 번은 무조건 로그 출력 (디버깅용)
        if (processorCallCount <= 10) {
          console.log(`📈 오디오 레벨 #${processorCallCount}: 평균=${average.toFixed(2)}, 최대=${max}, 정규화=${currentAudioLevel.toFixed(6)}`)
        }
        
        // UI 업데이트 (실시간 오디오 레벨 표시)
        setAudioLevel(currentAudioLevel)
        
        // 음성 감지 상태 업데이트 (UI용)
        if (currentAudioLevel > 0.02) {
          setVoiceDetected(true)
          // 음성 감지 상태를 잠시 유지
          setTimeout(() => setVoiceDetected(false), 500)
        }
        
      }, 50) // 50ms마다 분석 (20fps)
      
      // interval ID를 저장하여 나중에 정리할 수 있도록
      ;(analyser as any).intervalId = audioAnalysisInterval

      console.log('8️⃣ 오디오 노드 연결 중...')
      source.connect(analyser) // UI용 레벨 표시
      source.connect(processor) // PCM 데이터 캡처
      // destination에는 연결하지 않음 (피드백 방지)
      
      // 프로세서가 활성화되었음을 표시
      setProcessorActive(true)
      
      console.log('✅ 오디오 노드 연결 완료!')
      console.log('✅ 마이크 설정 완료!')
      console.log('🎙️ =================================')

    } catch (error) {
      console.log('❌ =================================')
      console.error('❌ 오디오 설정 오류:', error)
      console.error('에러 이름:', error.name)
      console.error('에러 메시지:', error.message)
      console.log('❌ =================================')
      
      setConnectionStatus('마이크 접근 실패: ' + error.message)
      
      // 구체적인 오류 메시지 표시
      if (error.name === 'NotAllowedError') {
        setConnectionStatus('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.')
      } else if (error.name === 'NotFoundError') {
        setConnectionStatus('마이크 장치를 찾을 수 없습니다.')
      }
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

  // RAW PCM 데이터를 Gemini Live API에 전송 (올바른 형식)
  const sendPCMToGemini = async (pcmData: Int16Array) => {
    try {
      // Int16Array를 Uint8Array로 변환 (바이트 단위)
      const bytes = new Uint8Array(pcmData.buffer)
      
      // Base64 인코딩 (청크 단위로 처리하여 브라우저 호환성 개선)
      let base64Audio = ''
      const chunkSize = 1024
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize)
        base64Audio += btoa(String.fromCharCode.apply(null, Array.from(chunk)))
      }
      
      console.log(`📤 RAW PCM 데이터 Gemini 전송: ${pcmData.length} samples, ${bytes.length} bytes`)
      
      if (sessionRef.current) {
        await sessionRef.current.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: "audio/pcm;rate=16000" // 올바른 PCM 형식!
          }
        })
        console.log(`✅ PCM 데이터 전송 성공!`)
      } else {
        console.log(`❌ Gemini 세션이 없어서 PCM 전송 실패`)
      }
      
    } catch (error) {
      console.error('❌ PCM 데이터 전송 실패:', error)
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

  const startRecording = async () => {
    if (!isConnected) {
      console.log('연결되지 않음, 녹음 시작 불가')
      return
    }
    
    console.log('🔴 녹음 시작 버튼 클릭됨')
    
    try {
      // 오디오 캡처 설정 (매번 새로 설정)
      console.log('🎙️ 녹음 시작 전 오디오 캡처 설정...')
      await setupAudioCapture()
      
      // AudioContext가 suspended 상태면 사용자 제스처로 활성화
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log('⏯️ 사용자 제스처로 AudioContext 활성화 중...')
        try {
          await audioContextRef.current.resume()
          console.log('✅ AudioContext 활성화됨:', audioContextRef.current.state)
        } catch (error) {
          console.error('❌ AudioContext 활성화 실패:', error)
        }
      }
      
      // ScriptProcessorNode는 자동으로 시작됨 (별도 시작 명령 불필요)
      console.log('🎬 PCM 데이터 캡처 시작됨 (자동)')
      
      setIsRecording(true)
      setConnectionStatus('🎤 실시간 음성 녹음 중... Gemini가 듣고 있습니다!')
      console.log('🎙️ 녹음 상태 활성화 완료')
      
    } catch (error) {
      console.error('❌ 녹음 시작 실패:', error)
      setConnectionStatus('녹음 시작 실패: ' + error.message)
    }
  }

  const stopRecording = () => {
    console.log('⏹️ 녹음 중단 요청됨')
    
    // ScriptProcessorNode는 녹음 상태 플래그만 변경하면 됨
    setIsRecording(false)
    setConnectionStatus('음성 인터뷰 준비 완료')
    console.log('🔇 녹음 상태 비활성화 완료 (PCM 캡처는 계속 활성)')
  }

  const testMicrophone = async () => {
    // 가장 기본적인 로그부터 시작
    console.log('🚀 =================================')
    console.log('🚀 마이크 테스트 함수 호출됨!')
    console.log('🚀 =================================')
    
    try {
      // 단계별 상세 디버깅
      console.log('1️⃣ 브라우저 API 지원 확인 중...')
      if (!navigator.mediaDevices) {
        throw new Error('navigator.mediaDevices 지원되지 않음')
      }
      if (!navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia 지원되지 않음')
      }
      console.log('✅ 브라우저 API 지원 확인됨')
      
      console.log('2️⃣ 보안 컨텍스트 확인 중...')
      console.log('현재 URL:', window.location.href)
      console.log('프로토콜:', window.location.protocol)
      console.log('보안 컨텍스트:', window.isSecureContext)
      
      console.log('3️⃣ 마이크 권한 요청 중... (팝업이 나타날 수 있습니다)')
      // 가장 기본적인 설정으로 먼저 시도
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      })
      
      console.log('✅ 마이크 권한 허용됨!')
      console.log('4️⃣ 스트림 정보 분석 중...')
      console.log('총 오디오 트랙 수:', stream.getAudioTracks().length)
      
      stream.getAudioTracks().forEach((track, index) => {
        console.log(`트랙 ${index + 1}:`, {
          라벨: track.label,
          활성화: track.enabled,
          준비상태: track.readyState,
          종류: track.kind,
          설정: track.getSettings()
        })
      })
      
      console.log('5️⃣ AudioContext 생성 중...')
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('AudioContext가 지원되지 않습니다')
      }
      
      const testContext = new AudioContextClass()
      console.log('AudioContext 생성됨, 초기 상태:', testContext.state)
      console.log('샘플레이트:', testContext.sampleRate)
      
      if (testContext.state === 'suspended') {
        console.log('6️⃣ AudioContext 활성화 중...')
        await testContext.resume()
        console.log('AudioContext 활성화됨, 현재 상태:', testContext.state)
      }
      
      console.log('7️⃣ 오디오 노드 생성 중...')
      const source = testContext.createMediaStreamSource(stream)
      console.log('MediaStreamSource 생성됨')
      
      const analyser = testContext.createAnalyser()
      analyser.fftSize = 256
      console.log('AnalyserNode 생성됨')
      
      source.connect(analyser)
      console.log('노드 연결 완료')
      
      console.log('8️⃣ 10초간 마이크 레벨 측정 시작...')
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      let measurementCount = 0
      const maxMeasurements = 50 // 10초간 (200ms 간격)
      
      const measureInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / bufferLength
        const max = Math.max(...dataArray)
        
        measurementCount++
        console.log(`📊 측정 #${measurementCount}/50: 평균=${average.toFixed(2)}, 최대=${max}`)
        
        if (measurementCount >= maxMeasurements) {
          console.log('9️⃣ 테스트 정리 중...')
          clearInterval(measureInterval)
          source.disconnect()
          stream.getTracks().forEach(track => {
            console.log(`트랙 ${track.label} 정지 중...`)
            track.stop()
          })
          testContext.close()
          console.log('✅ 마이크 테스트 완료!')
          console.log('🚀 =================================')
        }
      }, 200)
      
    } catch (error) {
      console.log('❌ =================================')
      console.error('❌ 마이크 테스트 실패:', error)
      console.error('에러 이름:', error.name)
      console.error('에러 메시지:', error.message)
      console.error('전체 에러 객체:', error)
      console.log('❌ =================================')
      
      // 특정 에러에 대한 추가 정보
      if (error.name === 'NotAllowedError') {
        console.error('🚫 마이크 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.')
      } else if (error.name === 'NotFoundError') {
        console.error('🎤 마이크 장치를 찾을 수 없습니다.')
      } else if (error.name === 'NotSupportedError') {
        console.error('🌐 현재 브라우저에서 지원되지 않는 기능입니다.')
      }
    }
  }

  const sendTestMessage = async () => {
    if (!sessionRef.current) {
      console.log('세션이 없어서 테스트 메시지 전송 불가')
      return
    }

    try {
      console.log('테스트 메시지 전송 중...')
      setIsAISpeaking(true)
      
      // 배치 모드용 별도 큐 초기화
      const batchQueue: any[] = []
      let isWaiting = true
      
      // 임시 메시지 핸들러
      const originalOnMessage = sessionRef.current.onmessage
      sessionRef.current.onmessage = (message: any) => {
        console.log('배치 모드 메시지:', message)
        batchQueue.push(message)
        
        if (message.serverContent && message.serverContent.turnComplete) {
          isWaiting = false
        }
      }
      
      // 텍스트 메시지 전송
      await sessionRef.current.sendClientContent({
        turns: [{ role: "user", parts: [{ text: "안녕하세요! 간단한 인사말을 해주세요." }] }],
        turnComplete: true
      })
      console.log('테스트 메시지 전송 완료, 응답 대기 중...')

      // 응답 대기
      while (isWaiting) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // 원래 핸들러 복구
      sessionRef.current.onmessage = originalOnMessage
      
      console.log('배치 응답 수신 완료, 총 메시지:', batchQueue.length)

      // 응답 처리
      let combinedAudio: number[] = []
      for (const message of batchQueue) {
        if (message.data) {
          console.log('오디오 데이터 수신, 크기:', message.data.length)
          const binaryString = atob(message.data)
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
      } else {
        console.log('오디오 데이터 없음, 텍스트만 응답됨')
        setIsAISpeaking(false)
      }

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


    // AnalyserNode 해제 (interval 정리)
    if (analyserRef.current) {
      try {
        // interval 정리
        if ((analyserRef.current as any).intervalId) {
          clearInterval((analyserRef.current as any).intervalId)
        }
        analyserRef.current.disconnect()
      } catch (error) {
        console.error('AnalyserNode 해제 오류:', error)
      }
      analyserRef.current = null
    }

    // 기존 Processor 해제 (호환성용)
    if (processorRef.current) {
      try {
        processorRef.current.disconnect()
      } catch (error) {
        console.error('Processor 해제 오류:', error)
      }
      processorRef.current = null
    }

    setIsConnected(false)
    setIsRecording(false)
    setIsAISpeaking(false)
    setProcessorActive(false)
    setAudioLevel(0)
    setVoiceDetected(false)
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

      {/* 연결 상태 및 음성 활동 표시 */}
      <div className="flex flex-col items-center justify-center mb-4 sm:mb-6">
        <div className="flex items-center mb-3">
          <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? '연결됨' : '연결 안됨'}
          </span>
        </div>
        
        {/* 음성 활동 표시 */}
        {(isRecording || processorActive) && (
          <div className="flex flex-col items-center space-y-2">
            {/* 프로세서 상태 표시 */}
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              processorActive 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {processorActive ? '🔄 오디오 프로세서 활성' : '❌ 오디오 프로세서 비활성'}
            </div>
            
            {processorActive && (
              <>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500">마이크 레벨:</span>
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-100 ${
                        voiceDetected ? 'bg-green-500' : 'bg-blue-400'
                      }`}
                      style={{ width: `${Math.min(100, audioLevel * 1000)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {(audioLevel * 100).toFixed(1)}%
                  </span>
                </div>
                
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  voiceDetected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {isRecording 
                    ? (voiceDetected ? '🎤 음성 감지됨 (Gemini로 전송 중)' : '🔇 대기 중')
                    : '⏸️ 녹음 중지 상태'
                  }
                </div>
              </>
            )}
          </div>
        )}
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
            {/* 마이크 테스트 버튼 */}
            <button
              onClick={testMicrophone}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              🔍 마이크 테스트 (F12 콘솔 필수 확인!)
            </button>
            
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
        <p className="mb-2">💡 문제 해결 가이드:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>• <strong>1단계</strong>: "Gemini Live 연결" → 초록불 확인</li>
          <li>• <strong>2단계</strong>: "마이크 테스트" → 콘솔에서 마이크 레벨 숫자 확인</li>
          <li>• <strong>3단계</strong>: "텍스트 메시지 테스트" → AI 음성 나오는지 확인</li>
          <li>• <strong>4단계</strong>: "음성 녹음 시작" → "오디오 프로세서 활성" 파란색 표시 확인</li>
          <li>• <strong>5단계</strong>: 말하기 → 마이크 레벨 바 움직이고 "음성 감지됨" 초록색 표시 확인</li>
          <li>• 마이크 권한 허용 필요 / 콘솔 로그에서 "📈 오디오 레벨" 및 "🎤 음성 감지됨" 확인</li>
          <li>• 프로세서가 비활성이면 AudioContext 문제 / 문제 시: 페이지 새로고침 후 다시 시도</li>
        </ul>
      </div>
    </div>
  )
}