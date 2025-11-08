// Application State
let appState = {
    students: [],
    presets: [],
    current_preset_id: null,
    editMode: false,
    heatmapEnabled: true,
    unsavedChanges: false,
    originalMapping: null
};

let currentStudent = null;
let currentNote = null;
let currentNoteIndex = -1;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupEventListeners();
    setupAutoScale();
});

// ==================== Custom Dialogs ====================

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const messageEl = document.getElementById('confirm-message');
        const yesBtn = document.getElementById('confirm-yes-btn');
        const noBtn = document.getElementById('confirm-no-btn');

        messageEl.textContent = message;
        modal.classList.remove('hidden');

        const handleYes = () => {
            cleanup();
            resolve(true);
        };

        const handleNo = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            yesBtn.removeEventListener('click', handleYes);
            noBtn.removeEventListener('click', handleNo);
            modal.classList.add('hidden');
        };

        yesBtn.addEventListener('click', handleYes);
        noBtn.addEventListener('click', handleNo);
    });
}

function showPrompt(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('prompt-modal');
        const titleEl = document.getElementById('prompt-title');
        const messageEl = document.getElementById('prompt-message');
        const input = document.getElementById('prompt-input');
        const okBtn = document.getElementById('prompt-ok-btn');
        const cancelBtn = document.getElementById('prompt-cancel-btn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        input.value = defaultValue;
        modal.classList.remove('hidden');
        input.focus();

        const handleOk = () => {
            const value = input.value.trim();
            cleanup();
            resolve(value || null);
        };

        const handleCancel = () => {
            cleanup();
            resolve(null);
        };

        const handleEnter = (e) => {
            if (e.key === 'Enter') handleOk();
            if (e.key === 'Escape') handleCancel();
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keydown', handleEnter);
            modal.classList.add('hidden');
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        input.addEventListener('keydown', handleEnter);
    });
}

function showAlert(message) {
    return showConfirm(message).then(() => {});
}

// ==================== API Calls ====================

async function loadState() {
    try {
        const response = await fetch('/api/state');
        const data = await response.json();
        appState.students = data.students;
        appState.presets = data.presets;
        appState.current_preset_id = data.current_preset_id;
        appState.unsavedChanges = false;
        appState.originalMapping = null;
        render();
    } catch (error) {
        console.error('Failed to load state:', error);
        await showAlert('Failed to load application state');
    }
}

