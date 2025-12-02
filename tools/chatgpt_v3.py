#!/usr/bin/env python3
import os
import json
import glob
import urllib.request
import urllib.error
import re

# =====================================
# Configuration
# =====================================
API_KEY = os.environ.get("OPENAI_API_KEY")
ACTIVE_MODEL = "gpt-4.1-mini"   # Change if needed
CONV_DIR = os.path.expanduser("~/chatgpt_conversations")
PAGE_LINES = 15   # lines per page when scrolling long output

# ANSI Colors
COLOR_USER = "\033[1;34m"
COLOR_GPT = "\033[1;32m"
COLOR_HEADER = "\033[1;33m"
COLOR_RESET = "\033[0m"
COLOR_BOLD = "\033[1m"
COLOR_ITALIC = "\033[4m"
COLOR_CODE = "\033[7m"  # reverse video

if not os.path.exists(CONV_DIR):
    os.makedirs(CONV_DIR)

# =====================================
# API Helpers
# =====================================
def get_available_models():
    req = urllib.request.Request(
        url="https://api.openai.com/v1/models",
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.load(resp)
            return sorted([m["id"] for m in data.get("data", [])])
    except:
        return ["(unavailable)"]

AVAILABLE_MODELS = get_available_models()


def group_model_names(model_list):
    groups = {}
    for name in model_list:
        parts = name.split("-")
        key = "-".join(parts[:2]) if len(parts) >= 2 else name
        groups.setdefault(key, []).append(name)
    formatted = []
    for key, items in groups.items():
        formatted.append(f"{key}({len(items)})" if len(items)>1 else key)
    return ", ".join(sorted(formatted))

SHORT_MODELS = group_model_names(AVAILABLE_MODELS)


# =====================================
# Conversation helpers
# =====================================
def list_conversations():
    files = sorted(glob.glob(os.path.join(CONV_DIR, "*.json")))
    return files[-10:]

def list_saved_conversations():
    files = sorted(os.listdir(CONV_DIR))
    return [f for f in files if f.endswith(".json")]

def load_conversation(num):
    files = list_saved_conversations()
    if num < 1 or num > len(files):
        return None, None
    filename = files[num-1]
    path = os.path.join(CONV_DIR, filename)
    with open(path, "r") as f:
        data = json.load(f)
    return data.get("messages", []), filename

def save_conversation(messages):
    title = "conversation"
    index = len(list_saved_conversations()) + 1
    filename = f"{index:03d}-{title}.json"
    path = os.path.join(CONV_DIR, filename)
    with open(path, "w") as f:
        json.dump({"messages": messages}, f, indent=2)


# =====================================
# Markdown Rendering
# =====================================
def render_markdown(text):
    # Bold: **text**
    text = re.sub(r"\*\*(.*?)\*\*", COLOR_BOLD + r"\1" + COLOR_RESET, text)

    # Italic: *text*  → fallback to dim (safe for all terminals)
    text = re.sub(r"(?<!\*)\*(?!\*)(.*?)\*(?<!\*)",
                  "\033[2m" + r"\1" + COLOR_RESET, text)

    # Underline: __text__ → true underline
    text = re.sub(r"__(.*?)__",
                  "\033[4m" + r"\1" + COLOR_RESET, text)

    # Headings: # / ## / ###
    text = re.sub(r"^### (.*)$", COLOR_BOLD + r"\1" + COLOR_RESET, text, flags=re.MULTILINE)
    text = re.sub(r"^## (.*)$", COLOR_BOLD + r"\1" + COLOR_RESET, text, flags=re.MULTILINE)
    text = re.sub(r"^# (.*)$",  COLOR_BOLD + r"\1" + COLOR_RESET, text, flags=re.MULTILINE)

    return text


# =====================================
# Header
# =====================================
def show_header():
    # print("\033c", end="")  # <- REMOVE this
    print(COLOR_HEADER + "="*60)
    print(f" Model: {ACTIVE_MODEL} | Available: {SHORT_MODELS}")
    print("\n Recent Conversations:")

    convs = list_conversations()
    if not convs:
        print("   (none yet)")
    else:
        for f in convs:
            num = os.path.basename(f).split(".")[0]
            try:
                with open(f, "r") as fd:
                    msgs = json.load(fd)
                    title = msgs[0]['content'][:40] if msgs else "(empty)"
            except:
                title = "(unable to read)"
            print(f"   {num}: {title}")

    print("="*60 + COLOR_RESET)
    print("\n"*2)

# =====================================
# Scroll Output
# =====================================
def print_paginated(text):
    lines = text.splitlines()
    for i in range(0, len(lines), PAGE_LINES):
        chunk = lines[i:i+PAGE_LINES]
        print("\n".join(chunk))
        if i + PAGE_LINES < len(lines):
            input(COLOR_GPT + "--- Press ENTER to continue ---" + COLOR_RESET)


# =====================================
# Main loop
# =====================================
def run_conversation(messages):
    while True:
        show_header()
        print(COLOR_GPT + "(Type /help for commands)" + COLOR_RESET)

        user_input = input(f"{COLOR_USER}You: {COLOR_RESET}").strip()

        if user_input.lower() in ["/exit", "/quit"]:
            print("Goodbye!")
            exit(0)

        if user_input.lower() == "/help":
            print("""
Commands:
  /new          Start a new empty conversation
  /save         Save the current conversation
  /load N       Load conversation number N
  /quit         Quit
""")
            input("Press ENTER to continue...")
            continue

        if user_input.lower() == "/new":
            messages.clear()
            continue

        if user_input.lower() == "/save":
            save_conversation(messages)
            print("Saved.")
            input("Press ENTER to continue...")
            continue

        if user_input.startswith("/load "):
            try:
                n = int(user_input.split()[1])
                loaded, fname = load_conversation(n)
                if loaded is None:
                    print("Conversation not found.")
                else:
                    messages.clear()
                    messages.extend(loaded)
                    print(f"Loaded {fname}.")
            except:
                print("Invalid load command.")
            input("Press ENTER to continue...")
            continue

        # Add user message
        messages.append({"role":"user","content":user_input})

        # API request
        data = json.dumps({
            "model": ACTIVE_MODEL,
            "messages": messages
        }).encode("utf-8")

        req = urllib.request.Request(
            url="https://api.openai.com/v1/chat/completions",
            data=data,
            headers={
                "Content-Type":"application/json",
                "Authorization":f"Bearer {API_KEY}"
            }
        )

        try:
            with urllib.request.urlopen(req) as resp:
                result = json.load(resp)
                reply = result["choices"][0]["message"]["content"].strip()
                messages.append({"role":"assistant","content":reply})

                rendered = render_markdown(reply)
                print_paginated(COLOR_GPT + "GPT: " + rendered + COLOR_RESET)
        except urllib.error.HTTPError as e:
            print("HTTP Error:", e.code)
            print(e.read().decode())
            input("Press ENTER to continue...")
        except Exception as e:
            print("Error:", e)
            input("Press ENTER to continue...")


# =====================================
# Start
# =====================================
if not API_KEY:
    print("ERROR: Set your API key: export OPENAI_API_KEY=xxxxx")
    exit(1)

messages = []
run_conversation(messages)
