from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.auth import (
    current_citizen_profile,
    current_hospital_staff,
    current_state_representative,
    get_current_user,
    has_role,
    require_roles,
)
from app.config import get_settings
from app.db import get_db, initialize_database, ping_database
from app.errors import bad_request, forbidden, not_found
from app.schemas import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentSlotOut,
    AppointmentStatusUpdate,
    AppointmentUpdate,
    BenefitApplicationCreate,
    BenefitApplicationOut,
    BenefitEligibilityOut,
    BenefitOut,
    CaseCreate,
    CaseDetailOut,
    CaseEventCreate,
    CaseEventOut,
    CaseOut,
    CaseStatusUpdate,
    CertificateDecisionCreate,
    CertificateDecisionResultOut,
    CertificateOut,
    CitizenProfileOut,
    CitizenProfileUpdate,
    DisabilityProfileOut,
    DocumentCreate,
    DocumentOut,
    DocumentPermissionCreate,
    DocumentPermissionOut,
    GovernmentServiceOut,
    GrievanceCreate,
    GrievanceOut,
    GrievanceStatusUpdate,
    HospitalAssessmentCaseOut,
    HospitalDepartmentOut,
    HospitalOut,
    LoginRequest,
    LoginResponse,
    NgoAssistanceCreate,
    NgoAssistanceOut,
    NgoOut,
    NotificationOut,
    SummaryOut,
    UdidCardData,
    UserOut,
)
from models.schema import (
    Appointment,
    AppointmentSlot,
    AppointmentStatus,
    AssistanceStatus,
    AuditLog,
    Benefit,
    BenefitApplication,
    BenefitApplicationStatus,
    BenefitEligibilityRule,
    BookingMethod,
    Case,
    CaseEvent,
    CaseStatus,
    CaseStep,
    CaseType,
    Certificate,
    CertificateStatus,
    CitizenProfile,
    DisabilityProfile,
    Document,
    DocumentPermission,
    DocumentStatus,
    GovernmentService,
    Grievance,
    GrievanceAction,
    GrievanceStatus,
    Hospital,
    HospitalDepartment,
    HospitalStaff,
    Ngo,
    NgoAssistanceRequest,
    Notification,
    PermissionType,
    RoleName,
    RuleOperator,
    StateOffice,
    StateRepresentative,
    StepStatus,
    UdidStatus,
    User,
)
from seed.seed_demo_data import seed as seed_demo_data


settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def role_names(user: User) -> set[RoleName]:
    return {role.name for role in user.roles}


def next_number(db: Session, model, prefix: str) -> str:
    count = db.scalar(select(func.count(model.id))) or 0
    return f"{prefix}-{date.today().year}-{count + 1:05d}"


def write_audit(
    db: Session,
    user: User | None,
    action: str,
    resource_type: str,
    resource_id: UUID | None = None,
    metadata: dict | None = None,
) -> None:
    actor_role = None
    if user and user.roles:
        actor_role = user.roles[0].name.value
    db.add(
        AuditLog(
            actor_user_id=user.id if user else None,
            actor_role=actor_role,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_json=metadata or {},
        )
    )


def get_case_or_404(db: Session, case_id: UUID) -> Case:
    case = db.scalar(
        select(Case)
        .options(selectinload(Case.steps), selectinload(Case.events))
        .where(Case.id == case_id)
    )
    if case is None:
        raise not_found("Case")
    return case


def can_access_case(db: Session, user: User, case: Case) -> bool:
    if has_role(user, RoleName.admin):
        return True
    if has_role(user, RoleName.citizen):
        profile = db.scalar(select(CitizenProfile).where(CitizenProfile.user_id == user.id))
        if profile and case.citizen_id == profile.id:
            return True
    if has_role(user, RoleName.hospital_staff):
        staff = db.scalar(select(HospitalStaff).where(HospitalStaff.user_id == user.id, HospitalStaff.active.is_(True)))
        if staff and case.assigned_hospital_id == staff.hospital_id:
            return True
    if has_role(user, RoleName.state_representative):
        representative = db.scalar(
            select(StateRepresentative).where(StateRepresentative.user_id == user.id, StateRepresentative.active.is_(True))
        )
        if representative and case.assigned_state_office_id == representative.state_office_id:
            return True
    return False


def get_document_or_404(db: Session, document_id: UUID) -> Document:
    document = db.get(Document, document_id)
    if document is None or document.deleted_at is not None:
        raise not_found("Document")
    return document


def can_access_document(db: Session, user: User, document: Document) -> bool:
    if has_role(user, RoleName.admin):
        return True
    profile = db.scalar(select(CitizenProfile).where(CitizenProfile.user_id == user.id))
    if profile and document.citizen_id == profile.id:
        return True
    active_grant = db.scalar(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document.id,
            DocumentPermission.granted_to_user_id == user.id,
            DocumentPermission.revoked_at.is_(None),
            or_(DocumentPermission.valid_until.is_(None), DocumentPermission.valid_until > datetime.now(timezone.utc)),
        )
    )
    return active_grant is not None


def default_case_steps(case_id: UUID) -> list[CaseStep]:
    names = [
        ("Profile", StepStatus.completed, "Confirm citizen profile", "Citizen"),
        ("Service identified", StepStatus.completed, "Review matched service", "Platform"),
        ("Hospital identified", StepStatus.in_progress, "Select assessment board", "Citizen"),
        ("Appointment", StepStatus.not_started, "Book medical board appointment", "Hospital"),
        ("Medical assessment", StepStatus.not_started, "Attend assessment", "Hospital"),
        ("Certificate", StepStatus.not_started, "Await certificate decision", "Hospital"),
        ("Benefits", StepStatus.not_started, "Discover eligible benefits", "Platform"),
        ("Grievance", StepStatus.not_started, "Raise grievance if delayed", "State Office"),
        ("Escalation", StepStatus.not_started, "Escalate unresolved grievance", "State Office"),
    ]
    return [
        CaseStep(
            case_id=case_id,
            step_name=name,
            step_order=order,
            status=step_status,
            next_action=next_action,
            responsible_authority=authority,
            completed_at=datetime.now(timezone.utc) if step_status == StepStatus.completed else None,
        )
        for order, (name, step_status, next_action, authority) in enumerate(names, start=1)
    ]


