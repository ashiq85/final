import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

def test_firebase():
    print("Starting Firebase test...")
    cred_path = "serviceAccountKey.json"
    if not os.path.exists(cred_path):
        print(f"Error: {cred_path} not found")
        return
        
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("Firebase Admin initialized.")
        
        db = firestore.client()
        print("Firestore client created. Attempting to read 'users' collection...")
        
        # This is where it might hang
        docs = db.collection('users').limit(1).get()
        print(f"Successfully read {len(docs)} documents.")
        for d in docs:
            print(f"Found user: {d.to_dict().get('email')}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_firebase()
