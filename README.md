# SeatAtlas

A modern classroom seat management web application built with Python FastAPI and vanilla JavaScript.

## Features

- **Fixed Seat Layout**: Left section (5×12) and right section (4×11) with group labels
- **Multiple Presets**: Create and switch between different seating arrangements
- **Drag & Drop**: Intuitive seat assignment in edit mode
- **Student Management**: Add, edit, and delete students with scores and roles
- **Notes System**: Track important information about students with priority levels
- **Score Visualization**: Real-time heatmap and distribution chart
- **Import/Export**: JSON-based data import and export
- **Dark Theme**: Modern glassmorphism design with TikTok red accent color

## Requirements

- Python 3.8 or higher
- Windows operating system

## Quick Start

1. Double-click `run.bat` to start the application
2. The script will automatically:
   - Create a virtual environment
   - Install dependencies
   - Start the server
3. Open your browser to `http://127.0.0.1:8000`

## Usage

### Presets
- Switch between presets using the dropdown in the header
- Create new presets with the "+" button
- Rename presets with the "✎" button
- Delete presets with the "×" button

### Students
- Add students using the "+ Add Student" button in the sidebar
- Click on a student card to edit details, scores, roles, and notes
- Students are automatically assigned to the first available seat

### Edit Mode
- Click "Edit Mode" to enable drag-and-drop functionality
- Drag students to different seats
- Students displaced by moves go to the temporary storage area
- Save changes only when temporary storage is empty

### Notes
- Click on a student to open their details
- Add notes with importance levels: Info, Warning, or Important
- Edit timestamps and note content
- Notes are sorted by date (newest first)

### Heatmap
- Toggle the heatmap overlay to visualize student scores
- Red intensity indicates score level (higher score = more red)
- Score distribution chart shows overall class performance

### Import/Export
- Export students and presets as JSON files
- Import JSON files to restore or migrate data
- All imports are validated before applying

## Project Structure

```
SeatAtlas/
├── src/
│   ├── main.py              # FastAPI application
│   ├── models.py            # Data models
│   ├── storage.py           # JSON file handling
│   ├── api/
│   │   └── routes.py        # API endpoints
│   ├── static/
│   │   ├── style.css        # Styling
│   │   └── app.js           # Frontend logic
│   └── templates/
│       └── index.html       # SPA template
├── data/                    # JSON data storage
├── requirements.txt         # Python dependencies
└── run.bat                  # Windows launcher
```

## Data Storage

All data is stored locally in the `data/` directory:
- `students.json`: Student information
- `presets.json`: Seating arrangements

Files are written atomically with file locking to prevent corruption.

## API Endpoints

- `GET /api/state`: Get complete application state
- `GET /api/students`: List all students
- `POST /api/students`: Create student
- `PUT /api/students/{id}`: Update student
- `DELETE /api/students/{id}`: Delete student
- `GET /api/presets`: List all presets
- `POST /api/presets`: Create preset
- `PUT /api/presets/{id}`: Update preset
- `DELETE /api/presets/{id}`: Delete preset
- `POST /api/presets/switch/{id}`: Switch preset
- `GET /api/export/students.json`: Export students
- `GET /api/export/presets.json`: Export presets
- `POST /api/import/students`: Import students
- `POST /api/import/presets`: Import presets

## Design

- **Theme**: Dark mode only with TikTok red (#FE2C55) accent
- **Style**: Glassmorphism with blur effects, rounded corners, and subtle shadows
- **Transitions**: Smooth 150-250ms animations using transform/opacity
- **Responsive**: Adapts to different screen sizes

## License

This project is built for educational and classroom management purposes.
