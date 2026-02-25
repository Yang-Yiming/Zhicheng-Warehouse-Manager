# Architecture

WeChat miniprogram architecture for the Warehouse Manager.

## Tech Stack

- **Frontend**: WeChat miniprogram (WXML + WXSS + JS)
- **Backend**: WeChat cloud development (云开发)
- **Database**: Cloud DB (NoSQL, document-based)
- **Cloud functions**: Node.js serverless functions
- **CI/Tooling**: miniprogram-ci (preferred over WeChat DevTools GUI for upload/preview/build)

Configuration note: WeChat DevTools reads `project.config.json` directly and does not consume `.env` files. Local AppID is managed via `.env.local` and synced into `project.config.json` by running `npm run config:sync`.

## Project Structure

```
├── miniprogram/
│   ├── app.js / app.json / app.wxss      # App entry + login orchestration
│   ├── pages/
│   │   ├── operations/                    # Operations log list
│   │   ├── inventory/                     # Current inventory list
│   │   ├── operation-form/                # New operation form
│   │   ├── settings/                      # Config management + profile edit
│   │   └── profile-setup/                 # First-launch display name setup
│   ├── components/
│   │   ├── search-bar/                    # Reusable search
│   │   └── sortable-list/                 # Sortable list view
│   └── utils/
│       ├── db.js                          # Cloud DB helpers
│       ├── validation.js                  # Input validation
│       ├── cloud.js                       # Unified cloud function caller
│       ├── search.js                      # Shared full-text filtering helper
│       └── feedback.js                    # Shared user feedback helper (toast/modal)
├── cloudfunctions/
│   ├── operationCreate/                   # Create operation + update inventory
│   ├── inventoryRebuild/                  # Rebuild inventory from history
│   ├── userLogin/                         # Lookup-or-create user by openid
│   └── userSetProfile/                    # Save display name for logged-in user
└── DOCS/
```

## Database Collections

### `users`
```json
{
  "_id": "auto",
  "openid": "oXXXX...",
  "displayName": "张三",
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

Implementation note: cloud functions write config fields (`organizations`, `operators`) into `doc('settings')` without embedding `_id` inside `data`, to avoid first-run write failures during seeding/update.

## Data Flow

### Login Flow (app launch)
```
onLaunch → wx.login() → callFunction('userLogin')
  → if isNew || !displayName → navigate to profile-setup page
  → user enters displayName → callFunction('userSetProfile')
  → _setLoginReady(user) → fire queued onLoginReady callbacks
  → wx.switchTab to operations
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
  → paginated read of all `operations` sorted by time (avoid cloud DB default fetch limits)
  → replay operations sequentially to compute current state
  → replace entire `inventory` collection
```

`inventoryList` also uses paginated reads to return full inventory data instead of a truncated first page.

Cloud functions handling collection bootstrap (`operationsList`, `inventoryList`, `operationCreate`, `inventoryRebuild`) treat CloudBase missing-collection errors via both error code (`-502005`) and message variants (`collection not exists`, `Db or Table not exist`, `does not exist`) because different runtimes return different wording.

## Key Design Decisions

1. **Cloud DB over local storage** — multi-user access, data persistence, no sync issues. Replaces the old questionnaire → xlsx → desktop app workflow entirely.
2. **Inventory as derived data** — inventory can always be rebuilt from operations, ensuring consistency
3. **Cloud functions for heavy logic** — inventory rebuild runs server-side to avoid miniprogram performance limits
4. **Single config document** — organizations and operators stored in one doc for simplicity; all users read the same config
5. **Shared frontend utilities** — cloud function invocation and search filtering are centralized in `utils/cloud.js` and `utils/search.js` to reduce duplicated page logic
6. **Consistent feedback UX** — common toast/modal behavior is centralized in `utils/feedback.js` to avoid repetitive per-page error handling code
