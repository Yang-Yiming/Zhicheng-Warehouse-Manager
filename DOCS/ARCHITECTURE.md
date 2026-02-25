# Architecture

WeChat miniprogram architecture for the Warehouse Manager.

## Tech Stack

- **Frontend**: WeChat miniprogram (WXML + WXSS + JS)
- **Backend**: WeChat cloud development (云开发)
- **Database**: Cloud DB (NoSQL, document-based)
- **Cloud functions**: Node.js serverless functions
- **CI/Tooling**: miniprogram-ci (preferred over WeChat DevTools GUI for upload/preview/build)

## Project Structure

```
├── miniprogram/
│   ├── app.js / app.json / app.wxss      # App entry
│   ├── pages/
│   │   ├── operations/                    # Operations log list
│   │   ├── inventory/                     # Current inventory list
│   │   ├── operation-form/                # New operation form
│   │   └── settings/                      # Config management
│   ├── components/
│   │   ├── search-bar/                    # Reusable search
│   │   └── sortable-list/                 # Sortable list view
│   └── utils/
│       ├── db.js                          # Cloud DB helpers
│       └── validation.js                  # Input validation
├── cloudfunctions/
│   ├── operationCreate/                   # Create operation + update inventory
│   └── inventoryRebuild/                  # Rebuild inventory from history
└── DOCS/
```

## Database Collections

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
  "submitter": "李四"
}
```

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

## Data Flow

### Creating an Operation
```
User fills form → validate on client → call cloud function operationCreate
  → write to `operations` collection
  → update `inventory` collection (add/remove/modify)
  → return success/failure
```

### Inventory Rebuild
```
Admin triggers rebuild → cloud function inventoryRebuild
  → read all `operations` sorted by time
  → replay operations sequentially to compute current state
  → replace entire `inventory` collection
```

## Key Design Decisions

1. **Cloud DB over local storage** — multi-user access, data persistence, no sync issues. Replaces the old questionnaire → xlsx → desktop app workflow entirely.
2. **Inventory as derived data** — inventory can always be rebuilt from operations, ensuring consistency
3. **Cloud functions for heavy logic** — inventory rebuild runs server-side to avoid miniprogram performance limits
4. **Single config document** — organizations and operators stored in one doc for simplicity; all users read the same config
