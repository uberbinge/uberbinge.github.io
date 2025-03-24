# Calorie Counter App

A simple web application for tracking calorie deficit/surplus throughout the day. This app works entirely in the browser without requiring a server, storing data using the browser's localStorage API.

## Features

- Track calorie intake and expenditure throughout the day
- Automatically calculates calories burned based on your Basal Metabolic Rate (BMR)
- Default BMR of 1800 kcal/day (adjustable via slider)
- Add calories when you eat (+100 button)
- Subtract calories when you exercise (-100 button)
- Visual progress ring that fills based on your calorie deficit/surplus
- Dots display that shows pounds lost or gained (3500 kcal ≈ 1lb)
- View your calorie history by day, week, or month
- Export and import your calorie data
- Reset counter at any time
- Toggle between light and dark mode
- Direct link to GitHub source code
- Persistent storage using localStorage
- Mobile-friendly design optimized for all browsers (including Firefox mobile)

## How to Use

1. Open `index.html` in your browser
2. Set your Basal Metabolic Rate (BMR) using the slider (default is 1800 kcal/day)
3. The app will automatically start tracking calories burned based on your BMR
4. When you eat, press the "+100" button (multiple times if needed)
5. When you exercise, press the "-100" button (multiple times if needed)
6. The central display shows your current calorie deficit/surplus
7. Switch between day, week, and month views to see your progress over time
8. Export your data for backup or import previously saved data
9. Press "Reset" to start over

## Technical Details

- Built with vanilla HTML, CSS, and JavaScript
- No external dependencies or frameworks
- Data persists between sessions using localStorage
- Fully responsive design optimized for all mobile browsers
- Special optimizations for Firefox mobile
- Cross-browser compatibility with Chrome, Safari, Firefox, and Edge

## Running the App

Simply open the `index.html` file in any modern web browser. No server or installation required.

## Recent Updates

- Changed default BMR from 2000 to 1800 kcal/day
- Improved mobile layout, especially for Firefox mobile
- Added GitHub link in the header for easy access to source code
- Enhanced responsive design for better cross-browser compatibility
- Optimized calorie display for better readability
