import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // onAuthStateChanged in useAuth will handle redirect automatically
    } catch (err) {
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError('Sign-in failed. Check your connection and try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 to-red-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🕉️</div>
          <h1 className="text-xl font-bold text-orange-900">Kasi Kitchen Payroll</h1>
          <p className="text-xs text-gray-500 mt-1">Kasi Visvanathar Koviloor Foundation · Varanasi</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              autoComplete="email"
              autoCapitalize="none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg border border-red-200">
              ⚠ {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Contact administrator to reset your password
        </p>
      </div>
    </div>
  );
}
