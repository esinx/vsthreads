from fastapi import FastAPI
from pymongo.mongo_client import MongoClient

from scripts.settings.config import DB_SETTINGS

app = FastAPI()

client = MongoClient(DB_SETTINGS["uri"])
db = client.get_database("vsthreads")
user_collection = db.get_collection("users")
thread_collection = db.get_collection("threads")


@app.get("/api/")
def read_root():
    return {
        "message": "Welcome to the VS Threads API!",
        "authors": "Made with ❤️ at HackPrinceton by Eunsoo Shin, Julian Weng, and Jesse Zong",
    }
