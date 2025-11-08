from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from typing import List, Optional
import json
import uuid
from datetime import datetime

from src.models import Student, Preset, Note, get_all_seat_ids
from src.storage import storage

router = APIRouter(prefix="/api")


# ==================== App State ====================

@router.get("/state")
async def get_state():
    """Get complete application state"""
    state = storage.get_app_state()
    return state.dict()


# ==================== Students ====================

@router.get("/students")
async def get_students():
    """Get all students"""
    students = storage.load_students()
    return [s.dict() for s in students]


@router.post("/students")
async def create_student(name: str):
    """Create a new student and auto-assign to first empty seat if available"""
    students = storage.load_students()
    presets, current_preset_id = storage.load_presets()

    # Check for duplicate names (normalized)
    normalized = name.strip().lower().replace('\u3000', ' ')
    for student in students:
        existing_normalized = student.name.strip().lower().replace('\u3000', ' ')
        if normalized == existing_normalized:
            raise HTTPException(400, "Student name already exists")

    # Create student
    new_student = Student(
        id=str(uuid.uuid4()),
        name=name.strip(),
        score=0,
        notes=[]
    )
    students.append(new_student)
    storage.save_students(students)

    # Auto-assign to first empty seat in current preset
    if current_preset_id:
        current_preset = next((p for p in presets if p.id == current_preset_id), None)
        if current_preset:
            occupied_seats = set(current_preset.mapping.keys())
            all_seats = get_all_seat_ids()
            empty_seats = sorted(all_seats - occupied_seats)

            if empty_seats:
                # Assign to first empty seat
                first_empty = empty_seats[0]
                current_preset.mapping[first_empty] = new_student.id
                storage.save_presets(presets, current_preset_id)

    return new_student.dict()


@router.put("/students/{student_id}")
async def update_student(student_id: str, student: Student):
    """Update student data"""
    if student_id != student.id:
        raise HTTPException(400, "Student ID mismatch")

    students = storage.load_students()
    idx = next((i for i, s in enumerate(students) if s.id == student_id), None)

    if idx is None:
        raise HTTPException(404, "Student not found")

    # Check for duplicate names (excluding self)
    normalized = student.name.strip().lower().replace('\u3000', ' ')
    for i, s in enumerate(students):
        if i != idx:
            existing_normalized = s.name.strip().lower().replace('\u3000', ' ')
            if normalized == existing_normalized:
                raise HTTPException(400, "Student name already exists")

    students[idx] = student
    storage.save_students(students)
    return student.dict()


@router.delete("/students/{student_id}")
async def delete_student(student_id: str):
    """Delete a student and remove from all presets"""
    students = storage.load_students()
    students = [s for s in students if s.id != student_id]
    storage.save_students(students)

    # Remove from all preset mappings
    presets, current_preset_id = storage.load_presets()
    for preset in presets:
        preset.mapping = {k: v for k, v in preset.mapping.items() if v != student_id}
    storage.save_presets(presets, current_preset_id)

    return {"success": True}


# ==================== Presets ====================

@router.get("/presets")
async def get_presets():
    """Get all presets and current preset ID"""
    presets, current_preset_id = storage.load_presets()
    return {
        "presets": [p.dict() for p in presets],
        "current_preset_id": current_preset_id
    }


@router.post("/presets")
async def create_preset(name: str, copy_current: bool = False):
    """Create a new preset, optionally copying current layout"""
    presets, current_preset_id = storage.load_presets()

    new_preset = Preset(
        id=str(uuid.uuid4()),
        name=name,
        mapping={}
    )

    if copy_current and current_preset_id:
        current = next((p for p in presets if p.id == current_preset_id), None)
        if current:
            new_preset.mapping = current.mapping.copy()

    presets.append(new_preset)
    storage.save_presets(presets, current_preset_id)
    return new_preset.dict()


@router.put("/presets/{preset_id}")
async def update_preset(preset_id: str, preset: Preset):
    """Update preset (including mapping)"""
    if preset_id != preset.id:
        raise HTTPException(400, "Preset ID mismatch")

    students = storage.load_students()
    presets, current_preset_id = storage.load_presets()

    idx = next((i for i, p in enumerate(presets) if p.id == preset_id), None)
    if idx is None:
        raise HTTPException(404, "Preset not found")

    # Validate consistency
    is_valid, error = storage.validate_consistency(students, [preset], current_preset_id)
    if not is_valid:
        raise HTTPException(400, error)

    presets[idx] = preset
    storage.save_presets(presets, current_preset_id)
    return preset.dict()


@router.delete("/presets/{preset_id}")
async def delete_preset(preset_id: str):
    """Delete a preset (cannot delete if it's the only one)"""
    presets, current_preset_id = storage.load_presets()

    if len(presets) <= 1:
        raise HTTPException(400, "Cannot delete the only preset")

    presets = [p for p in presets if p.id != preset_id]

    # If deleted preset was current, switch to first preset
    if current_preset_id == preset_id:
        current_preset_id = presets[0].id

    storage.save_presets(presets, current_preset_id)
    return {"success": True}


@router.post("/presets/switch/{preset_id}")
async def switch_preset(preset_id: str):
    """Switch to a different preset"""
    presets, current_preset_id = storage.load_presets()

    if not any(p.id == preset_id for p in presets):
        raise HTTPException(404, "Preset not found")

    storage.save_presets(presets, preset_id)
    return {"success": True, "current_preset_id": preset_id}


# ==================== Import/Export ====================

@router.get("/export/students.json")
async def export_students():
    """Export students as JSON"""
    students = storage.load_students()
    data = [s.dict() for s in students]
    return JSONResponse(content=data)


@router.get("/export/presets.json")
async def export_presets():
    """Export presets as JSON"""
    presets, current_preset_id = storage.load_presets()
    data = {
        "presets": [p.dict() for p in presets],
        "current_preset_id": current_preset_id
    }
    return JSONResponse(content=data)


@router.post("/import/students")
async def import_students(file: UploadFile = File(...)):
    """Import students from JSON (replaces all students)"""
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))

        # Validate structure
        if not isinstance(data, list):
            raise HTTPException(400, "Invalid format: expected array of students")

        students = [Student(**s) for s in data]

        # Validate consistency
        presets, current_preset_id = storage.load_presets()
        is_valid, error = storage.validate_consistency(students, presets, current_preset_id)
        if not is_valid:
            raise HTTPException(400, f"Validation failed: {error}")

        storage.save_students(students)
        return {"success": True, "count": len(students)}

    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON format")
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/import/presets")
async def import_presets(file: UploadFile = File(...)):
    """Import presets from JSON (replaces all presets)"""
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))

        # Validate structure
        if not isinstance(data, dict) or "presets" not in data:
            raise HTTPException(400, "Invalid format: expected {presets: [...], current_preset_id: ...}")

        presets = [Preset(**p) for p in data["presets"]]
        current_preset_id = data.get("current_preset_id")

        # Validate consistency
        students = storage.load_students()
        is_valid, error = storage.validate_consistency(students, presets, current_preset_id)
        if not is_valid:
            raise HTTPException(400, f"Validation failed: {error}")

        storage.save_presets(presets, current_preset_id)
        return {"success": True, "count": len(presets)}

    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON format")
    except Exception as e:
        raise HTTPException(400, str(e))
