# Architecture

WeChat miniprogram architecture for the Warehouse Manager.

## Tech Stack

- **Frontend**: WeChat miniprogram (WXML + WXSS + JS)
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: Supabase Postgres
- **Authentication**: WeChat `wx.login` + backend `code2session` + custom Supabase session table
- **CI/Tooling**: miniprogram-ci (preferred over WeChat DevTools GUI for upload/preview/build)

Configuration note: WeChat DevTools reads `project.config.json` directly and does not consume `.env` files. Repository tracks `project.config.template.json` (placeholder appid) while local `project.config.json` is gitignored. Local AppID and Supabase function base URL are managed via `.env.local`, then synced by running `npm run config:sync`. The script also generates local `miniprogram/utils/runtime-config.js` from `miniprogram/utils/runtime-config.template.js`.

## Project Structure

```
├── miniprogram/
│   ├── app.js / app.json / app.wxss      # App entry + login orchestration
│   ├── pages/
│   │   ├── operations/                    # Operations log list (paginated, searchable) + FAB → blank new form; reloads on onShow
│   │   ├── inventory/                     # Current inventory list; tap item → action sheet → pre-filled locked form; FAB → pre-filled 入库 form; reloads on onShow
│   │   ├── operation-form/                # New/pre-filled operation form (URL params: itemId, itemName, organization, operation, locked); locked=1 renders itemId/organization as readonly; segmented control for 入库/出库; itemId blur auto-lookup fills itemName; 出库 requires item existence and enables Max=current stock
│   │   ├── settings/                      # Role-aware settings: display name + role badge; org management (admin+); user approval/management (admin+); admin promote/demote + chairman transfer (chairman only); Excel export (verified) + xlsx import (chairman)
│   │   ├── other/                         # Contact page shown from settings "联系" entry; static contact information with one-tap copy buttons (GitHub/email)
│   │   ├── profile-setup/                 # First-launch display name setup
│   │   └── user-orgs-edit/                # Admin edits a specific user's organizations
│   └── utils/
│       ├── db.js                          # API-backed query helpers
│       ├── validation.js                  # Input validation (required, positiveInt, datetimeFormat, validateOperation)
│       ├── cloud.js                       # Unified Supabase Edge Function caller (still exported as callCloud for compatibility)
│       ├── search.js                      # Shared full-text filtering helper (filterByQuery)
│       ├── feedback.js                    # Shared user feedback helper (showError, showSuccess)
│       ├── runtime-config.template.js     # Placeholder local runtime config template
│       └── excel.js                       # SheetJS wrapper: format detection, parse, export, file I/O
├── supabase/
│   ├── config.toml                        # Supabase local config; `api` function disables JWT verification
│   ├── migrations/
│   │   └── 20260408_supabase_core.sql     # Core schema + `apply_operation` SQL function
│   └── functions/
│       └── api/
│           └── index.ts                   # Single router for all core backend endpoints
├── scripts/
│   └── sync-local-config.js               # Sync APPID + Supabase function base URL from .env.local
└── DOCS/
```

## Database Collections

### `users`
```json
{
  "openid": "oXXXX...",
  "displayName": "张三",
  "organizations": ["学生会", "团委"],
  "role": "normal",
  "dismissed": false,
  "createdAt": "2026-02-25T06:00:00Z",
  "updatedAt": "2026-02-25T06:00:00Z"
}
```

`role` values: `unverified` | `normal` | `admin` | `superadmin` | `chairman`. New users default to `unverified`. Initial `chairman` and `superadmin` are set directly in the database.

`dismissed`: when `true`, the unverified user has been ignored by an admin and will not appear in the application list.

### `operations`
```json
{
  "submitTime": "2024-01-15T10:30:00Z",
  "itemId": "A1-3-05",
  "itemName": "折叠桌",
  "operation": "入库",
  "organization": "学生会",
  "quantity": 10,
  "operationTime": "2024-01-15 10:00",
  "operator": "张三",
  "submitter": "张三",
  "operatorOpenid": "oXXXX..."
}
```
Note: `operator` and `submitter` are server-resolved from the `users` collection via `cloud.getWXContext()`. Clients do not send these fields. `operatorOpenid` is stored for audit purposes.

Valid `operation` values: `入库` | `出库` | `物资增添` | `部分出库`

Business rules enforced by `operationCreate`:
- `入库`: rejects if `(itemId, organization)` already exists in inventory
- `出库` / `物资增添` / `部分出库`: requires item to already exist
- `部分出库`: quantity cannot exceed current inventory quantity
- `出库` sets inventory quantity to 0 (item removed if qty ≤ 0 after update)

### `inventory`
```json
{
  "itemId": "A1-3-05",
  "itemName": "折叠桌",
  "organization": "学生会",
  "quantity": 10,
  "lastOperation": "入库",
  "lastOperator": "张三",
  "lastOperationTime": "2024-01-15 10:00",
  "notes": ""
}
```

### `config`
```json
{
  "key": "settings",
  "organizations": ["学生会", "团委", ...],
  "operators": ["张三", "李四", ...]
}
```

Note: `operators` field is still stored in DB and seeded by `configGet`, but is no longer managed via the settings UI (operators are resolved server-side from the `users` collection).

Implementation note: cloud functions write config fields (`organizations`, `operators`) into `doc('settings')` without embedding `_id` inside `data`, to avoid first-run write failures during seeding/update.

