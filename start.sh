#!/bin/bash
echo "Starting Marketing Team Lead Manager..."
echo ""
echo "Backend: http://127.0.0.1:8000"
echo "API Docs: http://127.0.0.1:8000/docs"
echo "Frontend: open frontend/index.html in your browser"
echo ""
cd "$(dirname "$0")/backend"
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
