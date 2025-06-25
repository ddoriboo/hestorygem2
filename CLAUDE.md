# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Development Server
```bash
npm run dev  # Start development server with Turbopack
```

### Build and Deployment
```bash
npm run build     # Build for production (includes Prisma generate)
npm run start     # Start production server (includes migration)
```

### Database Operations
```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database (development)
npm run db:deploy    # Deploy migrations (production)
npm run db:migrate   # Alias for db:deploy
```

### Code Quality
```bash
npm run lint  # Run ESLint
```

## Project Architecture

### Core Application Structure
This is a Next.js 15 application using the App Router, designed as an AI-powered biographical interview service for Korean-speaking seniors. The app facilitates 12 structured interview sessions to help users create their autobiography.

### Authentication & Authorization
- JWT-based authentication stored in HTTP-only cookies (`auth-token`)
- Middleware handles route protection (`middleware.ts`)
- JWT functions in `lib/auth.ts` for token generation/verification
- bcryptjs for password hashing

### Database Architecture (Prisma + PostgreSQL)
- **User**: Basic user information with username/password
- **Session**: 12 predefined interview sessions (one-to-many with User)
- **Conversation**: Q&A pairs within sessions (linked to both User and Session)
- **Autobiography**: Generated autobiography content (one-to-one with User)

### Interview System Architecture
The application supports multiple interview modes:

1. **Text Interview** (`TextInterview.tsx`)
2. **Voice Interview** (`VoiceInterview.tsx`) - Web Speech API based
3. **OpenAI Realtime Voice** (`OpenAIRealtimeVoiceInterview.tsx`) - WebRTC + OpenAI Realtime API

### OpenAI Realtime Integration
- WebRTC-based real-time voice communication with OpenAI
- Session token management via `/api/interview/realtime-token`
- Uses `gpt-4o-realtime-preview-2024-10-01` model with 'sol' voice
- Complex WebRTC setup with peer connections and data channels

### Session Management System
Located in `lib/session-prompts.ts`:
- 12 predefined interview sessions covering life stages (childhood to legacy)
- Each session has a title and specific questions
- Detailed system prompt with conversation principles for AI interviewer
- Korean language prompts with formal speech patterns ("하십시오" form)

### API Route Structure
```
/api/
├── auth/           # Authentication endpoints
├── conversations/  # Conversation CRUD operations
├── sessions/       # Session management
├── interview/      # Interview-specific endpoints
│   ├── chat/      # Text-based interview
│   ├── realtime-token/  # OpenAI Realtime session tokens
│   └── websocket/ # WebSocket interview support
└── autobiography/ # Autobiography generation
```

### Environment Variables Required
```
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="sk-..."
JWT_SECRET="32-character-random-string"
NEXTAUTH_SECRET="32-character-random-string"
NEXTAUTH_URL="http://localhost:3000"
```

### Tech Stack Details
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Next.js API Routes with PostgreSQL
- **AI Integration**: OpenAI GPT API + Realtime API
- **Authentication**: JWT with bcryptjs
- **ORM**: Prisma
- **Deployment**: Railway (configured for PostgreSQL + Next.js)

### Development Notes
- Uses Turbopack for faster development builds
- Korean language interface optimized for seniors
- Responsive design with senior-friendly UI (large fonts, high contrast)
- Database migrations run automatically on production start
- Prisma client generation happens during build process

### Key Business Logic
- 12 sequential interview sessions that must be completed in order
- Each session focuses on a specific life stage or theme
- AI interviewer uses respectful Korean language patterns
- Conversations are automatically saved and can be compiled into autobiography
- Supports both synchronous (real-time) and asynchronous interview modes