'use client';

import { useState, useEffect } from 'react';
import { Server, Database, Cpu, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';

type HealthStatus = {
  status: string;
  timestamp: string;
  supabase_connected: boolean;
  openai_configured: boolean;
  document_count: number;
};

type SystemMetrics = {
  backend: 'healthy' | 'unhealthy' | 'checking';
  supabase: 'connected' | 'disconnected' | 'checking';
  openai: 'configured' | 'not-configured' | 'checking';
  documents: number;
  lastChecked: string;
};

export default function SystemStatus() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    backend: 'checking',
    supabase: 'checking',
    openai: 'checking',
    documents: 0,
    lastChecked: 'Never',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get<HealthStatus>('http://localhost:8000/health');
      const health = response.data;

      setMetrics({
        backend: 'healthy',
        supabase: health.supabase_connected ? 'connected' : 'disconnected',
        openai: health.openai_configured ? 'configured' : 'not-configured',
        documents: health.document_count,
        lastChecked: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error('Health check failed:', err);
      setError('Failed to connect to backend server');
      setMetrics(prev => ({
        ...prev,
        backend: 'unhealthy',
        lastChecked: new Date().toLocaleTimeString(),
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthStatus();
    const interval = setInterval(fetchHealthStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'configured':
        return <CheckCircle className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />;
      case 'unhealthy':
      case 'disconnected':
      case 'not-configured':
        return <XCircle className="w-5 h-5 text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]" />;
      default:
        return <AlertCircle className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />;
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'configured':
        return 'border-emerald-500/20 bg-emerald-500/5';
      case 'unhealthy':
      case 'disconnected':
      case 'not-configured':
        return 'border-rose-500/20 bg-rose-500/5';
      default:
        return 'border-amber-500/20 bg-amber-500/5';
    }
  };

  const StatusItem = ({ icon: Icon, title, subtitle, status, iconBg, delay }: any) => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className={`flex items-center justify-between p-4 rounded-xl border backdrop-blur-sm transition-all duration-300 ${getStatusBorder(status)}`}
    >
      <div className="flex items-center space-x-4">
        <div className={`p-2.5 rounded-xl ${iconBg} shadow-inner`}>
          <Icon className="w-5 h-5 text-slate-100" />
        </div>
        <div>
          <p className="font-semibold text-slate-200">{title}</p>
          <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {getStatusIcon(status)}
      </div>
    </motion.div>
  );

  return (
    <div className="bg-slate-900/50 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-700/50 p-6 sm:p-8 overflow-hidden relative group">
      <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-slate-100 to-slate-400">System Status</h3>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">
            Real-time telemetry and diagnostics
          </p>
        </div>
        <button
          onClick={fetchHealthStatus}
          disabled={isLoading}
          className="p-3 bg-slate-800 hover:bg-slate-700 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:-translate-y-0.5 rounded-xl border border-slate-700 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <RefreshCw className={`w-5 h-5 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3 mb-8 relative z-10">
        <StatusItem 
          icon={Cpu} 
          title="FastAPI Core" 
          subtitle="Python Engine" 
          status={metrics.backend} 
          iconBg="bg-blue-500/20 ring-1 ring-blue-500/30"
          delay={0.1}
        />
        <StatusItem 
          icon={Database} 
          title="Supabase Vector" 
          subtitle="pgvector & storage" 
          status={metrics.supabase} 
          iconBg="bg-purple-500/20 ring-1 ring-purple-500/30"
          delay={0.2}
        />
        <StatusItem 
          icon={Server} 
          title="OpenAI Neural" 
          subtitle="LLM & embeddings" 
          status={metrics.openai} 
          iconBg="bg-emerald-500/20 ring-1 ring-emerald-500/30"
          delay={0.3}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-between p-5 bg-linear-to-r from-indigo-500/10 to-blue-500/10 rounded-2xl border border-indigo-500/20 relative z-10"
      >
        <div>
          <p className="font-semibold text-slate-200">Vector Corpus</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-cyan-400 drop-shadow-sm">{metrics.documents}</p>
            <span className="text-sm font-medium text-slate-400">chunks loaded</span>
          </div>
        </div>
      </motion.div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl relative z-10"
        >
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <p className="text-sm text-rose-300 font-medium">{error}</p>
          </div>
        </motion.div>
      )}

      <div className="mt-6 flex justify-between items-center text-xs font-medium text-slate-500 border-t border-slate-800/60 pt-5 relative z-10">
        <span>Last synchronization</span>
        <span className="text-slate-400">{metrics.lastChecked}</span>
      </div>
    </div>
  );
}