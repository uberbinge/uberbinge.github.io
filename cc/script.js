// API URL for cloud sync - set to your Deno Deploy URL
const API_URL = 'https://ubercc.deno.dev';

// Cloud sync state
let syncTimeout = null;
let syncStatus = 'idle'; // 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

// Device ID management
function getDeviceId() {
    let id = localStorage.getItem('ccDeviceId');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('ccDeviceId', id);
    }
    return id;
}

function setDeviceId(newId) {
    if (newId && newId.length >= 10) {
        localStorage.setItem('ccDeviceId', newId);
        return true;
    }
    return false;
}

// Cloud sync functions
async function loadFromCloud() {
    if (!API_URL) return null;

    try {
        const res = await fetch(`${API_URL}/state/${getDeviceId()}`);
        if (res.ok) {
            const data = await res.json();
            return data.state;
        }
    } catch (e) {
        console.warn('Cloud load failed:', e);
    }
    return null;
}

async function saveToCloud() {
    if (!API_URL) return;

    try {
        const response = await fetch(`${API_URL}/state/${getDeviceId()}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });

        if (response.ok) {
            syncStatus = 'synced';
        } else {
            console.warn('Cloud save failed:', response.status);
            syncStatus = 'error';
        }
        updateSyncIndicator();
    } catch (e) {
        console.warn('Cloud save failed:', e);
        syncStatus = navigator.onLine ? 'error' : 'offline';
        updateSyncIndicator();
    }
}

function debouncedCloudSync() {
    if (!API_URL) return;

    clearTimeout(syncTimeout);
    syncStatus = 'syncing';
    updateSyncIndicator();
    syncTimeout = setTimeout(saveToCloud, 2000);
}

// Initialize state
let state = loadState() || {
    dayStart: getDayStartTime(),
    bmr: 1800,
    manualCalories: 0, // This tracks manually added/subtracted calories
    totalCalorieHistory: 0, // This tracks the total calorie history across days
    themeMode: 'auto', // 'auto', 'light', or 'dark'
    dailyData: {}, // Store daily calorie data by date string
    lastUpdated: Date.now(), // Track when the state was last updated
    calorieLog: [] // Array to store calorie adjustment logs for the current day
};

// Initialize week view navigation state
let currentWeekOffset = 0; // 0 = current week, -1 = previous week, etc.

// Initialize month view navigation state
let currentMonthOffset = 0; // 0 = current month, -1 = previous month, etc.

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Try to load from cloud first
    const cloudState = await loadFromCloud();
    if (cloudState) {
        state = cloudState;
        // Ensure required fields exist
        state.dailyData = state.dailyData || {};
        state.calorieLog = state.calorieLog || [];
        state.totalCalorieHistory = state.totalCalorieHistory ?? 0;
        localStorage.setItem('calorieCounterState', JSON.stringify(state));
        syncStatus = 'synced';
    }

    // Process any missed days
    processMissedDays();

    // Check if it's a new day
    checkDayReset();

    // Set up event listeners
    setupEventListeners();

    // Start the timer
    startTimer();

    // Update the display
    updateCalorieDisplay();
    updateDotsDisplay();

    // Update calendar views
    updateCalendarViews();

    // Ensure BMR values are displayed on load
    updateBMRDisplay();
    // Ensure BMR slider reflects the state.bmr value on load
    document.getElementById('bmr-slider').value = state.bmr;

    // Add week nav button listeners
    document.getElementById('week-prev-btn').addEventListener('click', () => handleWeekNav(-1));
    document.getElementById('week-next-btn').addEventListener('click', () => handleWeekNav(1));
    addSwipeListenersWeekView();

    // Add month nav button listeners
    document.getElementById('month-prev-btn').addEventListener('click', () => handleMonthNav(-1));
    document.getElementById('month-next-btn').addEventListener('click', () => handleMonthNav(1));
    addSwipeListenersMonthView();

    // Update sync UI
    updateSyncIndicator();
    updateDeviceIdDisplay();
});

// Set up event listeners
function setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Reset button - only resets today's data
    const resetBtn = document.getElementById('reset-btn');
    resetBtn.addEventListener('click', resetCounter);

    // Calorie buttons
    document.getElementById('add-btn').addEventListener('click', () => adjustCalories(100));
    document.getElementById('subtract-btn').addEventListener('click', () => adjustCalories(-100));

    // Log button
    document.getElementById('log-btn').addEventListener('click', displayLog);
    document.getElementById('log-modal-close').addEventListener('click', closeLogModal);

    // BMR slider
    const bmrSlider = document.getElementById('bmr-slider');
    bmrSlider.addEventListener('input', updateBMRDisplay);
    bmrSlider.addEventListener('change', updateBMR);

    // View toggle buttons
    document.getElementById('day-view-btn').addEventListener('click', () => switchView('day'));
    document.getElementById('week-view-btn').addEventListener('click', () => switchView('week'));
    document.getElementById('month-view-btn').addEventListener('click', () => switchView('month'));

    // Export/Import buttons
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', handleFileSelect);

    // Modal buttons
    document.getElementById('modal-confirm').addEventListener('click', confirmModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    // GitHub button
    document.getElementById('github-link').addEventListener('click', () => {
        window.open('https://github.com/uberbinge/uberbinge.github.io/tree/main/cc', '_blank');
    });
}

// Export data to JSON file
function exportData() {
    // Create a JSON blob with all the app data
    const data = {
        version: 1,
        timestamp: Date.now(),
        state: state
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create a temporary link to download the file
    const a = document.createElement('a');
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `calorie-counter-data-${dateStr}.json`;

    // Trigger the download
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    // Show success message
    showMessage('Data exported successfully!');
}

// Handle file selection for import
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if it's a JSON file
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        showMessage('Please select a valid JSON file.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // Validate the imported data
            if (!importedData.state || !importedData.version) {
                throw new Error('Invalid data format');
            }

            // Show confirmation dialog
            showConfirmDialog(
                'This will replace all your current data. Are you sure you want to continue?',
                () => {
                    // Import the data
                    importData(importedData);
                }
            );
        } catch (error) {
            showMessage(`Error importing data: ${error.message}`);
        }

        // Reset the file input
        event.target.value = '';
    };

    reader.readAsText(file);
}

// Import data from JSON
function importData(importedData) {
    try {
        // Update the state with imported data
        state = importedData.state;

        // Save to localStorage and sync to cloud
        saveState(true);

        // Update the UI
        updateCalorieDisplay();
        updateDotsDisplay();
        updateCalendarViews();

        // Update BMR slider
        const bmrSlider = document.getElementById('bmr-slider');
        bmrSlider.value = state.bmr;
        updateBMRDisplay();

        // Show success message
        showMessage('Data imported successfully!');
    } catch (error) {
        showMessage(`Error applying imported data: ${error.message}`);
    }
}

// Show a message modal
function showMessage(message) {
    const modal = document.getElementById('modal');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    modalMessage.textContent = message;
    modalConfirm.textContent = 'OK';
    modalCancel.style.display = 'none';

    modal.classList.add('active');

    // Set up the confirm button to close the modal
    modalConfirm.onclick = closeModal;
}

// Show a confirmation dialog
function showConfirmDialog(message, onConfirm) {
    const modal = document.getElementById('modal');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    modalMessage.textContent = message;
    modalConfirm.textContent = 'Confirm';
    modalCancel.style.display = 'inline-block';

    modal.classList.add('active');

    // Store the confirm callback
    modal.dataset.confirmCallback = 'true';
    window.modalConfirmCallback = onConfirm;
}

// Confirm modal action
function confirmModal() {
    const modal = document.getElementById('modal');

    // Check if there's a confirm callback
    if (modal.dataset.confirmCallback === 'true' && window.modalConfirmCallback) {
        window.modalConfirmCallback();
        delete window.modalConfirmCallback;
        modal.dataset.confirmCallback = 'false';
    }

    closeModal();
}

// Close the modal
function closeModal() {
    const modal = document.getElementById('modal');
    const modalCancel = document.getElementById('modal-cancel');

    modal.classList.remove('active');
    modalCancel.style.display = 'inline-block';

    // Clean up any confirm callback
    delete window.modalConfirmCallback;
    modal.dataset.confirmCallback = 'false';
}

// DOM Elements
const timeElapsedEl = document.getElementById('time-elapsed');
const themeToggleBtn = document.getElementById('theme-toggle');
const resetBtn = document.getElementById('reset-btn');
const githubBtn = document.getElementById('github-link');
const bmrSlider = document.getElementById('bmr-slider');
const calorieValueEl = document.getElementById('calorie-value');
const addBtn = document.getElementById('add-btn');
const subtractBtn = document.getElementById('subtract-btn');
const ringProgress = document.querySelector('.ring-progress');
const dots = document.querySelectorAll('.dot');

// View elements
const dayViewBtn = document.getElementById('day-view-btn');
const weekViewBtn = document.getElementById('week-view-btn');
const monthViewBtn = document.getElementById('month-view-btn');
const dayView = document.getElementById('day-view');
const weekView = document.getElementById('week-view');
const monthView = document.getElementById('month-view');
const weekCalendar = document.getElementById('week-calendar');
const monthCalendar = document.getElementById('month-calendar');

// Constants
const CIRCLE_RADIUS = 90;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
const CALORIES_PER_POUND = 3500; // 3500 kcal ≈ 1lb of fat
const DAY_IN_MS = 24 * 60 * 60 * 1000; // Milliseconds in a day
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // ISO week starts Monday

// Theme detection - safely check if the browser supports it
const prefersDarkScheme = window.matchMedia ? 
    window.matchMedia('(prefers-color-scheme: dark)') : null;

// Functions
function initializeUI() {
    // Process any missed days
    processMissedDays();

    // Check if we need to reset for a new day
    checkDayReset();

    // Apply theme based on state
    applyTheme();

    // Set BMR slider and values
    bmrSlider.value = state.bmr;
    updateBMRDisplay();

    // Set calorie count
    updateCalorieDisplay();

    // Set the ring's stroke properties
    ringProgress.style.strokeDasharray = CIRCLE_CIRCUMFERENCE;
    updateProgressRing();

    // Update calendar views
    updateCalendarViews();
}

function applyTheme() {
    // First, remove all theme classes
    document.body.classList.remove('dark-mode', 'auto-theme');

    // Apply the appropriate theme
    if (state.themeMode === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleBtn.textContent = '☀️'; // Sun icon for switching to light
    } else if (state.themeMode === 'light') {
        // Light mode is default, no class needed
        themeToggleBtn.textContent = '🌙'; // Moon icon for switching to dark
    } else if (state.themeMode === 'auto') {
        // Auto mode - follow OS preference
        document.body.classList.add('auto-theme');

        // Check if dark mode is preferred by OS
        const isDarkModePreferred = prefersDarkScheme && prefersDarkScheme.matches;

        if (isDarkModePreferred) {
            themeToggleBtn.textContent = '☀️'; // Sun icon
        } else {
            themeToggleBtn.textContent = '🌙'; // Moon icon
        }
    }
}

function getDayStartTime() {
    // Get current time in local timezone
    const now = new Date();
    // Create a new date set to midnight today in local timezone
    // This is more reliable across browsers
    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0, 0, 0, 0
    ).getTime();
}

function formatDateKey(date) {
    // Format a date as YYYY-MM-DD for use as a key
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function processMissedDays() {
    const now = Date.now();
    const currentDayStart = getDayStartTime();

    // If dayStart is already today, no need to process missed days
    if (state.dayStart >= currentDayStart) {
        return;
    }

    // Calculate how many days we've missed based on dayStart (midnight of last active day)
    const daysSinceLastActive = Math.floor((currentDayStart - state.dayStart) / DAY_IN_MS);

    if (daysSinceLastActive <= 0) {
        return;
    }

    // First, save the last active day's data
    const lastActiveDayKey = formatDateKey(state.dayStart);
    // Full day of BMR burn for the last active day
    let lastDayCaloriesBurned = state.bmr;
    let lastDayNetCalories = state.manualCalories - lastDayCaloriesBurned;
    state.dailyData[lastActiveDayKey] = {
        bmr: state.bmr,
        manualCalories: state.manualCalories,
        netCalories: lastDayNetCalories,
        date: lastActiveDayKey,
        calorieLog: state.calorieLog // Save the log for the last active day
    };

    // Now process each fully missed day (days between last active and today)
    let processDate = new Date(state.dayStart);
    for (let i = 1; i < daysSinceLastActive; i++) {
        // Move to the next day
        processDate = new Date(processDate.getTime() + DAY_IN_MS);
        const dateKey = formatDateKey(processDate);

        // For missed days, we only count BMR (no manual calories)
        state.dailyData[dateKey] = {
            bmr: state.bmr,
            manualCalories: 0,
            netCalories: -state.bmr,
            date: dateKey,
            calorieLog: []
        };
    }

    // Reset the current day's data
    state.manualCalories = 0;
    state.calorieLog = [];
    state.dayStart = currentDayStart;
    state.lastUpdated = now;

    // Save the updated state and sync
    saveState(true);
}

function checkDayReset() {
    const currentDayStart = getDayStartTime();
    // If it's a new day, reset the counters but keep the settings
    if (currentDayStart > state.dayStart) {
        // Calculate the previous day's net calories
        const previousDayNetCalories = getNetCalories();
        const previousDayKey = formatDateKey(state.dayStart);

        // Save the previous day's data
        state.dailyData[previousDayKey] = {
            bmr: state.bmr,
            manualCalories: state.manualCalories,
            netCalories: previousDayNetCalories,
            date: previousDayKey,
            calorieLog: state.calorieLog // Save the log for the previous day
        };

        // Reset for the new day
        state.dayStart = currentDayStart;
        state.manualCalories = 0;
        state.calorieLog = []; // Reset log for the new day
        state.lastUpdated = Date.now();
        saveState(true);

        // Update the dots display
        updateDotsDisplay();

        // Update calendar views
        updateCalendarViews();
    }
}

function toggleTheme() {
    // Cycle through theme modes: auto -> light -> dark -> auto
    if (state.themeMode === 'auto') {
        state.themeMode = 'light';
    } else if (state.themeMode === 'light') {
        state.themeMode = 'dark';
    } else {
        state.themeMode = 'auto';
    }

    applyTheme();
    saveState(true);
}

function switchView(viewType) {
    // Hide all views
    dayView.classList.remove('active');
    weekView.classList.remove('active');
    monthView.classList.remove('active');

    // Remove active class from all buttons
    dayViewBtn.classList.remove('active');
    weekViewBtn.classList.remove('active');
    monthViewBtn.classList.remove('active');

    // Remove all view-related body classes
    document.body.classList.remove('day-view-active', 'week-view-active', 'month-view-active');

    // Toggle visibility of calorie display and calendar containers
    const calorieDisplay = document.querySelector('.calorie-display');
    const calendarContainers = document.querySelectorAll('.calendar-container');

    calendarContainers.forEach(container => {
        container.classList.remove('active');
        // Force reflow
        void container.offsetHeight;
    });

    // Show selected view and activate button
    if (viewType === 'day') {
        dayView.classList.add('active');
        dayViewBtn.classList.add('active');
        document.body.classList.add('day-view-active');
        calorieDisplay.style.display = 'flex';
        updateDailyTotals();
    } else if (viewType === 'week') {
        weekView.classList.add('active');
        weekViewBtn.classList.add('active');
        document.body.classList.add('week-view-active');
        calorieDisplay.style.display = 'none';
        const weekContainer = document.querySelector('#week-view .calendar-container');
        weekContainer.classList.add('active');
        // Force reflow
        void weekContainer.offsetHeight;
        updateWeekCalendar();
        updateWeeklyTotals();
    } else if (viewType === 'month') {
        monthView.classList.add('active');
        monthViewBtn.classList.add('active');
        document.body.classList.add('month-view-active');
        calorieDisplay.style.display = 'none';
        const monthContainer = document.querySelector('#month-view .calendar-container');
        monthContainer.classList.add('active');
        // Force reflow
        void monthContainer.offsetHeight;
        updateMonthCalendar();
        updateMonthlyTotals();
    }

    // Force a repaint in Safari
    if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
        document.body.style.webkitTransform = 'scale(1)';
        void document.body.offsetHeight;
        document.body.style.webkitTransform = '';
    }
}

function startTimer() {
    setInterval(() => {
        // Check if we need to reset for a new day
        checkDayReset();

        // Calculate elapsed time since start of day
        const elapsedSeconds = Math.floor((Date.now() - state.dayStart) / 1000);
        const hours = Math.floor(elapsedSeconds / 3600);
        const minutes = Math.floor((elapsedSeconds % 3600) / 60);
        const seconds = elapsedSeconds % 60;

        timeElapsedEl.textContent = `${padZero(hours)}h ${padZero(minutes)}m ${padZero(seconds)}s`;

        // Update calorie display and progress ring
        updateCalorieDisplay();
        updateProgressRing();

        // Update last updated time
        state.lastUpdated = Date.now();
        saveState();
    }, 1000);
}

function padZero(num) {
    return num.toString().padStart(2, '0');
}

function calculateCaloriesBurned() {
    // Calculate elapsed seconds since start of day in local timezone
    const now = new Date();
    // Cap elapsed time at 24 hours (in ms)
    let elapsedMs = Math.min(now.getTime() - state.dayStart, DAY_IN_MS);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    // BMR is calories per day, convert to calories per second
    const caloriesPerSecond = state.bmr / (24 * 60 * 60);
    return Math.round(caloriesPerSecond * elapsedSeconds * 10) / 10; // Round to 1 decimal place
}

function calculateNetCaloriesForDate(dateKey) {
    // If it's today, use the current calculation
    if (dateKey === formatDateKey(state.dayStart)) {
        return getNetCalories();
    }

    // If we have stored data for this date, return it
    if (state.dailyData && state.dailyData[dateKey]) {
        const dayData = state.dailyData[dateKey];

        // Check if we have calorieLog entries but netCalories is 0
        if (dayData.netCalories === 0 && dayData.calorieLog && dayData.calorieLog.length > 0) {
            // Recalculate manualCalories from calorieLog entries
            let recalculatedManualCalories = 0;
            dayData.calorieLog.forEach(entry => {
                recalculatedManualCalories += entry.amount;
            });

            // Update the stored values
            dayData.manualCalories = recalculatedManualCalories;

            // Recalculate netCalories (full day of BMR burn)
            dayData.netCalories = recalculatedManualCalories - dayData.bmr;

            // Save the updated state and sync
            saveState(true);
        }

        return dayData.netCalories;
    }

    // Default to 0 if no data
    return 0;
}

function updateBMR() {
    state.bmr = parseInt(bmrSlider.value);
    updateBMRDisplay();
    saveState(true);
}

function updateBMRDisplay() {
    // Dynamically update the BMR values in the UI
    const values = [state.bmr - 100, state.bmr, state.bmr + 100];
    // For new dynamic IDs
    const bmrValueEls = [
        document.getElementById('bmr-value-1'),
        document.getElementById('bmr-value-2'),
        document.getElementById('bmr-value-3')
    ];
    bmrValueEls.forEach((el, index) => {
        el.textContent = values[index].toLocaleString();
        if (index === 1) {
            el.classList.add('current');
        } else {
            el.classList.remove('current');
        }
    });
}

function adjustCalories(amount) {
    // Add or subtract calories
    state.manualCalories += amount;

    // Log the adjustment with timestamp
    state.calorieLog.push({
        amount: amount,
        timestamp: Date.now()
    });

    // Add bump animation
    calorieValueEl.classList.add('bump');
    setTimeout(() => calorieValueEl.classList.remove('bump'), 150);

    updateCalorieDisplay();
    updateProgressRing();
    updateDotsDisplay();
    state.lastUpdated = Date.now();
    saveState(true);
}

function getNetCalories() {
    // Calculate net calories: BMR burned - manual adjustments
    // Negative value = deficit, Positive value = surplus
    const caloriesBurned = calculateCaloriesBurned();
    return state.manualCalories - caloriesBurned;
}

function getTotalCalorieHistory() {
    // Compute total from all past days in dailyData
    if (!state.dailyData) return 0;
    return Object.values(state.dailyData).reduce((sum, day) => sum + (day.netCalories || 0), 0);
}

function getTotalCalories() {
    // Get the total calories (history + current day)
    return getTotalCalorieHistory() + getNetCalories();
}

function updateCalorieDisplay() {
    // Calculate and update the calorie display
    const netCalories = getNetCalories();

    // Show absolute value - color indicates deficit (teal) vs surplus (red)
    calorieValueEl.textContent = Math.abs(netCalories).toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });

    // Update surplus/deficit class for styling
    const ring = document.querySelector('.ring');
    if (netCalories >= 0) {
        calorieValueEl.classList.add('surplus');
        ringProgress.classList.add('surplus');
        ring.classList.add('surplus-active');
    } else {
        calorieValueEl.classList.remove('surplus');
        ringProgress.classList.remove('surplus');
        ring.classList.remove('surplus-active');
    }
}

function updateProgressRing() {
    // Keep the circle always full
    ringProgress.style.strokeDashoffset = 0;
    ringProgress.style.strokeDasharray = CIRCLE_CIRCUMFERENCE;
    // Color is now handled by CSS classes (surplus class)
}

function updateDailyTotals() {
    // Calculate totals from calorie log for today
    let totalEaten = 0;
    let totalBurned = 0;

    if (state.calorieLog && state.calorieLog.length > 0) {
        state.calorieLog.forEach(entry => {
            if (entry.amount > 0) {
                totalEaten += entry.amount;
            } else {
                totalBurned += Math.abs(entry.amount);
            }
        });
    }

    updateTotalsDisplay(totalEaten, totalBurned, 'eaten', 'burned');
}

function updateTotalsDisplay(eaten, burned, eatenLabel, burnedLabel) {
    const totalInEl = document.getElementById('total-in');
    const totalOutEl = document.getElementById('total-out');
    const eatenLabelEl = document.querySelector('.total-in .total-label');
    const burnedLabelEl = document.querySelector('.total-out .total-label');

    if (totalInEl) {
        totalInEl.textContent = `+${eaten.toLocaleString()}`;
    }
    if (totalOutEl) {
        totalOutEl.textContent = `-${burned.toLocaleString()}`;
    }
    if (eatenLabelEl) {
        eatenLabelEl.textContent = eatenLabel;
    }
    if (burnedLabelEl) {
        burnedLabelEl.textContent = burnedLabel;
    }
}

function calculateTotalsForDateRange(startDate, endDate) {
    let totalEaten = 0;
    let totalBmrBurned = 0;
    const today = formatDateKey(new Date());
    const todayDate = new Date();

    // Iterate through dates in range
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        const dateKey = formatDateKey(current);

        // Don't count future dates
        if (current > todayDate) {
            current.setDate(current.getDate() + 1);
            continue;
        }

        if (dateKey === today) {
            // For today, use current state
            if (state.manualCalories > 0) {
                totalEaten += state.manualCalories;
            }
            totalBmrBurned += calculateCaloriesBurned();
        } else if (state.dailyData && state.dailyData[dateKey]) {
            // For past days, use stored data
            const dayData = state.dailyData[dateKey];
            if (dayData.manualCalories > 0) {
                totalEaten += dayData.manualCalories;
            }
            totalBmrBurned += dayData.bmr || state.bmr;
        }

        current.setDate(current.getDate() + 1);
    }

    return { eaten: totalEaten, burned: Math.round(totalBmrBurned) };
}

function updateWeeklyTotals() {
    const today = new Date();
    const weekStart = getStartOfWeek(today);
    weekStart.setDate(weekStart.getDate() + currentWeekOffset * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const totals = calculateTotalsForDateRange(weekStart, weekEnd);
    updateTotalsDisplay(totals.eaten, totals.burned, 'week in', 'week out');
}

function updateMonthlyTotals() {
    const today = new Date();
    const monthStart = getStartOfMonth(today);
    monthStart.setMonth(monthStart.getMonth() + currentMonthOffset);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    const totals = calculateTotalsForDateRange(monthStart, monthEnd);
    updateTotalsDisplay(totals.eaten, totals.burned, 'month in', 'month out');
}

function updateDotsDisplay() {
    // Update daily totals
    updateDailyTotals();

    // Get the total calories (history + current day)
    const totalCalories = getTotalCalories();

    // Calculate pounds and progress
    // Negative totalCalories = deficit (weight loss), Positive = surplus (weight gain)
    const isDeficit = totalCalories < 0;
    const totalPounds = Math.floor(Math.abs(totalCalories) / CALORIES_PER_POUND);
    const remainingCalories = Math.abs(totalCalories) % CALORIES_PER_POUND;
    // Progress toward weight loss: positive when in deficit, negative when in surplus
    const progressToNextPound = isDeficit
        ? Math.round((remainingCalories / CALORIES_PER_POUND) * 100)
        : -Math.round((remainingCalories / CALORIES_PER_POUND) * 100);

    // Update pounds display
    const poundsCount = document.getElementById('pounds-count');
    poundsCount.textContent = totalPounds;
    if (totalCalories > 0) {
        poundsCount.classList.add('surplus');
    } else {
        poundsCount.classList.remove('surplus');
    }

    // Update progress percentage
    document.getElementById('progress-to-pound').textContent = progressToNextPound;

    // Update sparkline
    updateSparkline();
}

function updateSparkline() {
    const svg = document.getElementById('sparkline');
    if (!svg) return;

    // Get last 7 days of data
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = formatDateKey(date);
        const netCalories = calculateNetCaloriesForDate(dateKey);
        days.push({ date, dateKey, netCalories });
    }

    // Find min/max for scaling
    const values = days.map(d => d.netCalories);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 0);
    const range = Math.max(maxVal - minVal, 100); // Minimum range of 100

    // SVG dimensions
    const width = 200;
    const height = 60;
    const padding = 8;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Scale function
    const scaleY = (val) => {
        const normalized = (val - minVal) / range;
        return height - padding - (normalized * chartHeight);
    };
    const scaleX = (i) => padding + (i / 6) * chartWidth;

    // Build path
    const points = days.map((d, i) => ({
        x: scaleX(i),
        y: scaleY(d.netCalories),
        netCalories: d.netCalories
    }));

    // Create smooth curve path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        pathD += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    // Zero line position
    const zeroY = scaleY(0);

    // Get computed colors (CSS variables don't work in SVG on iOS Safari)
    const styles = getComputedStyle(document.body);
    const deficitColor = styles.getPropertyValue('--color-deficit').trim() || '#0f766e';
    const surplusColor = styles.getPropertyValue('--color-surplus').trim() || '#dc2626';
    const mutedColor = styles.getPropertyValue('--text-muted').trim() || '#a8a29e';
    const surfaceColor = styles.getPropertyValue('--bg-surface').trim() || '#ffffff';

    // Build SVG content - simple line with colored dots
    svg.innerHTML = `
        <!-- Zero line -->
        <line x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}"
              stroke="${mutedColor}" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
        <!-- Line -->
        <path d="${pathD}" fill="none" stroke="${mutedColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
        <!-- Points -->
        ${points.map((p, i) => `
            <circle cx="${p.x}" cy="${p.y}" r="${i === points.length - 1 ? 5 : 3.5}"
                    fill="${p.netCalories > 0 ? surplusColor : deficitColor}"
                    ${i === points.length - 1 ? `stroke="${surfaceColor}" stroke-width="2"` : ''}/>
        `).join('')}
    `;
}

function updateCalendarViews() {
    updateWeekCalendar(currentWeekOffset);
    updateMonthCalendar(currentMonthOffset);
}

function getStartOfWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // ISO week starts on Monday (getDay: 0=Sun, 1=Mon, ... 6=Sat)
    const dayOfWeek = d.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days; otherwise go to Monday
    d.setDate(d.getDate() + diff);
    return d;
}

function isCurrentWeek(offset) {
    return offset === 0;
}

function getCWNumber(date) {
    // ISO week number (CW): https://en.wikipedia.org/wiki/ISO_week_date
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Thursday in current week decides the year.
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // First week of year has Jan 1st in it
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

function updateWeekCalendar(offset = currentWeekOffset) {
    // Clear the calendar
    weekCalendar.innerHTML = '';

    // Add day headers
    DAYS_OF_WEEK.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        weekCalendar.appendChild(dayHeader);
    });

    // Get the start of the target week
    const today = new Date();
    const weekStart = getStartOfWeek(today);
    weekStart.setDate(weekStart.getDate() + offset * 7);

    // Label: CW-n
    const cw = getCWNumber(weekStart);
    const weekLabel = document.getElementById('week-label');
    weekLabel.textContent = `CW-${cw}`;

    // Create calendar days for the week
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateKey = formatDateKey(date);
        const dayElement = createCalendarDay(date, dateKey);
        weekCalendar.appendChild(dayElement);
    }

    // Update nav button states
    const nextBtn = document.getElementById('week-next-btn');
    nextBtn.disabled = isCurrentWeek(offset);
}

function getStartOfMonth(date) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function isCurrentMonth(offset) {
    return offset === 0;
}

function updateMonthCalendar(offset = currentMonthOffset) {
    monthCalendar.innerHTML = '';
    DAYS_OF_WEEK.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        monthCalendar.appendChild(dayHeader);
    });
    const today = new Date();
    const monthStart = getStartOfMonth(today);
    monthStart.setMonth(monthStart.getMonth() + offset);
    const currentMonth = monthStart.getMonth();
    const currentYear = monthStart.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    // Convert to ISO week (Monday=0, Sunday=6) from JS getDay (Sunday=0, Saturday=6)
    const startingDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Empty cells before first day
    for (let i = 0; i < startingDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        monthCalendar.appendChild(emptyDay);
    }
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(currentYear, currentMonth, d);
        const dateKey = formatDateKey(date);
        const dayElement = createCalendarDay(date, dateKey);
        monthCalendar.appendChild(dayElement);
    }
    // Fill to complete grid
    const totalCells = startingDay + daysInMonth;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
        for (let i = 0; i < remainingCells; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            monthCalendar.appendChild(emptyDay);
        }
    }
    // Label: Month Name Year
    const monthLabel = document.getElementById('month-label');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthLabel.textContent = `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
    // Update nav button states
    const nextBtn = document.getElementById('month-next-btn');
    nextBtn.disabled = isCurrentMonth(offset);
}

function createCalendarDay(date, dateKey) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';

    // Check if this is today
    const isToday = date.toDateString() === new Date().toDateString();
    if (isToday) {
        dayElement.classList.add('today');
    }

    // Add the day number
    const dayLabel = document.createElement('div');
    dayLabel.className = 'day-label';
    dayLabel.textContent = date.getDate();
    dayElement.appendChild(dayLabel);

    // Add calorie information if available
    const netCalories = calculateNetCaloriesForDate(dateKey);
    const hasData = isToday || (state.dailyData && state.dailyData[dateKey]);

    if (hasData || netCalories !== 0) {
        const calorieElement = document.createElement('div');
        calorieElement.className = 'calorie-value';
        // Show absolute value - color indicates deficit (teal) vs surplus (red)
        calorieElement.textContent = Math.abs(netCalories).toFixed(0);
        dayElement.appendChild(calorieElement);

        // Add deficit/surplus class
        if (netCalories < 0) {
            dayElement.classList.add('deficit');
        } else if (netCalories > 0) {
            dayElement.classList.add('surplus');
        }
        // netCalories === 0 gets no color class (neutral)
    }

    // Add click event listener to edit calories
    dayElement.addEventListener('click', () => {
        showEditCaloriesDialog(date, dateKey);
    });

    return dayElement;
}

