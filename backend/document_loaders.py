import os
import tempfile
from typing import List, Optional, Dict, Any
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    CSVLoader,
    UnstructuredMarkdownLoader,
    UnstructuredWordDocumentLoader,
    UnstructuredPowerPointLoader,
    UnstructuredExcelLoader,
    WebBaseLoader
)
from langchain_core.documents import Document
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class DocumentLoader:
    """Handles loading documents from various file formats"""
    
    SUPPORTED_EXTENSIONS = {
        '.pdf': 'pdf',
        '.txt': 'text',
        '.md': 'markdown',
        '.csv': 'csv',
        '.doc': 'word',
        '.docx': 'word',
        '.ppt': 'powerpoint',
        '.pptx': 'powerpoint',
        '.xls': 'excel',
        '.xlsx': 'excel',
    }
    
    @classmethod
    def get_file_type(cls, file_path: str) -> Optional[str]:
        """Get file type based on extension"""
        ext = Path(file_path).suffix.lower()
        return cls.SUPPORTED_EXTENSIONS.get(ext)
    
    @classmethod
    def load_document(cls, file_path: str, metadata: Optional[Dict[str, Any]] = None) -> List[Document]:
        """Load a single document from file path"""
        file_type = cls.get_file_type(file_path)
        
        if not file_type:
            raise ValueError(f"Unsupported file type: {file_path}")
        
        logger.info(f"Loading {file_type} document: {file_path}")
        
        try:
            if file_type == 'pdf':
                loader = PyPDFLoader(file_path)
            elif file_type == 'text':
                loader = TextLoader(file_path, encoding='utf-8')
            elif file_type == 'markdown':
                loader = UnstructuredMarkdownLoader(file_path)
            elif file_type == 'csv':
                loader = CSVLoader(file_path)
            elif file_type == 'word':
                loader = UnstructuredWordDocumentLoader(file_path)
            elif file_type == 'powerpoint':
                loader = UnstructuredPowerPointLoader(file_path)
            elif file_type == 'excel':
                loader = UnstructuredExcelLoader(file_path)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            
            documents = loader.load()
            
            # Add custom metadata if provided
            if metadata:
                for doc in documents:
                    doc.metadata.update(metadata)
            
            logger.info(f"Successfully loaded {len(documents)} document chunks from {file_path}")
            return documents
            
        except Exception as e:
            logger.error(f"Error loading document {file_path}: {e}")
            raise
    
    @classmethod
    def load_documents_from_directory(
        cls, 
        directory_path: str, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        """Load all supported documents from a directory"""
        all_documents = []
        directory = Path(directory_path)
        
        if not directory.exists() or not directory.is_dir():
            raise ValueError(f"Directory not found: {directory_path}")
        
        for file_path in directory.rglob('*'):
            if file_path.is_file() and cls.get_file_type(str(file_path)):
                try:
                    documents = cls.load_document(str(file_path), metadata)
                    all_documents.extend(documents)
                except Exception as e:
                    logger.warning(f"Skipping file {file_path}: {e}")
        
        logger.info(f"Loaded {len(all_documents)} total document chunks from directory {directory_path}")
        return all_documents
    
    @classmethod
    def load_from_url(cls, url: str, metadata: Optional[Dict[str, Any]] = None) -> List[Document]:
        """Load document from URL"""
        logger.info(f"Loading document from URL: {url}")
        
        try:
            loader = WebBaseLoader(url)
            documents = loader.load()
            
            if metadata:
                for doc in documents:
                    doc.metadata.update(metadata)
            
            logger.info(f"Successfully loaded {len(documents)} document chunks from URL")
            return documents
            
        except Exception as e:
            logger.error(f"Error loading from URL {url}: {e}")
            raise
    
    @classmethod
    def load_from_bytes(
        cls, 
        file_bytes: bytes, 
        filename: str, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        """Load document from bytes (for uploaded files)"""
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix) as tmp_file:
            tmp_file.write(file_bytes)
            tmp_file_path = tmp_file.name
        
        try:
            documents = cls.load_document(tmp_file_path, metadata)
            return documents
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_file_path)
            except:
                pass