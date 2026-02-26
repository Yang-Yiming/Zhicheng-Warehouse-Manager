# Zhicheng Warehouse Manager

Enhanced miniprogram version of the [Warehouse Manager](https://github.com/Yang-Yiming/Warehouse_manager).

# Manual ([Chinese ver](#说明书))

## Users

All users are uniquely bound to a single WeChat account. Every inbound and outbound inventory operation records the operator’s identity.

### User Permissions  
(Higher-level roles inherit all permissions of lower-level roles.)

1. **Unauthorized**: Cannot view any information.  
2. **User**: Can perform inbound and outbound operations, view the user list, and view their own organization.  
3. **Admin**: Can approve *unauthorized* users to become *users*, and can edit the organization of *users*.  
4. **President**: Can promote *users* to *admins* or demote *admins* to *users*. Can transfer the *president* role to an *admin*.

## Operation Types

Operation types include **Inbound**, **Item Addition**, **Outbound**, and **Partial Outbound**.  
At the user interface level, only **Inbound** and **Outbound** are available; the system automatically routes to the appropriate operation type based on quantity.

- Click the plus icon in `Operation Records` or `Current Inventory` to perform inbound or outbound operations on any item.
- Tap an item in `Current Inventory` to directly perform inbound or outbound operations on it.

# TODO
- [ ] Fix the `max` bug.
- [ ] Add `store for others` feat.

---
Current Version: v1.0.1
Miniprogram QR-code: Haven't Published

---

# 说明书

## 用户

所有用户与微信账号单一绑定，所有入库出库操作会记录操作人信息。

### 用户权限
（高等级拥有低等级所有权限）

1. **未认证**: 无法查看任何信息
2. **普通**: 可以进行入库、出库操作，可以查看人员列表，可以查看自己所属组织
3. **管理员**: 可以批准 _未认证_ 用户为 _普通_ 用户，可以编辑 _普通_ 用户的所属组织
4. **主席**: 可以提拔 _普通_ 用户为 _管理员_ 或降级 _管理员_ 为 _普通_ 用户。可以将 _主席_ 身份转移给 _管理员_ 。

## 操作

操作类型分为 入库、物品增添、出库、部分出库。用户操作层仅 入库、出库 两个选项，根据数量自动路由到四个操作类型。

- 按 `操作记录` 和 `当前库存` 中的加号可以入库或出库任何物品。
- 点击 `当前库存` 中的物品可以直接对它入库/出库。
