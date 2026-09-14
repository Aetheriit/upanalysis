from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.setting import UserSetting

router = APIRouter()

class SettingsUpdate(BaseModel):
    displayName: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    organization: Optional[str] = None
    theme: Optional[str] = None
    sidebarDefault: Optional[str] = None
    chartColorScheme: Optional[str] = None
    fontSize: Optional[str] = None
    emailNotifications: Optional[bool] = None
    alertNotifications: Optional[bool] = None
    weeklyReportDigest: Optional[bool] = None
    dataSyncAlerts: Optional[bool] = None
    twoFactorAuthentication: Optional[bool] = None
    sessionTimeout: Optional[str] = None
    apiKey: Optional[str] = None

@router.get("/")
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Fetch global application settings. Creates default if none exist."""
    result = await db.execute(select(UserSetting).limit(1))
    setting = result.scalars().first()
    
    if not setting:
        setting = UserSetting()
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
        
    return setting.to_dict()

@router.put("/")
async def update_settings(payload: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    """Update the global application settings."""
    result = await db.execute(select(UserSetting).limit(1))
    setting = result.scalars().first()
    
    if not setting:
        setting = UserSetting()
        db.add(setting)
        
    update_data = payload.dict(exclude_unset=True)
    
    # Map frontend camelCase to snake_case backend fields
    field_mapping = {
        "displayName": "display_name",
        "email": "email",
        "role": "role",
        "organization": "organization",
        "theme": "theme",
        "sidebarDefault": "sidebar_default",
        "chartColorScheme": "chart_color_scheme",
        "fontSize": "font_size",
        "emailNotifications": "email_notifications",
        "alertNotifications": "alert_notifications",
        "weeklyReportDigest": "weekly_report_digest",
        "dataSyncAlerts": "data_sync_alerts",
        "twoFactorAuthentication": "two_factor_authentication",
        "sessionTimeout": "session_timeout",
        "apiKey": "api_key"
    }
    
    for key, value in update_data.items():
        if key in field_mapping:
            setattr(setting, field_mapping[key], value)
            
    await db.commit()
    await db.refresh(setting)
    
    return setting.to_dict()
