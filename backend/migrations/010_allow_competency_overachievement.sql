SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.competency_assessments') AND name = 'CK_competency_assessments_target_gte_current')
        ALTER TABLE dbo.competency_assessments DROP CONSTRAINT CK_competency_assessments_target_gte_current;
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.competency_assessment_history') AND name = 'CK_competency_history_target_gte_current')
        ALTER TABLE dbo.competency_assessment_history DROP CONSTRAINT CK_competency_history_target_gte_current;
    -- Original current/target values and append-only history remain unchanged.
    -- Business GAP is clamped per skill at API/aggregation boundaries.
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