def age_from_dob(dob: date | None) -> int | None:
    if dob is None:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def eligibility_facts(citizen: CitizenProfile, disability: DisabilityProfile | None) -> dict[str, str]:
    facts = {
        "state": citizen.state,
        "district": citizen.district,
        "city": citizen.city or "",
        "age": str(age_from_dob(citizen.date_of_birth) or ""),
        "identity_verification_status": citizen.identity_verification_status.value,
    }
    if disability:
        facts.update(
            {
                "disability_category": disability.disability_category.value,
                "certificate_status": disability.certificate_status.value,
                "udid_status": disability.udid_status.value,
                "percentage_requirement_met": str(disability.percentage_requirement_met).lower(),
                "broad_disability_status": disability.broad_disability_status or "",
            }
        )
    return facts


def compare_rule(actual: str | None, operator: RuleOperator, expected: str | None) -> bool:
    if operator == RuleOperator.exists:
        return actual not in (None, "")
    if actual is None:
        return False
    expected = expected or ""
    if operator == RuleOperator.eq:
        return actual.lower() == expected.lower()
    if operator == RuleOperator.ne:
        return actual.lower() != expected.lower()
    if operator == RuleOperator.contains:
        return expected.lower() in actual.lower()
    if operator == RuleOperator.in_:
        return actual.lower() in {item.strip().lower() for item in expected.split(",")}
    if operator in {RuleOperator.gt, RuleOperator.gte, RuleOperator.lt, RuleOperator.lte}:
        try:
            left = float(actual)
            right = float(expected)
        except ValueError:
            return False
        return {
            RuleOperator.gt: left > right,
            RuleOperator.gte: left >= right,
            RuleOperator.lt: left < right,
            RuleOperator.lte: left <= right,
        }[operator]
    return False


def evaluate_benefit_for_citizen(db: Session, benefit: Benefit, citizen: CitizenProfile) -> BenefitEligibilityOut:
    disability = db.scalar(select(DisabilityProfile).where(DisabilityProfile.citizen_id == citizen.id))
    facts = eligibility_facts(citizen, disability)
    matched: list[str] = []
    missing: list[str] = []
    for rule in benefit.rules:
        actual = facts.get(rule.field_name)
        ok = compare_rule(actual, rule.operator, rule.comparison_value)
        label = f"{rule.field_name} {rule.operator.value} {rule.comparison_value}"
        if ok:
            matched.append(label)
        elif rule.required:
            missing.append(label)
    return BenefitEligibilityOut(benefit_id=benefit.id, eligible=not missing, matched_rules=matched, missing_rules=missing)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get("/health/db")
def database_health() -> dict[str, str]:
    try:
        ping_database()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable") from exc
    return {"status": "ok", "database": "connected"}


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower(), User.is_active.is_(True)))
    if user is None:
        raise not_found("Demo user")
    return LoginResponse(access_token=user.email, user=user)


@app.post("/auth/demo-login", response_model=LoginResponse)
def demo_login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    return login(payload, db)


@app.get("/auth/me", response_model=UserOut)
def auth_me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


@app.post("/auth/logout")
def logout() -> dict[str, str]:
    return {"status": "ok", "message": "Demo session cleared client-side"}


@app.get("/citizens/me/profile", response_model=CitizenProfileOut)
def my_profile(db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(require_roles(RoleName.citizen))]):
    return current_citizen_profile(db, current_user)


@app.patch("/citizens/me/profile", response_model=CitizenProfileOut)
def update_my_profile(
    payload: CitizenProfileUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.citizen))],
):
    profile = current_citizen_profile(db, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    write_audit(db, current_user, "citizen_profile_updated", "citizen_profiles", profile.id)
    db.commit()
    db.refresh(profile)
    return profile


@app.get("/citizens/me/disability", response_model=DisabilityProfileOut)
def my_disability(db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(require_roles(RoleName.citizen))]):
    profile = current_citizen_profile(db, current_user)
    disability = db.scalar(select(DisabilityProfile).where(DisabilityProfile.citizen_id == profile.id))
    if disability is None:
        raise not_found("Disability profile")
    return disability


@app.get("/services", response_model=list[GovernmentServiceOut])
def list_services(
    db: Annotated[Session, Depends(get_db)],
    state: str | None = None,
    category: str | None = None,
    q: str | None = Query(default=None, description="Search service name and description"),
):
    stmt = select(GovernmentService).where(GovernmentService.is_active.is_(True))
    if state:
        stmt = stmt.where(or_(GovernmentService.state == state, GovernmentService.state.is_(None)))
    if category:
        stmt = stmt.where(GovernmentService.category == category)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(GovernmentService.name.ilike(pattern), GovernmentService.description.ilike(pattern)))
    return db.scalars(stmt.order_by(GovernmentService.category, GovernmentService.name)).all()


@app.get("/services/{service_id}", response_model=GovernmentServiceOut)
def service_detail(service_id: UUID, db: Annotated[Session, Depends(get_db)]):
    service = db.get(GovernmentService, service_id)
    if service is None or not service.is_active:
        raise not_found("Service")
    return service


@app.get("/hospitals", response_model=list[HospitalOut])
def list_hospitals(
    db: Annotated[Session, Depends(get_db)],
    state: str | None = None,
    district: str | None = None,
    assessment_type: str | None = None,
):
    stmt = select(Hospital).options(selectinload(Hospital.departments)).where(Hospital.active.is_(True))
    if state:
        stmt = stmt.where(Hospital.state == state)
    if district:
        stmt = stmt.where(Hospital.district == district)
    hospitals = db.scalars(stmt.order_by(Hospital.name)).all()
    if assessment_type:
        hospitals = [
            hospital
            for hospital in hospitals
            if any(department.active and department.assessment_type == assessment_type for department in hospital.departments)
        ]
    return hospitals


