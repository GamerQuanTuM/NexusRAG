from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import uvicorn
from datetime import datetime

from config import settings
from rag_pipeline import RAGPipeline
from vector_store import VectorStoreManager
from document_loaders import DocumentLoader
from supabase_client import SupabaseClient

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.debug else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="RAG API",
    description="Retrieval-Augmented Generation API with LangChain, LangGraph, and Supabase",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
rag_pipeline = None
vector_store = None

async def get_rag_pipeline():
    """Dependency to get RAG pipeline instance"""
    global rag_pipeline
    if rag_pipeline is None:
        rag_pipeline = RAGPipeline()
    return rag_pipeline

async def get_vector_store():
    """Dependency to get vector store instance"""
    global vector_store
    if vector_store is None:
        vector_store = VectorStoreManager()
    return vector_store

# Pydantic models
class QueryRequest(BaseModel):
    question: str
    use_graph: bool = False
    chat_id: Optional[str] = None
    user_id: Optional[str] = None

class ChatRequest(BaseModel):
    user_id: str
    title: str = "New Chat"

class AuthRequest(BaseModel):
    email: str
    password: str

class QueryResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]
    question: str
    timestamp: str

class DocumentUploadResponse(BaseModel):
    success: bool
    message: str
    document_ids: Optional[List[str]] = None
    total_chunks: Optional[int] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    supabase_connected: bool
    openai_configured: bool
    document_count: int

# Routes
@app.get("/")
async def root():
    return {"message": "RAG API is running", "version": "1.0.0"}

@app.get("/health", response_model=HealthResponse)
async def health_check(
    vector_store: VectorStoreManager = Depends(get_vector_store)
):
    """Health check endpoint"""
    try:
        # Test Supabase connection
        supabase_connected = await SupabaseClient.test_connection()
        
        # Check OpenAI configuration
        openai_configured = bool(settings.openai_api_key and settings.openai_api_key != "your-openai-api-key")
        
        # Get document count
        document_count = vector_store.get_document_count()
        
        return HealthResponse(
            status="healthy",
            timestamp=datetime.utcnow().isoformat(),
            supabase_connected=supabase_connected,
            openai_configured=openai_configured,
            document_count=document_count
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chats/{chat_id}/documents")
async def get_chat_documents(chat_id: str):
    """Get unique document filenames associated with a chat session"""
    try:
        client = SupabaseClient.get_client()
        # Note: metadata is JSONB. We filter on the extracted chat_id key.
        res = client.table("documents").select("metadata").filter("metadata->>chat_id", "eq", chat_id).execute()
        
        filenames = set()
        for row in res.data:
            metadata = row.get("metadata", {})
            if "filename" in metadata:
                filenames.add(metadata["filename"])
                
        return list(filenames)
    except Exception as e:
        logger.error(f"Error fetching chat documents: {e}")
        return []

@app.post("/query", response_model=QueryResponse)
async def query(
    request: QueryRequest,
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline)
):
    """Query the RAG system"""
    try:
        logger.info(f"Processing query: {request.question}")
        
        result = rag_pipeline.query(
            question=request.question,
            use_graph=request.use_graph,
            chat_id=request.chat_id,
            user_id=request.user_id
        )
        
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"],
            question=result["question"],
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    chat_id: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline)
):
    """Upload and process a document"""
    try:
        # Read file content
        content = await file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="Empty file")
        
        metadata = {
            "filename": file.filename,
            "content_type": file.content_type,
            "uploaded_at": datetime.utcnow().isoformat()
        }
        if chat_id:
            metadata["chat_id"] = chat_id
        if user_id:
            metadata["user_id"] = user_id
            
        # Load document from bytes
        documents = DocumentLoader.load_from_bytes(
            file_bytes=content,
            filename=file.filename,
            metadata=metadata
        )
        
        # Add to vector store through RAG pipeline
        result = rag_pipeline.add_documents([
            {
                "content": doc.page_content,
                "metadata": doc.metadata
            }
            for doc in documents
        ])
        
        return DocumentUploadResponse(**result)
        
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-multiple")
async def upload_multiple_documents(
    files: List[UploadFile] = File(...),
    chat_id: Optional[str] = Form(None),
    user_id: Optional[str] = Form(None),
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline)
):
    """Upload multiple documents"""
    try:
        results = []
        
        for file in files:
            try:
                content = await file.read()
                
                metadata = {
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "uploaded_at": datetime.utcnow().isoformat()
                }
                if chat_id:
                    metadata["chat_id"] = chat_id
                if user_id:
                    metadata["user_id"] = user_id
                
                documents = DocumentLoader.load_from_bytes(
                    file_bytes=content,
                    filename=file.filename,
                    metadata=metadata
                )
                
                result = rag_pipeline.add_documents([
                    {
                        "content": doc.page_content,
                        "metadata": doc.metadata
                    }
                    for doc in documents
                ])
                
                results.append({
                    "filename": file.filename,
                    "success": result["success"],
                    "message": result["message"],
                    "chunks": result.get("total_chunks", 0)
                })
                
            except Exception as e:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": str(e),
                    "chunks": 0
                })
        
        return {
            "results": results,
            "total_files": len(files),
            "successful_uploads": sum(1 for r in results if r["success"])
        }
        
    except Exception as e:
        logger.error(f"Multiple upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/count")
async def get_document_count(
    vector_store: VectorStoreManager = Depends(get_vector_store)
):
    """Get total document count"""
    try:
        count = vector_store.get_document_count()
        return {"count": count}
    except Exception as e:
        logger.error(f"Failed to get document count: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/register")
async def register(request: AuthRequest):
    client = SupabaseClient.get_client()
    try:
        res = client.auth.sign_up({"email": request.email, "password": request.password})
        return {"user": res.user, "session": res.session}
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/login")
async def login(request: AuthRequest):
    client = SupabaseClient.get_client()
    try:
        res = client.auth.sign_in_with_password({"email": request.email, "password": request.password})
        return {"user": res.user, "session": res.session}
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/chats")
async def create_chat(request: ChatRequest):
    client = SupabaseClient.get_client()
    try:
        res = client.table("chats").insert({"user_id": request.user_id, "title": request.title}).execute()
        return res.data[0]
    except Exception as e:
        logger.error(f"Failed to create chat: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/chats")
async def get_chats(user_id: str):
    client = SupabaseClient.get_client()
    try:
        res = client.table("chats").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to get chats: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/chats/{chat_id}/messages")
async def get_messages(chat_id: str):
    client = SupabaseClient.get_client()
    try:
        res = client.table("messages").select("*").eq("chat_id", chat_id).order("created_at", desc=False).execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to get messages: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    vector_store: VectorStoreManager = Depends(get_vector_store)
):
    """Delete a document by ID"""
    try:
        success = vector_store.delete_documents([document_id])
        
        if success:
            return {"success": True, "message": f"Document {document_id} deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete document")
            
    except Exception as e:
        logger.error(f"Delete failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/documents/search")
async def search_documents(
    query: str,
    k: int = 5,
    vector_store: VectorStoreManager = Depends(get_vector_store)
):
    """Search for similar documents"""
    try:
        documents = vector_store.similarity_search(query, k=k)
        
        results = []
        for i, doc in enumerate(documents):
            results.append({
                "id": i,
                "content": doc.page_content[:500] + "..." if len(doc.page_content) > 500 else doc.page_content,
                "metadata": doc.metadata,
                "score": None  # similarity_search doesn't return scores
            })
        
        return {
            "query": query,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info" if settings.debug else "warning"
    )
