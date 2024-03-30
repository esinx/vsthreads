from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.functional_validators import BeforeValidator
from typing_extensions import Annotated

PyObjectId = Annotated[str, BeforeValidator(str)]


class ThreadModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    repo: str = Field(...)
    author: str = Field(default=None)
    email: EmailStr = Field(default=None)
    profile_picture: str = Field(default=None)
    content: str = Field(...)
    reactions: Dict[str, list[str]] = Field(default_factory=dict)
    children: List[PyObjectId] = []
    parent: Optional[PyObjectId] = Field(default=None)
    is_archived: bool = Field(default=False)


class ThreadPatchModel(BaseModel):
    content: str = Field(...)


class ReactionModel(BaseModel):
    reaction: str = Field(max_length=1, min_length=1)
