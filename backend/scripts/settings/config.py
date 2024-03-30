import os

from dotenv import load_dotenv

load_dotenv()

DB_SETTINGS = {"uri": os.getenv("MONGO_URI")}
