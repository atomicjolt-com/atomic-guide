#!/usr/bin/env python3
"""
Session manager for Claude Code hooks.
Handles prompt capture and terminal title updates.
"""
import json
import sys
import os
import re

def load_hook_input():
    """Load JSON input from stdin."""
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

def get_session_file(session_id, file_type='prompt'):
    """Get the path to a session file."""
    return f"/tmp/claude_session_{session_id}_{file_type}.txt"

def capture_first_prompt(data):
    """Capture the first prompt for session title."""
    prompt = data.get('prompt', '')
    session_id = data.get('session_id', '')

    if not session_id or not prompt:
        return

    prompt_file = get_session_file(session_id, 'prompt')

    # Only capture if this is the first prompt
    if not os.path.exists(prompt_file):
        # Clean up the prompt for title use
        # Remove leading slash commands
        clean_prompt = re.sub(r'^/[a-zA-Z0-9_-]+\s*', '', prompt.strip())

        # If no prompt after removing slash command, use the command itself
        if not clean_prompt:
            match = re.match(r'^/([a-zA-Z0-9_-]+)', prompt.strip())
            if match:
                clean_prompt = match.group(1)
            else:
                clean_prompt = 'claude'

        # Truncate to 20 chars and remove newlines
        title_text = clean_prompt.replace('\n', ' ').strip()[:20]

        # Save for future use
        with open(prompt_file, 'w') as f:
            f.write(title_text if title_text else 'claude')

def get_session_title(session_id):
    """Get the stored session title or default."""
    prompt_file = get_session_file(session_id, 'prompt')

    if os.path.exists(prompt_file):
        with open(prompt_file, 'r') as f:
            return f.read().strip()

    return 'claude'

def set_terminal_title(title):
    """Set terminal window title using ANSI escape sequence."""
    # Use printf for better compatibility across different shells
    os.system(f'printf "\\033]0;{title}\\007"')

def main():
    data = load_hook_input()
    hook_event = data.get('hook_event_name', '')
    session_id = data.get('session_id', '')

    if not session_id:
        sys.exit(0)

    # Icons: ⚠️✅🏁⏳🔔⭐🚨🔴👍🎉⏹️
    if hook_event == 'UserPromptSubmit':
        # Capture first prompt for title
        capture_first_prompt(data)
        # Set title with working icon
        title = get_session_title(session_id)
        set_terminal_title(f'⏳ {title}')

    elif hook_event == 'Notification':
        # Show notification icon
        title = get_session_title(session_id)
        set_terminal_title(f'🔔 {title}')

    elif hook_event == 'Stop':
        # Show completion
        title = get_session_title(session_id)
        set_terminal_title(f'✅ {title}')

    elif hook_event == 'SessionStart':
        # Initialize session with default title
        set_terminal_title('🚀 claude')

    elif hook_event == 'SessionEnd':
        # Clean up session files
        prompt_file = get_session_file(session_id, 'prompt')
        if os.path.exists(prompt_file):
            os.remove(prompt_file)

if __name__ == '__main__':
    main()