async function saveStudent(student) {
    const response = await fetch(`/api/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save student');
    }
    return response.json();
}

async function deleteStudent(studentId) {
    const response = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        throw new Error('Failed to delete student');
    }
    return response.json();
}

async function createStudent(name) {
    const response = await fetch(`/api/students?name=${encodeURIComponent(name)}`, {
        method: 'POST'
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create student');
    }
    return response.json();
}

async function updatePreset(preset) {
    const response = await fetch(`/api/presets/${preset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update preset');
    }
    return response.json();
}

async function createPreset(name, copyCurrent) {
    const response = await fetch(`/api/presets?name=${encodeURIComponent(name)}&copy_current=${copyCurrent}`, {
        method: 'POST'
    });
    if (!response.ok) {
        throw new Error('Failed to create preset');
    }
    return response.json();
}

async function deletePreset(presetId) {
    const response = await fetch(`/api/presets/${presetId}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete preset');
    }
    return response.json();
}

async function switchPreset(presetId) {
    const response = await fetch(`/api/presets/switch/${presetId}`, {
        method: 'POST'
    });
    if (!response.ok) {
        throw new Error('Failed to switch preset');
    }
    appState.current_preset_id = presetId;
    render();
}

// ==================== Event Listeners ====================

function setupEventListeners() {
    // Heatmap toggle
    document.getElementById('heatmap-toggle').addEventListener('change', (e) => {
        appState.heatmapEnabled = e.target.checked;
        updateHeatmap();
    });

    // Edit mode
    document.getElementById('edit-mode-btn').addEventListener('click', async () => {
        if (appState.editMode) {
            // Exiting edit mode
            if (appState.unsavedChanges) {
                const confirmed = await showConfirm('You have unsaved changes. Discard them and exit Edit Mode?');
                if (!confirmed) {
                    return;
                }
            }
            appState.editMode = false;
            appState.unsavedChanges = false;
            appState.originalMapping = null;
            await loadState(); // Reload to discard changes
        } else {
            // Entering edit mode
            appState.editMode = true;
            const currentPreset = getCurrentPreset();
            if (currentPreset) {
                appState.originalMapping = JSON.parse(JSON.stringify(currentPreset.mapping));
            }
            // Auto-expand sidebar
            const sidebar = document.querySelector('.sidebar');
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
            }
        }

        document.getElementById('edit-mode-btn').textContent = appState.editMode ? 'View Mode' : 'Edit Mode';
        document.getElementById('edit-mode-btn').classList.toggle('primary', appState.editMode);
        render();
    });

    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('collapsed');
    });

    // Add student
    document.getElementById('add-student-btn').addEventListener('click', async () => {
        const name = await showPrompt('Add Student', 'Enter student name:');
        if (name) {
            try {
                await createStudent(name);
                await loadState();
            } catch (error) {
                await showAlert(error.message);
            }
        }
    });

    // Preset management
    document.getElementById('preset-selector').addEventListener('change', (e) => {
        if (e.target.value) {
            switchPreset(e.target.value);
        }
    });

    document.getElementById('new-preset-btn').addEventListener('click', async () => {
        const name = await showPrompt('New Preset', 'Enter preset name:');
        if (name) {
            const copyCurrent = await showConfirm('Copy current layout?');
            try {
                await createPreset(name, copyCurrent);
                await loadState();
            } catch (error) {
                await showAlert(error.message);
            }
        }
    });

    document.getElementById('rename-preset-btn').addEventListener('click', async () => {
        const currentPreset = getCurrentPreset();
        if (!currentPreset) return;

        const newName = await showPrompt('Rename Preset', 'Enter new name:', currentPreset.name);
        if (newName) {
            currentPreset.name = newName;
            try {
                await updatePreset(currentPreset);
                await loadState();
            } catch (error) {
                await showAlert(error.message);
            }
        }
    });

    document.getElementById('delete-preset-btn').addEventListener('click', async () => {
        const currentPreset = getCurrentPreset();
        if (!currentPreset) return;

        if (appState.presets.length <= 1) {
            await showAlert('Cannot delete the only preset');
            return;
        }

        if (await showConfirm(`Delete preset "${currentPreset.name}"?`)) {
            try {
                await deletePreset(currentPreset.id);
                await loadState();
            } catch (error) {
                await showAlert(error.message);
            }
        }
    });

    // Save/Cancel changes
    document.getElementById('save-changes-btn').addEventListener('click', saveChanges);
    document.getElementById('cancel-changes-btn').addEventListener('click', cancelChanges);

    // Import/Export Modal
    document.getElementById('import-export-btn').addEventListener('click', () => {
        document.getElementById('import-export-modal').classList.remove('hidden');
    });

    document.getElementById('export-students-btn').addEventListener('click', () => {
        window.location.href = '/api/export/students.json';
        document.getElementById('import-export-modal').classList.add('hidden');
    });

    document.getElementById('export-presets-btn').addEventListener('click', () => {
        window.location.href = '/api/export/presets.json';
        document.getElementById('import-export-modal').classList.add('hidden');
    });

    document.getElementById('import-students-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const response = await fetch('/api/import/students', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Import failed');
                }
                await loadState();
                document.getElementById('import-export-modal').classList.add('hidden');
                await showAlert('Students imported successfully');
            } catch (error) {
                await showAlert(error.message);
            }
            e.target.value = '';
        }
    });

    document.getElementById('import-presets-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            try {
                const response = await fetch('/api/import/presets', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Import failed');
                }
                await loadState();
                document.getElementById('import-export-modal').classList.add('hidden');
                await showAlert('Presets imported successfully');
            } catch (error) {
                await showAlert(error.message);
            }
            e.target.value = '';
        }
    });

    // Student modal
    document.querySelectorAll('.modal .close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
        });
    });

    document.getElementById('modal-role-select').addEventListener('change', (e) => {
        const cadreInput = document.getElementById('modal-cadre-text');
        cadreInput.style.display = e.target.value === 'cadre' ? 'block' : 'none';
    });

    document.getElementById('save-student-btn').addEventListener('click', saveStudentModal);
    document.getElementById('delete-student-btn').addEventListener('click', deleteStudentModal);
    document.getElementById('add-note-btn').addEventListener('click', addNote);

    // Note modal
    document.getElementById('save-note-btn').addEventListener('click', saveNoteModal);
    document.getElementById('delete-note-btn').addEventListener('click', deleteNoteModal);
}

// ==================== Auto Scale ====================

function setupAutoScale() {
    const resizeObserver = new ResizeObserver(() => {
        scaleSeats();
    });

    const container = document.querySelector('.seat-map-container');
    if (container) {
        resizeObserver.observe(container);
    }

    window.addEventListener('resize', scaleSeats);
    scaleSeats();
}

function scaleSeats() {
    const container = document.querySelector('.seat-map-container');
    const sections = document.querySelector('.seat-sections');

    if (!container || !sections) return;

    const containerRect = container.getBoundingClientRect();
    const sectionsRect = sections.getBoundingClientRect();

    const scaleX = (containerRect.width - 40) / sectionsRect.width;
    const scaleY = (containerRect.height - 40) / sectionsRect.height;
    const scale = Math.min(scaleX, scaleY, 1);

    sections.style.transform = `scale(${scale})`;
}

// ==================== Rendering ====================

function render() {
    renderPresetSelector();
    renderSeatMap();
    renderSidebar();
    renderScoreDistribution();
    updateHeatmap();
}

function renderPresetSelector() {
    const selector = document.getElementById('preset-selector');
    selector.innerHTML = appState.presets.map(preset =>
        `<option value="${preset.id}" ${preset.id === appState.current_preset_id ? 'selected' : ''}>
            ${preset.name}
        </option>`
    ).join('');
}

function renderSeatMap() {
    const currentPreset = getCurrentPreset();
    if (!currentPreset) return;

    document.querySelectorAll('.seat-card').forEach(card => {
        const seatId = card.dataset.seatId;
        const isWall = card.dataset.wall === 'True';

        // Skip wall seats
        if (isWall) {
            card.classList.add('wall');
            card.draggable = false;
            card.onclick = null;
            card.ondragstart = null;
            card.ondragover = null;
            card.ondrop = null;
            card.ondragleave = null;
            card.ondragend = null;
            return;
        }

        const studentId = currentPreset.mapping[seatId];
        const student = appState.students.find(s => s.id === studentId);

        // Clear existing content
        const nameEl = card.querySelector('.student-name');
        const scoreEl = card.querySelector('.student-score');
        card.className = 'seat-card';

        // Remove old role badges
        card.querySelectorAll('.role-badge').forEach(badge => badge.remove());

        if (student) {
            nameEl.textContent = student.name;
            scoreEl.textContent = student.score > 0 ? `Score: ${student.score}` : '';
            card.classList.add('has-student');

            // High score highlight
            if (student.score >= 80) {
                card.classList.add('high-score');
            }

            // Role badge
            if (student.role) {
                const badge = document.createElement('div');
                badge.className = 'role-badge';

                if (student.role === 'leader') {
                    badge.classList.add('leader');
                    badge.textContent = 'Leader';
                } else if (student.role.startsWith('cadre:')) {
                    badge.classList.add('cadre');
                    badge.textContent = student.role.split(':')[1] || 'Cadre';
                }

                card.appendChild(badge);
            }

            // Click to open details only in View Mode
            if (appState.editMode) {
                card.onclick = null;
                card.style.cursor = 'grab';
            } else {
                card.onclick = () => openStudentModal(student);
                card.style.cursor = 'pointer';
            }

            // Drag and drop only in edit mode
            if (appState.editMode) {
                card.draggable = true;
                card.ondragstart = (e) => handleDragStart(e, seatId, studentId);
                card.ondragover = (e) => handleDragOver(e);
                card.ondrop = (e) => handleDrop(e, seatId);
                card.ondragleave = (e) => handleDragLeave(e);
                card.ondragend = (e) => handleDragEnd(e);
            } else {
                card.draggable = false;
                card.ondragstart = null;
                card.ondragover = null;
                card.ondrop = null;
                card.ondragleave = null;
                card.ondragend = null;
            }
        } else {
            nameEl.textContent = 'Empty';
            scoreEl.textContent = '';
            card.classList.add('empty');
            card.onclick = null;

            // Allow drop in edit mode
            if (appState.editMode) {
                card.ondragover = (e) => handleDragOver(e);
                card.ondrop = (e) => handleDrop(e, seatId);
                card.ondragleave = (e) => handleDragLeave(e);
            } else {
                card.ondragover = null;
                card.ondrop = null;
                card.ondragleave = null;
            }
        }
    });
}

function renderSidebar() {
    const currentPreset = getCurrentPreset();
    if (!currentPreset) return;

    // Show/hide edit actions
    const editActions = document.getElementById('edit-actions');
    if (appState.editMode) {
        editActions.classList.remove('hidden');
    } else {
        editActions.classList.add('hidden');
    }

    // Unseated students
    const seatedIds = new Set(Object.values(currentPreset.mapping));
    const unseatedStudents = appState.students.filter(s => !seatedIds.has(s.id));
    const unseatedList = document.getElementById('unseated-list');

    if (unseatedStudents.length > 0) {
        unseatedList.innerHTML = unseatedStudents.map(student => `
            <div class="student-item"
                 ${appState.editMode ? 'draggable="true"' : ''}
                 data-student-id="${student.id}">
                <div class="student-item-name">${student.name}</div>
                <div class="student-item-score">Score: ${student.score}</div>
            </div>
        `).join('');

        // Add event listeners
        unseatedList.querySelectorAll('.student-item').forEach(item => {
            const studentId = item.dataset.studentId;

            if (appState.editMode) {
                // Drag events in edit mode
                item.ondragstart = (e) => {
                    draggedStudentId = studentId;
                    draggedSeatId = null;
                    item.classList.add('dragging');
                };
                item.ondragend = (e) => {
                    item.classList.remove('dragging');
                };
                item.style.cursor = 'grab';
            } else {
                // Click to view details in view mode
                item.onclick = () => {
                    const student = appState.students.find(s => s.id === studentId);
                    if (student) openStudentModal(student);
                };
                item.style.cursor = 'pointer';
            }
        });
    } else {
        unseatedList.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">All students are seated</div>';
    }
}

function renderScoreDistribution() {
    const container = document.getElementById('score-distribution');
    const buckets = Array(10).fill(0); // 10 buckets: 0-9, 10-19, ..., 90-100

    appState.students.forEach(student => {
        if (student.score > 0) {
            const bucketIndex = Math.min(Math.floor(student.score / 10), 9);
            buckets[bucketIndex]++;
        }
    });

    const maxCount = Math.max(...buckets, 1);

    container.innerHTML = buckets.map((count, index) => {
        const height = (count / maxCount) * 100;
        return `
            <div class="score-bar ${count > 0 ? 'has-data' : ''}"
                 style="height: ${height > 0 ? height + '%' : '4px'};"
                 title="${index * 10}-${index * 10 + 9}: ${count} students">
                ${count > 0 ? `<span class="score-bar-count">${count}</span>` : ''}
            </div>
        `;
    }).join('');
}

function updateHeatmap() {
    const body = document.body;
    if (appState.heatmapEnabled) {
        body.classList.add('heatmap-enabled');

        document.querySelectorAll('.seat-card').forEach(card => {
            const currentPreset = getCurrentPreset();
            if (!currentPreset) return;

            const seatId = card.dataset.seatId;
            const studentId = currentPreset.mapping[seatId];
            const student = appState.students.find(s => s.id === studentId);

            if (student && student.score > 0) {
                const intensity = Math.min(student.score / 100, 0.7);
                card.style.setProperty('--glow-intensity', intensity);
            } else {
                card.style.setProperty('--glow-intensity', 0);
            }
        });
    } else {
        body.classList.remove('heatmap-enabled');
        document.querySelectorAll('.seat-card').forEach(card => {
            card.style.setProperty('--glow-intensity', 0);
        });
    }
}

// ==================== Drag and Drop ====================

let draggedSeatId = null;
let draggedStudentId = null;

function handleDragStart(e, seatId, studentId) {
    draggedSeatId = seatId;
    draggedStudentId = studentId;
    e.currentTarget.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDrop(e, targetSeatId) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!draggedStudentId) return;

    const currentPreset = getCurrentPreset();
    if (!currentPreset) return;

    // Check if target seat has a student
    const targetStudentId = currentPreset.mapping[targetSeatId];

    // Remove student from original seat (if dragged from a seat)
    if (draggedSeatId) {
        delete currentPreset.mapping[draggedSeatId];
    }
    // If dragged from unseated list, student is already not in mapping

    // If target has a student, they become unseated
    if (targetStudentId && targetStudentId !== draggedStudentId) {
        delete currentPreset.mapping[targetSeatId];
    }

    // Place dragged student in target seat
    currentPreset.mapping[targetSeatId] = draggedStudentId;

    // Mark as having unsaved changes
    appState.unsavedChanges = true;

    draggedSeatId = null;
    draggedStudentId = null;

    render();
}

async function saveChanges() {
    const currentPreset = getCurrentPreset();
    if (!currentPreset) return;

    try {
        await updatePreset(currentPreset);
        appState.editMode = false;
        appState.unsavedChanges = false;
        appState.originalMapping = null;
        document.getElementById('edit-mode-btn').textContent = 'Edit Mode';
        document.getElementById('edit-mode-btn').classList.remove('primary');
        await loadState();
    } catch (error) {
        await showAlert(error.message);
    }
}

async function cancelChanges() {
    appState.editMode = false;
    appState.unsavedChanges = false;
    appState.originalMapping = null;
    document.getElementById('edit-mode-btn').textContent = 'Edit Mode';
    document.getElementById('edit-mode-btn').classList.remove('primary');
    await loadState();
}

// ==================== Student Modal ====================

function openStudentModal(student) {
    currentStudent = { ...student };
    currentStudent.notes = student.notes.map(n => ({ ...n }));

    document.getElementById('modal-student-name').textContent = student.name;
    document.getElementById('modal-name-input').value = student.name;
    document.getElementById('modal-score-input').value = student.score;

    const roleSelect = document.getElementById('modal-role-select');
    const cadreInput = document.getElementById('modal-cadre-text');

    if (!student.role || student.role === '') {
        roleSelect.value = '';
        cadreInput.style.display = 'none';
        cadreInput.value = '';
    } else if (student.role === 'leader') {
        roleSelect.value = 'leader';
        cadreInput.style.display = 'none';
        cadreInput.value = '';
    } else if (student.role.startsWith('cadre:')) {
        roleSelect.value = 'cadre';
        cadreInput.style.display = 'block';
        cadreInput.value = student.role.split(':')[1] || '';
    }

    renderNotes();
    document.getElementById('student-modal').classList.remove('hidden');
}

function renderNotes() {
    const notesList = document.getElementById('notes-list');

    // Sort notes by timestamp descending
    const sortedNotes = [...currentStudent.notes].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    if (sortedNotes.length === 0) {
        notesList.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">No notes yet</div>';
        return;
    }

    notesList.innerHTML = sortedNotes.map((note, index) => {
        const originalIndex = currentStudent.notes.findIndex(n => n === note);
        const date = new Date(note.timestamp);
        const dateStr = date.toLocaleString();

        return `
            <div class="note-item ${note.importance}" onclick="openNoteModal(${originalIndex})">
                <div class="note-header">
                    <span class="note-importance ${note.importance}">${note.importance}</span>
                    <span class="note-timestamp">${dateStr}</span>
                </div>
                <div class="note-text">${note.text}</div>
            </div>
        `;
    }).join('');
}

async function saveStudentModal() {
    const name = document.getElementById('modal-name-input').value.trim();
    const score = parseInt(document.getElementById('modal-score-input').value);
    const roleSelect = document.getElementById('modal-role-select').value;
    const cadreText = document.getElementById('modal-cadre-text').value.trim();

    if (!name) {
        await showAlert('Name is required');
        return;
    }

    if (isNaN(score) || score < 0 || score > 100) {
        await showAlert('Score must be between 0 and 100');
        return;
    }

    let role = null;
    if (roleSelect === 'leader') {
        role = 'leader';
    } else if (roleSelect === 'cadre') {
        role = `cadre:${cadreText || 'Cadre'}`;
    }

    currentStudent.name = name;
    currentStudent.score = score;
    currentStudent.role = role;

    try {
        await saveStudent(currentStudent);
        await loadState();
        document.getElementById('student-modal').classList.add('hidden');
    } catch (error) {
        await showAlert(error.message);
    }
}

async function deleteStudentModal() {
    if (!await showConfirm(`Delete student "${currentStudent.name}"?`)) {
        return;
    }

    try {
        await deleteStudent(currentStudent.id);
        await loadState();
        document.getElementById('student-modal').classList.add('hidden');
    } catch (error) {
        await showAlert(error.message);
    }
}

// ==================== Notes ====================

function addNote() {
    currentNote = {
        text: '',
        timestamp: new Date().toISOString(),
        importance: 'info'
    };
    currentNoteIndex = -1;
    openNoteModal(-1);
}

function openNoteModal(noteIndex) {
    if (noteIndex >= 0) {
        currentNote = { ...currentStudent.notes[noteIndex] };
        currentNoteIndex = noteIndex;
    }

    document.getElementById('note-importance-select').value = currentNote.importance;
    document.getElementById('note-text-input').value = currentNote.text;

    // Convert ISO to datetime-local format
    const date = new Date(currentNote.timestamp);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const dateStr = localDate.toISOString().slice(0, 16);
    document.getElementById('note-timestamp-input').value = dateStr;

    document.getElementById('note-modal').classList.remove('hidden');
}

async function saveNoteModal() {
    const importance = document.getElementById('note-importance-select').value;
    const text = document.getElementById('note-text-input').value.trim();
    const timestampStr = document.getElementById('note-timestamp-input').value;

    if (!text) {
        await showAlert('Note text is required');
        return;
    }

    if (text.length > 500) {
        await showAlert('Note text cannot exceed 500 characters');
        return;
    }

    // Convert datetime-local to ISO
    const timestamp = new Date(timestampStr).toISOString();

    const note = {
        text,
        timestamp,
        importance
    };

    if (currentNoteIndex >= 0) {
        currentStudent.notes[currentNoteIndex] = note;
    } else {
        currentStudent.notes.push(note);
    }

    renderNotes();
    document.getElementById('note-modal').classList.add('hidden');
    document.getElementById('student-modal').classList.remove('hidden');
}

async function deleteNoteModal() {
    if (currentNoteIndex >= 0) {
        if (await showConfirm('Delete this note?')) {
            currentStudent.notes.splice(currentNoteIndex, 1);
            renderNotes();
            document.getElementById('note-modal').classList.add('hidden');
            document.getElementById('student-modal').classList.remove('hidden');
        }
    }
}

// ==================== Helpers ====================

function getCurrentPreset() {
    return appState.presets.find(p => p.id === appState.current_preset_id);
}

// Make functions globally accessible for onclick handlers
window.openStudentModal = openStudentModal;
window.openNoteModal = openNoteModal;
window.appState = appState;
