import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CMD AI Adoption Exam 2026',
  description: 'Event registration for CMD AI Adoption Exam 2026',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="site-nav">
            <Link href="/" className="site-nav__brand">CMD AI Adoption Exam 2026</Link>
            <div className="site-nav__links">
              <Link href="/register">Register</Link>
              <Link href="/lookup">My registration</Link>
              <Link href="/admin/login">Admin</Link>
            </div>
          </nav>
        </header>
        <main className="site-main site-main--wide">{children}</main>
      </body>
    </html>
  );
}
