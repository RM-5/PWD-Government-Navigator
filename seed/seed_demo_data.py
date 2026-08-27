from __future__ import annotations

import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from database.session import get_engine, get_session_factory
from models.schema import (
    Appointment,
    AppointmentMethod,
    AppointmentSlot,
    AppointmentStatus,
    AssistanceStatus,
    Benefit,
    BenefitApplication,
    BenefitApplicationStatus,
    BenefitEligibilityRule,
    BookingMethod,
    Case,
    CaseEvent,
    CasePriority,
    CaseStatus,
    CaseStep,
    CaseType,
    CertificateStatus,
    CitizenProfile,
    DisabilityCategory,
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
    IdentityVerificationStatus,
    Ngo,
    NgoAssistanceRequest,
    Notification,
    PermissionType,
    Role,
    RoleName,
    RuleOperator,
    StateOffice,
    StateRepresentative,
    StepStatus,
    UdidStatus,
    User,
    UserRole,
    VerificationStatus,
)

NAMESPACE = uuid.UUID("85bc37aa-7429-4576-bdc6-5d18c560d9f1")


def demo_id(name: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, name)


def add_if_missing(session: Session, instance, key_field: str = "id") -> None:
    if session.get(type(instance), getattr(instance, key_field)) is None:
        session.add(instance)


