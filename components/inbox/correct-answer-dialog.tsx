"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveCorrection } from "@/lib/actions/knowledge";

/** The AI answer being corrected, plus the question that produced it. */
export interface CorrectionTarget {
  messageId: string;
  conversationId: string | null;
  question: string;
  badAnswer: string;
}

/**
 * "Düzelt" on an AI message. The question is pre-filled from the preceding
 * customer line (editable — the customer's phrasing is sometimes messier than
 * what should be stored), the wrong answer is shown read-only for reference,
 * and the merchant types what the agent should have said.
 */
export function CorrectAnswerDialog({
  target,
  onClose,
  onSaved,
}: {
  target: CorrectionTarget | null;
  onClose: () => void;
  onSaved: (messageId: string) => void;
}) {
  const { t } = useI18n();
  const tc = t.messages.correct;
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Re-seed whenever a different message is being corrected.
  React.useEffect(() => {
    setQuestion(target?.question ?? "");
    setAnswer("");
    setError(null);
  }, [target]);

  const submit = () => {
    if (!target || !question.trim() || !answer.trim()) return;
    startTransition(async () => {
      const res = await saveCorrection({
        question,
        badAnswer: target.badAnswer,
        correctAnswer: answer,
        conversationId: target.conversationId,
        messageId: target.messageId,
      }).catch(() => null);
      if (!res || !res.ok) {
        setError(res && !res.ok ? res.error : "generic");
        return;
      }
      onSaved(target.messageId);
      onClose();
    });
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={tc.cancel} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tc.title}</DialogTitle>
          <DialogDescription>{tc.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {tc.question}
            </span>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-red-700">
              {tc.badAnswer}
            </span>
            <p className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50/60 px-3.5 py-2.5 text-sm text-red-900/80">
              {target?.badAnswer}
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-brand-700">
              {tc.correctAnswer}
            </span>
            <textarea
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          {error && (
            <p className="text-xs text-red-700">
              {error === "no-session" ? t.crm.errors["no-session"] : tc.error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {tc.cancel}
          </Button>
          <Button size="sm" onClick={submit} disabled={pending || !answer.trim()}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {tc.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
