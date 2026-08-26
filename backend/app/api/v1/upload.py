"""File upload endpoints."""
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

router = APIRouter()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
):
    """Upload an election data file (CSV, Excel, JSON)."""
    # Validate file type
    allowed_types = {
        "text/csv": "csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
        "application/vnd.ms-excel": "excel",
        "application/json": "json",
    }
    
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ("csv", "xlsx", "xls", "json"):
        raise HTTPException(400, f"Unsupported file type: {ext}. Use CSV, Excel, or JSON.")
    
    # Save file
    file_id = str(uuid.uuid4())
    saved_filename = f"{file_id}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, saved_filename)
    
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Auto-detect schema
    schema = await detect_schema(filepath, ext)
    
    return {
        "id": file_id,
        "filename": saved_filename,
        "original_filename": file.filename,
        "file_type": ext,
        "file_size": len(content),
        "status": "uploaded",
        "detected_schema": schema,
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
async def list_files():
    """List all uploaded files."""
    files = []
    if os.path.exists(UPLOAD_DIR):
        for f in os.listdir(UPLOAD_DIR):
            filepath = os.path.join(UPLOAD_DIR, f)
            files.append({
                "filename": f,
                "size": os.path.getsize(filepath),
                "created": datetime.fromtimestamp(os.path.getctime(filepath)).isoformat(),
            })
    return {"files": files}
