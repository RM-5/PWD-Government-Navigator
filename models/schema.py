from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from database.base import Base


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)


def now_column() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


def updated_column() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


def controlled_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    return Enum(enum_cls, name=name, values_callable=lambda items: [item.value for item in items])


class RoleName(str, enum.Enum):
    citizen = "citizen"
    hospital_staff = "hospital_staff"
    state_representative = "state_representative"
    cpgrams_officer = "cpgrams_officer"
    admin = "admin"


class IdentityVerificationStatus(str, enum.Enum):
    unverified = "unverified"
    verified = "verified"


class AuthorizationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    revoked = "revoked"
    rejected = "rejected"


class DisabilityCategory(str, enum.Enum):
    visual = "visual"
    hearing = "hearing"
    locomotor = "locomotor"
    intellectual = "intellectual"
    mental_illness = "mental_illness"
    multiple = "multiple"
    other = "other"


class CertificateStatus(str, enum.Enum):
    not_applied = "not_applied"
    pending = "pending"
    under_assessment = "under_assessment"
    approved = "approved"
    rejected = "rejected"
    expired = "expired"


class UdidStatus(str, enum.Enum):
    not_started = "not_started"
    pending = "pending"
    issued = "issued"
    rejected = "rejected"


class AppointmentMethod(str, enum.Enum):
    api = "api"
    portal = "portal"
    manual = "manual"
    offline = "offline"


class CaseType(str, enum.Enum):
    disability_certificate = "disability_certificate"
    benefit = "benefit"
    grievance = "grievance"
    inquiry = "inquiry"
    other = "other"


class CaseStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    waiting_on_citizen = "waiting_on_citizen"
    waiting_on_authority = "waiting_on_authority"
    resolved = "resolved"
    closed = "closed"
    cancelled = "cancelled"


class CasePriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class StepStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    blocked = "blocked"
    skipped = "skipped"


class AppointmentStatus(str, enum.Enum):
    available = "available"
    booked = "booked"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class BookingMethod(str, enum.Enum):
    mock_api = "mock_api"
    portal = "portal"
    manual = "manual"
    offline = "offline"


class DocumentStatus(str, enum.Enum):
    pending_review = "pending_review"
    verified = "verified"
    rejected = "rejected"
    expired = "expired"


class PermissionType(str, enum.Enum):
    view = "view"
    download = "download"


class BenefitApplicationStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    withdrawn = "withdrawn"


class RuleOperator(str, enum.Enum):
    eq = "eq"
    ne = "ne"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"
    in_ = "in"
    contains = "contains"
    exists = "exists"


class GrievanceStatus(str, enum.Enum):
    submitted = "submitted"
    acknowledged = "acknowledged"
    assigned = "assigned"
    under_review = "under_review"
    action_taken = "action_taken"
    response_sent = "response_sent"
    citizen_accepted = "citizen_accepted"
    citizen_rejected = "citizen_rejected"
    escalated = "escalated"
    closed = "closed"


class GrievanceType(str, enum.Enum):
    cpgrams = "cpgrams"
    rights_violation = "rights_violation"


class EscalationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    resolved = "resolved"
    rejected = "rejected"


class VerificationStatus(str, enum.Enum):
    unverified = "unverified"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class AssistanceStatus(str, enum.Enum):
    requested = "requested"
    contacted = "contacted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()

    roles: Mapped[list["Role"]] = relationship(secondary="user_roles", back_populates="users")
    citizen_profile: Mapped["CitizenProfile | None"] = relationship(back_populates="user")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[RoleName] = mapped_column(controlled_enum(RoleName, "role_name"), nullable=False, unique=True)

    users: Mapped[list[User]] = relationship(secondary="user_roles", back_populates="roles")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)


class CitizenProfile(Base):
    __tablename__ = "citizen_profiles"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    state: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    city: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(Text)
    preferred_language: Mapped[str | None] = mapped_column(String(64))
    is_caregiver: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    accessibility_preferences: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    identity_verification_status: Mapped[IdentityVerificationStatus] = mapped_column(
        controlled_enum(IdentityVerificationStatus, "identity_verification_status"),
        nullable=False,
        default=IdentityVerificationStatus.unverified,
        server_default=IdentityVerificationStatus.unverified.value,
    )
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()

    user: Mapped[User] = relationship(back_populates="citizen_profile")
    disability_profile: Mapped["DisabilityProfile | None"] = relationship(back_populates="citizen")
    cases: Mapped[list["Case"]] = relationship(back_populates="citizen")