function resetTimer() {
    // Reset the timer to the current time
    state.dayStart = getDayStartTime();
    state.lastUpdated = Date.now();
    saveState(true);
}

function resetCounter() {
    // Confirm before resetting
    showConfirmDialog(
        'This will reset your calorie counter for today. Continue?',
        () => {
            // Reset the counter but keep the settings
            state.manualCalories = 0;
            state.calorieLog = []; // Clear the log for the current day
            state.dayStart = getDayStartTime();
            state.lastUpdated = Date.now();
            saveState(true);
            updateCalorieDisplay();
            updateProgressRing();
            updateDotsDisplay();
        }
    );
}

function loadState() {
    try {
        const savedState = localStorage.getItem('calorieCounterState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);

            // Validate the state structure
            if (!parsedState.dayStart || !parsedState.bmr) {
                console.warn('Invalid state structure detected, resetting state');
                localStorage.removeItem('calorieCounterState');
                return null;
            }

            // Ensure required fields exist
            parsedState.dailyData = parsedState.dailyData || {};
            parsedState.calorieLog = parsedState.calorieLog || [];
            parsedState.totalCalorieHistory = parsedState.totalCalorieHistory ?? 0;

            return parsedState;
        }
    } catch (e) {
        console.error('Error loading state:', e);
        // Clear potentially corrupted state
        try {
            localStorage.removeItem('calorieCounterState');
        } catch (clearError) {
            console.error('Error clearing corrupted state:', clearError);
        }
    }
    return null;
}

