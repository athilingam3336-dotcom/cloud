"""
=========================================
CloudCrackers
User Agent Parsing Utility
=========================================
"""

def parse_user_agent(user_agent_str: str | None) -> tuple[str, str, str]:
    if not user_agent_str:
        return "Unknown", "Unknown", "Unknown"

    # OS Identification
    os_name = "Unknown OS"
    if "Windows" in user_agent_str:
        os_name = "Windows"
    elif "Macintosh" in user_agent_str or "Mac OS X" in user_agent_str:
        os_name = "macOS"
    elif "Linux" in user_agent_str:
        os_name = "Linux"
    elif "Android" in user_agent_str:
        os_name = "Android"
    elif "iPhone" in user_agent_str or "iPad" in user_agent_str:
        os_name = "iOS"

    # Browser Identification
    browser_name = "Unknown Browser"
    if "Firefox" in user_agent_str:
        browser_name = "Firefox"
    elif "Chrome" in user_agent_str and "Safari" in user_agent_str and "Edge" not in user_agent_str and "Edg" not in user_agent_str:
        browser_name = "Chrome"
    elif "Safari" in user_agent_str and "Chrome" not in user_agent_str:
        browser_name = "Safari"
    elif "Edge" in user_agent_str or "Edg" in user_agent_str:
        browser_name = "Edge"
    elif "MSIE" in user_agent_str or "Trident" in user_agent_str:
        browser_name = "Internet Explorer"

    # Device Classification
    device_name = "Desktop"
    if "Mobile" in user_agent_str:
        device_name = "Mobile"
    elif "Tablet" in user_agent_str or "iPad" in user_agent_str:
        device_name = "Tablet"

    return browser_name, device_name, os_name