@app.get("/hospitals/{hospital_id}", response_model=HospitalOut)
def hospital_detail(hospital_id: UUID, db: Annotated[Session, Depends(get_db)]):
    hospital = db.scalar(select(Hospital).options(selectinload(Hospital.departments)).where(Hospital.id == hospital_id))
    if hospital is None or not hospital.active:
        raise not_found("Hospital")
    return hospital


@app.get("/hospitals/{hospital_id}/departments", response_model=list[HospitalDepartmentOut])
def hospital_departments(hospital_id: UUID, db: Annotated[Session, Depends(get_db)]):
    if db.get(Hospital, hospital_id) is None:
        raise not_found("Hospital")
    return db.scalars(
        select(HospitalDepartment).where(HospitalDepartment.hospital_id == hospital_id, HospitalDepartment.active.is_(True)).order_by(HospitalDepartment.name)
    ).all()


@app.get("/appointments/slots", response_model=list[AppointmentSlotOut])
@app.get("/appointment-slots", response_model=list[AppointmentSlotOut])
def list_appointment_slots(
    db: Annotated[Session, Depends(get_db)],
    hospital_id: UUID | None = None,
    department_id: UUID | None = None,
    on_date: date | None = Query(default=None, alias="date"),
):
    stmt = select(AppointmentSlot).where(AppointmentSlot.active.is_(True))
    if hospital_id:
        stmt = stmt.where(AppointmentSlot.hospital_id == hospital_id)
    if department_id:
        stmt = stmt.where(AppointmentSlot.department_id == department_id)
    if on_date:
        stmt = stmt.where(AppointmentSlot.date == on_date)
    return db.scalars(stmt.order_by(AppointmentSlot.date, AppointmentSlot.start_time)).all()


@app.get("/cases", response_model=list[CaseOut])
def list_cases(db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    stmt = select(Case).order_by(Case.created_at.desc())
    if has_role(current_user, RoleName.admin):
        return db.scalars(stmt).all()
    if has_role(current_user, RoleName.citizen):
        profile = current_citizen_profile(db, current_user)
        return db.scalars(stmt.where(Case.citizen_id == profile.id)).all()
    if has_role(current_user, RoleName.hospital_staff):
        staff = current_hospital_staff(db, current_user)
        return db.scalars(stmt.where(Case.assigned_hospital_id == staff.hospital_id)).all()
    if has_role(current_user, RoleName.state_representative):
        representative = current_state_representative(db, current_user)
        return db.scalars(stmt.where(Case.assigned_state_office_id == representative.state_office_id)).all()
    raise forbidden()


@app.post("/cases", response_model=CaseDetailOut, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.citizen))],
):
    profile = current_citizen_profile(db, current_user)
    if payload.assigned_hospital_id and db.get(Hospital, payload.assigned_hospital_id) is None:
        raise not_found("Hospital")
    if payload.assigned_state_office_id and db.get(StateOffice, payload.assigned_state_office_id) is None:
        raise not_found("State office")
    case = Case(
        case_number=next_number(db, Case, "CASE"),
        citizen_id=profile.id,
        case_type=payload.case_type,
        current_stage="Profile",
        status=CaseStatus.open if payload.case_type != CaseType.disability_certificate else CaseStatus.in_progress,
        assigned_hospital_id=payload.assigned_hospital_id,
        assigned_state_office_id=payload.assigned_state_office_id,
        priority=payload.priority,
    )
    db.add(case)
    db.flush()
    db.add_all(default_case_steps(case.id))
    db.add(CaseEvent(case_id=case.id, actor_user_id=current_user.id, event_type="case_created", description=f"{payload.case_type.value} case created."))
    write_audit(db, current_user, "case_created", "cases", case.id)
    db.commit()
    return get_case_or_404(db, case.id)


@app.get("/cases/{case_id}", response_model=CaseDetailOut)
def case_detail(case_id: UUID, db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    case = get_case_or_404(db, case_id)
    if not can_access_case(db, current_user, case):
        raise forbidden("Cannot access this case")
    return case


@app.patch("/cases/{case_id}", response_model=CaseDetailOut)
def update_case_status(
    case_id: UUID,
    payload: CaseStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.hospital_staff, RoleName.state_representative, RoleName.admin))],
):
    case = get_case_or_404(db, case_id)
    if not can_access_case(db, current_user, case):
        raise forbidden("Cannot update this case")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(case, field, value)
    db.add(CaseEvent(case_id=case.id, actor_user_id=current_user.id, event_type="case_updated", description="Case status or stage updated."))
    write_audit(db, current_user, "case_updated", "cases", case.id, payload.model_dump(exclude_unset=True))
    db.commit()
    return get_case_or_404(db, case.id)


