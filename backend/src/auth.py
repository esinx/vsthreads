import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

# simply, we will redirect the oauth2 header from a frontend request to the github api
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def get_current_user(token: str = Depends(oauth2_scheme)):
    user = None
    try:
        with httpx.Client() as client:
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
