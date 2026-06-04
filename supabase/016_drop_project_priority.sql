-- 016: Drop the project priority field.
-- Priority has been removed from the product (all views, filters, and the
-- data model). This drops the column and its index added in 015.

DROP INDEX IF EXISTS idx_projects_priority;

ALTER TABLE projects
  DROP COLUMN IF EXISTS priority;
