'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-b p-8">
      <h2 className="text-xl font-semibold text-t-primary mb-6">Create Account</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-t-primary mb-1.5">
            Name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={100}
            className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm text-t-primary placeholder:text-t-tertiary outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20 transition-all"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-t-primary mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm text-t-primary placeholder:text-t-tertiary outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20 transition-all"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-t-primary mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm text-t-primary placeholder:text-t-tertiary outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20 transition-all"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-t-primary mb-1.5">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
            minLength={8}
            className="w-full rounded-lg border border-input-border bg-input-bg px-3 py-2.5 text-sm text-t-primary placeholder:text-t-tertiary outline-none focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20 transition-all"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#FF7F11] hover:bg-[#e6700f] text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-sm text-t-secondary mt-6 text-center">
        Already have an account?{' '}
        <a href="/login" className="text-[#FF7F11] font-medium hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
