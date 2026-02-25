import os
from app.agents.diagnosis_agent import get_diagnosis_agent
from crewai import Task, Crew

os.environ["CREWAI_TELEMETRY_OPT_OUT"] = "true"

def test_ai():
    agent = get_diagnosis_agent()
    print("Agent created:", agent.role)

    task = Task(
        description="Just say hello and return {\"potential_diagnosis\": [], \"recommendations\": [], \"risk_level\": \"LOW\"}",
        expected_output="JSON object",
        agent=agent
    )
    crew = Crew(agents=[agent], tasks=[task], verbose=True)
    try:
        res = crew.kickoff()
        print("Result:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_ai()
