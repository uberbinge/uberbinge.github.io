# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal blog built with Jekyll using the Henry theme, hosted on GitHub Pages. It contains:
- A Jekyll-based blog with posts in `_posts/`
- A standalone Calorie Counter web app in `cc/`

## Development Commands

### Jekyll Blog (with Docker - recommended)
```bash
docker-compose up
```
Access at http://0.0.0.0:4000/ (Mac) or http://localhost:4000/ (Windows)

### Jekyll Blog (without Docker)
```bash
bundle install
bundle exec jekyll serve -wIlo --drafts
```
Requires Ruby 3.0.0 and Bundler.

### Calorie Counter App (`cc/`)
Open `cc/index.html` directly in a browser - no server required.

Run tests by opening `cc/tests.html` in a browser (Jasmine test runner). Tests use `testClock` to mock time for day rollover and calendar logic.

## Architecture

### Jekyll Structure
- `_config.yml` - Site configuration (title, author, theme settings). Restart server after changes.
- `_posts/` - Published blog posts in markdown
- `_drafts/` - Draft posts (visible with `--drafts` flag)
- `_layouts/` - Page templates (default, post, page, index)
- `_includes/` - Reusable HTML components (header, footer, head)
- `_sass/` - SCSS stylesheets with override files (`theme_override.scss`, `main_override.scss`)

### Calorie Counter (`cc/`)
A vanilla JavaScript app with no dependencies:
- `script.js` - Main application logic with state management using localStorage
- `tests.js` - Jasmine unit tests with time mocking via `testClock`
- State object tracks: BMR, manual calorie adjustments, daily history, theme mode, calorie log

Key patterns in `cc/script.js`:
- State persistence via `loadState()`/`saveState()` to localStorage
- Day rollover handled by `checkDayReset()` and `processMissedDays()`
- Date formatting uses `formatDateKey()` for YYYY-MM-DD keys
- Calorie calculations: BMR-based burn rate, net calories = manualCalories - caloriesBurned
