# Plan

Migration of the old Python Tkinter warehouse management app to a WeChat miniprogram.

## Phase 1: Project Scaffolding ✓

- [x] Initialize WeChat miniprogram project structure (`miniprogram/`, `cloudfunctions/`)
- [x] `project.config.json` with appid `your-app-id`
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
