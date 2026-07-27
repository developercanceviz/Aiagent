"use server";

import { isConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { announcements as mockAnnouncements } from "@/lib/mock/announcements";

export interface AnnouncementDTO {
  id: string;
  title: string;
  body: string;
  badge: string | null;
  date: string;
}

/** Platform-level announcements (global). Falls back to seed content. */
export async function getAnnouncements(): Promise<AnnouncementDTO[]> {
  if (!isConfigured.database()) {
    return mockAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      badge: a.badge,
      date: a.date,
    }));
  }
  const rows = await prisma.announcement.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  if (rows.length === 0) {
    return mockAnnouncements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      badge: a.badge,
      date: a.date,
    }));
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    badge: r.badge,
    date: r.publishedAt.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }));
}
