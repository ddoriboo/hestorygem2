import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 6자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용중인 아이디입니다.' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)
    
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword
      }
    })

    // 12개 세션 자동 생성
    const sessionTitles = [
      '프롤로그 - 나의 뿌리와 세상의 시작',
      '제1장 - 기억의 첫 페이지, 유년 시절',
      '제2장 - 꿈과 방황의 시간, 학창 시절',
      '제3장 - 세상으로 나아가다, 군대와 첫 직장',
      '제4장 - 운명의 만남, 사랑과 결혼',
      '제5장 - 아버지가 되다, 가족의 탄생',
      '제6장 - 인생의 절정, 일과 성취',
      '제7장 - 폭풍우를 견디다, 시련과 극복',
      '제8장 - 지혜의 계절, 나이 들어감의 의미',
      '제9장 - 못다 이룬 꿈, 후회와 화해',
      '제10장 - 사랑하는 이들에게 남기는 말',
      '에필로그 - 내 삶이라는 책을 덮으며'
    ]

    await prisma.session.createMany({
      data: sessionTitles.map((title, index) => ({
        sessionNumber: index + 1,
        title,
        userId: user.id
      }))
    })

    return NextResponse.json(
      { message: '회원가입이 완료되었습니다.' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}