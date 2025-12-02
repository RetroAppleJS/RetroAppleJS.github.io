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
    """Convert markdown-like text to ANSI colors for terminal."""
    text = re.sub(r'\*\*(.+?)\*\*', COLOR_BOLD+r'\1'+COLOR_RESET, text)  # bold
    text = re.sub(r'\*(.+?)\*', COLOR_ITALIC+r'\1'+COLOR_RESET, text)    # italics
    text = re.sub(r'`(.+?)`', COLOR_CODE+r'\1'+COLOR_RESET, text)        # inline code
    return text


# =====================================
# Header
# =====================================
def show_header():
    print("\033c", end="")
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
        chunk = lines[i:i+PAGE]()
