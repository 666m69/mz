-- QA staging gateway only. Explicitly recorded agreement is mandatory for each delivered application.
-- Never infer a contract from an idea submission, customer email verification or linked build.
CREATE TABLE IF NOT EXISTS cv_delivery_agreements (
 idea_id TEXT PRIMARY KEY REFERENCES cv_deliveries(idea_id),
 agreement_sha256 TEXT NOT NULL CHECK(length(agreement_sha256)=64),
 approved_at INTEGER NOT NULL CHECK(approved_at>0)
);
CREATE TRIGGER IF NOT EXISTS cv_agreement_immutable BEFORE UPDATE ON cv_delivery_agreements
BEGIN SELECT RAISE(ABORT,'agreement_immutable'); END;
CREATE TRIGGER IF NOT EXISTS cv_agreement_no_delete BEFORE DELETE ON cv_delivery_agreements
BEGIN SELECT RAISE(ABORT,'agreement_immutable'); END;
