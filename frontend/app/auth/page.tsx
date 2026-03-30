'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import { Loader2, Sparkles, Mail, Lock, ArrowLeft } from 'lucide-react';

type AuthState = 'login' | 'signup' | 'forgot';

export default function LoginPage() {
  const [authState, setAuthState] = useState<AuthState>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // Handle recovery link redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      router.push(`/reset-password${hash}`);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (authState === 'login') {
        const response = await apiClient.login(email, password);
        if (response.data.user) {
          login({ id: response.data.user.id, email: response.data.user.email });
        } else {
          setError('Authentication failed.');
        }
      } else if (authState === 'signup') {
        const response = await apiClient.register(email, password);
        if (response.data.user) {
          login({ id: response.data.user.id, email: response.data.user.email });
        } else {
          setError('Account creation failed.');
        }
      } else if (authState === 'forgot') {
        await apiClient.forgotPassword(email);
        setSuccess('Password reset link has been dispatched to your mailbox.');
        setAuthState('login');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-blue-500/30">
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
          Nexus<span className="text-blue-500">RAG</span>
        </h2>
        <p className="text-slate-400 text-sm font-medium">
          The next generation of document intelligence.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl sm:rounded-3xl overflow-hidden mx-3 lg:mx-0 rounded-xl">
          {/* Tab Selector - Hide in Forgot mode */}
          <div className={`flex p-1.5 bg-black/40 border-b border-white/5 transition-all duration-300 ${authState === 'forgot' ? 'h-0 opacity-0 overflow-hidden py-0' : 'h-auto opacity-100'}`}>
            <button
              onClick={() => { setAuthState('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${authState === 'login' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Log In
            </button>
            <button
              onClick={() => { setAuthState('signup'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${authState === 'signup' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Sign Up
            </button>
          </div>

          <div className="py-8 px-6 sm:px-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={authState}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                {authState === 'forgot' && (
                   <button 
                     onClick={() => setAuthState('login')}
                     className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-6 group/back"
                   >
                      <ArrowLeft className="w-4 h-4 transition-transform group-hover/back:-translate-x-1" />
                      Back to Login
                   </button>
                )}

                <form className="space-y-5" onSubmit={handleSubmit}>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs py-3 px-4 rounded-xl text-center font-medium"
                    >
                      {error}
                    </motion.div>
                  )}

                  {success && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-500/10 border border-green-500/30 text-green-500 text-xs py-3 px-4 rounded-xl text-center font-medium"
                    >
                      {success}
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm transition-all"
                        placeholder="name@company.com"
                      />
                    </div>
                  </div>

                  {authState !== 'forgot' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5 ml-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                        {authState === 'login' && (
                          <button 
                            type="button" 
                            onClick={() => setAuthState('forgot')}
                            className="text-[11px] font-medium text-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
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
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full relative group overflow-hidden rounded-full shadow-lg shadow-blue-500/20"
                    >
                      <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-indigo-600 transition-all duration-300 group-hover:scale-105" />
                      <div className="relative flex justify-center items-center py-3.5 px-4 text-sm font-bold text-white transition-all">
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          authState === 'login' ? 'Log In to Nexus' : 
                          authState === 'signup' ? 'Create My Account' :
                          'Dispatch Reset Link'
                        )}
                      </div>
                    </button>
                  </div>
                </form>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 text-center border-t border-white/5 pt-6">
              <p className="text-xs text-slate-500">
                {authState === 'login' ? "Don't have an account yet?" : 
                 authState === 'signup' ? "Already have an account?" : 
                 "Remember your password?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthState(authState === 'login' ? 'signup' : 'login');
                    setError('');
                    setSuccess('');
                  }}
                  className="font-bold text-slate-300 hover:text-white transition-all underline decoration-slate-700 hover:decoration-blue-500 underline-offset-4"
                >
                  {authState === 'login' ? 'Create one now' : 'Log in here'}
                </button>
              </p>
            </div>
          </div>
        </div>
        
        {/* <p className="mt-8 text-center text-[10px] text-slate-600 uppercase tracking-widest font-bold">
          Protected by AES-256 Neural Encryption
        </p> */}
      </motion.div>
    </div>
  );
}
