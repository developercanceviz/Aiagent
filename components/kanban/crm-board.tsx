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
import { LayoutGrid, Plus, Table2, Tag, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addLead, moveLeadAction } from "@/lib/actions/lead";
import { LEAD_STAGES, type LeadDTO, type LeadStageKey } from "@/lib/crm/constants";

const stageDot: Record<LeadStageKey, string> = {
  YENI: "bg-amber-400",
  GORUSMEDE: "bg-orange-400",
  TAKIP: "bg-sky-400",
  OLUMLU: "bg-emerald-400",
  OLUMSUZ: "bg-red-400",
};

export function CrmBoard({ initial }: { initial: LeadDTO[] }) {
  const { t } = useI18n();
  const [leads, setLeads] = React.useState(initial);
  const [view, setView] = React.useState<"board" | "table">("board");
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [, startTransition] = React.useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const leadId = String(e.active.id);
    const overStage = e.over?.id as LeadStageKey | undefined;
    if (!overStage || !LEAD_STAGES.includes(overStage)) return;
    const position = leads.filter((l) => l.stage === overStage).length;
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: overStage } : l))
    );
    startTransition(() => moveLeadAction(leadId, overStage, position).catch(() => {}));
  };

  const submitAdd = () => {
    if (!name.trim()) return;
    const optimistic: LeadDTO = {
      id: crypto.randomUUID(),
      name,
      contact: null,
      stage: "YENI",
      tags: [],
    };
    setLeads((p) => [optimistic, ...p]);
    setName("");
    setAdding(false);
    startTransition(() => addLead({ name: optimistic.name, stage: "YENI" }).catch(() => {}));
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{t.crm.title}</h1>
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-brand-700">
            CRM
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
            <button
              onClick={() => setView("board")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                view === "board" ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-3.5" /> {t.crm.board}
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                view === "table" ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Table2 className="size-3.5" /> {t.crm.table}
            </button>
          </div>
          <Button variant="outline" size="sm">
            <Tag className="size-3.5" /> {t.crm.tags}
          </Button>
          <Button size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus className="size-3.5" /> {t.crm.addLead}
          </Button>
        </div>
      </div>

      {adding && (
        <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-3 shadow-card">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAdd()}
            placeholder="Lead adı…"
            className="max-w-xs"
          />
          <Button size="sm" onClick={submitAdd}>
            {t.crm.addLead}
          </Button>
        </div>
      )}

      {view === "board" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {LEAD_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                label={t.crm.stages[stage]}
                emptyLabel={t.crm.empty}
                dot={stageDot[stage]}
                leads={leads.filter((l) => l.stage === stage)}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <TableView leads={leads} stageLabels={t.crm.stages} />
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
}: {
  stage: LeadStageKey;
  label: string;
  emptyLabel: string;
  dot: string;
  leads: LeadDTO[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-2xl border bg-card/60 shadow-card transition-colors",
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
      <div className="flex flex-1 flex-col gap-2 p-3 pt-0">
        {leads.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-muted-foreground/60">
            <Users className="size-5" />
            <span className="text-xs">{emptyLabel}</span>
          </div>
        ) : (
          leads.map((lead) => <Card key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}

function Card({ lead }: { lead: LeadDTO }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-xl border border-border/60 bg-card p-3 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <p className="text-sm font-medium">{lead.name}</p>
      {lead.contact && <p className="text-xs text-muted-foreground">{lead.contact}</p>}
      {lead.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {lead.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
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
  stageLabels,
}: {
  leads: LeadDTO[];
  stageLabels: Record<LeadStageKey, string>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Ad</th>
            <th className="px-4 py-3 font-medium">İletişim</th>
            <th className="px-4 py-3 font-medium">Aşama</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                Boş
              </td>
            </tr>
          ) : (
            leads.map((l) => (
              <tr key={l.id} className="border-b border-border/40">
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.contact ?? "—"}</td>
                <td className="px-4 py-3">{stageLabels[l.stage]}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
