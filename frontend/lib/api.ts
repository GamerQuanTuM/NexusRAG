import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export type QueryResponse = {
  answer: string;
  sources: Array<{
    content: string;
    metadata: Record<string, any>;
    score?: number;
  }>;
  question: string;
  timestamp: string;
};

export type UploadMultipleResponse = {
  results: Array<{
    filename: string;
    success: boolean;
    message: string;
    chunks: number;
  }>;
  total_files: number;
  successful_uploads: number;
};

export const apiClient = {
  // Auth
  register: (email: string, password: string) => 
    api.post('/auth/register', { email, password }),
    
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),

  // Chats
  getChats: (userId: string) => 
    api.get('/chats', { params: { user_id: userId } }),

  createChat: (userId: string, title?: string) => 
    api.post('/chats', { user_id: userId, title }),

  getMessages: (chatId: string) => 
    api.get(`/chats/${chatId}/messages`),

  getChatDocuments: (chatId: string) => 
    api.get(`/chats/${chatId}/documents`),

  // Query
  query: (data: { question: string, use_graph: boolean, chat_id?: string | null, user_id?: string | null }) => 
    api.post<QueryResponse>('/query', data),

  // Upload
  uploadMultiple: (formData: FormData) => 
    api.post<UploadMultipleResponse>('/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

export { api };
export default apiClient;