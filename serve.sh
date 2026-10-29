#!/bin/sh
# Try the app on your computer: ./serve.sh  then open http://localhost:8080
cd "$(dirname "$0")/app" && python3 -m http.server 8080
