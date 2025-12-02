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
            print(f"GPT: {reply}\n")
            messages.append({"role": "assistant", "content": reply})
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}")
        print(e.read().decode())
    except Exception as e:
        print(f"Error: {e}")