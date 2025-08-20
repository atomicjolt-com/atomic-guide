#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "python-dotenv",
# ]
# ///

import json
import os
import sys
from pathlib import Path
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional


def log_status_line(input_data, status_line_output, error_message=None):
    """Log status line event to logs directory."""
    # Ensure logs directory exists
    log_dir = Path("logs")
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "status_line.json"

    # Read existing log data or initialize empty list
    if log_file.exists():
        with open(log_file, "r") as f:
            try:
                log_data = json.load(f)
            except (json.JSONDecodeError, ValueError):
                log_data = []
    else:
        log_data = []

    # Create log entry with input data and generated output
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "version": "combined",
        "input_data": input_data,
        "status_line_output": status_line_output,
    }

    if error_message:
        log_entry["error"] = error_message

    # Append the log entry
    log_data.append(log_entry)

    # Write back to file with formatting
    with open(log_file, "w") as f:
        json.dump(log_data, f, indent=2)


def get_session_data(input_data):
    """Get session data including prompts from transcript file."""
    transcript_path = input_data.get("transcript_path")
    
    if not transcript_path:
        return None, "No transcript path provided"
    
    transcript_file = Path(transcript_path)
    if not transcript_file.exists():
        return None, f"Transcript file {transcript_file} does not exist"

    try:
        prompts = []
        with open(transcript_file, "r") as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    # Extract user messages (prompts)
                    if entry.get("type") == "user" and "message" in entry:
                        message = entry["message"]
                        if isinstance(message.get("content"), str):
                            prompts.append(message["content"])
                        elif isinstance(message.get("content"), list):
                            # Handle multi-part content (like tool results)
                            text_parts = []
                            for part in message["content"]:
                                if isinstance(part, dict) and part.get("type") == "text":
                                    text_parts.append(part.get("text", ""))
                                elif isinstance(part, str):
                                    text_parts.append(part)
                            if text_parts:
                                prompts.append(" ".join(text_parts))
                except json.JSONDecodeError:
                    continue
        
        return {"prompts": prompts, "agent_name": "Agent"}, None
    except Exception as e:
        return None, f"Error reading transcript file: {str(e)}"


def truncate_prompt(prompt, max_length=250):
    """Truncate prompt to specified length."""
    # Remove newlines and excessive whitespace
    prompt = " ".join(prompt.split())

    if len(prompt) > max_length:
        return prompt[: max_length - 3] + "..."
    return prompt


def get_prompt_color_and_icon(prompt):
    """Get color and icon based on prompt type."""
    if prompt.startswith("/"):
        # Command prompt - yellow
        return "\033[33m", "⚡"
    elif "?" in prompt:
        # Question - blue
        return "\033[34m", "❓"
    elif any(
        word in prompt.lower()
        for word in ["create", "write", "add", "implement", "build"]
    ):
        # Creation task - green
        return "\033[32m", "💡"
    elif any(word in prompt.lower() for word in ["fix", "debug", "error", "issue"]):
        # Fix/debug task - red
        return "\033[31m", "🐛"
    elif any(word in prompt.lower() for word in ["refactor", "improve", "optimize"]):
        # Refactor task - magenta
        return "\033[35m", "♻️"
    else:
        # Default - white
        return "\033[37m", "💬"


def generate_status_line(input_data):
    """Generate the combined status line."""
    # Get model name
    model_info = input_data.get("model", {})
    model_name = model_info.get("display_name", "Claude")

    # Get session data
    session_data, error = get_session_data(input_data)

    if error:
        # Log the error but show a default message
        log_status_line(input_data, f"[Agent] [{model_name}] 💭 No session data", error)
        return f"\033[91m[Agent]\033[0m \033[34m[{model_name}]\033[0m \033[90m💭 No session data\033[0m"

    # Extract agent name and prompts
    agent_name = session_data.get("agent_name", "Agent")
    prompts = session_data.get("prompts", [])

    # Build status line components
    parts = []

    # Agent name - Bright Red
    parts.append(f"\033[91m[{agent_name}]\033[0m")

    # Model name - Blue
    parts.append(f"\033[34m[{model_name}]\033[0m")

    if prompts:
        # Latest prompt - full 250 chars with color coding
        latest_prompt = prompts[-1]
        prompt_color, icon = get_prompt_color_and_icon(latest_prompt)
        truncated_latest = truncate_prompt(latest_prompt, 250)
        parts.append(f"{icon} {prompt_color}{truncated_latest}\033[0m")

        # Previous prompt - gray, shorter
        if len(prompts) > 1:
            prev_prompt = prompts[-2]
            truncated_prev = truncate_prompt(prev_prompt, 100)
            parts.append(f"\033[90m{truncated_prev}\033[0m")

        # Two prompts ago - darker gray, shortest
        if len(prompts) > 2:
            older_prompt = prompts[-3]
            truncated_older = truncate_prompt(older_prompt, 75)
            parts.append(f"\033[90m{truncated_older}\033[0m")
    else:
        parts.append("\033[90m💭 No prompts yet\033[0m")

    # Join with separator
    status_line = " | ".join(parts)

    return status_line


def main():
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())

        # Generate status line
        status_line = generate_status_line(input_data)

        # Log the status line event (without error since it's successful)
        log_status_line(input_data, status_line)

        # Output the status line (first line of stdout becomes the status line)
        print(status_line)

        # Success
        sys.exit(0)

    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully - output basic status
        print("\033[91m[Agent]\033[0m \033[34m[Claude]\033[0m \033[31m💭 JSON Error\033[0m")
        sys.exit(0)
    except Exception as e:
        # Handle any other errors gracefully - output basic status
        print(f"\033[91m[Agent]\033[0m \033[34m[Claude]\033[0m \033[31m💭 Error: {str(e)}\033[0m")
        sys.exit(0)


if __name__ == "__main__":
    main()