import sys, os
sys.path.insert(0, os.getcwd())
from app.core.llm import get_llm

print("Testing LLM directly...")
try:
    llm = get_llm()
    prompt = """Test: Tell me 3 possible diagnoses for chest pain as a JSON object:
{"potential_diagnosis": ["condition 1", "condition 2", "condition 3"],
"recommendations": ["recommendation 1", "recommendation 2"]}"""
    response = llm.invoke(prompt)
    print("LLM Response content:", response.content[:200])
except Exception as e:
    print(f"LLM Error: {type(e).__name__}: {e}")
