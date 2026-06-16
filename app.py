import os
import json
import time
import hashlib
from datetime import datetime
import urllib.parse
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "release_notes_cache.json"
CACHE_DURATION = 600  # 10 minutes in seconds

def generate_tweet_text(item_type, date_str, clean_text, link):
    """
    Generates a character-limit-safe tweet draft.
    Twitter counts all URLs as 23 characters.
    """
    emoji_map = {
        "feature": "🚀",
        "change": "🔄",
        "deprecation": "⚠️",
        "issue": "🐛",
        "general": "📢"
    }
    emoji = emoji_map.get(item_type.lower(), "📢")
    
    # Static parts of the tweet
    header = f"{emoji} BigQuery {item_type} ({date_str}): "
    footer = f" #BigQuery #GoogleCloud"
    
    # Twitter counts any URL as 23 characters.
    # Text length budget = 280 - len(header) - 23 (url) - len(" Read more: ") - len(footer)
    url_cost = 23
    read_more_str = " Read more: "
    
    budget = 280 - len(header) - url_cost - len(read_more_str) - len(footer)
    
    # Truncate text if needed
    if len(clean_text) > budget:
        truncated_text = clean_text[:budget - 3].strip() + "..."
    else:
        truncated_text = clean_text.strip()
        
    tweet_draft = f"{header}{truncated_text}{read_more_str}{link}{footer}"
    return tweet_draft

def fetch_and_parse_feed(force_refresh=False):
    now = time.time()
    
    # Check if cache exists and is fresh
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cache_data = json.load(f)
            if now - cache_data.get("last_updated", 0) < CACHE_DURATION:
                return cache_data.get("items", []), "cached", None
        except Exception as e:
            # If cache reading fails, proceed to fetch
            pass

    # Fetch and parse the feed
    try:
        feed = feedparser.parse(FEED_URL)
        if feed.bozo and not feed.entries:
            raise Exception("Failed to parse feed structure.")
            
        parsed_items = []
        
        for entry in feed.entries:
            entry_title = entry.get("title", "").strip()  # E.g., "June 15, 2026"
            entry_link = entry.get("link", "").strip()    # E.g., "https://docs.cloud.google.com/...#June_15_2026"
            entry_updated = entry.get("updated", "")      # E.g., "2026-06-15T00:00:00-07:00"
            summary_html = entry.get("summary", "")
            
            # Parse HTML summary
            soup = BeautifulSoup(summary_html, "html.parser")
            
            # Temporary holders
            current_type = "General"
            current_content = []
            
            raw_groups = []
            
            for child in soup.contents:
                if child.name == 'h3':
                    if current_content:
                        raw_groups.append({
                            "type": current_type,
                            "content": "".join(str(c) for c in current_content).strip()
                        })
                    current_type = child.get_text().strip()
                    current_content = []
                elif child.name is not None or str(child).strip():
                    current_content.append(child)
            
            if current_content:
                raw_groups.append({
                    "type": current_type,
                    "content": "".join(str(c) for c in current_content).strip()
                })
                
            # If no groups were parsed (e.g. no children), create a default group
            if not raw_groups and summary_html.strip():
                raw_groups.append({
                    "type": "General",
                    "content": summary_html.strip()
                })
                
            # Process each group into an item
            for index, group in enumerate(raw_groups):
                g_type = group["type"]
                g_html = group["content"]
                
                # Get plain text content for the tweet
                g_soup = BeautifulSoup(g_html, "html.parser")
                g_text = g_soup.get_text().strip()
                # Clean up multiple whitespaces/newlines
                g_text = " ".join(g_text.split())
                
                # Generate unique ID based on entry date, type and contents
                hash_input = f"{entry_title}_{g_type}_{g_text[:100]}"
                item_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()
                
                # Setup specific links (with custom query parameters or standard hash anchor)
                share_link = entry_link
                
                # Build suggested tweet draft
                tweet_draft = generate_tweet_text(g_type, entry_title, g_text, share_link)
                
                parsed_items.append({
                    "id": item_id,
                    "date": entry_title,
                    "date_iso": entry_updated,
                    "type": g_type,
                    "html": g_html,
                    "text": g_text,
                    "link": share_link,
                    "tweet_draft": tweet_draft
                })
                
        # Cache the results
        cache_data = {
            "last_updated": now,
            "items": parsed_items
        }
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
        return parsed_items, "fresh", None
        
    except Exception as e:
        # On error, fallback to cache if available
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    cache_data = json.load(f)
                return cache_data.get("items", []), "stale", f"Error updating feed: {str(e)}. Using cached data."
            except:
                pass
        return [], "error", f"Error fetching feed and no cache available: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    items, status, message = fetch_and_parse_feed(force_refresh=force_refresh)
    
    # Get cache age if status is cached or stale
    cache_age_seconds = 0
    if os.path.exists(CACHE_FILE):
        cache_age_seconds = int(time.time() - os.path.getmtime(CACHE_FILE))
        
    return jsonify({
        "items": items,
        "status": status,
        "message": message,
        "cache_age_seconds": cache_age_seconds,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
