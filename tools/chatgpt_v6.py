#!/usr/bin/env python3
import os
import json
import glob
import urllib.request
import urllib.error


def get_available_models():
    """Return a list of model IDs accessible with the current API key."""
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


# =====================================
# Configuration
# =====================================
API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = "gpt-4.1-mini"   # <--- Change model here
CONV_DIR = os.path.expanduser("~/chatgpt_conversations")

# ANSI Colors
COLOR_USER = "\033[1;34m"
COLOR_GPT = "\033[1;32m"
COLOR_HEADER = "\033[1;33m"
COLOR_RESET = "\033[0m"

if not os.path.exists(CONV_DIR):
    os.makedirs(CONV_DIR)

AVAILABLE_MODELS = get_available_models()

# =====================================
# Helpers
# =====================================

def group_model_names(models):
    """
    Group models by prefix up to the second dash.
    Example: 'gpt-5.1-mini' → 'gpt-5.1'
    """
    grouped = {}

    for m in models:
        parts = m.split("-")
        if len(parts) >= 2:
            # prefix is first two components joined with a dash
            prefix = "-".join(parts[:2])
        else:
            prefix = m  # fallback

        grouped.setdefault(prefix, 0)
        grouped[prefix] += 1

    # Convert to display format
    display_list = []
    for prefix, count in grouped.items():
        if count == 1:
            display_list.append(prefix)
        else:
            display_list.append(f"{prefix} ({count})")

    return ", ".join(sorted(display_list))


def list_conversations():
    """Return sorted list of conversation filenames."""
    files = sorted(glob.glob(os.path.join(CONV_DIR, "*.json")))
    return files[-10:]   # only last 10


def load_conversation(n):
    """Load a conversation by number."""
    fname = os.path.join(CONV_DIR, f"{n:04d}.json")
    if not os.path.exists(fname):
        return None
    with open(fname, "r") as f:
        return json.load(f)


def save_conversation(messages):
    """Save conversation with automatic numbering."""
    files = sorted(glob.glob(os.path.join(CONV_DIR, "*.json")))
    if files:
        last_num = int(os.path.basename(files[-1]).split(".")[0])
    else:
        last_num = 0

    fname = os.path.join(CONV_DIR, f"{last_num+1:04d}.json")
    with open(fname, "w") as f:
        json.dump(messages, f, indent=2)


def show_header():
    print("\033c", end="")  # clear screen
    print(COLOR_HEADER + "=" * 60)

    #avail = ", ".join(AVAILABLE_MODELS)
    #print(f" Model: {MODEL} | Available: {avail}")

    short_models = group_model_names(available_models)
    print(f"Model: {active_model} | Available: {short_models}")

    print(" Recent Conversations:")
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

    print("=" * 60 + COLOR_RESET)
    print()  # 2 blank lines


# =====================================
# Main loop
# =====================================

def run_conversation(messages):
    """Main interactive loop for a conversation."""
    while True:
        show_header()
        print(COLOR_GPT + "(Type /help for commands)" + COLOR_RESET)

        user_input = input(f"{COLOR_USER}You: {COLOR_RESET}")

        # Commands
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
                loaded = load_conversation(n)
                if loaded is None:
                    print("Conversation not found.")
                else:
                    messages.clear()
                    messages.extend(loaded)
                    print(f"Loaded conversation {n}.")
            except:
                print("Invalid load command.")
            input("Press ENTER to continue...")
            continue

        # Add user message
        messages.append({"role": "user", "content": user_input})

        # Build API request
        data = json.dumps({
            "model": MODEL,
            "messages": messages
        }).encode("utf-8")

        req = urllib.request.Request(
            url="https://api.openai.com/v1/chat/completions",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {API_KEY}"
            }
        )

        # Perform request
        try:
            with urllib.request.urlopen(req) as response:
                result = json.load(response)
                reply = result["choices"][0]["message"]["content"].strip()
                messages.append({"role": "assistant", "content": reply})
                print(f"{COLOR_GPT}GPT: {reply}{COLOR_RESET}\n")
                input("Press ENTER to continue...")
        except urllib.error.HTTPError as e:
            print("HTTP Error:", e.code)
            print(e.read().decode())
            input("Press ENTER to continue...")
        except Exception as e:
            print("Error:", e)
            input("Press ENTER to continue()...")


# =====================================
# Start
# =====================================

if not API_KEY:
    print("ERROR: Set your API key: export OPENAI_API_KEY=xxxxx")
    exit(1)

# Start with an empty conversation
messages = []
run_conversation(messages)
