-- Commands no longer go through admin review: every command is approved when it is created or imported.
-- HIGH-risk commands still require approval each time they run. Approve everything that was waiting for review.
UPDATE command_definitions
SET status = 'APPROVED', approved_at = COALESCE(approved_at, now()), approved_by = COALESCE(approved_by, created_by)
WHERE status = 'PENDING';
