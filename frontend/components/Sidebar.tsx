'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';
import { Plus, MessageSquare, Loader2, LogOut, Trash2, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Chat = {
  id: string;
  title: string;
  created_at: string;
};

export default function Sidebar() {
  const { user, activeChatId, setActiveChatId, logout, refreshTrigger, triggerRefresh } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState<string | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchChats();
  }, [user, refreshTrigger]);

  const fetchChats = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.getChats(user?.id || '');
      setChats(res.data);
      if (res.data.length > 0 && !activeChatId) {
        setActiveChatId(res.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch chats', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createChat = async () => {
    try {
      setIsCreating(true);
      const res = await apiClient.createChat(user?.id || '', 'New Discussion');
      setChats([res.data, ...chats]);
      setActiveChatId(res.data.id);
    } catch (error) {
      console.error('Failed to create chat', error);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      setDeletingChatId(chatId);
      await apiClient.deleteChat(chatId);
      const remaining = chats.filter(c => c.id !== chatId);
      setChats(remaining);
      if (activeChatId === chatId) {
        setActiveChatId(remaining.length > 0 ? remaining[0].id : null);
      }
      // ONLY close if successful
      setConfirmDeleteChatId(null);
    } catch (error) {
      console.error('Failed to delete chat', error);
    } finally {
      setDeletingChatId(null);
    }
  };

  const deleteAllChats = async () => {
    try {
      setIsDeletingAll(true);
      await apiClient.deleteAllChats(user?.id || '');
      setChats([]);
      setActiveChatId(null);
      // ONLY close if successful
      setShowDeleteAll(false);
    } catch (error) {
      console.error('Failed to delete all chats', error);
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-[#171717] relative">
      {/* Header */}
      <div className="p-3">
        <button
          onClick={createChat}
          disabled={isCreating}
          className="w-full flex items-center gap-3 p-3 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-[#212121] transition-colors text-gray-800 dark:text-gray-200"
        >
          {isCreating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <div className="bg-white dark:bg-[#212121] p-1 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
              <Plus className="w-4 h-4" />
            </div>
          )}
          New Chat
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mt-4 mb-2 px-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-500">Recent</span>
              {chats.length > 0 && (
                <button
                  onClick={() => setShowDeleteAll(true)}
                  className="text-[10px] text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors font-medium"
                  title="Delete all chats"
                >
                  Clear all
                </button>
              )}
            </div>
            {chats.map((chat) => (
              <div
                key={chat.id}
                className="relative group"
                onMouseEnter={() => setHoveredChatId(chat.id)}
                onMouseLeave={() => setHoveredChatId(null)}
              >
                <button
                  onClick={() => setActiveChatId(chat.id)}
                  className={`w-full text-left pl-3 pr-10 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${
                    activeChatId === chat.id
                      ? 'bg-gray-200 dark:bg-[#2F2F2F] text-gray-900 dark:text-gray-100 font-medium'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-[#212121]'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0 text-gray-400" />
                  <span className="truncate text-sm flex-1">{chat.title}</span>
                </button>

                {/* Confirm Delete trigger - appears on hover */}
                {hoveredChatId === chat.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteChatId(chat.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {chats.length === 0 && (
              <div className="text-gray-400 text-sm px-3 mt-2">No conversations yet</div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {(confirmDeleteChatId || showDeleteAll) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-[6px] p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#121214] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] rounded-3xl p-8 w-full max-w-md relative overflow-hidden"
            >
              {/* Decorative background element */}
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col items-center text-center space-y-6 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold bg-linear-to-b from-white to-gray-400 bg-clip-text text-transparent">
                    {showDeleteAll ? 'Purge All Records?' : 'Delete Conversation?'}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed px-4">
                    {showDeleteAll 
                      ? 'This is a destructive action that will permanently erase all chat logs, ingested documents, and neural state across your entire profile.'
                      : 'This conversation and all associated neural indexes will be permanently removed. This action cannot be reversed.'
                    }
                  </p>
                </div>

                <div className="flex flex-col w-full gap-3 pt-4">
                  <button
                    onClick={() => {
                      if (showDeleteAll) deleteAllChats();
                      else if (confirmDeleteChatId) deleteChat(confirmDeleteChatId);
                    }}
                    disabled={isDeletingAll || deletingChatId !== null}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
                  >
                    {(isDeletingAll || deletingChatId !== null) ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>{showDeleteAll ? 'Yes, Purge Everything' : 'Confirm Delete'}</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowDeleteAll(false);
                      setConfirmDeleteChatId(null);
                    }}
                    disabled={isDeletingAll || deletingChatId !== null}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-2xl font-bold text-sm transition-all border border-white/5 disabled:opacity-30 cursor-pointer"
                  >
                    Keep My Data
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="p-3 mt-auto">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-[#212121] transition-colors text-gray-700 dark:text-gray-300 group"
        >
          <div className="w-8 h-8 rounded-full bg-linear-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold shrink-0">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div className="flex-1 truncate text-sm font-medium">{user?.email}</div>
          <LogOut className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
        </button>
      </div>
    </div>
  );
}