class CaregiverRelationship(Base):
    __tablename__ = "caregiver_relationships"

    id: Mapped[uuid.UUID] = uuid_pk()
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizen_profiles.id", ondelete="CASCADE"), nullable=False)
    caregiver_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False)
    authorization_status: Mapped[AuthorizationStatus] = mapped_column(
        controlled_enum(AuthorizationStatus, "authorization_status"),
        nullable=False,
        default=AuthorizationStatus.pending,
        server_default=AuthorizationStatus.pending.value,
    )
    created_at: Mapped[datetime] = now_column()

    __table_args__ = (UniqueConstraint("citizen_id", "caregiver_user_id", name="uq_caregiver_citizen_user"),)


class DisabilityProfile(Base):
    __tablename__ = "disability_profiles"

    id: Mapped[uuid.UUID] = uuid_pk()
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizen_profiles.id", ondelete="CASCADE"), nullable=False, unique=True)
    disability_category: Mapped[DisabilityCategory] = mapped_column(controlled_enum(DisabilityCategory, "disability_category"), nullable=False)
    certificate_status: Mapped[CertificateStatus] = mapped_column(
        controlled_enum(CertificateStatus, "certificate_status"),
        nullable=False,
        default=CertificateStatus.not_applied,
        server_default=CertificateStatus.not_applied.value,
    )
    udid_status: Mapped[UdidStatus] = mapped_column(
        controlled_enum(UdidStatus, "udid_status"),
        nullable=False,
        default=UdidStatus.not_started,
        server_default=UdidStatus.not_started.value,
    )
    percentage_requirement_met: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    broad_disability_status: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()

    citizen: Mapped[CitizenProfile] = relationship(back_populates="disability_profile")


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[uuid.UUID] = uuid_pk()
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizen_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    certificate_type: Mapped[str] = mapped_column(String(100), nullable=False)
    certificate_number_mock: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    issue_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[CertificateStatus] = mapped_column(controlled_enum(CertificateStatus, "certificate_status"), nullable=False)
    issuing_authority: Mapped[str | None] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(100), nullable=False, default="mock", server_default="mock")
    created_at: Mapped[datetime] = now_column()

    __table_args__ = (CheckConstraint("expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date", name="ck_certificate_expiry_after_issue"),)


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    city: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    accessibility_features: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    appointment_method: Mapped[AppointmentMethod] = mapped_column(controlled_enum(AppointmentMethod, "appointment_method"), nullable=False)
    official_url: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()

    departments: Mapped[list["HospitalDepartment"]] = relationship(back_populates="hospital")


class HospitalDepartment(Base):
    __tablename__ = "hospital_departments"

    id: Mapped[uuid.UUID] = uuid_pk()
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    assessment_type: Mapped[str | None] = mapped_column(String(150))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    hospital: Mapped[Hospital] = relationship(back_populates="departments")

    __table_args__ = (UniqueConstraint("hospital_id", "name", name="uq_hospital_department_name"),)


class HospitalStaff(Base):
    __tablename__ = "hospital_staff"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False, index=True)
    job_title: Mapped[str] = mapped_column(String(150), nullable=False)
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hospital_departments.id", ondelete="SET NULL"))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


class StateOffice(Base):
    __tablename__ = "state_offices"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    district: Mapped[str | None] = mapped_column(String(100), index=True)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    official_url: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


