'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Role } from '@/lib/api/types';
import { api } from '@/lib/api';

const nav: Record<Role, string[][]> = {
  citizen: [
    ['Home', '/citizen'],
    ['Services', '/citizen/services'],
    ['Medical Assessment', '/citizen/medical-assessment'],
    ['Documents', '/citizen/documents'],
    ['Benefits', '/citizen/benefits'],
    ['CPGRAMS Grievance', '/citizen/cpgrams-grievance'],
    ['Rights Violation', '/citizen/rights-grievance'],
    ['NGOs', '/citizen/ngos'],
    ['Notifications', '/citizen/notifications'],
  ],
  hospital: [
    ['Today', '/hospital'],
    ['Appointments', '/hospital/appointments'],
    ['Certificates', '/hospital/certificates'],
    ['Cases', '/hospital/cases'],
  ],
  cpgrams: [
    ['Dashboard', '/cpgrams'],
    ['Grievance Queue', '/cpgrams/grievances'],
  ],
  state: [
    ['Dashboard', '/state'],
    ['Rights Violations', '/state/grievances'],
  ],
  admin: [
    ['Overview', '/admin'],
  ],
};

export function PortalShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [a11y, setA11y] = useState('Default');
  const [userName, setUserName] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // Load user name from stored user
    try {
      const stored = localStorage.getItem('demo-user');
      if (stored) {
        const user = JSON.parse(stored);
        setUserName(user.full_name || '');
      }
    } catch { /* ignore */ }

    // Fetch notification count
    api.notifications.list().then((ns) => {
      setUnread(ns.filter((n) => !n.read_at).length);
    }).catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.size = a11y === 'Larger text' ? 'large' : '';
    document.documentElement.dataset.contrast = a11y === 'High contrast' ? 'high' : '';
    document.documentElement.dataset.motion = a11y === 'Reduced motion' ? 'reduced' : '';
  }, [a11y]);

  const title =
    role === 'citizen'
      ? 'Sahaayak'
      : role === 'state'
      ? 'State Commissioner'
      : role === 'cpgrams'
      ? 'CPGRAMS Desk'
      : role === 'hospital'
      ? 'Hospital Desk'
      : 'Operations';

  const logout = () => {
    api.auth.logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-white px-4 lg:px-7">
        <div className="flex items-center gap-3">
          <button onClick={() => setMenu(!menu)} className="rounded-lg p-2 lg:hidden" aria-label="Open navigation" aria-expanded={menu}>
            ☰
          </button>
          <Link href={`/${role}`} className="text-xl font-black text-navy">
            Sahaayak <span className="text-teal">●</span>
          </Link>
          <span className="hidden text-sm text-slate-500 sm:inline">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {userName && <span className="hidden text-sm font-semibold text-navy md:inline">{userName}</span>}
          <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 sm:inline">
            DEMO
          </span>
          <label className="sr-only" htmlFor="accessibility">
            Accessibility settings
          </label>
          <select
            id="accessibility"
            value={a11y}
            onChange={(e) => setA11y(e.target.value)}
            className="rounded-lg border p-2 text-sm"
            aria-label="Accessibility settings"
          >
            <option>Default</option>
            <option>Larger text</option>
            <option>High contrast</option>
            <option>Reduced motion</option>
          </select>
          <Link href={`/${role}/notifications`} className="relative rounded-lg p-2" aria-label="Notifications">
            🔔
            {unread > 0 && (
              <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
          <button onClick={logout} className="text-sm font-bold text-navy">
            Log out
          </button>
        </div>
      </header>
      {menu && (
        <button onClick={() => setMenu(false)} className="fixed inset-0 z-30 bg-navy/20 lg:hidden" aria-label="Close navigation" />
      )}
      <div className="flex">
        <aside
          className={`${
            menu ? 'block' : 'hidden'
          } fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto border-r bg-white p-4 pt-20 shadow-xl lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:shrink-0 lg:py-4 lg:shadow-none`}
        >
          <p className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-slate-500">{role} portal</p>
          <nav className="space-y-1" aria-label={`${role} portal navigation`}>
            {nav[role].map(([name, href]) => {
              const isActive =
                path === href ||
                (href === '/citizen/medical-assessment' && path === '/citizen/appointments') ||
                (href === '/citizen/cpgrams-grievance' && (path === '/citizen/grievance-and-status' || path === '/citizen/grievances'));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenu(false)}
                  className={`block rounded-xl px-3 py-3 font-semibold ${
                    isActive ? 'bg-mint text-teal' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {name}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="relative z-0 min-w-0 flex-1 isolate p-4 sm:p-7">
          {role === 'citizen' && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <span className="font-bold">Need help at any step?</span> File a{' '}
              <Link href="/citizen/cpgrams-grievance" className="font-bold text-teal underline">
                CPGRAMS grievance
              </Link>{' '}
              for service delays, or a{' '}
              <Link href="/citizen/rights-grievance" className="font-bold text-teal underline">
                rights violation complaint
              </Link>{' '}
              if your disability rights are affected.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
