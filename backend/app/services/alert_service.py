from app.db.models import Alert, AlertSeverity, AppointmentStatus
from app.services.notification_service import send_email_notification
from typing import Any, Optional, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class AlertService:
    """Service for managing health alerts and emergency detection"""

    @staticmethod
    def create_alert(
        db: Any,
        patient_id: str,
        severity: AlertSeverity,
        title: str,
        description: str,
        recommended_actions: list = None,
        auto_book_appointment: bool = False
    ) -> dict:
        """
        Create a health alert for a patient.

        Args:
            db: Firestore client
            patient_id: Patient ID
            severity: Alert severity level
            title: Alert title
            description: Alert description
            recommended_actions: List of recommended actions
            auto_book_appointment: Whether to auto-book an appointment for critical alerts

        Returns:
            Created alert data dict
        """
        try:
            alert = Alert(
                patient_id=patient_id,
                severity=severity,
                title=title,
                description=description,
                recommended_actions=recommended_actions or []
            )
            doc_ref = db.collection("alerts").document()
            doc_ref.set(alert.to_firestore())
            alert_id = doc_ref.id

            logger.info(f"Created {severity} alert for patient {patient_id}")

            # Send notification based on severity
            patient_doc = db.collection("patients").document(patient_id).get()
            if patient_doc.exists:
                patient = patient_doc.to_dict()
                user_doc = db.collection("users").document(patient.get("user_id", "")).get()
                if user_doc.exists:
                    user = user_doc.to_dict()
                    if severity in [AlertSeverity.CRITICAL, AlertSeverity.HIGH]:
                        send_email_notification(
                            to_email=user.get("email", ""),
                            subject=f"URGENT: {title}",
                            body=f"{description}\n\nRecommended Actions:\n" +
                                 "\n".join(f"- {action}" for action in (recommended_actions or []))
                        )
                        if severity == AlertSeverity.CRITICAL and patient.get("emergency_contact"):
                            logger.info(f"Emergency contact notification needed for patient {patient_id}")

            # Auto-book appointment for critical cases
            if auto_book_appointment and severity == AlertSeverity.CRITICAL:
                AlertService._auto_book_emergency_appointment(db, patient_id, alert_id)

            data = alert.to_firestore()
            data['id'] = alert_id
            return data

        except Exception as e:
            logger.error(f"Error creating alert: {e}")
            raise

    @staticmethod
    def _auto_book_emergency_appointment(db: Any, patient_id: str, alert_id: str):
        """Auto-book an emergency appointment"""
        try:
            from app.db.models import Appointment, User, UserRole
            # Find first available active doctor
            docs = db.collection("users")\
                .where("role", "==", UserRole.DOCTOR)\
                .where("is_active", "==", True)\
                .limit(1).stream()
            doctor_doc = None
            for d in docs:
                doctor_doc = d
            if not doctor_doc:
                return

            appointment_time = datetime.now() + timedelta(hours=2)
            appointment = Appointment(
                patient_id=patient_id,
                doctor_id=doctor_doc.id,
                appointment_date=appointment_time,
                duration_minutes=30,
                status=AppointmentStatus.SCHEDULED,
                reason="Emergency - Auto-booked due to critical alert",
                notes=f"Auto-booked for alert ID: {alert_id}"
            )
            db.collection("appointments").document().set(appointment.to_firestore())
            logger.info(f"Auto-booked emergency appointment for patient {patient_id}")

        except Exception as e:
            logger.error(f"Error auto-booking appointment: {e}")

    @staticmethod
    def get_patient_alerts(db: Any, patient_id: str, active_only: bool = True) -> list:
        """Get alerts for a patient"""
        query = db.collection("alerts").where("patient_id", "==", patient_id)
        if active_only:
            query = query.where("is_resolved", "==", False)
        docs = query.order_by("created_at", direction="DESCENDING").stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            results.append(data)
        return results

    @staticmethod
    def resolve_alert(db: Any, alert_id: str) -> dict:
        """Mark an alert as resolved"""
        try:
            doc_ref = db.collection("alerts").document(alert_id)
            doc = doc_ref.get()
            if not doc.exists:
                raise ValueError("Alert not found")

            doc_ref.update({
                "is_resolved": True,
                "resolved_at": datetime.utcnow()
            })
            data = doc.to_dict()
            data['id'] = doc.id
            data['is_resolved'] = True
            logger.info(f"Resolved alert {alert_id}")
            return data

        except Exception as e:
            logger.error(f"Error resolving alert: {e}")
            raise

    @staticmethod
    def detect_emergency(symptoms: list, vitals: dict = None) -> dict:
        """
        Detect emergency conditions from symptoms and vitals.

        Args:
            symptoms: List of symptoms
            vitals: Vital signs dictionary

        Returns:
            Emergency detection result
        """
        from app.agents.emergency_detection_agent import (
            detect_stroke_symptoms,
            detect_heart_attack,
            detect_cardiac_emergency
        )

        results = {
            "is_emergency": False,
            "detected_conditions": [],
            "emergency_actions": [],
            "severity": "LOW"
        }

        stroke_result = detect_stroke_symptoms(symptoms, vitals or {})
        if stroke_result["is_emergency"]:
            results["is_emergency"] = True
            results["detected_conditions"].append(stroke_result["condition"])
            results["emergency_actions"].extend(stroke_result["emergency_actions"])
            results["severity"] = "CRITICAL"

        heart_attack_result = detect_heart_attack(symptoms, vitals or {})
        if heart_attack_result["is_emergency"]:
            results["is_emergency"] = True
            results["detected_conditions"].append(heart_attack_result["condition"])
            results["emergency_actions"].extend(heart_attack_result["emergency_actions"])
            results["severity"] = "CRITICAL"

        if vitals:
            cardiac_result = detect_cardiac_emergency(vitals)
            if cardiac_result["is_emergency"]:
                results["is_emergency"] = True
                results["detected_conditions"].append(cardiac_result["condition"])
                results["emergency_actions"].extend(cardiac_result["emergency_actions"])
                results["severity"] = "CRITICAL"

        return results


# Create singleton instance
alert_service = AlertService()
