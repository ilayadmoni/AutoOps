# Assistant clarifying questions with options

Date: 2026-10-09

## Problem

The assistant must decide, per request, between answering, proposing a card (command, server, run) and drafting a
workflow. When the intent is unclear (for example a file is attached with "copy it to my machine" and it is not clear
whether the user wants a workflow built from the file or just an answer) it guesses. Clarification today is free text
only: the user has to type the answer.

## Goal

When the model is not confident about the user's intent it asks one question with 2–5 clickable options plus an
optional free-text "Other" answer. Clear requests keep acting immediately.

## Design

### Backend

- New tool `ask_user` (`ai/tool/clarify/AskUserTool`, risk `PROPOSE`). Arguments: `question` (string),
  `options` (2–5 items of `{label, description?}`), `allowOther` (boolean, default true). Returns operation
  `ASK_USER` with the normalized payload `{question, options, allowOther}`. Invalid input becomes a tool error so the
  model can retry.
- `ai/validation/QuestionPayload.normalize(Map)`: shared normalization used by the tool and the validator. Trims,
  caps question at 300 chars, labels at 80, descriptions at 160, drops blank and case-insensitive duplicate labels,
  keeps at most 5 options, rejects fewer than 2 or a blank question.
- `AIOperationValidator`: `ASK_USER` added to `SUPPORTED`; re-normalized through `QuestionPayload`; invalid → dropped.
- `AIChatService.loop()`: once `ask_user` produced a question in a round, the loop ends that turn (no further
  tool rounds). The stored assistant text always contains the question (it is used as the message when the model
  wrote none, appended otherwise) so the model sees its own question in history on the next turn.
- Prompt `autoops-system.md`: "When the intent is unclear" section — ask with `ask_user` only when the request could
  reasonably mean two or more of: answer, command, server, workflow (or a required choice has a few known values);
  never when the request is clear; one question per turn; options short, concrete and in the user's language; call
  no other tool in the same turn.

### Frontend

- `AIOperation.type` gains `ASK_USER`.
- `features/ai-assistant/QuestionCard.tsx`: header note, option buttons (label + optional description) and, when
  `allowOther`, an "Other" text input with a send button. Built from `components/ui` primitives.
- Clicking an option (or sending "Other") calls the page's existing `submit(text)` — the same path as the composer.
- Answered state: when a later user message exists the card is locked; the option matching that reply is marked.
  The card is also disabled while a message is being sent.
- i18n (en, he): `ai.questionNote`, `ai.otherPlaceholder`, `ai.otherSend`.

## Testing

- `QuestionPayloadTest`: valid payload, trimming/caps, duplicate labels, too few options, blank question.
- Frontend: typecheck/build; visual check via the mocked-API Playwright harness.
