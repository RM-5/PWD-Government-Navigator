'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

const accounts: [string, string, string][] = [
  ['Rahul Sharma', 'citizen@demo.local', 'citizen'],
  ['Delhi Government Hospital', 'hospital@demo.local', 'hospital'],
  ['Delhi State Office', 'state@demo.local', 'state'],
  ['System Administrator', 'admin@demo.local', 'admin'],
];

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('citizen@demo.local');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <main className="grid min-h-screen bg-mint lg:grid-cols-2">
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
            <option value="state@demo.local">Delhi State Office</option>
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
    </main>
  );
}
