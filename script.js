// Initialize timetable data
let timetable = {};

// DOM Elements
const timetableEl = document.querySelector('.timetable');
const addClassBtn = document.getElementById('add-class-btn');
const downloadBtn = document.getElementById('download-btn');
const modal = document.getElementById('modal');
const closeBtn = document.querySelector('.close');
const classForm = document.getElementById('class-form');
const subjectSelect = document.getElementById('class-name');
const otherSubjectInput = document.getElementById('other-subject');
const roomSelect = document.getElementById('class-room');
const otherRoomInput = document.getElementById('other-room');
const modalTitle = document.getElementById('modal-title');
const submitBtnText = document.getElementById('submit-btn-text');
const editIndexInput = document.getElementById('edit-index');
const editDayInput = document.getElementById('edit-day');
const loadingSpinner = document.querySelector('.loading-spinner');

// Initialize custom inputs as hidden
otherSubjectInput.style.display = 'none';
otherRoomInput.style.display = 'none';

// Set loading state
function setLoadingState(isLoading) {
    if (isLoading) {
        loadingSpinner.classList.add('active');
        timetableEl.style.opacity = '0.7';
        timetableEl.style.pointerEvents = 'none';
    } else {
        loadingSpinner.classList.remove('active');
        timetableEl.style.opacity = '1';
        timetableEl.style.pointerEvents = 'auto';
    }
}

// Subject dropdown handler
subjectSelect.addEventListener('change', function() {
    if (this.value === 'other') {
        otherSubjectInput.style.display = 'block';
        otherSubjectInput.required = true;
    } else {
        otherSubjectInput.style.display = 'none';
        otherSubjectInput.required = false;
    }
});

// Room dropdown handler
roomSelect.addEventListener('change', function() {
    if (this.value === 'other-room') {
        otherRoomInput.style.display = 'block';
        otherRoomInput.required = true;
    } else {
        otherRoomInput.style.display = 'none';
        otherRoomInput.required = false;
    }
});

// Load timetable from Firestore
async function loadTimetable() {
    setLoadingState(true);
    try {
        const docSnap = await window.firebaseMethods.getDoc(window.timetableRef);
        if (docSnap.exists()) {
            timetable = docSnap.data().data || {};
            renderTimetable();
        } else {
            // Initialize empty timetable if none exists
            await window.firebaseMethods.setDoc(window.timetableRef, { data: {} });
            timetable = {};
            renderTimetable();
        }
    } catch (error) {
        console.error("Error loading timetable:", error);
    } finally {
        setLoadingState(false);
    }
}

// Save timetable to Firestore
async function saveTimetable() {
    setLoadingState(true);
    try {
        await window.firebaseMethods.setDoc(window.timetableRef, { data: timetable });
        console.log("Timetable saved");
    } catch (error) {
        console.error("Error saving timetable:", error);
        throw error;
    } finally {
        setLoadingState(false);
    }
}

// Set up real-time listener
function setupRealtimeListener() {
    window.firebaseMethods.onSnapshot(window.timetableRef, (doc) => {
        setLoadingState(true);
        if (doc.exists()) {
            const newData = doc.data().data || {};
            // Only update if there are actual changes
            if (JSON.stringify(timetable) !== JSON.stringify(newData)) {
                timetable = newData;
                renderTimetable();
            }
        }
        setTimeout(() => setLoadingState(false), 300); // Small delay for smooth transition
    });
}

