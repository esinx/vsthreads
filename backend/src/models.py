from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.functional_validators import BeforeValidator
from typing_extensions import Annotated

PyObjectId = Annotated[str, BeforeValidator(str)]


class ThreadModel(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    repo: str = Field(...)
    author: str = Field(...)
    email: EmailStr = Field(default=None)
    profile_picture: str = Field(default=None)
    content: str = Field(...)
    upvotes: int = Field(default=0)
    downvotes: int = Field(default=0)
    children: List[PyObjectId] = []
