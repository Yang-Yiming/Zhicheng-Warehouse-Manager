# Architecture

WeChat miniprogram architecture for the Warehouse Manager.

## Tech Stack

- **Frontend**: WeChat miniprogram (WXML + WXSS + JS)
- **Backend**: WeChat cloud development (云开发)
- **Database**: Cloud DB (NoSQL, document-based)
- **Cloud functions**: Node.js serverless functions
- **CI/Tooling**: miniprogram-ci (preferred over WeChat DevTools GUI for upload/preview/build)

Configuration note: WeChat DevTools reads `project.config.json` directly and does not consume `.env` files. Repository tracks `project.config.template.json` (placeholder appid) while local `project.config.json` is gitignored. Local AppID is managed via `.env.local`, then synced into `project.config.json` by running `npm run config:sync`.

## Project Structure

```
├── miniprogram/
│   ├── app.js / app.json / app.wxss      # App entry + login orchestration
│   ├── pages/
│   │   ├── operations/                    # Operations log list (paginated, searchable) + FAB → blank new form; reloads on onShow
│   │   ├── inventory/                     # Current inventory list; tap item → action sheet → pre-filled locked form; FAB → pre-filled 入库 form; reloads on onShow
│   │   ├── operation-form/                # New/pre-filled operation form (URL params: itemId, itemName, organization, operation, locked); locked=1 renders itemId/organization as readonly; segmented control for 入库/出库; stepper + Min/Max for quantity
│   │   ├── settings/                      # Display name edit (我的信息) + organizations list management
│   │   └── profile-setup/                 # First-launch display name setup
│   └── utils/
│       ├── db.js                          # Cloud DB collection refs + query helpers
│       ├── validation.js                  # Input validation (required, positiveInt, datetimeFormat, validateOperation)
│       ├── cloud.js                       # Unified cloud function caller (callCloud)
│       ├── search.js                      # Shared full-text filtering helper (filterByQuery)
│       └── feedback.js                    # Shared user feedback helper (showError, showSuccess)
├── cloudfunctions/
│   ├── operationCreate/                   # Validate + write operation, update inventory
│   ├── operationsList/                    # Paginated operations list sorted by submitTime desc
│   ├── inventoryList/                     # Full paginated inventory sorted by itemId
│   ├── inventoryRebuild/                  # Rebuild inventory by replaying all operations
│   ├── configGet/                         # Return config doc; seed defaults on first run
│   ├── configUpdate/                      # Update organizations/operators list
│   ├── userLogin/                         # Lookup-or-create user by openid on app launch
│   ├── userSetProfile/                    # Save display name (max 20 chars) for logged-in user
│   └── userSetOrgs/                       # Update user's personal organizations list
├── scripts/
│   └── sync-local-config.js              # Sync APPID from .env.local into project.config.json
└── DOCS/
```

## Database Collections

### `users`
```json
{
  "_id": "auto",
  "openid": "oXXXX...",
  "displayName": "张三",
  "organizations": ["学生会", "团委"],
  "createdAt": "2026-02-25T06:00:00Z",
  "updatedAt": "2026-02-25T06:00:00Z"
}
```

### `operations`
```json
{
  "_id": "auto",
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
  "_id": "auto",
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
  "_id": "settings",
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
onLaunch → wx.login() → callCloud('userLogin')
  → if isNew || !displayName → wx.navigateTo profile-setup page
    → user enters displayName → callCloud('userSetProfile')
    → profile-setup calls app._setLoginReady(user)
  → else → app._setLoginReady(user)
  → _setLoginReady fires queued onLoginReady callbacks
```

Pages call `app.onLoginReady(cb)` to receive the current user. If login is already complete the callback fires immediately; otherwise it is queued.

### Creating an Operation
```
User fills form → validate on client → call cloud function operationCreate
  → ensure `users`/`operations`/`inventory` collections exist (first-run bootstrap)
  → cloud.getWXContext() → OPENID
  → lookup users collection → resolve displayName
  → write to `operations` collection (operator/submitter = displayName, operatorOpenid = OPENID)
  → update `inventory` collection (add/remove/modify)
  → return success/failure
```

### Inventory Rebuild
```
Admin triggers rebuild → cloud function inventoryRebuild
  → ensure 'operations' and 'inventory' collections exist
  → paginated read of all operations sorted by operationTime asc
  → replay operations into state map keyed by `${itemId}::${organization}`
  → filter out entries with quantity ≤ 0
  → delete all existing inventory docs, write new entries
```

`inventoryList` uses paginated reads (page size 100) to return the full inventory sorted by `itemId`, bypassing the Cloud DB default 20-record fetch limit.

Cloud functions handling collection bootstrap (`operationsList`, `inventoryList`, `operationCreate`, `inventoryRebuild`) treat CloudBase missing-collection errors via both error code (`-502005`) and message variants (`collection not exists`, `Db or Table not exist`, `does not exist`) because different runtimes return different wording.

### `db.js` helper notes

- `getOperations(page, pageSize)` — direct Cloud DB query, paginated, sorted by `submitTime` desc
- `getInventory()` — delegates to `inventoryList` cloud function (not direct DB) to bypass miniprogram permission limits on full collection reads
- `getConfig()` — direct Cloud DB read of `config.doc('settings')`

## Key Design Decisions

1. **Cloud DB over local storage** — multi-user access, data persistence, no sync issues. Replaces the old questionnaire → xlsx → desktop app workflow entirely.
2. **Inventory as derived data** — inventory can always be rebuilt from operations, ensuring consistency
3. **Cloud functions for heavy logic** — inventory rebuild runs server-side to avoid miniprogram performance limits
4. **Single config document** — organizations and operators stored in one doc for simplicity; all users read the same config
5. **Shared frontend utilities** — cloud function invocation and search filtering are centralized in `utils/cloud.js` and `utils/search.js` to reduce duplicated page logic
6. **Consistent feedback UX** — common toast/modal behavior is centralized in `utils/feedback.js` to avoid repetitive per-page error handling code
