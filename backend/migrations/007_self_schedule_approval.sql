/*
 * Reclassify self-entered schedules that were incorrectly forced into approval.
 * Safe to rerun: only pending self-assigned rows are updated.
 */

SET NOCOUNT ON;

UPDATE t
SET
    t.status = 'planned',
    t.updated_at = GETDATE()
FROM dbo.tasks t
INNER JOIN dbo.employees e
    ON e.id = t.assigned_employee_id
LEFT JOIN dbo.users u
    ON u.id = t.requester_id
WHERE t.status = 'pending_approval'
  AND t.assigned_employee_id IS NOT NULL
  AND t.requester_id IS NOT NULL
  AND (
      e.auth_user_id = t.requester_id
      OR (
          e.email IS NOT NULL
          AND u.email IS NOT NULL
          AND LOWER(e.email) = LOWER(u.email)
      )
  );

PRINT CONCAT('Self-entered schedules moved to planned: ', @@ROWCOUNT);
