import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      login(username, password);
    } catch (err) {
      setError(err.message);
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
            <label className="text-xs font-medium text-gray-600 mb-1 block">Username</label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin or operator"
              required
              autoFocus
              autoCapitalize="none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          KVKF Varanasi Kitchen Payroll System
        </p>
      </div>
    </div>
  );
}
