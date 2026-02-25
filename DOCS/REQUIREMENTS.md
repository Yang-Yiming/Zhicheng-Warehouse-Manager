# Requirements

Based on the old Python desktop application (Tkinter) for SUSTech Zhicheng Academy warehouse management.

## Background

The old workflow was: when putting items into the warehouse, people filled out a questionnaire (问卷). The maintainer then exported the responses as xlsx and imported them into the desktop program to view/manage inventory. This was messy and error-prone.

The miniprogram replaces this entire flow — users enter operations directly in the app, data syncs to cloud backend in real time. No more questionnaires, no more Excel round-trips.

## Core Domain

A warehouse inventory management system that tracks physical goods — inbound, outbound, quantity changes — and maintains a real-time inventory snapshot. All data stored in cloud, accessible by all authorized users.

## Functional Requirements

### F1: Inventory Operations

Four operation types:

| Operation | Chinese | Description |
|-----------|---------|-------------|
| Inbound | 入库 | Add a new item to the warehouse |
| Outbound (full) | 出库 | Remove an item entirely |
| Add quantity | 物资增添 | Increase quantity of an existing item |
| Partial outbound | 部分出库 | Decrease quantity of an existing item |

Each operation records:
- 提交时间 (Submission timestamp) — auto-generated
- 物资编号 (Item ID) — location-based code, e.g. "A1-3-05"
- 物品名称 (Item name)
- 物资操作 (Operation type)
- 所属组织 (Organization)
- 物品数量 (Quantity)
- 时间 (Operation datetime, YYYY-MM-DD HH:MM)
- 操作人 (Operator)
- 提交者 (Submitter)

### F2: Current Inventory View

A derived view showing real-time stock status per item:
- 物资编号 (Item ID)
- 物品名称 (Item name)
- 所属组织 (Organization)
- 物品数量 (Current quantity)
- 最后操作 (Last operation type)
- 最后操作人 (Last operator)
- 最后操作时间 (Last operation time)
- 备注 (Notes/remarks)

Inventory is computed from the full operation history. Items with quantity ≤ 0 are removed.

### F3: Search

Full-text search across all visible fields. Filters the current view (operations or inventory) in real time.

### F4: Sorting

Click any column header to sort ascending/descending.

### F5: Excel Import / Export (low priority, optional)

The old project relied heavily on Excel because data was local. With cloud storage, this is no longer part of the core workflow. May be added later as a convenience for bulk data migration or reporting.

### F6: Operation Logging

Monthly text log files for audit trail.

### F7: Inventory Rebuild

Recompute the entire inventory from the operation history to ensure consistency.

## Validation Rules

- Item ID is required; duplicates rejected on inbound
- Quantity must be a positive integer
- Datetime must match `YYYY-MM-DD HH:MM`
- Operator and submitter are required
- Partial outbound cannot exceed current quantity

## Configuration

### Organizations (所属组织)

9 predefined organizations:
1. 学生会
2. 团委
3. 学生发展中心
4. 社区管理委员会
5. "橙光"志愿服务队
6. 足球队器材存放
7. 篮球队器材存放
8. 其他体育器材存放
9. 备用储物箱

### Operators (操作人)

A configurable list of staff/volunteer names, selectable via dropdown.

## Data Storage (old project)

- `warehouse_data.json` — operation history
- `inventory_data.json` — current inventory snapshot
- `config.json` — organizations and operators

## Out of Scope for Miniprogram

- Name badge / name card generator (`namecard/`) — separate utility, not part of core warehouse management
- Excel import/export as primary workflow — replaced by direct cloud data entry