function saveState(syncToCloud = false) {
    try {
        // Validate state before saving
        if (!state || !state.dayStart || !state.bmr) {
            console.error('Invalid state detected, not saving');
            return;
        }

        // Save to localStorage (immediate)
        localStorage.setItem('calorieCounterState', JSON.stringify(state));

        // Queue cloud sync (debounced) - only for meaningful user changes
        if (syncToCloud) {
            debouncedCloudSync();
        }
    } catch (e) {
        console.error('Error saving state:', e);
        // Try to clear storage if we hit quota or other issues
        try {
            localStorage.removeItem('calorieCounterState');
        } catch (clearError) {
            console.error('Error clearing state:', clearError);
        }
    }
}

// Add a function to clear all data
function clearAllData() {
    try {
        localStorage.clear();
        // Reset to initial state
        state = {
            dayStart: getDayStartTime(),
            bmr: 1800,
            manualCalories: 0,
            totalCalorieHistory: 0,
            themeMode: 'auto',
            dailyData: {},
            lastUpdated: Date.now(),
            calorieLog: []
        };
        // Force update all views
        updateCalorieDisplay();
        updateDotsDisplay();
        updateCalendarViews();
        // Update BMR slider
        const bmrSlider = document.getElementById('bmr-slider');
        bmrSlider.value = state.bmr;
        updateBMRDisplay();
    } catch (e) {
        console.error('Error clearing data:', e);
    }
}

