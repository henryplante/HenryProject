CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_user (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT app_user_email_unique UNIQUE (email)
);

CREATE TABLE user_group (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    CONSTRAINT user_group_name_unique UNIQUE (name)
);

CREATE TABLE membership (
    user_id uuid NOT NULL REFERENCES app_user (id),
    group_id uuid NOT NULL REFERENCES user_group (id),
    PRIMARY KEY (user_id, group_id)
);

CREATE TABLE product (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    approval_lifetime_days integer NOT NULL,
    CONSTRAINT product_name_unique UNIQUE (name),
    CONSTRAINT product_approval_lifetime_days_positive CHECK (approval_lifetime_days > 0)
);

CREATE TABLE workflow_step (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES product (id),
    position integer NOT NULL,
    name text NOT NULL,
    CONSTRAINT workflow_step_product_position_unique UNIQUE (product_id, position)
);

CREATE TABLE step_requirement (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id uuid NOT NULL REFERENCES workflow_step (id),
    group_id uuid NOT NULL REFERENCES user_group (id),
    approvals_required integer NOT NULL,
    CONSTRAINT step_requirement_step_group_unique UNIQUE (step_id, group_id),
    CONSTRAINT step_requirement_approvals_required_min CHECK (approvals_required >= 1)
);

CREATE TABLE file_blob (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type text NOT NULL,
    bytes bytea NOT NULL,
    size bigint NOT NULL,
    sha256 text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE material (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES product (id),
    owner_id uuid NOT NULL REFERENCES app_user (id),
    title text NOT NULL,
    channel text NOT NULL,
    audience text NOT NULL,
    intended_use text NOT NULL,
    current_version_id uuid,
    approved_version_id uuid,
    approved_at timestamptz,
    approved_until timestamptz,
    obsolete_at timestamptz,
    expiry_notified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT material_channel_check CHECK (channel IN ('email', 'web', 'affiliate', 'social')),
    CONSTRAINT material_audience_check CHECK (audience IN ('consumer', 'partner'))
);

CREATE TABLE material_version (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id uuid NOT NULL REFERENCES material (id),
    number integer NOT NULL,
    file_id uuid NOT NULL REFERENCES file_blob (id),
    file_name text NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES app_user (id),
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    note text,
    CONSTRAINT material_version_material_number_unique UNIQUE (material_id, number)
);

ALTER TABLE material
    ADD CONSTRAINT material_current_version_id_fkey
        FOREIGN KEY (current_version_id) REFERENCES material_version (id);

ALTER TABLE material
    ADD CONSTRAINT material_approved_version_id_fkey
        FOREIGN KEY (approved_version_id) REFERENCES material_version (id);

CREATE TABLE review_cycle (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id uuid NOT NULL REFERENCES material (id),
    version_id uuid NOT NULL REFERENCES material_version (id),
    status text NOT NULL,
    current_position integer NOT NULL,
    approval_lifetime_days integer NOT NULL,
    started_by uuid NOT NULL REFERENCES app_user (id),
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    CONSTRAINT review_cycle_status_check CHECK (status IN ('active', 'abandoned', 'completed'))
);

CREATE UNIQUE INDEX review_cycle_one_active_per_material
    ON review_cycle (material_id)
    WHERE status = 'active';

CREATE TABLE cycle_step (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id uuid NOT NULL REFERENCES review_cycle (id),
    position integer NOT NULL,
    name text NOT NULL,
    opened_at timestamptz,
    completed_at timestamptz,
    CONSTRAINT cycle_step_cycle_position_unique UNIQUE (cycle_id, position)
);

CREATE TABLE cycle_requirement (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_step_id uuid NOT NULL REFERENCES cycle_step (id),
    group_id uuid NOT NULL REFERENCES user_group (id),
    group_name text NOT NULL,
    approvals_required integer NOT NULL
);

CREATE TABLE review (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id uuid NOT NULL REFERENCES review_cycle (id),
    position integer NOT NULL,
    group_id uuid NOT NULL REFERENCES user_group (id),
    user_id uuid NOT NULL REFERENCES app_user (id),
    counted boolean NOT NULL DEFAULT false,
    decided_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT review_cycle_position_group_user_unique UNIQUE (cycle_id, position, group_id, user_id)
);

CREATE TABLE comment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL REFERENCES material_version (id),
    author_id uuid NOT NULL REFERENCES app_user (id),
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id uuid NOT NULL REFERENCES material (id),
    actor_id uuid NOT NULL REFERENCES app_user (id),
    type text NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE favorite (
    user_id uuid NOT NULL REFERENCES app_user (id),
    material_id uuid NOT NULL REFERENCES material (id),
    PRIMARY KEY (user_id, material_id)
);

CREATE TABLE notification (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES app_user (id),
    material_id uuid NOT NULL REFERENCES material (id),
    actor_id uuid REFERENCES app_user (id),
    kind text NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_user_id_created_at_desc
    ON notification (user_id, created_at DESC);

CREATE VIEW material_status_v AS
SELECT
    m.id AS material_id,
    CASE
        WHEN m.obsolete_at IS NOT NULL THEN 'obsolete'
        WHEN EXISTS (
            SELECT 1
            FROM review_cycle rc
            WHERE rc.material_id = m.id
              AND rc.version_id = m.current_version_id
              AND rc.status = 'active'
        ) THEN 'in_review'
        WHEN m.current_version_id IS NOT NULL
            AND m.current_version_id = m.approved_version_id
            AND m.approved_until IS NOT NULL
            AND m.approved_until > now() THEN 'approved'
        WHEN m.current_version_id IS NOT NULL
            AND m.current_version_id = m.approved_version_id
            AND m.approved_until IS NOT NULL
            AND m.approved_until <= now() THEN 'expired'
        ELSE 'draft'
    END AS status
FROM material m;

CREATE VIEW version_status_v AS
SELECT
    mv.id AS version_id,
    mv.material_id,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM review_cycle rc
            WHERE rc.version_id = mv.id
              AND rc.status = 'completed'
        ) THEN 'approved'
        WHEN EXISTS (
            SELECT 1
            FROM review_cycle rc
            WHERE rc.version_id = mv.id
              AND rc.status = 'active'
        ) THEN 'in_review'
        ELSE 'draft'
    END AS status
FROM material_version mv;