class StateRepresentative(Base):
    __tablename__ = "state_representatives"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    state_office_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("state_offices.id", ondelete="RESTRICT"), nullable=False, index=True)
    designation: Mapped[str] = mapped_column(String(150), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


class GovernmentService(Base):
    __tablename__ = "government_services"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str | None] = mapped_column(String(100), index=True)
    authority: Mapped[str | None] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(255))
    eligibility_summary: Mapped[str | None] = mapped_column(Text)
    required_documents_summary: Mapped[str | None] = mapped_column(Text)
    appointment_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    appointment_method: Mapped[AppointmentMethod | None] = mapped_column(controlled_enum(AppointmentMethod, "appointment_method"))
    processing_time: Mapped[str | None] = mapped_column(String(100))
    fee: Mapped[str | None] = mapped_column(String(100))
    official_url: Mapped[str | None] = mapped_column(String(500))
    grievance_authority: Mapped[str | None] = mapped_column(String(255))
    escalation_authority: Mapped[str | None] = mapped_column(String(255))
    last_verified: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = uuid_pk()
    case_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizen_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    case_type: Mapped[CaseType] = mapped_column(controlled_enum(CaseType, "case_type"), nullable=False)
    current_stage: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[CaseStatus] = mapped_column(controlled_enum(CaseStatus, "case_status"), nullable=False, index=True)
    assigned_hospital_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("hospitals.id", ondelete="SET NULL"), index=True)
    assigned_state_office_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("state_offices.id", ondelete="SET NULL"), index=True)
    priority: Mapped[CasePriority] = mapped_column(controlled_enum(CasePriority, "case_priority"), nullable=False, default=CasePriority.normal, server_default=CasePriority.normal.value)
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()

    citizen: Mapped[CitizenProfile] = relationship(back_populates="cases")
    steps: Mapped[list["CaseStep"]] = relationship(back_populates="case", cascade="all, delete-orphan", order_by="CaseStep.step_order")
    events: Mapped[list["CaseEvent"]] = relationship(back_populates="case", cascade="all, delete-orphan", order_by="CaseEvent.created_at")


