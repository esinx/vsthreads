import sys

sys.path.append(r"./vendor")

import json
from typing import Annotated, List

from openai import OpenAI
from bson import ObjectId, json_util
from fastapi import Depends, FastAPI
from fastapi.security import OAuth2PasswordBearer


# @thread:660972c4396cb3bebfa2eafc
from pymongo.mongo_client import MongoClient
from mangum import Mangum

from scripts.settings.config import DB_SETTINGS
from src.auth import get_current_user
from src.models import ReactionModel, SubThreadModel, ThreadModel, ThreadPatchModel, GenerateModel

app = FastAPI(prefix="/api")


client = MongoClient(DB_SETTINGS["uri"])
db = client.get_database("vsthreads")
thread_collection = db.get_collection("threads")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


@app.get("/")
def read_root():
    return {
        "message": "Welcome to the VS Threads API!",
        "authors": "Made with ❤️ at HackPrinceton by Eunsoo Shin, Julian Weng, and Jesse Zong",
    }


# New thread from comment
@app.post("/threads")
def make_new_thread(thread: ThreadModel, token: Annotated[str, Depends(oauth2_scheme)]):
    user = None
    try:
        user = get_current_user(token)
    except Exception as e:
        return {"message": "Invalid token"}
    if user is None or not user["login"]:
        return {"message": "Invalid token"}
    author = user["login"]
    email = user["email"]
    profile_picture = user["avatar_url"]
    # set values from oauth call
    thread.author = author
    thread.email = email
    thread.profile_picture = profile_picture
    new_thread = thread_collection.insert_one(thread.model_dump())
    return {"_id": str(new_thread.inserted_id)}


# Append to existing thread
# Two options for param: root thread or latest
# We do latest since client would have full thread history anyways
@app.post("/threads/{parent_id}")
def append_thread(
    parent_id: str, thread: SubThreadModel, token: Annotated[str, Depends(oauth2_scheme)]
):
    parent_object_id = None
    try:
        parent_object_id = ObjectId(parent_id)
    except Exception as e:
        return {"message": "Invalid thread ID"}
    if parent_object_id is None:
        return {"message": "Invalid thread ID"}
    parent = thread_collection.find_one({"_id": parent_object_id})
    if thread is None or thread.is_archived:
        return {"message": "Thread not found"}
    thread.parent = parent_id
    thread.repo = parent["repo"]
    new_thread = make_new_thread(thread, token)
    if "_id" not in new_thread:
        return new_thread
    new_id = new_thread["_id"]
    parent["children"].append(ObjectId(new_id))
    updated_thread = thread_collection.update_one({"_id": parent_object_id}, {"$set": parent})
    return {"_id": str(new_id)}


@app.get("/threads/{thread_id}")
def read_thread(thread_id):
    object_id = None
    try:
        object_id = ObjectId(thread_id)
    except Exception as e:
        return {"message": "Invalid thread ID"}
    if object_id is None:
        return {"message": "Invalid thread ID"}
    # thread = thread_collection.find_one({"_id": object_id})
    # Make aggregation pipeline to get all deep children given .children array
    threads = thread_collection.aggregate(
        [
            {"$match": {"_id": object_id}},
            {
                "$graphLookup": {
                    "from": "threads",
                    "startWith": "$children",
                    "connectFromField": "children",
                    "connectToField": "_id",
                    "as": "subthreads",
                    "depthField": "depth",
                    "maxDepth": 100,
                }
            },
        ]
    )
    if threads is None:
        return {"message": "Thread not found"}
    print(type(threads))
    return json.loads(json_util.dumps(threads))


# Patch existing thread
# Any arbitrary id
@app.patch("/threads/{thread_id}")
def patch_thread(
    thread_id: str, content: ThreadPatchModel, token: Annotated[str, Depends(oauth2_scheme)]
):
    object_id = None
    try:
        object_id = ObjectId(thread_id)
    except Exception as e:
        return {"message": "Invalid thread ID"}
    if object_id is None:
        return {"message": "Invalid thread ID"}
    user = None
    try:
        user = get_current_user(token)
    except Exception as e:
        return {"message": "Invalid token"}
    obj = thread_collection.find_one({"_id": object_id})
    if obj is None or obj["is_archived"]:
        return {"message": "Thread not found"}
    if user is None or user["login"] != obj["author"]:
        return {"message": "Unauthorized"}
    updated_thread = thread_collection.update_one(
        {"_id": object_id}, {"$set": {"content": content.content}}
    )
    return {"_id": str(object_id)}


