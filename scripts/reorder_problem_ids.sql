/*
 * Database Migration Script: Reorder Problem IDs
 *
 * This script renumbers all existing problems starting from 1 to N sequentially,
 * while maintaining referential integrity for submissions and battles.
 *
 * Usage: psql -d codeclash -f scripts/reorder_problem_ids.sql
 */

BEGIN;

-- 1. Create a temporary mapping table to store OLD -> NEW ID relationships
CREATE TEMP TABLE problem_id_mapping AS
SELECT id AS old_id, row_number() OVER (ORDER BY id) AS new_id
FROM problems;

-- 2. Update referencing tables first (Foreign Keys)
-- Note: PostgreSQL supports updating join-table-style updates via FROM clause

RAISE NOTICE 'Updating submissions...';
UPDATE submissions s
SET problem_id = m.new_id
FROM problem_id_mapping m
WHERE s.problem_id = m.old_id;

RAISE NOTICE 'Updating battles...';
UPDATE battles b
SET problem_id = m.new_id
FROM problem_id_mapping m
WHERE b.problem_id = m.old_id;

-- 3. Update the problems table itself
-- We must move IDs to a temporary high range to avoid conflicts during the update
RAISE NOTICE 'Updating problem IDs...';
UPDATE problems p
SET id = m.new_id + 1000000 -- Temporary large offset
FROM problem_id_mapping m
WHERE p.id = m.old_id;

-- Normalize IDs back to the sequential range [1, N]
UPDATE problems p
SET id = id - 1000000
WHERE id > 1000000;

-- 4. Reset the database sequence so that new insertions start from N + 1
-- The sequence name is typically [table_name]_[column_name]_seq
SELECT setval('problems_id_seq', (SELECT MAX(new_id) FROM problem_id_mapping), true);

COMMIT;

ANALYZE problems;
ANALYZE submissions;
ANALYZE battles;

SELECT 'Migration complete. New sequential problem IDs established.' AS status;
