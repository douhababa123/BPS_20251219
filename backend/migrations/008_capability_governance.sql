/*
 * Business versions and immutable annual competency baselines.
 * Safe to rerun. This migration only adds schema objects and never rewrites
 * assessment, history, employee, account, owner or task business rows.
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.competency_assessment_versions', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.competency_assessment_versions (
            id UNIQUEIDENTIFIER NOT NULL
                CONSTRAINT PK_competency_assessment_versions PRIMARY KEY
                CONSTRAINT DF_competency_assessment_versions_id DEFAULT NEWID(),
            created_by_user_id UNIQUEIDENTIFIER NULL,
            created_at DATETIME2 NOT NULL
                CONSTRAINT DF_competency_assessment_versions_created_at DEFAULT GETDATE(),
            cell_count INT NOT NULL,
            source NVARCHAR(32) NOT NULL,
            notes NVARCHAR(2000) NULL,
            CONSTRAINT CK_competency_assessment_versions_cell_count CHECK (cell_count > 0),
            CONSTRAINT CK_competency_assessment_versions_source CHECK (source = 'WEB_BATCH_SAVE')
        );
    END;

    IF COL_LENGTH('dbo.competency_assessment_history', 'version_id') IS NULL
        ALTER TABLE dbo.competency_assessment_history ADD version_id UNIQUEIDENTIFIER NULL;

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID('dbo.competency_assessment_versions')
          AND name = 'FK_competency_assessment_version_user'
    )
        ALTER TABLE dbo.competency_assessment_versions
            ADD CONSTRAINT FK_competency_assessment_version_user
            FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(id);

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID('dbo.competency_assessment_history')
          AND name = 'FK_competency_history_version'
    )
        EXEC sp_executesql N'
            ALTER TABLE dbo.competency_assessment_history
                ADD CONSTRAINT FK_competency_history_version
                FOREIGN KEY (version_id) REFERENCES dbo.competency_assessment_versions(id);';

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.competency_assessment_history')
          AND name = 'IX_competency_history_version'
    )
        EXEC sp_executesql N'
            CREATE INDEX IX_competency_history_version
                ON dbo.competency_assessment_history(version_id)
                WHERE version_id IS NOT NULL;';

    DECLARE @history_source_constraint SYSNAME;
    SELECT TOP 1 @history_source_constraint = name
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.competency_assessment_history')
      AND definition LIKE '%change_source%'
      AND definition LIKE '%WEB_EDIT%';

    IF @history_source_constraint IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM sys.check_constraints
           WHERE parent_object_id = OBJECT_ID('dbo.competency_assessment_history')
             AND name = @history_source_constraint
             AND definition LIKE '%WEB_BATCH_SAVE%'
    )
    BEGIN
        DECLARE @drop_history_source_constraint_sql NVARCHAR(MAX);
        SET @drop_history_source_constraint_sql =
            N'ALTER TABLE dbo.competency_assessment_history DROP CONSTRAINT '
            + QUOTENAME(@history_source_constraint);
        EXEC sp_executesql @drop_history_source_constraint_sql;
        SET @history_source_constraint = NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.competency_assessment_history')
          AND definition LIKE '%WEB_BATCH_SAVE%'
    )
        ALTER TABLE dbo.competency_assessment_history WITH CHECK
            ADD CONSTRAINT CK_competency_history_source_v2
            CHECK (change_source IN ('MIGRATION_BASELINE', 'WEB_EDIT', 'WEB_BATCH_SAVE'));

    IF OBJECT_ID('dbo.competency_annual_baselines', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.competency_annual_baselines (
            id UNIQUEIDENTIFIER NOT NULL
                CONSTRAINT PK_competency_annual_baselines PRIMARY KEY
                CONSTRAINT DF_competency_annual_baselines_id DEFAULT NEWID(),
            baseline_year INT NOT NULL,
            source NVARCHAR(32) NOT NULL,
            source_filename NVARCHAR(260) NULL,
            source_version_id UNIQUEIDENTIFIER NULL,
            file_sha256 CHAR(64) NULL,
            is_active BIT NOT NULL
                CONSTRAINT DF_competency_annual_baselines_active DEFAULT 1,
            selected_by_user_id UNIQUEIDENTIFIER NULL,
            selected_at DATETIME2 NOT NULL
                CONSTRAINT DF_competency_annual_baselines_selected_at DEFAULT GETDATE(),
            CONSTRAINT CK_competency_annual_baselines_year CHECK (baseline_year BETWEEN 2000 AND 2100),
            CONSTRAINT CK_competency_annual_baselines_source CHECK (source IN ('EXCEL_IMPORT', 'SAVED_VERSION'))
        );
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID('dbo.competency_annual_baselines')
          AND name = 'FK_competency_annual_baseline_source_version'
    )
        ALTER TABLE dbo.competency_annual_baselines
            ADD CONSTRAINT FK_competency_annual_baseline_source_version
            FOREIGN KEY (source_version_id) REFERENCES dbo.competency_assessment_versions(id);

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID('dbo.competency_annual_baselines')
          AND name = 'FK_competency_annual_baseline_user'
    )
        ALTER TABLE dbo.competency_annual_baselines
            ADD CONSTRAINT FK_competency_annual_baseline_user
            FOREIGN KEY (selected_by_user_id) REFERENCES dbo.users(id);

    IF OBJECT_ID('dbo.competency_annual_baseline_items', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.competency_annual_baseline_items (
            id UNIQUEIDENTIFIER NOT NULL
                CONSTRAINT PK_competency_annual_baseline_items PRIMARY KEY
                CONSTRAINT DF_competency_annual_baseline_items_id DEFAULT NEWID(),
            baseline_id UNIQUEIDENTIFIER NOT NULL,
            employee_id UNIQUEIDENTIFIER NOT NULL,
            skill_id BIGINT NOT NULL,
            initial_current_level INT NOT NULL,
            annual_target_level INT NOT NULL,
            CONSTRAINT UQ_competency_annual_baseline_cell UNIQUE (baseline_id, employee_id, skill_id),
            CONSTRAINT CK_competency_annual_baseline_current CHECK (initial_current_level BETWEEN 0 AND 4),
            CONSTRAINT CK_competency_annual_baseline_target CHECK (annual_target_level BETWEEN 0 AND 4),
            CONSTRAINT CK_competency_annual_baseline_target_gte_current
                CHECK (annual_target_level >= initial_current_level),
            CONSTRAINT FK_competency_annual_baseline_item_header
                FOREIGN KEY (baseline_id) REFERENCES dbo.competency_annual_baselines(id),
            CONSTRAINT FK_competency_annual_baseline_item_employee
                FOREIGN KEY (employee_id) REFERENCES dbo.employees(id),
            CONSTRAINT FK_competency_annual_baseline_item_skill
                FOREIGN KEY (skill_id) REFERENCES dbo.skills(id)
        );
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.competency_annual_baselines')
          AND name = 'UX_competency_annual_baselines_active_year'
    )
        CREATE UNIQUE INDEX UX_competency_annual_baselines_active_year
            ON dbo.competency_annual_baselines(baseline_year)
            WHERE is_active = 1;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.competency_annual_baseline_items')
          AND name = 'IX_competency_annual_baseline_items_scope'
    )
        CREATE INDEX IX_competency_annual_baseline_items_scope
            ON dbo.competency_annual_baseline_items(baseline_id, skill_id, employee_id);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
