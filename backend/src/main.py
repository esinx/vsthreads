from fastapi import FastAPI
from pymongo.mongo_client import MongoClient
from motor import motor_asyncio
import os


app = FastAPI()
print(os.environ["MONGO_URI_DEV"])
client = motor_asyncio.AsyncIOMotorClient(os.environ["MONGO_URI_DEV"])
db = client.get_database("vsthreads")
user_collection = db.get_collection("users")
thread_collection = db.get_collection("threads")
# client = MongoClient(os.environ["MONGO_URI_DEV"])


@app.get("/")
def read_root():
    return {"Hello": "World"}
