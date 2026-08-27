from sqlalchemy import select
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import postgresql

from database.base import Base
from models.schema import (
    AppointmentSlot,
    Benefit,
    BenefitEligibilityRule,
    Case,
    CaseEvent,
    DocumentPermission,
    Grievance,
    GrievanceAction,
    GrievanceStatus,
    HospitalStaff,
    Ngo,
    RoleName,
    RuleOperator,
    User,
)


def test_postgresql_ddl_uses_uuid_and_enums() -> None:
    users_ddl = str(CreateTable(Base.metadata.tables["users"]).compile(dialect=postgresql.dialect()))
    roles_ddl = str(CreateTable(Base.metadata.tables["roles"]).compile(dialect=postgresql.dialect()))

    assert "UUID" in users_ddl
    assert "role_name" in roles_ddl


def test_seed_users_have_expected_roles(session) -> None:
    rahul = session.scalar(select(User).where(User.email == "citizen@demo.local"))
    assert rahul is not None
    assert {role.name for role in rahul.roles} == {RoleName.citizen}


def test_seed_contains_required_benefits_and_ngos(session) -> None:
    benefits = session.scalars(select(Benefit)).all()
    ngos = session.scalars(select(Ngo)).all()

    assert len(benefits) >= 10
    assert len(ngos) >= 5
    assert all(benefit.is_mock for benefit in benefits)
    assert all(ngo.is_mock for ngo in ngos)


def test_benefit_rules_are_generic_and_evaluable(session) -> None:
    benefit = session.scalar(select(Benefit).where(Benefit.name == "Delhi Transport Concession Pass"))
    rules = session.scalars(select(BenefitEligibilityRule).where(BenefitEligibilityRule.benefit_id == benefit.id)).all()
    facts = {"state": "Delhi", "percentage_requirement_met": "true"}

    assert {rule.field_name for rule in rules} >= {"state", "percentage_requirement_met"}
    assert all(rule.operator == RuleOperator.eq for rule in rules)
    assert all(facts[rule.field_name] == rule.comparison_value for rule in rules if rule.required)


def test_case_timeline_steps_and_events(session) -> None:
    case = session.scalar(select(Case).where(Case.case_number == "CASE-2026-00184"))

    assert case is not None
    assert [step.step_order for step in case.steps] == list(range(1, 9))
    assert [step.step_name for step in case.steps][:4] == [
        "Profile",
        "Service identified",
        "Hospital identified",
        "Appointment",
    ]
    assert session.scalar(select(CaseEvent).where(CaseEvent.case_id == case.id)) is not None


def test_grievance_state_change_records_action(session) -> None:
    grievance = session.scalar(select(Grievance).where(Grievance.grievance_number == "GRV-2026-00031"))
    grievance.status = GrievanceStatus.under_review
    session.add(
        GrievanceAction(
            grievance_id=grievance.id,
            actor_user_id=None,
            action_type="status_changed",
            message="Moved grievance to review in test.",
        )
    )
    session.commit()

    actions = session.scalars(select(GrievanceAction).where(GrievanceAction.grievance_id == grievance.id)).all()
    assert grievance.status == GrievanceStatus.under_review
    assert any(action.action_type == "status_changed" for action in actions)


def test_document_permissions_support_consent(session) -> None:
    permission = session.scalar(select(DocumentPermission).where(DocumentPermission.revoked_at.is_(None)))

    assert permission is not None
    assert permission.permission_type.value == "view"
    assert permission.granted_to_user_id is not None


def test_hospital_staff_and_slots_are_scoped_to_same_hospital(session) -> None:
    staff = session.scalar(select(HospitalStaff))
    slot = session.scalar(select(AppointmentSlot))

    assert staff is not None
    assert slot is not None
    assert staff.hospital_id == slot.hospital_id
