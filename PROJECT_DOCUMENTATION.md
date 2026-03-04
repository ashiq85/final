# AgentHealth - Complete Project Documentation

## 1. Executive Summary
**AgentHealth** is a modern, AI-powered healthcare management system designed to streamline patient registration, medical history tracking, and intelligent clinical decision support. The platform empowers medical professionals and patients by combining traditional healthcare management with cutting-edge AI features, specifically targeting emergency condition detection (like strokes and heart attacks) and differential diagnosis via large language models.

---

## 2. System Architecture
AgentHealth employs a decoupled client-server architecture.

### Frontend (User Interface)
- **Framework**: React.js with Vite
- **Language**: TypeScript/JavaScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State Management / Data Fetching**: React Query & Axios
- **Routing**: React Router DOM
- **Role**: Serves role-specific dashboards (Admin, Doctor, Patient) with real-time feedback, forms, and analytical charts (Recharts).

### Backend (API & AI Processing)
- **Framework**: FastAPI (Python)
- **Authentication**: JWT (JSON Web Tokens) with standard OAuth2 password flow.
- **Relational Database**: SQLite (for structured data like Users, Roles, and core access control). Uses SQLAlchemy as the ORM.
- **NoSQL Database**: Firebase SDK (Firestore) for flexible storage of document-centric models (e.g., patient health metrics, dynamic logs).
- **Role**: Provides secure RESTful endpoints, handles business logic, database migrations, and acts as the bridge to the AI Agents.

### Artificial Intelligence Layer
- **Framework**: CrewAI
- **LLM Provider**: Google Gemini (`gemini-2.5-flash`) via Langchain (`langchain-google-genai`)
- **Role**: The AI layer processes natural language symptoms and health records. It runs a `Clinical Diagnosis Specialist` Agent (or Orchestrator) tasked with returning highly specific differential diagnoses, risk assessments, and actionable clinical next steps.

---

## 3. Core Workflows & Features

### 3.1 Authentication & Authorization
The system uses **Role-Based Access Control (RBAC)** defining three primary roles:
1. **Admin**: Can create and manage doctor accounts, view all patients, and manage system-wide settings.
2. **Clinician (Doctor / Healthcare Provider)**:
   * **Primary Responsibility**: Deliver patient care with AI-assisted support.
   * **Capabilities**:
      * **Clinical Dashboard Access**: View patient dashboard, access full medical history, review lab results & reports.
      * **Clinical Decision Support**: Receive diagnostic suggestions, get AI-generated treatment recommendations, view early warning alerts (e.g., sepsis risk), access evidence-based protocols.
      * **Patient Encounter Management**: Document patient visit, update diagnosis, prescribe medications, manage treatment plans.
      * **Communication**: Communicate with patients, send follow-up instructions, respond to patient-reported outcomes.
      * **Real-Time Alerts**: Critical alerts delivered in under 5 seconds, risk-based patient prioritization.
3. **Patient**: Can self-register, manage their personal profile, and view their medical history.

*Workflow*: Users log in via the `/api/auth/login` endpoint. The backend verifies passwords against bcrypt-hashed DB entries and issues a JWT. The frontend stores this token and passes it in the `Authorization: Bearer <token>` header for all subsequent API requests.

### 3.2 AI-Powered Diagnosis & Emergency Detection
The flagship feature of AgentHealth is the Clinical Decision Support AI.
* **Emergency Pre-screening**: Before AI processing, rule-based functions check for critical conditions (like the FAST protocol for strokes, or keywords for heart attacks). If a critical emergency is detected, it overrides standard AI processing and returns an immediate high-risk alert with intervention actions (e.g., "CALL 108").
* **Agentic Processing (CrewAI)**: If no immediate rule-based emergency is triggered, the `/api/diagnosis/analyze` endpoint gathers the patient's context (symptoms, latest vitals, and medical history) and dynamically creates a `Task` for the CrewAI diagnosis agent.
* **Gemini LLM**: CrewAI securely passes the prompt to `gemini-2.5-flash`. The model evaluates the data against medical knowledge and returns a highly specific JSON payload containing:
   - Specific potential conditions and their likelihoods.
   - Clinical actions (e.g., specific lab tests, CBT, medications to consider).
   - Risk level stratification.
* **Output**: The backend extracts this JSON, formats it into a validated Pydantic schema (`DiagnosisResponse`), and returns it to the frontend for the Doctor to review.

### 3.3 Patient Management & Health Metrics
* Doctors can add and update health metrics (blood pressure, heart rate, weight) which are saved into the Firestore NoSQL database.
* The frontend visualizes this data chronologically to give the healthcare provider a holistic view of the patient's health trajectory.

---

## 4. Codebase Structure

### `/frontend`
- `src/components/`: Reusable UI components (buttons, input fields, modals).
- `src/pages/`: Main route views (Login, AdminDashboard, DoctorDashboard).
- `src/store/` or `src/api/`: Axios instances and React Query hooks for API communication.
- `package.json`: Contains all React dependencies and Vite build scripts.

### `/backend`
- `main.py`: The FastAPI application entry point. Bootstraps routes and Firebase connections.
- `app/api/routes/`: Contains controllers for specific domains (`auth.py`, `patients.py`, `diagnosis.py`, `admin.py`).
- `app/agents/`: CrewAI logic (`diagnosis_agent.py`, `emergency_detection_agent.py`, `tools.py`).
- `app/db/`: Database configuration (`base.py`, `models.py` for SQLAlchemy, `firebase_config.py`).
- `app/core/`: Security utilities (JWT, password hashing) and Environment configurations (`config.py`).
- `app/schemas/`: Pydantic models for request/response validation.
- `.env`: Environment variables including Database URLs and the `GOOGLE_API_KEY`.

---

## 5. Development Setup & Deployment

1. **Environment Variables**:
   A `.env` file must be present in the `/backend` directory containing:
   ```env
   SECRET_KEY=your_secret_key
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   GOOGLE_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   ```

2. **Backend Execution**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # (or .\venv\Scripts\activate on Windows)
   pip install -r requirements.txt
   python main.py
   ```
   *The backend will run on `http://localhost:8000` with Swagger Docs at `/docs`.*

3. **Frontend Execution**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *The frontend will run on `http://localhost:5173`.*

4. **Default Users**:
   The system initializes three default user accounts to test the RBAC capabilities:
   - **Admin**: `admin@agenthealth.com` / `admin123`
   - **Doctor**: `doctor@agenthealth.com` / `doctor123`
   - **Patient**: `patient@agenthealth.com` / `patient123`

---
*End of Documentation*
