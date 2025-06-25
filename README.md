# He'story - AI 자서전 서비스

아버님이 AI와 나누는 편안한 대화를 통해 자신의 삶을 회고하고, 그 기록을 바탕으로 한 편의 자서전 초고를 제공하는 웹 서비스입니다.

## 주요 기능

- 🔐 **간단한 사용자 인증** (아이디/비밀번호)
- 📚 **12개의 인터뷰 세션** (인생의 각 단계별 이야기)
- 🤖 **AI 인터뷰 진행** (OpenAI GPT 모델 사용)
- 💾 **대화 내용 자동 저장**
- 📖 **내 이야기 보기** (세션별 대화 내용 정리)
- ✍️ **자서전 초고 생성** (ChatGPT API로 생성)
- 🎨 **시니어 친화적 UI** (큰 글씨, 높은 대비)

## 기술 스택

- **프론트엔드**: Next.js 15, React, TypeScript, Tailwind CSS
- **백엔드**: Next.js API Routes
- **데이터베이스**: PostgreSQL (Railway)
- **인증**: JWT, bcryptjs
- **AI**: OpenAI GPT API
- **배포**: Railway

## 로컬 개발 환경 설정

### 1. 저장소 클론
```bash
git clone <repository-url>
cd hestory
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 내용을 입력:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/hestory"
OPENAI_API_KEY="your-openai-api-key"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="your-jwt-secret"
```

### 4. 데이터베이스 설정
```bash
npx prisma db push
```

### 5. 개발 서버 실행
```bash
npm run dev
```

## Railway 배포 가이드

### 1. Railway 계정 생성
1. [Railway](https://railway.app) 방문
2. GitHub 계정으로 로그인
3. 새 프로젝트 생성

### 2. PostgreSQL 데이터베이스 추가
1. Railway 대시보드에서 "Add Service" 클릭
2. "Database" → "PostgreSQL" 선택
3. 데이터베이스가 생성되면 CONNECTION_URL 복사

### 3. GitHub 저장소 연결
1. Railway 프로젝트에서 "Add Service" 클릭
2. "GitHub Repo" 선택
3. 해당 저장소 선택

### 4. 환경 변수 설정
Railway 대시보드의 Variables 탭에서 다음 환경 변수들을 설정:

```
DATABASE_URL=<PostgreSQL CONNECTION_URL>
OPENAI_API_KEY=<OpenAI API 키>
NEXTAUTH_SECRET=<32자리 랜덤 문자열>
NEXTAUTH_URL=<Railway 앱 URL>
JWT_SECRET=<32자리 랜덤 문자열>
```

### 5. 배포 설정
1. Railway가 자동으로 `package.json`의 build 스크립트를 실행
2. 데이터베이스 마이그레이션이 자동으로 실행됨
3. 배포 완료 후 제공되는 URL로 접속

### 6. 도메인 설정 (선택사항)
1. Railway 대시보드에서 "Settings" → "Domains"
2. Custom Domain 추가 또는 Railway 도메인 사용

## API 키 발급 방법

### OpenAI API 키
1. [OpenAI Platform](https://platform.openai.com) 방문
2. 계정 로그인/생성
3. API Keys 섹션에서 새 키 생성
4. 결제 방법 설정 (사용량에 따라 과금)

### JWT Secret 생성
```bash
openssl rand -base64 32
```

## 프로젝트 구조

```
hestory/
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   ├── login/             # 로그인 페이지
│   ├── register/          # 회원가입 페이지
│   ├── interview/[id]/    # 인터뷰 페이지
│   ├── my-story/          # 내 이야기 페이지
│   └── autobiography/     # 자서전 페이지
├── components/            # React 컴포넌트
├── lib/                   # 유틸리티 함수
├── prisma/               # 데이터베이스 스키마
└── public/               # 정적 파일
```

## 데이터베이스 스키마

- **User**: 사용자 정보
- **Session**: 12개의 인터뷰 세션
- **Conversation**: 대화 내용 (Q&A)
- **Autobiography**: 생성된 자서전

## 보안 고려사항

- 모든 민감한 정보는 환경 변수로 관리
- JWT 토큰을 HTTP-only 쿠키로 저장
- API 라우트에서 사용자 인증 확인
- bcryptjs로 비밀번호 해싱

## 라이선스

MIT License

## 문의

프로젝트 관련 문의사항이 있으시면 이슈를 생성해 주세요.
