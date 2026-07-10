"""Pydantic models for AI chat request/response and board operations."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas import BoardData


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("content must not be empty")
        return trimmed


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("message must not be empty")
        return trimmed


class CreateCardOp(BaseModel):
    type: Literal["create_card"]
    column_id: str
    title: str
    details: str = ""
    position: int | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title must not be empty")
        return trimmed


class UpdateCardOp(BaseModel):
    type: Literal["update_card"]
    card_id: str
    title: str | None = None
    details: str | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> UpdateCardOp:
        if self.title is None and self.details is None:
            raise ValueError("at least one of title or details is required")
        return self

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title must not be empty")
        return trimmed


class DeleteCardOp(BaseModel):
    type: Literal["delete_card"]
    card_id: str


class MoveCardOp(BaseModel):
    type: Literal["move_card"]
    card_id: str
    column_id: str
    position: int = Field(ge=0)


class RenameColumnOp(BaseModel):
    type: Literal["rename_column"]
    column_id: str
    title: str

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title must not be empty")
        return trimmed


AiOperation = Annotated[
    CreateCardOp | UpdateCardOp | DeleteCardOp | MoveCardOp | RenameColumnOp,
    Field(discriminator="type"),
]


class AiModelResponse(BaseModel):
    message: str
    operations: list[AiOperation] = Field(default_factory=list)

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("message must not be empty")
        return trimmed


class ChatResponse(BaseModel):
    message: str
    board: BoardData | None = None