// Function to display the calorie log
function displayLog() {
    const logModal = document.getElementById('log-modal');
    const logList = document.getElementById('log-list');

    // Clear existing log entries
    logList.innerHTML = '';

    // Check if there are log entries
    if (state.calorieLog.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-log-message';
        emptyMessage.textContent = 'No calorie adjustments have been made today.';
        logList.appendChild(emptyMessage);
    } else {
        // Add log entries in reverse chronological order (newest first)
        for (let i = state.calorieLog.length - 1; i >= 0; i--) {
            const entry = state.calorieLog[i];
            const listItem = document.createElement('li');

            // Create time element
            const timeElement = document.createElement('span');
            timeElement.className = 'log-entry-time';
            const entryTime = new Date(entry.timestamp);
            timeElement.textContent = entryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Create amount element
            const amountElement = document.createElement('span');
            amountElement.className = entry.amount > 0 ? 'log-entry-amount positive' : 'log-entry-amount negative';
            amountElement.textContent = `${entry.amount > 0 ? '+' : ''}${entry.amount} kcal`;

            // Add elements to list item
            listItem.appendChild(timeElement);
            listItem.appendChild(amountElement);
            logList.appendChild(listItem);
        }
    }

    // Show the log modal
    logModal.classList.add('active');
}

// Close the log modal
function closeLogModal() {
    const logModal = document.getElementById('log-modal');
    logModal.classList.remove('active');
}

