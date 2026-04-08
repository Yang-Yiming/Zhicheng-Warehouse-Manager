# Plan

Migration of the old Python Tkinter warehouse management app to a WeChat miniprogram.

## Phase 1: Project Scaffolding ✓

- [x] Initialize WeChat miniprogram project structure (`miniprogram/`, `cloudfunctions/`)
- [x] `project.config.json` uses placeholder appid in git-tracked config (real appid via local sync)
- [x] miniprogram-ci installed, `ci/upload.js` and `ci/preview.js` ready
- [x] Base page stubs: operations, inventory, operation-form, settings
- [x] Cloud function stubs: operationCreate, inventoryRebuild
- [x] Set up cloud development environment (云开发) — requires WeChat DevTools, see below
- [x] Replace `'your-env-id'` in `miniprogram/app.js` with actual env ID

## Phase 2: Data Layer ✓

- [x] Cloud DB collections defined: `operations`, `inventory`, `config`
- [x] Data models match ARCHITECTURE.md schema
- [x] `operationCreate` — validates all fields, enforces business rules (duplicate check, qty check), updates inventory
- [x] `inventoryRebuild` — replays all ops, filters qty≤0, replaces inventory collection
- [x] `operationsList` — paginated list sorted by submitTime desc
- [x] `configGet` — returns config doc, seeds defaults on first run
- [x] `configUpdate` — updates organizations/operators list
- [x] `utils/validation.js` — required, positiveInt, datetimeFormat, validateOperation
- [x] `utils/db.js` — collection refs + getOperations, getInventory, getConfig helpers

## Phase 2.5: Authentication & User Identity ✓

- [x] `users` collection — stores openid + displayName
- [x] `userLogin` cloud function — lookup-or-create user by openid on every app launch
- [x] `userSetProfile` cloud function — save displayName (openid from server context only)
- [x] `app.js` login orchestration — `onLoginReady` callback queue, retry modal on failure
- [x] `profile-setup` page — first-launch display name entry, blocks back navigation
- [x] `operationCreate` updated — operator/submitter resolved server-side from users collection; `operatorOpenid` stored for audit trail; clients no longer send operator/submitter
- [x] `operation-form` updated — shows operator name as read-only from login context
- [x] `settings` updated — "我的信息" section with inline display name edit

## Phase 3: Core Pages ✓

### 3a: Operations Log Page (操作记录) ✓
- [x] List view of all operations, sorted by time descending (paginated via `operationsList`)
- [x] Search bar for full-text filtering (client-side across itemId, itemName, operation, organization, operator, operationTime)
- [x] Pull-down refresh + infinite scroll (onReachBottom)

### 3b: Current Inventory Page (当前库存) ✓
- [x] List view of current stock per item (via `getInventory` db helper)
- [x] Search bar for full-text filtering
- [x] Pull-down refresh

### 3c: New Operation Page (新建操作) ✓
- [x] Form for creating inbound / outbound / add / partial-outbound operations
- [x] Picker for operation type and organization (loaded from configGet)
- [x] Date + time pickers for operation time (defaults to now)
- [x] Client-side validation before submit
- [x] Calls `operationCreate` cloud function; shows error on failure, resets form on success

## Phase 4: Config Management ✓

- [x] Settings page: display name editing (existing)
- [x] Organizations list: add / remove, synced via `configUpdate`
- [x] Operators list: add / remove, synced via `configUpdate` *(UI removed in Phase 6.5; field still stored in DB)*

## Phase 6.4: Operation Form UI Redesign ✓

- [x] Replace operation type `<picker>` with segmented control (入库 green / 出库 orange)
- [x] Replace quantity `<input>` with stepper (−/+ buttons + inline input, min 1)
- [x] Add Min / Max shortcut buttons; Max fetches live inventory stock for 出库 only
- [x] Restructure layout into card sections (操作类型 / 信息 / 物资 / 数量 / 时间)
- [x] Page background `#f2f3f7`, card border-radius 16rpx, picker rows with `›` arrow
- [x] Submit button color follows operation type (green for 入库, orange for 出库)
- [x] Replace `onOperationChange` with `onSelectOperation`; add `onQuantityStep`, `onQuantityMin`, `onQuantityMax`

## Phase 6.5: Settings Cleanup ✓

- [x] Remove operators list UI from settings page (operators are now resolved server-side from `users` collection; manual list is redundant)
- [x] Settings page now manages: display name (我的信息) + organizations list only

## Phase 6.6: User-Level Organizations ✓

