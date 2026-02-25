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
- [x] Operators list: add / remove, synced via `configUpdate`

## Phase 5: Polish & Extras

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
