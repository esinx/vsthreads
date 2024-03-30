import os

import httpx
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

load_dotenv()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
GITHUB_TOKEN = os.getenv("GIT_ACCESS_TOKEN")


def get_current_user(token: str = Depends(oauth2_scheme)):
    user = None
    try:
        with httpx.Client() as client:
            print(token)
            response = client.get(
                "https://api.github.com/user",
                headers={
                    "Accept": "application/vnd.github+json",
                    "Authorization": f"Bearer {token}",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            response.raise_for_status()
            user = response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.json())
    return user


print(get_current_user(GITHUB_TOKEN))
