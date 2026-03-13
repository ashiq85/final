import asyncio
import sys
import os

# Need to run from backend directory
sys.path.insert(0, os.getcwd())

async def test_full_rag_flow():
    from app.core.rag_service import rag_service
    from app.core.vector_store import vector_store

    patient_id = "test_rag_patient"
    doc_id = "test_doc_001"
    content = "The patient has a history of hypertension and recent cardiac imaging showed minor valve regurgitation. Patient also has Type 2 diabetes managed with metformin."
    metadata = {"filename": "test.txt", "type": "clinical_report"}

    print(f"Step 1: Adding document chunks for patient '{patient_id}'...")
    try:
        chunks = await rag_service.process_document(patient_id, doc_id, content, metadata)
        print(f"  SUCCESS: Processed {chunks} chunks.")
    except Exception as e:
        print(f"  ERROR processing document: {e}")
        import traceback; traceback.print_exc()
        return

    print("\nStep 2: Checking ChromaDB record count...")
    try:
        col = vector_store.get_or_create_collection(f"patient_{patient_id}")
        count = col.count()
        print(f"  Records in collection: {count}")
    except Exception as e:
        print(f"  ERROR checking collection: {e}")

    print("\nStep 3: Querying for 'cardiac'...")
    try:
        results = await rag_service.query_patient_records(patient_id, "cardiac history")
        docs = results.get("documents", [[]])[0] if results else []
        if docs:
            print(f"  SUCCESS: Found {len(docs)} result(s).")
            print(f"  First result: {docs[0][:200]}")
        else:
            print(f"  FAILURE: No documents found. Full result: {results}")
    except Exception as e:
        print(f"  ERROR querying records: {e}")
        import traceback; traceback.print_exc()

    # Clean up test data
    try:
        vector_store.delete_collection(f"patient_{patient_id}")
        print("\nStep 4: Cleaned up test collection.")
    except Exception as e:
        print(f"\nStep 4: Cleanup failed (non critical): {e}")

if __name__ == "__main__":
    asyncio.run(test_full_rag_flow())
