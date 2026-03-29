'use client';

import { useAuth } from '@/lib/AuthContext';
import RAGChat from '@/components/RAGChat';
import Sidebar from '@/components/Sidebar';
import DocumentUpload from '@/components/DocumentUpload';
import { Loader2, Database, X } from 'lucide-react';
import { useState } from 'react';

export default function Home() {
  const { user } = useAuth();
  const [showDocs, setShowDocs] = useState(false);

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

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-full max-w-full">
        <header className="flex h-14 items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800 md:hidden bg-white dark:bg-[#212121] shrink-0">
           <span className="font-semibold text-lg">NexusRAG</span>
        </header>

        <RAGChat />

        {/* Floating Upload Button */}
        <div className="absolute top-4 right-4 z-40">
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
          <div className="absolute top-16 right-4 w-96 max-w-[calc(100vw-2rem)] z-50 bg-white dark:bg-[#2F2F2F] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
             <div className="max-h-[80vh] overflow-y-auto">
               <DocumentUpload />
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
