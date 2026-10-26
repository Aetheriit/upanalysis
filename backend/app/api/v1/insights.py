"""AI assistance behind the application's authenticated server proxy."""
import asyncio
import hashlib
import secrets
from typing import Literal
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.assistant import answer_question, runtime_config, usage_status

router = APIRouter()

def require_ai_proxy(authorization: str = Header(default='')):
    token = runtime_config()['proxy_token']
    if not token or not secrets.compare_digest(authorization, 'Bearer '+token):
        raise HTTPException(403, 'Use the signed-in application to access AI assistance.')

class Message(BaseModel):
    model_config = ConfigDict(extra='forbid')
    role: Literal['user','assistant']
    content: str = Field(min_length=1,max_length=1600)

class ChatRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    query: str = Field(min_length=2,max_length=1500)
    election_year: Literal[2017,2022] = 2022
    history: list[Message] = Field(default_factory=list,max_length=6)

@router.get('/status', dependencies=[Depends(require_ai_proxy)])
async def ai_status():
    return await asyncio.to_thread(usage_status)

@router.post('/chat', dependencies=[Depends(require_ai_proxy)])
async def chat_with_ai(payload: ChatRequest, db: AsyncSession = Depends(get_db), x_ai_client: str = Header(default='application')):
    return await answer_question(db,payload.query,[item.model_dump() for item in payload.history],payload.election_year,'chat',hashlib.sha256(x_ai_client[:200].encode()).hexdigest())

@router.post('/gis', dependencies=[Depends(require_ai_proxy)])
async def gis_with_ai(payload: ChatRequest, db: AsyncSession = Depends(get_db), x_ai_client: str = Header(default='application')):
    return await answer_question(db,payload.query,[item.model_dump() for item in payload.history],payload.election_year,'gis',hashlib.sha256(x_ai_client[:200].encode()).hexdigest())
