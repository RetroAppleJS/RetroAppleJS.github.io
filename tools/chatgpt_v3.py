#!/usr/bin/env python3
import os
import json
import urllib.request

# ----------------------------
# Configuration
# ----------------------------
API_KEY = os.environ.get("OPENAI_API_KEY")
HISTORY_FILE = os.path.expanduser("~/chat_history.txt")

# ANSI colors
COLOR_USER = "\033[1;34m"   # Bright Blue
COLOR_GPT = "\033[1;32m"    # Bright Green
COLOR_RESET = "\033[0m"

# Check API key
if not API_KEY:
    print("Error: Set your OpenAI API key in the environment variable OPENAI_API_KEY")
    exit(1)

# Load conversation history if exists
messages = []
if os.path.exists(HISTORY_FILE):
    try:
        with open(HISTORY_FILE, "r") as f:
            messages = json.load(f)
            print(f"{COLOR_GPT}[Loaded previous conversation]{COLOR_RESET}\n")
    except Exception:
        messages = []

print("ChatGPT Terminal Client (type 'exit' or 'quit' to exit)\n")

# ----------------------------
# Main loop
# ----------------------------
while True:
    try:
        user_input = input(f"{COLOR_USER}You: {COLOR_RESET}")
    except EOFError:
        print("\nGoodbye!")
        break

    if user_input.lower() in ["exit", "quit"]:
        print("Goodbye!")
        break

    messages.append({"role": "user", "content": user_input})

    # Build API request
    data = json.dumps({
        "model": "gpt-3.5-turbo",
        "messages": messages
    }).encode("utf-8")

    req = urllib.request.Request(
        url="https://api.openai.com/v1/chat/completions",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.load(response)
            reply = result["choices"][0]["message"]["content"].strip()
            print(f"{COLOR_GPT}GPT: {reply}{COLOR_RESET}\n")
            messages.append({"role": "assistant", "content": reply})

        # Save conversation
        with open(HISTORY_FILE, "w") as f:
            json.dump(messages, f)

    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}")
        print(e.read().decode())
    except Exception as e:
        print(f"Error: {e}")
