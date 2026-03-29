# RAG System with FastAPI, LangChain, LangGraph, Supabase, and Next.js

A high-performance, production-ready Retrieval-Augmented Generation (RAG) system built with modern technologies for document processing, session-based chat, and intelligent question answering.

## 🚀 Features

### 🔐 Authentication & Session Management
- **User Authentication**: Secure sign-up and login powered by Supabase Auth.
- **Session-Based Chats**: Create and manage multiple independent chat sessions.
- **Persistent Chat History**: All conversations are stored and can be resumed at any time.
- **Smart Titles**: Automatic generation of chat titles based on the first interaction.

### 🧠 Advanced RAG Capabilities
- **Document-to-Chat Scoping**: Upload documents specific to a chat session for isolated context.
- **Dynamic Retrieval**: Intelligent context gathering filtered by session or user.
- **Conversational Memory**: The assistant remembers previous messages within a session for follow-up questions.
- **Source Citation**: Precise source attribution with relevance scores and document previews.
- **Multi-Format Support**: Process PDF, DOCX, TXT, CSV, MD, PPTX, XLSX files.

### 🛠️ Backend (FastAPI + Python)
- **High-Performance API**: RESTful endpoints for all operations.
- **LangChain & LangGraph**: Stateful, multi-step LLM workflows for sophisticated reasoning.
- **Text Splitting**: Recursive character splitting for optimal chunking.
- **Vector Storage**: Supabase PostgreSQL with `pgvector` for efficient similarity search.
- **LLM Integration**: Support for OpenAI GPT and Google Gemini models.

### 💻 Frontend (Next.js + TypeScript)
- **Modern UI/UX**: Premium, responsive dashboard with Tailwind CSS.
- **Interactive Chat**: Real-time Q&A with full Markdown rendering.
- **Document Management**: Drag-and-drop uploads and document status tracking.
- **Real-time Monitoring**: System health checks for database and LLM connections.

## 📁 Project Structure

```
RAG/
├── backend/                    # FastAPI backend
│   ├── main.py                # FastAPI application and routes
│   ├── rag_pipeline.py        # RAG pipeline with LangChain/LangGraph
│   ├── vector_store.py        # Supabase vector store management
│   ├── document_loaders.py    # Document loading and processing logic
│   ├── config.py              # Configuration and environment settings
│   ├── supabase_client.py     # Supabase client initialization
│   ├── pyproject.toml         # Python dependencies (uv)
│   └── .env.example           # Environment variables template
│
├── frontend/                  # Next.js frontend
│   ├── app/                   # Next.js App Router (Pages & Layouts)
│   ├── components/            # Reusable React components
│   ├── lib/                   # Utility functions and API client
│   ├── public/                # Static assets
│   ├── package.json           # Node.js dependencies
│   └── tsconfig.json          # TypeScript configuration
│
└── README.md                  # Main project documentation
```

## 🛠️ Setup Instructions

### Prerequisites
- Python 3.11+ (using `uv` is recommended)
- Node.js 18+
- Supabase account
- OpenAI or Gemini API key

### 1. Supabase Database Setup

1. Create a new Supabase project.
2. Enable the `vector` extension:
   ```sql
   -- 1. Enable pgvector
   create extension if not exists vector;
   ```
3. Create the required tables and functions:
   ```sql
   -- 2. Create the robust documents table
   create table documents (
     id uuid primary key default gen_random_uuid(),
     content text not null,
     metadata jsonb,
     embedding vector(3072) -- Specifically typed to Gemini's dimensions (use 1536 for OpenAI)
   );

   -- 3. Create the LangChain similarity search function
   create or replace function match_documents (
     query_embedding vector(3072),
     match_count int DEFAULT null,
     filter jsonb DEFAULT '{}'
   ) returns table (
     id uuid,
     content text,
     metadata jsonb,
     similarity float
   )
   language plpgsql
   as $$
   #variable_conflict use_column
   begin
     return query
     select
       id,
       content,
       metadata,
       1 - (documents.embedding <=> query_embedding) as similarity
     from documents
     where metadata @> filter
     order by documents.embedding <=> query_embedding
     limit match_count;
   end;
   $$;

   -- 4. Create a public users table (syncs automatically with auth.users)
   create table public.users (
     id uuid references auth.users(id) on delete cascade primary key,
     email text not null,
     created_at timestamp with time zone default timezone('utc'::text, now()) not null
   );

   -- Trigger to automatically create a profile in public.users when a new user signs up
   create or replace function public.handle_new_user()
   returns trigger as $$
   begin
     insert into public.users (id, email)
     values (new.id, new.email);
     return new;
   end;
   $$ language plpgsql security definer;

   create trigger on_auth_user_created
     after insert on auth.users
     for each row execute procedure public.handle_new_user();

   -- 5. Create chats table
   create table chats (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references auth.users(id) on delete cascade not null,
     title text not null default 'New Chat',
     created_at timestamp with time zone default timezone('utc'::text, now()) not null,
     updated_at timestamp with time zone default timezone('utc'::text, now()) not null
   );

   -- 6. Create messages table to store conversation history
   create table messages (
     id uuid primary key default gen_random_uuid(),
     chat_id uuid references chats(id) on delete cascade not null,
     role text not null check (role in ('user', 'assistant', 'system')),
     content text not null,
     created_at timestamp with time zone default timezone('utc'::text, now()) not null
   );
   ```


### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in your SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY
uv sync
uv run python main.py
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuration (.env)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (for admin tasks) |
| `OPENAI_API_KEY` | Your OpenAI API Key |
| `EMBEDDING_MODEL` | Embedding model (default: `text-embedding-3-small`) |
| `LLM_MODEL` | LLM model (default: `gpt-4o-mini`) |
| `CHUNK_SIZE` | Size of document chunks for vectorization (default: `1000`) |

## 📚 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and get session |
| `GET` | `/chats` | Get all chat sessions for a user |
| `POST` | `/chats` | Create a new chat session |
| `POST` | `/query` | Ask a question within a chat session |
| `POST` | `/upload` | Upload a document (optionally linked to a chat) |
| `GET` | `/health` | Check system and connection health |

## 🔍 How It Works

1. **Ingestion**: Documents are uploaded, parsed into clean text, and split into overlapping chunks to preserve local context.
2. **Embedding**: Each chunk is transformed into a high-dimensional vector using OpenAI's `text-embedding-3-small`.
3. **Storage**: Vectors and original text are stored in Supabase with metadata including `user_id` and `chat_id`.
4. **Retrieval**: When a user asks a question, the query is embedded and compared against stored chunks using cosine similarity, filtered by the current `chat_id`.
5. **Generation**: The retrieved context, combined with the recent chat history, is sent to the LLM (GPT-4o) with a strict "answer-only-from-context" system prompt.

## 📈 Future Enhancements

- [ ] Hybrid search (combining vector search with keyword-based BM25)
- [ ] Multi-modal support (scanning images and charts within PDF/PPTX)
- [ ] Exportable chat transcripts (PDF/Markdown)
- [ ] Collaborative workspaces for shared document analysis

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- **LangChain** for the powerful orchestration framework.
- **Supabase** for providing a robust vector database and authentication layer.
- **FastAPI** & **Next.js** for the modern full-stack foundation.