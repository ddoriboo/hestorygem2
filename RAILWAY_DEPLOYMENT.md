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

After deployment, Railway will automatically run:
- `prisma migrate deploy` - Creates all database tables and indexes
- `prisma generate` - Generates Prisma Client
- Database migrations will be applied automatically during build process

The initial migration includes:
- User table (for authentication)
- Session table (for interview sessions 1-12)
- Conversation table (for Q&A pairs)
- Autobiography table (for generated life stories)

## Build Configuration

The app is configured with:
- Node.js runtime for all API routes (fixes Edge Runtime compatibility issues)
- Automatic Prisma client generation during build
- Production optimizations enabled