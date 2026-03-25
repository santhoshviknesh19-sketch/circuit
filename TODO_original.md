# Task: Create constantly changing JSON file with Ollama prompts/responses for website connection

## Steps:
- [x] Step 1: Edit ai_help.py - Add imports (json, threading, time), background thread function to generate demo prompts every 5s, query Ollama, update 'ai_data.json'.
- [x] Step 2: Edit ai_help.py - Add Flask endpoint '/data' to serve JSON data.
- [x] Step 3: Start the background thread in main.
- [x] Step 4: Test - Run python ai_help.py (Flask + ollama serve running), ai_data.json will update every 5s now that Ollama is ready. curl http://localhost:5000/data
- [ ] Step 5: Optionally update AIHelp.html to fetch and display live data.
- [x] Complete task.
