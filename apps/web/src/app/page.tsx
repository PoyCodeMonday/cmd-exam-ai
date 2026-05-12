import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="stack">
      <div className="eyebrow">Event registration</div>
      <h1>CMD AI Adoption Exam 2026</h1>
      <p className="muted">Register for the exam, return to edit your details, or sign in as an organiser.</p>
      <ul className="tile-grid">
        <li>
          <Link href="/register" className="tile">
            <h2>Register</h2>
            <p>Submit a new registration.</p>
          </Link>
        </li>
        <li>
          <Link href="/lookup" className="tile">
            <h2>View / edit my registration</h2>
            <p>Enter your reference code and password.</p>
          </Link>
        </li>
        <li>
          <Link href="/admin/login" className="tile">
            <h2>Admin</h2>
            <p>Staff login.</p>
          </Link>
        </li>
      </ul>
    </section>
  );
}
