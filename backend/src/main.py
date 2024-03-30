import sys
sys.path.append(r'./vendor')

import json
from typing import List

from bson import ObjectId, json_util
from fastapi import FastAPI
from pymongo.mongo_client import MongoClient

from scripts.settings.config import DB_SETTINGS
from src.models import ReactionModel, ThreadModel, ThreadPatchModel

app = FastAPI(prefix="/api")

client = MongoClient(DB_SETTINGS["uri"])
db = client.get_database("vsthreads")
thread_collection = db.get_collection("threads")


@app.get("/")
def read_root():
    return {
        "message": "Welcome to the VS Threads API!",
        "authors": "Made with ❤️ at HackPrinceton by Eunsoo Shin, Julian Weng, and Jesse Zong",
    }


# New thread from comment
@app.post("/threads")
def make_new_thread(thread: ThreadModel):
    user = thread.author
    # Oauth bs
    email = "oauth@dummy.com"
    profile_picture = "https://dummy.com"
    # set values from oauth call
    thread.email = email
    thread.profile_picture = profile_picture

    new_thread = thread_collection.insert_one(thread.model_dump())
    return {"_id": str(new_thread.inserted_id)}


# Append to existing thread
# Two options for param: root thread or latest
# We do latest since client would have full thread history anyways
@app.post("/threads/{parent_id}")
def append_thread(parent_id: str, thread: ThreadModel):
    parent_object_id = ObjectId(parent_id)
    parent = thread_collection.find_one({"_id": parent_object_id})
    if thread is None or thread["is_archived"]:
        return {"message": "Thread not found"}
    thread["parent"] = parent_id
    new_id = make_new_thread(thread)["_id"]
    print(type(parent["children"]))
    parent["children"].append(ObjectId(new_id))
    updated_thread = thread_collection.update_one({"_id": parent_object_id}, {"$set": parent})
    return {"_id": str(new_id)}


@app.get("/threads/{thread_id}")
def read_thread(thread_id):
    object_id = ObjectId(thread_id)
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
def patch_thread(thread_id: str, content: ThreadPatchModel):
    object_id = ObjectId(thread_id)
    obj = thread_collection.find_one({"_id": object_id})
    if obj is None or obj["is_archived"]:
        return {"message": "Thread not found"}
    updated_thread = thread_collection.update_one(
        {"_id": object_id}, {"$set": {"content": content.content}}
    )
    return {"_id": str(object_id)}


@app.delete("/threads/{thread_id}")
def delete_thread(thread_id: str):
    object_id = ObjectId(thread_id)
    obj = thread_collection.find_one({"_id": object_id})
    if obj is None or obj["is_archived"]:
        return {"message": "Thread not found"}
    updated_thread = thread_collection.update_one(
        {"_id": object_id}, {"$set": {"is_archived": True, "content": "[deleted]"}}
    )


@app.post("/threads/{thread_id}/reactions")
def add_reaction(thread_id: str, reaction: ReactionModel):
    object_id = ObjectId(thread_id)
    thread = thread_collection.find_one({"_id": object_id})
    if thread is None or thread["is_archived"]:
        return {"message": "Thread not found"}
    if reaction.reaction not in thread["reactions"]:
        thread["reactions"][reaction.reaction] = []
    if reaction.user in thread["reactions"][reaction.reaction]:
        return {"message": "Reaction already exists"}
    thread["reactions"][reaction.reaction].append(reaction.user)
    updated_thread = thread_collection.update_one({"_id": object_id}, {"$set": thread})
    return {"_id": str(object_id)}


@app.delete("/threads/{thread_id}/reactions")
def remove_reaction(thread_id: str, reaction: ReactionModel):
    object_id = ObjectId(thread_id)
    thread = thread_collection.find_one({"_id": object_id})
    if thread is None or thread["is_archived"]:
        return {"message": "Thread not found"}
    if reaction.reaction not in thread["reactions"]:
        return {"message": "Reaction does not exist"}
    if reaction.user not in thread["reactions"][reaction.reaction]:
        return {"message": "Reaction does not exist"}
    thread["reactions"][reaction.reaction].remove(reaction.user)
    if len(thread["reactions"][reaction.reaction]) == 0:
        del thread["reactions"][reaction.reaction]
    updated_thread = thread_collection.update_one({"_id": object_id}, {"$set": thread})
    return {"_id": str(object_id)}
