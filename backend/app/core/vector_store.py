import chromadb
from chromadb.config import Settings
import os
from typing import List, Dict, Any, Optional

class VectorStore:
    def __init__(self, persist_directory: str = "chroma_data"):
        self.persist_directory = persist_directory
        self.client = chromadb.PersistentClient(path=persist_directory)
        
    def get_or_create_collection(self, name: str):
        return self.client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"}
        )

    def add_documents(self, collection_name: str, documents: List[str], metadatas: List[Dict[str, Any]], ids: List[str]):
        collection = self.get_or_create_collection(collection_name)
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )

    def query(self, collection_name: str, query_texts: List[str], n_results: int = 5, where: Optional[Dict[str, Any]] = None):
        collection = self.get_or_create_collection(collection_name)
        return collection.query(
            query_texts=query_texts,
            n_results=n_results,
            where=where
        )

    def delete_collection(self, name: str):
        self.client.delete_collection(name)

vector_store = VectorStore()
