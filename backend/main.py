from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import os
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

# Build allowed origins list from env var (comma-separated), or fall back to wildcard
_raw_origins = os.getenv("CORS_ORIGINS", "*")
cors_origins: List[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # Cache preflight for 24 h
)

# Explicit OPTIONS handler — safety net for Render's cold-start proxy behaviour.
# The CORSMiddleware handles preflights normally, but this ensures a 200 is always
# returned with the right headers even if middleware ordering causes issues.
@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str, request: Request) -> Response:
    origin = request.headers.get("origin", "*")
    allowed = "*" if cors_origins == ["*"] else (origin if origin in cors_origins else cors_origins[0])
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": allowed,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
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

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    password: str

class EditMessageRequest(BaseModel):
    content: str
    use_graph: bool = False

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
    # Using Service Role Key to bypass email confirmation
    admin_client = SupabaseClient.get_service_role_client()
    try:
        # Create user as pre-confirmed
        admin_client.auth.admin.create_user({
            "email": request.email,
            "password": request.password,
            "email_confirm": True
        })
        
        # After creating confirmed user, we need to sign in to get a session for the client
        # We'll use the regular client for this to respect standard auth flows
        public_client = SupabaseClient.get_client()
        login_res = public_client.auth.sign_in_with_password({
            "email": request.email, 
            "password": request.password
        })
        
        return {"user": login_res.user, "session": login_res.session}
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

@app.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    client = SupabaseClient.get_client()
    try:
        # Request reset email from Supabase
        client.auth.reset_password_for_email(request.email)
        return {"success": True, "message": "Password reset link sent if account exists."}
    except Exception as e:
        logger.error(f"Forgot password request failed: {e}")
        # We generally don't want to confirm if an email exists for security.
        return {"success": True, "message": "Password reset link sent if account exists."}

