# Supabase setup — Stock Due Diligence Web

The frontend is static and remains hosted on GitHub Pages. Supabase provides authentication and private per-user PostgreSQL storage.

## 1. Create a Supabase project
1. Create a project at https://supabase.com/dashboard and save the database password somewhere secure.
2. Open **Project Settings → API** (or **Connect**) and copy the Project URL and the **anon / publishable** key.
3. In Supabase **SQL Editor**, run the full SQL file at [supabase/schema.sql](supabase/schema.sql).

## 2. Configure the public frontend
Edit `supabase-config.js` in this repository and replace:
- `https://YOUR_PROJECT_REF.supabase.co` with your project URL.
- `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY` with the anon/publishable key.

These values are intended for browser use. **Never put a `service_role` key or secret key in this repository.** The database is protected by Row Level Security (RLS); each table policy restricts access to the authenticated user's own `user_id`.

## 3. Enable sign-in providers
In Supabase **Authentication → Sign In / Providers**:
- Enable **Email**. Configure email confirmation and your SMTP/email settings as desired.
- Enable **Google** and add the Google OAuth Client ID and Client Secret in Supabase. Create OAuth credentials in Google Cloud Console; configure the authorized redirect URI shown by Supabase (usually `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`).

## 4. Configure allowed URLs
In Supabase **Authentication → URL Configuration**:
- Site URL: `https://stock-due-diligence-web.chatgpt-plugin.public.mesprk.com`
- Add this exact Redirect URL: `https://stock-due-diligence-web.chatgpt-plugin.public.mesprk.com/**`
- For local testing, add your local development URL explicitly.

## 5. Deploy
Commit the config file after replacing the placeholders. The existing GitHub Actions workflow deploys the update to GitHub Pages. Then open the custom domain and test:
1. Register with email/password and confirm your email if confirmation is enabled.
2. Sign in and try Google OAuth.
3. Add a stock, edit DCF assumptions, tick checklist items, and save a note/report.
4. Sign out and sign back in; your data should remain.

## Tables and privacy
- `profiles`: display name metadata, created on signup.
- `watchlist`: each user's stocks.
- `dcf_models`: saved assumptions.
- `checklist_progress`: completion state.
- `research_documents`: notes, company reports, investment theses, and risk assessments.

Every table has RLS enabled. Keep the policies in place and never disable RLS for these tables. The frontend only uses the public anon/publishable key; Supabase Auth issues a user session, and RLS checks `auth.uid()` on each database request.

## Important limitations
- Stock metrics remain illustrative demo values, not live market data.
- Research documents are text content, not uploaded file attachments.
- The site has no backend server; database security relies on correct Supabase RLS and provider configuration.