class CaseStep(Base):
    __tablename__ = "case_steps"

    id: Mapped[uuid.UUID] = uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    step_name: Mapped[str] = mapped_column(String(150), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[StepStatus] = mapped_column(controlled_enum(StepStatus, "step_status"), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_action: Mapped[str | None] = mapped_column(Text)
    responsible_authority: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    case: Mapped[Case] = relationship(back_populates="steps")

    __table_args__ = (
        UniqueConstraint("case_id", "step_order", name="uq_case_step_order"),
        CheckConstraint("step_order > 0", name="ck_case_step_order_positive"),
    )


class CaseEvent(Base):
    __tablename__ = "case_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = now_column()

    case: Mapped[Case] = relationship(back_populates="events")


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = uuid_pk()
    appointment_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizen_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id", ondelete="RESTRICT"), nullable=False, index=True)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospital_departments.id", ondelete="RESTRICT"), nullable=False)
    appointment_date: Mapped[date] = mapped_column(Date, nullable=False)
    appointment_time: Mapped[time] = mapped_column(Time, nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(controlled_enum(AppointmentStatus, "appointment_status"), nullable=False)
    booking_method: Mapped[BookingMethod] = mapped_column(controlled_enum(BookingMethod, "booking_method"), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()

    __table_args__ = (Index("ix_appointments_hospital_date", "hospital_id", "appointment_date"),)


class AppointmentSlot(Base):
    __tablename__ = "appointment_slots"

    id: Mapped[uuid.UUID] = uuid_pk()
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospital_departments.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    booked_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("hospital_id", "department_id", "date", "start_time", name="uq_appointment_slot"),
        CheckConstraint("capacity > 0", name="ck_slot_capacity_positive"),
        CheckConstraint("booked_count >= 0 AND booked_count <= capacity", name="ck_slot_booked_count_valid"),
        CheckConstraint("end_time > start_time", name="ck_slot_time_order"),
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizen_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cases.id", ondelete="SET NULL"), index=True)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_reference: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    status: Mapped[DocumentStatus] = mapped_column(controlled_enum(DocumentStatus, "document_status"), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    uploaded_at: Mapped[datetime] = now_column()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DocumentPermission(Base):
    __tablename__ = "document_permissions"

    id: Mapped[uuid.UUID] = uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    granted_to_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_type: Mapped[PermissionType] = mapped_column(controlled_enum(PermissionType, "permission_type"), nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = now_column()

    __table_args__ = (
        UniqueConstraint("document_id", "granted_to_user_id", "permission_type", name="uq_document_permission_grant"),
        CheckConstraint("valid_until IS NULL OR valid_until > valid_from", name="ck_document_permission_window"),
    )


class Benefit(Base):
    __tablename__ = "benefits"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str | None] = mapped_column(String(100), index=True)
    authority: Mapped[str | None] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    application_url: Mapped[str | None] = mapped_column(String(500))
    deadline: Mapped[date | None] = mapped_column(Date)
    renewal_period: Mapped[str | None] = mapped_column(String(100))
    source_url: Mapped[str | None] = mapped_column(String(500))
    last_verified: Mapped[date | None] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()

    rules: Mapped[list["BenefitEligibilityRule"]] = relationship(back_populates="benefit", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("name", "state", name="uq_benefit_name_state"),)


class BenefitEligibilityRule(Base):
    __tablename__ = "benefit_eligibility_rules"

    id: Mapped[uuid.UUID] = uuid_pk()
    benefit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("benefits.id", ondelete="CASCADE"), nullable=False, index=True)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    operator: Mapped[RuleOperator] = mapped_column(controlled_enum(RuleOperator, "rule_operator"), nullable=False)
    comparison_value: Mapped[str | None] = mapped_column(String(255))
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = now_column()

    benefit: Mapped[Benefit] = relationship(back_populates="rules")


class BenefitApplication(Base):
    __tablename__ = "benefit_applications"

    id: Mapped[uuid.UUID] = uuid_pk()
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizen_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    benefit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("benefits.id", ondelete="RESTRICT"), nullable=False, index=True)
    status: Mapped[BenefitApplicationStatus] = mapped_column(controlled_enum(BenefitApplicationStatus, "benefit_application_status"), nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = updated_column()
    missing_information: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class Grievance(Base):
    __tablename__ = "grievances"

    id: Mapped[uuid.UUID] = uuid_pk()
    grievance_number: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizen_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cases.id", ondelete="SET NULL"), index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    grievance_type: Mapped[GrievanceType] = mapped_column(
        controlled_enum(GrievanceType, "grievance_type"), nullable=False, index=True, server_default="cpgrams"
    )
    status: Mapped[GrievanceStatus] = mapped_column(controlled_enum(GrievanceStatus, "grievance_status"), nullable=False, index=True)
    assigned_state_office_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("state_offices.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    actions: Mapped[list["GrievanceAction"]] = relationship(back_populates="grievance", cascade="all, delete-orphan", order_by="GrievanceAction.created_at")


class GrievanceAction(Base):
    __tablename__ = "grievance_actions"

    id: Mapped[uuid.UUID] = uuid_pk()
    grievance_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("grievances.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = now_column()

    grievance: Mapped[Grievance] = relationship(back_populates="actions")


class GrievanceEscalation(Base):
    __tablename__ = "grievance_escalations"

    id: Mapped[uuid.UUID] = uuid_pk()
    grievance_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("grievances.id", ondelete="CASCADE"), nullable=False, index=True)
    from_authority: Mapped[str] = mapped_column(String(255), nullable=False)
    to_authority: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[EscalationStatus] = mapped_column(controlled_enum(EscalationStatus, "escalation_status"), nullable=False)
    created_at: Mapped[datetime] = now_column()
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Ngo(Base):
    __tablename__ = "ngos"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    district: Mapped[str | None] = mapped_column(String(100), index=True)
    city: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(500))
    services: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    disability_categories: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    languages: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    accessibility_features: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    verification_status: Mapped[VerificationStatus] = mapped_column(controlled_enum(VerificationStatus, "verification_status"), nullable=False)
    is_mock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = now_column()

    __table_args__ = (UniqueConstraint("name", "state", name="uq_ngo_name_state"),)


class NgoAssistanceRequest(Base):
    __tablename__ = "ngo_assistance_requests"

    id: Mapped[uuid.UUID] = uuid_pk()
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("citizen_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    ngo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ngos.id", ondelete="RESTRICT"), nullable=False, index=True)
    assistance_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[AssistanceStatus] = mapped_column(controlled_enum(AssistanceStatus, "assistance_status"), nullable=False)
    created_at: Mapped[datetime] = now_column()
    updated_at: Mapped[datetime] = updated_column()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(100), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = now_column()


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = uuid_pk()
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    actor_role: Mapped[str | None] = mapped_column(String(100))
    action: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    metadata_json: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = now_column()

    __table_args__ = (Index("ix_audit_logs_resource", "resource_type", "resource_id"),)
