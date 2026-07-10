"""Kanban-aware AI chat: parse, validate, and apply board operations."""

from __future__ import annotations

import copy
import json
import re
import sqlite3
from uuid import uuid4

from pydantic import ValidationError

from app.ai_schemas import (
    AiModelResponse,
    AiOperation,
    ChatMessage,
    ChatResponse,
    CreateCardOp,
    DeleteCardOp,
    MoveCardOp,
    RenameColumnOp,
    UpdateCardOp,
)
from app.database import (
    BoardError,
    create_card,
    delete_card,
    get_board_for_user,
    move_card,
    rename_column,
    update_card,
)
from app.openrouter import chat_completion_messages
from app.schemas import BoardData, Card

SYSTEM_INSTRUCTIONS = """You are TaskPilot's Kanban assistant.
You help the user understand and update their board.

Respond with JSON only (no markdown fences) matching this schema:
{
  "message": "<string, required — reply shown to the user>",
  "operations": [ /* optional list of board ops */ ]
}

Allowed operations (use exact field names):
- {"type":"create_card","column_id":"<id>","title":"<non-empty>","details":"<optional>","position":<optional int>}
- {"type":"update_card","card_id":"<id>","title":"<optional>","details":"<optional>"}  // at least one of title/details
- {"type":"delete_card","card_id":"<id>"}
- {"type":"move_card","card_id":"<id>","column_id":"<target column id>","position":<int >= 0>}
- {"type":"rename_column","column_id":"<id>","title":"<non-empty>"}

Rules:
- Only use column and card ids from the current board JSON provided with this turn.
- The current board JSON is the source of truth; ignore any older board descriptions in conversation history.
- If the user only asks a question, return operations as [] or omit it.
- Prefer the smallest set of operations that fulfills the request.
- message must always be a clear natural-language reply.
"""


class AiParseError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class AiValidationError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def build_system_prompt(board: BoardData) -> str:
    board_json = board.model_dump_json()
    return (
        f"{SYSTEM_INSTRUCTIONS}\n\n"
        "Current board JSON (source of truth — ignore older board descriptions "
        f"in history):\n{board_json}"
    )


def build_openrouter_messages(
    board: BoardData,
    message: str,
    history: list[ChatMessage],
) -> list[dict[str, str]]:
    """Put the latest board after history so it is not overshadowed by prior turns."""
    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_INSTRUCTIONS},
    ]
    for item in history:
        messages.append({"role": item.role, "content": item.content})
    messages.append(
        {
            "role": "system",
            "content": (
                "Current board JSON (source of truth — ignore older board "
                f"descriptions in history):\n{board.model_dump_json()}"
            ),
        }
    )
    messages.append({"role": "user", "content": message})
    return messages


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    match = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", stripped, re.DOTALL)
    if match:
        return match.group(1).strip()
    # Fallback: drop first/last fence lines
    lines = stripped.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def parse_ai_response(text: str) -> AiModelResponse:
    cleaned = _strip_code_fence(text)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AiParseError(f"Model returned invalid JSON: {exc}") from exc
    try:
        return AiModelResponse.model_validate(data)
    except ValidationError as exc:
        raise AiParseError(f"Model JSON failed schema validation: {exc}") from exc


def _column_ids(board: BoardData) -> set[str]:
    return {column.id for column in board.columns}


def _find_column(board: BoardData, column_id: str):
    for column in board.columns:
        if column.id == column_id:
            return column
    return None


