from typing import List, Dict, Any, TypedDict
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from vector_store import VectorStoreManager
from config import settings
import openai
import logging
from supabase_client import SupabaseClient

logger = logging.getLogger(__name__)


class RAGState(TypedDict):
    """State for the RAG pipeline"""

    question: str
    context: List[str]
    answer: str
    sources: List[Dict[str, Any]]
    metadata: Dict[str, Any]


class RAGPipeline:
    def __init__(self):
        self.vector_store = VectorStoreManager()

        self.llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=0.1,
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base,
        )
        self._raw_client = openai.OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_api_base,
        )

        # Define prompts
        self.system_prompt = """You are a knowledgeable assistant that answers questions strictly based on the provided context documents.

        ## Instructions
        - Answer ONLY using information found in the context below
        - If the context lacks relevant information, respond exactly with: "I don't have enough information to answer that question based on the available documents."
        - Always cite sources by referencing the Document number (e.g., [Document 1], [Document 2]) inline within your answer
        - Never fabricate, assume, or infer information beyond what is explicitly stated in the context
        - If multiple documents support a claim, cite all of them
        - Keep answers concise, accurate, and directly relevant to the question

        ## Response Format
        - Use well-structured Markdown (headings, bullet points, bold text where appropriate)
        - Place citations inline, immediately after the relevant statement
        - End with a **Sources** section listing all referenced documents

        ## Context
        {context}

        ## Question
        {question}

        ## Answer"""

        self.prompt = ChatPromptTemplate.from_messages(
            [("system", self.system_prompt), ("human", "{question}")]
        )

        # Build the chain
        self.chain = self._build_chain()
        self.graph = self._build_graph()

    def _retrieve_context(self, state: RAGState) -> RAGState:
        """Retrieve relevant context from vector store"""
        question = state["question"]

        try:
            # Retrieve relevant documents
            documents_with_scores = self.vector_store.similarity_search_with_score(
                question, k=4
            )

            # Extract context and sources
            context = []
            sources = []

            for doc, score in documents_with_scores:
                context.append(doc.page_content)
                sources.append(
                    {
                        "content": doc.page_content[:200] + "..."
                        if len(doc.page_content) > 200
                        else doc.page_content,
                        "metadata": doc.metadata,
                        "score": float(score),
                    }
                )

            state["context"] = context
            state["sources"] = sources

            logger.info(f"Retrieved {len(context)} context chunks for question")
            return state

        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            state["context"] = []
            state["sources"] = []
            return state

    def _generate_answer(self, state: RAGState) -> RAGState:
        """Generate answer using LLM"""
        question = state["question"]
        context = state["context"]

        if not context:
            state["answer"] = (
                "I don't have enough information to answer that question based on the available documents."
            )
            return state

        try:
            # Format context for prompt
            formatted_context = "\n\n".join(
                [f"Document {i + 1}: {doc}" for i, doc in enumerate(context)]
            )

            response = self.llm.invoke(
                [
                    {
                        "role": "system",
                        "content": self.system_prompt.format(
                            context=formatted_context, question=question
                        ),
                    },
                    {"role": "user", "content": question},
                ]
            )
            state["answer"] = response.content

            logger.info("Generated answer successfully")
            return state

        except Exception as e:
            logger.error(f"Error generating answer: {e}")
            # print(state["answer"])
            state["answer"] = (
                "Sorry, I encountered an error while generating an answer."
            )
            return state

    def _build_chain(self):
        """Build a simple RAG chain (Deprecated: use query method logic)"""
        pass

    def _build_graph(self):
        """Build a LangGraph for more complex RAG workflows"""
        workflow = StateGraph(RAGState)

        # Add nodes
        workflow.add_node("retrieve", self._retrieve_context)
        workflow.add_node("generate", self._generate_answer)

        # Add edges
        workflow.add_edge("retrieve", "generate")
        workflow.add_edge("generate", END)

        # Set entry point
        workflow.set_entry_point("retrieve")

        return workflow.compile()

    def query(self, question: str, use_graph: bool = False, chat_id: str = None, user_id: str = None) -> Dict[str, Any]:
        """Query the RAG system"""
        logger.info(f"Processing query: {question} for chat {chat_id}")

        client = SupabaseClient.get_client()
        is_first_message = True
        
        # Load history
        if chat_id:
            try:
                res = client.table("messages").select("*").eq("chat_id", chat_id).order("created_at", desc=False).execute()
                msgs = res.data
                if msgs:
                    is_first_message = False
            except Exception as e:
                logger.error(f"Error loading history: {e}")

        # Search documents
        filter_dict = {}
        if chat_id:
            filter_dict["chat_id"] = chat_id
            
        documents = self.vector_store.similarity_search(question, k=4, filter=filter_dict if filter_dict else None)
        sources = [
            {
                "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
                "metadata": doc.metadata,
            }
            for doc in documents
        ]
        
        formatted_context = "\n\n".join([f"Document {i + 1}: {doc.page_content}" for i, doc in enumerate(documents)])
        
        # Format prompt
        formatted_prompt = self.system_prompt.format(
            context=formatted_context,
            question=question
        )
        
        # Construct exact conversational array
        llm_messages = [{"role": "system", "content": formatted_prompt}]
        
        if not is_first_message and msgs:
            for m in msgs[-10:]:
                llm_messages.append({"role": m["role"], "content": m["content"]})
                
        llm_messages.append({"role": "user", "content": question})
        
        # Generate Answer
        try:
            response = self.llm.invoke(llm_messages)
            answer = response.content
            
            # Save messages
            if chat_id:
                client.table("messages").insert([
                    {"chat_id": chat_id, "role": "user", "content": question},
                    {"chat_id": chat_id, "role": "assistant", "content": answer}
                ]).execute()
                
                # Generate a title if it's the first message
                if is_first_message:
                    title_resp = self.llm.invoke([
                        {"role": "system", "content": "You are a helpful assistant. Generate a short 3-5 word title for a chat that starts with the following question. Respond with ONLY the title. Do not include quotes."},
                        {"role": "user", "content": question}
                    ])
                    title = title_resp.content.strip('"\'')
                    client.table("chats").update({"title": title}).eq("id", chat_id).execute()
                    
        except Exception as e:
            logger.error(f"Error generating answer: {e}")
            answer = "Sorry, I encountered an error while generating an answer."

        return {"answer": answer, "sources": sources, "question": question}

    def add_documents(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Add documents to the RAG system"""
        from langchain_core.documents import Document
        from document_loaders import DocumentLoader

        try:
            loaded_docs = []

            for doc in documents:
                if "file_path" in doc:
                    # Load from file
                    docs = DocumentLoader.load_document(
                        doc["file_path"], metadata=doc.get("metadata", {})
                    )
                    loaded_docs.extend(docs)
                elif "url" in doc:
                    # Load from URL
                    docs = DocumentLoader.load_from_url(
                        doc["url"], metadata=doc.get("metadata", {})
                    )
                    loaded_docs.extend(docs)
                elif "content" in doc:
                    # Create document from content
                    loaded_docs.append(
                        Document(
                            page_content=doc["content"],
                            metadata=doc.get("metadata", {}),
                        )
                    )

            # Add to vector store
            doc_ids = self.vector_store.add_documents(loaded_docs)

            return {
                "success": True,
                "message": f"Added {len(doc_ids)} document chunks",
                "document_ids": doc_ids,
                "total_chunks": len(loaded_docs),
            }

        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            return {"success": False, "message": str(e)}
