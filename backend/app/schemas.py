from pydantic import BaseModel, Field, field_validator, model_validator


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class ColumnRename(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title must not be empty")
        return trimmed


class CardCreate(BaseModel):
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


class CardUpdate(BaseModel):
    title: str | None = None
    details: str | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "CardUpdate":
        if self.title is None and self.details is None:
            raise ValueError("at least one field is required")
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


class CardMove(BaseModel):
    column_id: str
    position: int = Field(ge=0)
