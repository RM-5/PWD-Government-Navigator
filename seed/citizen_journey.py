from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from models.schema import (
    Appointment,
    AppointmentStatus,
    BenefitApplication,
    BenefitApplicationStatus,
    Case,
    CaseEvent,
    CaseStatus,
    CaseStep,
    CitizenProfile,
    NgoAssistanceRequest,
    StepStatus,
    User,
)

DEMO_CITIZEN_EMAIL = "citizen@demo.local"
DEMO_CASE_NUMBER = "CASE-2026-00184"

CASE_STEP_DEFINITIONS = [
    ("Profile", "Confirm citizen profile", "Platform"),
    ("Service identified", "Review matched service", "Platform"),
    ("Hospital identified", "Select assessment board", "Platform"),
    ("Appointment", "Book medical board appointment", "Hospital"),
    ("Medical assessment", "Attend assessment", "Hospital"),
    ("Certificate", "Await certificate decision", "Hospital"),
    ("Benefits", "Discover eligible benefits", "Platform"),
    ("Pensions", "Apply for disability pension", "Platform"),
]

DEMO_PROGRESS_STEPS = [
    ("Profile", StepStatus.completed, "Citizen profile verified", "Platform"),
    ("Service identified", StepStatus.completed, "Disability certificate service matched", "Platform"),
    ("Hospital identified", StepStatus.completed, "Delhi Government Hospital selected", "Platform"),
    ("Appointment", StepStatus.in_progress, "Attend assessment appointment", "Hospital"),
    ("Medical assessment", StepStatus.not_started, "Medical board assessment pending", "Hospital"),
    ("Certificate", StepStatus.not_started, "Certificate decision pending", "Hospital"),
    ("Benefits", StepStatus.not_started, "Discover eligible schemes after certificate update", "Platform"),
    ("Pensions", StepStatus.not_started, "Apply for disability pension after certificate", "Platform"),
]

RESET_PROGRESS_STEPS = [
    ("Profile", StepStatus.completed, "Citizen profile verified", "Platform"),
    ("Service identified", StepStatus.not_started, "Find and select a government service", "Platform"),
    ("Hospital identified", StepStatus.not_started, "Locate an accessible hospital", "Platform"),
    ("Appointment", StepStatus.not_started, "Book medical board appointment", "Hospital"),
    ("Medical assessment", StepStatus.not_started, "Attend assessment", "Hospital"),
    ("Certificate", StepStatus.not_started, "Await certificate decision", "Hospital"),
    ("Benefits", StepStatus.not_started, "Discover eligible benefits", "Platform"),
    ("Pensions", StepStatus.not_started, "Apply for disability pension", "Platform"),
]

WORKFLOW_DISPLAY = [
    {"key": "profile", "title": "Register & Profile", "description": "Create your citizen profile and verify identity (demo mode — no real Aadhaar required).", "step_names": ["Profile"]},
    {"key": "services", "title": "Find Services", "description": "Browse government services for disability certification, benefits, and UDID.", "step_names": ["Service identified"]},
    {"key": "assessment", "title": "Book Assessment", "description": "Locate an accessible hospital and book a medical board appointment.", "step_names": ["Hospital identified", "Appointment"]},
    {"key": "certificate", "title": "Track Certificate", "description": "Monitor your disability certificate and UDID issuance journey.", "step_names": ["Medical assessment", "Certificate"]},
    {"key": "benefits", "title": "Apply for Benefits", "description": "Check eligibility and apply for state benefits like transport concession.", "step_names": ["Benefits"]},
    {"key": "support", "title": "Get Support", "description": "Connect with NGOs for document help, legal awareness, and grievance support.", "step_names": []},
    {"key": "pensions", "title": "Pensions", "description": "Apply for disability pension assistance after your certificate is issued.", "step_names": ["Pensions"]},
]


def build_case_steps(case_id, step_rows: list[tuple[str, StepStatus, str, str]]) -> list[CaseStep]:
    return [
        CaseStep(
            case_id=case_id,
            step_name=name,
            step_order=order,
            status=status,
            completed_at=datetime.now(timezone.utc) if status == StepStatus.completed else None,
            next_action=next_action,
            responsible_authority=authority,
        )
        for order, (name, status, next_action, authority) in enumerate(step_rows, start=1)
    ]


def get_demo_citizen_case(session: Session) -> tuple[CitizenProfile, Case] | None:
    user = session.scalar(select(User).where(User.email == DEMO_CITIZEN_EMAIL))
    if user is None:
        return None
    citizen = session.scalar(select(CitizenProfile).where(CitizenProfile.user_id == user.id))
    if citizen is None:
        return None
    case = session.scalar(select(Case).where(Case.citizen_id == citizen.id, Case.case_number == DEMO_CASE_NUMBER))
    if case is None:
        return None
    return citizen, case


def apply_case_steps(session: Session, case: Case, step_rows: list[tuple[str, StepStatus, str, str]]) -> None:
    session.execute(delete(CaseStep).where(CaseStep.case_id == case.id))
    session.flush()
    session.add_all(build_case_steps(case.id, step_rows))


def workflow_progress_from_case(session: Session, case: Case, citizen_id) -> list[dict]:
    step_map = {step.step_name: step.status.value for step in case.steps}
    ngo_used = session.scalar(select(NgoAssistanceRequest.id).where(NgoAssistanceRequest.citizen_id == citizen_id).limit(1)) is not None
    progress: list[dict] = []

    for index, item in enumerate(WORKFLOW_DISPLAY, start=1):
        if item["key"] == "support":
            status = "completed" if ngo_used else "pending"
        else:
            statuses = [step_map.get(name, "not_started") for name in item["step_names"]]
            if statuses and all(status == "completed" for status in statuses):
                status = "completed"
            elif any(status == "in_progress" for status in statuses):
                status = "in_progress"
            elif any(status == "completed" for status in statuses):
                status = "in_progress"
            else:
                status = "pending"

        progress.append(
            {
                "step": index,
                "key": item["key"],
                "title": item["title"],
                "description": item["description"],
                "status": status,
            }
        )

    return progress


def reset_citizen_progress(session: Session) -> dict[str, str]:
    result = get_demo_citizen_case(session)
    if result is None:
        return {"status": "error", "message": "Demo citizen case not found"}

    citizen, case = result
    apply_case_steps(session, case, RESET_PROGRESS_STEPS)
    case.current_stage = "Service identified"
    case.status = CaseStatus.in_progress

    for appointment in session.scalars(select(Appointment).where(Appointment.case_id == case.id)).all():
        appointment.status = AppointmentStatus.cancelled
        appointment.notes = (appointment.notes or "") + " Cancelled during demo reset."

    for application in session.scalars(select(BenefitApplication).where(BenefitApplication.citizen_id == citizen.id)).all():
        application.status = BenefitApplicationStatus.draft
        application.submitted_at = None
        application.notes = "Reset to draft during demo restart."

    session.add(
        CaseEvent(
            case_id=case.id,
            actor_user_id=None,
            event_type="demo_reset",
            description="Admin reset Rahul Sharma's journey so the citizen can start over. Grievances remain available for review.",
        )
    )
    session.commit()
    return {"status": "ok", "message": "Rahul Sharma's journey has been reset. Grievances remain for review."}


def sync_demo_case_steps(session: Session) -> None:
    result = get_demo_citizen_case(session)
    if result is None:
        return

    _, case = result
    step_names = [step.step_name for step in case.steps]
    if "Grievance" in step_names or "Escalation" in step_names or "Pensions" not in step_names:
        apply_case_steps(session, case, DEMO_PROGRESS_STEPS)
        session.commit()
