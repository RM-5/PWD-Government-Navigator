# Disability Navigator Database

PostgreSQL + SQLAlchemy data layer for the 4-day hackathon prototype. This repository intentionally contains only the database/data layer: no frontend and no FastAPI implementation.

## Structure

- `database/` - SQLAlchemy base and session/engine helpers.
- `models/` - SQLAlchemy 2.x ORM models and controlled enum values.
- `migrations/` - Alembic environment and initial schema revision.
- `seed/` - deterministic demo seed data.
- `tests/` - relationship, seed, permission, case timeline, grievance, and rule tests.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Set the target PostgreSQL URL:

```bash
export DATABASE_URL="postgresql+psycopg://xicom@localhost:5432/disability_navigator"
```

Run migrations:

```bash
alembic upgrade head
```

Load demo data:

```bash
python -m seed.seed_demo_data
```

Run tests:

```bash
pytest
```

## Core Tables

- `users`, `roles`, `user_roles`: authentication identity and multi-role authorization.
- `citizen_profiles`: citizen demographics, language/accessibility preferences, and mock identity verification status. Aadhaar is deliberately not stored.
- `caregiver_relationships`: caregiver/representative consent relationship for managing a citizen workflow.
- `disability_profiles`: category and eligibility flags without unnecessary medical history.
- `certificates`: mock certificate metadata only; certificate numbers are explicitly mock/demo values.
- `hospitals`, `hospital_departments`, `hospital_staff`: hospital registry, assessment boards, and scoped staff assignment.
- `state_offices`, `state_representatives`: state jurisdiction and representative assignments.
- `government_services`: service registry for government processes, eligibility summaries, documents, fees, processing time, grievance/escalation authorities, and verification date.
- `cases`, `case_steps`, `case_events`: citizen journey container, ordered workflow steps, and immutable timeline.
- `appointments`, `appointment_slots`: booking records and available capacity by hospital department.
- `documents`, `document_permissions`: object-storage references plus consent-based access grants.
- `benefits`, `benefit_eligibility_rules`, `benefit_applications`: benefit catalog, generic rules, and citizen applications.
- `grievances`, `grievance_actions`, `grievance_escalations`: grievance lifecycle, messages/actions, and escalation chain.
- `ngos`, `ngo_assistance_requests`: mock NGO directory and citizen support requests.
- `notifications`: user-facing updates for the backend to deliver.
- `audit_logs`: sensitive-action timeline, especially document access.

## Design Decisions

- Primary keys use UUIDs so distributed services and seed data can create records safely.
- Status fields use PostgreSQL-compatible enums via SQLAlchemy, persisted as controlled string values.
- Timestamps are included on mutable business tables. Immutable event/action tables use `created_at`.
- Large documents are not stored in PostgreSQL. `documents.storage_reference` points to object storage such as S3, MinIO, or a future government document vault.
- Sensitive identity data is intentionally minimized. The schema has `identity_verification_status` for mock verification and no Aadhaar field.
- Benefit eligibility is generic: each rule has `field_name`, `operator`, `comparison_value`, and `required`, so backend logic can evaluate rules against citizen/disability/case facts.
- Case history is split between ordered `case_steps` for current workflow progress and append-only `case_events` for the audit-style timeline.
- Document access is explicit through `document_permissions`; the backend should check the citizen owner, active grants, validity window, and revocation state before exposing a file.
- Hospital and state access boundaries are represented in data by `hospital_staff.hospital_id`, `cases.assigned_hospital_id`, `state_representatives.state_office_id`, and `cases/grievances.assigned_state_office_id`. The backend should enforce these filters in every scoped query.

## Integrity

The schema includes:

- Foreign keys for every relationship-bearing table.
- Unique constraints for emails, role names, case/grievance/appointment numbers, hospital department names, slots, and permission grants.
- Cascades where child records should disappear with the parent, such as case steps/events and document permissions.
- Restrictive or `SET NULL` behavior where deleting a registry record should not destroy historical citizen records.
- Check constraints for appointment slot capacity, slot time order, case step order, certificate date order, and permission validity windows.
- Indexes on common lookup/scope fields such as email, state, district, case status, assigned hospital/state office, citizen IDs, and audit resources.

## Seed Data

The seed script creates deterministic demo records for:

- Users: `citizen@demo.local`, `hospital@demo.local`, `state@demo.local`, `admin@demo.local`.
- Citizen: Rahul Sharma, age 21 on 2026-08-25, Delhi/New Delhi, visual disability, certificate pending.
- Hospital: Delhi Government Hospital with Ophthalmology / Disability Medical Board and mock API booking.
- State office: State Representative Office and a mock representative.
- Government service: Disability Certificate and UDID Support.
- Benefits: 10 mock disability-related schemes, each marked `is_mock=true`.
- NGOs: 5 mock disability-support organizations, each marked `is_mock=true`.
- Appointment slots: 10 slots across five dates for the demo board.
- Case: Rahul's initial disability certificate case `CASE-2026-00184`.
- Grievance: sample acknowledged grievance `GRV-2026-00031`.
- Documents: metadata and storage reference for one mock address-proof document plus hospital view consent.

## Backend Notes

FastAPI can import `database.get_engine`, `database.get_session_factory`, and the ORM classes from `models.schema`. The backend should keep authorization checks outside the ORM layer, using the scoped IDs in this schema:

- Citizen document access: `documents.citizen_id == current_citizen.id` or active grant in `document_permissions`.
- Hospital access: `hospital_staff.hospital_id == cases.assigned_hospital_id`.
- State access: `state_representatives.state_office_id == grievances.assigned_state_office_id` or `cases.assigned_state_office_id`.
- Audit logging: write `audit_logs` rows for document view/download, case status changes, grievance actions, and admin changes.
