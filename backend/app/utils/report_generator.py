from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
import os

def generate_patient_report_pdf(report_data: dict, output_path: str):
    """Generate a medical health report PDF using reportlab"""
    doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph(f"Health Summary Report", styles['Title']))
    story.append(Spacer(1, 12))

    # Patient Info
    pi = report_data.get("patient_info", {})
    story.append(Paragraph(f"<b>Patient:</b> {pi.get('name', 'N/A')}", styles['Normal']))
    story.append(Paragraph(f"<b>DOB:</b> {pi.get('date_of_birth', 'N/A')}", styles['Normal']))
    story.append(Paragraph(f"<b>Blood Type:</b> {pi.get('blood_type', 'N/A')}", styles['Normal']))
    story.append(Spacer(1, 12))

    # Medical History Section
    story.append(Paragraph("<b>Medical History</b>", styles['Heading2']))
    history = report_data.get("medical_history", [])
    if history:
        for item in history:
            story.append(Paragraph(f"• {item}", styles['Normal']))
    else:
        story.append(Paragraph("No medical history records available.", styles['Normal']))
    story.append(Spacer(1, 12))

    # AI Insights Section
    if "ai_insights" in report_data:
        story.append(Paragraph("<b>Insights from Documents (AI Synthesis)</b>", styles['Heading2']))
        insights_text = report_data["ai_insights"]
        story.append(Paragraph(f"<i>{insights_text}</i>", styles['BodyText']))
        story.append(Spacer(1, 12))

    # Health Metrics Section
    metrics = report_data.get("health_metrics", [])
    if metrics:
        story.append(Paragraph("<b>Health Metrics & Vital Trends</b>", styles['Heading2']))
        m_data = [["Date", "Metric", "Value", "Notes"]]
        for m in metrics:
            # Use Paragraph for notes to allow wrapping
            note_para = Paragraph(m.get('notes', '') or '-', styles['Normal'])
            m_data.append([
                m.get('recorded_at', 'N/A')[:10],
                m.get('metric', 'N/A'),
                f"{m.get('value', 'N/A')} {m.get('unit', '')}",
                note_para
            ])
        
        mt = Table(m_data, colWidths=[70, 100, 80, 230])
        mt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.cadetblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(mt)
        story.append(Spacer(1, 12))

    # Recent Visits
    story.append(Paragraph("<b>Recent Clinical Visits</b>", styles['Heading2']))
    visits = report_data.get("recent_visits", [])
    if visits:
        data = [["Date", "Diagnosis", "Treatment"]]
        for v in visits:
            # Use Paragraphs for wrapping in columns
            diag_para = Paragraph(v.get('diagnosis', 'N/A'), styles['Normal'])
            treat_para = Paragraph(v.get('treatment', 'N/A'), styles['Normal'])
            data.append([
                v.get('date', 'N/A')[:10], 
                diag_para, 
                treat_para
            ])
        
        t = Table(data, colWidths=[70, 170, 240])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("No recent visits recorded.", styles['Normal']))

    # Final footer
    story.append(Spacer(1, 48))
    story.append(Paragraph(f"Report generated on: {report_data.get('generated_at', 'N/A')}", styles['Normal']))
    story.append(Paragraph("<i>This is an AI-assisted medical report synthesized from vectorized documents and clinical data. Please consult with a healthcare professional for clinical decisions.</i>", styles['Normal']))

    doc.build(story)
    return output_path
