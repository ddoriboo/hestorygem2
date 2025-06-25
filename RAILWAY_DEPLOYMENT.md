# Railway Deployment Instructions

## Required Environment Variables

Set these environment variables in your Railway project:

### 1. DATABASE_URL
- Add a PostgreSQL database service in Railway
- Copy the connection string from Railway dashboard
- Format: `postgresql://user:password@host:port/database`

### 2. JWT_SECRET
- Generate a secure random string:
  ```bash
  openssl rand -base64 32
  ```
- Or use: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

### 3. OPENAI_API_KEY
- Get your API key from https://platform.openai.com/api-keys
- Format: `sk-proj-...`

### 4. NODE_ENV
- Set to: `production`

## Deployment Steps

1. Connect your GitHub repository to Railway
2. Add PostgreSQL database service
3. Set the environment variables above
4. Deploy automatically from main branch

## Database Setup

Railway deployment process:
1. **Build Phase**: `prisma generate && next build` (no database connection needed)
2. **Runtime Phase**: `prisma migrate deploy && next start` (runs when container starts)

Database migrations run automatically when the app starts, creating:
- User table (for authentication)
- Session table (for interview sessions 1-12) 
- Conversation table (for Q&A pairs)
- Autobiography table (for generated life stories)

This ensures migrations run with live database connection at startup, not during Docker build.

## Build Configuration

The app is configured with:
- Node.js runtime for all API routes (fixes Edge Runtime compatibility issues)
- Automatic Prisma client generation during build
- Production optimizations enabled