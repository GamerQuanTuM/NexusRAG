'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';
import { Loader2, Sparkles, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = isLogin 
        ? await apiClient.login(email, password)
        : await apiClient.register(email, password);
      
      if (response.data.user) {
        login({ id: response.data.user.id, email: response.data.user.email });
      } else {
        setError('Authentication failed.');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An unexpected error occurred.');
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
        className="sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="flex justify-center mb-6">
           <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 relative shadow-inner">
             <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full" />
             <Sparkles className="w-8 h-8 text-blue-400 relative z-10" />
           </div>
        </div>
        <h2 className="text-center text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-indigo-400">
          NexusRAG
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400 font-medium tracking-wide">
          {isLogin ? 'Authenticate to access neural engine' : 'Register for access privileges'}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="bg-slate-900/50 backdrop-blur-xl py-8 px-4 shadow-2xl border border-slate-800 sm:rounded-3xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300">Email address</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 px-3 py-3 border border-slate-700 bg-slate-800/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                  placeholder="operator@nexus.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">Passcode</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 px-3 py-3 border border-slate-700 bg-slate-800/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  isLogin ? 'Establish Connection' : 'Initialize Account'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900 text-slate-400">
                  {isLogin ? 'New Operator?' : 'Existing Operator?'}
                </span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                {isLogin ? 'Register a new sequence' : 'Authenticate to existing sequence'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
