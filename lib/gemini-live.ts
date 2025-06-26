// Gemini Live API 클라이언트 (공식 가이드 기반)
export class GeminiLiveClient {
  private ai: any
  private session: any = null
  private isConnected = false
  private responseQueue: any[] = []
  private messageHandlers: ((data: any) => void)[] = []

  constructor(apiKey: string) {
    // 동적 import로 클라이언트 사이드에서만 초기화
    this.initializeAI(apiKey)
  }

  private async initializeAI(apiKey: string) {
    if (typeof window !== 'undefined') {
      const { GoogleGenAI } = await import('@google/genai')
      this.ai = new GoogleGenAI({ apiKey })
    }
  }

  // 메시지 대기 함수 (공식 가이드 패턴)
  private async waitMessage() {
    let done = false
    let message = undefined
    while (!done) {
      message = this.responseQueue.shift()
      if (message) {
        done = true
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
    return message
  }

  // 턴 완료 대기 함수 (공식 가이드 패턴)
  private async handleTurn() {
    const turns = []
    let done = false
    while (!done) {
      const message = await this.waitMessage()
      turns.push(message)
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true
      }
    }
    return turns
  }

  async connect(config: {
    model?: string
    systemPrompt?: string
    responseModalities?: string[]
  }): Promise<void> {
    try {
      const model = config.model || 'gemini-2.5-flash-preview-native-audio-dialog'
      
      console.log('Gemini Live 연결 시도:', model)
      
      // AI 초기화 확인
      if (!this.ai) {
        await this.initializeAI(process.env.GOOGLE_API_KEY || '')
      }

      // Modality 동적 import
      const { Modality } = await import('@google/genai')
      
      // Gemini Live API 연결 (공식 가이드 패턴)
      this.session = await this.ai.live.connect({
        model: model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: config.systemPrompt || '안녕하세요. 자연스러운 대화를 나눠보세요.',
          // 오디오 설정
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live 연결 성공')
            this.isConnected = true
            // 연결 성공 알림
            this.messageHandlers.forEach(handler => handler({ 
              type: 'connected',
              message: 'Gemini Live 연결 완료'
            }))
          },
          onmessage: (message: any) => {
            console.log('Gemini Live 메시지:', message)
            this.responseQueue.push(message)
            
            // 실시간 처리를 위한 즉시 알림
            this.messageHandlers.forEach(handler => handler({
              type: 'message',
              data: message
            }))
          },
          onerror: (error: any) => {
            console.error('Gemini Live 오류:', error)
            this.messageHandlers.forEach(handler => handler({ 
              type: 'error', 
              error 
            }))
          },
          onclose: (reason: any) => {
            console.log('Gemini Live 연결 종료:', reason)
            this.isConnected = false
            this.messageHandlers.forEach(handler => handler({ 
              type: 'closed', 
              reason 
            }))
          }
        }
      })
      
    } catch (error) {
      console.error('Gemini Live 연결 실패:', error)
      throw error
    }
  }

  async sendAudio(audioData: Int16Array) {
    if (!this.isConnected || !this.session) {
      throw new Error('Gemini Live 세션이 연결되지 않음')
    }

    try {
      // Int16Array를 Base64로 변환 (공식 가이드 방식)
      const bytes = new Uint8Array(audioData.buffer)
      const base64Audio = btoa(String.fromCharCode(...bytes))
      
      // Live API 형식에 맞는 오디오 전송
      this.session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: "audio/pcm;rate=16000"
        }
      })
    } catch (error) {
      console.error('오디오 전송 실패:', error)
      throw error
    }
  }

  async sendText(text: string) {
    if (!this.isConnected || !this.session) {
      throw new Error('Gemini Live 세션이 연결되지 않음')
    }

    try {
      // 텍스트를 Live API 형식으로 전송
      this.session.sendClientContent({ 
        turns: [{ "role": "user", "parts": [{ "text": text }] }],
        turnComplete: true
      })
    } catch (error) {
      console.error('텍스트 전송 실패:', error)
      throw error
    }
  }

  onMessage(callback: (response: any) => void) {
    this.messageHandlers.push(callback)
  }

  // 응답 처리 (공식 가이드 패턴)
  async getResponse() {
    try {
      const turns = await this.handleTurn()
      return turns
    } catch (error) {
      console.error('응답 처리 오류:', error)
      return []
    }
  }

  async disconnect() {
    if (this.session) {
      try {
        this.session.close()
        this.session = null
        this.isConnected = false
        this.responseQueue = []
        this.messageHandlers = []
        console.log('Gemini Live 세션 종료')
      } catch (error) {
        console.error('연결 종료 오류:', error)
      }
    }
  }

  get connected() {
    return this.isConnected
  }
}