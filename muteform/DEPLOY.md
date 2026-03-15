# Muteform Deployment Guide

## 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema:
   ```
   Copy the contents of backend/supabase/schema.sql and execute it
   ```
3. Note your project credentials from Settings → API:
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_ANON_KEY` (anon/public key)
   - `SUPABASE_SERVICE_KEY` (service_role key — keep secret)

## 2. Backend Deployment (Railway)

1. Create a new project at [railway.app](https://railway.app)
2. Connect your GitHub repo or use Railway CLI
3. Set the root directory to `muteform/backend`
4. Add environment variables:
   ```
   PORT=3001
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_SERVICE_KEY=<your-service-role-key>
   SUPABASE_ANON_KEY=<your-anon-key>
   FRONTEND_URL=<your-vercel-url>
   ```
5. Railway will auto-detect the Dockerfile and deploy
6. Note your Railway URL (e.g., `https://muteform-backend-production.up.railway.app`)

## 3. Frontend Deployment (Vercel)

1. Create a new project at [vercel.com](https://vercel.com)
2. Import from GitHub, set root directory to `muteform/frontend`
3. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   NEXT_PUBLIC_API_URL=<your-railway-url>
   ```
4. Deploy — Vercel auto-detects Next.js

## 4. Post-Deployment

1. Update Railway's `FRONTEND_URL` env var with your Vercel URL
2. Test the flow:
   - Sign up at your Vercel URL
   - Create a ruleset in the Rules tab
   - Run a scan in the Scan tab
   - Check History and Drift tabs
   - Generate an MCP token in the MCP tab

## Local Development

```bash
# Backend
cd muteform/backend
cp .env.example .env  # fill in values
npm install
npm run dev

# Frontend
cd muteform/frontend
cp .env.example .env  # fill in values
npm install
npm run dev
```

Backend runs on http://localhost:3001, frontend on http://localhost:3000.
