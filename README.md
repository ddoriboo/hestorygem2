# He'story 서비스 종합 문서

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [비즈니스 로직 및 서비스 플로우](#비즈니스-로직-및-서비스-플로우)
3. [기술 스택 및 아키텍처](#기술-스택-및-아키텍처)
4. [데이터베이스 구조 및 메타데이터](#데이터베이스-구조-및-메타데이터)
5. [API 구조 및 엔드포인트](#api-구조-및-엔드포인트)
6. [컴포넌트 구조 및 UI 시스템](#컴포넌트-구조-및-ui-시스템)
7. [인터뷰 시스템 메커니즘](#인터뷰-시스템-메커니즘)
8. [사용자 여정 및 플로우](#사용자-여정-및-플로우)
9. [인증 및 보안](#인증-및-보안)
10. [배포 및 환경 설정](#배포-및-환경-설정)
11. [개발 가이드라인](#개발-가이드라인)
12. [트러블슈팅 및 유지보수](#트러블슈팅-및-유지보수)

---

## 프로젝트 개요

### 서비스 정의
**He'story**는 시니어(아버지 세대)를 위한 AI 기반 자서전 작성 서비스입니다. AI 인터뷰어와의 편안한 대화를 통해 삶의 이야기를 수집하고, 이를 바탕으로 개인의 자서전을 자동 생성합니다.

### 핵심 가치 제안
- **시니어 친화적 UI**: 큰 글씨, 높은 대비, 직관적인 인터페이스
- **체계적인 인생 회고**: 12개의 구조화된 세션으로 인생 전체를 아우름
- **다양한 인터뷰 방식**: 텍스트, 음성, 실시간 음성 인터뷰 지원
- **AI 기반 자서전 생성**: 수집된 대화를 바탕으로 완성된 자서전 초고 제공

### 타겟 사용자
- **주 타겟**: 50-70대 시니어 (아버지 세대)
- **서브 타겟**: 가족들과 추억을 공유하고 싶은 모든 연령층

---

## 비즈니스 로직 및 서비스 플로우

### 서비스 메커니즘

#### 1. 사용자 온보딩
```
회원가입 → 로그인 → 12개 세션 자동 생성 → 첫 번째 세션 시작
```

#### 2. 인터뷰 진행 프로세스
```
세션 선택 → 인터뷰 방식 선택 → AI와 대화 → 자동 저장 → 다음 세션
```

#### 3. 자서전 생성 플로우
```
충분한 대화 데이터 수집 → 자서전 생성 요청 → AI 기반 생성 → 결과물 제공
```

### 12개 세션 구조
각 세션은 인생의 특정 시기나 주제에 초점을 맞춤:

1. **프롤로그** - 나의 뿌리와 세상의 시작
2. **제1장** - 기억의 첫 페이지, 유년 시절
3. **제2장** - 꿈과 방황의 시간, 학창 시절
4. **제3장** - 세상으로 나아가다, 군대와 첫 직장
5. **제4장** - 운명의 만남, 사랑과 결혼
6. **제5장** - 아버지가 되다, 가족의 탄생
7. **제6장** - 인생의 절정, 일과 성취
8. **제7장** - 폭풍우를 견디다, 시련과 극복
9. **제8장** - 지혜의 계절, 나이 들어감의 의미
10. **제9장** - 못다 이룬 꿈, 후회와 화해
11. **제10장** - 사랑하는 이들에게 남기는 말
12. **에필로그** - 내 삶이라는 책을 덮으며

---

## 기술 스택 및 아키텍처

### 기술 스택
```
Frontend: Next.js 15 + React 19 + TypeScript + Tailwind CSS 4
Backend: Next.js API Routes (Node.js runtime)
Database: PostgreSQL (Railway 호스팅)
ORM: Prisma
Authentication: JWT + bcryptjs
AI Service: OpenAI GPT API (gpt-4o-mini, gpt-4o-realtime-preview)
Deployment: Railway
Development: Turbopack
```

### 아키텍처 패턴
- **Monorepo**: 프론트엔드와 백엔드가 하나의 Next.js 프로젝트
- **API-First**: RESTful API 설계
- **Component-Based**: React 컴포넌트 기반 UI
- **Server-Side Authentication**: JWT 토큰을 HTTP-only 쿠키로 관리

### 프로젝트 구조
```
hestory/
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   │   ├── auth/          # 인증 관련 API
│   │   ├── conversations/ # 대화 CRUD API
│   │   ├── sessions/      # 세션 관리 API
│   │   ├── interview/     # 인터뷰 관련 API
│   │   └── autobiography/ # 자서전 생성 API
│   ├── login/             # 로그인 페이지
│   ├── register/          # 회원가입 페이지
│   ├── interview/[id]/    # 동적 인터뷰 페이지
│   ├── my-story/          # 내 이야기 보기 페이지
│   ├── autobiography/     # 자서전 페이지
│   ├── page.tsx           # 메인 대시보드
│   ├── layout.tsx         # 루트 레이아웃
│   └── globals.css        # 전역 스타일
├── components/            # React 컴포넌트
│   ├── TextInterview.tsx       # 텍스트 인터뷰
│   ├── VoiceInterview.tsx      # Web Speech API 음성 인터뷰
│   ├── OpenAIRealtimeVoiceInterview.tsx # OpenAI Realtime 음성 인터뷰
│   └── RealtimeVoiceInterview.tsx       # 실시간 음성 인터뷰
├── lib/                   # 유틸리티 함수
│   ├── auth.ts           # JWT 인증 유틸리티
│   ├── prisma.ts         # Prisma 클라이언트
│   └── session-prompts.ts # 세션별 AI 프롬프트
├── prisma/               # 데이터베이스 스키마
│   └── schema.prisma     # 데이터 모델 정의
├── middleware.ts         # Next.js 미들웨어 (라우트 보호)
├── package.json          # 프로젝트 의존성
├── next.config.js        # Next.js 설정
├── tailwind.config.ts    # Tailwind CSS 설정
└── tsconfig.json         # TypeScript 설정
```

---

## 데이터베이스 구조 및 메타데이터

### ERD (Entity Relationship Diagram)
```
User (1) ----< Session (Many)
User (1) ----< Conversation (Many)
Session (1) ----< Conversation (Many)
User (1) ---- Autobiography (1)
```

### 테이블 구조

#### User 테이블
```sql
CREATE TABLE User (
  id        TEXT PRIMARY KEY,           -- cuid() 생성
  username  TEXT UNIQUE NOT NULL,      -- 사용자 아이디
  password  TEXT NOT NULL,             -- bcrypt 해시된 비밀번호
  createdAt TIMESTAMP DEFAULT NOW(),   -- 계정 생성일
  updatedAt TIMESTAMP DEFAULT NOW()    -- 최종 수정일
);
```

**메타데이터:**
- `id`: Prisma의 cuid() 함수로 생성되는 고유 식별자
- `username`: 로그인시 사용하는 아이디 (한글, 영문, 숫자 모두 허용)
- `password`: bcryptjs로 솔트 라운드 10회 해싱된 비밀번호

#### Session 테이블
```sql
CREATE TABLE Session (
  id            TEXT PRIMARY KEY,       -- cuid() 생성
  sessionNumber INTEGER NOT NULL,       -- 1-12 세션 번호
  title         TEXT NOT NULL,          -- 세션 제목
  description   TEXT,                   -- 세션 설명 (현재 미사용)
  isCompleted   BOOLEAN DEFAULT FALSE,  -- 세션 완료 여부
  userId        TEXT NOT NULL,          -- User 외래키
  createdAt     TIMESTAMP DEFAULT NOW(),
  updatedAt     TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (userId) REFERENCES User(id),
  UNIQUE(userId, sessionNumber)         -- 사용자당 세션번호는 유일
);
```

**메타데이터:**
- `sessionNumber`: 1-12 고정값, 인생 시기별 순서
- `title`: `lib/session-prompts.ts`에서 정의된 세션 제목과 동일
- `isCompleted`: 현재 자동 설정되지 않음 (향후 구현 예정)
- 사용자 가입시 12개 세션이 자동 생성됨

#### Conversation 테이블
```sql
CREATE TABLE Conversation (
  id        TEXT PRIMARY KEY,           -- cuid() 생성
  sessionId TEXT NOT NULL,              -- Session 외래키
  userId    TEXT NOT NULL,              -- User 외래키
  question  TEXT NOT NULL,              -- AI의 질문
  answer    TEXT,                       -- 사용자의 답변 (null 가능)
  order     INTEGER NOT NULL,           -- 세션 내 대화 순서
  createdAt TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (sessionId) REFERENCES Session(id),
  FOREIGN KEY (userId) REFERENCES User(id),
  INDEX(sessionId, order)               -- 성능 최적화
);
```

**메타데이터:**
- `question`: AI가 생성한 질문 (한국어, 존댓말 형식)
- `answer`: 사용자 답변 (텍스트/음성 전사 결과)
- `order`: 세션 내에서의 대화 순서 (1부터 시작)
- 질문만 저장하고 답변은 나중에 업데이트하는 경우도 있음

#### Autobiography 테이블
```sql
CREATE TABLE Autobiography (
  id        TEXT PRIMARY KEY,           -- cuid() 생성
  userId    TEXT UNIQUE NOT NULL,       -- User 외래키 (1:1 관계)
  content   TEXT NOT NULL,              -- 생성된 자서전 전체 내용
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (userId) REFERENCES User(id)
);
```

**메타데이터:**
- `content`: OpenAI GPT로 생성된 완성된 자서전 텍스트
- 사용자당 하나의 자서전만 유지 (재생성시 덮어쓰기)
- 평균 길이: 3000-8000자 (GPT 토큰 제한에 따라)

---

## API 구조 및 엔드포인트

### 인증 API (`/api/auth/`)

#### POST `/api/auth/register`
**기능**: 새 사용자 회원가입
```typescript
// Request Body
{
  username: string,    // 3-20자 사용자명
  password: string     // 6자 이상 비밀번호
}

// Response (Success: 201)
{
  message: "회원가입이 완료되었습니다.",
  user: { id: string, username: string }
}

// Response (Error: 400/409)
{
  error: "이미 존재하는 사용자명입니다." | "비밀번호는 6자 이상이어야 합니다."
}
```

#### POST `/api/auth/login`
**기능**: 사용자 로그인 및 JWT 토큰 발급
```typescript
// Request Body
{
  username: string,
  password: string
}

// Response (Success: 200)
{
  message: "로그인 성공",
  user: { id: string, username: string }
}
// + HTTP-only 쿠키에 JWT 토큰 설정

// Response (Error: 401)
{
  error: "아이디 또는 비밀번호가 올바르지 않습니다."
}
```

#### POST `/api/auth/logout`
**기능**: 로그아웃 및 토큰 제거
```typescript
// Response (200)
{
  message: "로그아웃되었습니다."
}
// + 쿠키에서 JWT 토큰 제거
```

### 세션 관리 API (`/api/sessions/`)

#### GET `/api/sessions/`
**기능**: 사용자의 모든 세션 조회 (12개 자동 생성)
```typescript
// Response (200)
{
  sessions: Array<{
    id: string,
    sessionNumber: number,      // 1-12
    title: string,              // "제1장 - 기억의 첫 페이지, 유년 시절"
    isCompleted: boolean,
    conversationCount: number,  // 해당 세션의 대화 수
    createdAt: string,
    updatedAt: string
  }>
}
```

#### DELETE `/api/sessions/`
**기능**: 특정 세션 삭제 (관련 대화도 함께 삭제)
```typescript
// Request Body
{
  sessionId: string
}

// Response (200)
{
  message: "세션이 삭제되었습니다."
}
```

#### POST `/api/sessions/reset`
**기능**: 세션 초기화 (대화 내용만 삭제)
```typescript
// Request Body
{
  sessionId: string
}

// Response (200)
{
  message: "세션이 초기화되었습니다."
}
```

### 대화 관리 API (`/api/conversations/`)

#### GET `/api/conversations/`
**기능**: 특정 세션의 모든 대화 조회
```typescript
// Query Parameters
// ?sessionId=string

// Response (200)
{
  conversations: Array<{
    id: string,
    question: string,      // AI 질문
    answer: string,        // 사용자 답변
    order: number,         // 대화 순서
    createdAt: string
  }>
}
```

#### POST `/api/conversations/`
**기능**: 새 대화 저장
```typescript
// Request Body
{
  sessionId: string,
  question: string,      // AI가 생성한 질문
  answer?: string        // 사용자 답변 (선택적)
}

// Response (201)
{
  conversation: {
    id: string,
    sessionId: string,
    question: string,
    answer: string,
    order: number,
    createdAt: string
  }
}
```

#### GET `/api/conversations/all`
**기능**: 사용자의 모든 세션과 대화 데이터 조회
```typescript
// Response (200)
{
  sessions: Array<{
    id: string,
    sessionNumber: number,
    title: string,
    isCompleted: boolean,
    conversations: Array<Conversation>,
    summary: {
      conversationCount: number,
      firstQuestion?: string,
      lastAnswer?: string
    }
  }>
}
```

### 인터뷰 API (`/api/interview/`)

#### POST `/api/interview/chat`
**기능**: 텍스트 기반 AI 인터뷰 진행
```typescript
// Request Body
{
  sessionNumber: number,           // 1-12
  userMessage?: string,           // 사용자 메시지
  conversationHistory?: Array<{   // 기존 대화 기록
    role: 'user' | 'assistant',
    content: string
  }>
}

// Response (200)
{
  message: string,        // AI 생성 응답
  sessionNumber: number,
  success: true
}
```

#### POST `/api/interview/realtime-token`
**기능**: OpenAI Realtime API 토큰 및 설정 제공
```typescript
// Request Body
{
  sessionNumber: number
}

// Response (200)
{
  apiKey: string,           // OpenAI API 키 (클라이언트 직접 연결용)
  sessionPrompt: string,    // 세션별 시스템 프롬프트
  model: string,           // 'gpt-4o-realtime-preview-2024-10-01'
  voice: string            // 'sage'
}
```

### 자서전 생성 API (`/api/autobiography/`)

#### POST `/api/autobiography`
**기능**: 모든 대화 데이터를 기반으로 자서전 생성
```typescript
// Request Body (없음)

// Response (200)
{
  message: "자서전이 성공적으로 생성되었습니다.",
  autobiography: string    // 생성된 자서전 전체 텍스트
}

// 처리 과정:
// 1. 사용자의 모든 대화 데이터 수집
// 2. 세션별로 정리된 프롬프트 생성
// 3. OpenAI GPT로 자서전 생성 (4000-8000자)
// 4. 데이터베이스에 저장
```

#### GET `/api/autobiography`
**기능**: 저장된 자서전 조회
```typescript
// Response (200)
{
  autobiography: {
    id: string,
    content: string,       // 자서전 전체 내용
    createdAt: string,
    updatedAt: string
  }
}

// Response (404)
{
  error: "자서전을 찾을 수 없습니다."
}
```

---

## 컴포넌트 구조 및 UI 시스템

### 페이지 컴포넌트

#### 메인 대시보드 (`app/page.tsx`)
**기능**: 12개 세션 목록 표시 및 관리
- 세션 카드 그리드 레이아웃
- 각 세션의 진행 상태 표시 (대화 수)
- 세션 삭제/초기화 기능
- "내 이야기 보기" 버튼
- 시니어 친화적 대형 UI

**주요 상태:**
```typescript
const [user, setUser] = useState<User | null>(null)
const [sessions, setSessions] = useState<Session[]>([])
const [loading, setLoading] = useState(true)
```

#### 인터뷰 페이지 (`app/interview/[id]/page.tsx`)
**기능**: 동적 라우팅으로 특정 세션의 인터뷰 진행
- 3가지 인터뷰 모드 제공
- 세션별 맞춤형 AI 프롬프트 적용
- 실시간 대화 저장

**Props:**
```typescript
interface PageProps {
  params: { id: string }  // 세션 번호 (1-12)
}
```

#### 내 이야기 페이지 (`app/my-story/page.tsx`)
**기능**: 모든 대화 내용 정리 및 통계 제공
- 세션별 대화 내용 아코디언 형태로 표시
- 전체 통계 (완료 세션 수, 총 대화 수)
- 자서전 생성 버튼
- 세션별 요약 정보

#### 자서전 페이지 (`app/autobiography/page.tsx`)
**기능**: 생성된 자서전 열람 및 다운로드
- 자서전 전체 텍스트 표시
- 복사, 다운로드, 인쇄 기능
- 인쇄 최적화 스타일링

### 인터뷰 컴포넌트

#### 텍스트 인터뷰 (`components/TextInterview.tsx`)
**기능**: 채팅 형태의 텍스트 인터뷰
```typescript
interface TextInterviewProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}
```

**주요 기능:**
- 실시간 메시지 송수신
- 대화 기록 표시
- 자동 스크롤
- 로딩 상태 관리

#### 음성 인터뷰 (`components/VoiceInterview.tsx`)
**기능**: Web Speech API 기반 음성 인터뷰
```typescript
interface VoiceInterviewProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}
```

**주요 기능:**
- 브라우저 내장 음성 인식/합성
- 음성 명령 처리
- 실시간 전사 표시
- 음성 피드백

#### OpenAI Realtime 음성 인터뷰 (`components/OpenAIRealtimeVoiceInterview.tsx`)
**기능**: OpenAI Realtime API를 활용한 고급 음성 인터뷰
```typescript
interface OpenAIRealtimeVoiceInterviewProps {
  sessionNumber: number
  onConversationSave: (question: string, answer: string) => Promise<void>
}
```

**주요 기능:**
- WebRTC 기반 실시간 음성 통신
- 자연스러운 대화 흐름
- 음성 감지 및 턴 제어
- 고품질 음성 합성

### UI 디자인 시스템

#### 색상 팔레트
```css
/* 시니어 친화적 고대비 색상 */
Primary: Blue-600 (#2563eb)
Secondary: Green-600 (#16a34a)
Accent: Purple-600 (#9333ea)
Background: Gray-50 (#f9fafb)
Text: Gray-900 (#111827)
Border: Gray-300 (#d1d5db)
```

#### 타이포그래피
```css
/* 가독성을 위한 큰 폰트 사이즈 */
Heading 1: 3xl (30px) font-bold
Heading 2: 2xl (24px) font-semibold
Heading 3: xl (20px) font-semibold
Body Large: lg (18px)
Body Regular: base (16px)
Small: sm (14px)
```

#### 컴포넌트 패턴
- **카드 레이아웃**: 그림자와 라운드 모서리로 구분
- **버튼**: 최소 44px 높이 (터치 친화적)
- **여백**: 4px 단위 시스템 (Tailwind 기본)
- **반응형**: 모바일 우선 설계

---

## 인터뷰 시스템 메커니즘

### AI 프롬프트 시스템 (`lib/session-prompts.ts`)

#### 시스템 프롬프트 구조
```typescript
const systemPrompt = `
당신은 '기억의 안내자'입니다. 
아버님과의 편안한 대화를 통해 소중한 인생 이야기를 수집하고 정리하는 역할을 합니다.

### 1. 역할과 목표 (Role and Objective)
- 따뜻하고 존경스러운 태도로 대화
- 한국어 존댓말 사용 ("하십시오" 체)
- 깊이 있는 질문으로 구체적인 기억 유도
- 감정적 지지와 공감 제공

### 2. 대화 스타일 (Conversation Style)
- 자연스럽고 편안한 분위기 조성
- 충분한 시간을 두고 인내심 있게 대화
- 개인적이고 구체적인 세부사항에 관심
- 판단하지 않는 중립적 태도

### 3. 질문 기법 (Questioning Techniques)
- 개방형 질문 우선 사용
- "어떻게", "왜", "무엇을" 등을 활용
- 구체적인 장면이나 감정에 대한 질문
- 꼬리 질문으로 더 깊은 이야기 유도

### 4. 인터뷰 진행 절차
1. 세션 소개 및 시작
2. 주요 질문 제시
3. 경청 및 꼬리 질문
4. 다음 질문으로 자연스러운 전환
5. 세션 마무리 및 다음 예고
`
```

#### 세션별 질문 구조
각 세션은 5-7개의 주요 질문으로 구성:

```typescript
const sessionPrompts = {
  1: {
    title: "프롤로그 - 나의 뿌리와 세상의 시작",
    questions: [
      "아버님이 태어나신 곳은 어디인지, 그 시절의 모습을 기억하고 계신가요?",
      "부모님은 어떤 분들이셨는지 말씀해 주시겠어요?",
      "어린 시절 살던 집과 동네의 모습은 어땠나요?",
      "가족 중에서 특별히 기억에 남는 분이 계신가요?",
      "아버님 성함의 유래나 가족의 역사에 대해 들어보신 이야기가 있나요?"
    ]
  },
  // ... 2-12번 세션
}
```

### 인터뷰 플로우 제어

#### 1. 텍스트 인터뷰 플로우
```typescript
// 1. 사용자 메시지 수신
// 2. 대화 히스토리 구성
// 3. OpenAI API 호출
// 4. AI 응답 생성
// 5. 대화 저장
// 6. UI 업데이트
```

#### 2. 음성 인터뷰 플로우
```typescript
// 1. 마이크 권한 요청
// 2. 음성 녹음 시작
// 3. 음성-텍스트 변환
// 4. 텍스트 인터뷰와 동일한 처리
// 5. 텍스트-음성 변환
// 6. 오디오 재생
```

#### 3. Realtime 음성 인터뷰 플로우
```typescript
// 1. WebRTC 연결 설정
// 2. 데이터 채널 생성
// 3. 세션 설정 메시지 전송
// 4. 실시간 오디오 스트리밍
// 5. 턴 감지 및 응답 생성
// 6. 음성 출력 및 전사
```

### 대화 저장 메커니즘

#### 저장 시점
1. **AI 질문 생성 즉시**: question 필드에 저장
2. **사용자 응답 완료시**: answer 필드 업데이트
3. **세션 종료시**: 모든 대화 완료 상태 확인

#### 저장 포맷
```typescript
interface SavedConversation {
  sessionId: string,      // 어느 세션의 대화인지
  question: string,       // AI가 생성한 질문
  answer: string,         // 사용자 답변 (음성→텍스트 변환 포함)
  order: number,          // 세션 내 순서
  timestamp: Date         // 대화 시점
}
```

---

## 사용자 여정 및 플로우

### 신규 사용자 여정

#### 1단계: 온보딩
```
랜딩 → 회원가입 → 로그인 → 대시보드 (12개 세션 자동 생성)
```

**소요 시간**: 2-3분
**주요 액션**: 
- 간단한 아이디/비밀번호 입력
- 서비스 소개 확인

#### 2단계: 첫 인터뷰
```
세션 1 선택 → 인터뷰 방식 선택 → AI와 첫 대화 → 자동 저장
```

**소요 시간**: 15-30분
**주요 액션**:
- 3가지 인터뷰 방식 중 선택
- AI 인터뷰어와 편안한 대화
- 유년시절 이야기 공유

#### 3단계: 지속적 참여
```
정기적 세션 참여 → 대화 누적 → 진행상황 확인 → 다음 세션 진행
```

**소요 기간**: 2-4주 (사용자 속도에 따라)
**주요 액션**:
- 주 2-3회 인터뷰 참여
- 각 세션 20-40분 소요
- "내 이야기 보기"에서 진행상황 확인

#### 4단계: 자서전 완성
```
충분한 대화 완료 → 자서전 생성 → 결과물 확인 → 공유/저장
```

**소요 시간**: 자서전 생성 2-3분, 검토 10-15분
**주요 액션**:
- 자서전 생성 버튼 클릭
- AI가 생성한 자서전 검토
- 복사/다운로드/인쇄

### 재방문 사용자 여정

#### 기존 세션 이어하기
```
로그인 → 대시보드 → 진행중인 세션 선택 → 대화 이어가기
```

#### 세션 재시작
```
로그인 → 대시보드 → 세션 초기화 → 새로운 대화 시작
```

#### 자서전 업데이트
```
로그인 → 추가 대화 진행 → 자서전 재생성 → 업데이트된 결과 확인
```

### 플로우 최적화 포인트

#### 사용성 개선사항
1. **자동 저장**: 모든 대화가 실시간으로 저장되어 데이터 손실 방지
2. **세션 순서 자유도**: 원하는 세션부터 시작 가능
3. **진행상황 시각화**: 각 세션의 대화 수를 카드에 표시
4. **오류 복구**: 네트워크 오류시 재시도 메커니즘

#### 성능 최적화
1. **지연 로딩**: 대화 내용은 필요할 때만 로드
2. **캐싱**: 세션 목록과 기본 정보 캐싱
3. **압축**: 긴 대화 내용 압축 저장
4. **CDN**: 정적 자원 최적화

---

## 인증 및 보안

### JWT 토큰 시스템

#### 토큰 구조
```typescript
interface JWTPayload {
  userId: string,      // 사용자 고유 ID
  username: string,    // 사용자명
  iat: number,        // 발급 시간
  exp: number         // 만료 시간 (7일)
}
```

#### 토큰 저장 방식
```typescript
// HTTP-only 쿠키 설정
const cookieOptions = {
  httpOnly: true,        // XSS 공격 방지
  secure: true,          // HTTPS에서만 전송
  sameSite: 'strict',    // CSRF 공격 방지
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7일
}
```

### 비밀번호 보안

#### 해싱 설정
```typescript
import bcrypt from 'bcryptjs'

// 회원가입시 해싱
const saltRounds = 10
const hashedPassword = await bcrypt.hash(password, saltRounds)

// 로그인시 검증
const isValid = await bcrypt.compare(password, hashedPassword)
```

### 라우트 보호

#### 미들웨어 기반 인증 (`middleware.ts`)
```typescript
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  
  // 보호된 경로
  const protectedPaths = ['/interview', '/my-story', '/autobiography']
  
  if (protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    if (!token || !verifyToken(token)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  return NextResponse.next()
}
```

#### API 라우트 인증
```typescript
// 모든 API 라우트에서 토큰 검증
const token = request.cookies.get('auth-token')?.value
if (!token) {
  return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
}

const decoded = verifyToken(token)
if (!decoded) {
  return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
}
```

### 데이터 보안

#### 사용자 데이터 격리
- 모든 DB 쿼리에서 userId 필터링
- 다른 사용자의 데이터 접근 차단
- 세션과 대화 데이터 소유권 검증

#### 민감 정보 보호
```typescript
// 환경 변수로 관리되는 민감 정보
process.env.JWT_SECRET        // JWT 서명 키
process.env.OPENAI_API_KEY   // OpenAI API 키
process.env.DATABASE_URL     // 데이터베이스 연결 정보
```

### CORS 및 CSP 설정

#### Content Security Policy
```typescript
// next.config.js에서 설정
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  }
]
```

---

## 배포 및 환경 설정

### Railway 배포 구성

#### 필수 환경 변수
```bash
# 데이터베이스
DATABASE_URL="postgresql://user:password@host:port/database"

# OpenAI API
OPENAI_API_KEY="sk-proj-..."

# JWT 인증
JWT_SECRET="32자리-랜덤-문자열"
NEXTAUTH_SECRET="32자리-랜덤-문자열"
NEXTAUTH_URL="https://your-app.railway.app"

# 실행 환경
NODE_ENV="production"
```

#### 배포 스크립트 (`package.json`)
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "prisma generate && next build",
    "start": "prisma migrate deploy && next start",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:deploy": "prisma migrate deploy",
    "lint": "next lint"
  }
}
```

#### 배포 프로세스
```bash
# 1. 빌드 단계 (Railway에서 자동 실행)
npm run build
# - Prisma 클라이언트 생성
# - Next.js 프로덕션 빌드

# 2. 런타임 단계 (컨테이너 시작시)
npm run start
# - 데이터베이스 마이그레이션 실행
# - Next.js 서버 시작
```

### 현재 개발 상태 및 Git 관리

#### 주요 개발 스크립트 (`package.json`)
```json
{
  "scripts": {
    "dev": "next dev --turbopack",              // Turbopack 사용 개발 서버
    "build": "prisma generate && next build",   // 프로덕션 빌드 (Prisma 생성 포함)
    "start": "npm run db:migrate && next start", // 프로덕션 시작 (마이그레이션 + 서버)
    "lint": "next lint",                        // ESLint 실행
    "db:generate": "prisma generate",           // Prisma 클라이언트 생성
    "db:push": "prisma db push",               // 개발환경 스키마 푸시
    "db:deploy": "prisma migrate deploy",      // 프로덕션 마이그레이션
    "db:migrate": "prisma migrate deploy",     // 마이그레이션 별칭
    "postinstall": "prisma generate"           // 설치 후 자동 실행
  }
}
```

#### 주요 의존성
```json
{
  "dependencies": {
    "@prisma/client": "^6.10.1",      // Prisma ORM 클라이언트
    "@types/bcryptjs": "^2.4.6",      // bcrypt 타입 정의
    "@types/jsonwebtoken": "^9.0.10", // JWT 타입 정의
    "@types/ws": "^8.18.1",           // WebSocket 타입 정의
    "bcryptjs": "^3.0.2",             // 비밀번호 해싱
    "jsonwebtoken": "^9.0.2",         // JWT 토큰 관리
    "next": "15.3.4",                 // Next.js 프레임워크
    "next-auth": "^4.24.11",          // 인증 라이브러리 (현재 미사용)
    "openai": "^5.7.0",               // OpenAI API 클라이언트
    "prisma": "^6.10.1",              // Prisma ORM
    "react": "^19.0.0",               // React 19
    "react-dom": "^19.0.0",           // React DOM
    "ws": "^8.18.2"                   // WebSocket 지원
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",     // Tailwind CSS 4
    "tailwindcss": "^4",              // 최신 Tailwind CSS
    "typescript": "^5",               // TypeScript 5
    "eslint": "^9",                   // ESLint 9
    "eslint-config-next": "15.3.4"   // Next.js ESLint 설정
  }
}
```

#### Git 관리 전략 (`.gitignore`)
```bash
# 의존성
/node_modules
/.pnp
.pnp.*

# Next.js 빌드 결과물
/.next/
/out/
/build

# 환경 변수 (보안)
.env*

# 기타
.DS_Store
*.pem
*.tsbuildinfo
next-env.d.ts
```

### 환경별 설정

#### 개발 환경 (로컬)
```bash
# .env.local
DATABASE_URL="postgresql://localhost:5432/hestory_dev"
OPENAI_API_KEY="sk-..."
JWT_SECRET="dev-secret-key"
NEXTAUTH_SECRET="dev-auth-secret"
NEXTAUTH_URL="http://localhost:3000"
```

#### 프로덕션 환경 (Railway)
```bash
# Railway 환경 변수 설정
DATABASE_URL="postgresql://..."  # Railway PostgreSQL URL
OPENAI_API_KEY="sk-proj-..."     # 실제 API 키
JWT_SECRET="강력한-랜덤-키"        # openssl rand -base64 32
NEXTAUTH_SECRET="강력한-인증-키"   # openssl rand -base64 32
NEXTAUTH_URL="https://..."       # Railway 앱 URL
NODE_ENV="production"
```

#### Next.js 설정 (`next.config.ts`)
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,    // 빌드 시 ESLint 오류 무시
  },
  typescript: {
    ignoreBuildErrors: true,     // 빌드 시 TypeScript 오류 무시
  }
};

export default nextConfig;
```

#### 미들웨어 설정 (`middleware.ts`)
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/register')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')

  // API 라우트는 각자 인증 처리
  if (isApiRoute) {
    return NextResponse.next()
  }

  // 토큰 없이 보호된 페이지 접근시 로그인으로 리다이렉트
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // 토큰 있을 때 인증 페이지 접근시 홈으로 리다이렉트
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### 데이터베이스 관리

#### 마이그레이션 전략
```bash
# 개발: 스키마 변경사항 푸시
npm run db:push

# 프로덕션: 마이그레이션 파일 생성 및 배포
npx prisma migrate dev --name "description"
npm run db:deploy
```

#### 백업 및 복구
```bash
# Railway CLI를 통한 데이터베이스 백업
railway connect postgresql
pg_dump $DATABASE_URL > backup.sql

# 복구
psql $DATABASE_URL < backup.sql
```

### 모니터링 및 로깅

#### 에러 추적
```typescript
// API 라우트에서 에러 로깅
try {
  // 로직 실행
} catch (error) {
  console.error('API Error:', {
    endpoint: request.url,
    method: request.method,
    error: error.message,
    stack: error.stack,
    userId: decoded?.userId
  })
}
```

#### 성능 모니터링
- Railway 대시보드에서 CPU/메모리 사용량 확인
- 응답 시간 측정
- 데이터베이스 쿼리 성능 추적

---

## 개발 가이드라인

### 코드 구조 원칙

#### 파일 명명 규칙
```
- React 컴포넌트: PascalCase (UserProfile.tsx)
- API 라우트: kebab-case (user-profile/route.ts)
- 유틸리티 함수: camelCase (getUserData.ts)
- 페이지 파일: 소문자 (page.tsx, layout.tsx)
```

#### 타입스크립트 활용
```typescript
// 인터페이스 정의
interface User {
  id: string
  username: string
  createdAt: Date
}

// API 응답 타입
interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

// 컴포넌트 Props 타입
interface ComponentProps {
  required: string
  optional?: number
  callback: (value: string) => void
}
```

### 컴포넌트 개발 패턴

#### 커스텀 훅 사용
```typescript
// 공통 로직을 커스텀 훅으로 분리
function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchUser()
  }, [])
  
  return { user, loading, logout }
}
```

#### 에러 바운더리
```typescript
// 에러 처리를 위한 패턴
function ComponentWithErrorHandling() {
  const [error, setError] = useState<string | null>(null)
  
  if (error) {
    return <ErrorMessage message={error} onRetry={() => setError(null)} />
  }
  
  return <MainContent />
}
```

### API 개발 패턴

#### 표준 응답 형식
```typescript
// 성공 응답
return NextResponse.json({
  data: result,
  message: "성공 메시지",
  success: true
}, { status: 200 })

// 에러 응답
return NextResponse.json({
  error: "에러 메시지",
  success: false
}, { status: 400 })
```

#### 에러 처리 미들웨어
```typescript
function withErrorHandling(handler: Function) {
  return async (request: NextRequest) => {
    try {
      return await handler(request)
    } catch (error) {
      console.error('API Error:', error)
      return NextResponse.json(
        { error: '서버 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  }
}
```

### 테스트 가이드라인

#### 단위 테스트
```typescript
// utils 함수 테스트
describe('Auth Utils', () => {
  test('JWT 토큰 생성 및 검증', () => {
    const payload = { userId: '123', username: 'test' }
    const token = generateToken(payload)
    const decoded = verifyToken(token)
    
    expect(decoded).toEqual(payload)
  })
})
```

#### 통합 테스트
```typescript
// API 라우트 테스트
describe('/api/auth/login', () => {
  test('올바른 credentials로 로그인 성공', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'test', password: 'password' })
    })
    
    expect(response.status).toBe(200)
    expect(await response.json()).toHaveProperty('user')
  })
})
```

### 성능 최적화

#### 이미지 최적화
```typescript
// Next.js Image 컴포넌트 사용
import Image from 'next/image'

<Image
  src="/profile.jpg"
  alt="프로필"
  width={100}
  height={100}
  priority={true}
/>
```

#### 번들 최적화
```typescript
// 동적 임포트로 코드 분할
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Loading />,
  ssr: false
})
```

---

## 트러블슈팅 및 유지보수

### 일반적인 문제 해결

#### 1. 데이터베이스 연결 오류
```bash
# 증상: "Can't connect to database" 에러
# 원인: DATABASE_URL 환경변수 누락 또는 잘못된 설정
# 해결: Railway 대시보드에서 PostgreSQL 연결 정보 확인

# 확인 방법
echo $DATABASE_URL
npx prisma db push  # 연결 테스트
```

#### 2. JWT 토큰 만료
```typescript
// 증상: 로그인 후 바로 로그아웃됨
// 원인: JWT_SECRET 불일치 또는 토큰 만료
// 해결: 토큰 재발급 또는 SECRET 확인

// 디버깅 코드
console.log('Token:', token)
console.log('Decoded:', verifyToken(token))
```

#### 3. OpenAI API 오류
```typescript
// 증상: AI 응답 생성 실패
// 원인: API 키 오류, 할당량 초과, 모델 파라미터 오류

// 에러 로깅 강화
try {
  const response = await openai.chat.completions.create(params)
} catch (error) {
  console.error('OpenAI Error:', {
    type: error.type,
    code: error.code,
    message: error.message,
    status: error.status
  })
}
```

#### 4. 음성 인터뷰 연결 실패
```typescript
// 증상: 음성 인터뷰 시작 불가
// 원인: 마이크 권한, 브라우저 호환성, WebRTC 설정

// 디버깅 체크리스트
- 브라우저 마이크 권한 확인
- HTTPS 환경에서 실행 확인
- 브라우저 콘솔에서 에러 메시지 확인
- 네트워크 방화벽 설정 확인
```

### 모니터링 및 알림

#### 핵심 지표 추적
```typescript
// 사용자 활동 로그
const userActivityLog = {
  userId: string,
  action: 'login' | 'interview_start' | 'conversation_save' | 'autobiography_generate',
  sessionNumber?: number,
  timestamp: Date,
  duration?: number
}

// 시스템 성능 지표
const performanceMetrics = {
  apiResponseTime: number,     // API 응답 시간
  dbQueryTime: number,         // DB 쿼리 시간
  openaiResponseTime: number,  // OpenAI API 응답 시간
  memoryUsage: number,         // 메모리 사용량
  activeUsers: number          // 동시 접속자 수
}
```

#### 오류 알림 시스템
```typescript
// 치명적 오류 감지 및 알림
function logCriticalError(error: Error, context: any) {
  const errorLog = {
    level: 'CRITICAL',
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date(),
    environment: process.env.NODE_ENV
  }
  
  // 로그 저장
  console.error('Critical Error:', errorLog)
  
  // 필요시 외부 모니터링 서비스 연동
  // sendToMonitoringService(errorLog)
}
```

### 백업 및 재해 복구

#### 정기 백업 전략
```bash
# 일일 데이터베이스 백업 (cron job)
0 2 * * * pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# 주간 전체 백업
0 3 * * 0 pg_dump $DATABASE_URL --clean --if-exists > weekly_backup.sql
```

#### 재해 복구 절차
1. **데이터베이스 복구**: 최신 백업에서 데이터 복원
2. **환경 변수 재설정**: 모든 환경 변수 확인 및 설정
3. **의존성 재설치**: `npm install` 실행
4. **마이그레이션 실행**: `npm run db:deploy`
5. **서비스 재시작**: Railway에서 재배포

### 성능 최적화 체크리스트

#### 프론트엔드 최적화
- [ ] 이미지 최적화 (WebP, 적절한 크기)
- [ ] 코드 스플리팅 적용
- [ ] 불필요한 리렌더링 방지
- [ ] 메모이제이션 활용
- [ ] 번들 크기 최적화

#### 백엔드 최적화
- [ ] 데이터베이스 인덱스 최적화
- [ ] API 응답 캐싱
- [ ] 불필요한 데이터 조회 방지
- [ ] 연결 풀링 설정
- [ ] 비동기 처리 최적화

#### 데이터베이스 최적화
```sql
-- 성능 개선을 위한 인덱스
CREATE INDEX idx_conversation_session_order ON Conversation(sessionId, order);
CREATE INDEX idx_session_user_number ON Session(userId, sessionNumber);
CREATE INDEX idx_conversation_user_created ON Conversation(userId, createdAt);
```

### 업데이트 및 마이그레이션

#### 의존성 업데이트
```bash
# 정기적인 의존성 업데이트
npm update
npm audit fix

# 주요 라이브러리 업데이트시 테스트 필수
- Next.js 버전 업데이트
- React 버전 업데이트
- Prisma 스키마 변경
- OpenAI API 버전 변경
```

#### 스키마 마이그레이션
```bash
# 스키마 변경시 마이그레이션 생성
npx prisma migrate dev --name "add_user_preferences"

# 프로덕션 배포
npm run db:deploy
```

### 보안 업데이트

#### 정기 보안 점검
- [ ] 의존성 취약점 스캔 (`npm audit`)
- [ ] 환경 변수 보안 검토
- [ ] API 엔드포인트 접근 권한 확인
- [ ] SSL 인증서 갱신 상태 확인
- [ ] 사용자 데이터 암호화 상태 점검

---

## 부록: 개발자 참고사항

### Claude Code 작업시 주의사항

#### 프로젝트 맥락 파악
1. **서비스 특성**: 시니어 대상 서비스임을 고려한 UI/UX
2. **기술 스택**: Next.js 15, React 19, Prisma, PostgreSQL
3. **AI 통합**: OpenAI GPT 및 Realtime API 활용
4. **배포 환경**: Railway 클라우드 플랫폼

#### 코드 수정시 고려사항
1. **호환성**: 기존 데이터베이스 스키마와 호환성 유지
2. **인증**: 모든 보호된 기능에 JWT 인증 필수
3. **에러 처리**: 사용자 친화적 에러 메시지 제공
4. **성능**: 시니어 사용자를 고려한 로딩 시간 최적화

#### 테스트 권장사항
1. **크로스 브라우저**: 다양한 브라우저에서 테스트
2. **모바일 친화성**: 터치 인터페이스 및 반응형 확인
3. **음성 기능**: 다양한 디바이스에서 마이크/스피커 테스트
4. **접근성**: 스크린 리더 및 키보드 네비게이션 지원

### 추가 개발 아이디어

#### 향후 기능 확장
1. **가족 공유**: 완성된 자서전을 가족들과 공유하는 기능
2. **사진 통합**: 인터뷰 중 관련 사진 업로드 및 첨부
3. **음성 보존**: 인터뷰 음성을 원본 그대로 보존하는 옵션
4. **다국어 지원**: 영어, 중국어 등 다른 언어 인터뷰 지원
5. **AI 개선**: 더 자연스러운 대화를 위한 프롬프트 최적화

#### 성능 향상 방안
1. **CDN 활용**: 정적 자원 전역 배포
2. **캐싱 전략**: Redis를 활용한 세션 및 대화 캐싱
3. **비동기 처리**: 자서전 생성을 백그라운드 작업으로 처리
4. **스트리밍**: 긴 자서전 생성시 실시간 스트리밍 표시

---

## 📚 지속적인 문서 관리 및 추적

### Commit 히스토리 추적

#### 현재까지의 주요 개발 마일스톤
```bash
# 프로젝트 초기 구조
- Next.js 15 + React 19 + TypeScript 기반 프로젝트 구조 설정
- Prisma + PostgreSQL 데이터베이스 스키마 설계
- JWT 기반 인증 시스템 구축

# 핵심 기능 개발
- 12개 세션 자동 생성 시스템 구현
- 텍스트 인터뷰 기능 (TextInterview.tsx)
- Web Speech API 기반 음성 인터뷰 (VoiceInterview.tsx)
- OpenAI Realtime API 연동 음성 인터뷰 (OpenAIRealtimeVoiceInterview.tsx)
- 실시간 음성 인터뷰 (RealtimeVoiceInterview.tsx)

# AI 통합 및 자서전 생성
- OpenAI GPT API 연동 (gpt-4o-mini, gpt-4o-realtime-preview)
- 세션별 맞춤형 프롬프트 시스템 (lib/session-prompts.ts)
- 자서전 자동 생성 기능
- 대화 내용 기반 자서전 초고 생성

# UI/UX 및 사용성 개선
- 시니어 친화적 UI 디자인 (큰 글씨, 높은 대비)
- 반응형 디자인 및 모바일 최적화
- 내 이야기 보기 페이지 (통계 및 대화 내용 정리)
- 자서전 다운로드/인쇄 기능

# 배포 및 운영
- Railway 클라우드 배포 설정
- 환경 변수 관리 및 보안 강화
- 데이터베이스 마이그레이션 자동화
- 에러 처리 및 로깅 개선
```

#### Git Commit 컨벤션 권장사항
```bash
# 기능 추가
feat: 새로운 음성 인터뷰 기능 추가
feat(auth): JWT 토큰 갱신 로직 구현

# 버그 수정
fix: 자서전 생성 시 한글 인코딩 오류 수정
fix(ui): 모바일에서 버튼 터치 영역 확대

# 문서 업데이트
docs: README.md 배포 가이드 추가
docs(api): API 엔드포인트 문서화

# 스타일/UI 변경
style: 시니어 친화적 색상 대비 개선
ui: 대화 목록 레이아웃 개선

# 리팩토링
refactor: 인터뷰 컴포넌트 공통 로직 분리
refactor(db): 데이터베이스 쿼리 최적화

# 성능 개선
perf: 대화 로딩 속도 개선
perf(api): API 응답 시간 최적화

# 설정 변경
config: Railway 배포 설정 업데이트
config(env): 환경 변수 구조 개선
```

### 문서 업데이트 추적

#### 이 문서의 업데이트 기록
```markdown
# 문서 버전 히스토리

## v1.0.0 (현재) - 종합 문서 초판
- 프로젝트 전체 구조 및 아키텍처 문서화
- 데이터베이스 스키마 및 메타데이터 정리
- API 엔드포인트 상세 문서화
- 인터뷰 시스템 메커니즘 설명
- 배포 및 환경 설정 가이드
- 개발 가이드라인 및 트러블슈팅

## 향후 업데이트 예정 사항
- [ ] 실제 사용자 피드백 반영
- [ ] 성능 최적화 결과 문서화
- [ ] 새로운 기능 추가시 문서 보완
- [ ] API 변경사항 추적
- [ ] 보안 업데이트 내역 기록
```

#### 문서 관리 프로세스
```bash
# 1. 기능 개발 후 문서 업데이트
개발 완료 → 기능 문서화 → 코드 리뷰 → 문서 리뷰 → 병합

# 2. 주요 변경사항 추적
- API 엔드포인트 변경시 즉시 문서 업데이트
- 데이터베이스 스키마 변경시 ERD 및 메타데이터 갱신
- 새로운 환경 변수 추가시 설정 가이드 업데이트
- 배포 과정 변경시 배포 문서 수정

# 3. 정기적 문서 검토
- 월 1회 전체 문서 accuracy 검토
- 분기별 문서 구조 및 가독성 개선
- 새로운 팀원 온보딩 후 문서 피드백 수집
```

### Claude Code를 위한 컨텍스트 관리

#### 프로젝트 진입시 필수 확인사항
```typescript
// 1. 환경 설정 확인
- DATABASE_URL 연결 가능 여부
- OPENAI_API_KEY 유효성
- JWT_SECRET 설정 상태
- 포트 3000 사용 가능 여부

// 2. 의존성 설치 상태
npm install 완료 여부
Prisma 클라이언트 생성 상태
TypeScript 컴파일 가능 여부

// 3. 데이터베이스 상태
npx prisma db push 실행 가능 여부
기본 12개 세션 데이터 존재 여부
마이그레이션 상태 확인

// 4. 핵심 기능 동작 확인
사용자 회원가입/로그인 테스트
AI 인터뷰 기능 동작 테스트
자서전 생성 기능 테스트
```

#### 개발시 주의사항 체크리스트
```bash
# 데이터 일관성
- [ ] 사용자별 데이터 격리 확인
- [ ] 세션 순서 및 번호 일관성 유지
- [ ] 대화 저장 순서(order) 정확성 검증

# 보안
- [ ] 모든 API 라우트 인증 검증 구현
- [ ] 환경 변수 노출 방지
- [ ] 사용자 입력 데이터 검증 및 sanitization
- [ ] JWT 토큰 만료 처리

# 사용성
- [ ] 시니어 친화적 UI 가이드라인 준수
- [ ] 모바일 터치 인터페이스 최적화
- [ ] 음성 기능의 브라우저 호환성 확인
- [ ] 에러 메시지의 사용자 친화성

# 성능
- [ ] 대화 데이터 로딩 성능 최적화
- [ ] OpenAI API 호출 최적화
- [ ] 데이터베이스 쿼리 성능 검토
- [ ] 이미지 및 정적 자원 최적화
```

### 팀 협업을 위한 가이드

#### 새로운 개발자 온보딩 체크리스트
```bash
# 1단계: 환경 설정 (30분)
- [ ] Git 저장소 클론
- [ ] Node.js 18+ 설치 확인
- [ ] .env.local 파일 생성
- [ ] npm install 실행
- [ ] 로컬 PostgreSQL 설정 (또는 Railway 개발 DB 사용)

# 2단계: 프로젝트 이해 (1시간)
- [ ] 이 종합 문서 전체 읽기
- [ ] 12개 세션 구조 파악
- [ ] 데이터베이스 스키마 이해
- [ ] API 엔드포인트 구조 파악

# 3단계: 로컬 실행 및 테스트 (30분)
- [ ] npm run dev 실행 성공
- [ ] 회원가입/로그인 테스트
- [ ] 첫 번째 세션 인터뷰 체험
- [ ] 자서전 생성 기능 테스트

# 4단계: 코드 구조 파악 (1시간)
- [ ] 주요 컴포넌트 코드 리뷰
- [ ] API 라우트 로직 이해
- [ ] 인증 시스템 동작 파악
- [ ] AI 프롬프트 시스템 이해

총 온보딩 시간: 3시간
```

#### 코드 리뷰 가이드라인
```typescript
// 리뷰 포인트 체크리스트

// 1. 기능 동작 확인
- 새로운 기능이 기존 12개 세션 구조와 호환되는가?
- 사용자 데이터 격리가 올바르게 구현되었는가?
- AI 인터뷰 플로우가 자연스럽게 동작하는가?

// 2. 보안 검토
- API 라우트에 적절한 인증이 구현되었는가?
- 사용자 입력이 적절히 검증되고 있는가?
- 민감한 정보가 클라이언트에 노출되지 않는가?

// 3. 성능 및 최적화
- 불필요한 리렌더링이나 API 호출이 없는가?
- 데이터베이스 쿼리가 효율적인가?
- 번들 크기에 부정적 영향이 없는가?

// 4. 코드 품질
- TypeScript 타입이 적절히 정의되었는가?
- 에러 처리가 포함되어 있는가?
- 코드가 읽기 쉽고 유지보수 가능한가?

// 5. 사용성
- 시니어 사용자 관점에서 직관적인가?
- 모바일 환경에서도 잘 동작하는가?
- 접근성 가이드라인을 준수하는가?
```

이 종합 문서는 He'story 프로젝트의 현재 상태를 완전히 반영하며, 지속적으로 업데이트되어 프로젝트의 모든 변경사항을 추적합니다. Claude Code나 새로운 개발자가 이 문서만으로도 프로젝트의 전체 맥락을 이해하고 즉시 개발에 참여할 수 있도록 설계되었습니다.