@app.delete("/threads/{thread_id}")
def delete_thread(thread_id: str, token: Annotated[str, Depends(oauth2_scheme)]):
    object_id = None
    try:
        object_id = ObjectId(thread_id)
    except Exception as e:
        return {"message": "Invalid thread ID"}
    if object_id is None:
        return {"message": "Invalid thread ID"}
    user = None
    try:
        user = get_current_user(token)
    except Exception as e:
        return {"message": "Invalid token"}
    obj = thread_collection.find_one({"_id": object_id})
    if obj is None or obj["is_archived"]:
        return {"message": "Thread not found"}
    if user is None or user["login"] != obj["author"]:
        return {"message": "Unauthorized"}
    updated_thread = thread_collection.update_one(
        {"_id": object_id}, {"$set": {"is_archived": True, "content": "[deleted]"}}
    )
    return {"_id": str(object_id)}


# @thread:6608fcccac2658819b1b5140


@app.post("/threads/{thread_id}/reactions")
def add_reaction(
    thread_id: str, reaction: ReactionModel, token: Annotated[str, Depends(oauth2_scheme)]
):
    object_id = None
    try:
        object_id = ObjectId(thread_id)
    except Exception as e:
        return {"message": "Invalid thread ID"}
    if object_id is None:
        return {"message": "Invalid thread ID"}
    user = None
    try:
        user = get_current_user(token)
    except Exception as e:
        return {"message": "Invalid token"}
    if user is None or not user["login"]:
        return {"message": "Invalid token"}
    thread = thread_collection.find_one({"_id": object_id})
    if thread is None or thread["is_archived"]:
        return {"message": "Thread not found"}
    if reaction.reaction not in thread["reactions"]:
        thread["reactions"][reaction.reaction] = []
    if user["login"] in thread["reactions"][reaction.reaction]:
        return {"message": "Reaction already exists"}
    thread["reactions"][reaction.reaction].append(user["login"])
    updated_thread = thread_collection.update_one({"_id": object_id}, {"$set": thread})
    return {"_id": str(object_id)}


# @thread:6608efeb90755c0cfc80dc56

@app.delete("/threads/{thread_id}/reactions")
def remove_reaction(
    thread_id: str, reaction: ReactionModel, token: Annotated[str, Depends(oauth2_scheme)]
):
    object_id = None
    try:
        object_id = ObjectId(thread_id)
    except Exception as e:
        return {"message": "Invalid thread ID"}
    if object_id is None:
        return {"message": "Invalid thread ID"}
    thread = thread_collection.find_one({"_id": object_id})
    user = None
    try:
        user = get_current_user(token)
    except Exception as e:
        return {"message": "Invalid token"}
    if user is None or not user["login"]:
        return {"message": "Invalid token"}
    if thread is None or thread["is_archived"]:
        return {"message": "Thread not found"}
    if reaction.reaction not in thread["reactions"]:
        return {"message": "Reaction does not exist"}
    if user["login"] not in thread["reactions"][reaction.reaction]:
        return {"message": "Reaction does not exist"}
    thread["reactions"][reaction.reaction].remove(user["login"])
    if len(thread["reactions"][reaction.reaction]) == 0:
        del thread["reactions"][reaction.reaction]
    updated_thread = thread_collection.update_one({"_id": object_id}, {"$set": thread})
    return {"_id": str(object_id)}

client = OpenAI()

@app.post("/generate")
def generate(prompt: GenerateModel):
    return client.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=[{"role": "user", "content": prompt.input}]
    )

# @thread:6608f3de036f5763a48d0731

handler = Mangum(
    app,
    lifespan="auto",
    api_gateway_base_path="/",
)
