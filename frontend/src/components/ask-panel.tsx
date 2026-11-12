"use client";

import { ArrowUp, BookOpen } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fileUrl } from "@/lib/api";
import type { ChatTurn, Citation, Collection } from "@/lib/types";

type AskPanelProps = {
  collection: Collection | null;
  canAsk: boolean;
  turns: ChatTurn[];
  currentUserId: string;
  sharedThread: boolean;
  readOnly?: boolean;
  hint?: string | null;
  onAsk: (question: string) => Promise<void>;
  onClearScope?: () => void;
};

export function AskPanel({
  collection,
  canAsk,
  turns,
  currentUserId,
  sharedThread,
  readOnly = false,
  hint,
  onAsk,
  onClearScope,
}: AskPanelProps) {
  const [question, setQuestion] = useState("");
  const [activeCitation, setActiveCitation] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const asking = turns.some((turn) => turn.pending);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || asking || !canAsk) return;
    setQuestion("");
    await onAsk(trimmed);
  }

  const disabled = !canAsk || asking;

  return (
    <section className="flex min-h-[280px] min-w-0 flex-1 flex-col bg-paper">
      <header className="flex items-end justify-between gap-4 border-b border-line px-6 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Ask</p>
          <h2 className="font-serif text-2xl italic">Questions with sources</h2>
        </div>
        {collection && (
          <div className="hidden text-right text-xs text-muted sm:block">
            <p>
              {sharedThread
                ? hint || "Chat with this PDF"
                : `${collection.ready_count} indexed ${collection.ready_count === 1 ? "source" : "sources"}`}
            </p>
            {onClearScope && (
              <Button variant="link" size="xs" onClick={onClearScope} className="mt-1">
                Ask the whole collection
              </Button>
            )}
          </div>
        )}
      </header>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#e7dfd0] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] sm:px-6"
      >
        {turns.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-4">
            <EmptyAsk canAsk={canAsk} />
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {turns.map((turn) => {
              const mine = turn.userId === currentUserId;
              return (
              <article key={turn.id} className="flex flex-col gap-3">
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex max-w-[min(28rem,88%)] flex-col gap-1 ${
                      mine ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="px-1 text-[11px] text-muted">{turn.username}</span>
                    <p
                      className={`rounded-2xl px-4 py-3 font-serif text-lg italic leading-7 shadow-[0_10px_28px_rgba(28,24,20,0.16)] ${
                        mine
                          ? "rounded-br-md bg-ink text-paper"
                          : "rounded-bl-md bg-clay text-white"
                      }`}
                    >
                      {turn.question}
                    </p>
                  </div>
                </div>
                {turn.pending && !turn.answer && (
                  <p className="w-fit rounded-2xl rounded-tl-md border border-line bg-white/80 px-4 py-3 text-sm text-muted shadow-[0_6px_18px_rgba(28,24,20,0.04)]">
                    Retrieving passages and writing an answer…
                  </p>
                )}
                {(turn.error || turn.answer || (turn.citations && turn.citations.length > 0)) && (
                  <div className="max-w-[min(44rem,94%)] rounded-2xl rounded-tl-md border border-line/80 bg-[#fffdf8] px-4 py-4 shadow-[0_8px_24px_rgba(28,24,20,0.05)] sm:px-5">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-moss">AskDoc</p>
                    {turn.error && (
                      <p className="rounded-lg border border-clay/20 bg-clay/5 px-3 py-2 text-sm leading-6 text-clay">
                        {turn.error}
                      </p>
                    )}
                    {turn.answer && (
                      <AnswerBody
                        answer={turn.answer}
                        citations={turn.citations ?? []}
                        turnId={turn.id}
                        activeId={activeCitation}
                        onCite={(citation) => {
                          setActiveCitation(`${turn.id}:${citation.n}`);
                          window.open(
                            fileUrl(citation.document_id, citation.page),
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      />
                    )}
                    {turn.citations && turn.citations.length > 0 && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {turn.citations.map((citation) => {
                          const id = `${turn.id}:${citation.n}`;
                          const active = activeCitation === id;
                          return (
                            <div
                              key={id}
                              onClick={() => setActiveCitation(id)}
                              className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition ${
                                active
                                  ? "border-moss bg-moss/5"
                                  : "border-line bg-paper-2/80 hover:border-moss/30"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] text-muted">
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="citation-mark text-sm normal-case tracking-normal text-clay">
                                    [{citation.n}]
                                  </span>
                                  <span className="truncate">
                                    {citation.filename} · p. {citation.page}
                                  </span>
                                </span>
                                <a
                                  href={fileUrl(citation.document_id, citation.page)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="shrink-0 normal-case tracking-normal text-moss hover:underline"
                                >
                                  Open page
                                </a>
                              </div>
                              <p className="mt-2 line-clamp-4 text-xs leading-5 text-ink/80">
                                {citation.snippet}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {turn.model && (
                      <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted">
                        {turn.model}
                      </p>
                    )}
                  </div>
                )}
              </article>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-line bg-paper px-4 py-4 sm:px-6">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-[0_8px_30px_rgba(28,24,20,0.05)]">
          <Textarea
            value={question}
            rows={1}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              canAsk
                ? sharedThread
                  ? "Ask about this PDF. People with access will see it…"
                  : "Ask anything in this collection…"
                : readOnly
                  ? "You can read this chat"
                  : sharedThread
                    ? "This chat is visible here once the PDF is ready"
                    : "Index at least one PDF before asking"
            }
            disabled={!canAsk || asking}
            className="min-w-0 w-auto flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={disabled || !question.trim()}
            className="mb-0.5 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Send question"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </section>
  );
}

function EmptyAsk({ canAsk }: { canAsk: boolean }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-line/70 bg-[#fffdf8]/90 px-6 py-8 text-center shadow-[0_10px_30px_rgba(28,24,20,0.04)]">
      <BookOpen className="h-8 w-8 text-moss" />
      <h3 className="mt-4 font-serif text-3xl italic">Read, then ask</h3>
      <p className="mt-3 text-sm leading-7 text-muted">
        {canAsk
          ? "Questions are answered only from your uploaded PDFs. Each claim is tied back to a filename and page."
          : "Upload and wait until a document is ready. Then this panel becomes a cited Q&A over your collection."}
      </p>
    </div>
  );
}

function AnswerBody({
  answer,
  citations,
  turnId,
  activeId,
  onCite,
}: {
  answer: string;
  citations: Citation[];
  turnId: string;
  activeId: string | null;
  onCite: (citation: Citation) => void;
}) {
  const parts = useMemo(() => answer.split(/(\[\d+\])/g), [answer]);
  return (
    <p className="text-[15px] leading-7 text-ink/90">
      {parts.map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (!match) return <span key={index}>{part}</span>;
        const n = Number(match[1]);
        const citation = citations.find((item) => item.n === n);
        if (!citation) return <span key={index}>{part}</span>;
        const selected = activeId === `${turnId}:${n}`;
        return (
          <Button
            key={index}
            variant="unstyled"
            onClick={() => onCite(citation)}
            className={`citation-mark mx-0.5 px-0.5 text-clay hover:underline ${
              selected ? "bg-moss/10" : ""
            }`}
          >
            [{n}]
          </Button>
        );
      })}
    </p>
  );
}
