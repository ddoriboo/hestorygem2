import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

export function generateToken(userId: string): string {
  const secret = process.env.JWT_SECRET
  console.log('JWT_SECRET 존재 여부:', !!secret)
  
  if (!secret) {
    console.error('JWT_SECRET 환경변수가 설정되지 않음')
    throw new Error('JWT_SECRET이 설정되지 않았습니다.')
  }

  try {
    const token = jwt.sign(
      { userId },
      secret,
      { expiresIn: '7d' }
    )
    console.log('JWT 토큰 생성 성공')
    return token
  } catch (error) {
    console.error('JWT 토큰 생성 실패:', error)
    throw error
  }
}

export function verifyToken(token: string): { userId: string } | null {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('JWT_SECRET 환경변수가 설정되지 않음')
    return null
  }

  try {
    const decoded = jwt.verify(token, secret) as { userId: string }
    console.log('JWT 토큰 검증 성공')
    return decoded
  } catch (error) {
    console.error('JWT 토큰 검증 실패:', error)
    return null
  }
}