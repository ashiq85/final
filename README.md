# AgentHealth - AI-Powered Healthcare Management System

## Overview
AgentHealth is a comprehensive healthcare management system with AI-powered emergency detection, role-based access control, and patient management capabilities.

## Features

### Authentication & Authorization
- ✅ Patient self-registration
- ✅ Secure login with JWT tokens
- ✅ Role-based access control (Admin, Doctor, Patient)
- ✅ Password hashing with bcrypt

### Admin Management
- ✅ Create and manage doctor accounts
- ✅ View and manage all patients
- ✅ Activate/deactivate user accounts
- ✅ System-wide user management

### Clinician Capabilities (Doctor / Healthcare Provider)
**Primary Responsibility:** Deliver patient care with AI-assisted support.
- ✅ **Clinical Dashboard Access**: View patient dashboards, full medical history, and lab reports.
- ✅ **Clinical Decision Support**: Diagnostic suggestions, AI treatment recommendations, early warning alerts, evidence-based protocols.
- ✅ **Patient Encounter Management**: Document visits, update diagnoses, prescribe medications, manage treatment plans.
- ✅ **Communication**: Communicate with patients, send follow-up instructions, respond to reported outcomes.
- ✅ **Real-Time Alerts**: Sub-5 second critical alerts and risk-based prioritization.

### Emergency Detection
- ✅ Stroke detection (FAST protocol)
- ✅ Heart attack detection
- ✅ Cardiac emergency assessment
- ✅ Real-time emergency response guidance

## Tech Stack

### Backend
- **Framework**: FastAPI
- **Database**: SQLite (PostgreSQL for production)
- **Authentication**: JWT with OAuth2
- **AI Framework**: CrewAI
- **Vector DB**: ChromaDB
- **LLM**: Ollama (local)

### Frontend
- **Framework**: React.js
- **State Management**: Redux
- **Styling**: CSS

## Installation

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Activate virtual environment:
```bash
# Windows
..\crewai_env\Scripts\activate

# Linux/Mac
source ../crewai_env/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python main.py
```

The API will be available at `http://localhost:8000`
API Documentation: `http://localhost:8000/docs`

### Default Users

**Admin:**
- Email: admin@agenthealth.com
- Password: admin123

**Doctor:**
- Email: doctor@agenthealth.com
- Password: doctor123

## API Endpoints

### Authentication
- `POST /auth/signup` - Patient registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user

### Admin (Admin only)
- `POST /admin/doctors` - Create doctor account
- `GET /admin/doctors` - List all doctors
- `PUT /admin/doctors/{id}/activate` - Activate doctor
- `PUT /admin/doctors/{id}/deactivate` - Deactivate doctor
- `GET /admin/patients` - List all patients
- `GET /admin/users` - List all users

### Patients
- `GET /patients/` - List patients (Admin/Doctor)
- `GET /patients/{id}` - Get patient by ID
- `POST /patients/register` - Doctor creates patient account
- `GET /patients/search` - Search patients
- `GET /patients/me` - Get own patient profile
- `PUT /patients/{id}` - Update patient

## Project Structure

```
final/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   └── emergency_detection_agent.py
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── admin.py
│   │   │       └── patients.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   ├── models.py
│   │   │   └── init_db.py
│   │   └── schemas/
│   │       └── __init__.py
│   ├── main.py
│   └── requirements.txt
├── crewai_env/
└── .env
```

## Security Features

- ✅ JWT token-based authentication
- ✅ Password hashing with bcrypt
- ✅ Role-based access control
- ✅ Secure password storage
- ✅ CORS configuration
- ✅ HIPAA-ready audit logging

## Development

### Running in Development Mode

```bash
# Backend
cd backend
python main.py

# Or with uvicorn for auto-reload
uvicorn main:app --reload
```

### Testing API

Visit `http://localhost:8000/docs` for interactive API documentation (Swagger UI)

## License

MIT License

## Support

For issues and questions, please create an issue in the repository.
