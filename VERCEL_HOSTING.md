# Vercel Hosting & Database Setup Guide

This guide answers your questions directly:
1. **Where is my Database right now?**
2. **How does Vercel handle databases?**
3. **How do I deploy to Vercel step-by-step?**

---

## 1. Where My DB Is Right Now

Right now, your database is a **local SQLite file** on your machine:
- File path: `c:\Users\MAKERBRAINS\Downloads\K10-Hub\backend\data\k10hub.db`
- It contains your projects, comments, user profiles, likes, bookmarks, and author applications.

---

## 2. Why Vercel Needs a Cloud Database

- **Vercel is a Serverless Platform**: It runs code in temporary micro-containers (lambdas) that spin down when idle.
- **Vercel's filesystem is read-only and ephemeral**: If an app creates or writes to a local `.db` file on Vercel, those changes are erased as soon as the function sleeps.
- **The Solution**:
  Your app uses `@libsql/client` (Drizzle ORM). `@libsql/client` was built specifically for **[Turso](https://turso.tech)**, which is **Cloud SQLite**.
  - Turso gives you a **free cloud-hosted SQLite database** (9 GB storage, 500 databases, free forever).
  - Your code already supports Turso out of the box!
  - When you provide `DATABASE_URL=libsql://...` and `DATABASE_AUTH_TOKEN=...`, your backend connects to cloud SQLite over HTTP with zero changes to your schema or queries!

---

## 3. How to Host on Vercel (Step-by-Step)

### Step 1: Create Free Cloud SQLite on Turso (Takes 2 minutes)

1. Open [turso.tech](https://turso.tech) and sign up (Free with GitHub).
2. Install Turso CLI or create from dashboard:
   - **Option A (Via Web Dashboard)**:
     - Click **Create Database** &rarr; Name it `k10hub` &rarr; Choose the region closest to you.
     - Copy the **Database URL** (e.g. `libsql://k10hub-yourname.turso.io`).
     - Click **Create Token** &rarr; Copy the authentication token.
   - **Option B (Via Terminal CLI)**:
     ```bash
     # Install CLI (Windows PowerShell)
     irm https://get.turso.tech/install.ps1 | iex

     # Log in & create DB
     turso auth login
     turso db create k10hub

     # Upload your existing local data to Turso in one command!
     turso db create k10hub --from-file backend/data/k10hub.db

     # Get connection URL & token
     turso db show k10hub --url
     turso db tokens create k10hub
     ```

---

### Step 2: Push Your Code to GitHub

Make sure your repository has the latest changes:
```bash
git add .
git commit -m "Configure Vercel serverless and production auth"
git push origin main
```

---

### Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New...** &rarr; **Project**.
3. Select your **K10-Hub** GitHub repository and click **Import**.
4. In the **Configure Project** screen:
   - **Framework Preset**: Leave as `Vite` (or `Other`).
   - **Root Directory**: `./` (leave default).
   - **Build Command**: `npm run build`
   - **Output Directory**: `frontend/dist`
5. Open **Environment Variables** and add the following:

| Name | Value |
| :--- | :--- |
| `DATABASE_URL` | `libsql://k10hub-yourname.turso.io` (from Turso) |
| `DATABASE_AUTH_TOKEN` | Your Turso token |
| `SUPABASE_URL` | `https://ucdyadwezpiepjrfwbgc.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `VITE_SUPABASE_URL` | `https://ucdyadwezpiepjrfwbgc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `ADMIN_EMAILS` | `mukeshdiy1@gmail.com,admin@k10hub.io` |
| `NODE_ENV` | `production` |

6. Click **Deploy**!
Vercel will build the frontend and deploy the `/api/*` serverless backend automatically.

---

### Step 4: Update Supabase Redirect URLs

In your Supabase Dashboard (**Authentication** &rarr; **URL Configuration**):
1. Set **Site URL** to your new Vercel domain (e.g. `https://k10-hub.vercel.app`).
2. Add to **Redirect URLs**:
   - `https://k10-hub.vercel.app/verify-email`
   - `https://k10-hub.vercel.app/auth/callback`
   - `https://k10-hub.vercel.app/reset-password`

---

## 4. Alternative: Frontend on Vercel + Backend on Render

If you don't want to use Turso and prefer keeping the exact SQLite file `k10hub.db` on a traditional disk:
1. Host backend on [Render.com](https://render.com) using the [Dockerfile](file:///c:/Users/MAKERBRAINS/Downloads/K10-Hub/Dockerfile) with a persistent disk at `/app/backend/data`.
2. Host frontend on Vercel with:
   - `VITE_API_BASE_URL=https://your-backend.onrender.com/api`
