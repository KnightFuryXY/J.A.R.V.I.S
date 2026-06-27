import sys
from pathlib import Path

# Add actions to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from actions.send_message import get_api_config, _send_whatsapp_api

def test_config_loading():
    config = get_api_config()
    print(f"Config keys: {list(config.keys())}")
    if "whatsapp_phone_id" in config:
        print("whatsapp_phone_id found")
    if "whatsapp_token" in config:
        print("whatsapp_token found")

def test_memory_lookup():
    # This should find "Huzefa" in the memory we just updated
    result = _send_whatsapp_api("Huzefa", "Memory lookup test")
    print(f"Result for Huzefa: {result}")

if __name__ == "__main__":
    test_config_loading()
    test_api_logic_no_keys()
    test_memory_lookup()
