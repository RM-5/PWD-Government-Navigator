import type {
  AdminSummary,
  Appointment,
  AppointmentSlot,
  Benefit,
  BenefitApplication,
  BenefitEligibility,
  CaseBasic,
  CaseDetail,
  Certificate,
  CertificateDecisionCreate,
  CertificateDecisionResult,
  CitizenProfile,
  CitizenJourneyReview,
  Dashboard,
  DisabilityProfile,
  Document,
  GovernmentService,
  Grievance,
  Hospital,
  HospitalAssessmentCase,
  HospitalDepartment,
  LoginResponse,
  Ngo,
  NgoAssistanceRequest,
  Notification,
  Role,
  UdidCardData,
  User,
  WorkflowProgress,
} from './types';

/* ── Helpers ── */

// In the browser, use same-origin /api (proxied by Next.js). On server, call backend directly.
const base = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('demo-token');
}

function getRole(): Role | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('demo-role') as Role | null;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return { 'Content-Type': 'application/json' };
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...init?.headers },
    });
  } catch {
    throw new Error(
      'Cannot reach the backend. Make sure the API is running on port 8000 (npm run backend:dev).'
    );
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`API ${r.status}: ${body || r.statusText}`);
  }
  return r.json();
}

function get<T>(path: string) {
  return request<T>(path);
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

function patch<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

/* ── Auth ── */

const auth = {
  login: async (email: string): Promise<LoginResponse> => {
    const res = await post<LoginResponse>('/api/auth/login', { email });
    if (typeof window !== 'undefined') {
      localStorage.setItem('demo-token', res.access_token);
      const role = res.user.roles?.[0]?.name || 'citizen';
      const roleMap: Record<string, Role> = {
        citizen: 'citizen',
        hospital_staff: 'hospital',
        state_representative: 'state',
        cpgrams_officer: 'cpgrams',
        admin: 'admin',
      };
      localStorage.setItem('demo-role', roleMap[role] || 'citizen');
      localStorage.setItem('demo-user', JSON.stringify(res.user));
    }
    return res;
  },
  me: () => get<User>('/api/auth/me'),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('demo-token');
      localStorage.removeItem('demo-role');
      localStorage.removeItem('demo-user');
    }
    return post<{ status: string }>('/api/auth/logout');
  },
};

/* ── Citizen Profile ── */

