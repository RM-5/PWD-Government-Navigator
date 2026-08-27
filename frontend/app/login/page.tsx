'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

const accounts: [string, string, string][] = [
  ['Rahul Sharma', 'citizen@demo.local', 'citizen'],
  ['Delhi Government Hospital', 'hospital@demo.local', 'hospital'],
  ['CPGRAMS Officer', 'cpgrams@demo.local', 'cpgrams'],
  ['State Representative', 'state@demo.local', 'state'],
  ['System Administrator', 'admin@demo.local', 'admin'],
];

const workflowSteps = [
  { step: 1, title: 'Register & Profile', desc: 'Create your citizen profile and verify identity (demo mode — no real Aadhaar required).' },
  { step: 2, title: 'Find Services', desc: 'Browse government services for disability certification, benefits, and UDID.' },
  { step: 3, title: 'Book Assessment', desc: 'Locate an accessible hospital and book a medical board appointment.' },
  { step: 4, title: 'Track Certificate', desc: 'Monitor your disability certificate and UDID issuance journey.' },
  { step: 5, title: 'Apply for Benefits', desc: 'Check eligibility and apply for state benefits like transport concession.' },
  { step: 6, title: 'File Grievances', desc: 'Submit service delays to CPGRAMS or report rights violations to the State Commissioner.' },
  { step: 7, title: 'Get Support', desc: 'Connect with NGOs for document help, legal awareness, and grievance support.' },
];

const faqs = [
  {
    q: 'What is the difference between CPGRAMS and Rights Violation grievances?',
    a: 'CPGRAMS handles general service issues like application delays, certificate processing, and benefit concerns. Rights Violation complaints go to the State Commissioner when your rights under the RPwD Act, 2016 are violated (e.g., denied accessibility, discrimination).',
  },
  {
    q: 'How do I get a disability certificate?',
    a: 'Book a medical board assessment at a government hospital through Sahaayak. After assessment, the hospital issues a certificate and your UDID is generated.',
  },
  {
    q: 'Is my personal data safe?',
    a: 'This is a demo prototype. No real Aadhaar, medical records, or identity documents are collected or stored.',
  },
  {
    q: 'Who handles my grievance?',
    a: 'Service-related grievances are routed to a CPGRAMS officer. Rights violations are handled by the State Commissioner for Persons with Disabilities.',
  },
  {
    q: 'Can caregivers use this platform?',
    a: 'Yes. Caregivers and family members can help navigate services, book appointments, and file grievances on behalf of a person with disability.',
  },
];

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('citizen@demo.local');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
    <main className="min-h-screen bg-mint">
      <div className="grid lg:grid-cols-2">
        <section className="flex flex-col justify-center bg-navy p-8 text-white sm:p-16">
          <span className="mb-7 w-fit rounded-full bg-white/15 px-4 py-2 text-xs font-bold tracking-wider">
            DEMO ENVIRONMENT
          </span>
          <h1 className="max-w-lg text-4xl font-black leading-tight sm:text-5xl">
            Government services, made easier to act on.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-slate-200">
            Sahaayak keeps your disability-services journey clear: what is complete, what happens next, and who can help.
          </p>
        </section>
        <section className="flex items-center justify-center p-6">
          <form onSubmit={login} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl">
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
            <p className="mt-5 text-center text-xs text-slate-500">
              This prototype never requests Aadhaar or real identity details.
            </p>
          </form>
        </section>
      </div>

      {/* Workflow & FAQ section below login */}
      <section className="border-t border-teal/20 bg-white px-6 py-12 sm:px-16">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-black text-navy">Application Workflow</h2>
            <p className="mt-2 text-slate-600">Your guided journey from registration to grievance resolution.</p>
            <ol className="mt-6 space-y-4">
              {workflowSteps.map((s) => (
                <li key={s.step} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-sm font-bold text-white">
                    {s.step}
                  </span>
                  <div>
                    <p className="font-bold text-navy">{s.title}</p>
                    <p className="text-sm text-slate-600">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="text-2xl font-black text-navy">Common FAQs</h2>
            <p className="mt-2 text-slate-600">Quick answers to questions citizens often have.</p>
            <div className="mt-6 space-y-3">
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
        </div>
      </section>
    </main>
  );
}
