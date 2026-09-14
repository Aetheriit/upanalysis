"""File upload endpoints."""
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from app.core.database import get_db
from app.models.project import Project
from app.models.upload import UploadedFile

router = APIRouter()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Upload an election data file (CSV, Excel, JSON)."""
    # Validate file type
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ("csv", "xlsx", "xls", "json"):
        raise HTTPException(400, f"Unsupported file type: {ext}. Use CSV, Excel, or JSON.")
    
    # Check for or create default project
    if not project_id:
        result = await db.execute(select(Project).limit(1))
        project = result.scalars().first()
        if not project:
            project = Project(name="Master Project", description="Auto-generated default project")
            db.add(project)
            await db.commit()
            await db.refresh(project)
        project_id = str(project.id)
    
    # Save file
    file_id = str(uuid.uuid4())
    saved_filename = f"{file_id}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, saved_filename)
    
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Auto-detect schema
    schema = await detect_schema(filepath, ext)
    
    # Save to database
    uploaded_file = UploadedFile(
        id=uuid.UUID(file_id),
        project_id=uuid.UUID(project_id),
        filename=saved_filename,
        original_filename=file.filename,
        file_type=ext,
        file_size=len(content),
        status="imported",
        rows_count=schema.get("rows", 0),
        columns_count=schema.get("total_columns", 0),
        detected_schema=schema,
        processed_at=datetime.utcnow()
    )
    db.add(uploaded_file)
    await db.commit()
    await db.refresh(uploaded_file)
    
    return {
        "id": str(uploaded_file.id),
        "filename": uploaded_file.original_filename,
        "file_type": uploaded_file.file_type,
        "file_size": uploaded_file.file_size,
        "status": uploaded_file.status,
        "detected_schema": uploaded_file.detected_schema,
        "rows_count": uploaded_file.rows_count,
        "created_at": uploaded_file.created_at.isoformat()
    }

async def detect_schema(filepath: str, file_type: str) -> dict:
    """Auto-detect column types from uploaded file."""
    try:
        import polars as pl
        
        if file_type == "csv":
            df = pl.read_csv(filepath, n_rows=100)
        elif file_type in ("xlsx", "xls"):
            df = pl.read_excel(filepath, engine="openpyxl")
            df = df.head(100)
        elif file_type == "json":
            df = pl.read_json(filepath)
            df = df.head(100)
        else:
            return {"columns": [], "rows": 0, "mapping": {}}
        
        columns = []
        mapping = {}
        
        # Column type detection heuristics
        constituency_keywords = ["constituency", "ac_name", "assembly", "pc_name", "parliament"]
        booth_keywords = ["booth", "polling", "station", "ps_no"]
        candidate_keywords = ["candidate", "cand_name", "contestant"]
        party_keywords = ["party", "party_name", "party_abbr"]
        votes_keywords = ["votes", "vote", "total_votes", "votes_received", "electors"]
        year_keywords = ["year", "election_year"]
        
        for col in df.columns:
            col_lower = col.lower().strip()
            dtype = str(df[col].dtype)
            sample_values = df[col].head(5).to_list()
            
            detected_type = "unknown"
            if any(k in col_lower for k in constituency_keywords):
                detected_type = "constituency"
            elif any(k in col_lower for k in booth_keywords):
                detected_type = "booth"
            elif any(k in col_lower for k in candidate_keywords):
                detected_type = "candidate"
            elif any(k in col_lower for k in party_keywords):
                detected_type = "party"
            elif any(k in col_lower for k in votes_keywords):
                detected_type = "votes"
            elif any(k in col_lower for k in year_keywords):
                detected_type = "year"
            elif "state" in col_lower:
                detected_type = "state"
            elif "district" in col_lower:
                detected_type = "district"
            elif "gender" in col_lower or "sex" in col_lower:
                detected_type = "gender"
            elif "age" in col_lower:
                detected_type = "age"
            elif "turnout" in col_lower:
                detected_type = "turnout"
            elif "margin" in col_lower:
                detected_type = "margin"
            elif "nota" in col_lower:
                detected_type = "nota"
            
            if detected_type != "unknown":
                mapping[col] = detected_type
            
            columns.append({
                "name": col,
                "dtype": dtype,
                "detected_type": detected_type,
                "sample": [str(v) for v in sample_values[:3]],
                "null_count": df[col].null_count(),
            })
        
        return {
            "columns": columns,
            "rows": len(df),
            "total_columns": len(df.columns),
            "mapping": mapping,
        }
    except Exception as e:
        return {"error": str(e), "columns": [], "rows": 0, "mapping": {}}


@router.get("/files")
async def list_files(db: AsyncSession = Depends(get_db)):
    """List all uploaded files from the database."""
    result = await db.execute(
        select(UploadedFile).order_by(UploadedFile.created_at.desc())
    )
    files = result.scalars().all()
    
    return {
        "files": [
            {
                "id": str(f.id),
                "filename": f.original_filename,
                "size": f.file_size,
                "status": f.status,
                "rows_count": f.rows_count,
                "created": f.created_at.isoformat(),
            }
            for f in files
        ]
    }
