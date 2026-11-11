"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiList } from "@/lib/api";
import type { Screening, ScreeningAlert } from "@/lib/types";
import { fmtDateTime, humanize } from "@/lib/format";
import { Card, EmptyState, PageHeader, PageLoading, Pill } from "@/components/ui";
import { candidateLists } from "@/components/CandidateResults";

const MEDIA_WORDS = ["media", "news", "adverse", "special interest", "sip", "crime", "fraud", "court"];

function isMedia(dataset: string): boolean {
  const d = dataset.toLowerCase();
  return MEDIA_WORDS.some((w) => d.includes(w));
}

interface MediaHit {
  subject: string;
  customerId?: number | null;
  when?: string;
  score: number;
  list: string;
  headline: string;
}

export default function AdverseMediaPage() {
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [alerts, setAlerts] = useState<ScreeningAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiList<Screening>("/screenings", { per_page: 100 }).catch(() => []),
      apiList<ScreeningAlert>("/alerts", { per_page: 100 }).catch(() => []),
    ]).then(([s, a]) => {
      setScreenings(s);
      setAlerts(a);
      setLoading(false);
    });
  }, []);

  const hits = useMemo<MediaHit[]>(() => {
    const out: MediaHit[] = [];
    screenings.forEach((s) => {
      (s.results || []).forEach((c) => {
        const lists = [c.list_name, c.source_list, ...(c.datasets || []), ...(c.topics || [])].filter(Boolean) as string[];
        const mediaLists = lists.filter(isMedia);
        if (mediaLists.length) {
          out.push({
            subject: c.name || c.full_name || c.matched_name || s.subject_name,
            customerId: s.customer_id,
            when: s.created_at,
            score: Number(c.score ?? c.match_score ?? 0),
            list: mediaLists.join(", "),
            headline: c.caption || c.summary || `Matched while screening ${s.subject_name}`,
          });
        }
      });
    });
    return out;
  }, [screenings]);

  const mediaAlerts = useMemo(
    () => alerts.filter((a) => isMedia(a.list_name)),
    [alerts]
  );

  if (loading) return <PageLoading />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Adverse media"
        sub="Negative news and special-interest coverage attached to screened names — fraud convictions, court cases and regulatory actions that never reach a sanctions list."
      />

      <div className="mb-4 rounded-xl border border-line bg-white px-5 py-4 text-[13px] leading-relaxed text-slate-600">
        <strong className="text-ink">How coverage works here:</strong> adverse-media signals come from the
        datasets inside OpenSanctions (crime, fraud and court-record collections) and from list entries
        tagged as special-interest persons. A media hit is a prompt to read the story and judge
        relevance — it is not a designation, and on its own it never restricts a customer.
      </div>

      <Card>
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-display text-[15px] font-semibold text-ink">Media-linked matches in recent screenings</h3>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            {hits.length} hit{hits.length === 1 ? "" : "s"} across the last {screenings.length} screening runs
            {mediaAlerts.length > 0 ? ` · ${mediaAlerts.length} raised as alerts` : ""}.
          </p>
        </div>
        {hits.length === 0 ? (
          <EmptyState
            title="No adverse-media hits in recent screenings"
            text="When a screened name carries negative-news or special-interest coverage, it will be listed here with the story reference so the officer can read it in context."
          />
        ) : (
          <ul className="divide-y divide-line">
            {hits.map((h, i) => (
              <li key={i} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink">{h.subject}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] text-slate-500">{h.headline}</p>
                  </div>
                  <Pill tone={h.score >= 90 ? "red" : "amber"}>{h.score}% match</Pill>
                </div>
                <p className="mt-2 text-[12px] text-slate-400">
                  Source: {h.list} · {fmtDateTime(h.when)}
                  {h.customerId ? (
                    <>
                      {" · "}
                      <Link href={`/customers/${h.customerId}`} className="font-medium text-primary hover:underline">
                        Open customer file
                      </Link>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {mediaAlerts.length > 0 && (
        <Card className="mt-4">
          <div className="border-b border-line px-5 py-4">
            <h3 className="font-display text-[15px] font-semibold text-ink">Alerts from media-linked lists</h3>
          </div>
          <ul className="divide-y divide-line">
            {mediaAlerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{a.matched_name}</p>
                  <p className="text-[12px] text-slate-400">
                    {a.list_name} · {humanize(a.status)}
                  </p>
                </div>
                <Link href="/screening/alerts" className="text-[12.5px] font-medium text-primary hover:underline">
                  Review in Screening Alerts
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
