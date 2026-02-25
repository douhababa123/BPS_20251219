-- ============================================================================
-- 审批工作流迁移脚本
-- 功能: 扩展 dbo.tasks 状态字段 + 新建 dbo.notifications 表
-- 执行时间: 2026-02-24
-- 执行说明: 在 SSMS 中连接 DCCT_BPS_Debug 后执行
-- ============================================================================

USE DCCT_BPS_Debug;
GO

-- ============================================================================
-- 第一步: 扩展 dbo.tasks 表
-- ============================================================================

-- 1.1 删除旧的 status CHECK 约束（约束名需匹配实际名称，先查后删）
DECLARE @constraint_name NVARCHAR(200);
SELECT @constraint_name = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.tasks')
  AND name LIKE '%status%';

IF @constraint_name IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.tasks DROP CONSTRAINT ' + @constraint_name);
    PRINT '✅ 旧 status CHECK 约束已删除: ' + @constraint_name;
END
ELSE
    PRINT '⚠️  未找到 status CHECK 约束，跳过删除';
GO

-- 1.2 新增 status CHECK 约束（包含所有状态值）
ALTER TABLE dbo.tasks
ADD CONSTRAINT chk_tasks_status CHECK (
    status IN (
        'pending',          -- 原有
        'active',           -- 原有
        'planned',          -- 原有（Schedule 模块使用）
        'in_progress',      -- 原有
        'completed',        -- 原有
        'cancelled',        -- 原有
        'pending_approval', -- 新增：等待审批
        'rejected',         -- 新增：admin 拒绝
        'confirmed',        -- 新增：工程师已确认接受
        'employee_rejected' -- 新增：工程师拒绝
    )
);
PRINT '✅ 新 status CHECK 约束已添加';
GO

-- 1.3 新增字段：拒绝原因
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.tasks') AND name = 'rejection_reason'
)
BEGIN
    ALTER TABLE dbo.tasks ADD rejection_reason NVARCHAR(500) NULL;
    PRINT '✅ 字段 rejection_reason 已添加';
END
ELSE
    PRINT '⚠️  字段 rejection_reason 已存在，跳过';
GO

-- 1.4 新增字段：申请提交人（谁提的任务申请）
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.tasks') AND name = 'requester_id'
)
BEGIN
    ALTER TABLE dbo.tasks ADD requester_id UNIQUEIDENTIFIER NULL;
    PRINT '✅ 字段 requester_id 已添加';
END
ELSE
    PRINT '⚠️  字段 requester_id 已存在，跳过';
GO

-- 1.5 新增字段：记录是谁拒绝的（区分 admin 还是 employee）
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.tasks') AND name = 'rejected_by'
)
BEGIN
    ALTER TABLE dbo.tasks ADD rejected_by NVARCHAR(20) NULL
        CONSTRAINT chk_tasks_rejected_by CHECK (rejected_by IN ('admin', 'employee') OR rejected_by IS NULL);
    PRINT '✅ 字段 rejected_by 已添加';
END
ELSE
    PRINT '⚠️  字段 rejected_by 已存在，跳过';
GO

PRINT '✅ dbo.tasks 表扩展完成';
GO

-- ============================================================================
-- 第二步: 创建 dbo.notifications 表
-- ============================================================================

IF OBJECT_ID('dbo.notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.notifications (
        id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id     UNIQUEIDENTIFIER NOT NULL,     -- 接收通知的用户（关联 dbo.users.id）
        type        NVARCHAR(50) NOT NULL           -- 通知类型
                        CONSTRAINT chk_notifications_type CHECK (type IN (
                            'task_submitted',       -- 新任务申请（通知 admin）
                            'task_approved',        -- 审批通过（通知被指派工程师）
                            'task_rejected',        -- admin 拒绝（通知申请人）
                            'task_confirmed',       -- 工程师已确认（通知申请人 + admin）
                            'task_employee_rejected'-- 工程师拒绝（通知申请人 + admin）
                        )),
        title       NVARCHAR(200) NOT NULL,
        body        NVARCHAR(500) NOT NULL,
        task_id     UNIQUEIDENTIFIER NULL,          -- 关联的任务 ID
        is_read     BIT NOT NULL DEFAULT 0,
        created_at  DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX idx_notifications_user ON dbo.notifications(user_id, is_read);
    CREATE INDEX idx_notifications_task ON dbo.notifications(task_id);
    CREATE INDEX idx_notifications_created ON dbo.notifications(created_at DESC);

    PRINT '✅ dbo.notifications 表创建完成';
END
ELSE
    PRINT '⚠️  dbo.notifications 表已存在，跳过';
GO

-- ============================================================================
-- 验证结果
-- ============================================================================

PRINT '';
PRINT '=== 验证结果 ===';

-- 查看 tasks 表新字段
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'tasks'
  AND COLUMN_NAME IN ('status', 'rejection_reason', 'requester_id', 'rejected_by')
ORDER BY ORDINAL_POSITION;

-- 查看 notifications 表结构
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'notifications'
ORDER BY ORDINAL_POSITION;
GO

PRINT '✅ 迁移完成！';
GO