@app.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest, req_obj: Request):
    # This requires an active session (user clicked reset link)
    # We verify that a Bearer token or cookie is present.
    # For this simplified implementation, we assume the client provides the token in headers.
    client = SupabaseClient.get_client()
    auth_header = req_obj.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized session required")
    
    token = auth_header.split(" ")[1]
    
    try:
        # Update user's password using the access token
        client.auth.set_session(token, "") 
        res = client.auth.update_user({"password": request.password})
        return {"success": True, "user": res.user}
    except Exception as e:
        logger.error(f"Reset password failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

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

@app.delete("/chats/{chat_id}")
async def delete_chat(
    chat_id: str,
    vector_store: VectorStoreManager = Depends(get_vector_store)
):
    """Delete a single chat, its messages, and its associated documents from the vector store"""
    client = SupabaseClient.get_client()
    try:
        # 1. Delete documents from vector store that belong to this chat
        try:
            doc_res = client.table(settings.vector_store_table_name).select("id").filter(
                "metadata->>chat_id", "eq", chat_id
            ).execute()
            if doc_res.data:
                doc_ids = [row["id"] for row in doc_res.data]
                vector_store.delete_documents(doc_ids)
                logger.info(f"Deleted {len(doc_ids)} vector documents for chat {chat_id}")
        except Exception as e:
            logger.warning(f"Error deleting vector documents for chat {chat_id}: {e}")

        # 2. Delete all messages belonging to this chat
        client.table("messages").delete().eq("chat_id", chat_id).execute()

        # 3. Delete the chat itself
        client.table("chats").delete().eq("id", chat_id).execute()

        return {"success": True, "message": f"Chat {chat_id} and all associated data deleted"}
    except Exception as e:
        logger.error(f"Failed to delete chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/chats")
async def delete_all_chats(
    user_id: str,
    vector_store: VectorStoreManager = Depends(get_vector_store)
):
    """Delete ALL chats, messages, and documents for a user"""
    client = SupabaseClient.get_client()
    try:
        # 1. Get all chat IDs for this user
        chats_res = client.table("chats").select("id").eq("user_id", user_id).execute()
        chat_ids = [c["id"] for c in (chats_res.data or [])]

        if not chat_ids:
            return {"success": True, "message": "No chats to delete"}

        # 2. Delete vector documents for each chat
        for cid in chat_ids:
            try:
                doc_res = client.table(settings.vector_store_table_name).select("id").filter(
                    "metadata->>chat_id", "eq", cid
                ).execute()
                if doc_res.data:
                    doc_ids = [row["id"] for row in doc_res.data]
                    vector_store.delete_documents(doc_ids)
            except Exception as e:
                logger.warning(f"Error deleting vector docs for chat {cid}: {e}")

        # 3. Delete all messages for those chats
        for cid in chat_ids:
            client.table("messages").delete().eq("chat_id", cid).execute()

        # 4. Delete all chats
        client.table("chats").delete().eq("user_id", user_id).execute()

        return {"success": True, "message": f"Deleted {len(chat_ids)} chats and all associated data"}
    except Exception as e:
        logger.error(f"Failed to delete all chats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/messages/{message_id}")
async def delete_message(message_id: str):
    """Delete a user message and its paired assistant response.
    The assistant response is defined as the next message (by created_at) in the same chat with role='assistant'.
    """
    client = SupabaseClient.get_client()
    try:
        # 1. Fetch the target message
        msg_res = client.table("messages").select("*").eq("id", message_id).execute()
        if not msg_res.data:
            raise HTTPException(status_code=404, detail="Message not found")
        msg = msg_res.data[0]

        ids_to_delete = [message_id]

        # 2. If it's a user message, find and delete the paired assistant response
        if msg["role"] == "user":
            pair_res = (
                client.table("messages")
                .select("id")
                .eq("chat_id", msg["chat_id"])
                .eq("role", "assistant")
                .gt("created_at", msg["created_at"])
                .order("created_at", desc=False)
                .limit(1)
                .execute()
            )
            if pair_res.data:
                ids_to_delete.append(pair_res.data[0]["id"])

        # 3. Delete all identified messages
        for mid in ids_to_delete:
            client.table("messages").delete().eq("id", mid).execute()

        return {"success": True, "deleted_ids": ids_to_delete}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/messages/{message_id}")
async def edit_message(
    message_id: str,
    body: EditMessageRequest,
    rag_pipeline: RAGPipeline = Depends(get_rag_pipeline)
):
    """Edit a user message: updates the message content, deletes the old assistant response,
    and all subsequent messages, then generates a new response.
    """
    client = SupabaseClient.get_client()
    try:
        # 1. Fetch the message
        msg_res = client.table("messages").select("*").eq("id", message_id).execute()
        if not msg_res.data:
            raise HTTPException(status_code=404, detail="Message not found")
        msg = msg_res.data[0]
        chat_id = msg["chat_id"]

        if msg["role"] != "user":
            raise HTTPException(status_code=400, detail="Can only edit user messages")

        # 2. Delete all messages that come AFTER this message (by created_at)
        subsequent_res = (
            client.table("messages")
            .select("id")
            .eq("chat_id", chat_id)
            .gt("created_at", msg["created_at"])
            .execute()
        )
        for s in (subsequent_res.data or []):
            client.table("messages").delete().eq("id", s["id"]).execute()

        # 3. Delete the original user message too (the pipeline will re-insert it)
        client.table("messages").delete().eq("id", message_id).execute()

        # 4. Get the user_id from the chat
        chat_res = client.table("chats").select("user_id").eq("id", chat_id).execute()
        user_id = chat_res.data[0]["user_id"] if chat_res.data else None

        # 5. Re-query the RAG pipeline with the edited content
        result = rag_pipeline.query(
            question=body.content,
            use_graph=body.use_graph,
            chat_id=chat_id,
            user_id=user_id
        )

        return {
            "success": True,
            "answer": result["answer"],
            "sources": result["sources"],
            "question": body.content,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to edit message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
