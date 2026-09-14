"""Setting model — stores application and user preferences."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Uuid
from app.core.database import Base

class UserSetting(Base):
    __tablename__ = "settings"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Profile
    display_name = Column(String(255), default="Shivam Kumar")
    email = Column(String(255), default="shivam@electionintel.in")
    role = Column(String(255), default="Senior Analyst")
    organization = Column(String(255), default="ElectionIntel Research")
    
    # Appearance
    theme = Column(String(50), default="System")
    sidebar_default = Column(String(50), default="Expanded")
    chart_color_scheme = Column(String(50), default="Party Colors")
    font_size = Column(String(50), default="Medium")
    
    # Notifications
    email_notifications = Column(Boolean, default=True)
    alert_notifications = Column(Boolean, default=True)
    weekly_report_digest = Column(Boolean, default=False)
    data_sync_alerts = Column(Boolean, default=True)
    
    # Security
    two_factor_authentication = Column(Boolean, default=True)
    session_timeout = Column(String(50), default="30 minutes")
    api_key = Column(String(255), default="sk-••••••••••••")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "displayName": self.display_name,
            "email": self.email,
            "role": self.role,
            "organization": self.organization,
            "theme": self.theme,
            "sidebarDefault": self.sidebar_default,
            "chartColorScheme": self.chart_color_scheme,
            "fontSize": self.font_size,
            "emailNotifications": self.email_notifications,
            "alertNotifications": self.alert_notifications,
            "weeklyReportDigest": self.weekly_report_digest,
            "dataSyncAlerts": self.data_sync_alerts,
            "twoFactorAuthentication": self.two_factor_authentication,
            "sessionTimeout": self.session_timeout,
            "apiKey": self.api_key
        }
