// Unit tests for Calorie Counter App
// Run these tests by opening tests.html in a browser

// Mock localStorage for testing
const mockLocalStorage = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        clear: () => { store = {}; },
        removeItem: (key) => { delete store[key]; },
        getStore: () => store
    };
})();

// Replace the real localStorage with our mock
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage
});

// Test suite
const tests = [
    {
        name: 'Test formatDateKey function',
        test: () => {
            const date = new Date(2025, 2, 24); // March 24, 2025
            const result = formatDateKey(date);
            return result === '2025-03-24';
        }
    },
    {
        name: 'Test getDayStartTime function',
        test: () => {
            // Mock the current date
            const realDate = Date;
            const mockDate = new Date(2025, 2, 24, 15, 30, 0); // March 24, 2025, 3:30 PM
            
            // Override Date constructor
            const originalDate = Date;
            const mockDateConstructor = function(...args) {
                if (args.length === 0) {
                    return new originalDate(mockDate);
                }
                return new originalDate(...args);
            };
            mockDateConstructor.now = () => mockDate.getTime();
            mockDateConstructor.parse = originalDate.parse;
            mockDateConstructor.UTC = originalDate.UTC;
            
            // Apply mock
            window.Date = mockDateConstructor;
            
            const result = getDayStartTime();
            
            // Restore original Date
            window.Date = originalDate;
            
            // Expected: midnight of March 24, 2025
            const expected = new originalDate(2025, 2, 24, 0, 0, 0, 0).getTime();
            return result === expected;
        }
    },
    {
        name: 'Test calculateCaloriesBurned function',
        test: () => {
            // Mock state and date
            const mockState = {
                dayStart: new Date(2025, 2, 24, 0, 0, 0, 0).getTime(), // Midnight
                bmr: 1800
            };
            
            // Mock current time as 12 hours after day start
            const originalDate = Date;
            const mockDate = new Date(2025, 2, 24, 12, 0, 0, 0); // Noon
            
            // Override Date constructor
            const mockDateConstructor = function(...args) {
                if (args.length === 0) {
                    return new originalDate(mockDate);
                }
                return new originalDate(...args);
            };
            window.Date = mockDateConstructor;
            
            // Calculate expected calories burned (12 hours = 1/2 day)
            const expected = 900; // Half of BMR
            
            // Call the function with our mock state
            const result = calculateCaloriesBurned.call({ state: mockState });
            
            // Restore original Date
            window.Date = originalDate;
            
            // Allow for small rounding differences
            return Math.abs(result - expected) < 1;
        }
    },
    {
        name: 'Test processMissedDays with one missed day',
        test: () => {
            // Clear mock localStorage
            mockLocalStorage.clear();
            
            // Create mock state
            const mockState = {
                dayStart: new Date(2025, 2, 23, 0, 0, 0, 0).getTime(), // March 23
                bmr: 1800,
                manualCalories: 1500,
                dailyData: {},
                lastUpdated: new Date(2025, 2, 23, 18, 0, 0, 0).getTime() // March 23, 6 PM
            };
            
            const originalDate = Date;
            // Current time is March 25, 12 PM (more than a day later)
            const mockNow = new Date(2025, 2, 25, 12, 0, 0, 0).getTime();
            
            // Override Date.now
            const originalNow = Date.now;
            Date.now = () => mockNow;
            
            // Mock getDayStartTime to return March 25 midnight
            const mockGetDayStartTime = () => new Date(2025, 2, 25, 0, 0, 0, 0).getTime();
            
            // Mock calculateNetCaloriesForDate to return -300 for March 23
            const mockCalculateNetCaloriesForDate = (dateKey) => {
                if (dateKey === '2025-03-23') {
                    return -300; // 1500 manual - 1800 BMR
                }
                return 0;
            };
            
            // Call processMissedDays with our mocks
            const testObj = {
                state: mockState,
                getDayStartTime: mockGetDayStartTime,
                formatDateKey: formatDateKey,
                calculateNetCaloriesForDate: mockCalculateNetCaloriesForDate,
                saveState: () => {}
            };
            
            processMissedDays.call(testObj);
            
            // Restore Date.now
            Date.now = originalNow;
            
            // Check that March 23 and March 24 data was saved
            const march23Data = mockState.dailyData['2025-03-23'];
            const march24Data = mockState.dailyData['2025-03-24'];
            
            return march23Data 
                && march23Data.netCalories === -300
                && march24Data 
                && march24Data.netCalories === -1800 // Full day BMR burn
                && mockState.manualCalories === 0 // Reset for new day
                && mockState.dayStart === mockGetDayStartTime() // Updated to current day
                && mockState.lastUpdated === mockNow; // Updated timestamp
        }
    },
    {
        name: 'Test checkDayReset function',
        test: () => {
            // Clear mock localStorage
            mockLocalStorage.clear();
            
            // Create mock state
            const mockState = {
                dayStart: new Date(2025, 2, 24, 0, 0, 0, 0).getTime(), // March 24
                bmr: 1800,
                manualCalories: 1500,
                totalCalorieHistory: -1000,
                dailyData: {},
                lastUpdated: new Date(2025, 2, 24, 23, 59, 0, 0).getTime() // March 24, 11:59 PM
            };
            
            // Mock getDayStartTime to return March 25 midnight (new day)
            const mockGetDayStartTime = () => new Date(2025, 2, 25, 0, 0, 0, 0).getTime();
            
            // Mock getNetCalories to return -300
            const mockGetNetCalories = () => -300; // 1500 manual - 1800 BMR
            
            // Mock Date.now to return March 25, 12 AM
            const originalNow = Date.now;
            Date.now = () => new Date(2025, 2, 25, 0, 0, 1, 0).getTime();
            
            // Call checkDayReset with our mocks
            const testObj = {
                state: mockState,
                getDayStartTime: mockGetDayStartTime,
                formatDateKey: formatDateKey,
                getNetCalories: mockGetNetCalories,
                saveState: () => {},
                updateDotsDisplay: () => {},
                updateCalendarViews: () => {}
            };
            
            checkDayReset.call(testObj);
            
            // Restore Date.now
            Date.now = originalNow;
            
            // Check that March 24 data was saved and state was updated
            const march24Data = mockState.dailyData['2025-03-24'];
            
            return march24Data 
                && march24Data.netCalories === -300
                && mockState.totalCalorieHistory === -1300 // Previous -1000 + current -300
                && mockState.manualCalories === 0 // Reset for new day
                && mockState.dayStart === mockGetDayStartTime(); // Updated to new day
        }
    }
];

