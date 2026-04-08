# Supabase Setup

This document describes the minimum setup required for the new Supabase-based backend.

## 1. Create a Supabase project

Create a new project in Supabase first. After creation, you will need:

- Project URL
- Project ref
- Service role key

## 2. Local miniprogram config

Copy `.env.example` to `.env.local` and fill:

```ini
APPID=your-wechat-mini-program-appid
SUPABASE_FUNCTIONS_BASE_URL=https://your-project-ref.supabase.co/functions/v1/api
```

Then run:

```bash
npm run config:sync
```

This does two things:

- Sync `APPID` into local `project.config.json`
- Generate local `miniprogram/utils/runtime-config.js`

## 3. Supabase database

Run the SQL in:

- `supabase/migrations/20260408_supabase_core.sql`

This creates:

- `users`
- `operations`
- `inventory`
- `config`
- `mini_sessions`
- SQL functions `ensure_default_config()` and `apply_operation(...)`

## 4. Supabase Edge Function secrets

Set these secrets for the `api` Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WECHAT_APPID`
- `WECHAT_APP_SECRET`

`WECHAT_APP_SECRET` must stay only in Supabase secrets, not in repo files.

## 5. Deploy Edge Function

Deploy:

- Function path: `supabase/functions/api`
- Public route base: `https://<project-ref>.supabase.co/functions/v1/api`

The function is configured with `verify_jwt = false` because the app uses its own `mini_sessions` bearer token instead of Supabase Auth JWT.

## 6. First login bootstrap

On an empty database, the first user who logs in successfully is automatically created as:

- `role = chairman`

This avoids manual SQL just to create the first admin.

## 7. Current migration scope

Already migrated:

- WeChat login
- Profile setup
- Operations list
- Inventory list
- Inventory lookup
- Operation creation
- Organization management
- User list / approval / role changes / chairman transfer

Not yet migrated:

- Excel export
- Excel import
- Inventory rebuild
