# Stateless per-field AI replaces the creation chat

Status: accepted. Applies to Worlds first; Campaigns and Characters follow in the same effort (#142).

## Context

Creating a World, a Campaign or a Character went through a chat beside the form: the player talked, the AI answered with Proposal cards, and a context meter with compaction summaries kept the conversation inside the model's window. The target models are small and local. They lose the thread in long conversations, echo old values and ignore length instructions, and the compaction machinery added more calls that could fail. The form was meant to be the source of truth, yet the AI sat beside it rather than in it.

## Decision

Remove the chat. Every field where the AI writes prose or makes a judgment call gets a Field AI control: Generate and Give feedback. Each click is one stateless `POST /api/ai/field` call carrying the flow's other field values, the target field and, for feedback, the current value and the Feedback note. The result is written straight into the field with a one-step Field Undo. Fields generate concurrently, each with its own pending state and Stop. A server-side registry holds each field's instruction, output schema and validation, and code rejects anything invalid, retrying once.

## Consequences

- Conversational memory is lost. The AI no longer remembers what the player liked or rejected earlier. The player carries intent in the form values and in each Feedback note.
- Small-model reliability improves: short, single-field prompts with a one-key schema, no growing context, no summaries.
- Behaviour is predictable. A click does one thing to one field, and Undo reverses it.
- The form stays the single source of truth. There are no pending proposals that differ from what will be saved.
- Proposal cards, the context meter and compaction become dead code and are removed flow by flow.