@app.post("/cases/{case_id}/events", response_model=CaseEventOut, status_code=status.HTTP_201_CREATED)
def add_case_event(
    case_id: UUID,
    payload: CaseEventCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    case = get_case_or_404(db, case_id)
    if not can_access_case(db, current_user, case):
        raise forbidden("Cannot add an event to this case")
    event = CaseEvent(case_id=case.id, actor_user_id=current_user.id, event_type=payload.event_type, description=payload.description)
    db.add(event)
    write_audit(db, current_user, "case_event_created", "case_events", event.id, {"case_id": str(case.id)})
    db.commit()
    db.refresh(event)
    return event


@app.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    stmt = select(Appointment).order_by(Appointment.appointment_date, Appointment.appointment_time)
    if has_role(current_user, RoleName.admin):
        return db.scalars(stmt).all()
    if has_role(current_user, RoleName.citizen):
        profile = current_citizen_profile(db, current_user)
        return db.scalars(stmt.where(Appointment.citizen_id == profile.id)).all()
    if has_role(current_user, RoleName.hospital_staff):
        staff = current_hospital_staff(db, current_user)
        return db.scalars(stmt.where(Appointment.hospital_id == staff.hospital_id)).all()
    raise forbidden()


@app.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def appointment_detail(
    appointment_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    appointment = db.get(Appointment, appointment_id)
    if appointment is None:
        raise not_found("Appointment")
    if has_role(current_user, RoleName.admin):
        return appointment
    if has_role(current_user, RoleName.citizen):
        profile = current_citizen_profile(db, current_user)
        if appointment.citizen_id == profile.id:
            return appointment
    if has_role(current_user, RoleName.hospital_staff):
        staff = current_hospital_staff(db, current_user)
        if appointment.hospital_id == staff.hospital_id:
            return appointment
    raise forbidden("Cannot access this appointment")


@app.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def book_appointment(
    payload: AppointmentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.citizen))],
):
    profile = current_citizen_profile(db, current_user)
    case = get_case_or_404(db, payload.case_id)
    if case.citizen_id != profile.id:
        raise forbidden("Cannot book appointments for another citizen case")
    department = db.get(HospitalDepartment, payload.department_id)
    if department is None or department.hospital_id != payload.hospital_id:
        raise bad_request("Department does not belong to the selected hospital")
    slot = db.scalar(
        select(AppointmentSlot).where(
            AppointmentSlot.hospital_id == payload.hospital_id,
            AppointmentSlot.department_id == payload.department_id,
            AppointmentSlot.date == payload.appointment_date,
            AppointmentSlot.start_time == payload.appointment_time,
            AppointmentSlot.active.is_(True),
        )
    )
    if slot is None:
        raise not_found("Appointment slot")
    if slot.booked_count >= slot.capacity:
        raise bad_request("Appointment slot is full")
    slot.booked_count += 1
    appointment = Appointment(
        appointment_number=next_number(db, Appointment, "APT"),
        citizen_id=profile.id,
        case_id=case.id,
        hospital_id=payload.hospital_id,
        department_id=payload.department_id,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        status=AppointmentStatus.confirmed if payload.booking_method == BookingMethod.mock_api else AppointmentStatus.booked,
        booking_method=payload.booking_method,
        notes=payload.notes,
    )
    case.assigned_hospital_id = payload.hospital_id
    case.current_stage = "Appointment"
    case.status = CaseStatus.in_progress
    db.add(appointment)
    db.add(CaseEvent(case_id=case.id, actor_user_id=current_user.id, event_type="appointment_booked", description=f"Appointment booked for {payload.appointment_date}."))
    write_audit(db, current_user, "appointment_booked", "appointments", appointment.id)
    db.commit()
    db.refresh(appointment)
    return appointment


@app.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
@app.patch("/appointments/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment(
    appointment_id: UUID,
    payload: AppointmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.hospital_staff, RoleName.admin))],
):
    appointment = db.get(Appointment, appointment_id)
    if appointment is None:
        raise not_found("Appointment")
    if has_role(current_user, RoleName.hospital_staff):
        staff = current_hospital_staff(db, current_user)
        if appointment.hospital_id != staff.hospital_id:
            raise forbidden("Hospital staff cannot update appointments outside their hospital")
    if payload.status is not None:
        appointment.status = payload.status
    if payload.appointment_date is not None:
        appointment.appointment_date = payload.appointment_date
    if payload.appointment_time is not None:
        appointment.appointment_time = payload.appointment_time
    if payload.notes is not None:
        appointment.notes = payload.notes
    write_audit(db, current_user, "appointment_updated", "appointments", appointment.id, payload.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(appointment)
    return appointment


@app.get("/documents", response_model=list[DocumentOut])
def list_documents(db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    if has_role(current_user, RoleName.admin):
        documents = db.scalars(select(Document).where(Document.deleted_at.is_(None)).order_by(Document.uploaded_at.desc())).all()
    elif has_role(current_user, RoleName.citizen):
        profile = current_citizen_profile(db, current_user)
        documents = db.scalars(select(Document).where(Document.citizen_id == profile.id, Document.deleted_at.is_(None))).all()
    else:
        granted_ids = select(DocumentPermission.document_id).where(
            DocumentPermission.granted_to_user_id == current_user.id,
            DocumentPermission.revoked_at.is_(None),
            or_(DocumentPermission.valid_until.is_(None), DocumentPermission.valid_until > datetime.now(timezone.utc)),
        )
        documents = db.scalars(select(Document).where(Document.id.in_(granted_ids), Document.deleted_at.is_(None))).all()
    for document in documents:
        write_audit(db, current_user, "document_metadata_listed", "documents", document.id)
    db.commit()
    return documents


@app.post("/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.citizen))],
):
    profile = current_citizen_profile(db, current_user)
    if payload.case_id:
        case = get_case_or_404(db, payload.case_id)
        if case.citizen_id != profile.id:
            raise forbidden("Cannot attach a document to another citizen case")
    document = Document(
        citizen_id=profile.id,
        case_id=payload.case_id,
        document_type=payload.document_type,
        filename=payload.filename,
        mime_type=payload.mime_type,
        storage_reference=payload.storage_reference,
        status=DocumentStatus.pending_review,
    )
    db.add(document)
    db.flush()
    write_audit(db, current_user, "document_metadata_created", "documents", document.id)
    db.commit()
    db.refresh(document)
    return document


@app.post("/documents/{document_id}/permissions", response_model=DocumentPermissionOut, status_code=status.HTTP_201_CREATED)
def grant_document_permission(
    document_id: UUID,
    payload: DocumentPermissionCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    document = get_document_or_404(db, document_id)
    if not has_role(current_user, RoleName.admin):
        profile = current_citizen_profile(db, current_user)
        if document.citizen_id != profile.id:
            raise forbidden("Only a citizen owner or admin can grant document access")
    if db.get(User, payload.granted_to_user_id) is None:
        raise not_found("Granted user")
    permission = DocumentPermission(
        document_id=document.id,
        granted_to_user_id=payload.granted_to_user_id,
        permission_type=payload.permission_type,
        valid_until=payload.valid_until,
    )
    db.add(permission)
    db.flush()
    write_audit(db, current_user, "document_permission_granted", "document_permissions", permission.id, {"document_id": str(document.id)})
    db.commit()
    db.refresh(permission)
    return permission


@app.post("/document-permissions/{permission_id}/revoke", response_model=DocumentPermissionOut)
def revoke_document_permission(
    permission_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    permission = db.get(DocumentPermission, permission_id)
    if permission is None:
        raise not_found("Document permission")
    document = get_document_or_404(db, permission.document_id)
    if not has_role(current_user, RoleName.admin):
        profile = current_citizen_profile(db, current_user)
        if document.citizen_id != profile.id:
            raise forbidden("Only a citizen owner or admin can revoke document access")
    permission.revoked_at = datetime.now(timezone.utc)
    write_audit(db, current_user, "document_permission_revoked", "document_permissions", permission.id)
    db.commit()
    db.refresh(permission)
    return permission


@app.get("/benefits", response_model=list[BenefitOut])
def list_benefits(db: Annotated[Session, Depends(get_db)], state: str | None = None, category: str | None = None):
    stmt = select(Benefit).options(selectinload(Benefit.rules)).where(Benefit.active.is_(True))
    if state:
        stmt = stmt.where(or_(Benefit.state == state, Benefit.state.is_(None)))
    if category:
        stmt = stmt.where(Benefit.category == category)
    return db.scalars(stmt.order_by(Benefit.category, Benefit.name)).all()


@app.get("/benefits/{benefit_id}", response_model=BenefitOut)
def benefit_detail(benefit_id: UUID, db: Annotated[Session, Depends(get_db)]):
    benefit = db.scalar(select(Benefit).options(selectinload(Benefit.rules)).where(Benefit.id == benefit_id))
    if benefit is None or not benefit.active:
        raise not_found("Benefit")
    return benefit


@app.get("/benefits/{benefit_id}/eligibility", response_model=BenefitEligibilityOut)
def benefit_eligibility(
    benefit_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.citizen))],
):
    benefit = db.scalar(select(Benefit).options(selectinload(Benefit.rules)).where(Benefit.id == benefit_id))
    if benefit is None or not benefit.active:
        raise not_found("Benefit")
    citizen = current_citizen_profile(db, current_user)
    return evaluate_benefit_for_citizen(db, benefit, citizen)


@app.get("/benefit-applications", response_model=list[BenefitApplicationOut])
def list_benefit_applications(db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    stmt = select(BenefitApplication)
    if has_role(current_user, RoleName.admin):
        return db.scalars(stmt).all()
    citizen = current_citizen_profile(db, current_user)
    return db.scalars(stmt.where(BenefitApplication.citizen_id == citizen.id)).all()


@app.post("/benefit-applications", response_model=BenefitApplicationOut, status_code=status.HTTP_201_CREATED)
def create_benefit_application(
    payload: BenefitApplicationCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.citizen))],
):
    citizen = current_citizen_profile(db, current_user)
    benefit = db.scalar(select(Benefit).options(selectinload(Benefit.rules)).where(Benefit.id == payload.benefit_id))
    if benefit is None or not benefit.active:
        raise not_found("Benefit")
    eligibility = evaluate_benefit_for_citizen(db, benefit, citizen)
    application = BenefitApplication(
        citizen_id=citizen.id,
        benefit_id=benefit.id,
        status=BenefitApplicationStatus.submitted if eligibility.eligible else BenefitApplicationStatus.draft,
        submitted_at=datetime.now(timezone.utc) if eligibility.eligible else None,
        missing_information="; ".join(eligibility.missing_rules) if not eligibility.eligible else None,
        notes=payload.notes,
    )
    db.add(application)
    db.flush()
    write_audit(db, current_user, "benefit_application_created", "benefit_applications", application.id)
    db.commit()
    db.refresh(application)
    return application