- [x] Add `organizations` field to `users` collection (user's personal org list)
- [x] `userLogin` returns `organizations` in formatted user object
- [x] New `userSetOrgs` cloud function — updates `organizations` on the logged-in user's record
- [x] Settings page: rename "所属组织" → "全部组织"; add new "所属组织" section for personal org management
- [x] Personal org picker shows only orgs not yet added; "全部组织" section unchanged
- [x] `operation-form` org picker now uses user's personal `organizations` instead of global config
- [x] Auto-fills first org on form load when user has ≥1 personal org (unless locked)

## v0.2.0

## Phase 6.7: Role-Based Permission System ✓

- [x] Add `role` field to `users` collection: `unverified` | `normal` | `admin` | `superadmin` | `chairman`; new users default to `unverified`
- [x] Add `dismissed` field to `users` collection: `true` means admin has ignored this unverified user's application
- [x] `userLogin` returns `role` in formatted user object; new user creation writes `role: 'unverified'`
- [x] `operationCreate` rejects unverified users with permission error
- [x] `operationsList` rejects unverified users with permission error
- [x] `inventoryList` rejects unverified users with permission error
- [x] `configUpdate` requires admin/superadmin/chairman role
- [x] `userSetOrgs` requires admin+ for self-edit; supports `targetOpenid` for proxy edit (admin+ only)
- [x] New `userList` cloud function — returns users by role (admin+ only); excludes dismissed unverified users
- [x] New `userSetRole` cloud function — role changes with permission matrix enforcement
- [x] New `chairmanTransfer` cloud function — transfers chairman role to an admin
- [x] Operations page: unverified users see "联系管理员授权" instead of list + FAB
- [x] Inventory page: same unverified block pattern
- [x] Operation-form page: unverified users are redirected back with error modal
- [x] Settings page: role badge in 我的信息; 所属组织/全部组织 hidden for unverified; org editing restricted to admin+; user management sections (申请/全部成员/管理员管理/转让主席) shown based on role
- [x] New `user-orgs-edit` page — admin edits a specific user's organizations via `userSetOrgs({ targetOpenid })`

## v1.0.0beta

## Phase 6.10: Settings Other/Contact Entry ✓

- [x] Add a new "其他" entry at the bottom of settings page
- [x] Rename the settings entry text to "联系"
- [x] Add `pages/other` page with static contact information display and one-tap copy buttons (GitHub/email)
- [x] Default template includes contact info: `12411332@mail.sustech.edu.cn`

## Phase 6.9: Operation Form Item-ID Assisted Validation ✓

- [x] Add `inventoryGet` cloud function for single-item inventory lookup (optional organization filter)
- [x] On item ID blur, query inventory via cloud function (no frontend direct DB query)
- [x] Auto-fill item name when item is found (both 入库 / 出库)
- [x] Outbound only: if item ID is non-empty but not found, show inline error under item ID and disable submit
- [x] Outbound only: if item ID is empty, do not show error but keep submit disabled
- [x] Keep existing max button behavior: sets quantity to current stock for found outbound item
- [x] Item name input is readonly in 出库 mode; in 入库 mode it becomes readonly after item ID lookup hits an existing item

## Phase 6.8: Open Member List to All Verified Users ✓

- [x] `userList` cloud function: permission gate relaxed from admin+ to any non-unverified caller
- [x] Settings page: "全部成员" section visible to all verified users (role !== 'unverified')
- [x] Member list now includes all roles (normal / admin / superadmin / chairman) with inline role badge
- [x] Action buttons (提拔 / 降级 / 转让主席) restricted to chairman only, conditioned on item.role
- [x] Merged "管理员管理" section into unified "全部成员" list


- Operation audit log (monthly logs viewable in-app)
- Inventory rebuild button (admin)
- Permission / role management (if needed)
- UI refinements, loading states, error handling
- (Optional) Excel export for reporting if needed later

## Phase 5.5: Maintainability Refactor ✓

- [x] Add shared cloud function caller utility (`miniprogram/utils/cloud.js`) for unified success/error handling
- [x] Add shared full-text search utility (`miniprogram/utils/search.js`) and apply to operations + inventory pages
- [x] Refactor `operation-form` to reuse `utils/validation.validateOperation` instead of page-local duplicated validation
- [x] Align frontend validation with current auth model (operator/submitter resolved server-side, no longer required client-side)
- [x] Refactor settings/config calls to use shared cloud helper, reducing repeated boilerplate
- [x] Refactor profile setup page to use shared cloud helper (`userSetProfile`)
- [x] Fix cloud collection truncation bug by paginating reads in `inventoryList` and `inventoryRebuild`

## Phase 5.6: Frontend Flow Unification ✓

- [x] Refactor `app.js` login flow to use `utils/cloud.callCloud` for consistent cloud function handling
- [x] Add shared feedback helper (`miniprogram/utils/feedback.js`) to unify toast/modal behavior
- [x] Apply feedback helper in operations / inventory / operation-form / settings / profile-setup pages
- [x] Reduce login flow noise by removing debug-heavy logs and simplifying retry branch handling

## Phase 5.7: Config Load Stability ✓

- [x] Fix `configGet` default seeding path to avoid writing `_id` into document payload
- [x] Fix `configUpdate` missing-document fallback to use `doc('settings').set(...)` instead of `add`
- [x] Ensure config cloud functions return successful payloads for first-run and empty-config scenarios

## Phase 5.8: Empty Collection Graceful Fallback ✓

- [x] Update `operationsList` to auto-create missing `operations` collection and return empty successful result
- [x] Update `inventoryList` to auto-create missing `inventory` collection and return empty successful result
- [x] Harden frontend config parsing in operation-form/settings when cloud payload is partially missing

## Phase 5.9: Operation Submit First-Run Hardening ✓

- [x] Update `operationCreate` to auto-create missing `users` / `inventory` / `operations` collections before query/write
- [x] Add unified runtime error capture in `operationCreate` to return stable `success:false` payload instead of raw cloud exception

## Phase 6.0: Cloud Error Compatibility Hardening ✓

- [x] Update `operationsList` / `inventoryList` missing-collection detection to support `-502005`, `collection not exists`, and `Db or Table not exist`
- [x] Update `inventoryRebuild` to auto-create missing `operations` / `inventory` collections and return stable success on first-run empty state

## Phase 6.1: Local Env Config Workflow ✓

- [x] Add `.env.example` and ignore `.env.local` for local AppID management
- [x] Add `npm run config:sync` script to sync `APPID` from `.env.local` into `project.config.json` before opening WeChat DevTools

## Phase 6.2: Template-Based Project Config Hygiene ✓

- [x] Track `project.config.template.json` with placeholder appid and gitignore local `project.config.json`
- [x] Update `config:sync` script to bootstrap local `project.config.json` from template when missing

## Phase 6.3: Simplified Operation UI ✓

- [x] Reduce user-facing operation types from 4 to 2 (入库 / 出库)
- [x] Frontend auto-routes: 入库 → checks inventory existence → sends 入库 or 物资增添; 出库 → sends 部分出库
- [x] Backend unchanged; all 4 real operation types still stored in records

## v1.2.0

## Phase 7.0: Supabase Core Migration ✓

- [x] Remove miniprogram runtime dependency on `wx.cloud` / Cloud DB / cloud functions
- [x] Keep WeChat identity via `wx.login` + backend `code2session`, without using 微信云开发平台
- [x] Add local config sync for `SUPABASE_FUNCTIONS_BASE_URL` alongside existing `APPID` sync
- [x] Add Supabase SQL migration for `users` / `operations` / `inventory` / `config` / `mini_sessions`
- [x] Add single Supabase Edge Function router `api` covering core endpoints: `userLogin`, `userSetProfile`, `configGet`, `operationsList`, `inventoryList`, `inventoryGet`, `operationCreate`, `userSetOrgs`, `userList`, `configUpdate`, `userSetRole`, `chairmanTransfer`
- [x] Preserve existing role model and settings/member-management flow on Supabase
- [x] Bootstrap first-ever logged-in user as `chairman` so a fresh project can self-initialize without manual DB edits
- [x] Hide Excel import/export UI during Supabase phase 1; `dataExport` / `dataImport` deferred to phase 2

## Phase 7.1: Supabase Login Diagnostics ✓

- [x] Surface backend login error text in `miniprogram/app.js` retry modal instead of always showing a generic network failure
- [x] Document `userLogin` troubleshooting for missing Supabase secrets, mismatched WeChat app credentials, and missing SQL migration

## Phase 7.2: Supabase Excel Import / Export ✓

- [x] Restore settings-page Excel export entry for verified users on the Supabase runtime
- [x] Restore settings-page xlsx import entry for chairman only, with overwrite confirmation
- [x] Add Supabase `dataExport` endpoint returning full operations + inventory payload for frontend workbook generation
- [x] Add Supabase `dataImport` endpoint covering current miniprogram export format and old single-sheet inventory format
- [x] Add transactional SQL import helper to replace `operations` / `inventory` data in one database function call
- [x] Keep xlsx parsing/building on the miniprogram side via existing `utils/excel.js`
- [x] Paginate `dataExport` reads so large warehouses are exported completely beyond Supabase's default row cap
- [x] Include `operatorOpenid` in the exported workbook so full export/import round-trips preserve operation audit identity

## Phase 7.2.1: Excel Import Robustness ✓

- [x] Normalize imported time fields in Supabase `dataImport`, accepting Excel serial dates and common spreadsheet date strings
- [x] Validate imported time fields before SQL import so malformed rows fail with row-level messages instead of generic server errors
- [x] Preserve backend error details from Supabase/Postgres in the API response when import fails unexpectedly
- [x] Make import overwrite SQL compatible with safe-update environments that reject unconditional `DELETE`
