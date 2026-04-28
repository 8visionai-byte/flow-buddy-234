UPDATE tasks
SET status = 'todo',
    assigned_at = COALESCE(assigned_at, now())
WHERE title = 'Ustaw termin planu zdjęciowego'
  AND status = 'locked'
  AND project_id IN (
    SELECT t6.project_id
    FROM tasks t5
    JOIN tasks t6 ON t6.project_id = t5.project_id AND t6."order" = 6
    WHERE t5."order" = 5 AND t5.status = 'done'
      AND t6.status IN ('todo', 'done', 'pending_client_approval', 'needs_influencer_revision')
  );