@app.get("/grievances", response_model=list[GrievanceOut])
def list_grievances(db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    stmt = select(Grievance).options(selectinload(Grievance.actions)).order_by(Grievance.created_at.desc())
    if has_role(current_user, RoleName.admin):
        return db.scalars(stmt).all()
    if has_role(current_user, RoleName.citizen):
        citizen = current_citizen_profile(db, current_user)
        return db.scalars(stmt.where(Grievance.citizen_id == citizen.id)).all()
    if has_role(current_user, RoleName.state_representative):
        representative = current_state_representative(db, current_user)
        return db.scalars(stmt.where(Grievance.assigned_state_office_id == representative.state_office_id)).all()
    raise forbidden()


@app.post("/grievances", response_model=GrievanceOut, status_code=status.HTTP_201_CREATED)
def create_grievance(
    payload: GrievanceCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.citizen))],
):
    citizen = current_citizen_profile(db, current_user)
    assigned_office_id = None
    if payload.case_id:
        case = get_case_or_404(db, payload.case_id)
        if case.citizen_id != citizen.id:
            raise forbidden("Cannot create a grievance for another citizen case")
        assigned_office_id = case.assigned_state_office_id
    if assigned_office_id is None:
        office = db.scalar(select(StateOffice).where(StateOffice.state == citizen.state, StateOffice.active.is_(True)))
        assigned_office_id = office.id if office else None
    grievance = Grievance(
        grievance_number=next_number(db, Grievance, "GRV"),
        citizen_id=citizen.id,
        case_id=payload.case_id,
        category=payload.category,
        subject=payload.subject,
        description=payload.description,
        status=GrievanceStatus.submitted,
        assigned_state_office_id=assigned_office_id,
    )
    db.add(grievance)
    db.flush()
    db.add(GrievanceAction(grievance_id=grievance.id, actor_user_id=current_user.id, action_type="submitted", message=payload.description))
    write_audit(db, current_user, "grievance_created", "grievances", grievance.id)
    db.commit()
    return db.scalar(select(Grievance).options(selectinload(Grievance.actions)).where(Grievance.id == grievance.id))


