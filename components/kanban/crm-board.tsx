"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  Check,
  LayoutGrid,
  MessageSquare,
  Pencil,
  Plus,
  Table2,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
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
import {
  addLead,
  deleteLeadAction,
  moveLeadAction,
  updateLeadAction,
  type LeadError,
  type LeadResult,
} from "@/lib/actions/lead";
import {
  LEAD_STAGES,
  type LeadBoardState,
  type LeadDTO,
  type LeadStageKey,
} from "@/lib/crm/constants";

const stageDot: Record<LeadStageKey, string> = {
  YENI: "bg-amber-400",
  GORUSMEDE: "bg-orange-400",
  TAKIP: "bg-sky-400",
  OLUMLU: "bg-emerald-400",
  OLUMSUZ: "bg-red-400",
};

/** What the dialog edits — the writable subset of a lead. */
interface LeadDraft {
  name: string;
  contact: string | null;
  note: string | null;
  tags: string[];
  stage: LeadStageKey;
}

const draftOf = (lead: LeadDTO): LeadDraft => ({
  name: lead.name,
  contact: lead.contact,
  note: lead.note,
  tags: lead.tags,
  stage: lead.stage,
});

export function CrmBoard({ state }: { state: LeadBoardState }) {
  const { t } = useI18n();
  const tc = t.crm;

  const [leads, setLeads] = React.useState(state.leads);
  const [view, setView] = React.useState<"board" | "table">("board");
  const [error, setError] = React.useState<LeadError | "generic" | null>(null);
  const [editing, setEditing] = React.useState<LeadDTO | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<LeadDTO | null>(null);
  const [tagFilter, setTagFilter] = React.useState<string[]>([]);
  const [tagMenuOpen, setTagMenuOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  // Server state wins: after any mutation the action revalidates /crm, the RSC
  // payload comes back and replaces whatever we were showing optimistically.
  // Without this the board kept client-only rows (with client-only ids) alive
  // forever, and the next drag on such a row updated nothing.
  React.useEffect(() => setLeads(state.leads), [state.leads]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /** Runs a mutation, shows any failure, and rolls the optimistic edit back. */
  const run = (fn: () => Promise<LeadResult<LeadDTO>>, rollback: () => void) => {
    startTransition(async () => {
      const res = await fn().catch(() => null);
      if (!res) {
        setError("generic");
        rollback();
      } else if (!res.ok) {
        setError(res.error);
        rollback();
      } else {
        setError(null);
      }
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const leadId = String(e.active.id);
    const overStage = e.over?.id as LeadStageKey | undefined;
    if (!overStage || !LEAD_STAGES.includes(overStage)) return;
    const before = leads.find((l) => l.id === leadId);
    if (!before || before.stage === overStage) return;

    // Server puts a moved card on top of its new column; mirror that here.
    setLeads((prev) => [
      { ...before, stage: overStage },
      ...prev.filter((l) => l.id !== leadId),
    ]);
    run(
      () => moveLeadAction(leadId, overStage),
      () => setLeads((prev) => prev.map((l) => (l.id === leadId ? before : l)))
    );
  };

  const submitDraft = (draft: LeadDraft) => {
    if (editing === "new") {
      const tempId = `tmp-${crypto.randomUUID()}`;
      const optimistic: LeadDTO = { id: tempId, conversationId: null, ...draft };
      setLeads((prev) => [optimistic, ...prev]);
      run(
        async () => {
          const res = await addLead(draft);
          // Adopt the real row id so the card is immediately draggable.
          if (res.ok && res.lead) {
            const saved = res.lead;
            setLeads((prev) => prev.map((l) => (l.id === tempId ? saved : l)));
          }
          return res;
        },
        () => setLeads((prev) => prev.filter((l) => l.id !== tempId))
      );
    } else if (editing) {
      const before = editing;
      setLeads((prev) =>
        prev.map((l) => (l.id === before.id ? { ...l, ...draft } : l))
      );
      run(
        () => updateLeadAction(before.id, draft),
        () => setLeads((prev) => prev.map((l) => (l.id === before.id ? before : l)))
      );
    }
    setEditing(null);
  };

  const confirmDelete = (lead: LeadDTO) => {
    setPendingDelete(null);
    setEditing(null);
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    run(
      () => deleteLeadAction(lead.id),
      () => setLeads((prev) => [lead, ...prev])
    );
  };

  const allTags = React.useMemo(
    () => [...new Set(leads.flatMap((l) => l.tags))].sort((a, b) => a.localeCompare(b, "tr")),
    [leads]
  );
  const visible = React.useMemo(
    () =>
      tagFilter.length === 0
        ? leads
        : leads.filter((l) => l.tags.some((tag) => tagFilter.includes(tag))),
    [leads, tagFilter]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{tc.title}</h1>
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-brand-700">
            CRM
          </span>
          <span className="text-xs text-muted-foreground">{visible.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
            <button
              onClick={() => setView("board")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                view === "board"
                  ? "bg-ink text-ink-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-3.5" /> {tc.board}
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                view === "table"
                  ? "bg-ink text-ink-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Table2 className="size-3.5" /> {tc.table}
            </button>
          </div>

          <TagFilter
            open={tagMenuOpen}
            setOpen={setTagMenuOpen}
            tags={allTags}
            selected={tagFilter}
            setSelected={setTagFilter}
            labels={tc}
          />

          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" /> {tc.addLead}
          </Button>
        </div>
      </div>

      {!state.connected && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="size-3.5" />
          {tc.notConnected}
          <a
            href="/api/auth/ikas/connect?returnTo=/crm"
            className="font-medium underline underline-offset-2"
          >
            {tc.reconnect}
          </a>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="flex-1">{tc.errors[error]}</span>
          <button
            onClick={() => setError(null)}
            className="rounded-md p-0.5 hover:bg-red-100"
            aria-label={tc.form.cancel}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {view === "board" ? (
        // Explicit id keeps dnd-kit's generated aria ids identical on server and
        // client — without it every card hit a hydration mismatch.
        <DndContext id="crm-board" sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {LEAD_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                label={tc.stages[stage]}
                emptyLabel={tc.empty}
                dot={stageDot[stage]}
                leads={visible.filter((l) => l.stage === stage)}
                onEdit={setEditing}
                onDelete={setPendingDelete}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <TableView
          leads={visible}
          labels={tc}
          onEdit={setEditing}
          onDelete={setPendingDelete}
          onStageChange={(lead, stage) => {
            setLeads((prev) =>
              prev.map((l) => (l.id === lead.id ? { ...l, stage } : l))
            );
            run(
              () => moveLeadAction(lead.id, stage),
              () => setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)))
            );
          }}
        />
      )}

      <LeadDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        editing={editing}
        onClose={() => setEditing(null)}
        onSubmit={submitDraft}
        onDelete={setPendingDelete}
        labels={tc}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent closeLabel={tc.form.cancel} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tc.form.delete}</DialogTitle>
            <DialogDescription>{tc.form.deleteConfirm}</DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">{pendingDelete?.name}</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
              {tc.form.cancel}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => pendingDelete && confirmDelete(pendingDelete)}
            >
              <Trash2 className="size-3.5" /> {tc.form.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TagFilter({
  open,
  setOpen,
  tags,
  selected,
  setSelected,
  labels,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  tags: string[];
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  labels: ReturnType<typeof useI18n>["t"]["crm"];
}) {
  return (
    <div className="relative">
      <Button
        variant={selected.length ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen(!open)}
      >
        <Tag className="size-3.5" /> {labels.tags}
        {selected.length > 0 && (
          <span className="rounded-md bg-white/25 px-1 text-[10px]">
            {selected.length}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Click-away layer — cheaper than pulling in a popover primitive. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-border/60 bg-card p-1.5 shadow-card">
            {tags.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {labels.filter.none}
              </p>
            ) : (
              <>
                <button
                  onClick={() => setSelected([])}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-accent",
                    selected.length === 0 && "font-medium"
                  )}
                >
                  <span className="flex size-4 items-center justify-center">
                    {selected.length === 0 && <Check className="size-3" />}
                  </span>
                  {labels.filter.all}
                </button>
                {tags.map((tag) => {
                  const on = selected.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() =>
                        setSelected((prev) =>
                          on ? prev.filter((x) => x !== tag) : [...prev, tag]
                        )
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-accent"
                    >
                      <span className="flex size-4 items-center justify-center">
                        {on && <Check className="size-3 text-primary" />}
                      </span>
                      <span className="truncate">{tag}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Column({
  stage,
  label,
  emptyLabel,
  dot,
  leads,
  onEdit,
  onDelete,
}: {
  stage: LeadStageKey;
  label: string;
  emptyLabel: string;
  dot: string;
  leads: LeadDTO[];
  onEdit: (lead: LeadDTO) => void;
  onDelete: (lead: LeadDTO) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border bg-card/60 shadow-card transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border/60"
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <span className={cn("size-2 rounded-full", dot)} />
        <span className="text-xs font-semibold tracking-wide">{label}</span>
        <span className="ml-auto rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground">
          {leads.length}
        </span>
      </div>
      {/* Scrolls: a tall column used to run past the viewport with no way to
          reach the cards at the bottom. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 pt-0">
        {leads.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-muted-foreground/60">
            <Users className="size-5" />
            <span className="text-xs">{emptyLabel}</span>
          </div>
        ) : (
          leads.map((lead) => (
            <Card key={lead.id} lead={lead} onEdit={onEdit} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}

function Card({
  lead,
  onEdit,
  onDelete,
}: {
  lead: LeadDTO;
  onEdit: (lead: LeadDTO) => void;
  onDelete: (lead: LeadDTO) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  // The action buttons live inside a draggable, so they must swallow the
  // pointerdown or every click would start a drag instead.
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative cursor-grab rounded-xl border border-border/60 bg-card p-3 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{lead.name}</p>
          {lead.contact && (
            <p className="truncate text-xs text-muted-foreground">{lead.contact}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            onPointerDown={stop}
            onClick={() => onEdit(lead)}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`${lead.name} — düzenle`}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onPointerDown={stop}
            onClick={() => onDelete(lead)}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
            aria-label={`${lead.name} — sil`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {lead.note && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{lead.note}</p>
      )}

      {(lead.tags.length > 0 || lead.conversationId) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {lead.conversationId && (
            <MessageSquare className="size-3 text-muted-foreground/70" />
          )}
          {lead.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TableView({
  leads,
  labels,
  onEdit,
  onDelete,
  onStageChange,
}: {
  leads: LeadDTO[];
  labels: ReturnType<typeof useI18n>["t"]["crm"];
  onEdit: (lead: LeadDTO) => void;
  onDelete: (lead: LeadDTO) => void;
  onStageChange: (lead: LeadDTO, stage: LeadStageKey) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border/60 bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground shadow-[0_1px_0_0_var(--color-border)]">
          <tr>
            <th className="px-4 py-3 font-medium">{labels.columns.name}</th>
            <th className="px-4 py-3 font-medium">{labels.columns.contact}</th>
            <th className="px-4 py-3 font-medium">{labels.columns.tags}</th>
            <th className="px-4 py-3 font-medium">{labels.columns.stage}</th>
            <th className="w-20 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                {labels.empty}
              </td>
            </tr>
          ) : (
            leads.map((l) => (
              <tr key={l.id} className="border-t border-border/40 hover:bg-accent/40">
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-1.5">
                    {l.conversationId && (
                      <MessageSquare className="size-3 shrink-0 text-muted-foreground/70" />
                    )}
                    {l.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.contact ?? "—"}</td>
                <td className="px-4 py-3">
                  {l.tags.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {l.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {/* Stage is editable straight from the table — the board's
                      drag-and-drop is not the only way to advance a lead. */}
                  <select
                    value={l.stage}
                    onChange={(e) => onStageChange(l, e.target.value as LeadStageKey)}
                    className="h-8 rounded-lg border border-input bg-card px-2 text-xs"
                  >
                    {LEAD_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {labels.stages[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(l)}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`${l.name} — düzenle`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(l)}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      aria-label={`${l.name} — sil`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeadDialog({
  editing,
  onClose,
  onSubmit,
  onDelete,
  labels,
}: {
  editing: LeadDTO | "new" | null;
  onClose: () => void;
  onSubmit: (draft: LeadDraft) => void;
  onDelete: (lead: LeadDTO) => void;
  labels: ReturnType<typeof useI18n>["t"]["crm"];
}) {
  const isNew = editing === "new";
  const lead = isNew || !editing ? null : editing;
  const [draft, setDraft] = React.useState<LeadDraft>(
    lead
      ? draftOf(lead)
      : { name: "", contact: null, note: null, tags: [], stage: "YENI" }
  );
  const [tagText, setTagText] = React.useState(lead ? lead.tags.join(", ") : "");

  const commit = () => {
    if (!draft.name.trim()) return;
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      contact: draft.contact?.trim() || null,
      note: draft.note?.trim() || null,
      tags: tagText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  return (
    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={labels.form.cancel}>
        <DialogHeader>
          <DialogTitle>{isNew ? labels.form.newTitle : labels.form.editTitle}</DialogTitle>
          {lead?.conversationId && (
            <DialogDescription>{labels.form.fromConversation}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <Field label={labels.form.name}>
            <Input
              autoFocus
              value={draft.name}
              placeholder={labels.form.namePlaceholder}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && commit()}
            />
          </Field>
          <Field label={labels.form.contact}>
            <Input
              value={draft.contact ?? ""}
              placeholder={labels.form.contactPlaceholder}
              onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && commit()}
            />
          </Field>
          <Field label={labels.form.tags}>
            <Input
              value={tagText}
              placeholder={labels.form.tagsPlaceholder}
              onChange={(e) => setTagText(e.target.value)}
            />
          </Field>
          <Field label={labels.form.stage}>
            <select
              value={draft.stage}
              onChange={(e) =>
                setDraft((d) => ({ ...d, stage: e.target.value as LeadStageKey }))
              }
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
            >
              {LEAD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {labels.stages[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={labels.form.note}>
            <textarea
              value={draft.note ?? ""}
              placeholder={labels.form.notePlaceholder}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        </div>

        <DialogFooter className={cn(lead && "justify-between")}>
          {lead && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(lead)}>
              <Trash2 className="size-3.5 text-red-600" />
              <span className="text-red-600">{labels.form.delete}</span>
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {labels.form.cancel}
            </Button>
            <Button size="sm" onClick={commit} disabled={!draft.name.trim()}>
              {labels.form.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
