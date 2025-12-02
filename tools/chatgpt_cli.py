#!/usr/bin/env python3
import os
import json
import urllib.request

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    print("Set OPENAI_API_KEY environment variable first.")
    exit(1)

print("ChatGPT Minimal CLI (type 'exit' to quit)\n")

messages = []

while True:
    user_input = input("You: ")
    if user_input.lower() in ["exit", "quit"]:
        print("Goodbye!")
        break

    messages.append({"role": "user", "content": user_input})

    data = {
        "model": "gpt-4-mini",
        "messages": messages
    }

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.load(response)
            reply = result["choices"][0]["message"]["content"].strip()
            print(f"GPT: {reply}\n")
            messages.append({"role": "assistant", "content": reply})
    except Exception as e:
        print(f"Error: {e}")
