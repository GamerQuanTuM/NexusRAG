'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, BookOpen, Layers, Pencil, Trash2, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  sources?: Array<{
    content: string;
    metadata: Record<string, any>;
    score?: number;
  }>;
};

type QueryResponse = {
  answer: string;
  sources: Array<{
    content: string;
    metadata: Record<string, any>;
    score?: number;
  }>;
  question: string;
  timestamp: string;
};

export default function RAGChat() {
  const { user, activeChatId, triggerRefresh } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (activeChatId) {
      const fetchHistory = async () => {
        try {
          setIsLoading(true);
          const res = await apiClient.getMessages(activeChatId);
          
          if (res.data && res.data.length > 0) {
            setMessages(res.data.map((m: any) => ({
              id: m.id,
              content: m.content,
              role: m.role,
              timestamp: new Date(m.created_at),
            })));
          } else {
            setMessages([]);
          }
        } catch (err) {
          console.error('Failed to load history', err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchHistory();
    } else {
      setMessages([]);
    }
  }, [activeChatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize edit textarea
  useEffect(() => {
    if (editTextareaRef.current) {
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = editTextareaRef.current.scrollHeight + 'px';
    }
  }, [editContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await apiClient.query({
        question: input,
        use_graph: true,
        chat_id: activeChatId,
        user_id: user?.id,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.data.answer,
        role: 'assistant',
        timestamp: new Date(response.data.timestamp),
        sources: response.data.sources,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Specifically triggers Sidebar to update, which catches the new LLM generated title
      if (messages.length === 0) {
        triggerRefresh();
      }
    } catch (error) {
      console.error('Error querying RAG system:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'An error occurred while generating a response. Please check your backend connection.',
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      setDeletingMessageId(messageId);
      const res = await apiClient.deleteMessage(messageId);
      const deletedIds: string[] = res.data.deleted_ids || [messageId];
      setMessages(prev => prev.filter(m => !deletedIds.includes(m.id)));
    } catch (error) {
      console.error('Failed to delete message:', error);
    } finally {
      setDeletingMessageId(null);
    }
  };

  const startEditing = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleEditMessage = async () => {
    if (!editingMessageId || !editContent.trim() || isLoading) return;

    const messageIndex = messages.findIndex(m => m.id === editingMessageId);
    if (messageIndex === -1) return;

    // Optimistically update UI: keep messages up to and including the editing one,
    // replace the content, and remove all subsequent messages
    const editedMessage: Message = {
      ...messages[messageIndex],
      content: editContent,
    };

    setMessages(prev => [...prev.slice(0, messageIndex), editedMessage]);
    setEditingMessageId(null);
    setEditContent('');
    setIsLoading(true);

    try {
      const response = await apiClient.editMessage(editingMessageId, editContent, true);

      // Re-fetch all messages to get server-generated IDs
      if (activeChatId) {
        const histRes = await apiClient.getMessages(activeChatId);
        if (histRes.data) {
          setMessages(histRes.data.map((m: any) => ({
            id: m.id,
            content: m.content,
            role: m.role,
            timestamp: new Date(m.created_at),
          })));
        }
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
      // Re-fetch to restore consistent state
      if (activeChatId) {
        const histRes = await apiClient.getMessages(activeChatId);
        if (histRes.data) {
          setMessages(histRes.data.map((m: any) => ({
            id: m.id,
            content: m.content,
            role: m.role,
            timestamp: new Date(m.created_at),
          })));
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#212121]">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 relative custom-scrollbar pb-32">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center flex-1 justify-center h-full text-center px-4 max-w-2xl mx-auto opacity-70">
            <div className="w-16 h-16 bg-gray-100 dark:bg-[#2F2F2F] rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-200 dark:border-gray-800">
               <Layers className="w-8 h-8 text-gray-500 dark:text-gray-300" />
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-800 dark:text-gray-100">How can I help you today?</h2>
            <p className="text-gray-500 dark:text-gray-400">Ask a question referencing your uploaded knowledge base. Nexus will automatically retrieve insights and construct an answer.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-8 space-y-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className="flex text-base group/msg"
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {/* Avatar */}
                <div className="shrink-0 mr-4">
                  {message.role === 'user' ? (
                     <div className="w-8 h-8 rounded-full bg-linear-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                       {user?.email?.[0].toUpperCase()}
                     </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center border border-gray-200 dark:border-gray-700">
                      <Bot className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 pt-0.5 ${message.role === 'user' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-800 dark:text-gray-300'}`}>
                  {/* Editing mode */}
                  {editingMessageId === message.id ? (
                    <div className="space-y-2">
                      <textarea
                        ref={editTextareaRef}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-[#2F2F2F] border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-[15px] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none min-h-[56px] transition-all"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleEditMessage();
                          }
                          if (e.key === 'Escape') {
                            cancelEditing();
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleEditMessage}
                          disabled={!editContent.trim() || isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-3 h-3" />
                          Submit
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-[#3C3C3C] hover:bg-gray-200 dark:hover:bg-[#4A4A4A] text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="prose dark:prose-invert max-w-none text-[15px] leading-relaxed wrap-break-word">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                            a: ({node, ...props}) => <a className="text-blue-500 hover:text-blue-400 underline" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-4" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-4" {...props} />,
                            pre: ({node, ...props}) => (
                              <div className="my-4 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 overflow-hidden">
                                <pre className="p-4 overflow-x-auto text-sm" {...props} />
                              </div>
                            ),
                            code: ({node, className, children, ...props}: any) => {
                              const isInline = !className?.includes('language-');
                              return isInline ? (
                                <code className="bg-gray-100 dark:bg-[#2F2F2F] px-1 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className={`text-sm font-mono ${className || ''}`} {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {message.content.replace(/<br\s*\/?>/gi, '\n')}
                        </ReactMarkdown>
                      </div>

                      {/* Action buttons — visible on hover for user messages */}
                      {message.role === 'user' && hoveredMessageId === message.id && !isLoading && (
                        <div className="flex items-center gap-1 mt-2 animate-in fade-in duration-150">
                          <button
                            onClick={() => startEditing(message)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                            title="Edit message"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            disabled={deletingMessageId === message.id}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50"
                            title="Delete message"
                          >
                            {deletingMessageId === message.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}

                      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                           <span className="flex items-center gap-1 font-medium text-gray-500 dark:text-gray-400 mt-1 mr-2">
                             <BookOpen className="w-3.5 h-3.5" /> Sources:
                           </span>
                           {message.sources.map((source, idx) => (
                               <div key={idx} className="bg-gray-100 dark:bg-[#2F2F2F] px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 flex items-center">
                                  <span className="truncate max-w-[150px]">{source.metadata.filename || 'Document'}</span>
                               </div>
                           ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
               <div className="flex text-base">
                 <div className="shrink-0 mr-4">
                    <div className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center">
                      <Bot className="w-5 h-5" />
                    </div>
                 </div>
                 <div className="flex items-center gap-2 pt-1.5">
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                 </div>
               </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Input Form at bottom */}
      <div className="absolute bottom-0 inset-x-0 w-full bg-linear-to-t from-white via-white to-transparent dark:from-[#212121] dark:via-[#212121] dark:to-transparent pt-6 pb-6 px-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.1)] rounded-2xl bg-gray-50 dark:bg-[#2F2F2F] border border-gray-200 dark:border-gray-700 focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-gray-600 transition-shadow">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Message Nexus..."
              className="w-full bg-transparent pl-4 pr-12 py-4 max-h-48 resize-none focus:outline-none text-gray-900 dark:text-gray-100 rounded-2xl custom-scrollbar m-0 min-h-[56px]"
              disabled={isLoading || !activeChatId}
              rows={1}
            />
            <button
               type="submit"
               disabled={isLoading || !input.trim() || !activeChatId}
               className="absolute right-3 bottom-3 p-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
               <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3 font-medium">
             Nexus can make mistakes. Consider verifying your sources.
          </div>
        </div>
      </div>
    </div>
  );
}