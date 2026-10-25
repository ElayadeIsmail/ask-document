import os

# Keep pytest from downloading Hugging Face weights during app startup.
os.environ["PRELOAD_MODELS"] = "false"
os.environ["RESUME_ON_STARTUP"] = "false"