def validate_operations(board: BoardData, operations: list[AiOperation]) -> None:
    """Validate ops against board, simulating sequential effects. Raises AiValidationError."""
    state = copy.deepcopy(board)

    for index, op in enumerate(operations):
        label = f"operations[{index}]"
        if isinstance(op, CreateCardOp):
            if op.column_id not in _column_ids(state):
                raise AiValidationError(f"{label}: unknown column_id {op.column_id!r}")
            column = _find_column(state, op.column_id)
            assert column is not None
            new_id = f"card-pending-{uuid4().hex[:8]}"
            insert_at = len(column.cardIds) if op.position is None else op.position
            insert_at = max(0, min(insert_at, len(column.cardIds)))
            column.cardIds.insert(insert_at, new_id)
            state.cards[new_id] = Card(id=new_id, title=op.title, details=op.details)

        elif isinstance(op, UpdateCardOp):
            if op.card_id not in state.cards:
                raise AiValidationError(f"{label}: unknown card_id {op.card_id!r}")
            card = state.cards[op.card_id]
            if op.title is not None:
                card.title = op.title
            if op.details is not None:
                card.details = op.details

        elif isinstance(op, DeleteCardOp):
            if op.card_id not in state.cards:
                raise AiValidationError(f"{label}: unknown card_id {op.card_id!r}")
            del state.cards[op.card_id]
            for column in state.columns:
                if op.card_id in column.cardIds:
                    column.cardIds.remove(op.card_id)

        elif isinstance(op, MoveCardOp):
            if op.card_id not in state.cards:
                raise AiValidationError(f"{label}: unknown card_id {op.card_id!r}")
            if op.column_id not in _column_ids(state):
                raise AiValidationError(f"{label}: unknown column_id {op.column_id!r}")
            for column in state.columns:
                if op.card_id in column.cardIds:
                    column.cardIds.remove(op.card_id)
            target = _find_column(state, op.column_id)
            assert target is not None
            pos = min(max(op.position, 0), len(target.cardIds))
            target.cardIds.insert(pos, op.card_id)

        elif isinstance(op, RenameColumnOp):
            if op.column_id not in _column_ids(state):
                raise AiValidationError(f"{label}: unknown column_id {op.column_id!r}")
            column = _find_column(state, op.column_id)
            assert column is not None
            column.title = op.title

        else:
            raise AiValidationError(f"{label}: unsupported operation type")


def apply_operations(
    connection: sqlite3.Connection,
    username: str,
    operations: list[AiOperation],
) -> BoardData:
    """Apply validated operations in one transaction (all-or-nothing)."""
    if not operations:
        return get_board_for_user(connection, username)

    try:
        board: BoardData | None = None
        for op in operations:
            if isinstance(op, CreateCardOp):
                board = create_card(
                    connection,
                    username,
                    op.column_id,
                    op.title,
                    op.details,
                    op.position,
                    commit=False,
                )
            elif isinstance(op, UpdateCardOp):
                board = update_card(
                    connection,
                    username,
                    op.card_id,
                    op.title,
                    op.details,
                    commit=False,
                )
            elif isinstance(op, DeleteCardOp):
                board = delete_card(connection, username, op.card_id, commit=False)
            elif isinstance(op, MoveCardOp):
                board = move_card(
                    connection,
                    username,
                    op.card_id,
                    op.column_id,
                    op.position,
                    commit=False,
                )
            elif isinstance(op, RenameColumnOp):
                board = rename_column(
                    connection,
                    username,
                    op.column_id,
                    op.title,
                    commit=False,
                )
            else:
                raise BoardError(f"unsupported operation: {op}")
        connection.commit()
    except Exception:
        connection.rollback()
        raise

    assert board is not None
    return board


def run_chat(
    connection: sqlite3.Connection,
    username: str,
    message: str,
    history: list[ChatMessage],
    *,
    llm_reply: str | None = None,
) -> ChatResponse:
    """
    Load board, call LLM (or use llm_reply for tests), parse/validate/apply ops.

    llm_reply: when set, skip OpenRouter (used by tests).
    """
    board = get_board_for_user(connection, username)

    if llm_reply is None:
        messages = build_openrouter_messages(board, message, history)
        raw = chat_completion_messages(messages)
    else:
        raw = llm_reply

    parsed = parse_ai_response(raw)
    validate_operations(board, parsed.operations)

    if not parsed.operations:
        return ChatResponse(message=parsed.message, board=None)

    updated = apply_operations(connection, username, parsed.operations)
    return ChatResponse(message=parsed.message, board=updated)
