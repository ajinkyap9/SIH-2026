import sys
import uuid
import json

from app.interview.engine import process_message
from app.config import get_settings

def main():
    print("Initializing RAG Intake & Decision Engine...")
    
    # Attempt to initialize RAG retriever (so "why" text is populated)
    try:
        settings = get_settings()
        from app.rag.retriever import get_retriever
        retriever = get_retriever()
        retriever.initialize(
            knowledge_dir=settings.knowledge_base_path,
            index_dir=settings.faiss_index_path,
            embedding_model=settings.embedding_model,
        )
    except Exception as e:
        print(f"Warning: RAG initialization failed ({e}). Running in fallback mode.")

    session_id = str(uuid.uuid4())
    print(f"\nStarting interactive interview session ({session_id})...")
    
    # Initial message (start interview)
    result = process_message(session_id)
    print("\n" + "="*60)
    print(f"Assistant: {result.get('message', '')}")
    
    while not result.get("profile_complete"):
        next_q = result.get("next_question")
        if not next_q:
            break
            
        print("\n" + "-"*60)
        print(f"Q: {next_q['question_text']}")
        if next_q.get("why"):
            print(f"(Why we're asking: {next_q['why']})")
            
        if next_q.get("options"):
            print("\nOptions:")
            for i, opt in enumerate(next_q["options"], 1):
                print(f"  {i}. {opt['label']}")
                
        user_input = input("\nYour answer (type the label or number): ").strip()
        result = process_message(session_id, user_input)
        
        # Check for validation errors
        if result.get("message") and result["state"] == "IN_PROGRESS" and "Invalid" in result.get("message", ""):
            print(f"\n[!] {result['message']}")
            
    print("\n" + "="*60)
    print(f"Assistant: {result.get('message', 'Interview Complete!')}")
    
    if result.get("decision"):
        print("\n--- DECISION RESULTS ---")
        decision = result["decision"]
        
        print("\nREQUIRED SERVICES:")
        for svc in decision.get("required_services", []):
            reason = decision.get("reasoning", {}).get(svc, "No reason provided")
            print(f" - {svc}: {reason}")
            
        print("\nEXECUTION PLAN (WAVE ORDER):")
        for step in decision.get("execution_plan", []):
            deps = ", ".join(step["depends_on"]) if step["depends_on"] else "None"
            print(f" [Wave {step['wave']}] {step['service']}")
            print(f"    Depends on: {deps}")
            print(f"    Reason: {step['reason']}")

if __name__ == "__main__":
    main()
