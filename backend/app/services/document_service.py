from app.db.models import Document
from app.services.vector_service import vector_service
from typing import Any, Optional
import os
import logging

logger = logging.getLogger(__name__)


class DocumentService:
    """Service for managing medical documents and extracting information"""

    @staticmethod
    def process_document(db: Any, document_id: str) -> dict:
        """
        Process a document and extract information.

        Args:
            db: Firestore client
            document_id: Document ID

        Returns:
            Extracted information
        """
        try:
            doc_ref = db.collection("documents").document(document_id)
            doc = doc_ref.get()
            if not doc.exists:
                raise ValueError("Document not found")

            document = doc.to_dict()
            logger.info(f"Processing document {document_id}: {document.get('filename')}")

            file_path = document.get("file_path", "")
            file_type = document.get("file_type", "")

            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Document file not found: {file_path}")

            extracted_text = DocumentService._extract_text(file_path, file_type)
            extracted_data = DocumentService._extract_medical_data(extracted_text, document.get("document_type", ""))

            # Update document with extracted data
            doc_ref.update({"extracted_data": extracted_data})

            # Add to vector database for similarity search
            if extracted_text:
                vector_service.add_document_embedding(
                    document_id=document_id,
                    content=extracted_text,
                    metadata={
                        "patient_id": document.get("patient_id"),
                        "document_type": document.get("document_type"),
                        "filename": document.get("filename")
                    }
                )

            logger.info(f"Successfully processed document {document_id}")
            return extracted_data

        except Exception as e:
            logger.error(f"Error processing document: {e}")
            raise

    @staticmethod
    def _extract_text(file_path: str, file_type: str) -> str:
        """Extract text from document file."""
        try:
            if "text" in file_type:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            elif "pdf" in file_type:
                logger.warning("PDF extraction not yet implemented")
                return "PDF text extraction pending"
            elif "image" in file_type:
                logger.warning("Image OCR not yet implemented")
                return "Image OCR pending"
            else:
                logger.warning(f"Unsupported file type: {file_type}")
                return ""
        except Exception as e:
            logger.error(f"Error extracting text: {e}")
            return ""

    @staticmethod
    def _extract_medical_data(text: str, document_type: str) -> dict:
        """Extract structured medical data from text."""
        extracted = {
            "document_type": document_type,
            "raw_text": text[:500] if text else "",
            "extraction_status": "pending_ai_integration"
        }
        if document_type == "lab_report":
            extracted["potential_values"] = DocumentService._extract_lab_values(text)
        return extracted

    @staticmethod
    def _extract_lab_values(text: str) -> dict:
        """Extract lab values from text (basic implementation)"""
        return {
            "note": "Lab value extraction requires AI integration",
            "raw_text_sample": text[:200] if text else ""
        }

    @staticmethod
    def search_patient_documents(db: Any, patient_id: str, query: str, limit: int = 5) -> list:
        """
        Search patient documents using vector similarity.

        Args:
            db: Firestore client
            patient_id: Patient ID
            query: Search query
            limit: Maximum results

        Returns:
            List of relevant documents
        """
        try:
            similar_docs = vector_service.search_documents(query, n_results=limit)
            results = []
            for sdoc in similar_docs:
                doc_id = sdoc["document_id"]
                doc = db.collection("documents").document(doc_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    if data.get("patient_id") == patient_id:
                        results.append({
                            "document_id": doc.id,
                            "filename": data.get("filename"),
                            "document_type": data.get("document_type"),
                            "similarity_score": sdoc.get("similarity_score"),
                            "extracted_data": data.get("extracted_data")
                        })
            return results

        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []


# Create singleton instance
document_service = DocumentService()