const citizen = {
  profile: () => get<CitizenProfile>('/api/citizens/me/profile'),
  disability: () => get<DisabilityProfile>('/api/citizens/me/disability'),
  updateProfile: (data: Partial<CitizenProfile>) => patch<CitizenProfile>('/api/citizens/me/profile', data),

  /** Compose a dashboard from multiple real endpoints */
  dashboard: async (): Promise<Dashboard> => {
    const [user, profile, cases, notifications] = await Promise.all([
      auth.me(),
      citizen.profile(),
      cases_.list(),
      notifications_.list(),
    ]);

    let disability: DisabilityProfile | null = null;
    try {
      disability = await citizen.disability();
    } catch {
      /* no disability profile */
    }

    // Find the active case
    const activeCase = cases.find(
      (c) => c.status === 'open' || c.status === 'in_progress' || c.status === 'waiting_on_citizen'
    );

    // Get case detail for journey steps
    let caseDetail: CaseDetail | null = null;
    if (activeCase) {
      try {
        caseDetail = await cases_.get(activeCase.id);
      } catch {
        /* fallback */
      }
    }

    // Build consolidated journey from real case steps
    let journey: { label: string; status: 'done' | 'current' | 'pending'; href?: string }[] = [];
    if (caseDetail) {
      const stepMap = new Map(caseDetail.steps.map((s) => [s.step_name, s]));
      const getStatus = (stepName: string) => stepMap.get(stepName)?.status;

      const sProfile = getStatus('Profile');
      const sService = getStatus('Service identified');
      const sHospital = getStatus('Hospital identified');

      // 4. Medical Assessment (combines Appointment + Medical assessment)
      const sApt = getStatus('Appointment');
      const sMed = getStatus('Medical assessment');
      let sMedAssessment: 'done' | 'current' | 'pending' = 'pending';
      if (sMed === 'completed') {
        sMedAssessment = 'done';
      } else if (sApt === 'in_progress' || sMed === 'in_progress' || sApt === 'completed') {
        sMedAssessment = 'current';
      }

      const sCert = getStatus('Certificate');
      const sBen = getStatus('Benefits');
      const sPen = getStatus('Pensions');

      const toStatus = (st?: string): 'done' | 'current' | 'pending' =>
        st === 'completed' ? 'done' : st === 'in_progress' ? 'current' : 'pending';

      journey = [
        { label: 'Profile', status: toStatus(sProfile), href: '/citizen' },
        { label: 'Service identified', status: toStatus(sService), href: '/citizen/services' },
        { label: 'Hospital identified', status: toStatus(sHospital), href: '/citizen/medical-assessment' },
        { label: 'Medical Assessment', status: sMedAssessment, href: '/citizen/medical-assessment' },
        { label: 'Certificate', status: toStatus(sCert), href: '/citizen/documents' },
        { label: 'Benefits', status: toStatus(sBen), href: '/citizen/benefits' },
        { label: 'Pensions', status: toStatus(sPen), href: '/citizen/pensions' },
      ];
    }

    let assignedHospitalName = '';
    if (activeCase?.assigned_hospital_id) {
      try {
        assignedHospitalName = (await hospitals.get(activeCase.assigned_hospital_id)).name;
      } catch {
        assignedHospitalName = '';
      }
    }

    // Find next step
    const currentStep = caseDetail?.steps.find((s) => s.status === 'in_progress');
    const nextStep = currentStep
      ? {
          title: currentStep.next_action || currentStep.step_name,
          date: activeCase?.created_at ? new Date(activeCase.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
          hospital: assignedHospitalName,
          caseId: activeCase?.id || '',
        }
      : null;

    const unreadNotifications = notifications.filter((n) => !n.read_at).length;

    return {
      name: user.full_name.split(' ')[0],
      user,
      profile,
      disability,
      cases,
      nextStep,
      journey,
      metrics: [
        {
          label: 'Active cases',
          value: String(cases.filter((c) => c.status !== 'closed' && c.status !== 'resolved').length),
          detail: activeCase ? `Current: ${activeCase.current_stage}` : 'No active cases',
        },
        {
          label: 'Certificate status',
          value: disability?.certificate_status?.replace('_', ' ') || 'N/A',
          detail: disability?.disability_category?.replace('_', ' ') || '',
        },
        {
          label: 'Notifications',
          value: String(unreadNotifications),
          detail: unreadNotifications ? 'unread' : 'all read',
        },
        {
          label: 'Identity',
          value: profile.identity_verification_status?.replace('_', ' ') || 'N/A',
          detail: profile.state || '',
        },
      ],
    };
  },
};

/* ── Cases ── */

const cases_ = {
  list: () => get<CaseBasic[]>('/api/cases'),
  get: (id: string) => get<CaseDetail>(`/api/cases/${id}`),
  create: (data: { case_type: string; assigned_hospital_id?: string; assigned_state_office_id?: string; priority?: string }) =>
    post<CaseDetail>('/api/cases', data),
  update: (id: string, data: { status?: string; current_stage?: string }) => patch<CaseDetail>(`/api/cases/${id}`, data),
  addEvent: (id: string, data: { event_type: string; description: string }) =>
    post<{ id: string }>(`/api/cases/${id}/events`, data),
};

/* ── Appointments ── */

const appointments = {
  list: () => get<Appointment[]>('/api/appointments'),
  get: (id: string) => get<Appointment>(`/api/appointments/${id}`),
  slots: (params?: { hospital_id?: string; department_id?: string; date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.hospital_id) qs.set('hospital_id', params.hospital_id);
    if (params?.department_id) qs.set('department_id', params.department_id);
    if (params?.date) qs.set('date', params.date);
    const q = qs.toString();
    return get<AppointmentSlot[]>(`/api/appointments/slots${q ? '?' + q : ''}`);
  },
  create: (data: {
    case_id: string;
    hospital_id: string;
    department_id: string;
    appointment_date: string;
    appointment_time: string;
    booking_method?: string;
    notes?: string;
  }) => post<Appointment>('/api/appointments', { ...data, booking_method: data.booking_method || 'mock_api' }),
  update: (id: string, data: { status?: string; appointment_date?: string; appointment_time?: string; notes?: string }) =>
    patch<Appointment>(`/api/appointments/${id}`, data),
  updateStatus: (id: string, data: { status: string; notes?: string }) => patch<Appointment>(`/api/appointments/${id}`, data),
};

/* ── Hospitals ── */

const hospitals = {
  list: (params?: { state?: string; district?: string }) => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set('state', params.state);
    if (params?.district) qs.set('district', params.district);
    const q = qs.toString();
    return get<Hospital[]>(`/api/hospitals${q ? '?' + q : ''}`);
  },
  get: (id: string) => get<Hospital>(`/api/hospitals/${id}`),
  departments: (id: string) => get<HospitalDepartment[]>(`/api/hospitals/${id}/departments`),
};

/* ── Benefits ── */

