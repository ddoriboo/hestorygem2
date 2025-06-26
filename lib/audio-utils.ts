// 오디오 포맷 변환 유틸리티

/**
 * Float32Array를 Int16Array로 변환 (웹 오디오 API -> PCM)
 */
export function float32ToInt16(buffer: Float32Array): Int16Array {
  const l = buffer.length
  const result = new Int16Array(l)
  
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]))
    result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  
  return result
}

/**
 * Int16Array를 Float32Array로 변환 (PCM -> 웹 오디오 API)
 */
export function int16ToFloat32(buffer: Int16Array): Float32Array {
  const l = buffer.length
  const result = new Float32Array(l)
  
  for (let i = 0; i < l; i++) {
    result[i] = buffer[i] / (buffer[i] < 0 ? 0x8000 : 0x7FFF)
  }
  
  return result
}

/**
 * 샘플링 레이트 변환 (선형 보간)
 * @param buffer 원본 오디오 버퍼
 * @param fromRate 원본 샘플링 레이트
 * @param toRate 대상 샘플링 레이트
 */
export function resampleBuffer(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) {
    return buffer
  }
  
  const ratio = fromRate / toRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const srcIndexInt = Math.floor(srcIndex)
    const srcIndexFrac = srcIndex - srcIndexInt
    
    if (srcIndexInt + 1 < buffer.length) {
      // 선형 보간
      result[i] = buffer[srcIndexInt] * (1 - srcIndexFrac) + buffer[srcIndexInt + 1] * srcIndexFrac
    } else {
      result[i] = buffer[srcIndexInt]
    }
  }
  
  return result
}

/**
 * PCM 16kHz를 24kHz로 변환 (Gemini 응답용)
 */
export function resample16to24(pcm16k: Int16Array): Int16Array {
  const float32 = int16ToFloat32(pcm16k)
  const resampled = resampleBuffer(float32, 16000, 24000)
  return float32ToInt16(resampled)
}

/**
 * PCM 24kHz를 16kHz로 변환 (마이크 입력용)
 */
export function resample24to16(pcm24k: Int16Array): Int16Array {
  const float32 = int16ToFloat32(pcm24k)
  const resampled = resampleBuffer(float32, 24000, 16000)
  return float32ToInt16(resampled)
}

/**
 * 청크 단위로 오디오 버퍼 분할
 */
export function chunkAudioBuffer(buffer: Int16Array, chunkSize: number): Int16Array[] {
  const chunks: Int16Array[] = []
  
  for (let i = 0; i < buffer.length; i += chunkSize) {
    chunks.push(buffer.slice(i, i + chunkSize))
  }
  
  return chunks
}

/**
 * Base64 인코딩된 오디오를 Int16Array로 변환
 */
export function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  
  // Uint8Array를 Int16Array로 변환 (Little Endian 가정)
  const int16 = new Int16Array(bytes.buffer)
  return int16
}

/**
 * Int16Array를 Base64로 인코딩
 */
export function int16ArrayToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer)
  let binary = ''
  
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  
  return btoa(binary)
}