@app.get("/grievances/{grievance_id}", response_model=GrievanceOut)
def grievance_detail(grievance_id: UUID, db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    grievance = db.scalar(select(Grievance).options(selectinload(Grievance.actions)).where(Grievance.id == grievance_id))
    if grievance is None:
        raise not_found("Grievance")
    if has_role(current_user, RoleName.admin):
        return grievance
    if has_role(current_user, RoleName.citizen):
        citizen = current_citizen_profile(db, current_user)
        if grievance.citizen_id == citizen.id:
            return grievance
    if has_role(current_user, RoleName.state_representative):
        representative = current_state_representative(db, current_user)
        if grievance.assigned_state_office_id == representative.state_office_id:
            return grievance
    raise forbidden("Cannot access this grievance")


@app.patch("/grievances/{grievance_id}/status", response_model=GrievanceOut)
def update_grievance_status(
    grievance_id: UUID,
    payload: GrievanceStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    grievance = grievance_detail(grievance_id, db, current_user)
    if has_role(current_user, RoleName.citizen):
        if payload.status not in {GrievanceStatus.citizen_accepted, GrievanceStatus.citizen_rejected}:
            raise forbidden("Citizens can only accept or reject a response")
    elif not (has_role(current_user, RoleName.state_representative) or has_role(current_user, RoleName.admin)):
        raise forbidden()
    grievance.status = payload.status
    if payload.status in {GrievanceStatus.closed, GrievanceStatus.citizen_accepted}:
        grievance.resolved_at = datetime.now(timezone.utc)
    db.add(
        GrievanceAction(
            grievance_id=grievance.id,
            actor_user_id=current_user.id,
            action_type="status_changed",
            message=payload.message or f"Status changed to {payload.status.value}.",
        )
    )
    write_audit(db, current_user, "grievance_status_updated", "grievances", grievance.id, {"status": payload.status.value})
    db.commit()
    return db.scalar(select(Grievance).options(selectinload(Grievance.actions)).where(Grievance.id == grievance.id))


@app.get("/ngos", response_model=list[NgoOut])
def list_ngos(db: Annotated[Session, Depends(get_db)], state: str | None = None, district: str | None = None):
    stmt = select(Ngo)
    if state:
        stmt = stmt.where(Ngo.state == state)
    if district:
        stmt = stmt.where(Ngo.district == district)
    return db.scalars(stmt.order_by(Ngo.name)).all()


@app.get("/ngo-assistance-requests", response_model=list[NgoAssistanceOut])
def list_ngo_requests(db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(require_roles(RoleName.citizen, RoleName.admin))]):
    stmt = select(NgoAssistanceRequest).order_by(NgoAssistanceRequest.created_at.desc())
    if has_role(current_user, RoleName.admin):
        return db.scalars(stmt).all()
    citizen = current_citizen_profile(db, current_user)
    return db.scalars(stmt.where(NgoAssistanceRequest.citizen_id == citizen.id)).all()


@app.post("/ngo-assistance-requests", response_model=NgoAssistanceOut, status_code=status.HTTP_201_CREATED)
def create_ngo_request(
    payload: NgoAssistanceCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.citizen))],
):
    citizen = current_citizen_profile(db, current_user)
    if db.get(Ngo, payload.ngo_id) is None:
        raise not_found("NGO")
    request = NgoAssistanceRequest(
        citizen_id=citizen.id,
        ngo_id=payload.ngo_id,
        assistance_type=payload.assistance_type,
        description=payload.description,
        status=AssistanceStatus.requested,
    )
    db.add(request)
    write_audit(db, current_user, "ngo_assistance_requested", "ngo_assistance_requests", request.id)
    db.commit()
    db.refresh(request)
    return request


@app.get("/notifications", response_model=list[NotificationOut])
def list_notifications(db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    return db.scalars(select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc())).all()


@app.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(notification_id: UUID, db: Annotated[Session, Depends(get_db)], current_user: Annotated[User, Depends(get_current_user)]):
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.id:
        raise not_found("Notification")
    notification.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return notification


@app.get("/admin/summary", response_model=SummaryOut)
def admin_summary(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_roles(RoleName.admin))],
):
    return SummaryOut(
        users=db.scalar(select(func.count(User.id))) or 0,
        citizens=db.scalar(select(func.count(CitizenProfile.id))) or 0,
        open_cases=db.scalar(select(func.count(Case.id)).where(Case.status.in_([CaseStatus.open, CaseStatus.in_progress]))) or 0,
        grievances=db.scalar(select(func.count(Grievance.id))) or 0,
        benefits=db.scalar(select(func.count(Benefit.id))) or 0,
        hospitals=db.scalar(select(func.count(Hospital.id))) or 0,
        ngos=db.scalar(select(func.count(Ngo.id))) or 0,
    )


@app.post("/admin/seed-demo")
def seed_demo(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_roles(RoleName.admin))],
) -> dict[str, str]:
    seed_demo_data(db)
    return {"status": "ok", "message": "Demo seed data loaded"}


def make_mock_udid_card(
    citizen: CitizenProfile,
    user: User,
    disability: DisabilityProfile | None,
    cert: Certificate | None,
    hospital_name: str = "Government Medical Board",
) -> UdidCardData | None:
    if not disability or disability.udid_status != UdidStatus.issued or not cert:
        return None

    percentage = 40
    if disability.broad_disability_status and "%" in disability.broad_disability_status:
        try:
            percentage = int(disability.broad_disability_status.split("%")[0].strip())
        except Exception:
            percentage = 40

    validity_str = "Permanent" if not cert.expiry_date else f"Valid until {cert.expiry_date.strftime('%d/%m/%Y')}"

    return UdidCardData(
        udid_number=cert.certificate_number_mock,
        citizen_name=user.full_name,
        date_of_birth=citizen.date_of_birth.strftime("%d/%m/%Y") if citizen.date_of_birth else None,
        gender="Male",
        state=citizen.state,
        district=citizen.district,
        disability_category=disability.disability_category.value.replace("_", " ").title(),
        disability_percentage=percentage,
        validity=validity_str,
        issue_date=cert.issue_date.strftime("%d/%m/%Y") if cert.issue_date else date.today().strftime("%d/%m/%Y"),
        issuing_hospital=cert.issuing_authority or hospital_name,
        barcode_reference=f"UDID-{cert.certificate_number_mock}-VERIFIED",
        status="ACTIVE",
    )


