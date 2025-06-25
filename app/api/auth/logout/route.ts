import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json(
    { message: '로그아웃 되었습니다.' },
    { status: 200 }
  )

  response.cookies.delete('auth-token')

  return response
}