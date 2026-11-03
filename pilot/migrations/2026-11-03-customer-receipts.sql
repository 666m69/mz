-- MZcode optional customer receipt delivery status.
-- Apply additively to the existing D1 database before deploying a Worker using these columns.
-- Existing ideas and administrative notification statuses are not modified.
ALTER TABLE idea_requests ADD COLUMN receipt_email_status TEXT NOT NULL DEFAULT 'pending_setup';
ALTER TABLE idea_requests ADD COLUMN receipt_email_provider_id TEXT;
ALTER TABLE idea_requests ADD COLUMN receipt_email_error TEXT;