@app.get("/hospital/assessments", response_model=list[HospitalAssessmentCaseOut])
def list_hospital_assessments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.hospital_staff, RoleName.admin))],
):
    stmt = select(Case).order_by(Case.created_at.desc())
    if has_role(current_user, RoleName.hospital_staff):
        staff = current_hospital_staff(db, current_user)
        stmt = stmt.where(Case.assigned_hospital_id == staff.hospital_id)

    cases = db.scalars(stmt).all()
    results: list[HospitalAssessmentCaseOut] = []

    for case in cases:
        citizen = db.scalar(select(CitizenProfile).where(CitizenProfile.id == case.citizen_id))
        if not citizen:
            continue
        user = db.scalar(select(User).where(User.id == citizen.user_id))
        if not user:
            continue
        disability = db.scalar(select(DisabilityProfile).where(DisabilityProfile.citizen_id == citizen.id))
        appointment = db.scalar(
            select(Appointment)
            .where(Appointment.case_id == case.id)
            .order_by(Appointment.created_at.desc())
        )
        documents = db.scalars(
            select(Document)
            .where(Document.citizen_id == citizen.id, Document.deleted_at.is_(None))
        ).all()
        cert = db.scalar(
            select(Certificate)
            .where(Certificate.citizen_id == citizen.id)
            .order_by(Certificate.created_at.desc())
        )

        hospital_name = "Government Hospital"
        if case.assigned_hospital_id:
            h = db.get(Hospital, case.assigned_hospital_id)
            if h:
                hospital_name = h.name

        udid_card = make_mock_udid_card(citizen, user, disability, cert, hospital_name)

        results.append(
            HospitalAssessmentCaseOut(
                case=case,
                citizen=citizen,
                user_name=user.full_name,
                user_email=user.email,
                disability_profile=disability,
                appointment=appointment,
                documents=documents,
                certificate=cert,
                udid_card=udid_card,
            )
        )

    return results


@app.post("/certificates/decision", response_model=CertificateDecisionResultOut)
def evaluate_certificate_decision(
    payload: CertificateDecisionCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.hospital_staff, RoleName.admin))],
):
    case = get_case_or_404(db, payload.case_id)
    if has_role(current_user, RoleName.hospital_staff):
        staff = current_hospital_staff(db, current_user)
        if case.assigned_hospital_id != staff.hospital_id:
            raise forbidden("Hospital staff cannot evaluate cases outside their assigned hospital")

    citizen = db.scalar(select(CitizenProfile).where(CitizenProfile.id == case.citizen_id))
    if not citizen:
        raise not_found("Citizen profile")
    user = db.scalar(select(User).where(User.id == citizen.user_id))
    if not user:
        raise not_found("User")

    disability = db.scalar(select(DisabilityProfile).where(DisabilityProfile.citizen_id == citizen.id))
    if not disability:
        disability = DisabilityProfile(
            citizen_id=citizen.id,
            disability_category=DisabilityCategory.other,
            certificate_status=CertificateStatus.under_assessment,
            udid_status=UdidStatus.pending,
        )
        db.add(disability)
        db.flush()

    hospital = db.get(Hospital, case.assigned_hospital_id) if case.assigned_hospital_id else None
    hospital_name = hospital.name if hospital else "Government Assessment Board"

    decision = payload.decision.strip().lower()
    cert = db.scalar(select(Certificate).where(Certificate.citizen_id == citizen.id).order_by(Certificate.created_at.desc()))

    if decision == "approve":
        pct = max(0, min(100, payload.disability_percentage))
        percentage_met = pct >= 40

        count = db.scalar(select(func.count(Certificate.id))) or 0
        udid_number = f"DL01{date.today().year}{count + 184:05d}"

        expiry_date = None
        if not payload.is_permanent:
            try:
                expiry_date = date(date.today().year + payload.validity_years, date.today().month, date.today().day)
            except Exception:
                expiry_date = date(date.today().year + payload.validity_years, 12, 31)

        if cert is None:
            cert = Certificate(
                citizen_id=citizen.id,
                certificate_type="Disability Certificate & UDID",
                certificate_number_mock=udid_number,
                issue_date=date.today(),
                expiry_date=expiry_date,
                status=CertificateStatus.approved,
                issuing_authority=hospital_name,
                source="medical_board",
            )
            db.add(cert)
        else:
            cert.status = CertificateStatus.approved
            cert.issue_date = date.today()
            cert.expiry_date = expiry_date
            cert.issuing_authority = hospital_name
            cert.certificate_number_mock = udid_number

        disability.certificate_status = CertificateStatus.approved
        disability.udid_status = UdidStatus.issued
        disability.percentage_requirement_met = percentage_met
        disability.broad_disability_status = f"{pct}% evaluated ({payload.medical_remarks or 'Approved by Board'})"

        doc = db.scalar(select(Document).where(Document.citizen_id == citizen.id, Document.document_type == "disability_certificate"))
        if doc is None:
            doc = Document(
                citizen_id=citizen.id,
                case_id=case.id,
                document_type="disability_certificate",
                filename=f"UDID_Certificate_{udid_number}.pdf",
                mime_type="application/pdf",
                storage_reference=f"mock://gov-udid-storage/{udid_number}.pdf",
                status=DocumentStatus.verified,
            )
            db.add(doc)
        else:
            doc.status = DocumentStatus.verified
            doc.filename = f"UDID_Certificate_{udid_number}.pdf"

        for step in case.steps:
            if step.step_name in ("Medical assessment", "Medical Assessment", "Appointment"):
                step.status = StepStatus.completed
                step.completed_at = datetime.now(timezone.utc)
            if step.step_name in ("Certificate", "Disability Certificate"):
                step.status = StepStatus.completed
                step.completed_at = datetime.now(timezone.utc)
                step.next_action = f"UDID ({udid_number}) issued"
            if step.step_name == "Benefits":
                step.status = StepStatus.in_progress
                step.next_action = "Discover eligible benefits with UDID"

        case.current_stage = "Benefits"
        case.status = CaseStatus.in_progress

        db.add(
            CaseEvent(
                case_id=case.id,
                actor_user_id=current_user.id,
                event_type="certificate_approved",
                description=f"Disability Certificate & UDID ({udid_number}) approved with {pct}% evaluation by {hospital_name}.",
            )
        )
        db.add(
            Notification(
                user_id=citizen.user_id,
                title="Disability Certificate & UDID Issued!",
                body=f"Your Disability Certificate and UDID ({udid_number}) have been issued by {hospital_name} ({pct}% benchmark disability).",
                notification_type="certificate",
            )
        )
        write_audit(db, current_user, "certificate_approved", "certificates", cert.id if cert else None, {"percentage": pct, "udid": udid_number})
        db.commit()
        db.refresh(case)
        db.refresh(disability)
        if cert:
            db.refresh(cert)

        udid_card = make_mock_udid_card(citizen, user, disability, cert, hospital_name)

        return CertificateDecisionResultOut(
            success=True,
            decision="approve",
            message=f"Disability certificate approved and UDID ({udid_number}) issued successfully.",
            case=get_case_or_404(db, case.id),
            disability_profile=disability,
            certificate=cert,
            udid_card=udid_card,
        )

    else:
        reason = payload.rejection_reason or payload.medical_remarks or "Disability criteria not met"
        disability.certificate_status = CertificateStatus.rejected
        disability.udid_status = UdidStatus.rejected
        disability.percentage_requirement_met = False
        disability.broad_disability_status = f"Rejected: {reason}"

        if cert:
            cert.status = CertificateStatus.rejected

        for step in case.steps:
            if step.step_name in ("Medical assessment", "Medical Assessment"):
                step.status = StepStatus.completed
                step.completed_at = datetime.now(timezone.utc)
            if step.step_name in ("Certificate", "Disability Certificate"):
                step.status = StepStatus.blocked
                step.next_action = f"Certificate rejected: {reason}"

        db.add(
            CaseEvent(
                case_id=case.id,
                actor_user_id=current_user.id,
                event_type="certificate_rejected",
                description=f"Disability Certificate rejected by Medical Board. Reason: {reason}.",
            )
        )
        db.add(
            Notification(
                user_id=citizen.user_id,
                title="Disability Certificate Decision",
                body=f"Your Disability Certificate application was not approved by {hospital_name}. Reason: {reason}. You may file a grievance or request re-evaluation.",
                notification_type="certificate",
            )
        )
        write_audit(db, current_user, "certificate_rejected", "cases", case.id, {"reason": reason})
        db.commit()
        db.refresh(case)
        db.refresh(disability)

        return CertificateDecisionResultOut(
            success=True,
            decision="reject",
            message=f"Disability certificate rejected. Citizen notified.",
            case=get_case_or_404(db, case.id),
            disability_profile=disability,
            certificate=cert,
            udid_card=None,
        )


