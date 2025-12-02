#!/usr/bin/env python3
import os
import json
import readline
from openai import OpenAI

# -----------------------------
# CONFIG
# -----------------------------
API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    raise SystemExit("ERROR: OPENAI_API_KEY is not set")

client = OpenAI(api_key=API_KEY)

ACTIVE_MODEL = "gpt-4o-mini"      # ← Change this if desired

CONV_DIR = os.path.expanduser("~/.chatgpt_conversations")
os.makedirs(CONV_DIR, exist_ok=True)

# -----------------------------
# COLOR HELPERS
# -----------------------------
COLOR_USER = "\033[96m"      # cyan
COLOR_GPT = "\033[92m"       # green
COLOR_SYS = "\033[95m"       # purple
COLOR_RESET = "\033[0m"

# -----------------------------
# LOAD AVAILABLE MODELS
# -----------------------------
def load_available_models():
    try:
        response = client.models.list()
        return [m.id for m in response.data]
    except Exception:
        return ["unknown"]

AVAILABLE_MODELS = load_available_models()

# -----------------------------
# GROUP MODEL NAMES
# -----------------------------
def group_model_names(model_list):
    groups = {}

    for name in model_list:
        parts = name.split("-")
        if len(parts) >= 2:
            group_key = "-".join(parts[:2])
        else:
            group_key = name
        
        groups.setdefault(group_key, []).append(name)

    # format: "gpt-4o (3), gpt-4.1 (2), gpt-3.5"
    formatted = []
    for key, items in groups.items():
        if len(items) > 1:
            formatted.append(f"{key} ({len(items)})")
        else:
            formatted.append(key)

    return ", ".join(sorted(formatted))

SHORT_MODELS = group_model_names(AVAILABLE_MODELS)

# -----------------------------
# SAVE / LOAD CONVERSATIONS
# -----------------------------
def list_saved_conversations():
    files = sorted(os.listdir(CONV_DIR))
    return [f for f in files if f.endswith(".json")]

def load_conversation(num):
    files = list_saved_conversations()
    if num < 1 or num > len(files):
        return None, None

    filename = files[num - 1]
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

# -----------------------------
# DISPLAY HEADER
# -----------------------------
def print_header():
    print("\n" * 5)  # 5-line header space
    print(f"{COLOR_SYS}Model: {ACTIVE_MODEL} | Available: {SHORT_MODELS}{COLOR_RESET}")

    files = list_saved_conversations()
    if files:
        print(f"{COLOR_SYS}Saved conversations:{COLOR_RESET}")
        for i, f in enumerate(files[:10], start=1):
            title = f.replace(".json", "")
            print(f"  {i}: {title}")
    else:
        print(f"{COLOR_SYS}(No saved conversations){COLOR_RESET}")

    print("\n" + "-"*80)

# -----------------------------
# MAIN CHAT LOOP
# -----------------------------
def chat():
    messages = []

    while True:
        print_header()

        user_input = input(f"{COLOR_USER}You: {COLOR_RESET}").strip()

        if user_input.lower() == "/quit":
            save_conversation(messages)
            print("Conversation saved. Exiting.")
            break

        if user_input.lower().startswith("/load"):
            try:
                num = int(user_input.split()[1])
                loaded, name = load_conversation(num)
                if loaded is None:
                    print("Invalid conversation number.")
                else:
                    messages = loaded
                    print(f"Loaded: {name}")
            except:
                print("Usage: /load <number>")
            continue

        # Add user msg
        messages.append({"role": "user", "content": user_input})

        # Send to OpenAI
        try:
            response = client.chat.completions.create(
                model=ACTIVE_MODEL,
                messages=messages
            )
            assistant_reply = response.choices[0].message["content"]
        except Exception as e:
            assistant_reply = f"[ERROR] {e}"

        # Add assistant response
        messages.append({"role": "assistant", "content": assistant_reply})

        print(f"{COLOR_GPT}GPT: {assistant_reply}{COLOR_RESET}")


if __name__ == "__main__":
    chat()
