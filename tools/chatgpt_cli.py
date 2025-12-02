import os
import openai

# Ensure API key is set
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("Error: OPENAI_API_KEY is not set.")
    exit(1)

openai.api_key = api_key

print("ChatGPT Terminal Client (type 'exit' to quit)\n")

messages = []

while True:
    user_input = input("You: ")
    if user_input.lower() in ["exit", "quit"]:
        print("Goodbye!")
        break

    messages.append({"role": "user", "content": user_input})

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4-mini",
            messages=messages
        )
        reply = response.choices[0].message["content"].strip()
        print(f"GPT: {reply}\n")
        messages.append({"role": "assistant", "content": reply})
    except Exception as e:
        print(f"Error: {e}")