def seed(session: Session) -> None:
    roles = {
        RoleName.citizen: demo_id("role:citizen"),
        RoleName.hospital_staff: demo_id("role:hospital_staff"),
        RoleName.state_representative: demo_id("role:state_representative"),
        RoleName.admin: demo_id("role:admin"),
    }
    for name, role_id in roles.items():
        add_if_missing(session, Role(id=role_id, name=name))

    users = {
        "citizen": User(id=demo_id("user:citizen"), email="citizen@demo.local", password_hash="mock-hash-citizen", full_name="Rahul Sharma", phone="+91-9876500001"),
        "hospital": User(id=demo_id("user:hospital"), email="hospital@demo.local", password_hash="mock-hash-hospital", full_name="Dr. Ananya Mehta", phone="+91-9876500002"),
        "state": User(id=demo_id("user:state"), email="state@demo.local", password_hash="mock-hash-state", full_name="Meera Iyer", phone="+91-9876500003"),
        "admin": User(id=demo_id("user:admin"), email="admin@demo.local", password_hash="mock-hash-admin", full_name="Platform Admin", phone="+91-9876500004"),
    }
    for user in users.values():
        add_if_missing(session, user)
    session.flush()

    for user_key, role_name in [
        ("citizen", RoleName.citizen),
        ("hospital", RoleName.hospital_staff),
        ("state", RoleName.state_representative),
        ("admin", RoleName.admin),
    ]:
        key = {"user_id": users[user_key].id, "role_id": roles[role_name]}
        if session.get(UserRole, key) is None:
            session.add(UserRole(**key))

    citizen = CitizenProfile(
        id=demo_id("citizen:rahul"),
        user_id=users["citizen"].id,
        date_of_birth=date(2005, 8, 25),
        state="Delhi",
        district="New Delhi",
        city="New Delhi",
        address="Mock address, Connaught Place, New Delhi",
        preferred_language="Hindi",
        accessibility_preferences={"screen_reader": True, "large_text": True, "sms_updates": True},
        identity_verification_status=IdentityVerificationStatus.verified,
    )
    add_if_missing(session, citizen)
    session.flush()

    add_if_missing(
        session,
        DisabilityProfile(
            id=demo_id("disability:rahul"),
            citizen_id=citizen.id,
            disability_category=DisabilityCategory.visual,
            certificate_status=CertificateStatus.pending,
            udid_status=UdidStatus.pending,
            percentage_requirement_met=True,
            broad_disability_status="benchmark_disability_likely",
        ),
    )

    hospital = Hospital(
        id=demo_id("hospital:delhi-gov"),
        name="Delhi Government Hospital",
        state="Delhi",
        district="New Delhi",
        city="New Delhi",
        address="Mock Civil Lines Road, New Delhi",
        phone="+91-11-20000000",
        email="appointments@delhigovhospital.demo",
        accessibility_features={"wheelchair_access": True, "priority_counter": True, "screen_reader_kiosk": True},
        appointment_method=AppointmentMethod.api,
        official_url="https://example.gov.in/delhi-hospital",
    )
    add_if_missing(session, hospital)
    session.flush()

    department = HospitalDepartment(
        id=demo_id("department:ophthalmology-board"),
        hospital_id=hospital.id,
        name="Ophthalmology / Disability Medical Board",
        description="Mock board for visual disability assessment and certification workflow.",
        assessment_type="visual_disability_certificate",
    )
    add_if_missing(session, department)
    session.flush()

    add_if_missing(
        session,
        HospitalStaff(id=demo_id("hospital-staff:ananya"), user_id=users["hospital"].id, hospital_id=hospital.id, job_title="Medical Board Coordinator", department_id=department.id),
    )

    state_office = StateOffice(
        id=demo_id("state-office:delhi-representative"),
        name="State Representative Office",
        state="Delhi",
        district="New Delhi",
        address="Mock Secretariat Annexe, New Delhi",
        phone="+91-11-20000001",
        email="representative.pwd@delhi.demo",
        official_url="https://example.org/delhi-state-representative",
    )
    add_if_missing(session, state_office)
    session.flush()
    add_if_missing(
        session,
        StateRepresentative(id=demo_id("state-rep:meera"), user_id=users["state"].id, state_office_id=state_office.id, designation="State Representative"),
    )

    add_if_missing(
        session,
        GovernmentService(
            id=demo_id("service:disability-certificate-delhi"),
            name="Disability Certificate and UDID Support",
            category="certificate",
            description="Mock registry entry explaining the disability certificate journey for citizens in Delhi.",
            state="Delhi",
            authority="Delhi Government Hospital Medical Board",
            department="Department of Health and Family Welfare",
            eligibility_summary="Citizen requires assessment by notified medical board for disability certification.",
            required_documents_summary="Identity proof reference, address proof reference, photographs, medical assessment notes.",
            appointment_required=True,
            appointment_method=AppointmentMethod.api,
            processing_time="21-30 working days",
            fee="No fee for mock demo",
            official_url="https://example.gov.in/disability-certificate",
            grievance_authority="State Representative Office",
            escalation_authority="State Representative Escalation Cell",
            last_verified=date(2026, 8, 25),
        ),
    )

    benefits = [
        ("Delhi Transport Concession Pass", "mobility", "Delhi", "Concession travel support for eligible PwD citizens."),
        ("Disability Pension Assistance", "financial_support", "Delhi", "Monthly mock pension assistance for benchmark disability."),
        ("Assistive Device Support Grant", "assistive_devices", "Delhi", "Support for screen readers, canes, magnifiers, or mobility aids."),
        ("Scholarship for Students with Disabilities", "education", "Delhi", "Mock education scholarship for students with disability certificates."),
        ("Skill Training Placement Support", "employment", "Delhi", "Training and job linkage support for eligible PwD citizens."),
        ("Income Tax Disability Deduction Guidance", "tax", None, "Central guidance registry item for disability-related deduction awareness."),
        ("Accessible Housing Priority Assistance", "housing", "Delhi", "Mock housing priority marker for eligible disability profiles."),
        ("Caregiver Travel Support", "caregiver", "Delhi", "Support workflow for authorized caregivers assisting citizens."),
        ("UDID Linked Benefit Discovery", "benefit_discovery", None, "Central mock service to discover schemes using certificate status flags."),
        ("Emergency Medical Board Review", "healthcare", "Delhi", "Priority review pathway for delayed disability certificate assessment."),
    ]
    for index, (name, category, state, description) in enumerate(benefits, start=1):
        benefit_id = demo_id(f"benefit:{index}:{name}")
        add_if_missing(
            session,
            Benefit(
                id=benefit_id,
                name=name,
                description=description,
                state=state,
                authority="Mock Disability Welfare Authority",
                category=category,
                application_url=f"https://example.gov.in/benefits/{index}",
                renewal_period="Annual" if index in {1, 2, 4} else "As needed",
                source_url=f"https://example.gov.in/mock-source/{index}",
                last_verified=date(2026, 8, 25),
                is_mock=True,
            ),
        )
        session.flush()
        add_if_missing(session, BenefitEligibilityRule(id=demo_id(f"benefit-rule:{index}:benchmark"), benefit_id=benefit_id, field_name="percentage_requirement_met", operator=RuleOperator.eq, comparison_value="true", required=True))
        if state:
            add_if_missing(session, BenefitEligibilityRule(id=demo_id(f"benefit-rule:{index}:state"), benefit_id=benefit_id, field_name="state", operator=RuleOperator.eq, comparison_value=state, required=True))

    ngos = [
        ("Vision Access Foundation", "New Delhi", ["visual"], ["mobility_training", "screen_reader_support"]),
        ("Saksham Disability Support Centre", "South Delhi", ["visual", "locomotor"], ["document_help", "benefit_guidance"]),
        ("Delhi Accessible Rights Collective", "Central Delhi", ["multiple"], ["grievance_support", "legal_awareness"]),
        ("Nayi Disha Assistive Services", "West Delhi", ["intellectual", "multiple"], ["caregiver_guidance", "appointments"]),
        ("Inclusive Education Trust Delhi", "New Delhi", ["visual", "hearing"], ["scholarship_help", "education_support"]),
    ]
    for index, (name, district, categories, services) in enumerate(ngos, start=1):
        add_if_missing(
            session,
            Ngo(
                id=demo_id(f"ngo:{index}:{name}"),
                name=name,
                description=f"Mock NGO profile for {', '.join(services).replace('_', ' ')}.",
                state="Delhi",
                district=district,
                city="New Delhi",
                address=f"Mock NGO address {index}, Delhi",
                phone=f"+91-11-3000000{index}",
                email=f"contact{index}@ngo.demo",
                website=f"https://ngo{index}.example.org",
                services=services,
                disability_categories=categories,
                languages=["Hindi", "English"],
                accessibility_features={"phone_support": True, "accessible_office": True},
                verification_status=VerificationStatus.verified,
                is_mock=True,
            ),
        )
    session.flush()

    case = Case(
        id=demo_id("case:rahul-certificate"),
        case_number="CASE-2026-00184",
        citizen_id=citizen.id,
        case_type=CaseType.disability_certificate,
        current_stage="Appointment",
        status=CaseStatus.in_progress,
        assigned_hospital_id=hospital.id,
        assigned_state_office_id=state_office.id,
        priority=CasePriority.normal,
    )
    add_if_missing(session, case)
    session.flush()

    steps = [
        ("Profile", StepStatus.completed, "Citizen profile verified", "Platform"),
        ("Service identified", StepStatus.completed, "Disability certificate service matched", "Platform"),
        ("Hospital identified", StepStatus.completed, "Delhi Government Hospital selected", "Platform"),
        ("Appointment", StepStatus.in_progress, "Attend assessment appointment", "Hospital"),
        ("Medical assessment", StepStatus.not_started, "Medical board assessment pending", "Hospital"),
        ("Certificate", StepStatus.not_started, "Certificate decision pending", "Hospital"),
        ("Benefits", StepStatus.not_started, "Discover eligible schemes after certificate update", "Platform"),
        ("Grievance", StepStatus.not_started, "Available if case is delayed", "State Office"),
        ("Escalation", StepStatus.not_started, "Escalate if grievance remains unresolved", "State Office"),
    ]
    for order, (name, status, next_action, authority) in enumerate(steps, start=1):
        add_if_missing(
            session,
            CaseStep(
                id=demo_id(f"case-step:{order}:{name}"),
                case_id=case.id,
                step_name=name,
                step_order=order,
                status=status,
                completed_at=datetime(2026, 8, 25, 9, order, tzinfo=timezone.utc) if status == StepStatus.completed else None,
                next_action=next_action,
                responsible_authority=authority,
            ),
        )

    add_if_missing(session, CaseEvent(id=demo_id("case-event:created"), case_id=case.id, actor_user_id=users["citizen"].id, event_type="case_created", description="Rahul started a mock disability certificate journey."))
    add_if_missing(session, CaseEvent(id=demo_id("case-event:hospital-assigned"), case_id=case.id, actor_user_id=users["admin"].id, event_type="hospital_assigned", description="Delhi Government Hospital assigned for ophthalmology board assessment."))

    for day in range(1, 6):
        slot_date = date(2026, 8, 25 + day)
        for hour in (10, 11):
            add_if_missing(
                session,
                AppointmentSlot(
                    id=demo_id(f"slot:{slot_date.isoformat()}:{hour}"),
                    hospital_id=hospital.id,
                    department_id=department.id,
                    date=slot_date,
                    start_time=time(hour, 0),
                    end_time=time(hour, 30),
                    capacity=6,
                    booked_count=1 if day == 1 and hour == 10 else 0,
                ),
            )
    session.flush()

    add_if_missing(
        session,
        Appointment(
            id=demo_id("appointment:rahul-initial"),
            appointment_number="APT-2026-00042",
            citizen_id=citizen.id,
            case_id=case.id,
            hospital_id=hospital.id,
            department_id=department.id,
            appointment_date=date(2026, 8, 26),
            appointment_time=time(10, 0),
            status=AppointmentStatus.confirmed,
            booking_method=BookingMethod.mock_api,
            notes="Mock API booking for visual disability assessment.",
        ),
    )

    document = Document(
        id=demo_id("document:rahul-address-proof"),
        citizen_id=citizen.id,
        case_id=case.id,
        document_type="address_proof_reference",
        filename="rahul-address-proof-mock.pdf",
        mime_type="application/pdf",
        storage_reference="s3://mock-disability-navigator/documents/rahul-address-proof-mock.pdf",
        status=DocumentStatus.verified,
    )
    add_if_missing(session, document)
    session.flush()
    add_if_missing(session, DocumentPermission(id=demo_id("document-permission:hospital-view"), document_id=document.id, granted_to_user_id=users["hospital"].id, permission_type=PermissionType.view))

    add_if_missing(
        session,
        BenefitApplication(
            id=demo_id("benefit-application:rahul-transport"),
            citizen_id=citizen.id,
            benefit_id=demo_id("benefit:1:Delhi Transport Concession Pass"),
            status=BenefitApplicationStatus.draft,
            missing_information="Certificate approval required before submission.",
            notes="Demo draft application created for Rahul.",
        ),
    )

    grievance = Grievance(
        id=demo_id("grievance:rahul-delay"),
        grievance_number="GRV-2026-00031",
        citizen_id=citizen.id,
        case_id=case.id,
        category="appointment_delay",
        subject="Delay concern for medical board assessment",
        description="Mock grievance showing how a citizen can request help if assessment is delayed.",
        status=GrievanceStatus.acknowledged,
        assigned_state_office_id=state_office.id,
    )
    add_if_missing(session, grievance)
    session.flush()
    add_if_missing(session, GrievanceAction(id=demo_id("grievance-action:acknowledged"), grievance_id=grievance.id, actor_user_id=users["state"].id, action_type="acknowledged", message="State representative acknowledged the demo grievance and requested hospital status."))

    add_if_missing(session, NgoAssistanceRequest(id=demo_id("ngo-request:rahul-vision-access"), citizen_id=citizen.id, ngo_id=demo_id("ngo:1:Vision Access Foundation"), assistance_type="appointment_preparation", description="Rahul requested help preparing documents for the hospital appointment.", status=AssistanceStatus.requested))
    add_if_missing(session, Notification(id=demo_id("notification:rahul-appointment"), user_id=users["citizen"].id, title="Appointment confirmed", body="Your mock medical board appointment is confirmed at Delhi Government Hospital.", notification_type="appointment"))

    session.commit()


def main() -> None:
    engine = get_engine()
    session_factory = get_session_factory(engine)
    with session_factory() as session:
        if session.scalar(select(User).where(User.email == "citizen@demo.local")):
            print("Demo seed data already appears to be present; ensuring missing records are added.")
        seed(session)
        print("Demo seed data loaded.")


if __name__ == "__main__":
    main()
