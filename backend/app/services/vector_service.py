import chromadb
from chromadb.config import Settings
from app.core.config import settings
import logging
import os

logger = logging.getLogger(__name__)


class VectorService:
    """ChromaDB vector storage service for medical case similarity search"""
    
    def __init__(self):
        """Initialize ChromaDB client"""
        try:
            # Create persist directory if it doesn't exist
            os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)
            
            # Initialize ChromaDB client with persistence
            self.client = chromadb.PersistentClient(
                path=settings.CHROMA_PERSIST_DIRECTORY,
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            
            # Create or get collections
            self.medical_cases_collection = self.client.get_or_create_collection(
                name="medical_cases",
                metadata={"description": "Medical case histories for similarity search"}
            )
            
            self.documents_collection = self.client.get_or_create_collection(
                name="medical_documents",
                metadata={"description": "Patient medical documents and reports"}
            )
            
            logger.info("ChromaDB vector service initialized successfully")
        
        except Exception as e:
            logger.error(f"Error initializing ChromaDB: {e}")
            raise
    
    def add_medical_case(self, case_id: str, symptoms: list, diagnosis: str, treatment: str, metadata: dict = None):
        """
        Add a medical case to the vector database.
        
        Args:
            case_id: Unique case identifier
            symptoms: List of symptoms
            diagnosis: Diagnosis
            treatment: Treatment plan
            metadata: Additional metadata
        """
        try:
            # Create document text from case data
            document_text = f"Symptoms: {', '.join(symptoms)}. Diagnosis: {diagnosis}. Treatment: {treatment}"
            
            # Prepare metadata
            case_metadata = {
                "diagnosis": diagnosis,
                "treatment": treatment,
                "symptom_count": len(symptoms),
                **(metadata or {})
            }
            
            # Add to collection
            self.medical_cases_collection.add(
                documents=[document_text],
                metadatas=[case_metadata],
                ids=[case_id]
            )
            
            logger.info(f"Added medical case {case_id} to vector database")
            return {"success": True, "case_id": case_id}
        
        except Exception as e:
            logger.error(f"Error adding medical case: {e}")
            return {"success": False, "error": str(e)}
    
    def search_similar_cases(self, symptoms: list, n_results: int = 5) -> list:
        """
        Search for similar medical cases based on symptoms.
        
        Args:
            symptoms: List of symptoms to search for
            n_results: Number of results to return
        
        Returns:
            List of similar cases with similarity scores
        """
        try:
            # Create query text from symptoms
            query_text = f"Symptoms: {', '.join(symptoms)}"
            
            # Search in collection
            results = self.medical_cases_collection.query(
                query_texts=[query_text],
                n_results=n_results
            )
            
            # Format results
            similar_cases = []
            if results and results['ids']:
                for i, case_id in enumerate(results['ids'][0]):
                    similar_cases.append({
                        "case_id": case_id,
                        "similarity_score": 1 - results['distances'][0][i] if results['distances'] else 0,
                        "diagnosis": results['metadatas'][0][i].get('diagnosis', 'Unknown'),
                        "treatment": results['metadatas'][0][i].get('treatment', 'Unknown'),
                        "document": results['documents'][0][i] if results['documents'] else ""
                    })
            
            logger.info(f"Found {len(similar_cases)} similar cases")
            return similar_cases
        
        except Exception as e:
            logger.error(f"Error searching similar cases: {e}")
            return []
    
    def add_document_embedding(self, document_id: str, content: str, metadata: dict = None):
        """
        Add a document embedding to the vector database.
        
        Args:
            document_id: Unique document identifier
            content: Document content
            metadata: Additional metadata
        """
        try:
            self.documents_collection.add(
                documents=[content],
                metadatas=[metadata or {}],
                ids=[document_id]
            )
            
            logger.info(f"Added document {document_id} to vector database")
            return {"success": True, "document_id": document_id}
        
        except Exception as e:
            logger.error(f"Error adding document embedding: {e}")
            return {"success": False, "error": str(e)}
    
    def search_documents(self, query: str, n_results: int = 5) -> list:
        """
        Search for similar documents.
        
        Args:
            query: Search query
            n_results: Number of results to return
        
        Returns:
            List of similar documents
        """
        try:
            results = self.documents_collection.query(
                query_texts=[query],
                n_results=n_results
            )
            
            similar_docs = []
            if results and results['ids']:
                for i, doc_id in enumerate(results['ids'][0]):
                    similar_docs.append({
                        "document_id": doc_id,
                        "similarity_score": 1 - results['distances'][0][i] if results['distances'] else 0,
                        "content": results['documents'][0][i] if results['documents'] else "",
                        "metadata": results['metadatas'][0][i] if results['metadatas'] else {}
                    })
            
            return similar_docs
        
        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []
    
    def delete_case(self, case_id: str):
        """Delete a medical case from the vector database"""
        try:
            self.medical_cases_collection.delete(ids=[case_id])
            logger.info(f"Deleted case {case_id}")
            return {"success": True}
        except Exception as e:
            logger.error(f"Error deleting case: {e}")
            return {"success": False, "error": str(e)}
    
    def delete_document(self, document_id: str):
        """Delete a document from the vector database"""
        try:
            self.documents_collection.delete(ids=[document_id])
            logger.info(f"Deleted document {document_id}")
            return {"success": True}
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            return {"success": False, "error": str(e)}



# Create singleton instance — guarded so a ChromaDB init failure doesn't crash the app
try:
    vector_service = VectorService()
except Exception as _e:
    import logging as _logging
    _logging.getLogger(__name__).warning(
        f"VectorService (ChromaDB) failed to initialize and will be unavailable: {_e}"
    )
    vector_service = None
