# BigQuery Release Pulse Dashboard

A high-fidelity, responsive web application built using Python Flask and plain vanilla HTML, JavaScript, and CSS that fetches the Google Cloud BigQuery Release notes and presents them in a modern, interactive dashboard.

## Key Features

1. **Granular Update Splitting**: Instead of rendering a single massive daily text block, the app parses each update's HTML feed and splits it into individual, categorized items (Features, Changes, Issues, Deprecations).
2. **Dynamic Live Filters**: Search and filter notes instantly by type or text content. Statistics cards dynamically count matches in real time.
3. **Smart Local Cache**: Implements a 10-minute caching layer (`release_notes_cache.json`) to keep load times instantaneous and prevent network spamming.
4. **Interactive Refresh Mechanism**: Force-refresh updates using a modern button with an active rotation spinner and loading feedback.
5. **Twitter/X Sharing Intent**: Share any specific update as a tweet. Features a built-in custom Tweet Composer Modal with Twitter-accurate character counting (URLs count as exactly 23 characters) and an SVG progress ring.
6. **Confetti Celebration Engine**: Custom HTML5 Canvas confetti explosion and toast alerts trigger upon sharing a tweet.
7. **Premium Glassmorphism Design**: Dark theme with ambient neon glows, custom scrolls, responsive layouts, hover effects, and orbit loaders.

## Project Structure

```
bq-release-notes/
├── app.py                  # Flask Web Server & Atom Feed Parser
├── requirements.txt        # Python Dependencies
├── templates/
│   └── index.html          # HTML Shell & Composer Modals
└── static/
    ├── css/
    │   └── style.css       # Core Style Sheet (Variables, Grids, Animations)
    └── js/
        └── app.js          # Client State, Filter Logic, Toast & Confetti Engines
```

## Running the Application

1. **Verify Python**: Ensure Python 3.10+ is installed.
2. **Virtual Environment**: A virtual environment has been configured at `venv/`.
3. **Install Dependencies**:
   ```bash
   .\venv\Scripts\pip install -r requirements.txt
   ```
4. **Run Server**:
   ```bash
   .\venv\Scripts\python app.py
   ```
5. **Access Hub**: Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser.
