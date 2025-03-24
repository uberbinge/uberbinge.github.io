document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const timeElapsedEl = document.getElementById('time-elapsed');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const resetBtn = document.getElementById('reset-btn');
    const bmrSlider = document.getElementById('bmr-slider');
    const bmrValues = document.querySelectorAll('.bmr-value');
    const calorieValueEl = document.getElementById('calorie-value');
    const addBtn = document.getElementById('add-btn');
    const subtractBtn = document.getElementById('subtract-btn');
    const ringProgress = document.querySelector('.ring-progress');
    const dots = document.querySelectorAll('.dot');

    // Constants
    const CIRCLE_RADIUS = 80;
    const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
    const CALORIES_PER_POUND = 3500; // 3500 kcal ≈ 1lb of fat

    // Theme detection - safely check if the browser supports it
    const prefersDarkScheme = window.matchMedia ? 
        window.matchMedia('(prefers-color-scheme: dark)') : null;

    // State variables
    let state = loadState() || {
        dayStart: getDayStartTime(),
        bmr: 2000,
        manualCalories: 0, // This tracks manually added/subtracted calories
        totalCalorieHistory: 0, // This tracks the total calorie history across days
        themeMode: 'auto' // 'auto', 'light', or 'dark'
    };

    // Initialize the UI
    initializeUI();

    // Set up event listeners
    themeToggleBtn.addEventListener('click', toggleTheme);
    resetBtn.addEventListener('click', resetCounter);
    bmrSlider.addEventListener('input', updateBMR);
    addBtn.addEventListener('click', () => adjustCalories(100));
    subtractBtn.addEventListener('click', () => adjustCalories(-100));
    
    // Listen for OS theme changes if supported
    if (prefersDarkScheme) {
        prefersDarkScheme.addEventListener('change', (e) => {
            if (state.themeMode === 'auto') {
                applyTheme();
            }
        });
    }

    // Start the timer
    startTimer();

    // Update the progress ring
    updateProgressRing();
    
    // Update the dots display
    updateDotsDisplay();

    // Functions
    function initializeUI() {
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

    function checkDayReset() {
        const currentDayStart = getDayStartTime();
        // If it's a new day, reset the counters but keep the settings
        if (currentDayStart > state.dayStart) {
            // Add the previous day's net calories to the total history
            const previousDayNetCalories = getNetCalories();
            state.totalCalorieHistory += previousDayNetCalories;
            
            // Reset for the new day
            state.dayStart = currentDayStart;
            state.manualCalories = 0;
            saveState();
            
            // Update the dots display
            updateDotsDisplay();
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
        saveState();
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
        }, 1000);
    }

    function padZero(num) {
        return num.toString().padStart(2, '0');
    }

    function calculateCaloriesBurned() {
        // Calculate elapsed seconds since start of day in local timezone
        const now = new Date();
        const elapsedSeconds = Math.floor((now.getTime() - state.dayStart) / 1000);
        
        // BMR is calories per day, convert to calories per second
        const caloriesPerSecond = state.bmr / (24 * 60 * 60);
        return Math.round(caloriesPerSecond * elapsedSeconds * 10) / 10; // Round to 1 decimal place
    }

    function updateBMR() {
        state.bmr = parseInt(bmrSlider.value);
        updateBMRDisplay();
        saveState();
    }

    function updateBMRDisplay() {
        // Update the BMR values display
        const values = [state.bmr - 100, state.bmr, state.bmr + 100];
        bmrValues.forEach((el, index) => {
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
        updateCalorieDisplay();
        updateProgressRing();
        updateDotsDisplay();
        saveState();
    }

    function getNetCalories() {
        // Calculate net calories: BMR burned - manual adjustments
        // Negative value = deficit, Positive value = surplus
        const caloriesBurned = calculateCaloriesBurned();
        return state.manualCalories - caloriesBurned;
    }

    function getTotalCalories() {
        // Get the total calories (history + current day)
        return state.totalCalorieHistory + getNetCalories();
    }

    function updateCalorieDisplay() {
        // Calculate and update the calorie display
        const netCalories = getNetCalories();
        
        calorieValueEl.textContent = netCalories.toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });

        // Change color based on deficit or surplus
        if (netCalories < 0) {
            calorieValueEl.style.color = 'var(--primary-color)'; // Green for deficit
        } else {
            calorieValueEl.style.color = 'var(--add-btn-color)'; // Red for surplus
        }
    }

    function updateProgressRing() {
        // Calculate the progress percentage (0-100%)
        // For the ring, we'll use a range of 0 to CALORIES_PER_POUND
        const netCalories = getNetCalories();
        const absCalories = Math.abs(netCalories);
        const percentage = Math.min(absCalories % CALORIES_PER_POUND / CALORIES_PER_POUND, 1);
        
        // Calculate the stroke-dashoffset
        const offset = CIRCLE_CIRCUMFERENCE - (percentage * CIRCLE_CIRCUMFERENCE);
        ringProgress.style.strokeDashoffset = offset;
        
        // Set the color based on deficit or surplus
        if (netCalories < 0) {
            ringProgress.style.stroke = 'var(--primary-color)'; // Green for deficit
        } else {
            ringProgress.style.stroke = 'var(--add-btn-color)'; // Red for surplus
        }
    }

    function updateDotsDisplay() {
        // Get the total calories (history + current day)
        const totalCalories = getTotalCalories();
        
        // Calculate how many complete pounds (3500 kcal each)
        const completePounds = Math.floor(Math.abs(totalCalories) / CALORIES_PER_POUND);
        
        // Update the dots based on pounds lost/gained
        dots.forEach((dot, index) => {
            // First, remove any existing classes
            dot.classList.remove('active', 'surplus');
            
            // If we have enough complete pounds, activate this dot
            if (index < completePounds) {
                dot.classList.add('active');
                
                // If it's a surplus (weight gain), make it red
                if (totalCalories > 0) {
                    dot.classList.add('surplus');
                }
            }
        });
    }

    function resetCounter() {
        // Calculate the current net calories before resetting
        const currentNetCalories = getNetCalories();
        
        // Add current net calories to the total history
        state.totalCalorieHistory += currentNetCalories;
        
        // Reset day data
        state.dayStart = getDayStartTime();
        state.manualCalories = 0;
        
        // Update UI
        updateCalorieDisplay();
        updateProgressRing();
        updateDotsDisplay();
        
        // Force save to localStorage
        saveState();
        
        // Provide visual feedback that reset was successful
        resetBtn.classList.add('reset-active');
        setTimeout(() => {
            resetBtn.classList.remove('reset-active');
        }, 300);
    }

    function saveState() {
        localStorage.setItem('calorieCounterState', JSON.stringify(state));
    }

    function loadState() {
        const savedState = localStorage.getItem('calorieCounterState');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                
                // Handle migration from old state format
                if (parsed.darkMode !== undefined && parsed.themeMode === undefined) {
                    if (parsed.darkMode === null) {
                        parsed.themeMode = 'auto';
                    } else if (parsed.darkMode === true) {
                        parsed.themeMode = 'dark';
                    } else {
                        parsed.themeMode = 'light';
                    }
                    delete parsed.darkMode;
                }
                
                return parsed;
            } catch (e) {
                console.error('Error parsing saved state:', e);
                return null;
            }
        }
        return null;
    }
});
