# K10 Hub — Production Hosting & Deployment Guide

This guide covers everything you need to deploy, configure, and operate K10 Hub in production.

---

## 1. Architecture Overview

K10 Hub can be deployed in two production modes:

- **Mode A: Unified Single-Service (Recommended)**
  The Express backend serves both the `/api/*` REST endpoints and the compiled `frontend/dist` SPA. This requires running only one container or process, simplifying hosting on platforms like **Render**, **Railway**, **Fly.io**, **DigitalOcean**, or a **VPS**.
- **Mode B: Decoupled Architecture**
  Frontend hosted on static edge networks (Vercel, Netlify, Cloudflare Pages), with backend API hosted on a Node container service (Render, Railway, Fly.io).

---

## 2. Environment Variables Checklist

### Backend (`backend/.env` or Container Environment Variables)

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security, logging, error hiding, and proxy trusting. |
| `PORT` | `3001` (or provided by host) | Port the backend listens on. |
| `HOST` | `0.0.0.0` | Bind address (must be `0.0.0.0` in Docker/cloud containers). |
| `DATABASE_URL` | `./data/k10hub.db` or persistent volume path | Path to SQLite database file. |
| `CORS_ORIGINS` | `https://yourdomain.com` | Comma-separated list of allowed origins. |
| `SUPABASE_URL` | `https://<your-project>.supabase.co` | Your Supabase project URL. |
| `SUPABASE_ANON_KEY` | `<your-anon-key>` | Public Anon API Key from Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY`| `<your-service-role-key>` | Secret Service Role Key for server-side auth admin actions. |
| `ADMIN_EMAILS` | `mukeshdiy1@gmail.com,admin@yourdomain.com` | Comma-separated list of admin email addresses. |

### Frontend (`frontend/.env` - Used during build time)

| Variable | Description |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL (`https://<project>.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Public client Anon key from Supabase. |

---

## 3. Supabase Authentication Setup (Email Verification)

To enable email verification in production:

1. **Enable Email Confirmation**:
   - Go to your Supabase Dashboard: **Authentication** &rarr; **Providers** &rarr; **Email**.
   - Make sure **"Confirm email"** is toggled **ON**.
2. **Configure Redirect URLs**:
   - In Supabase Dashboard: **Authentication** &rarr; **URL Configuration**.
   - **Site URL**: `https://your-domain.com`
   - **Redirect URLs**:
     - `https://your-domain.com/verify-email`
     - `https://your-domain.com/auth/callback`
     - `https://your-domain.com/reset-password`
     - `http://localhost:5173/verify-email` (for local development)
3. **Custom SMTP (Recommended for Production)**:
   - Supabase default email has a rate limit of 3-4 emails per hour.
   - Under **Project Settings** &rarr; **Authentication** &rarr; **SMTP Settings**, configure your own SMTP provider (e.g. Resend, SendGrid, Amazon SES, Brevo, or Postmark) for unlimited delivery with your custom domain.

---

## 4. One-Click Docker Deployment

Build and run the production image using Docker:

```bash
# 1. Build the unified production container
docker build -t k10-hub .

# 2. Run container with persistent data volume and environment variables
docker run -d \
  --name k10-hub \
  -p 3001:3001 \
  -v k10_data:/app/backend/data \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e HOST=0.0.0.0 \
  -e CORS_ORIGINS="https://yourdomain.com" \
  -e SUPABASE_URL="https://ucdyadwezpiepjrfwbgc.supabase.co" \
  -e SUPABASE_ANON_KEY="your-anon-key" \
  -e SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  -e ADMIN_EMAILS="mukeshdiy1@gmail.com,admin@yourdomain.com" \
  --restart unless-stopped \
  k10-hub
```

---

## 5. Hosting on Cloud Platforms

### A. Render (Web Service)
1. Create a new **Web Service** connected to your repository.
2. Select **Docker** environment (Render will automatically detect the root `Dockerfile`).
3. Add a persistent disk at `/app/backend/data` (size: 1 GB - 5 GB) so SQLite data persists across redeploys.
4. Add the environment variables from the checklist above in the Render Dashboard.
5. Set Health Check Path to `/api/health`.

### B. Railway
1. Click **New Project** &rarr; **Deploy from GitHub repo**.
2. Railway detects the `Dockerfile` automatically.
3. Add a volume mounted at `/app/backend/data`.
4. Add your environment variables under the **Variables** tab.
5. Railway assigns a public HTTPS domain automatically.

### C. Traditional VPS (Ubuntu / Debian + Nginx + PM2)
```bash
# 1. Clone repository
git clone https://github.com/YourOrg/K10-Hub.git /var/www/k10-hub
cd /var/www/k10-hub

# 2. Install dependencies & build
npm run install:all
npm run build

# 3. Start with PM2
pm2 start backend/dist/server.js --name "k10-hub"
pm2 save
pm2 startup
```

**Nginx Configuration:**
```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 6. Performance & Optimization Verification

- **API Compression**: Response bodies are automatically compressed with gzip/brotli via `compression()` middleware.
- **Static Asset Caching**: Pre-hashed frontend chunks (`/assets/*`) are served with `Cache-Control: public, max-age=31536000, immutable`.
- **Code Splitting**: Initial JavaScript entry point reduced to ~36 kB. Each page loads on-demand.
- **Health Monitoring**: Monitor app status via `GET /api/health` which checks database connectivity and uptime.
