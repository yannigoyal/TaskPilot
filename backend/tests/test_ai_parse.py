"""Unit tests for AI response parsing."""

import pytest

from app.chat import AiParseError, parse_ai_response


def test_parse_valid_reply_only():
    parsed = parse_ai_response('{"message": "You have 5 columns.", "operations": []}')
    assert parsed.message == "You have 5 columns."
    assert parsed.operations == []


def test_parse_omitted_operations():
    parsed = parse_ai_response('{"message": "Hello"}')
    assert parsed.message == "Hello"
    assert parsed.operations == []


def test_parse_create_card_operation():
    raw = """
    {
      "message": "Created a card.",
      "operations": [
        {
          "type": "create_card",
          "column_id": "col-backlog",
          "title": "New task",
          "details": "Do it"
        }
      ]
    }
    """
    parsed = parse_ai_response(raw)
    assert len(parsed.operations) == 1
    op = parsed.operations[0]
    assert op.type == "create_card"
    assert op.column_id == "col-backlog"
    assert op.title == "New task"


def test_parse_all_operation_types():
    raw = """
    {
      "message": "Done.",
      "operations": [
        {"type": "create_card", "column_id": "col-backlog", "title": "A"},
        {"type": "update_card", "card_id": "card-1", "title": "B"},
        {"type": "delete_card", "card_id": "card-2"},
        {"type": "move_card", "card_id": "card-3", "column_id": "col-done", "position": 0},
        {"type": "rename_column", "column_id": "col-backlog", "title": "Ideas"}
      ]
    }
    """
    parsed = parse_ai_response(raw)
    assert [op.type for op in parsed.operations] == [
        "create_card",
        "update_card",
        "delete_card",
        "move_card",
        "rename_column",
    ]


def test_parse_strips_markdown_fence():
    raw = """```json
{"message": "Hi", "operations": []}
```"""
    parsed = parse_ai_response(raw)
    assert parsed.message == "Hi"


def test_reject_invalid_json():
    with pytest.raises(AiParseError, match="invalid JSON"):
        parse_ai_response("not json")


def test_reject_unknown_operation_type():
    with pytest.raises(AiParseError, match="schema validation"):
        parse_ai_response(
            '{"message": "x", "operations": [{"type": "explode_board"}]}'
        )


def test_reject_missing_message():
    with pytest.raises(AiParseError, match="schema validation"):
        parse_ai_response('{"operations": []}')


def test_reject_create_card_empty_title():
    with pytest.raises(AiParseError, match="schema validation"):
        parse_ai_response(
            '{"message": "x", "operations": [{"type": "create_card", "column_id": "c", "title": "  "}]}'
        )


def test_reject_update_card_missing_fields():
    with pytest.raises(AiParseError, match="schema validation"):
        parse_ai_response(
            '{"message": "x", "operations": [{"type": "update_card", "card_id": "card-1"}]}'
        )
