from pydantic import BaseModel


class UserModel(BaseModel):
    id: int
