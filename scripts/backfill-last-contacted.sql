-- Backfill last_contacted_at on crm_contacts from crm_activities
-- Safe to re-run: only updates contacts where an activity exists and
-- the stored value is either NULL or older than the latest activity.

UPDATE crm_contacts
SET last_contacted_at = sub.latest
FROM (
  SELECT entity_id, MAX(created_at) AS latest
  FROM crm_activities
  WHERE entity_type = 'contact'
  GROUP BY entity_id
) sub
WHERE crm_contacts.id = sub.entity_id
  AND (crm_contacts.last_contacted_at IS NULL
       OR crm_contacts.last_contacted_at < sub.latest);