// Helper functions (copied from main app for testing)
function formatDateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayStartTime() {
    const now = new Date();
    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0, 0, 0, 0
    ).getTime();
}

function calculateCaloriesBurned() {
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - this.state.dayStart) / 1000);
    const caloriesPerSecond = this.state.bmr / (24 * 60 * 60);
    return Math.round(caloriesPerSecond * elapsedSeconds * 10) / 10;
}

function processMissedDays() {
    const now = Date.now();
    const lastUpdated = this.state.lastUpdated || now;
    const currentDayStart = this.getDayStartTime();
    
    // If last update was today, no need to process missed days
    if (lastUpdated >= currentDayStart) {
        return;
    }
    
    // Calculate how many days we've missed
    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    const daysSinceLastUpdate = Math.floor((currentDayStart - lastUpdated) / DAY_IN_MS);
    
    if (daysSinceLastUpdate <= 0) {
        return;
    }
    
    // Process each missed day
    let processDate = new Date(lastUpdated);
    
    // First, save the last active day's data
    const lastActiveDayKey = this.formatDateKey(processDate);
    const lastDayNetCalories = this.calculateNetCaloriesForDate(lastActiveDayKey);
    
    // Save the last active day's data
    this.state.dailyData[lastActiveDayKey] = {
        bmr: this.state.bmr,
        manualCalories: this.state.manualCalories,
        netCalories: lastDayNetCalories,
        date: lastActiveDayKey
    };
    
    // Now process each fully missed day
    for (let i = 1; i < daysSinceLastUpdate; i++) {
        // Move to the next day
        processDate = new Date(processDate.getTime() + DAY_IN_MS);
        const dateKey = this.formatDateKey(processDate);
        
        // For missed days, we only count BMR (no manual calories)
        this.state.dailyData[dateKey] = {
            bmr: this.state.bmr,
            manualCalories: 0,
            netCalories: -this.state.bmr, // Full day of BMR burn with no intake
            date: dateKey
        };
    }
    
    // Reset the current day's data
    this.state.manualCalories = 0;
    this.state.dayStart = currentDayStart;
    this.state.lastUpdated = now;
    
    // Save the updated state
    this.saveState();
}

function checkDayReset() {
    const currentDayStart = this.getDayStartTime();
    // If it's a new day, reset the counters but keep the settings
    if (currentDayStart > this.state.dayStart) {
        // Calculate the previous day's net calories
        const previousDayNetCalories = this.getNetCalories();
        const previousDayKey = this.formatDateKey(this.state.dayStart);
        
        // Save the previous day's data
        this.state.dailyData[previousDayKey] = {
            bmr: this.state.bmr,
            manualCalories: this.state.manualCalories,
            netCalories: previousDayNetCalories,
            date: previousDayKey
        };
        
        // Add to total history
        this.state.totalCalorieHistory += previousDayNetCalories;
        
        // Reset for the new day
        this.state.dayStart = currentDayStart;
        this.state.manualCalories = 0;
        this.state.lastUpdated = Date.now();
        this.saveState();
        
        // Update the dots display
        this.updateDotsDisplay();
        
        // Update calendar views
        this.updateCalendarViews();
    }
}

// Run tests
function runTests() {
    const results = document.getElementById('test-results');
    results.innerHTML = '';
    
    let passCount = 0;
    let failCount = 0;
    
    tests.forEach(testCase => {
        let passed = false;
        let error = null;
        
        try {
            passed = testCase.test();
        } catch (e) {
            error = e;
        }
        
        const resultItem = document.createElement('div');
        resultItem.className = `test-result ${passed ? 'pass' : 'fail'}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'test-name';
        nameSpan.textContent = testCase.name;
        
        const statusSpan = document.createElement('span');
        statusSpan.className = 'test-status';
        statusSpan.textContent = passed ? 'PASS' : 'FAIL';
        
        resultItem.appendChild(nameSpan);
        resultItem.appendChild(statusSpan);
        
        if (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'test-error';
            errorDiv.textContent = `Error: ${error.message}`;
            resultItem.appendChild(errorDiv);
        }
        
        results.appendChild(resultItem);
        
        if (passed) {
            passCount++;
        } else {
            failCount++;
        }
    });
    
    const summary = document.createElement('div');
    summary.className = 'test-summary';
    summary.innerHTML = `
        <span class="pass-count">${passCount} passed</span>, 
        <span class="fail-count">${failCount} failed</span>
    `;
    results.appendChild(summary);
}

// Expose functions for testing
window.runTests = runTests;