const benefits = {
  list: (params?: { state?: string; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set('state', params.state);
    if (params?.category) qs.set('category', params.category);
    const q = qs.toString();
    return get<Benefit[]>(`/api/benefits${q ? '?' + q : ''}`);
  },
  get: (id: string) => get<Benefit>(`/api/benefits/${id}`),
  eligibility: (id: string) => get<BenefitEligibility>(`/api/benefits/${id}/eligibility`),
  applications: () => get<BenefitApplication[]>('/api/benefit-applications'),
  apply: (data: { benefit_id: string; notes?: string }) => post<BenefitApplication>('/api/benefit-applications', data),

  /** Fetch all benefits and check eligibility for each — returns enriched list */
  recommendations: async (): Promise<
    (Benefit & { eligibility: BenefitEligibility | null })[]
  > => {
    const allBenefits = await benefits.list();
    const results = await Promise.allSettled(allBenefits.map((b) => benefits.eligibility(b.id)));
    return allBenefits.map((b, i) => ({
      ...b,
      eligibility: results[i].status === 'fulfilled' ? results[i].value : null,
    }));
  },
};

/* ── Documents ── */

const documents = {
  list: () => get<Document[]>('/api/documents'),
  create: (data: {
    document_type: string;
    filename: string;
    mime_type: string;
    storage_reference: string;
    case_id?: string;
  }) => post<Document>('/api/documents', data),
  grantPermission: (docId: string, data: { granted_to_user_id: string; permission_type: string; valid_until?: string }) =>
    post(`/api/documents/${docId}/permissions`, data),
  revokePermission: (permId: string) => post(`/api/document-permissions/${permId}/revoke`),
};

/* ── Grievances ── */

const grievances = {
  list: (type?: 'cpgrams' | 'rights_violation') => {
    const qs = type ? `?grievance_type=${type}` : '';
    return get<Grievance[]>(`/api/grievances${qs}`);
  },
  get: (id: string) => get<Grievance>(`/api/grievances/${id}`),
  create: (data: {
    case_id?: string;
    category: string;
    subject: string;
    description: string;
    grievance_type: 'cpgrams' | 'rights_violation';
  }) => post<Grievance>('/api/grievances', data),
  updateStatus: (id: string, data: { status: string; message?: string }) =>
    patch<Grievance>(`/api/grievances/${id}/status`, data),
};

/* ── NGOs ── */

const ngos = {
  list: (params?: { state?: string; district?: string }) => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set('state', params.state);
    if (params?.district) qs.set('district', params.district);
    const q = qs.toString();
    return get<Ngo[]>(`/api/ngos${q ? '?' + q : ''}`);
  },
  requestAssistance: (data: { ngo_id: string; assistance_type: string; description: string }) =>
    post<NgoAssistanceRequest>('/api/ngo-assistance-requests', data),
  listRequests: () => get<NgoAssistanceRequest[]>('/api/ngo-assistance-requests'),
};

/* ── Services ── */

const services = {
  list: (params?: { state?: string; category?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set('state', params.state);
    if (params?.category) qs.set('category', params.category);
    if (params?.q) qs.set('q', params.q);
    const q = qs.toString();
    return get<GovernmentService[]>(`/api/services${q ? '?' + q : ''}`);
  },
  get: (id: string) => get<GovernmentService>(`/api/services/${id}`),
};

/* ── Notifications ── */

const notifications_ = {
  list: () => get<Notification[]>('/api/notifications'),
  markRead: (id: string) => post<Notification>(`/api/notifications/${id}/read`),
};

/* ── Admin ── */

const admin = {
  summary: () => get<AdminSummary>('/api/admin/summary'),
  seedDemo: () => post<{ status: string }>('/api/admin/seed-demo'),
  resetCitizenProgress: () => post<{ status: string; message: string }>('/api/admin/reset-citizen-progress'),
  citizenJourney: () => get<CitizenJourneyReview>('/api/admin/citizen-journey'),
};

const demo = {
  workflowProgress: () => get<WorkflowProgress>('/api/demo/workflow-progress'),
};

/* ── Certificates & Hospital Assessments ── */

const certificates = {
  assessments: () => get<HospitalAssessmentCase[]>('/api/hospital/assessments'),
  decision: (data: CertificateDecisionCreate) => post<CertificateDecisionResult>('/api/certificates/decision', data),
  myUdid: () => get<UdidCardData>('/api/citizens/me/udid'),
};

/* ── Export ── */

export const api = {
  auth,
  citizen,
  cases: cases_,
  appointments,
  hospitals,
  benefits,
  certificates,
  documents,
  grievances,
  ngos,
  services,
  notifications: notifications_,
  admin,
  demo,
};
