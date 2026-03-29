'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, X, Check, AlertCircle, FileUp } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

type UploadResult = {
  filename: string;
  success: boolean;
  message: string;
  chunks: number;
};

export default function DocumentUpload() {
  const { user, activeChatId, setActiveChatId } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [sessionFiles, setSessionFiles] = useState<{name: string, success: boolean}[]>([]);

  useEffect(() => {
    setUploadResults([]);
    if (activeChatId) {
      // Fetch documents currently attached to this activity
      apiClient.getChatDocuments(activeChatId)
        .then(res => {
          if (res.data) {
            setSessionFiles(res.data.map((filename: string) => ({
              name: filename,
              success: true
            })));
          }
        })
        .catch(err => {
          console.error("Failed to load session documents", err);
          setSessionFiles([]);
        });
    } else {
      setSessionFiles([]);
    }
  }, [activeChatId]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file =>
      file.type.includes('pdf') ||
      file.type.includes('text') ||
      file.type.includes('msword') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('presentation') ||
      file.name.match(/\.(pdf|txt|md|csv|docx?|xlsx?|pptx?)$/i)
    );

    setFiles(prev => [...prev, ...validFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file =>
      file.type.includes('pdf') ||
      file.type.includes('text') ||
      file.type.includes('msword') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('presentation') ||
      file.name.match(/\.(pdf|txt|md|csv|docx?|xlsx?|pptx?)$/i)
    );

    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploadStatus('uploading');
    setUploadResults([]);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    let targetChatId = activeChatId;

    try {
      // Auto-create a chat session if none exists
      if (!targetChatId && user?.id) {
        const chatRes = await apiClient.createChat(user.id, 'Document Corpus');
        targetChatId = chatRes.data.id;
        setActiveChatId(targetChatId);
      }

      if (targetChatId) formData.append('chat_id', targetChatId);
      if (user?.id) formData.append('user_id', user.id);

      const response = await apiClient.uploadMultiple(formData);

      setUploadResults(response.data.results);

      if (response.data.successful_uploads > 0) {
        setUploadStatus('success');
        setFiles([]);
        
        // Refresh the document list from the Database!
        if (targetChatId) {
          apiClient.getChatDocuments(targetChatId as string)
            .then(res => {
               if (res.data) setSessionFiles(res.data.map((filename: string) => ({ name: filename, success: true })));
            });
        }
      } else {
        setUploadStatus('error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setUploadResults([{
        filename: 'All files',
        success: false,
        message: 'Failed to upload files. Please check if the backend is running.',
        chunks: 0
      }]);
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.pdf$/i)) return '📄';
    if (fileName.match(/\.(docx?)$/i)) return '📝';
    if (fileName.match(/\.(xlsx?)$/i)) return '📊';
    if (fileName.match(/\.(pptx?)$/i)) return '📽️';
    if (fileName.match(/\.(txt|md)$/i)) return '📃';
    if (fileName.match(/\.csv$/i)) return '📈';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-4 sm:p-5 text-gray-900 dark:text-gray-100 bg-white dark:bg-[#2F2F2F]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Corpus Injection</h3>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Attach references to this session
          </p>
        </div>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center mb-5 transition-colors ${dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <FileUp className={`w-8 h-8 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
          <div>
            <p className="font-medium text-sm text-gray-800 dark:text-gray-200">
              Drag & drop files
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              or click to browse
            </p>
          </div>
          <input
            type="file"
            id="file-upload"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          />
          <label
            htmlFor="file-upload"
            className="px-4 py-2 bg-gray-100 dark:bg-[#3C3C3C] text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-[#4A4A4A] cursor-pointer transition-colors border border-gray-200 dark:border-gray-700 mt-2 inline-block"
          >
            Browse
          </label>
        </div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Staged Files</h4>
              <span className="text-xs text-gray-500">{files.length} selected</span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-[#3C3C3C] rounded-lg border border-gray-100 dark:border-gray-700 group hover:border-gray-200 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="text-lg shrink-0">{getFileIcon(file.name)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate text-xs">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 rounded transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={uploadFiles}
        disabled={files.length === 0 || uploadStatus === 'uploading'}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center space-x-2 ${files.length === 0 || uploadStatus === 'uploading'
            ? 'bg-gray-100 dark:bg-[#3C3C3C] text-gray-400 cursor-not-allowed'
            : 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 shadow-sm'
          }`}
      >
        {uploadStatus === 'uploading' ? (
          <>
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <Upload className={`w-4 h-4 ${files.length > 0 ? 'text-white dark:text-black' : 'text-gray-400'}`} />
            <span>Ingest {files.length} Document{files.length !== 1 ? 's' : ''}</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {uploadResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 text-xs">Ingestion Log</h4>
            <div className="space-y-2">
              {uploadResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-2.5 rounded-lg border text-sm ${result.success
                      ? 'bg-green-50/50 border-green-200 dark:bg-green-500/10 dark:border-green-500/20'
                      : 'bg-red-50/50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'
                    }`}
                >
                  <div className="flex items-start">
                    {result.success ? (
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="ml-2 grow">
                      <p className="font-medium text-gray-800 dark:text-gray-200 text-xs">
                        {result.filename.substring(0, 40)}{result.filename.length > 40 ? '...' : ''}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${result.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{result.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sessionFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700"
          >
            <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 text-xs">Attached to Activity</h4>
            <div className="flex flex-wrap gap-2">
              {sessionFiles.map((file, idx) => (
                 <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-default ${file.success ? 'bg-gray-50 dark:bg-[#3C3C3C] border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400'}`}>
                    <span>{getFileIcon(file.name)}</span>
                    <span className="truncate max-w-[120px]">{file.name}</span>
                 </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}