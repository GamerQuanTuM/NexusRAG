from typing import List, Optional, Dict, Any
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from supabase_client import SupabaseClient
from config import settings
import logging

logger = logging.getLogger(__name__)

class VectorStoreManager:
    def __init__(self):
        self.supabase_client = SupabaseClient.get_client()
        self.embeddings = None
        if "gemini" in settings.embedding_model.lower() or "text-embedding" in settings.embedding_model.lower():
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            api_key = settings.gemini_api_key if settings.gemini_api_key else settings.openai_api_key
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model=settings.embedding_model,
                google_api_key=api_key
            )
        else:
            self.embeddings = OpenAIEmbeddings(
                model=settings.embedding_model,
                openai_api_key=settings.openai_api_key,
                openai_api_base=settings.openai_api_base,
            )
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""],
        )

    def get_vector_store(self) -> SupabaseVectorStore:
        """Get Supabase vector store instance"""
        return SupabaseVectorStore(
            client=self.supabase_client,
            embedding=self.embeddings,
            table_name=settings.vector_store_table_name,
            query_name=f"match_{settings.vector_store_table_name}",
        )

    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks"""
        return self.text_splitter.split_documents(documents)

    def add_documents(self, documents: List[Document]) -> List[str]:
        """Add documents to vector store"""
        vector_store = self.get_vector_store()
        split_docs = self.split_documents(documents)

        logger.info(f"Adding {len(split_docs)} document chunks to vector store")
        return vector_store.add_documents(split_docs)

    def similarity_search(
        self, query: str, k: int = 4, filter: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        """Search for similar documents"""
        embedding = self.embeddings.embed_query(query)
        match_params = {
            "query_embedding": embedding,
            "match_count": k,
        }
        if filter is not None:
            match_params["filter"] = filter
            
        rpc_name = f"match_{settings.vector_store_table_name}"
        response = self.supabase_client.rpc(rpc_name, match_params).execute()
        
        documents = []
        if hasattr(response, "data") and response.data:
            for row in response.data:
                metadata = row.get("metadata", {})
                doc = Document(page_content=row.get("content", ""), metadata=metadata)
                documents.append(doc)
        return documents

    def similarity_search_with_score(
        self, query: str, k: int = 4, filter: Optional[Dict[str, Any]] = None
    ) -> List[tuple[Document, float]]:
        """Search for similar documents with scores"""
        embedding = self.embeddings.embed_query(query)
        match_params = {
            "query_embedding": embedding,
            "match_count": k,
        }
        if filter is not None:
            match_params["filter"] = filter
            
        rpc_name = f"match_{settings.vector_store_table_name}"
        response = self.supabase_client.rpc(rpc_name, match_params).execute()
        
        results = []
        if hasattr(response, "data") and response.data:
            for row in response.data:
                metadata = row.get("metadata", {})
                doc = Document(page_content=row.get("content", ""), metadata=metadata)
                results.append((doc, row.get("similarity", 0.0)))
        return results

    def delete_documents(self, document_ids: List[str]) -> bool:
        """Delete documents from vector store by IDs"""
        try:
            # vector_store = self.get_vector_store()
            # SupabaseVectorStore doesn't have a direct delete method
            # We'll use the supabase client directly
            for doc_id in document_ids:
                self.supabase_client.table(
                    settings.vector_store_table_name
                ).delete().eq("id", doc_id).execute()
            logger.info(f"Deleted {len(document_ids)} documents")
            return True
        except Exception as e:
            logger.error(f"Error deleting documents: {e}")
            return False

    def get_document_count(self) -> int:
        """Get total number of documents in vector store"""
        try:
            response = (
                self.supabase_client.table(settings.vector_store_table_name)
                .select("*", count="exact")
                .execute()
            )
            return response.count or 0
        except Exception as e:
            logger.error(f"Error getting document count: {e}")
            return 0
