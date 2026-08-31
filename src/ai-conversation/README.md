# ai-conversation

The AI message history in the left sidebar, between the media library and the
prompt composer.

- `AIConversation.tsx` — the transcript surface. Always mounted, including
  before the first message, so sending message #1 appends a row instead of
  building a new layout. Owns scroll behaviour: follows the tail, stays put
  when you scroll up to read, and offers a "Latest" jump.
- `AIMessage.tsx` — one message row (user or assistant), plus its failed
  state and retry action.
- `AITypingIndicator.tsx` — the three-dot pulse shown while thinking.
- `useConversation.ts` — owns the message list and the send / retry / stop
  lifecycle. Lives above the sidebar so the transcript outlives any input.
- `localResponder.ts` — placeholder reply source. Swap this one function for
  a real model call; the UI already handles chunks, interruption and errors.
- `conversation.types.ts` — message roles, statuses and helpers.
- `ai-conversation.css` — styles for this section.
