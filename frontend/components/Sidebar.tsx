'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import apiClient from '@/lib/api';
import { Plus, MessageSquare, Loader2, LogOut } from 'lucide-react';

type Chat = {
  id: string;
  title: string;
  created_at: string;
};

export default function Sidebar() {
  const { user, activeChatId, setActiveChatId, logout, refreshTrigger } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-[#171717]">
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
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-500 mt-4 mb-2 px-3">Recent</div>
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${
                  activeChatId === chat.id
                    ? 'bg-gray-200 dark:bg-[#2F2F2F] text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-[#212121]'
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0 text-gray-400" />
                <span className="truncate text-sm">{chat.title}</span>
              </button>
            ))}
            {chats.length === 0 && (
              <div className="text-gray-400 text-sm px-3 mt-2">No conversations yet</div>
            )}
          </>
        )}
      </div>

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
