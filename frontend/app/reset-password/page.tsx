'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';
import { Loader2, Sparkles, Lock, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Supabase returns token in hash: #access_token=...&type=recovery
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        setToken(accessToken);
      }
    } else {
        // Alternative: check query params
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token');
        if (t) setToken(t);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!token) {
      setError('Invalid or expired reset token. Please request a new link.');
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.resetPassword(password, token);
      setSuccess(true);
      setTimeout(() => {
        router.push('/auth');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glowing orbs */}
      <div className="absolute -top-40 -left-40 w-120 h-120 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-120 h-120 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center"
      >
        <div className="inline-flex items-center justify-center p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 mb-6 shadow-2xl relative">
          <Sparkles className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-4xl font-bold tracking-tight text-white mb-2">
          Reset <span className="text-blue-500">Password</span>
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl sm:rounded-3xl overflow-hidden p-8 px-6 sm:px-10">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/30">
                  <CheckCircle2 className="w-8 h-8 text-green-500 animate-in zoom-in duration-300" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white">Password Reset Successful</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your credentials have been updated. You will be redirected to the login page momentarily.
              </p>
              <div className="pt-4">
                 <button onClick={() => router.push('/auth')} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-full font-bold transition-all border border-white/5">
                    Return to Login
                 </button>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs py-3 px-4 rounded-xl text-center font-medium">
                  {error}
                </div>
              )}

              {!token && (
                 <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[11px] py-3 px-4 rounded-xl text-center font-medium">
                    No valid reset token found. Please click the link in your email.
                 </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">New Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Confirm New Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !token}
                  className="w-full relative group overflow-hidden rounded-full shadow-lg shadow-blue-500/20"
                >
                  <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-indigo-600 transition-all duration-300 group-hover:scale-105" />
                  <div className="relative flex justify-center items-center py-3.5 px-4 text-sm font-bold text-white transition-all">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Update Passcode'
                    )}
                  </div>
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
