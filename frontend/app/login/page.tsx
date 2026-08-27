'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { WorkflowProgress, WorkflowStep } from '@/lib/api/types';

const accounts: [string, string, string][] = [
  ['Rahul Sharma', 'citizen@demo.local', 'citizen'],
  ['Delhi Government Hospital', 'hospital@demo.local', 'hospital'],
  ['CPGRAMS Officer', 'cpgrams@demo.local', 'cpgrams'],
  ['State Representative', 'state@demo.local', 'state'],
  ['System Administrator', 'admin@demo.local', 'admin'],
];

const faqs = [
  {
    q: 'What is the difference between CPGRAMS and Rights Violation grievances?',
    a: 'CPGRAMS handles general service issues like application delays, certificate processing, and benefit concerns. Rights Violation complaints go to the State Commissioner when your rights under the RPwD Act, 2016 are violated.',
  },
  {
    q: 'Can I file a grievance during any workflow step?',
    a: 'Yes. Grievances are available at every step — if your application is delayed, your rights are violated, or you face a barrier at any point, you can file a complaint without waiting.',
  },
  {
    q: 'How do I get a disability certificate?',
    a: 'Book a medical board assessment at a government hospital through Sahaayak. After assessment, the hospital issues a certificate and your UDID is generated.',
  },
  {
    q: 'Is my personal data safe?',
    a: 'This is a demo prototype. No real Aadhaar, medical records, or identity documents are collected or stored.',
  },
];

function StepBadge({ step }: { step: WorkflowStep }) {
  const isDone = step.status === 'completed';
  const isCurrent = step.status === 'in_progress';
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        isDone ? 'bg-mint text-teal' : isCurrent ? 'bg-teal text-white' : 'bg-slate-100 text-slate-400'
      }`}
    >
      {isDone ? '✓' : step.step}
    </span>
  );
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('citizen@demo.local');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowProgress | null>(null);

  useEffect(() => {
    api.demo.workflowProgress().then(setWorkflow).catch(() => setWorkflow(null));
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = accounts.find((a) => a[1] === email);
    if (!found) {
      setError('Choose one of the demo accounts to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.auth.login(email);
      router.push('/' + found[2]);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Is the backend running on port 8000?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen h-screen overflow-hidden bg-mint lg:grid-cols-2">
      <section className="flex h-full flex-col overflow-y-auto bg-navy p-6 text-white sm:p-10 lg:p-12">
        <span className="mb-5 w-fit rounded-full bg-white/15 px-4 py-2 text-xs font-bold tracking-wider">DEMO ENVIRONMENT</span>
        <h1 className="max-w-xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
          Government services, made easier to act on.
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-200 sm:text-lg">
          Sahaayak keeps your disability-services journey clear: what is complete, what happens next, and who can help.
        </p>

        <div className="mt-8 flex-1">
          <h2 className="text-xl font-black sm:text-2xl">Application Workflow</h2>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">
            Live demo progress for {workflow?.citizen_name || 'Rahul Sharma'}
            {workflow?.current_stage ? ` · Current stage: ${workflow.current_stage}` : ''}
          </p>
          <ol className="mt-5 space-y-3">
            {(workflow?.steps || []).map((s) => (
              <li key={s.key} className="flex gap-3 rounded-2xl bg-white/5 p-3">
                <StepBadge step={s} />
                <div className="min-w-0">
                  <p className="font-bold">{s.title}</p>
                  <p className="text-sm text-slate-300">{s.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {workflow?.grievance_note || 'Grievances can be filed at any step of the journey.'}
          </p>
        </div>
      </section>

      <section className="flex h-full flex-col overflow-y-auto p-5 sm:p-8 lg:p-10">
        <form onSubmit={login} className="w-full rounded-3xl bg-white p-6 shadow-xl sm:p-7">
          <h2 className="text-2xl font-black text-navy">Welcome back</h2>
          <p className="mt-2 text-slate-600">Choose a demo role to explore the connected workflow.</p>
          <label className="label mt-6" htmlFor="email">
            Demo account
          </label>
          <select id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border p-3">
            <option value="citizen@demo.local">Rahul Sharma — Citizen</option>
            <option value="hospital@demo.local">Delhi Government Hospital</option>
            <option value="cpgrams@demo.local">Rajesh Kumar — CPGRAMS Officer</option>
            <option value="state@demo.local">Meera Iyer — State Representative</option>
            <option value="admin@demo.local">System Administrator</option>
          </select>
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <button className="btn mt-6 w-full" type="submit" disabled={loading}>
            {loading ? 'Connecting…' : 'Continue to demo'}
          </button>
          <p className="mt-5 text-center text-xs text-slate-500">This prototype never requests Aadhaar or real identity details.</p>
        </form>

        <div className="mt-6 flex-1 rounded-3xl bg-white p-6 shadow-xl sm:p-7">
          <h2 className="text-xl font-black text-navy sm:text-2xl">Common FAQs</h2>
          <p className="mt-2 text-sm text-slate-600">Quick answers to questions citizens often have.</p>
          <div className="mt-4 space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-navy"
                  aria-expanded={openFaq === i}
                >
                  {faq.q}
                  <span className="ml-2 text-teal">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && <p className="border-t px-4 py-3 text-sm text-slate-600">{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
