/*
 * Competency assessment latest projection and append-only quarterly history.
 * Safe to rerun: baseline rows are keyed by source_assessment_id.
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @legacy_count BIGINT = (
        SELECT COUNT_BIG(*) FROM dbo.competency_assessments
    );

    IF OBJECT_ID('dbo.competency_assessment_history', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.competency_assessment_history (
            id UNIQUEIDENTIFIER NOT NULL
                CONSTRAINT PK_competency_assessment_history PRIMARY KEY
                CONSTRAINT DF_competency_assessment_history_id DEFAULT NEWID(),
            assessment_id UNIQUEIDENTIFIER NOT NULL,
            source_assessment_id UNIQUEIDENTIFIER NULL,
            employee_id UNIQUEIDENTIFIER NOT NULL,
            skill_id BIGINT NOT NULL,
            current_level INT NOT NULL,
            target_level INT NOT NULL,
            gap AS (target_level - current_level) PERSISTED,
            assessment_date DATETIME2 NOT NULL,
            assessment_year INT NOT NULL,
            assessment_quarter TINYINT NOT NULL,
            notes NVARCHAR(MAX) NULL,
            changed_at DATETIME2 NOT NULL,
            changed_by_user_id UNIQUEIDENTIFIER NULL,
            change_source NVARCHAR(32) NOT NULL,
            CONSTRAINT CK_competency_history_current_0_5
                CHECK (current_level BETWEEN 0 AND 5),
            CONSTRAINT CK_competency_history_target_0_5
                CHECK (target_level BETWEEN 0 AND 5),
            CONSTRAINT CK_competency_history_target_gte_current
                CHECK (change_source = 'MIGRATION_BASELINE' OR target_level >= current_level),
            CONSTRAINT CK_competency_history_quarter
                CHECK (assessment_quarter BETWEEN 1 AND 4),
            CONSTRAINT CK_competency_history_source
                CHECK (change_source IN ('MIGRATION_BASELINE', 'WEB_EDIT'))
        );
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.competency_assessment_history')
          AND name = 'UX_competency_history_source_assessment'
    )
        CREATE UNIQUE INDEX UX_competency_history_source_assessment
            ON dbo.competency_assessment_history(source_assessment_id)
            WHERE source_assessment_id IS NOT NULL;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.competency_assessment_history')
          AND name = 'IX_competency_history_employee_skill_changed'
    )
        CREATE INDEX IX_competency_history_employee_skill_changed
            ON dbo.competency_assessment_history(employee_id, skill_id, changed_at DESC);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.competency_assessment_history')
          AND name = 'IX_competency_history_year_quarter'
    )
        CREATE INDEX IX_competency_history_year_quarter
            ON dbo.competency_assessment_history(
                assessment_year,
                assessment_quarter,
                changed_at DESC
            );

    IF EXISTS (
        SELECT 1
        FROM dbo.competency_assessments
        WHERE current_level NOT BETWEEN 0 AND 5
           OR target_level NOT BETWEEN 0 AND 5
    )
        THROW 51000, 'Legacy competency levels outside 0-5 require manual correction', 1;

    SELECT
        ca.id AS source_assessment_id,
        ca.employee_id,
        ca.skill_id,
        ca.current_level,
        ca.target_level,
        ca.assessment_date,
        ca.assessment_year,
        ca.notes,
        ca.created_at,
        ca.updated_at,
        FIRST_VALUE(ca.id) OVER (
            PARTITION BY ca.employee_id, ca.skill_id
            ORDER BY
                ca.assessment_date DESC,
                ca.updated_at DESC,
                ca.created_at DESC,
                ca.id DESC
        ) AS retained_assessment_id,
        ROW_NUMBER() OVER (
            PARTITION BY ca.employee_id, ca.skill_id
            ORDER BY
                ca.assessment_date DESC,
                ca.updated_at DESC,
                ca.created_at DESC,
                ca.id DESC
        ) AS rn
    INTO #ranked_assessments
    FROM dbo.competency_assessments ca;

    INSERT INTO dbo.competency_assessment_history (
        assessment_id,
        source_assessment_id,
        employee_id,
        skill_id,
        current_level,
        target_level,
        assessment_date,
        assessment_year,
        assessment_quarter,
        notes,
        changed_at,
        changed_by_user_id,
        change_source
    )
    SELECT
        r.retained_assessment_id,
        r.source_assessment_id,
        r.employee_id,
        r.skill_id,
        r.current_level,
        r.target_level,
        COALESCE(
            CAST(r.assessment_date AS DATETIME2),
            r.updated_at,
            r.created_at,
            GETDATE()
        ),
        YEAR(COALESCE(
            CAST(r.assessment_date AS DATETIME2),
            r.updated_at,
            r.created_at,
            GETDATE()
        )),
        DATEPART(QUARTER, COALESCE(
            CAST(r.assessment_date AS DATETIME2),
            r.updated_at,
            r.created_at,
            GETDATE()
        )),
        r.notes,
        COALESCE(
            r.updated_at,
            CAST(r.assessment_date AS DATETIME2),
            r.created_at,
            GETDATE()
        ),
        NULL,
        'MIGRATION_BASELINE'
    FROM #ranked_assessments r
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.competency_assessment_history h
        WHERE h.source_assessment_id = r.source_assessment_id
    );

    DECLARE @baseline_count BIGINT = (
        SELECT COUNT_BIG(*)
        FROM dbo.competency_assessment_history
        WHERE change_source = 'MIGRATION_BASELINE'
    );

    IF @baseline_count < @legacy_count
        THROW 51001, 'History baseline count is lower than legacy assessment count', 1;

    DELETE ca
    FROM dbo.competency_assessments ca
    INNER JOIN #ranked_assessments r
        ON r.source_assessment_id = ca.id
    WHERE r.rn > 1;

    /* Preserve the original negative GAP in history, normalize only the latest projection. */
    UPDATE dbo.competency_assessments
    SET target_level = current_level,
        updated_at = GETDATE()
    WHERE target_level < current_level;

    IF COL_LENGTH('dbo.competency_assessments', 'gap') IS NOT NULL
       AND COLUMNPROPERTY(
            OBJECT_ID('dbo.competency_assessments'),
            'gap',
            'IsComputed'
       ) = 0
    BEGIN
        EXEC sp_executesql N'
            UPDATE dbo.competency_assessments
            SET gap = target_level - current_level;
        ';
    END;

    DECLARE @constraint_name SYSNAME;
    DECLARE @drop_constraint_sql NVARCHAR(MAX);
    DECLARE constraint_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT cc.name
        FROM sys.check_constraints cc
        WHERE cc.parent_object_id = OBJECT_ID('dbo.competency_assessments')
          AND (
              cc.definition LIKE '%current_level%'
              OR cc.definition LIKE '%target_level%'
          );

    OPEN constraint_cursor;
    FETCH NEXT FROM constraint_cursor INTO @constraint_name;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @drop_constraint_sql =
            N'ALTER TABLE dbo.competency_assessments DROP CONSTRAINT '
            + QUOTENAME(@constraint_name);
        EXEC sp_executesql @drop_constraint_sql;
        FETCH NEXT FROM constraint_cursor INTO @constraint_name;
    END;
    CLOSE constraint_cursor;
    DEALLOCATE constraint_cursor;

    IF EXISTS (
        SELECT 1
        FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.competency_assessments')
          AND name = 'uq_assessments_emp_skill_year'
    )
        ALTER TABLE dbo.competency_assessments
            DROP CONSTRAINT uq_assessments_emp_skill_year;

    IF NOT EXISTS (
        SELECT 1 FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.competency_assessments')
          AND name = 'UQ_competency_assessments_employee_skill'
    )
        ALTER TABLE dbo.competency_assessments
            ADD CONSTRAINT UQ_competency_assessments_employee_skill
            UNIQUE(employee_id, skill_id);

    IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = 'CK_competency_assessments_current_0_5'
    )
        ALTER TABLE dbo.competency_assessments
            ADD CONSTRAINT CK_competency_assessments_current_0_5
            CHECK (current_level BETWEEN 0 AND 5);

    IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = 'CK_competency_assessments_target_0_5'
    )
        ALTER TABLE dbo.competency_assessments
            ADD CONSTRAINT CK_competency_assessments_target_0_5
            CHECK (target_level BETWEEN 0 AND 5);

    IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = 'CK_competency_assessments_target_gte_current'
    )
        ALTER TABLE dbo.competency_assessments
            ADD CONSTRAINT CK_competency_assessments_target_gte_current
            CHECK (target_level >= current_level);

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = 'FK_competency_history_assessment'
    )
        ALTER TABLE dbo.competency_assessment_history
            ADD CONSTRAINT FK_competency_history_assessment
            FOREIGN KEY (assessment_id)
            REFERENCES dbo.competency_assessments(id);

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = 'FK_competency_history_employee'
    )
        ALTER TABLE dbo.competency_assessment_history
            ADD CONSTRAINT FK_competency_history_employee
            FOREIGN KEY (employee_id)
            REFERENCES dbo.employees(id);

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = 'FK_competency_history_skill'
    )
        ALTER TABLE dbo.competency_assessment_history
            ADD CONSTRAINT FK_competency_history_skill
            FOREIGN KEY (skill_id)
            REFERENCES dbo.skills(id);

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = 'FK_competency_history_user'
    )
        ALTER TABLE dbo.competency_assessment_history
            ADD CONSTRAINT FK_competency_history_user
            FOREIGN KEY (changed_by_user_id)
            REFERENCES dbo.users(id);

    IF EXISTS (
        SELECT 1
        FROM dbo.competency_assessments
        GROUP BY employee_id, skill_id
        HAVING COUNT_BIG(*) > 1
    )
        THROW 51002, 'Duplicate current assessment projections remain', 1;

    IF EXISTS (
        SELECT 1
        FROM dbo.competency_assessments
        WHERE current_level NOT BETWEEN 0 AND 5
           OR target_level NOT BETWEEN 0 AND 5
           OR target_level < current_level
    )
        THROW 51003, 'Current assessment validation failed', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
