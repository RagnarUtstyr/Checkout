import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || '/';

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (err) {
      setError(err.message || 'Unable to authenticate.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setSubmitting(true);
    setError('');

    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fullscreen-center login-screen">
      <div className="card auth-card">
        <p className="eyebrow">Rental equipment tracker</p>
        <h1>Sign in to manage bookings and checkouts</h1>
        <p className="muted">
          Use Google or email/password authentication through Firebase.
        </p>

        <button className="primary-button full-width" onClick={handleGoogleLogin} disabled={submitting}>
          Continue with Google
        </button>

        <div className="divider">or</div>

        <form className="stack-md" onSubmit={handleEmailSubmit}>
          <div>
            <label>Email</label>
            <input
              className="text-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label>Password</label>
            <input
              className="text-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error ? <div className="error-box">{error}</div> : null}

          <button className="primary-button full-width" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <button
          className="ghost-button center-button"
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  );
}