`configGet` seeds a hardcoded default `organizations` list on first run (学生会, 团委, 学生发展中心, etc.) and an empty `operators` list. It also normalizes the stored arrays on every read (deduplication, trim whitespace).

## Data Flow

### Login Flow (app launch)
```
onLaunch → wx.login() → POST /functions/v1/api/userLogin
  → Edge Function calls WeChat code2session → resolves openid
  → lookup-or-create users row
  → create mini_sessions token (30d sliding expiry)
  → if first-ever user → bootstrap role=chairman
  → frontend stores session token
  → if isNew || !displayName → wx.navigateTo profile-setup page
    → user enters displayName → POST /functions/v1/api/userSetProfile
    → profile-setup calls app._setLoginReady(user)
  → else → app._setLoginReady(user)
  → _setLoginReady fires queued onLoginReady callbacks
```

Pages call `app.onLoginReady(cb)` to receive the current user. If login is already complete the callback fires immediately; otherwise it is queued.

Authenticated API requests now resolve session + user identity through SQL helper `get_session_user(token_hash)` in one DB read. Session expiry still uses a sliding 30-day window, but the backend only extends `mini_sessions.expires_at` when the remaining TTL drops below a renewal threshold, avoiding a write on every protected request.

### Creating an Operation
```
User fills form → validate on client → POST /functions/v1/api/operationCreate
  → backend validates session token → resolves current user from `mini_sessions`
  → SQL function `apply_operation(...)` writes operation + updates inventory in one DB transaction
  → return success/failure
```

`operation-form` item-id assist flow:
- On `itemId` blur:
  - Query `inventoryGet` cloud function by `itemId`
  - `出库`: query with `(itemId, organization)`; found → auto-fill `itemName` + set `maxQuantity`; not found (non-empty id) → show inline error under itemId + disable submit
  - `入库`: query with `itemId`; found → auto-fill `itemName`; not found does not block submit
- For `出库`, empty `itemId` keeps submit disabled but does not show inline error
- Item name editability:
  - `出库`: item name input is readonly
  - `入库`: item name is editable until itemId lookup hits existing inventory; after hit it becomes readonly

`inventoryList` now paginates via Postgres `range()` and sorts by `item_id`.

`operationsList` and `inventoryList` no longer issue `count(*)` for every page. They fetch `pageSize + 1` rows and return `hasMore`, which matches the miniprogram's infinite-scroll UX and removes exact-count overhead from hot list endpoints.

`operation-form` keeps an in-page cache of `inventoryGet` responses keyed by `itemId + organization`, so repeated blur/submit flows do not re-hit the backend for the same lookup unless the item ID or organization changes.

### Data Export/Import

Excel import/export now runs on the Supabase path:

- `dataExport` requires any verified user and returns the full `operations` + `inventory` payload.
- `dataExport` paginates backend reads explicitly, so export size is not truncated by Supabase's default row cap.
- The miniprogram converts that payload into a two-sheet xlsx workbook (`操作记录`, `库存状态`) via `utils/excel.js`.
- The `操作记录` sheet includes `operatorOpenid` alongside the visible operator fields so a full export/import round-trip preserves operation audit identity.
- `dataImport` is restricted to `chairman` and overwrites current `operations` + `inventory`.
- `dataImport` normalizes spreadsheet time cells before validation/import, including Excel serial dates and common date-string variants written back by Excel/WPS.
- Supported import formats:
  - current miniprogram export format (`操作记录` + `库存状态`)
  - old Python single-sheet inventory export (`old_inventory`)
- Import replacement is executed by SQL function `replace_imported_data(...)` so table clearing + reinsertion happens in one database transaction.
- The SQL import helper clears `operations` / `inventory` using safe-update-compatible statements (`DELETE ... WHERE TRUE`) because some Supabase environments reject unconditional `DELETE`.
- The SQL import helper avoids PL/pgSQL variables named `current_time`, because PostgreSQL can resolve that keyword as `time with time zone` instead of the intended `timestamptz` value during inserts.
- Import validation happens in the Edge Function first; unexpected Supabase/Postgres failures are returned with their backend message instead of a generic `服务器错误`.
- For `old_inventory` import, the system synthesizes matching `入库` operation records because the old file contains inventory snapshot only, not full operation history.

### `db.js` helper notes

- `getOperations(page, pageSize)` — Edge Function call, paginated, sorted by `submitTime` desc
- `getInventory(page, pageSize)` — Edge Function call, paginated, sorted by `itemId`
- `getConfig()` — Edge Function call to `configGet`

## Key Design Decisions

1. **WeChat identity without cloud development** — `wx.login` is kept, but `openid` is resolved by a Supabase Edge Function calling WeChat `code2session`, so the app no longer depends on 微信云开发平台.
2. **Custom app session over Supabase Auth** — the app uses a dedicated `mini_sessions` table keyed by hashed bearer tokens. This avoids forcing Supabase Auth into a WeChat-mini-program-specific identity model.
3. **Inventory mutation in SQL transaction** — `apply_operation(...)` keeps operation history writes and inventory updates atomic.
4. **Single Edge Function router** — frontend API names stay stable while backend deployment surface is simplified to one Supabase function.
5. **First-user bootstrap** — the first-ever login in a fresh database is promoted to `chairman`, eliminating manual SQL setup for initial admin access.
6. **Shared frontend utilities** — request handling and search filtering remain centralized in `utils/cloud.js` and `utils/search.js`.
7. **Excel generation stays on-device** — Supabase stores and serves normalized business data; the miniprogram still handles xlsx parsing and workbook generation locally via SheetJS.