// Show the edit calories dialog
function showEditCaloriesDialog(date, dateKey) {
    const modal = document.getElementById('edit-calories-modal');
    const dateDisplay = document.getElementById('edit-calories-date');
    const caloriesInput = document.getElementById('edit-calories-input');
    const saveButton = document.getElementById('edit-calories-save');
    const cancelButton = document.getElementById('edit-calories-cancel');

    // Format the date for display
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    dateDisplay.textContent = date.toLocaleDateString(undefined, options);

    // Get the current manual calories for this date
    let manualCalories = 0;
    if (dateKey === formatDateKey(state.dayStart)) {
        // If it's today, use the current manual calories
        manualCalories = state.manualCalories;
    } else if (state.dailyData && state.dailyData[dateKey]) {
        // If it's a past day, use the stored manual calories
        manualCalories = state.dailyData[dateKey].manualCalories;
    }

    // Set the input value
    caloriesInput.value = manualCalories;

    // Set up the save button
    saveButton.onclick = () => {
        saveEditedCalories(dateKey, parseInt(caloriesInput.value) || 0);
        closeEditCaloriesModal();
    };

    // Set up the cancel button
    cancelButton.onclick = closeEditCaloriesModal;

    // Show the modal
    modal.classList.add('active');
}

// Close the edit calories modal
function closeEditCaloriesModal() {
    const modal = document.getElementById('edit-calories-modal');
    modal.classList.remove('active');
}

