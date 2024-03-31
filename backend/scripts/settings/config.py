import os

from dotenv import load_dotenv

load_dotenv()
# @thread:6609177ae7cfd4b5e6727298

DB_SETTINGS = {"uri": os.getenv("MONGO_URI")}
