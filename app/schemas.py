from __future__ import annotations

from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from models.schema import (
    AppointmentStatus,
    AssistanceStatus,
    BenefitApplicationStatus,
    BookingMethod,
    CasePriority,
    CaseStatus,
    CaseType,
    CertificateStatus,
    DisabilityCategory,
    DocumentStatus,
    GrievanceStatus,
    PermissionType,
    RoleName,
    UdidStatus,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RoleOut(ORMModel):
    id: UUID
    name: RoleName


class UserOut(ORMModel):
    id: UUID
    email: str
    full_name: str
    phone: str | None = None
    is_active: bool
    roles: list[RoleOut] = []


class LoginRequest(BaseModel):
    email: str
    password: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CitizenProfileOut(ORMModel):
    id: UUID
    user_id: UUID
    date_of_birth: date | None = None
    state: str
    district: str
    city: str | None = None
    address: str | None = None
    preferred_language: str | None = None
    is_caregiver: bool
    accessibility_preferences: dict = {}
    identity_verification_status: str
    created_at: datetime
    updated_at: datetime


class CitizenProfileUpdate(BaseModel):
    city: str | None = None
    address: str | None = None
    preferred_language: str | None = None
    accessibility_preferences: dict | None = None


class DisabilityProfileOut(ORMModel):
    id: UUID
    citizen_id: UUID
    disability_category: DisabilityCategory
    certificate_status: CertificateStatus
    udid_status: UdidStatus
    percentage_requirement_met: bool
    broad_disability_status: str | None = None


class GovernmentServiceOut(ORMModel):
    id: UUID
    name: str
    category: str
    description: str
    state: str | None = None
    authority: str | None = None
    department: str | None = None
    eligibility_summary: str | None = None
    required_documents_summary: str | None = None
    appointment_required: bool
    appointment_method: str | None = None
    processing_time: str | None = None
    fee: str | None = None
    official_url: str | None = None
    grievance_authority: str | None = None
    escalation_authority: str | None = None
    last_verified: date | None = None
    is_active: bool


class HospitalDepartmentOut(ORMModel):
    id: UUID
    hospital_id: UUID
    name: str
    description: str | None = None
    assessment_type: str | None = None
    active: bool


class HospitalOut(ORMModel):
    id: UUID
    name: str
    state: str
    district: str
    city: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    accessibility_features: dict = {}
    appointment_method: str
    official_url: str | None = None
    active: bool
    departments: list[HospitalDepartmentOut] = []


class AppointmentSlotOut(ORMModel):
    id: UUID
    hospital_id: UUID
    department_id: UUID
    date: date
    start_time: time
    end_time: time
    capacity: int
    booked_count: int
    active: bool


class AppointmentCreate(BaseModel):
    case_id: UUID
    hospital_id: UUID
    department_id: UUID
    appointment_date: date
    appointment_time: time
    booking_method: BookingMethod = BookingMethod.mock_api
    notes: str | None = None


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus
    notes: str | None = None


class AppointmentOut(ORMModel):
    id: UUID
    appointment_number: str
    citizen_id: UUID
    case_id: UUID
    hospital_id: UUID
    department_id: UUID
    appointment_date: date
    appointment_time: time
    status: AppointmentStatus
    booking_method: BookingMethod
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class CaseCreate(BaseModel):
    case_type: CaseType = CaseType.disability_certificate
    assigned_hospital_id: UUID | None = None
    assigned_state_office_id: UUID | None = None
    priority: CasePriority = CasePriority.normal


class CaseStatusUpdate(BaseModel):
    current_stage: str | None = None
    status: CaseStatus | None = None
    priority: CasePriority | None = None


class CaseStepOut(ORMModel):
    id: UUID
    step_name: str
    step_order: int
    status: str
    completed_at: datetime | None = None
    next_action: str | None = None
    responsible_authority: str | None = None
    notes: str | None = None


class CaseEventOut(ORMModel):
    id: UUID
    actor_user_id: UUID | None = None
    event_type: str
    description: str
    created_at: datetime


class CaseOut(ORMModel):
    id: UUID
    case_number: str
    citizen_id: UUID
    case_type: CaseType
    current_stage: str
    status: CaseStatus
    assigned_hospital_id: UUID | None = None
    assigned_state_office_id: UUID | None = None
    priority: CasePriority
    created_at: datetime
    updated_at: datetime


class CaseDetailOut(CaseOut):
    steps: list[CaseStepOut] = []
    events: list[CaseEventOut] = []


class CaseEventCreate(BaseModel):
    event_type: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=2)