// Save the edited calories
function saveEditedCalories(dateKey, manualCalories) {
    if (dateKey === formatDateKey(state.dayStart)) {
        // If it's today, update the current manual calories
        state.manualCalories = manualCalories;

        // Clear the calorie log and add a single entry for the manual edit
        state.calorieLog = [{
            amount: manualCalories,
            timestamp: Date.now()
        }];
    } else if (state.dailyData && state.dailyData[dateKey]) {
        // If it's a past day, update the stored manual calories
        const dayData = state.dailyData[dateKey];
        dayData.manualCalories = manualCalories;
        dayData.netCalories = manualCalories - dayData.bmr;
        dayData.calorieLog = [{
            amount: manualCalories,
            timestamp: Date.now()
        }];
    } else {
        // If there's no data for this date yet, create it
        state.dailyData[dateKey] = {
            bmr: state.bmr,
            manualCalories: manualCalories,
            netCalories: manualCalories - state.bmr,
            date: dateKey,
            calorieLog: [{
                amount: manualCalories,
                timestamp: Date.now()
            }]
        };
    }

    // Save the updated state and sync
    saveState(true);

    // Update the UI
    updateCalorieDisplay();
    updateProgressRing();
    updateDotsDisplay();
    updateCalendarViews();
}

function addSwipeListenersWeekView() {
    const weekView = document.getElementById('week-view');
    let touchStartX = null;
    weekView.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
        }
    });
    weekView.addEventListener('touchend', e => {
        if (touchStartX === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const dx = touchEndX - touchStartX;
        if (Math.abs(dx) > 40) {
            if (dx < 0) {
                // Swipe left: previous week
                handleWeekNav(-1);
            } else {
                // Swipe right: next week
                handleWeekNav(1);
            }
        }
        touchStartX = null;
    });
}

