SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1
        FROM dbo.competency_assessments
        WHERE current_level > 4 OR target_level > 4
    ) OR EXISTS (
        SELECT 1
        FROM dbo.competency_assessment_history
        WHERE current_level > 4 OR target_level > 4
    )
    BEGIN
        THROW 51000, 'Competency level migration aborted: values above 4 exist.', 1;
    END;

    DECLARE @drop_sql NVARCHAR(MAX) = N'';

    SELECT @drop_sql = @drop_sql
        + N'ALTER TABLE dbo.competency_assessments DROP CONSTRAINT '
        + QUOTENAME(name) + N';'
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.competency_assessments')
      AND name IN (
          'CK_competency_assessments_current_0_5',
          'CK_competency_assessments_target_0_5',
          'CK_competency_assessments_current_0_4',
          'CK_competency_assessments_target_0_4'
      );

    SELECT @drop_sql = @drop_sql
        + N'ALTER TABLE dbo.competency_assessment_history DROP CONSTRAINT '
        + QUOTENAME(name) + N';'
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.competency_assessment_history')
      AND name IN (
          'CK_competency_history_current_0_5',
          'CK_competency_history_target_0_5',
          'CK_competency_history_current_0_4',
          'CK_competency_history_target_0_4'
      );

    IF LEN(@drop_sql) > 0
        EXEC sys.sp_executesql @drop_sql;

    ALTER TABLE dbo.competency_assessments WITH CHECK
        ADD CONSTRAINT CK_competency_assessments_current_0_4
        CHECK (current_level BETWEEN 0 AND 4);

    ALTER TABLE dbo.competency_assessments WITH CHECK
        ADD CONSTRAINT CK_competency_assessments_target_0_4
        CHECK (target_level BETWEEN 0 AND 4);

    ALTER TABLE dbo.competency_assessment_history WITH CHECK
        ADD CONSTRAINT CK_competency_history_current_0_4
        CHECK (current_level BETWEEN 0 AND 4);

    ALTER TABLE dbo.competency_assessment_history WITH CHECK
        ADD CONSTRAINT CK_competency_history_target_0_4
        CHECK (target_level BETWEEN 0 AND 4);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
