from app.db.models import HealthReport
from typing import Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ReportService:
    """Service for generating health reports and analytics"""

    @staticmethod
    def generate_health_summary(db: Any, patient_id: str) -> dict:
        """
        Generate a comprehensive health summary for a patient.

        Args:
            db: Firestore client
            patient_id: Patient ID

        Returns:
            Health summary report data
        """
        try:
            patient_doc = db.collection("patients").document(patient_id).get()
            if not patient_doc.exists:
                raise ValueError("Patient not found")

            patient = patient_doc.to_dict()

            # Fetch user for name
            user_doc = db.collection("users").document(patient.get("user_id", "")).get()
            patient_name = user_doc.to_dict().get("full_name", "Unknown") if user_doc.exists else "Unknown"

            # Get recent medical records
            records_docs = db.collection("medical_records")\
                .where("patient_id", "==", patient_id)\
                .order_by("visit_date", direction="DESCENDING")\
                .limit(10).stream()

            recent_records = [d.to_dict() for d in records_docs]

            summary = {
                "patient_info": {
                    "patient_id": patient_doc.id,
                    "name": patient_name,
                    "date_of_birth": str(patient.get("date_of_birth")) if patient.get("date_of_birth") else None,
                    "age": ReportService._calculate_age(patient.get("date_of_birth")),
                    "gender": patient.get("gender"),
                    "blood_type": patient.get("blood_type")
                },
                "medical_history": {
                    "conditions": patient.get("medical_history") or [],
                    "allergies": patient.get("allergies") or [],
                    "current_medications": patient.get("current_medications") or []
                },
                "recent_visits": [
                    {
                        "date": str(record.get("visit_date")),
                        "chief_complaint": record.get("chief_complaint"),
                        "diagnosis": record.get("diagnosis"),
                        "treatment": record.get("treatment_plan")
                    }
                    for record in recent_records
                ],
                "vital_trends": ReportService._analyze_vital_trends(recent_records),
                "health_metrics": ReportService._calculate_health_metrics(patient, recent_records),
                "generated_at": datetime.utcnow().isoformat()
            }

            return summary

        except Exception as e:
            logger.error(f"Error generating health summary: {e}")
            raise

    @staticmethod
    def create_health_report(db: Any, patient_id: str, report_type: str = "summary") -> dict:
        """
        Create and save a health report.

        Args:
            db: Firestore client
            patient_id: Patient ID
            report_type: Type of report

        Returns:
            Created health report data dict
        """
        try:
            report_data = ReportService.generate_health_summary(db, patient_id)

            health_report = HealthReport(
                patient_id=patient_id,
                report_type=report_type,
                report_data=report_data
            )
            doc_ref = db.collection("health_reports").document()
            doc_ref.set(health_report.to_firestore())

            logger.info(f"Created {report_type} health report for patient {patient_id}")
            data = health_report.to_firestore()
            data['id'] = doc_ref.id
            return data

        except Exception as e:
            logger.error(f"Error creating health report: {e}")
            raise

    @staticmethod
    def _calculate_age(date_of_birth) -> int:
        """Calculate age from date of birth"""
        if not date_of_birth:
            return None
        try:
            today = datetime.now()
            if isinstance(date_of_birth, str):
                date_of_birth = datetime.fromisoformat(date_of_birth)
            age = today.year - date_of_birth.year
            if today.month < date_of_birth.month or (
                today.month == date_of_birth.month and today.day < date_of_birth.day
            ):
                age -= 1
            return age
        except Exception:
            return None

    @staticmethod
    def _analyze_vital_trends(medical_records: list) -> dict:
        """Analyze trends in vital signs"""
        trends = {
            "blood_pressure": [],
            "heart_rate": [],
            "temperature": [],
            "note": "Vital trends analysis"
        }

        for record in medical_records:
            vitals = record.get("vitals") or {}
            visit_date = str(record.get("visit_date", ""))
            if "blood_pressure" in vitals:
                trends["blood_pressure"].append({"date": visit_date, "value": vitals["blood_pressure"]})
            if "heart_rate" in vitals:
                trends["heart_rate"].append({"date": visit_date, "value": vitals["heart_rate"]})
            if "temperature" in vitals:
                trends["temperature"].append({"date": visit_date, "value": vitals["temperature"]})

        return trends

    @staticmethod
    def _calculate_health_metrics(patient: dict, medical_records: list) -> dict:
        """Calculate health metrics and risk scores"""
        metrics = {
            "total_visits": len(medical_records),
            "chronic_conditions": len(patient.get("medical_history") or []),
            "active_medications": len(patient.get("current_medications") or []),
            "allergy_count": len(patient.get("allergies") or []),
            "risk_assessment": "Low"  # TODO: Implement AI-powered risk assessment
        }

        if metrics["chronic_conditions"] > 3:
            metrics["risk_assessment"] = "High"
        elif metrics["chronic_conditions"] > 1:
            metrics["risk_assessment"] = "Medium"

        return metrics

    @staticmethod
    def _generate_pdf(health_report: dict) -> str:
        """Generate PDF version of health report. (TODO: Implement PDF generation)"""
        logger.warning("PDF generation not yet implemented")
        return None


# Create singleton instance
report_service = ReportService()
