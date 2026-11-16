import { Link } from 'react-router-dom';
import { Logo } from '../components/Icons';

const UPDATED = '16 November 2026';

function Privacy() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="muted">Last updated {UPDATED}</p>
      <p>
        HeyChat is a personal project that lets two people exchange messages, photos and voice notes. This page explains what we store, why, and
        how you can remove it.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>Your username, display name, optional bio and optional profile photo.</li>
        <li>Your password, only as a one-way Argon2id hash. Nobody, including the operator, can read it.</li>
        <li>The messages, photos and voice notes you send, and the time each was sent, delivered and read.</li>
        <li>A list of your active sign-in sessions with the browser name, so you can sign out everywhere.</li>
        <li>When you were last online, which is shown to people you chat with.</li>
      </ul>
      <h2>What we do not do</h2>
      <ul>
        <li>No advertising, tracking pixels or analytics scripts.</li>
        <li>No selling or sharing of your data with anyone.</li>
        <li>Photos are re-encoded on upload, which removes location and camera metadata.</li>
      </ul>
      <h2>Who can see your content</h2>
      <p>
        Messages in a chat are visible only to the two people in it. Photos and voice notes live in private storage and are served through
        links that expire. Messages are encrypted in transit (HTTPS) and at rest by our database provider, but they are not end-to-end
        encrypted, so the service operator could technically access them. Do not use HeyChat for sensitive information.
      </p>
      <h2>Where data is processed</h2>
      <p>
        The app runs on Vercel (website), Render (server) and Supabase (database and file storage, United States region).
      </p>
      <h2>Your controls</h2>
      <ul>
        <li>Delete any message you sent, for both people, from the message menu.</li>
        <li>Clear a chat from your own view, or block someone.</li>
        <li>Delete your account from Settings. This permanently removes your profile, your chats and all their media.</li>
      </ul>
      <h2>Contact</h2>
      <p>
        Questions about your data: open an issue at{' '}
        <a href="https://github.com/rachitkumar2105/HeyChat" target="_blank" rel="noopener noreferrer">
          github.com/rachitkumar2105/HeyChat
        </a>
        .
      </p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="muted">Last updated {UPDATED}</p>
      <p>By creating an account you agree to these terms. If you do not agree, do not use HeyChat.</p>
      <h2>The service</h2>
      <p>
        HeyChat is provided free of charge, as is, without guarantees of availability. The server can sleep when idle and may take a moment to
        respond. Features can change or be discontinued.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>Keep your password private. You are responsible for activity on your account.</li>
        <li>One person per account. Do not impersonate others.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Do not use HeyChat to:</p>
      <ul>
        <li>harass, threaten or spam anyone;</li>
        <li>share content that is illegal or that you do not have the right to share;</li>
        <li>attempt to break, overload or gain unauthorised access to the service.</li>
      </ul>
      <p>Accounts that break these rules can be removed without notice.</p>
      <h2>Your content</h2>
      <p>
        You own what you send. You give HeyChat permission to store and deliver it to the person you sent it to, and nothing else.
      </p>
      <h2>Limits</h2>
      <p>Photos up to 10 MB, voice notes up to 5 minutes, text messages up to 4000 characters.</p>
      <h2>Liability</h2>
      <p>To the extent allowed by law, the operator is not liable for lost data or for damages arising from use of the service.</p>
    </>
  );
}

export function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
  return (
    <main className="legal">
      <header className="legal-head">
        <Link to="/" className="brand">
          <Logo size={28} />
          <span>HeyChat</span>
        </Link>
        <nav>
          <Link to="/privacy" aria-current={page === 'privacy' ? 'page' : undefined}>
            Privacy
          </Link>
          <Link to="/terms" aria-current={page === 'terms' ? 'page' : undefined}>
            Terms
          </Link>
        </nav>
      </header>
      <article className="legal-body">{page === 'privacy' ? <Privacy /> : <Terms />}</article>
    </main>
  );
}

export function NotFound() {
  return (
    <main className="notfound">
      <Logo size={48} />
      <h1>This page does not exist</h1>
      <p className="muted">The link may be broken, or the chat was removed.</p>
      <Link to="/" className="btn">
        Go to your chats
      </Link>
    </main>
  );
}
