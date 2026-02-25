# Plan

Migration of the old Python Tkinter warehouse management app to a WeChat miniprogram.

## Phase 1: Project Scaffolding ✓

- [x] Initialize WeChat miniprogram project structure (`miniprogram/`, `cloudfunctions/`)
- [x] `project.config.json` with appid `your-app-id`
- [x] miniprogram-ci installed, `ci/upload.js` and `ci/preview.js` ready
- [x] Base page stubs: operations, inventory, operation-form, settings
- [x] Cloud function stubs: operationCreate, inventoryRebuild
- [ ] Set up cloud development environment (云开发) — requires WeChat DevTools, see below
- [ ] Replace `'your-env-id'` in `miniprogram/app.js` with actual env ID

## Phase 2: Data Layer

- Create cloud DB collections: `operations`, `inventory`, `config`
- Migrate data models from JSON to cloud DB schema
- Implement CRUD cloud functions for operations and inventory
- Implement inventory rebuild logic (derive inventory from operation history)

## Phase 3: Core Pages

### 3a: Operations Log Page (操作记录)
- List view of all operations, sorted by time descending
- Search bar for full-text filtering
- Column sorting by tapping headers
- Pull-down refresh

### 3b: Current Inventory Page (当前库存)
- List view of current stock per item
- Search and sort (same as operations)
- Tap item to see detail / history

### 3c: New Operation Page (新建操作)
- Form for creating inbound / outbound / add / partial-outbound operations
- Picker components for organization, operator, operation type
- Date-time picker for operation time
- Validation per REQUIREMENTS.md rules
- On submit: write operation record, update inventory, log

## Phase 4: Config Management

- Settings page for managing organizations and operators
- Add / remove operators
- Cloud-synced config so all users share the same dropdown lists

## Phase 5: Polish & Extras

- Operation audit log (monthly logs viewable in-app)
- Inventory rebuild button (admin)
- Permission / role management (if needed)
- UI refinements, loading states, error handling
- (Optional) Excel export for reporting if needed later