function handleWeekNav(direction) {
    // direction: -1 (prev), 1 (next)
    if (direction === -1) {
        currentWeekOffset--;
        updateWeekCalendar();
        updateWeeklyTotals();
    } else if (direction === 1 && currentWeekOffset < 0) {
        currentWeekOffset++;
        updateWeekCalendar();
        updateWeeklyTotals();
    }
}

function addSwipeListenersMonthView() {
    const monthView = document.getElementById('month-view');
    let touchStartX = null;
    monthView.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
        }
    });
    monthView.addEventListener('touchend', e => {
        if (touchStartX === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const dx = touchEndX - touchStartX;
        if (Math.abs(dx) > 40) {
            if (dx < 0) {
                handleMonthNav(-1);
            } else {
                handleMonthNav(1);
            }
        }
        touchStartX = null;
    });
}

function handleMonthNav(direction) {
    if (direction === -1) {
        currentMonthOffset--;
        updateMonthCalendar();
        updateMonthlyTotals();
    } else if (direction === 1 && currentMonthOffset < 0) {
        currentMonthOffset++;
        updateMonthCalendar();
        updateMonthlyTotals();
    }
}

// ============================================
// SYNC UI FUNCTIONS
// ============================================

// Update sync status indicator
function updateSyncIndicator() {
    const syncIndicator = document.getElementById('sync-indicator');
    if (!syncIndicator) return;

    syncIndicator.className = 'sync-indicator';
    syncIndicator.style.display = 'flex';

    switch (syncStatus) {
        case 'syncing':
            syncIndicator.classList.add('syncing');
            syncIndicator.title = 'Syncing...';
            break;
        case 'error':
            syncIndicator.classList.add('error');
            syncIndicator.title = 'Sync error - click to retry';
            break;
        case 'offline':
            syncIndicator.classList.add('offline');
            syncIndicator.title = 'Offline - will sync when online';
            break;
        case 'synced':
            syncIndicator.classList.add('synced');
            syncIndicator.title = 'Synced to cloud';
            break;
        default:
            syncIndicator.classList.add('idle');
            syncIndicator.title = 'Not synced yet';
    }
}

