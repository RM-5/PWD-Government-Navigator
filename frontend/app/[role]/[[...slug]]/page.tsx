'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { api } from '@/lib/api';
import type {
  AdminSummary,
  Appointment,
  AppointmentSlot,
  Benefit,
  BenefitEligibility,
  CaseBasic,
  CaseDetail,
  Dashboard,
  Document as Doc,
  GovernmentService,
  Grievance,
  Hospital,
  HospitalDepartment,
  Ngo,
  Notification,
  Role,
} from '@/lib/api/types';

const roles = ['citizen', 'hospital', 'state', 'admin'];

/* ── Shared Components ── */

function Title({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) {
  return (
    <div className="mb-7">
      <p className="text-sm font-bold uppercase tracking-widest text-teal">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-black text-navy sm:text-4xl">{title}</h1>
      {copy && <p className="mt-2 max-w-2xl text-slate-600">{copy}</p>}
    </div>
  );
}

function Loading({ label }: { label?: string }) {
  return <p className="py-12 text-center text-slate-500">{label || 'Loading…'}</p>;
}

function Timeline({ steps }: { steps: { name: string; status: string; action?: string | null; href?: string }[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((x, i) => {
        const isDone = x.status === 'completed' || x.status === 'done';
        const isCurrent = x.status === 'in_progress' || x.status === 'current';

        const content = (
          <div className="flex-1">
            <p className={`font-bold text-navy ${x.href ? 'group-hover:text-teal transition-colors' : ''}`}>
              {x.name}
              {x.href && <span className="ml-2 text-xs font-normal text-teal opacity-0 group-hover:opacity-100 transition-opacity">→ View</span>}
            </p>
            <p className="text-sm text-slate-500">
              {x.status.replace('_', ' ')}
              {x.action ? ` · ${x.action}` : ''}
            </p>
          </div>
        );

        return (
          <li key={x.name} className="relative flex gap-4 pb-5">
            <span
              className={`z-10 mt-1 grid h-6 w-6 place-items-center rounded-full text-xs shrink-0 ${
                isCurrent
                  ? 'bg-teal text-white'
                  : isDone
                  ? 'bg-mint text-teal'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {isDone ? '✓' : isCurrent ? '●' : '○'}
            </span>
            {i < steps.length - 1 && <span className="absolute left-3 top-7 h-5 border-l-2 border-slate-200" />}
            {x.href ? (
              <Link href={x.href} className="group flex flex-1 items-start">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Citizen: Home Dashboard ── */

function CitizenHome() {
  const [d, setD] = useState<Dashboard>();
  const [err, setErr] = useState('');
  useEffect(() => {
    api.citizen.dashboard().then(setD).catch((e) => setErr(e.message));
  }, []);
  if (err) return <p className="text-red-600">{err}</p>;
  if (!d) return <Loading label="Loading your journey…" />;
  return (
    <>
      <Title
        eyebrow="Citizen portal"
        title={`Welcome, ${d.name}`}
        copy="Your services journey is in one place. Start with the next action below."
      />
      {d.nextStep && (
        <section className="card border-l-4 border-l-teal bg-gradient-to-r from-white to-mint">
          <p className="text-sm font-bold uppercase tracking-widest text-teal">Your next step</p>
          <h2 className="mt-2 text-2xl font-black text-navy">{d.nextStep.title}</h2>
          <p className="mt-2 text-slate-700">
            {d.nextStep.date}
            <br />
            {d.nextStep.hospital}
          </p>
          {d.nextStep.caseId && (
            <Link className="btn mt-5" href={`/citizen/cases/${d.nextStep.caseId}`}>
              View case
            </Link>
          )}
        </section>
      )}
      <section className="mt-7 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        {d.journey.length > 0 && (
          <div className="card">
            <h2 className="mb-5 text-xl font-black text-navy">Your journey</h2>
            <Timeline steps={d.journey.map((j) => ({ name: j.label, status: j.status === 'done' ? 'completed' : j.status === 'current' ? 'in_progress' : 'not_started', href: j.href }))} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {d.metrics.map((m) => (
            <div key={m.label} className="card">
              <p className="text-sm font-bold text-slate-600">{m.label}</p>
              <p className="mt-1 text-2xl font-black text-navy">{m.value}</p>
              <p className="mt-1 text-sm text-slate-500">{m.detail}</p>
            </div>
          ))}
        </div>
      </section>
      {d.cases.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-4 text-xl font-black text-navy">Your cases</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {d.cases.map((c) => (
              <Link key={c.id} href={`/citizen/cases/${c.id}`} className="card group hover:border-teal">
                <p className="text-sm font-bold text-teal">{c.case_number}</p>
                <p className="mt-1 font-black text-navy group-hover:text-teal">{c.case_type.replace('_', ' ')}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Stage: {c.current_stage} · Status: {c.status.replace('_', ' ')}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ── Citizen: Services ── */

function Services() {
  const [svcs, setSvcs] = useState<GovernmentService[]>();
  useEffect(() => {
    api.services.list().then(setSvcs);
  }, []);
  if (!svcs) return <Loading />;
  return (
    <>
      <Title eyebrow="Service discovery" title="Available government services" copy="Browse services and find the help you need." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {svcs.map((s) => (
          <div key={s.id} className="card">
            <span className="pill bg-mint text-teal">{s.category}</span>
            <h2 className="mt-3 font-black text-navy">{s.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{s.description}</p>
            {s.authority && <p className="mt-3 text-xs text-slate-500">Authority: {s.authority}</p>}
            {s.processing_time && <p className="text-xs text-slate-500">Processing: {s.processing_time}</p>}
          </div>
        ))}
        {svcs.length === 0 && <p className="text-slate-500">No services found.</p>}
      </div>
    </>
  );
}

/* ── Citizen: Case View ── */

function CaseView({ caseId }: { caseId: string }) {
  const [c, setC] = useState<CaseDetail>();
  const [err, setErr] = useState('');
  useEffect(() => {
    api.cases.get(caseId).then(setC).catch((e) => setErr(e.message));
  }, [caseId]);
  if (err) return <p className="text-red-600">{err}</p>;
  if (!c) return <Loading label="Loading case…" />;
  const stepMap = new Map(c.steps.map((s) => [s.step_name, s]));
  const getStep = (name: string) => stepMap.get(name);

  const sProfile = getStep('Profile');
  const sService = getStep('Service identified');
  const sHospital = getStep('Hospital identified');
  const sApt = getStep('Appointment');
  const sMed = getStep('Medical assessment');
  const sCert = getStep('Certificate');
  const sBen = getStep('Benefits');
  const sGrv = getStep('Grievance');
  const sEsc = getStep('Escalation');

  const medStatus = sMed?.status === 'completed' ? 'completed' : (sApt?.status === 'in_progress' || sMed?.status === 'in_progress' || sApt?.status === 'completed') ? 'in_progress' : 'not_started';
  const medAction = sMed?.next_action || sApt?.next_action || 'Attend medical board assessment';

  const grvStatus = (sEsc?.status === 'completed' || sGrv?.status === 'completed') ? 'completed' : (sGrv?.status === 'in_progress' || sEsc?.status === 'in_progress') ? 'in_progress' : 'not_started';
  const grvAction = sGrv?.next_action || sEsc?.next_action || 'Raise or track grievance if delayed';

  const consolidatedSteps = [
    { name: 'Profile', status: sProfile?.status || 'not_started', action: sProfile?.next_action, href: '/citizen' },
    { name: 'Service identified', status: sService?.status || 'not_started', action: sService?.next_action, href: '/citizen/services' },
    { name: 'Hospital identified', status: sHospital?.status || 'not_started', action: sHospital?.next_action, href: '/citizen/medical-assessment' },
    { name: 'Medical Assessment', status: medStatus, action: medAction, href: '/citizen/medical-assessment' },
    { name: 'Certificate', status: sCert?.status || 'not_started', action: sCert?.next_action, href: '/citizen/documents' },
    { name: 'Benefits', status: sBen?.status || 'not_started', action: sBen?.next_action, href: '/citizen/benefits' },
    { name: 'Grievance and Status', status: grvStatus, action: grvAction, href: '/citizen/grievance-and-status' },
  ];

  return (
    <>
      <Title
        eyebrow={c.case_number}
        title={c.case_type.replace('_', ' ')}
        copy={`Current stage: ${c.current_stage} · Status: ${c.status.replace('_', ' ')}`}
      />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="card">
          <h2 className="mb-4 font-black text-navy">Journey steps</h2>
          <Timeline steps={consolidatedSteps} />
        </div>
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-black text-navy">Case details</h2>
            <p className="mt-3"><b>Type</b><br />{c.case_type.replace('_', ' ')}</p>
            <p className="mt-3"><b>Priority</b><br />{c.priority}</p>
            <p className="mt-3"><b>Created</b><br />{new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <Link className="btn mt-5" href="/citizen/benefits">View benefit recommendations</Link>
          </div>
          {c.events.length > 0 && (
            <div className="card">
              <h2 className="font-black text-navy">Timeline events</h2>
              {c.events.map((ev) => (
                <div key={ev.id} className="mt-3 border-t pt-3 first:mt-0 first:border-0 first:pt-0">
                  <p className="text-sm font-bold text-teal">{ev.event_type.replace('_', ' ')}</p>
                  <p className="text-sm text-slate-600">{ev.description}</p>
                  <p className="text-xs text-slate-400">{new Date(ev.created_at).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Citizen: Medical Assessment & Appointments ── */

function MedicalAssessment() {
  const [existing, setExisting] = useState<Appointment[]>();
  const [slots, setSlots] = useState<AppointmentSlot[]>();
  const [hospitals_, setHospitals] = useState<Hospital[]>();
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot>();
  const [cases, setCases] = useState<CaseBasic[]>();
  const [activeCaseDetail, setActiveCaseDetail] = useState<CaseDetail>();
  const [confirmed, setConfirmed] = useState<Appointment>();

  useEffect(() => {
    api.appointments.list().then(setExisting);
    api.appointments.slots().then(setSlots);
    api.hospitals.list().then(setHospitals);
    api.cases.list().then(async (cs) => {
      setCases(cs);
      const active = cs.find((c) => c.status !== 'closed' && c.status !== 'resolved');
      if (active) {
        try {
          const detail = await api.cases.get(active.id);
          setActiveCaseDetail(detail);
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  const book = async () => {
    if (!selectedSlot || !cases?.length) return;
    const activeCase = cases.find((c) => c.status !== 'closed' && c.status !== 'resolved');
    if (!activeCase) return alert('No active case to book against');
    try {
      const apt = await api.appointments.create({
        case_id: activeCase.id,
        hospital_id: selectedSlot.hospital_id,
        department_id: selectedSlot.department_id,
        appointment_date: selectedSlot.date,
        appointment_time: selectedSlot.start_time,
      });
      setConfirmed(apt);
      api.appointments.list().then(setExisting);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!existing || !slots) return <Loading />;

  const assignedHospital = hospitals_?.find((h) => h.id === activeCaseDetail?.assigned_hospital_id);

  return (
    <>
      <Title
        eyebrow="Medical Assessment"
        title="Medical Assessment & Appointments"
        copy="Manage your disability board assessment, review hospital evaluation requirements, and schedule your appointment."
      />

      {/* Assessment Board Overview */}
      <div className="card mb-6 border-l-4 border-l-teal bg-gradient-to-r from-white to-mint/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="pill bg-mint text-teal font-bold">BOARD ASSESSMENT</span>
            <h2 className="mt-2 text-xl font-black text-navy">Medical Evaluation Board</h2>
            <p className="mt-1 text-sm text-slate-600">
              {assignedHospital ? `${assignedHospital.name} — ${assignedHospital.district}, ${assignedHospital.state}` : 'Government Medical Assessment Board'}
            </p>
          </div>
          <Link href="/citizen/documents" className="btn text-sm">
            Check Document Vault →
          </Link>
        </div>

        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3 text-sm">
          <div className="rounded-lg bg-white/80 p-3 border">
            <p className="text-xs font-bold text-slate-500 uppercase">Assessment Type</p>
            <p className="mt-1 font-bold text-navy">Physical & Clinical Verification</p>
          </div>
          <div className="rounded-lg bg-white/80 p-3 border">
            <p className="text-xs font-bold text-slate-500 uppercase">Required Documents</p>
            <p className="mt-1 font-bold text-navy">ID Proof, Address, Clinical Records</p>
          </div>
          <div className="rounded-lg bg-white/80 p-3 border">
            <p className="text-xs font-bold text-slate-500 uppercase">Board Schedule</p>
            <p className="mt-1 font-bold text-navy">Mon – Fri, 10:00 AM – 2:00 PM</p>
          </div>
        </div>
      </div>

      {confirmed && (
        <div className="card mb-6 border-l-4 border-l-teal">
          <h2 className="text-2xl font-black text-navy">Appointment Confirmed ✓</h2>
          <p className="mt-2 font-bold text-teal">{confirmed.appointment_number}</p>
          <p className="mt-2 text-slate-700">
            {confirmed.appointment_date} · {confirmed.appointment_time}
          </p>
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            Demo appointment — not a real government booking.
          </p>
        </div>
      )}

      {/* Existing Appointments */}
      <div className="mb-6">
        <h2 className="mb-4 text-xl font-black text-navy">Your booked appointments</h2>
        {existing.length === 0 ? (
          <p className="text-sm text-slate-500">No appointments scheduled yet. Select an available slot below.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {existing.map((a) => (
              <div key={a.id} className="card">
                <p className="font-bold text-teal">{a.appointment_number}</p>
                <p className="mt-1 font-black text-navy">{a.appointment_date} · {a.appointment_time}</p>
                <p className="mt-1 text-sm text-slate-600">Status: <span className="font-bold text-navy">{a.status}</span> · {a.booking_method.replace('_', ' ')}</p>
                {a.notes && <p className="mt-2 text-sm text-slate-500">{a.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Slots */}
      {slots.length > 0 && !confirmed && (
        <div className="card max-w-3xl">
          <h2 className="text-xl font-black text-navy">Available assessment slots</h2>
          <p className="mt-1 text-sm text-slate-600">Select a slot to confirm your medical board appointment date and time.</p>
          <fieldset className="mt-4 grid gap-3 sm:grid-cols-3">
            <legend className="sr-only">Available appointment times</legend>
            {slots.filter((s) => s.booked_count < s.capacity).map((s) => (
              <label
                key={s.id}
                className={`cursor-pointer rounded-xl border p-4 font-bold transition-all ${
                  selectedSlot?.id === s.id ? 'border-teal bg-mint text-teal shadow-sm ring-2 ring-teal/20' : 'hover:border-slate-300'
                }`}
              >
                <input className="sr-only" type="radio" name="slot" checked={selectedSlot?.id === s.id} onChange={() => setSelectedSlot(s)} />
                <p>{s.date}</p>
                <p className="text-sm">{s.start_time} – {s.end_time}</p>
                <p className="mt-1 text-xs text-slate-500">{s.capacity - s.booked_count} spots left</p>
              </label>
            ))}
          </fieldset>
          <button onClick={book} disabled={!selectedSlot} className="btn mt-6">
            Confirm appointment
          </button>
        </div>
      )}
    </>
  );
}

/* ── Citizen: Benefits ── */

function Benefits() {
  const [data, setData] = useState<(Benefit & { eligibility: BenefitEligibility | null })[]>();
  useEffect(() => {
    api.benefits.recommendations().then(setData);
  }, []);
  if (!data) return <Loading />;
  return (
    <>
      <Title
        eyebrow="Personalised recommendations"
        title="Benefits you may qualify for"
        copy="Eligibility is evaluated by the backend using your profile data."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {data.map((b) => (
          <article className="card" key={b.id}>
            <span className={`pill ${b.eligibility?.eligible ? 'bg-mint text-teal' : 'bg-amber-100 text-amber-900'}`}>
              {b.eligibility?.eligible ? 'LIKELY ELIGIBLE' : b.eligibility ? 'MORE INFO REQUIRED' : 'CHECKING…'}
            </span>
            <h2 className="mt-4 text-xl font-black text-navy">{b.name}</h2>
            <p className="mt-3 text-sm text-slate-600">{b.description}</p>
            {b.authority && <p className="mt-3 text-sm"><b>Authority</b><br />{b.authority}</p>}
            {b.eligibility && b.eligibility.matched_rules.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-teal">Matched:</p>
                {b.eligibility.matched_rules.map((r) => (
                  <p key={r} className="text-xs text-slate-500">✓ {r}</p>
                ))}
              </div>
            )}
            {b.eligibility && b.eligibility.missing_rules.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-bold text-amber-700">Missing:</p>
                {b.eligibility.missing_rules.map((r) => (
                  <p key={r} className="text-xs text-slate-500">⚠ {r}</p>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

/* ── Citizen: Grievance & Status ── */

function GrievanceAndStatus() {
  const [list, setList] = useState<Grievance[]>();
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);

  useEffect(() => {
    api.grievances.list().then(setList);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.grievances.create({ category, subject, description: desc });
      setSubject('');
      setDesc('');
      setCategory('general');
      api.grievances.list().then(setList);
    } catch (e: any) {
      alert(e.message);
    }
    setSubmitting(false);
  };

  const escalateGrievance = async (grievanceId: string) => {
    setEscalatingId(grievanceId);
    try {
      await api.grievances.updateStatus(grievanceId, {
        status: 'escalated',
        message: 'Escalated by citizen to Chief Commissioner for Persons with Disabilities due to delay.',
      });
      api.grievances.list().then(setList);
    } catch (e: any) {
      alert(e.message);
    }
    setEscalatingId(null);
  };

  return (
    <>
      <Title
        eyebrow="Support and resolution"
        title="Grievance & Status"
        copy="Monitor submitted grievances, review actions taken by state representatives, track escalation status, or submit a new grievance."
      />

      {/* Escalation Authority & Notice Card */}
      <div className="card mb-6 border-l-4 border-l-teal bg-gradient-to-r from-white to-mint/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="pill bg-mint text-teal font-bold">ESCALATION FRAMEWORK</span>
            <h2 className="mt-2 text-xl font-black text-navy">Disability Grievance Redressal</h2>
            <p className="mt-1 text-sm text-slate-600">
              Grievances are initially routed to the <b>State Commissioner for Persons with Disabilities</b>. Unresolved cases can be escalated to the <b>Chief Commissioner (Central)</b>.
            </p>
          </div>
        </div>
      </div>

      {/* Grievance List */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-navy">Filed grievances & tracking</h2>
        {list?.length === 0 && <p className="text-sm text-slate-500">No grievances filed yet.</p>}
        {list?.map((g) => (
          <div key={g.id} className="card max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`pill ${
                    g.status === 'resolved' || g.status === 'action_taken'
                      ? 'bg-mint text-teal'
                      : g.status === 'escalated'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {g.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-slate-500">{g.grievance_number}</span>
              </div>
              {g.status !== 'escalated' && g.status !== 'resolved' && (
                <button
                  onClick={() => escalateGrievance(g.id)}
                  disabled={escalatingId === g.id}
                  className="rounded-lg border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
                >
                  {escalatingId === g.id ? 'Escalating…' : 'Escalate to Commissioner ↗'}
                </button>
              )}
            </div>

            <h3 className="mt-3 text-xl font-black text-navy">{g.subject}</h3>
            <p className="mt-2 text-slate-600">{g.description}</p>

            {/* Actions Timeline */}
            {g.actions?.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Official Action History</p>
                {g.actions.map((a) => (
                  <div key={a.id} className="text-sm rounded-lg bg-slate-50 p-2.5">
                    <span className="font-bold text-teal">{a.action_type.replace('_', ' ')}</span>
                    {a.message && <span className="text-slate-600"> — {a.message}</span>}
                    {a.created_at && (
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(a.created_at).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lodge a New Grievance Form */}
      <form onSubmit={submit} className="card mt-8 max-w-3xl">
        <h2 className="font-black text-navy">Lodge a new grievance</h2>
        <p className="mt-1 text-sm text-slate-600">
          File a complaint regarding delays in assessment, issue with UDID/Certificate, or benefit processing.
        </p>

        <label className="label mt-4 block">
          <span className="font-bold text-slate-700">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full rounded-xl border p-3 bg-white"
          >
            <option value="general">General Query / Issue</option>
            <option value="appointment_delay">Medical Assessment Delay</option>
            <option value="certificate_issue">Disability Certificate / UDID Issue</option>
            <option value="benefit_denial">Benefit Application Concern</option>
            <option value="hospital_conduct">Hospital / Assessment Board Feedback</option>
          </select>
        </label>

        <label className="label mt-4 block">
          <span className="font-bold text-slate-700">Subject</span>
          <input
            required
            placeholder="e.g. Delay in medical board assessment"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-2 w-full rounded-xl border p-3"
          />
        </label>

        <label className="label mt-4 block">
          <span className="font-bold text-slate-700">Description</span>
          <textarea
            required
            placeholder="Provide details about the issue, dates, and what assistance is needed..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="mt-2 min-h-24 w-full rounded-xl border p-3"
          />
        </label>

        <button className="btn mt-4" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit grievance'}
        </button>
      </form>
    </>
  );
}

/* ── Citizen: Documents ── */

function Documents() {
  const [docs, setDocs] = useState<Doc[]>();
  useEffect(() => {
    api.documents.list().then(setDocs);
  }, []);
  if (!docs) return <Loading />;
  return (
    <>
      <Title eyebrow="Citizen portal" title="Document vault" copy="Your uploaded documents. Share only with permission." />
      <div className="card max-w-3xl">
        {docs.length === 0 && <p className="text-slate-500">No documents yet.</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between border-b py-4 last:border-0">
            <div>
              <p className="font-bold text-navy">{d.filename}</p>
              <p className="text-sm text-slate-500">{d.document_type.replace('_', ' ')} · {d.status}</p>
            </div>
            <span className={`pill ${d.status === 'verified' ? 'bg-mint text-teal' : 'bg-amber-100 text-amber-900'}`}>
              {d.status}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Citizen: NGOs ── */

function NgosPage() {
  const [list, setList] = useState<Ngo[]>();
  useEffect(() => {
    api.ngos.list().then(setList);
  }, []);
  if (!list) return <Loading />;
  return (
    <>
      <Title eyebrow="Citizen portal" title="NGO directory" copy="Local organisations that may offer support." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((n) => (
          <div key={n.id} className="card">
            <h2 className="font-black text-navy">{n.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{n.description}</p>
            {n.services && <p className="mt-2 text-xs text-slate-500">Services: {n.services.join(', ').replace(/_/g, ' ')}</p>}
            {n.phone && <p className="mt-1 text-xs text-slate-500">Phone: {n.phone}</p>}
            {n.district && <p className="mt-1 text-xs text-slate-500">{n.district}, {n.state}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Citizen: Notifications ── */

function NotificationsPage() {
  const [list, setList] = useState<Notification[]>();
  useEffect(() => {
    api.notifications.list().then(setList);
  }, []);
  if (!list) return <Loading />;
  return (
    <>
      <Title eyebrow="Citizen portal" title="Notifications" />
      <div className="card max-w-3xl">
        {list.length === 0 && <p className="text-slate-500">No notifications.</p>}
        {list.map((n) => (
          <div key={n.id} className="flex items-start gap-3 border-b py-4 last:border-0">
            <span className={`mt-1 h-2 w-2 rounded-full ${n.read_at ? 'bg-slate-300' : 'bg-teal'}`} />
            <div>
              <p className="font-bold text-navy">{n.title}</p>
              <p className="text-sm text-slate-600">{n.body}</p>
              <p className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString('en-IN')}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Hospital Staff View ── */

function HospitalView({ page }: { page: string }) {
  const [cases, setCases] = useState<CaseBasic[]>();
  const [apts, setApts] = useState<Appointment[]>();
  useEffect(() => {
    api.cases.list().then(setCases);
    api.appointments.list().then(setApts);
  }, []);
  if (!cases) return <Loading />;

  if (page === 'cases') {
    return (
      <>
        <Title eyebrow="Hospital desk" title="Hospital cases" copy="Cases assigned to your hospital." />
        <div className="card overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b text-slate-500">
              <th className="p-3">Case #</th><th className="p-3">Type</th><th className="p-3">Stage</th><th className="p-3">Status</th><th className="p-3">Priority</th>
            </tr></thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="p-3 font-bold text-teal">{c.case_number}</td>
                  <td className="p-3">{c.case_type.replace('_', ' ')}</td>
                  <td className="p-3">{c.current_stage}</td>
                  <td className="p-3">{c.status.replace('_', ' ')}</td>
                  <td className="p-3">{c.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <Title eyebrow="Hospital desk" title="Today's overview" copy="Cases and appointments assigned to your hospital." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card"><p className="text-sm font-bold text-slate-600">Total cases</p><p className="mt-1 text-2xl font-black text-navy">{cases.length}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Appointments</p><p className="mt-1 text-2xl font-black text-navy">{apts?.length || 0}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">In progress</p><p className="mt-1 text-2xl font-black text-navy">{cases.filter((c) => c.status === 'in_progress').length}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Awaiting citizen</p><p className="mt-1 text-2xl font-black text-navy">{cases.filter((c) => c.status === 'waiting_on_citizen').length}</p></div>
      </div>
      {apts && apts.length > 0 && (
        <div className="card mt-6 overflow-x-auto">
          <h2 className="mb-4 text-xl font-black text-navy">Appointments</h2>
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b text-slate-500">
              <th className="p-3">Number</th><th className="p-3">Date</th><th className="p-3">Time</th><th className="p-3">Status</th>
            </tr></thead>
            <tbody>
              {apts.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="p-3 font-bold">{a.appointment_number}</td>
                  <td className="p-3">{a.appointment_date}</td>
                  <td className="p-3">{a.appointment_time}</td>
                  <td className="p-3">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ── State Representative View ── */

function StateView({ page }: { page: string }) {
  const [grievances, setGrievances] = useState<Grievance[]>();
  const [cases, setCases] = useState<CaseBasic[]>();
  useEffect(() => {
    api.grievances.list().then(setGrievances);
    api.cases.list().then(setCases);
  }, []);
  if (!grievances) return <Loading />;

  if (page === 'grievances') {
    return (
      <>
        <Title eyebrow="State office" title="Grievance queue" copy="Grievances assigned to your state office." />
        {grievances.map((g) => (
          <div key={g.id} className="card mb-4 max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="pill bg-amber-100 text-amber-900">{g.status.replace('_', ' ')}</span>
              <span className="text-sm text-slate-500">{g.grievance_number}</span>
            </div>
            <h2 className="mt-3 font-black text-navy">{g.subject}</h2>
            <p className="mt-2 text-sm text-slate-600">{g.description}</p>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <Title eyebrow="State office" title="State commissioner dashboard" copy="Overview of cases and grievances." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card"><p className="text-sm font-bold text-slate-600">Open grievances</p><p className="mt-1 text-2xl font-black text-navy">{grievances.length}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Acknowledged</p><p className="mt-1 text-2xl font-black text-navy">{grievances.filter((g) => g.status === 'acknowledged').length}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Cases</p><p className="mt-1 text-2xl font-black text-navy">{cases?.length || 0}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Escalated</p><p className="mt-1 text-2xl font-black text-navy">{grievances.filter((g) => g.status === 'escalated').length}</p></div>
      </div>
    </>
  );
}

/* ── Admin View ── */

function AdminView({ page }: { page: string }) {
  const [summary, setSummary] = useState<AdminSummary>();
  useEffect(() => {
    api.admin.summary().then(setSummary);
  }, []);
  if (!summary) return <Loading />;
  return (
    <>
      <Title eyebrow="Admin" title="Operational overview" copy="Platform-wide statistics from the database." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(summary).map(([k, v]) => (
          <div key={k} className="card">
            <p className="text-sm font-bold text-slate-600">{k.replace('_', ' ')}</p>
            <p className="mt-1 text-2xl font-black text-navy">{v}</p>
          </div>
        ))}
      </div>
      <div className="card mt-6 max-w-md">
        <h2 className="font-black text-navy">Actions</h2>
        <button onClick={() => api.admin.seedDemo().then(() => alert('Demo data reloaded'))} className="btn mt-4">
          Re-seed demo data
        </button>
      </div>
    </>
  );
}

/* ── Router ── */

export default function PortalPage() {
  const params = useParams<{ role: string; slug?: string[] }>();
  const router = useRouter();
  const role = params.role as Role;
  const slug = params.slug || [];
  const page = slug[0] || '';
  const subPage = slug[1] || '';

  useEffect(() => {
    const saved = localStorage.getItem('demo-role');
    if (!roles.includes(role)) router.replace('/login');
    else if (saved && saved !== role) router.replace('/' + saved);
  }, [role, router]);

  if (!roles.includes(role)) return null;

  let content: React.ReactNode;
  if (role === 'citizen') {
    if (page === '') content = <CitizenHome />;
    else if (page === 'services') content = <Services />;
    else if (page === 'cases' && subPage) content = <CaseView caseId={subPage} />;
    else if (page === 'cases') content = <CitizenHome />;
    else if (page === 'appointments' || page === 'medical-assessment') content = <MedicalAssessment />;
    else if (page === 'benefits') content = <Benefits />;
    else if (page === 'grievances' || page === 'grievance-and-status') content = <GrievanceAndStatus />;
    else if (page === 'documents') content = <Documents />;
    else if (page === 'ngos') content = <NgosPage />;
    else if (page === 'notifications') content = <NotificationsPage />;
    else content = <CitizenHome />;
  } else if (role === 'hospital') {
    content = <HospitalView page={page} />;
  } else if (role === 'state') {
    content = <StateView page={page} />;
  } else {
    content = <AdminView page={page} />;
  }

  return <PortalShell role={role}>{content}</PortalShell>;
}
