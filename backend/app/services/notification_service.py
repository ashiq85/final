import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.db.models import Notification
from typing import Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing notifications and email delivery"""
    
    @staticmethod
    def create_notification(
        db: Any,
        user_id: str,
        notification_type: str,
        title: str,
        message: str,
        appointment_id: Optional[str] = None
    ) -> dict:
        """
        Create a notification for a user.

        Args:
            db: Firestore client
            user_id: User ID
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            appointment_id: Optional appointment ID

        Returns:
            Created notification data dict
        """
        try:
            notification = Notification(
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                appointment_id=appointment_id
            )
            doc_ref = db.collection("notifications").document()
            doc_ref.set(notification.to_firestore())
            data = notification.to_firestore()
            data['id'] = doc_ref.id
            logger.info(f"Created {notification_type} notification for user {user_id}")
            return data

        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            raise
    
    @staticmethod
    def get_user_notifications(db: Any, user_id: str, unread_only: bool = False) -> list:
        """Get notifications for a user"""
        query = db.collection("notifications").where("user_id", "==", user_id)
        if unread_only:
            query = query.where("is_read", "==", False)
        docs = query.order_by("created_at", direction="DESCENDING").stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            results.append(data)
        return results

    @staticmethod
    def mark_as_read(db: Any, notification_id: str) -> dict:
        """Mark a notification as read"""
        try:
            doc_ref = db.collection("notifications").document(notification_id)
            doc = doc_ref.get()
            if not doc.exists:
                raise ValueError("Notification not found")
            doc_ref.update({"is_read": True})
            data = doc.to_dict()
            data['id'] = doc.id
            data['is_read'] = True
            return data

        except Exception as e:
            logger.error(f"Error marking notification as read: {e}")
            raise
    
    @staticmethod
    def send_appointment_reminder(db: Any, appointment_id: str):
        """Send appointment reminder notification"""
        try:
            apt_doc = db.collection("appointments").document(appointment_id).get()
            if not apt_doc.exists:
                return
            apt = apt_doc.to_dict()

            patient_doc = db.collection("patients").document(apt.get("patient_id", "")).get()
            if not patient_doc.exists:
                return
            patient = patient_doc.to_dict()

            user_doc = db.collection("users").document(patient.get("user_id", "")).get()
            if not user_doc.exists:
                return
            user = user_doc.to_dict()

            apt_date = apt.get("appointment_date", "")
            NotificationService.create_notification(
                db=db,
                user_id=patient.get("user_id"),
                notification_type="appointment_reminder",
                title="Appointment Reminder",
                message=f"You have an appointment on {apt_date}",
                appointment_id=appointment_id
            )

            send_email_notification(
                to_email=user.get("email", ""),
                subject="Appointment Reminder - AgentHealth",
                body=f"Dear {user.get('full_name', '')},\n\n"
                     f"This is a reminder of your upcoming appointment:\n"
                     f"Date: {apt_date}\n"
                     f"Reason: {apt.get('reason') or 'General checkup'}\n\n"
                     f"Please arrive 10 minutes early.\n\nBest regards,\nAgentHealth Team"
            )
            logger.info(f"Sent appointment reminder for appointment {appointment_id}")

        except Exception as e:
            logger.error(f"Error sending appointment reminder: {e}")


def send_email_notification(to_email: str, subject: str, body: str) -> bool:
    """
    Send email notification (placeholder implementation).
    
    In production, this should use a proper email service like SendGrid, AWS SES, etc.
    For now, this just logs the email.
    
    Args:
        to_email: Recipient email
        subject: Email subject
        body: Email body
    
    Returns:
        Success status
    """
    try:
        logger.info(f"EMAIL NOTIFICATION:")
        logger.info(f"To: {to_email}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Body: {body}")
        logger.info("=" * 50)
        
        # TODO: Implement actual email sending
        # Example with SMTP:
        # msg = MIMEMultipart()
        # msg['From'] = "noreply@agenthealth.com"
        # msg['To'] = to_email
        # msg['Subject'] = subject
        # msg.attach(MIMEText(body, 'plain'))
        # 
        # server = smtplib.SMTP('smtp.gmail.com', 587)
        # server.starttls()
        # server.login("your-email@gmail.com", "your-password")
        # server.send_message(msg)
        # server.quit()
        
        return True
    
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        return False


# Create singleton instance
notification_service = NotificationService()
