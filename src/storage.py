import json
import os
import threading
from pathlib import Path
from typing import List, Optional
from src.models import Student, Preset, AppState, get_all_seat_ids
import uuid


class Storage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.students_file = self.data_dir / "students.json"
        self.presets_file = self.data_dir / "presets.json"
        self.lock = threading.Lock()

        # Initialize default files if they don't exist
        self._initialize_files()

    def _initialize_files(self):
        """Create default JSON files if they don't exist"""
        if not self.students_file.exists():
            self._atomic_write(self.students_file, [])

        if not self.presets_file.exists():
            default_preset = {
                "id": str(uuid.uuid4()),
                "name": "Default",
                "mapping": {}
            }
            self._atomic_write(self.presets_file, {
                "presets": [default_preset],
                "current_preset_id": default_preset["id"]
            })

    def _atomic_write(self, filepath: Path, data):
        """Atomic write using temp file + rename"""
        temp_file = filepath.with_suffix('.tmp')
        try:
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            # On Windows, need to remove target first if it exists
            if filepath.exists():
                filepath.unlink()
            temp_file.rename(filepath)
        except Exception as e:
            if temp_file.exists():
                temp_file.unlink()
            raise e

    def load_students(self) -> List[Student]:
        """Load all students"""
        with self.lock:
            with open(self.students_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return [Student(**s) for s in data]

    def save_students(self, students: List[Student]):
        """Save all students"""
        with self.lock:
            data = [s.dict() for s in students]
            self._atomic_write(self.students_file, data)

    def load_presets(self) -> tuple[List[Preset], Optional[str]]:
        """Load all presets and current preset ID"""
        with self.lock:
            with open(self.presets_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                presets = [Preset(**p) for p in data.get("presets", [])]
                current_id = data.get("current_preset_id")
                return presets, current_id

    def save_presets(self, presets: List[Preset], current_preset_id: Optional[str]):
        """Save all presets and current preset ID"""
        with self.lock:
            data = {
                "presets": [p.dict() for p in presets],
                "current_preset_id": current_preset_id
            }
            self._atomic_write(self.presets_file, data)

    def get_app_state(self) -> AppState:
        """Get complete app state"""
        students = self.load_students()
        presets, current_preset_id = self.load_presets()
        return AppState(
            students=students,
            presets=presets,
            current_preset_id=current_preset_id
        )

    def validate_consistency(self, students: List[Student], presets: List[Preset], current_preset_id: Optional[str]) -> tuple[bool, Optional[str]]:
        """Validate data consistency. Returns (is_valid, error_message)"""
        # Check student name uniqueness (normalized)
        normalized_names = set()
        for student in students:
            # Normalize: strip, lower, full-width to half-width
            normalized = student.name.strip().lower()
            normalized = normalized.replace('\u3000', ' ')  # Full-width space to half
            if normalized in normalized_names:
                return False, f"Duplicate student name: {student.name}"
            normalized_names.add(normalized)

        # Build student ID set
        student_ids = {s.id for s in students}

        # Validate current_preset_id
        if current_preset_id:
            preset_ids = {p.id for p in presets}
            if current_preset_id not in preset_ids:
                return False, f"Invalid current_preset_id: {current_preset_id}"

        # Validate preset mappings
        valid_seat_ids = get_all_seat_ids()
        for preset in presets:
            # Check seat IDs
            for seat_id in preset.mapping.keys():
                if seat_id not in valid_seat_ids:
                    return False, f"Invalid seat_id in preset '{preset.name}': {seat_id}"

            # Check student IDs
            for student_id in preset.mapping.values():
                if student_id not in student_ids:
                    return False, f"Invalid student_id in preset '{preset.name}': {student_id}"

        return True, None


# Global storage instance
storage = Storage()