class BenefitRuleOut(ORMModel):
    id: UUID
    field_name: str
    operator: str
    comparison_value: str | None = None
    required: bool


class BenefitOut(ORMModel):
    id: UUID
    name: str
    description: str
    state: str | None = None
    authority: str | None = None
    category: str
    application_url: str | None = None
    deadline: date | None = None
    renewal_period: str | None = None
    source_url: str | None = None
    last_verified: date | None = None
    active: bool
    is_mock: bool
    rules: list[BenefitRuleOut] = []


class BenefitEligibilityOut(BaseModel):
    benefit_id: UUID
    eligible: bool
    matched_rules: list[str]
    missing_rules: list[str]


class BenefitApplicationCreate(BaseModel):
    benefit_id: UUID
    notes: str | None = None


class BenefitApplicationOut(ORMModel):
    id: UUID
    citizen_id: UUID
    benefit_id: UUID
    status: BenefitApplicationStatus
    submitted_at: datetime | None = None
    updated_at: datetime
    missing_information: str | None = None
    notes: str | None = None


class DocumentCreate(BaseModel):
    case_id: UUID | None = None
    document_type: str = Field(min_length=2, max_length=100)
    filename: str = Field(min_length=2, max_length=255)
    mime_type: str = Field(min_length=3, max_length=100)
    storage_reference: str = Field(min_length=5, max_length=500)


class DocumentOut(ORMModel):
    id: UUID
    citizen_id: UUID
    case_id: UUID | None = None
    document_type: str
    filename: str
    mime_type: str
    storage_reference: str
    status: DocumentStatus
    expires_at: datetime | None = None
    uploaded_at: datetime
    deleted_at: datetime | None = None


class DocumentPermissionCreate(BaseModel):
    granted_to_user_id: UUID
    permission_type: PermissionType = PermissionType.view
    valid_until: datetime | None = None


class DocumentPermissionOut(ORMModel):
    id: UUID
    document_id: UUID
    granted_to_user_id: UUID
    permission_type: PermissionType
    valid_from: datetime
    valid_until: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime


class GrievanceCreate(BaseModel):
    case_id: UUID | None = None
    category: str = Field(min_length=2, max_length=100)
    subject: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=2)


class GrievanceStatusUpdate(BaseModel):
    status: GrievanceStatus
    message: str | None = None


class GrievanceActionOut(ORMModel):
    id: UUID
    grievance_id: UUID
    actor_user_id: UUID | None = None
    action_type: str
    message: str
    created_at: datetime


class GrievanceOut(ORMModel):
    id: UUID
    grievance_number: str
    citizen_id: UUID
    case_id: UUID | None = None
    category: str
    subject: str
    description: str
    status: GrievanceStatus
    assigned_state_office_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None
    actions: list[GrievanceActionOut] = []


class NgoOut(ORMModel):
    id: UUID
    name: str
    description: str
    state: str
    district: str | None = None
    city: str | None = None
    services: list[str] = []
    disability_categories: list[str] = []
    languages: list[str] = []
    verification_status: str
    is_mock: bool


class NgoAssistanceCreate(BaseModel):
    ngo_id: UUID
    assistance_type: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=2)


class NgoAssistanceOut(ORMModel):
    id: UUID
    citizen_id: UUID
    ngo_id: UUID
    assistance_type: str
    description: str
    status: AssistanceStatus
    created_at: datetime
    updated_at: datetime


class NotificationOut(ORMModel):
    id: UUID
    user_id: UUID
    title: str
    body: str
    notification_type: str
    read_at: datetime | None = None
    created_at: datetime


class SummaryOut(BaseModel):
    users: int
    citizens: int
    open_cases: int
    grievances: int
    benefits: int
    hospitals: int
    ngos: int
