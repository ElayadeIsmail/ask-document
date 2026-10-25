"use client";

import { ArrowUp, BookOpen } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { fileUrl } from "@/lib/api";
import type { ChatTurn, Citation, Collection } from "@/lib/types";

type AskPanelProps = {
  collection: Collection | null;
  canAsk: boolean;
  scopeCount: number;
  turns: ChatTurn[];
  onAsk: (question: string) => Promise<void>;
  onClearScope: () => void;
};

export function AskPanel({
  collection,
  canAsk,
  scopeCount,
  turns,
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
              {scopeCount > 0
                ? `Asking ${scopeCount} file${scopeCount === 1 ? "" : "s"}`
                : `${collection.ready_count} indexed ${collection.ready_count === 1 ? "source" : "sources"}`}
            </p>
            {scopeCount > 0 && (
              <button
                type="button"
                onClick={onClearScope}
                className="mt-1 cursor-pointer text-[11px] text-moss hover:underline"
              >
                Ask the whole collection
              </button>
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
            {turns.map((turn) => (
              <article key={turn.id} className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <p className="max-w-[min(28rem,88%)] rounded-2xl rounded-br-md bg-ink px-4 py-3 font-serif text-lg italic leading-7 text-paper shadow-[0_10px_28px_rgba(28,24,20,0.16)]">
                    {turn.question}
                  </p>
                </div>
                {turn.pending && !turn.answer && (
                  <p className="w-fit rounded-2xl rounded-tl-md border border-line bg-white/80 px-4 py-3 text-sm text-muted shadow-[0_6px_18px_rgba(28,24,20,0.04)]">
                    Retrieving passages and writing an answer…
                  </p>
                )}
                {(turn.error || turn.answer || (turn.citations && turn.citations.length > 0)) && (
                  <div className="max-w-[min(44rem,94%)] rounded-2xl rounded-tl-md border border-line/80 bg-[#fffdf8] px-4 py-4 shadow-[0_8px_24px_rgba(28,24,20,0.05)] sm:px-5">
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
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-line bg-paper px-4 py-4 sm:px-6">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-[0_8px_30px_rgba(28,24,20,0.05)]">
          <textarea
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
                ? scopeCount > 0
                  ? "Ask about the selected files…"
                  : "Ask anything in this collection…"
                : "Index at least one PDF before asking"
            }
            disabled={!canAsk || asking}
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-6 disabled:text-muted"
          />
          <button
            type="submit"
            disabled={disabled || !question.trim()}
            className="mb-0.5 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-ink text-paper disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
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
          <button
            key={index}
            type="button"
            onClick={() => onCite(citation)}
            className={`citation-mark mx-0.5 inline cursor-pointer rounded px-0.5 text-clay hover:underline ${
              selected ? "bg-moss/10" : ""
            }`}
          >
            [{n}]
          </button>
        );
      })}
    </p>
  );
}
