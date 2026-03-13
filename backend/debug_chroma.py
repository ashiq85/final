import chromadb
from chromadb.config import Settings
import os

def debug_chroma():
    persist_directory = "chroma_data"
    if not os.path.exists(persist_directory):
        print(f"ERROR: Persist directory '{persist_directory}' does not exist.")
        return

    client = chromadb.PersistentClient(path=persist_directory)
    collections = client.list_collections()
    
    print(f"Found {len(collections)} collections:")
    for col in collections:
        count = col.count()
        print(f" - Collection: {col.name}, Records: {count}")
        if count > 0:
            # Peek at some data
            peek = col.peek(limit=1)
            print(f"   Sample metadata: {peek['metadatas']}")

if __name__ == "__main__":
    debug_chroma()
