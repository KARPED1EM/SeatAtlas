from typing import List, Optional, Literal, Dict
from pydantic import BaseModel, Field, validator
import re


class Note(BaseModel):
    text: str
    timestamp: str  # ISO format
    importance: Literal["info", "warning", "important"] = "info"


class Student(BaseModel):
    id: str
    name: str = Field(..., min_length=1, max_length=50)
    score: int = Field(default=0, ge=0, le=100)
    role: Optional[str] = None  # "leader" or "cadre:CustomText"
    notes: List[Note] = Field(default_factory=list)

    @validator('name')
    def validate_name(cls, v):
        # Remove leading/trailing whitespace
        v = v.strip()
        # Remove control characters
        v = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', v)
        if not v or len(v) > 50:
            raise ValueError('Name must be 1-50 characters')
        return v


class SeatMapping(BaseModel):
    """Maps seat_id to student_id"""
    mapping: Dict[str, str] = Field(default_factory=dict)  # seat_id -> student_id


class Preset(BaseModel):
    id: str
    name: str
    mapping: Dict[str, str] = Field(default_factory=dict)  # seat_id -> student_id


class AppState(BaseModel):
    students: List[Student] = Field(default_factory=list)
    presets: List[Preset] = Field(default_factory=list)
    current_preset_id: Optional[str] = None


# Fixed seat layout
def get_seat_layout():
    """Returns the fixed seat layout structure"""
    seats = {
        "left": [],  # 5 cols × 12 rows
        "right": []  # 4 cols × 11 rows
    }

    # Left section: 5 cols × 12 rows (groups 10-20 for first 10 rows)
    for row in range(12):
        row_seats = []
        for col in range(5):
            seat_id = f"L{row}_{col}"
            group = None
            if row < 10:
                group = 10 + row

            # Mark walls: groups 15 & 16 (rows 5 & 6), leftmost seat (col 0)
            is_wall = (row in [5, 6] and col == 0)

            row_seats.append({"id": seat_id, "group": group, "wall": is_wall})
        seats["left"].append(row_seats)

    # Right section: 4 cols × 11 rows (groups 1-9 for first 9 rows)
    for row in range(11):
        row_seats = []
        for col in range(4):
            seat_id = f"R{row}_{col}"
            group = None
            if row < 9:
                group = row + 1

            # Mark walls: groups 5, 6, 7 (rows 4, 5, 6), rightmost seat (col 3)
            is_wall = (row in [4, 5, 6] and col == 3)

            row_seats.append({"id": seat_id, "group": group, "wall": is_wall})
        seats["right"].append(row_seats)

    return seats


def get_all_seat_ids():
    """Returns a set of all valid seat IDs"""
    layout = get_seat_layout()
    seat_ids = set()

    for section in ["left", "right"]:
        for row in layout[section]:
            for seat in row:
                seat_ids.add(seat["id"])

    return seat_ids