// Render the timetable
function renderTimetable() {
    timetableEl.innerHTML = '';
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    days.forEach(day => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';
        dayColumn.innerHTML = `<div class="day-header">${day}</div>`;
        
        if (timetable[day] && timetable[day].length > 0) {
            timetable[day].sort((a, b) => a.startTime.localeCompare(b.startTime))
                .forEach((cls, index) => {
                    const classItem = document.createElement('div');
                    classItem.className = 'class-item';
                    classItem.innerHTML = `
                        <strong>${cls.name}</strong>
                        <span class="time">${formatTime(cls.startTime)} - ${formatTime(cls.endTime)}</span>
                        ${cls.room ? `<span class="room">Professor: ${cls.room}</span>` : ''}
                        <div class="class-actions">
                            <button class="edit" data-day="${day}" data-index="${index}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete" data-day="${day}" data-index="${index}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    `;
                    dayColumn.appendChild(classItem);
                });
        } else {
            const emptyState = document.createElement('div');
            emptyState.className = 'class-item empty';
            emptyState.textContent = 'No classes scheduled';
            dayColumn.appendChild(emptyState);
        }
        
        timetableEl.appendChild(dayColumn);
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            const day = this.getAttribute('data-day');
            const index = parseInt(this.getAttribute('data-index'));
            
            setLoadingState(true);
            try {
                timetable[day].splice(index, 1);
                if (timetable[day].length === 0) {
                    delete timetable[day];
                }
                
                await saveTimetable();
            } catch (error) {
                console.error("Error deleting class:", error);
            } finally {
                setLoadingState(false);
            }
        });
    });
    
    // Add event listeners to edit buttons
    document.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const day = this.getAttribute('data-day');
            const index = parseInt(this.getAttribute('data-index'));
            const cls = timetable[day][index];
            
            // Set modal to edit mode
            modalTitle.textContent = 'Edit Class';
            submitBtnText.textContent = 'Update Class';
            editIndexInput.value = index;
            editDayInput.value = day;
            
            // Fill form with class data
            if (cls.name.includes('(Sem 1)') && subjectSelect.querySelector(`option[value="${cls.name}"]`)) {
                subjectSelect.value = cls.name;
                otherSubjectInput.style.display = 'none';
            } else {
                subjectSelect.value = 'other';
                otherSubjectInput.value = cls.name;
                otherSubjectInput.style.display = 'block';
            }
            
            if (['Prof. Shad', 'Prof. Sandeep', 'Prof. Shelmi'].includes(cls.room)) {
                roomSelect.value = cls.room;
                otherRoomInput.style.display = 'none';
            } else if (cls.room) {
                roomSelect.value = 'other-room';
                otherRoomInput.value = cls.room;
                otherRoomInput.style.display = 'block';
            } else {
                roomSelect.value = '';
                otherRoomInput.style.display = 'none';
            }
            
            document.getElementById('class-day').value = day;
            document.getElementById('start-time').value = cls.startTime;
            document.getElementById('end-time').value = cls.endTime;
            
            modal.style.display = 'block';
        });
    });
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Modal Controls
addClassBtn.addEventListener('click', () => {
    // Set modal to add mode
    modalTitle.textContent = 'Add New Class';
    submitBtnText.textContent = 'Save Class';
    classForm.reset();
    otherSubjectInput.style.display = 'none';
    otherRoomInput.style.display = 'none';
    editIndexInput.value = '';
    editDayInput.value = '';
    modal.style.display = 'block';
});

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// Form Submission
classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    setLoadingState(true);
    
    try {
        let subjectName;
        if (subjectSelect.value === 'other') {
            subjectName = otherSubjectInput.value.trim();
            if (!subjectName) {
                alert('Please enter a subject name');
                return;
            }
        } else {
            subjectName = subjectSelect.value;
        }

        let roomName;
        if (roomSelect.value === 'other-room') {
            roomName = otherRoomInput.value.trim();
        } else {
            roomName = roomSelect.value;
        }
        
        const day = document.getElementById('class-day').value;
        const newClass = {
            name: subjectName,
            room: roomName,
            day: day,
            startTime: document.getElementById('start-time').value,
            endTime: document.getElementById('end-time').value
        };
        
        if (newClass.startTime >= newClass.endTime) {
            alert('End time must be after start time');
            return;
        }
        
        // Check if we're editing an existing class
        const editIndex = editIndexInput.value;
        const editDay = editDayInput.value;
        
        if (editIndex !== '' && editDay !== '') {
            // Remove the old class if the day has changed
            if (editDay !== day) {
                timetable[editDay].splice(editIndex, 1);
                if (timetable[editDay].length === 0) {
                    delete timetable[editDay];
                }
                // Add to new day
                if (!timetable[day]) {
                    timetable[day] = [];
                }
                timetable[day].push(newClass);
            } else {
                // Update existing class
                timetable[day][editIndex] = newClass;
            }
        } else {
            // Add new class
            if (!timetable[day]) {
                timetable[day] = [];
            }
            timetable[day].push(newClass);
        }
        
        // Save to Firestore
        await saveTimetable();
        
        // Reset form and close modal
        classForm.reset();
        otherSubjectInput.style.display = 'none';
        otherSubjectInput.required = false;
        otherRoomInput.style.display = 'none';
        otherRoomInput.required = false;
        modal.style.display = 'none';
    } catch (error) {
        console.error("Error saving class:", error);
    } finally {
        setLoadingState(false);
    }
});

// Download as Image
downloadBtn.addEventListener('click', function() {
    const originalText = this.innerHTML;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    this.classList.add('loading');
    
    // Temporarily hide buttons for cleaner screenshot
    const addBtn = document.getElementById('add-class-btn');
    const downloadBtn = document.getElementById('download-btn');
    const addBtnDisplay = addBtn.style.display;
    const downloadBtnDisplay = downloadBtn.style.display;
    addBtn.style.display = 'none';
    downloadBtn.style.display = 'none';
    
    // Hide loading spinner during screenshot
    loadingSpinner.style.display = 'none';
    
    // Capture the container with header and timetable
    html2canvas(document.querySelector('.container-to-capture'), {
        scale: 2,
        logging: false,
        backgroundColor: '#fff5f7',
        allowTaint: true,
        useCORS: true
    }).then(canvas => {
        // Create download link
        const link = document.createElement('a');
        link.download = `gabby-masters-timetable.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Restore button states
        addBtn.style.display = addBtnDisplay;
        downloadBtn.style.display = downloadBtnDisplay;
        loadingSpinner.style.display = 'block';
        this.innerHTML = originalText;
        this.classList.remove('loading');
    }).catch(err => {
        console.error('Error generating image:', err);
        addBtn.style.display = addBtnDisplay;
        downloadBtn.style.display = downloadBtnDisplay;
        loadingSpinner.style.display = 'block';
        this.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error';
        setTimeout(() => {
            this.innerHTML = originalText;
            this.classList.remove('loading');
        }, 2000);
    });
});

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    loadTimetable();
    setupRealtimeListener();
});
