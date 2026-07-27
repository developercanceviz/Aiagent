"use client";

import * as React from "react";
import { BookOpen, Loader2, Plus, Search, Trash2, X } from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createKnowledgeItem,
  removeKnowledgeItem,
  type KnowledgeRow,
} from "@/lib/actions/knowledge";

const TYPES = ["FAQ", "POLICY", "PRODUCT", "DOCUMENT"] as const;

export function KnowledgeManager({ initial }: { initial: KnowledgeRow[] }) {
  const { t } = useI18n();
  const k = t.knowledge;
  const [items, setItems] = React.useState(initial);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [type, setType] = React.useState<(typeof TYPES)[number]>("FAQ");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");

  const filtered = items.filter(
    (i) =>
      i.title.toLowerCase().includes(query.toLowerCase()) ||
      i.content.toLowerCase().includes(query.toLowerCase())
  );

  const submit = () => {
    if (!title.trim() || !content.trim()) return;
    startTransition(async () => {
      try {
        await createKnowledgeItem({ type, title, content });
        setItems((prev) => [
          { id: crypto.randomUUID(), type, title, content },
          ...prev,
        ]);
        setTitle("");
        setContent("");
        setOpen(false);
      } catch {
        // Server action throws when no store is connected; keep the form open.
      }
    });
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(() => removeKnowledgeItem(id).catch(() => {}));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-brand-700">
            <BookOpen className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{k.title}</h2>
            <p className="max-w-xl text-sm text-muted-foreground">{k.subtitle}</p>
          </div>
        </div>
        <Button onClick={() => setOpen((o) => !o)}>
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? k.cancel : k.add}
        </Button>
      </div>

      {open && (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((ty) => (
              <button
                key={ty}
                onClick={() => setType(ty)}
                className={
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " +
                  (type === ty
                    ? "border-primary bg-primary/10 text-brand-700"
                    : "border-border text-muted-foreground hover:bg-accent")
                }
              >
                {k.types[ty]}
              </button>
            ))}
          </div>
          <Input
            placeholder={k.formTitle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            placeholder={k.formContent}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {k.save}
            </Button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={k.searchPlaceholder}
          className="h-12 bg-card pl-11 text-base"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card py-20 text-center shadow-card">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BookOpen className="size-6" />
          </div>
          <p className="text-lg font-semibold">{k.emptyTitle}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{k.emptySubtitle}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => (
            <div
              key={i.id}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-card"
            >
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                {k.types[i.type as keyof typeof k.types] ?? i.type}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.title}</p>
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {i.content}
                </p>
              </div>
              <button
                onClick={() => remove(i.id)}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
                aria-label="Sil"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
