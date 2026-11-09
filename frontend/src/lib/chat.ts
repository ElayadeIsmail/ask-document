import type { AskStreamEvent } from "@/lib/api";
import type { ChatMessage, ChatTurn } from "@/lib/types";

export function messagesToTurns(messages: ChatMessage[], pending: ChatTurn[] = []): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      turns.push({
        id: message.id,
        question: message.content,
        username: message.username,
        userId: message.user_id,
      });
      continue;
    }
    const last = turns.at(-1);
    if (!last || last.answer) continue;
    last.answer = message.content;
    last.citations = message.citations ?? [];
  }
  return [...turns, ...pending];
}

export function withPendingTurn(saved: ChatTurn[], pending: ChatTurn | null): ChatTurn[] {
  if (!pending) return saved;
  const alreadySaved = saved.some(
    (turn) =>
      turn.userId === pending.userId &&
      turn.question === pending.question &&
      Boolean(turn.answer) &&
      turn.answer === pending.answer,
  );
  return alreadySaved ? saved : [...saved, pending];
}

export function applyStreamEvent(turn: ChatTurn, event: AskStreamEvent): ChatTurn {
  if (event.type === "sources") return { ...turn, sources: event.sources };
  if (event.type === "token") return { ...turn, answer: `${turn.answer ?? ""}${event.text}` };
  if (event.type === "done") {
    return {
      ...turn,
      answer: event.answer,
      citations: event.citations,
      sources: event.sources,
      model: event.model,
    };
  }
  return { ...turn, pending: false, error: event.detail };
}
