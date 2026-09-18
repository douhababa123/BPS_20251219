/*
 * Preserve the before/after values for each competency change.
 * Existing history rows remain unchanged; their previous values stay NULL.
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.competency_assessment_history', 'previous_current_level') IS NULL
        ALTER TABLE dbo.competency_assessment_history
            ADD previous_current_level INT NULL;

    IF COL_LENGTH('dbo.competency_assessment_history', 'previous_target_level') IS NULL
        ALTER TABLE dbo.competency_assessment_history
            ADD previous_target_level INT NULL;

    IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.competency_assessment_history')
          AND name = 'CK_competency_history_previous_current_0_4'
    )
        EXEC sp_executesql N'
            ALTER TABLE dbo.competency_assessment_history WITH CHECK
                ADD CONSTRAINT CK_competency_history_previous_current_0_4
                CHECK (previous_current_level IS NULL OR previous_current_level BETWEEN 0 AND 4);';

    IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.competency_assessment_history')
          AND name = 'CK_competency_history_previous_target_0_4'
    )
        EXEC sp_executesql N'
            ALTER TABLE dbo.competency_assessment_history WITH CHECK
                ADD CONSTRAINT CK_competency_history_previous_target_0_4
                CHECK (previous_target_level IS NULL OR previous_target_level BETWEEN 0 AND 4);';

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
