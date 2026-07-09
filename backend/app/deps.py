from typing import Annotated

from fastapi import Depends, Header, HTTPException

from app.database import BoardError, NotFoundError, get_user_id


def get_current_username(
    x_user: Annotated[str | None, Header(alias="X-User")] = None,
) -> str:
    if not x_user:
        raise HTTPException(status_code=401, detail="Missing X-User header")
    return x_user


def require_known_user(
    username: Annotated[str, Depends(get_current_username)],
) -> str:
    return username