// Update device ID display
function updateDeviceIdDisplay() {
    const deviceIdEl = document.getElementById('device-id-display');
    if (deviceIdEl) {
        const id = getDeviceId();
        deviceIdEl.textContent = id.substring(0, 8) + '...';
        deviceIdEl.title = id;
    }
}

// Copy device ID to clipboard
function copyDeviceId() {
    const id = getDeviceId();
    navigator.clipboard.writeText(id).then(() => {
        showMessage('Device ID copied to clipboard!');
    }).catch(() => {
        showMessage('Failed to copy. ID: ' + id);
    });
}

// Show device ID change dialog using the dedicated modal
function showChangeDeviceIdDialog() {
    const modal = document.getElementById('device-id-modal');
    const input = document.getElementById('new-device-id-input');

    if (!modal || !input) return;

    input.value = '';
    modal.classList.add('active');

    setTimeout(() => input.focus(), 100);
}

// Handle device ID change from modal
async function handleDeviceIdChange() {
    const modal = document.getElementById('device-id-modal');
    const input = document.getElementById('new-device-id-input');

    const newId = input?.value?.trim();

    if (newId && setDeviceId(newId)) {
        // Try to load from cloud with new ID
        const cloudState = await loadFromCloud();
        if (cloudState) {
            state = cloudState;
            state.dailyData = state.dailyData || {};
            state.calorieLog = state.calorieLog || [];
            state.totalCalorieHistory = state.totalCalorieHistory ?? 0;
            localStorage.setItem('calorieCounterState', JSON.stringify(state));

            // Update UI
            updateCalorieDisplay();
            updateDotsDisplay();
            updateCalendarViews();
            updateBMRDisplay();
            applyTheme();
            bmrSlider.value = state.bmr;

            showMessage('Synced successfully with new device ID!');
        } else {
            showMessage('No data found for this device ID. Your local data will be synced to this ID.');
            debouncedCloudSync();
        }
        updateDeviceIdDisplay();
    } else {
        showMessage('Invalid device ID. Must be at least 10 characters.');
    }

    modal.classList.remove('active');
}

// Close device ID modal
function closeDeviceIdModal() {
    const modal = document.getElementById('device-id-modal');
    if (modal) modal.classList.remove('active');
}

// Manually trigger sync
async function manualSync() {
    if (syncStatus === 'syncing') return;

    syncStatus = 'syncing';
    updateSyncIndicator();

    try {
        // First save current state
        await saveToCloud();

        // Then try to load latest
        const cloudState = await loadFromCloud();
        if (cloudState && cloudState.lastUpdated > state.lastUpdated) {
            state = cloudState;
            state.dailyData = state.dailyData || {};
            state.calorieLog = state.calorieLog || [];
            state.totalCalorieHistory = state.totalCalorieHistory ?? 0;
            localStorage.setItem('calorieCounterState', JSON.stringify(state));

            updateCalorieDisplay();
            updateDotsDisplay();
            updateCalendarViews();
            updateBMRDisplay();
            applyTheme();
            bmrSlider.value = state.bmr;
        }

        syncStatus = 'synced';
    } catch (e) {
        syncStatus = navigator.onLine ? 'error' : 'offline';
    }

    updateSyncIndicator();
}

// Listen for online/offline events
window.addEventListener('online', () => {
    if (syncStatus === 'offline') {
        debouncedCloudSync();
    }
});

window.addEventListener('offline', () => {
    syncStatus = 'offline';
    updateSyncIndicator();
});