@app.get("/citizens/me/udid", response_model=UdidCardData)
def my_udid_card(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(RoleName.citizen))],
):
    profile = current_citizen_profile(db, current_user)
    disability = db.scalar(select(DisabilityProfile).where(DisabilityProfile.citizen_id == profile.id))
    cert = db.scalar(
        select(Certificate)
        .where(Certificate.citizen_id == profile.id, Certificate.status == CertificateStatus.approved)
        .order_by(Certificate.created_at.desc())
    )
    if not disability or disability.udid_status != UdidStatus.issued or not cert:
        raise not_found("UDID Card not yet issued")

    case = db.scalar(select(Case).where(Case.citizen_id == profile.id).order_by(Case.created_at.desc()))
    hospital_name = "Government Medical Board"
    if case and case.assigned_hospital_id:
        h = db.get(Hospital, case.assigned_hospital_id)
        if h:
            hospital_name = h.name

    card = make_mock_udid_card(profile, current_user, disability, cert, hospital_name)
    if not card:
        raise not_found("UDID Card not found")
    return card


def frontend_tag_for_path(path: str) -> str:
    first_segment = path.strip("/").split("/", maxsplit=1)[0]
    return {
        "admin": "Admin",
        "appointment-slots": "Appointments",
        "appointments": "Appointments",
        "auth": "Auth",
        "benefit-applications": "Benefits",
        "benefits": "Benefits",
        "certificates": "Certificates",
        "cases": "Cases",
        "citizens": "Citizen",
        "document-permissions": "Documents",
        "documents": "Documents",
        "grievances": "Grievances",
        "health": "System",
        "hospitals": "Hospital",
        "ngo-assistance-requests": "NGOs",
        "ngos": "NGOs",
        "notifications": "Notifications",
        "services": "Services",
    }.get(first_segment, "System")


def add_frontend_api_routes(application: FastAPI, prefix: str) -> None:
    prefix = prefix.rstrip("/")
    if not prefix:
        return
    existing_route_keys = {
        (route.path, method)
        for route in application.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    }
    for route in list(application.routes):
        if not isinstance(route, APIRoute) or route.path.startswith(f"{prefix}/"):
            continue
        prefixed_path = f"{prefix}{route.path}"
        if all((prefixed_path, method) in existing_route_keys for method in route.methods):
            continue

        original_include_in_schema = route.include_in_schema
        application.add_api_route(
            prefixed_path,
            route.endpoint,
            response_model=route.response_model,
            status_code=route.status_code,
            tags=route.tags or [frontend_tag_for_path(route.path)],
            dependencies=route.dependencies,
            summary=route.summary,
            description=route.description,
            response_description=route.response_description,
            responses=route.responses,
            deprecated=route.deprecated,
            methods=route.methods,
            operation_id=route.operation_id,
            response_model_include=route.response_model_include,
            response_model_exclude=route.response_model_exclude,
            response_model_by_alias=route.response_model_by_alias,
            response_model_exclude_unset=route.response_model_exclude_unset,
            response_model_exclude_defaults=route.response_model_exclude_defaults,
            response_model_exclude_none=route.response_model_exclude_none,
            include_in_schema=original_include_in_schema,
            response_class=route.response_class,
            name=route.name,
            openapi_extra=route.openapi_extra,
            generate_unique_id_function=route.generate_unique_id_function,
        )
        for method in route.methods:
            existing_route_keys.add((prefixed_path, method))
        route.include_in_schema = False


add_frontend_api_routes(app, settings.api_prefix)
