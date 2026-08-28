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
  Certificate,
  Dashboard,
  Document as Doc,
  GovernmentService,
  Grievance,
  Hospital,
  HospitalAssessmentCase,
  HospitalDepartment,
  Ngo,
  Notification,
  Role,
  UdidCardData,
  WorkflowStep,
} from '@/lib/api/types';

const roles = ['citizen', 'hospital', 'state', 'cpgrams', 'admin'];

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

/* ── Digital Mock UDID Card ── */

function UdidCard({ card }: { card: UdidCardData }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-teal/40 bg-gradient-to-br from-[#0a2540] via-[#124e66] to-[#0f3057] p-6 text-white shadow-xl max-w-lg">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/20 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-navy font-black text-xs shadow">
            GOI
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-teal-300">
              Government of India
            </p>
            <p className="text-sm font-black tracking-wide text-white">Unique Disability ID (UDID)</p>
          </div>
        </div>
        <span className="rounded-full bg-mint px-2.5 py-0.5 text-[10px] font-black uppercase text-teal">
          {card.status}
        </span>
      </div>

      {/* Card Body */}
      <div className="mt-4 flex gap-4">
        {/* Photo Box & Chip */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-24 w-20 flex-col items-center justify-center rounded-xl border border-white/30 bg-white/10 text-center backdrop-blur-sm">
            <span className="text-2xl">👤</span>
            <span className="text-[9px] font-bold text-white/70">PHOTO</span>
          </div>
          <div className="h-6 w-9 rounded-md border border-amber-300/60 bg-amber-400/80 shadow-inner flex items-center justify-center">
            <div className="h-4 w-6 border border-amber-600/50 rounded-sm" />
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-1.5 text-xs">
          <div>
            <p className="text-[10px] uppercase text-white/60 font-semibold">Name of Cardholder</p>
            <p className="text-base font-black text-white">{card.citizen_name}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase text-white/60 font-semibold">Disability Category</p>
              <p className="font-bold text-teal-200">{card.disability_category}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/60 font-semibold">Percentage</p>
              <p className="font-extrabold text-amber-300">{card.disability_percentage}% (Benchmark)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase text-white/60 font-semibold">State / District</p>
              <p className="font-medium text-white/90">{card.district}, {card.state}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-white/60 font-semibold">Validity</p>
              <p className="font-bold text-mint">{card.validity}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between border-t border-white/20 pt-3 text-[11px]">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-white/60">UDID Card Number</p>
          <p className="font-mono text-sm font-black tracking-widest text-teal-300">{card.udid_number}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wider text-white/60">Issuing Authority</p>
          <p className="max-w-[180px] truncate text-[10px] font-semibold text-white/90">{card.issuing_hospital}</p>
        </div>
      </div>

      {/* Mock Security Barcode */}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm text-[10px] text-white/80">
        <span className="font-mono tracking-widest">|||||||| | |||||| ||||| |||||||</span>
        <span className="font-bold text-mint">✓ DIGITAL VERIFIED</span>
      </div>
    </div>
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

  const medStatus = sMed?.status === 'completed' ? 'completed' : (sApt?.status === 'in_progress' || sMed?.status === 'in_progress' || sApt?.status === 'completed') ? 'in_progress' : 'not_started';
  const medAction = sMed?.next_action || sApt?.next_action || 'Attend medical board assessment';

  const consolidatedSteps = [
    { name: 'Profile', status: sProfile?.status || 'not_started', action: sProfile?.next_action, href: '/citizen' },
    { name: 'Service identified', status: sService?.status || 'not_started', action: sService?.next_action, href: '/citizen/services' },
    { name: 'Hospital identified', status: sHospital?.status || 'not_started', action: sHospital?.next_action, href: '/citizen/medical-assessment' },
    { name: 'Medical Assessment', status: medStatus, action: medAction, href: '/citizen/medical-assessment' },
    { name: 'Certificate', status: sCert?.status || 'not_started', action: sCert?.next_action, href: '/citizen/documents' },
    { name: 'Benefits', status: sBen?.status || 'not_started', action: sBen?.next_action, href: '/citizen/benefits' },
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

/* ── Citizen: Benefits & Pensions ── */

function Benefits() {
  const [data, setData] = useState<(Benefit & { eligibility: BenefitEligibility | null })[]>();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    api.benefits.recommendations().then(setData);
  }, []);

  if (!data) return <Loading />;

  const categories = [
    { key: 'all', label: 'All Schemes' },
    { key: 'financial_support', label: 'Pensions & Financial Assistance' },
    { key: 'mobility', label: 'Mobility & Concessions' },
    { key: 'education', label: 'Scholarships & Education' },
    { key: 'assistive_devices', label: 'Assistive Devices & Grants' },
    { key: 'employment', label: 'Employment & Training' },
  ];

  const filtered = selectedCategory === 'all'
    ? data
    : data.filter((b) => b.category === selectedCategory || (selectedCategory === 'financial_support' && b.name.toLowerCase().includes('pension')));

  const pensionCount = data.filter((b) => b.category === 'financial_support' || b.name.toLowerCase().includes('pension')).length;

  return (
    <>
      <Title
        eyebrow="Welfare & Support"
        title="Benefits & Disability Pensions"
        copy="Explore welfare schemes, monthly pension assistance, transport concessions, and assistive aid grants evaluated using your profile data."
      />

      {/* Integrated Welfare & Pension Banner */}
      <div className="card mb-6 border-l-4 border-l-teal bg-gradient-to-r from-white to-mint/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="pill bg-mint text-teal font-bold">INTEGRATED WELFARE SCHEMES</span>
            <h2 className="mt-2 text-xl font-black text-navy">State Pensions & Entitlements</h2>
            <p className="mt-1 text-sm text-slate-600">
              Disability pension applications, travel passes, and educational grants are unlocked upon issuing your disability certificate / UDID.
            </p>
          </div>
          <div className="rounded-xl border border-teal/20 bg-white/80 p-3 text-center">
            <p className="text-2xl font-black text-teal">{pensionCount}</p>
            <p className="text-xs font-semibold text-slate-500">Pension Schemes</p>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setSelectedCategory(c.key)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              selectedCategory === c.key
                ? 'bg-navy text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Benefits Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {filtered.map((b) => {
          const isPension = b.category === 'financial_support' || b.name.toLowerCase().includes('pension');
          return (
            <article className={`card ${isPension ? 'border-2 border-teal/40 bg-gradient-to-b from-white to-mint/10' : ''}`} key={b.id}>
              <div className="flex items-center justify-between gap-2">
                <span className={`pill ${b.eligibility?.eligible ? 'bg-mint text-teal' : 'bg-amber-100 text-amber-900'}`}>
                  {b.eligibility?.eligible ? 'LIKELY ELIGIBLE' : b.eligibility ? 'MORE INFO REQUIRED' : 'CHECKING…'}
                </span>
                {isPension && <span className="pill bg-purple-100 text-purple-900 font-bold text-xs">PENSION</span>}
              </div>
              <h2 className="mt-4 text-xl font-black text-navy">{b.name}</h2>
              <p className="mt-3 text-sm text-slate-600">{b.description}</p>
              {b.authority && <p className="mt-3 text-sm"><b>Authority</b><br />{b.authority}</p>}
              {b.eligibility && b.eligibility.matched_rules.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-teal">Matched Criteria:</p>
                  {b.eligibility.matched_rules.map((r) => (
                    <p key={r} className="text-xs text-slate-500">✓ {r}</p>
                  ))}
                </div>
              )}
              {b.eligibility && b.eligibility.missing_rules.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-amber-700">Missing Requirements:</p>
                  {b.eligibility.missing_rules.map((r) => (
                    <p key={r} className="text-xs text-slate-500">⚠ {r}</p>
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="card lg:col-span-3 text-center py-10">
            <p className="text-slate-500">No schemes found for this category.</p>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Shared: Citizen Journey Review ── */

function CitizenJourneyReview() {
  const [journey, setJourney] = useState<{ citizen_name: string; citizen_email: string; case_number: string; current_stage: string; steps: WorkflowStep[] }>();
  useEffect(() => {
    api.admin.citizenJourney().then(setJourney).catch(() => setJourney(undefined));
  }, []);
  if (!journey) return null;
  return (
    <section className="card mt-6">
      <h2 className="text-xl font-black text-navy">Citizen journey review</h2>
      <p className="mt-2 text-sm text-slate-600">
        {journey.citizen_name} ({journey.citizen_email}) · {journey.case_number} · Stage: {journey.current_stage}
      </p>
      <ol className="mt-4 space-y-3">
        {journey.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${step.status === 'completed' ? 'bg-mint text-teal' : step.status === 'in_progress' ? 'bg-teal text-white' : 'bg-slate-200 text-slate-500'}`}>
              {step.status === 'completed' ? '✓' : step.step}
            </span>
            <div>
              <p className="font-semibold text-navy">{step.title}</p>
              <p className="text-xs text-slate-500">{step.status.replace('_', ' ')}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── Citizen: CPGRAMS Grievance ── */

function CpgramsGrievance() {
  const [list, setList] = useState<Grievance[]>();
  const [category, setCategory] = useState('application_delay');
  const [subject, setSubject] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.grievances.list('cpgrams').then(setList);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.grievances.create({ category, subject, description: desc, grievance_type: 'cpgrams' });
      setSubject('');
      setDesc('');
      setCategory('application_delay');
      api.grievances.list('cpgrams').then(setList);
    } catch (e: any) {
      alert(e.message);
    }
    setSubmitting(false);
  };

  return (
    <>
      <Title
        eyebrow="CPGRAMS — Centralized Public Grievance Redressal"
        title="Service Grievances"
        copy="File complaints about application delays, certificate processing, benefit issues, or other government service problems."
      />

      <div className="card mb-6 border-l-4 border-l-blue-500 bg-gradient-to-r from-white to-blue-50/30">
        <span className="pill bg-blue-100 text-blue-800 font-bold">CPGRAMS PORTAL</span>
        <h2 className="mt-2 text-xl font-black text-navy">General Service Grievances</h2>
        <p className="mt-1 text-sm text-slate-600">
          Use this portal when your <b>application has not been processed</b>, your certificate is delayed, or you face issues with benefit applications. These grievances are handled by a <b>CPGRAMS officer</b>.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-black text-navy">Your CPGRAMS grievances</h2>
        {list?.length === 0 && <p className="text-sm text-slate-500">No CPGRAMS grievances filed yet.</p>}
        {list?.map((g) => (
          <div key={g.id} className="card max-w-3xl">
            <div className="flex items-center gap-3">
              <span className={`pill ${g.status === 'closed' || g.status === 'action_taken' ? 'bg-mint text-teal' : 'bg-amber-100 text-amber-900'}`}>
                {g.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-slate-500">{g.grievance_number}</span>
            </div>
            <h3 className="mt-3 text-xl font-black text-navy">{g.subject}</h3>
            <p className="mt-2 text-slate-600">{g.description}</p>
            {g.actions?.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Action History</p>
                {g.actions.map((a) => (
                  <div key={a.id} className="text-sm rounded-lg bg-slate-50 p-2.5">
                    <span className="font-bold text-teal">{a.action_type.replace('_', ' ')}</span>
                    {a.message && <span className="text-slate-600"> — {a.message}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="card mt-8 max-w-3xl">
        <h2 className="font-black text-navy">File a CPGRAMS grievance</h2>
        <p className="mt-1 text-sm text-slate-600">Report service delays, unprocessed applications, or certificate/benefit issues.</p>
        <label className="label mt-4 block">
          <span className="font-bold text-slate-700">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-xl border p-3 bg-white">
            <option value="application_delay">Application Not Processed</option>
            <option value="appointment_delay">Medical Assessment Delay</option>
            <option value="certificate_issue">Disability Certificate / UDID Issue</option>
            <option value="benefit_denial">Benefit Application Concern</option>
            <option value="hospital_conduct">Hospital / Assessment Board Feedback</option>
          </select>
        </label>
        <label className="label mt-4 block">
          <span className="font-bold text-slate-700">Subject</span>
          <input required placeholder="e.g. My application has not been processed" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2 w-full rounded-xl border p-3" />
        </label>
        <label className="label mt-4 block">
          <span className="font-bold text-slate-700">Description</span>
          <textarea required placeholder="Describe the issue, dates, and what assistance you need..." value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border p-3" />
        </label>
        <button className="btn mt-4" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit to CPGRAMS'}</button>
      </form>
    </>
  );
}

/* ── Citizen: Rights Violation Grievance ── */

function RightsViolationGrievance() {
  const [list, setList] = useState<Grievance[]>();
  const [category, setCategory] = useState('accessibility_denial');
  const [subject, setSubject] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.grievances.list('rights_violation').then(setList);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.grievances.create({ category, subject, description: desc, grievance_type: 'rights_violation' });
      setSubject('');
      setDesc('');
      setCategory('accessibility_denial');
      api.grievances.list('rights_violation').then(setList);
    } catch (e: any) {
      alert(e.message);
    }
    setSubmitting(false);
  };

  return (
    <>
      <Title
        eyebrow="State Commissioner for Persons with Disabilities"
        title="Rights Violation Complaints"
        copy="Report violations of your rights under the Rights of Persons with Disabilities Act, 2016."
      />

      <div className="card mb-6 border-l-4 border-l-red-500 bg-gradient-to-r from-white to-red-50/30">
        <span className="pill bg-red-100 text-red-800 font-bold">RIGHTS PROTECTION</span>
        <h2 className="mt-2 text-xl font-black text-navy">Disability Rights Violations</h2>
        <p className="mt-1 text-sm text-slate-600">
          Use this portal when your <b>rights as a person with disability are being violated</b> — denied accessibility, discrimination, harassment, or denial of reasonable accommodation. These complaints go to the <b>State Commissioner</b>.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-black text-navy">Your rights violation complaints</h2>
        {list?.length === 0 && <p className="text-sm text-slate-500">No rights violation complaints filed yet.</p>}
        {list?.map((g) => (
          <div key={g.id} className="card max-w-3xl">
            <div className="flex items-center gap-3">
              <span className={`pill ${g.status === 'closed' ? 'bg-mint text-teal' : g.status === 'under_review' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>
                {g.status.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-slate-500">{g.grievance_number}</span>
            </div>
            <h3 className="mt-3 text-xl font-black text-navy">{g.subject}</h3>
            <p className="mt-2 text-slate-600">{g.description}</p>
            {g.actions?.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Action History</p>
                {g.actions.map((a) => (
                  <div key={a.id} className="text-sm rounded-lg bg-slate-50 p-2.5">
                    <span className="font-bold text-teal">{a.action_type.replace('_', ' ')}</span>
                    {a.message && <span className="text-slate-600"> — {a.message}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="card mt-8 max-w-3xl">
        <h2 className="font-black text-navy">File a rights violation complaint</h2>
        <p className="mt-1 text-sm text-slate-600">Report discrimination, denied accessibility, or violations of your rights under the RPwD Act.</p>
        <label className="label mt-4 block">
          <span className="font-bold text-slate-700">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-xl border p-3 bg-white">
            <option value="accessibility_denial">Denied Accessibility / Barrier</option>
            <option value="discrimination">Discrimination</option>
            <option value="harassment">Harassment or Abuse</option>
            <option value="reasonable_accommodation">Denied Reasonable Accommodation</option>
            <option value="education_rights">Education Rights Violation</option>
            <option value="employment_rights">Employment Rights Violation</option>
          </select>
        </label>
        <label className="label mt-4 block">
          <span className="font-bold text-slate-700">Subject</span>
          <input required placeholder="e.g. Denied wheelchair access at assessment centre" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2 w-full rounded-xl border p-3" />
        </label>
        <label className="label mt-4 block">
          <span className="font-bold text-slate-700">Description</span>
          <textarea required placeholder="Describe the rights violation, when it occurred, and who was involved..." value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border p-3" />
        </label>
        <button className="btn mt-4 bg-red-700 hover:bg-red-800" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit to State Commissioner'}</button>
      </form>
    </>
  );
}

/* ── Citizen: Documents ── */

function Documents() {
  const [docs, setDocs] = useState<Doc[]>();
  const [udid, setUdid] = useState<UdidCardData | null>(null);

  useEffect(() => {
    api.documents.list().then(setDocs);
    api.certificates.myUdid().then(setUdid).catch(() => setUdid(null));
  }, []);

  if (!docs) return <Loading />;

  return (
    <>
      <Title
        eyebrow="Citizen portal"
        title="Document Vault & Digital UDID"
        copy="Access your issued Unique Disability ID card, digital certificates, and uploaded medical documentation."
      />

      {/* Digital UDID Card Display if Issued */}
      {udid && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black text-navy">Digital UDID Card</h2>
            <span className="pill bg-mint text-teal font-bold text-xs">OFFICIAL ISSUANCE</span>
          </div>
          <UdidCard card={udid} />
        </div>
      )}

      <div className="card max-w-3xl">
        <h2 className="mb-4 text-lg font-black text-navy">Verified Records & Documents</h2>
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
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [assessments, setAssessments] = useState<HospitalAssessmentCase[]>([]);
  const [reschedulingApt, setReschedulingApt] = useState<Appointment | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [rescheduleNotes, setRescheduleNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Certificate Evaluation State
  const [evaluatingCase, setEvaluatingCase] = useState<HospitalAssessmentCase | null>(null);
  const [decisionMode, setDecisionMode] = useState<'approve' | 'reject'>('approve');
  const [disabilityPercentage, setDisabilityPercentage] = useState<number>(50);
  const [isPermanent, setIsPermanent] = useState<boolean>(true);
  const [validityYears, setValidityYears] = useState<number>(5);
  const [medicalRemarks, setMedicalRemarks] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [previewUdid, setPreviewUdid] = useState<UdidCardData | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const [c, a, s, ass] = await Promise.all([
        api.cases.list(),
        api.appointments.list(),
        api.appointments.slots(),
        api.certificates.assessments().catch(() => []),
      ]);
      setCases(c);
      setApts(a);
      setSlots(s);
      setAssessments(ass);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleAccept = async (apt: Appointment) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      await api.appointments.update(apt.id, {
        status: 'confirmed',
        notes: apt.notes ? `${apt.notes} · Accepted by Board` : 'Accepted by Medical Board',
      });
      await refreshData();
      setFeedback({ type: 'success', message: `Appointment ${apt.appointment_number} accepted and confirmed.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to accept appointment.' });
    }
    setActionLoading(false);
  };

  const handleComplete = async (apt: Appointment) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      await api.appointments.update(apt.id, {
        status: 'completed',
        notes: apt.notes ? `${apt.notes} · Assessment Completed` : 'Assessment Completed by Medical Board',
      });
      await refreshData();
      setFeedback({ type: 'success', message: `Appointment ${apt.appointment_number} marked as completed.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to complete appointment.' });
    }
    setActionLoading(false);
  };

  const openRescheduleModal = (apt: Appointment) => {
    setReschedulingApt(apt);
    setSelectedSlotId('');
    setRescheduleNotes(apt.notes || 'Rescheduled by Medical Board due to schedule availability.');
    setFeedback(null);
  };

  const handleConfirmReschedule = async () => {
    if (!reschedulingApt || !selectedSlotId) return;
    const slot = slots.find((s) => s.id === selectedSlotId);
    if (!slot) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      await api.appointments.update(reschedulingApt.id, {
        appointment_date: slot.date,
        appointment_time: slot.start_time,
        status: 'confirmed',
        notes: rescheduleNotes,
      });
      await refreshData();
      setFeedback({
        type: 'success',
        message: `Appointment ${reschedulingApt.appointment_number} rescheduled to ${slot.date} at ${slot.start_time}.`,
      });
      setReschedulingApt(null);
      setSelectedSlotId('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reschedule appointment.' });
    }
    setActionLoading(false);
  };

  const openEvaluationModal = (item: HospitalAssessmentCase, mode: 'approve' | 'reject') => {
    setEvaluatingCase(item);
    setDecisionMode(mode);
    setDisabilityPercentage(50);
    setIsPermanent(true);
    setValidityYears(5);
    setMedicalRemarks(
      mode === 'approve'
        ? `Clinical evaluation completed by board for ${item.disability_profile?.disability_category || 'disability'}. Meets criteria under RPwD Act 2016.`
        : ''
    );
    setRejectionReason(
      mode === 'reject'
        ? 'Disability percentage evaluated below benchmark threshold (40%) required for government certification.'
        : ''
    );
    setFeedback(null);
  };

  const handleCertificateDecision = async () => {
    if (!evaluatingCase) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.certificates.decision({
        case_id: evaluatingCase.case.id,
        decision: decisionMode,
        disability_percentage: disabilityPercentage,
        is_permanent: isPermanent,
        validity_years: validityYears,
        medical_remarks: medicalRemarks,
        rejection_reason: rejectionReason,
      });

      await refreshData();
      setFeedback({
        type: 'success',
        message: res.message,
      });
      if (res.udid_card) {
        setPreviewUdid(res.udid_card);
      }
      setEvaluatingCase(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to record certificate decision.' });
    }
    setActionLoading(false);
  };

  if (!cases || !apts) return <Loading />;

  const availableSlots = slots.filter((s) => s.booked_count < s.capacity);

  const appointmentsTable = (
    <div className="card mt-6 overflow-x-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-navy">Medical Board Appointments</h2>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Accept or Reschedule based on board availability
        </span>
      </div>

      {feedback && (
        <div
          className={`mb-4 rounded-xl p-3 text-sm font-semibold ${
            feedback.type === 'success' ? 'bg-mint text-teal border border-teal/20' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {apts.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No appointments assigned to your hospital board.</p>
      ) : (
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="p-3">Number</th>
              <th className="p-3">Date</th>
              <th className="p-3">Time</th>
              <th className="p-3">Status</th>
              <th className="p-3">Notes</th>
              <th className="p-3 text-right">Board Actions</th>
            </tr>
          </thead>
          <tbody>
            {apts.map((a) => {
              const isConfirmed = a.status === 'confirmed';
              const isCompleted = a.status === 'completed';

              return (
                <tr key={a.id} className="border-b hover:bg-slate-50/60 transition-colors">
                  <td className="p-3 font-bold text-teal">{a.appointment_number}</td>
                  <td className="p-3 font-semibold text-navy">{a.appointment_date}</td>
                  <td className="p-3 text-slate-700">{a.appointment_time}</td>
                  <td className="p-3">
                    <span
                      className={`pill text-xs ${
                        isCompleted
                          ? 'bg-blue-100 text-blue-900'
                          : isConfirmed
                          ? 'bg-mint text-teal'
                          : a.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {a.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 max-w-xs truncate text-xs text-slate-500">{a.notes || '—'}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isConfirmed && !isCompleted && (
                        <button
                          onClick={() => handleAccept(a)}
                          disabled={actionLoading}
                          className="rounded-lg bg-teal px-3 py-1.5 text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-50"
                        >
                          Accept
                        </button>
                      )}
                      {isConfirmed && !isCompleted && (
                        <button
                          onClick={() => handleComplete(a)}
                          disabled={actionLoading}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Complete Assessment
                        </button>
                      )}
                      {!isCompleted && (
                        <button
                          onClick={() => openRescheduleModal(a)}
                          disabled={actionLoading}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-navy hover:bg-slate-50 disabled:opacity-50"
                        >
                          Reschedule
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Reschedule Modal / Panel */}
      {reschedulingApt && (
        <div className="mt-6 rounded-2xl border-2 border-teal bg-gradient-to-br from-mint/20 to-white p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="pill bg-mint text-teal font-bold text-xs">BOARD RESCHEDULING</span>
              <h3 className="mt-1 text-lg font-black text-navy">
                Reschedule Appointment: {reschedulingApt.appointment_number}
              </h3>
              <p className="text-xs text-slate-600">
                Currently scheduled for <b>{reschedulingApt.appointment_date}</b> at <b>{reschedulingApt.appointment_time}</b>
              </p>
            </div>
            <button
              onClick={() => setReschedulingApt(null)}
              className="rounded-lg border bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              ✕ Cancel
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Select an available slot based on hospital board availability:
            </label>
            {availableSlots.length === 0 ? (
              <p className="mt-2 text-sm text-red-600">No alternate open slots found for this board.</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-3 max-h-48 overflow-y-auto p-1">
                {availableSlots.map((s) => {
                  const isSelected = selectedSlotId === s.id;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setSelectedSlotId(s.id)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-teal bg-teal text-white shadow-sm ring-2 ring-teal/30'
                          : 'bg-white hover:border-teal/50 hover:bg-mint/10'
                      }`}
                    >
                      <p className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-navy'}`}>{s.date}</p>
                      <p className={`text-xs ${isSelected ? 'text-teal-100' : 'text-slate-600'}`}>
                        {s.start_time} – {s.end_time}
                      </p>
                      <p className={`mt-1 text-[10px] font-semibold ${isSelected ? 'text-teal-200' : 'text-teal'}`}>
                        {s.capacity - s.booked_count} spots available
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Rescheduling reason / Notes:
            </label>
            <input
              type="text"
              value={rescheduleNotes}
              onChange={(e) => setRescheduleNotes(e.target.value)}
              placeholder="e.g. Rescheduled due to medical board doctor availability"
              className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setReschedulingApt(null)}
              className="rounded-xl border bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReschedule}
              disabled={!selectedSlotId || actionLoading}
              className="btn text-xs disabled:opacity-50"
            >
              {actionLoading ? 'Rescheduling…' : 'Confirm Reschedule'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const certificatesView = (
    <div>
      <Title
        eyebrow="Hospital Medical Board"
        title="Disability Certificate & UDID Decisions"
        copy="Review candidate clinical evaluations, benchmark criteria (RPwD Act 2016), approve certificates with mock UDID generation, or record rejections."
      />

      {feedback && (
        <div
          className={`mb-6 rounded-xl p-4 text-sm font-semibold ${
            feedback.type === 'success' ? 'bg-mint text-teal border border-teal/20' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Generated UDID Preview Modal / Section */}
      {previewUdid && (
        <div className="card mb-8 border-2 border-teal bg-mint/10">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="pill bg-mint text-teal font-bold text-xs">OFFICIAL MOCK UDID GENERATED</span>
              <h3 className="mt-1 text-lg font-black text-navy">Unique Disability ID Card Issued</h3>
            </div>
            <button
              onClick={() => setPreviewUdid(null)}
              className="rounded-lg border bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              ✕ Close Preview
            </button>
          </div>
          <UdidCard card={previewUdid} />
        </div>
      )}

      {/* Evaluation Form / Modal */}
      {evaluatingCase && (
        <div className="card mb-8 border-2 border-navy bg-gradient-to-br from-slate-50 to-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between border-b pb-3">
            <div>
              <span className={`pill text-xs ${decisionMode === 'approve' ? 'bg-mint text-teal' : 'bg-red-100 text-red-800'}`}>
                {decisionMode === 'approve' ? 'APPROVING CERTIFICATE & UDID' : 'REJECTING CERTIFICATE'}
              </span>
              <h2 className="mt-1 text-xl font-black text-navy">
                Candidate: {evaluatingCase.user_name} ({evaluatingCase.case.case_number})
              </h2>
              <p className="text-xs text-slate-600">
                Disability Category: <b>{evaluatingCase.disability_profile?.disability_category?.replace('_', ' ').toUpperCase() || 'GENERAL'}</b> · {evaluatingCase.citizen.district}, {evaluatingCase.citizen.state}
              </p>
            </div>
            <button
              onClick={() => setEvaluatingCase(null)}
              className="rounded-lg border bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              ✕ Cancel
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {decisionMode === 'approve' ? (
              <>
                {/* Benchmark Percentage Slider */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Evaluated Disability Percentage:
                    </label>
                    <span className={`font-black text-lg ${disabilityPercentage >= 40 ? 'text-teal' : 'text-amber-600'}`}>
                      {disabilityPercentage}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={disabilityPercentage}
                    onChange={(e) => setDisabilityPercentage(Number(e.target.value))}
                    className="mt-2 w-full accent-teal cursor-pointer"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">10% (Mild)</span>
                    <span className={disabilityPercentage >= 40 ? 'font-bold text-teal' : 'font-bold text-amber-600'}>
                      {disabilityPercentage >= 40 ? '✓ Meets RPwD Benchmark (≥ 40%)' : '⚠ Below 40% Benchmark Threshold'}
                    </span>
                    <span className="text-slate-400">100% (Severe)</span>
                  </div>
                </div>

                {/* Validity Mode */}
                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Validity Period:</label>
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsPermanent(true)}
                        className={`flex-1 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                          isPermanent ? 'border-teal bg-teal text-white' : 'bg-white text-navy'
                        }`}
                      >
                        Permanent (Lifetime)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPermanent(false)}
                        className={`flex-1 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                          !isPermanent ? 'border-teal bg-teal text-white' : 'bg-white text-navy'
                        }`}
                      >
                        Temporary
                      </button>
                    </div>
                  </div>

                  {!isPermanent && (
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Valid For (Years):</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={validityYears}
                        onChange={(e) => setValidityYears(Number(e.target.value))}
                        className="mt-2 w-full rounded-xl border bg-white p-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Medical Remarks */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Medical Board Evaluation Notes / Clinical Findings:
                  </label>
                  <textarea
                    value={medicalRemarks}
                    onChange={(e) => setMedicalRemarks(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"
                    placeholder="Enter clinical examination notes, specialist board findings, or diagnosis..."
                  />
                </div>
              </>
            ) : (
              <>
                {/* Rejection Reason Form */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-red-700">
                    Criteria Non-Fulfillment / Rejection Reason:
                  </label>
                  <textarea
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-red-300 bg-white p-2.5 text-sm"
                    placeholder="Specify why the certificate application is not approved (e.g. below 40% threshold, inconclusive test results)..."
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    This reason will be provided to the citizen and recorded in their case timeline.
                  </p>
                </div>
              </>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setEvaluatingCase(null)}
                className="rounded-xl border bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCertificateDecision}
                disabled={actionLoading}
                className={`btn text-xs ${decisionMode === 'approve' ? 'bg-teal' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
              >
                {actionLoading
                  ? 'Recording Decision…'
                  : decisionMode === 'approve'
                  ? '✓ Approve & Issue UDID'
                  : '✕ Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Assessments Table */}
      <div className="card overflow-x-auto">
        <h2 className="mb-4 text-xl font-black text-navy">Assessment Cases Queue</h2>
        {assessments.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No cases pending assessment at your hospital.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="p-3">Citizen</th>
                <th className="p-3">Case / Category</th>
                <th className="p-3">Assessment Status</th>
                <th className="p-3">UDID Status</th>
                <th className="p-3">Evaluation Info</th>
                <th className="p-3 text-right">Medical Board Decision</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((item) => {
                const certApproved = item.disability_profile?.certificate_status === 'approved';
                const certRejected = item.disability_profile?.certificate_status === 'rejected';

                return (
                  <tr key={item.case.id} className="border-b hover:bg-slate-50/70 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-navy">{item.user_name}</p>
                      <p className="text-xs text-slate-500">{item.citizen.district}, {item.citizen.state}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-teal">{item.case.case_number}</p>
                      <span className="pill bg-slate-100 text-slate-700 text-[10px]">
                        {item.disability_profile?.disability_category?.replace('_', ' ').toUpperCase() || 'NOT SPECIFIED'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`pill text-xs ${
                          certApproved
                            ? 'bg-mint text-teal'
                            : certRejected
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {item.disability_profile?.certificate_status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                      </span>
                    </td>
                    <td className="p-3">
                      {item.udid_card ? (
                        <div>
                          <span className="pill bg-blue-100 text-blue-900 font-mono text-[11px]">
                            {item.udid_card.udid_number}
                          </span>
                          <button
                            onClick={() => setPreviewUdid(item.udid_card)}
                            className="mt-1 block text-[11px] font-bold text-teal hover:underline"
                          >
                            View UDID Card ↗
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Not Issued</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-600 max-w-xs truncate">
                      {item.disability_profile?.broad_disability_status || 'Pending medical board examination'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!certApproved && (
                          <button
                            onClick={() => openEvaluationModal(item, 'approve')}
                            disabled={actionLoading}
                            className="rounded-lg bg-teal px-3 py-1.5 text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-50"
                          >
                            Approve & UDID
                          </button>
                        )}
                        {!certApproved && !certRejected && (
                          <button
                            onClick={() => openEvaluationModal(item, 'reject')}
                            disabled={actionLoading}
                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                        {certApproved && (
                          <span className="text-xs font-bold text-teal">✓ Certified</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  if (page === 'cases') {
    return (
      <>
        <Title eyebrow="Hospital desk" title="Hospital cases" copy="Cases assigned to your hospital." />
        <div className="card overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="p-3">Case #</th>
                <th className="p-3">Type</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Status</th>
                <th className="p-3">Priority</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b hover:bg-slate-50">
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

  if (page === 'appointments') {
    return (
      <>
        <Title
          eyebrow="Hospital desk"
          title="Board Appointments"
          copy="Accept pending appointments or reschedule based on medical board availability."
        />
        {appointmentsTable}
      </>
    );
  }

  if (page === 'certificates') {
    return certificatesView;
  }

  const approvedCount = assessments.filter((a) => a.disability_profile?.certificate_status === 'approved').length;
  const pendingCount = assessments.filter((a) => a.disability_profile?.certificate_status !== 'approved' && a.disability_profile?.certificate_status !== 'rejected').length;

  return (
    <>
      <Title eyebrow="Hospital desk" title="Today's overview" copy="Cases, appointments, and certificate evaluations assigned to your hospital." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-sm font-bold text-slate-600">Total cases</p>
          <p className="mt-1 text-2xl font-black text-navy">{cases.length}</p>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-slate-600">Appointments</p>
          <p className="mt-1 text-2xl font-black text-navy">{apts.length}</p>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-slate-600">UDIDs Issued</p>
          <p className="mt-1 text-2xl font-black text-teal">{approvedCount}</p>
        </div>
        <div className="card">
          <p className="text-sm font-bold text-slate-600">Pending Evaluation</p>
          <p className="mt-1 text-2xl font-black text-amber-600">{pendingCount}</p>
        </div>
      </div>

      {/* Quick link banner to Certificate decisions */}
      <div className="card mt-6 border-l-4 border-l-teal bg-gradient-to-r from-mint/30 to-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="pill bg-mint text-teal font-bold text-xs">DECISION BOARD</span>
          <h2 className="mt-1 text-xl font-black text-navy">Disability Certificate & UDID Evaluation</h2>
          <p className="mt-1 text-xs text-slate-600">
            {pendingCount} candidate(s) awaiting medical board percentage evaluation and official UDID generation.
          </p>
        </div>
        <Link href="/hospital/certificates" className="btn text-xs">
          Open Certificate Board →
        </Link>
      </div>

      {appointmentsTable}
      <CitizenJourneyReview />
    </>
  );
}

/* ── CPGRAMS Officer View ── */

function CpgramsView({ page }: { page: string }) {
  const [grievances, setGrievances] = useState<Grievance[]>();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    api.grievances.list('cpgrams').then(setGrievances);
  }, []);

  const updateStatus = async (id: string, status: string, message: string) => {
    setUpdatingId(id);
    try {
      await api.grievances.updateStatus(id, { status, message });
      api.grievances.list('cpgrams').then(setGrievances);
    } catch (e: any) {
      alert(e.message);
    }
    setUpdatingId(null);
  };

  if (!grievances) return <Loading />;

  if (page === 'grievances') {
    return (
      <>
        <Title eyebrow="CPGRAMS" title="Grievance Queue" copy="Service grievances assigned to CPGRAMS for resolution." />
        {grievances.length === 0 && <p className="text-sm text-slate-500">No grievances in queue.</p>}
        {grievances.map((g) => (
          <div key={g.id} className="card mb-4 max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="pill bg-amber-100 text-amber-900">{g.status.replace('_', ' ')}</span>
              <span className="text-sm text-slate-500">{g.grievance_number}</span>
            </div>
            <h2 className="mt-3 font-black text-navy">{g.subject}</h2>
            <p className="mt-2 text-sm text-slate-600">{g.description}</p>
            {g.status === 'submitted' && (
              <button onClick={() => updateStatus(g.id, 'acknowledged', 'Grievance acknowledged by CPGRAMS officer.')} disabled={updatingId === g.id} className="btn mt-4 text-xs">
                {updatingId === g.id ? 'Updating…' : 'Acknowledge'}
              </button>
            )}
            {g.status === 'acknowledged' && (
              <button onClick={() => updateStatus(g.id, 'under_review', 'Forwarded to concerned department for review.')} disabled={updatingId === g.id} className="btn mt-4 text-xs">
                {updatingId === g.id ? 'Updating…' : 'Forward for Review'}
              </button>
            )}
            {g.status === 'under_review' && (
              <button onClick={() => updateStatus(g.id, 'action_taken', 'Action taken on the grievance. Citizen notified.')} disabled={updatingId === g.id} className="btn mt-4 text-xs">
                {updatingId === g.id ? 'Updating…' : 'Mark Action Taken'}
              </button>
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <Title eyebrow="CPGRAMS" title="CPGRAMS Officer Dashboard" copy="Overview of service grievances routed through CPGRAMS." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card"><p className="text-sm font-bold text-slate-600">Total grievances</p><p className="mt-1 text-2xl font-black text-navy">{grievances.length}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Submitted</p><p className="mt-1 text-2xl font-black text-navy">{grievances.filter((g) => g.status === 'submitted').length}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Acknowledged</p><p className="mt-1 text-2xl font-black text-navy">{grievances.filter((g) => g.status === 'acknowledged').length}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Action Taken</p><p className="mt-1 text-2xl font-black text-navy">{grievances.filter((g) => g.status === 'action_taken').length}</p></div>
      </div>
      <CitizenJourneyReview />
    </>
  );
}

/* ── State Representative View ── */

function StateView({ page }: { page: string }) {
  const [grievances, setGrievances] = useState<Grievance[]>();
  const [cases, setCases] = useState<CaseBasic[]>();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    api.grievances.list('rights_violation').then(setGrievances);
    api.cases.list().then(setCases);
  }, []);

  const updateStatus = async (id: string, status: string, message: string) => {
    setUpdatingId(id);
    try {
      await api.grievances.updateStatus(id, { status, message });
      api.grievances.list('rights_violation').then(setGrievances);
    } catch (e: any) {
      alert(e.message);
    }
    setUpdatingId(null);
  };

  if (!grievances) return <Loading />;

  if (page === 'grievances') {
    return (
      <>
        <Title eyebrow="State Commissioner" title="Rights Violation Queue" copy="Complaints about disability rights violations under the RPwD Act, 2016." />
        {grievances.length === 0 && <p className="text-sm text-slate-500">No rights violation complaints.</p>}
        {grievances.map((g) => (
          <div key={g.id} className="card mb-4 max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="pill bg-red-100 text-red-800">{g.status.replace('_', ' ')}</span>
              <span className="text-sm text-slate-500">{g.grievance_number}</span>
            </div>
            <h2 className="mt-3 font-black text-navy">{g.subject}</h2>
            <p className="mt-2 text-sm text-slate-600">{g.description}</p>
            {g.status === 'submitted' && (
              <button onClick={() => updateStatus(g.id, 'under_review', 'Rights violation complaint under review by State Commissioner.')} disabled={updatingId === g.id} className="btn mt-4 text-xs">
                {updatingId === g.id ? 'Updating…' : 'Begin Review'}
              </button>
            )}
            {g.status === 'under_review' && (
              <button onClick={() => updateStatus(g.id, 'action_taken', 'Investigation completed. Corrective action initiated.')} disabled={updatingId === g.id} className="btn mt-4 text-xs">
                {updatingId === g.id ? 'Updating…' : 'Take Action'}
              </button>
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <Title eyebrow="State Commissioner" title="State Representative Dashboard" copy="Overview of rights violation complaints and assigned cases." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card"><p className="text-sm font-bold text-slate-600">Rights complaints</p><p className="mt-1 text-2xl font-black text-navy">{grievances.length}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Under review</p><p className="mt-1 text-2xl font-black text-navy">{grievances.filter((g) => g.status === 'under_review').length}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Cases</p><p className="mt-1 text-2xl font-black text-navy">{cases?.length || 0}</p></div>
        <div className="card"><p className="text-sm font-bold text-slate-600">Action taken</p><p className="mt-1 text-2xl font-black text-navy">{grievances.filter((g) => g.status === 'action_taken').length}</p></div>
      </div>
      <CitizenJourneyReview />
    </>
  );
}

/* ── Admin View ── */

function AdminView({ page }: { page: string }) {
  const [summary, setSummary] = useState<AdminSummary>();
  const [resetting, setResetting] = useState(false);
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
      <div className="card mt-6 max-w-2xl">
        <h2 className="font-black text-navy">Demo actions</h2>
        <p className="mt-2 text-sm text-slate-600">
          Reset Rahul Sharma&apos;s citizen journey to the beginning. Grievances remain available for CPGRAMS and State representatives to review.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={async () => {
              setResetting(true);
              try {
                const res = await api.admin.resetCitizenProgress();
                alert(res.message);
              } catch (e: any) {
                alert(e.message);
              }
              setResetting(false);
            }}
            disabled={resetting}
            className="btn"
          >
            {resetting ? 'Resetting…' : 'Reset Rahul Sharma progress'}
          </button>
          <button onClick={() => api.admin.seedDemo().then(() => alert('Demo data reloaded'))} className="rounded-xl border px-4 py-2 font-bold text-navy">
            Re-seed demo data
          </button>
        </div>
      </div>
      <CitizenJourneyReview />
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
    else if (page === 'benefits' || page === 'pensions') content = <Benefits />;
    else if (page === 'grievances' || page === 'grievance-and-status') content = <CpgramsGrievance />;
    else if (page === 'cpgrams-grievance') content = <CpgramsGrievance />;
    else if (page === 'rights-grievance') content = <RightsViolationGrievance />;
    else if (page === 'documents') content = <Documents />;
    else if (page === 'ngos') content = <NgosPage />;
    else if (page === 'notifications') content = <NotificationsPage />;
    else content = <CitizenHome />;
  } else if (role === 'hospital') {
    content = <HospitalView page={page} />;
  } else if (role === 'cpgrams') {
    content = <CpgramsView page={page} />;
  } else if (role === 'state') {
    content = <StateView page={page} />;
  } else {
    content = <AdminView page={page} />;
  }

  return <PortalShell role={role}>{content}</PortalShell>;
}
