This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## 🚀 Production Deployment

### Option 1: Docker Compose (Recommended for Self-Hosting)

**Prerequisites:**
- Docker & Docker Compose installed
- At least 2GB RAM

**Quick Start:**

```bash
# 1. Copy environment template
cp .env.example .env.local

# 2. Generate required secrets
openssl rand -base64 32  # For AUTH_SECRET

# 3. Edit .env.local with your values
#    - DATABASE_URL
#    - AUTH_SECRET
#    - AUTH_USERNAME
#    - AUTH_PASSWORD

# 4. Start all services
DB_PASSWORD=your_secure_password docker-compose up -d

# 5. Initialize database
docker-compose exec app npx drizzle-kit push
```

**Services:**
- **App**: Next.js application (port 3000)
- **Database**: PostgreSQL 16 (port 5432)
- **Worker**: Background tasks (RSS fetching, AI processing)

**Management Commands:**

```bash
# View logs
docker-compose logs -f app
docker-compose logs -f worker

# Restart services
docker-compose restart app
docker-compose restart worker

# Stop all services
docker-compose down

# Update and redeploy
git pull
docker-compose up -d --build
```

### Option 2: Dokploy / Coolify (Self-Hosted PaaS)

**Dokploy Setup:**

```bash
# Install Dokploy on your VPS
curl -sSL https://get.dokploy.com | sh

# Access dashboard at http://your-server-ip:3000
```

**Deployment Steps:**
1. Connect your Git repository
2. Select `docker-compose.dokploy.yml` as compose file
3. Configure environment variables:
   - `DOMAIN=your-domain.com`
   - `DATABASE_URL=postgresql://...`
   - `DB_PASSWORD=strong_password`
   - `AUTH_SECRET=<generated_secret>`
   - `AUTH_USERNAME=admin`
   - `AUTH_PASSWORD=your_password`
4. Deploy! Traefik will handle SSL automatically

### Option 3: Railway

**One-Click Deploy:**

1. Create account at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Railway auto-detects `railway.json` and `Procfile`
4. Add PostgreSQL database from Railway dashboard
5. Configure environment variables in Railway UI
6. Deploy!

**Environment Variables Required:**
- `DATABASE_URL` (from Railway PostgreSQL)
- `AUTH_SECRET`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `RSSHUB_BASE_URL` (optional)

### Option 4: Render

**Deploy via Blueprint:**

1. Create account at [render.com](https://render.com)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render reads `render.yaml` automatically
5. Configure sensitive environment variables
6. Deploy web service + worker + database

**Free Tier Limitations:**
- Web services sleep after 15 minutes of inactivity
- Consider upgrading to Starter plan ($7/month) for production

---

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `AUTH_SECRET` | NextAuth encryption key | ✅ |
| `AUTH_USERNAME` | Admin username | ✅ |
| `AUTH_PASSWORD` | Admin password (plain text) | ✅ |
| `RSSHUB_BASE_URL` | RSSHub instance URL | ❌ (default: rsshub.app) |

**Generate Secrets:**

```bash
# AUTH_SECRET
openssl rand -base64 32
```

---

## 📊 Monitoring & Health Checks

**Health Check Endpoint:**
```
GET http://your-domain/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-06-04T12:00:00.000Z",
  "service": "rsxonhub"
}
```

**Database Management:**
```bash
# Open Drizzle Studio (local development)
npm run db:studio

# Push schema changes
npm run db:push

# Generate migrations
npm run db:generate
```
