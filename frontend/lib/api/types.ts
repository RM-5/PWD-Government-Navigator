/* ── Backend response types matching FastAPI Pydantic schemas ── */

export type Role = 'citizen' | 'hospital' | 'state' | 'admin';

/* ── Auth ── */
export interface UserRole {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  roles: UserRole[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

/* ── Citizen ── */
export interface CitizenProfile {
  id: string;
  user_id: string;
  date_of_birth: string | null;
  state: string;
  district: string;
  city: string | null;
  address: string | null;
  preferred_language: string | null;
  accessibility_preferences: Record<string, boolean> | null;
  identity_verification_status: string;
}

export interface DisabilityProfile {
  id: string;
  citizen_id: string;
  disability_category: string;
  certificate_status: string;
  udid_status: string;
  percentage_requirement_met: boolean;
  broad_disability_status: string | null;
}

/* ── Cases ── */
export interface CaseStep {
  id: string;
  step_name: string;
  step_order: number;
  status: string;
  completed_at: string | null;
  next_action: string | null;
  responsible_authority: string | null;
}

export interface CaseEvent {
  id: string;
  actor_user_id: string;
  event_type: string;
  description: string;
  created_at: string;
}

export interface CaseBasic {
  id: string;
  case_number: string;
  citizen_id: string;
  case_type: string;
  current_stage: string;
  status: string;
  assigned_hospital_id: string | null;
  assigned_state_office_id: string | null;
  priority: string;
  created_at: string;
}

export interface CaseDetail extends CaseBasic {
  steps: CaseStep[];
  events: CaseEvent[];
}

/* ── Hospitals ── */
export interface HospitalDepartment {
  id: string;
  hospital_id: string;
  name: string;
  description: string | null;
  assessment_type: string | null;
  active: boolean;
}

export interface Hospital {
  id: string;
  name: string;
  state: string;
  district: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  accessibility_features: Record<string, boolean> | null;
  appointment_method: string | null;
  official_url: string | null;
  active: boolean;
  departments: HospitalDepartment[];
}

/* ── Appointments ── */
export interface AppointmentSlot {
  id: string;
  hospital_id: string;
  department_id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  active: boolean;
}

export interface Appointment {
  id: string;
  appointment_number: string;
  citizen_id: string;
  case_id: string;
  hospital_id: string;
  department_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  booking_method: string;
  notes: string | null;
  created_at: string;
}

/* ── Benefits ── */
export interface BenefitRule {
  id: string;
  field_name: string;
  operator: string;
  comparison_value: string | null;
  required: boolean;
}

export interface Benefit {
  id: string;
  name: string;
  description: string | null;
  state: string | null;
  authority: string | null;
  category: string;
  application_url: string | null;
  is_active: boolean;
  rules: BenefitRule[];
}

export interface BenefitEligibility {
  benefit_id: string;
  eligible: boolean;
  matched_rules: string[];
  missing_rules: string[];
}

export interface BenefitApplication {
  id: string;
  citizen_id: string;
  benefit_id: string;
  status: string;
  submitted_at: string | null;
  missing_information: string | null;
  notes: string | null;
}

/* ── Documents ── */
export interface Document {
  id: string;
  citizen_id: string;
  case_id: string | null;
  document_type: string;
  filename: string;
  mime_type: string;
  storage_reference: string;
  status: string;
  uploaded_at: string;
}

/* ── Grievances ── */
export interface GrievanceAction {
  id: string;
  actor_user_id: string;
  action_type: string;
  message: string | null;
  created_at: string;
}

export interface Grievance {
  id: string;
  grievance_number: string;
  citizen_id: string;
  case_id: string | null;
  category: string;
  subject: string;
  description: string;
  status: string;
  assigned_state_office_id: string | null;
  resolved_at: string | null;
  created_at: string;
  actions: GrievanceAction[];
}

/* ── NGOs ── */
export interface Ngo {
  id: string;
  name: string;
  description: string | null;
  state: string;
  district: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  services: string[] | null;
  disability_categories: string[] | null;
  languages: string[] | null;
  accessibility_features: Record<string, boolean> | null;
  verification_status: string;
}

export interface NgoAssistanceRequest {
  id: string;
  citizen_id: string;
  ngo_id: string;
  assistance_type: string;
  description: string;
  status: string;
  created_at: string;
}

/* ── Services ── */
export interface GovernmentService {
  id: string;
  name: string;
  category: string;
  description: string | null;
  state: string | null;
  authority: string | null;
  department: string | null;
  eligibility_summary: string | null;
  appointment_required: boolean;
  appointment_method: string | null;
  processing_time: string | null;
  fee: string | null;
  official_url: string | null;
  is_active: boolean;
}

/* ── Notifications ── */
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  read_at: string | null;
  created_at: string;
}

/* ── Admin ── */
export interface AdminSummary {
  users: number;
  citizens: number;
  open_cases: number;
  grievances: number;
  benefits: number;
  hospitals: number;
  ngos: number;
}

/* ── Composed frontend types ── */
export interface Dashboard {
  name: string;
  user: User;
  profile: CitizenProfile;
  disability: DisabilityProfile | null;
  cases: CaseBasic[];
  nextStep: { title: string; date: string; hospital: string; caseId: string } | null;
  journey: { label: string; status: 'done' | 'current' | 'pending'; href?: string }[];
  metrics: { label: string; value: string; detail: string }[];
}

// Re-export Case as the detail version for component use
export type Case = CaseDetail;

/* ── Certificates & UDID ── */
export interface Certificate {
  id: string;
  citizen_id: string;
  certificate_type: string;
  certificate_number_mock: string;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  issuing_authority: string | null;
  source: string;
  created_at: string;
}

export interface UdidCardData {
  udid_number: string;
  citizen_name: string;
  date_of_birth: string | null;
  gender: string;
  state: string;
  district: string;
  disability_category: string;
  disability_percentage: number;
  validity: string;
  issue_date: string;
  issuing_hospital: string;
  barcode_reference: string;
  status: string;
}

export interface HospitalAssessmentCase {
  case: CaseDetail;
  citizen: CitizenProfile;
  user_name: string;
  user_email: string;
  disability_profile: DisabilityProfile | null;
  appointment: Appointment | null;
  documents: Document[];
  certificate: Certificate | null;
  udid_card: UdidCardData | null;
}

export interface CertificateDecisionCreate {
  case_id: string;
  decision: 'approve' | 'reject';
  disability_percentage?: number;
  is_permanent?: boolean;
  validity_years?: number;
  medical_remarks?: string;
  rejection_reason?: string;
}

export interface CertificateDecisionResult {
  success: boolean;
  decision: string;
  message: string;
  case: CaseDetail;
  disability_profile: DisabilityProfile;
  certificate: Certificate | null;
  udid_card: UdidCardData | null;
}
