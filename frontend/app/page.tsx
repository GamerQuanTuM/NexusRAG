'use client';

import { useAuth } from '@/lib/AuthContext';
import RAGChat from '@/components/RAGChat';
import Sidebar from '@/components/Sidebar';
import DocumentUpload from '@/components/DocumentUpload';
import { Loader2, Database, X, Menu } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { user } = useAuth();
  const [showDocs, setShowDocs] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#212121]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-[#212121] text-gray-800 dark:text-gray-100 font-sans">
      {/* Sidebar - Desktop */}
      <div className="w-[260px] shrink-0 bg-gray-50 dark:bg-[#171717] h-full hidden md:block border-r border-gray-200 dark:border-gray-800">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] z-50 md:hidden"
            >
              <div className="h-full bg-gray-50 dark:bg-[#171717]">
                <Sidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full max-w-full">
        {/* Mobile Header */}
        <header className="flex h-14 items-center justify-between px-3 md:px-4 border-b border-gray-100 dark:border-gray-800 md:hidden bg-white dark:bg-[#212121] shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <span className="font-semibold text-base">NexusRAG</span>
          <button
            onClick={() => setShowDocs(!showDocs)}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {showDocs ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            ) : (
              <Database className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            )}
          </button>
        </header>

        <RAGChat />

        {/* Floating Upload Button - Desktop only */}
        <div className="absolute top-4 right-4 z-40 hidden md:block">
          <button 
            onClick={() => setShowDocs(!showDocs)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#2F2F2F] border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:bg-gray-50 dark:hover:bg-[#3C3C3C] text-sm font-medium transition-colors"
          >
            {showDocs ? (
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <Database className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
            <span className="hidden sm:inline">{showDocs ? "Close" : "Corpus"}</span>
          </button>
        </div>

        {/* Upload Overlay */}
        {showDocs && (
          <div className="absolute top-16 right-4 left-4 sm:left-auto md:left-auto md:w-96 md:max-w-[calc(100vw-2rem)] z-50 bg-white dark:bg-[#2F2F2F] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
             <div className="max-h-[70vh] sm:max-h-[80vh] overflow-y-auto">
               <DocumentUpload />
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
