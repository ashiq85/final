from typing import List, Dict, Any, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.core.vector_store import vector_store
from app.core.llm import get_llm
import uuid

class RAGService:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            length_function=len,
        )

    async def process_document(self, patient_id: str, document_id: str, content: str, metadata: Dict[str, Any]):
        """Chunk document content and add to vector store"""
        chunks = self.text_splitter.split_text(content)
        
        ids = [f"{document_id}_{i}" for i in range(len(chunks))]
        metadatas = []
        for i in range(len(chunks)):
            meta = metadata.copy()
            meta.update({
                "patient_id": patient_id,
                "document_id": document_id,
                "chunk_index": i
            })
            metadatas.append(meta)
            
        vector_store.add_documents(
            collection_name=f"patient_{patient_id}",
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )
        return len(chunks)

    async def query_patient_records(self, patient_id: str, query: str, n_results: int = 5):
        """Query patient's vector records for relevant context"""
        try:
            results = vector_store.query(
                collection_name=f"patient_{patient_id}",
                query_texts=[query],
                n_results=n_results
            )
            return results
        except Exception as e:
            # Collection might not exist yet or other storage error
            print(f"DEBUG: RAG search failed for patient {patient_id}: {e}")
            return {"documents": [[]], "metadatas": [[]]}

rag_service = RAGService()
