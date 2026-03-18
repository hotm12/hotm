"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type OutreachQueueItem = {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  channel: string;
  deliveryStatus: string;
  subject?: string;
  previewText: string;
  approvedAt?: string;
  sentAt?: string;
};

type OutreachPreview = {
  leadId: number;
  displayName: string;
  channel: string;
  subject?: string;
  body: string;
  deliveryStatus: string;
  recommendedAction: string;
};

type OutreachTab = "EMAIL" | "DM" | "FOLLOW_UP";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackQueue: OutreachQueueItem[] = [
  {
    leadId: 3,
    displayName: "KGlow Finds",
    handle: "@kglow_finds",
    platform: "TIKTOK",
    channel: "EMAIL",
    deliveryStatus: "APPROVED",
    subject: "Amazon 입점 제안 드립니다",
    previewText: "안녕하세요 KGlow Finds 팀, 귀사의 상품 구성이 글로벌 마켓에 잘 맞는다고 판단했습니다.",
    approvedAt: "2026-03-18T00:10:00Z"
  }
];

const fallbackPreviews: OutreachPreview[] = [
  {
    leadId: 3,
    displayName: "KGlow Finds",
    channel: "EMAIL",
    subject: "Amazon 입점 제안 드립니다",
    body: "안녕하세요 KGlow Finds 팀, 귀사의 상품 구성이 글로벌 마켓에 잘 맞는다고 판단했습니다. 가능하시다면 협업 가능성을 함께 논의드리고 싶습니다.",
    deliveryStatus: "APPROVED",
    recommendedAction: "이메일 검토 후 발송"
  }
];

const panelStyle: CSSProperties = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 16,
  padding: 20
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0"
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export function OutreachClient() {
  const [tab, setTab] = useState<OutreachTab>("EMAIL");
  const [queue, setQueue] = useState<OutreachQueueItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [preview, setPreview] = useState<OutreachPreview | null>(null);
  const [statusMessage, setStatusMessage] = useState("아웃리치 큐를 불러오는 중입니다.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadQueue();
  }, []);

  const filteredQueue = useMemo(() => {
    if (tab === "EMAIL") {
      return queue.filter((item) => item.channel === "EMAIL");
    }
    if (tab === "DM") {
      return queue.filter((item) => item.channel === "DM");
    }
    return queue.filter((item) => ["APPROVED", "SENT", "QUEUED"].includes(item.deliveryStatus));
  }, [queue, tab]);

  async function loadQueue() {
    setIsLoading(true);

    try {
      const nextQueue = await request<OutreachQueueItem[]>("/outreach-queue");
      setQueue(nextQueue);
      const nextLeadId = nextQueue[0]?.leadId ?? null;
      setSelectedLeadId(nextLeadId);
      if (nextLeadId) {
        await loadPreview(nextLeadId);
      }
      setStatusMessage("API에서 아웃리치 큐를 불러왔습니다.");
    } catch {
      setQueue(fallbackQueue);
      setSelectedLeadId(fallbackQueue[0]?.leadId ?? null);
      setPreview(fallbackPreviews[0] ?? null);
      setStatusMessage("API가 준비되지 않아 샘플 아웃리치 큐를 표시 중입니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPreview(leadId: number) {
    try {
      const nextPreview = await request<OutreachPreview>(`/outreach-queue/${leadId}`);
      setPreview(nextPreview);
    } catch {
      setPreview(fallbackPreviews.find((item) => item.leadId === leadId) ?? null);
    }
  }

  async function handleApprove() {
    if (!selectedLeadId) {
      return;
    }

    try {
      const nextPreview = await request<OutreachPreview>(`/outreach-queue/${selectedLeadId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          channel: preview?.channel ?? "EMAIL"
        })
      });
      setPreview(nextPreview);
      await loadQueue();
      setStatusMessage("메시지 초안을 승인했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 초안 승인이 가능합니다.");
    }
  }

  async function handleSendEmail() {
    if (!selectedLeadId || !preview) {
      return;
    }

    try {
      const nextPreview = await request<OutreachPreview>(`/outreach-queue/${selectedLeadId}/send-email`, {
        method: "POST",
        body: JSON.stringify({
          subject: preview.subject,
          body: preview.body
        })
      });
      setPreview(nextPreview);
      await loadQueue();
      setStatusMessage("이메일 발송 상태를 갱신했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 이메일 발송이 가능합니다.");
    }
  }

  async function handleQueueDm() {
    if (!selectedLeadId || !preview) {
      return;
    }

    try {
      const nextPreview = await request<OutreachPreview>(`/outreach-queue/${selectedLeadId}/queue-dm`, {
        method: "POST",
        body: JSON.stringify({
          body: preview.body
        })
      });
      setPreview(nextPreview);
      await loadQueue();
      setStatusMessage("DM 수동 큐에 등록했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 DM 큐 등록이 가능합니다.");
    }
  }

  return (
    <main style={{ padding: 32, display: "grid", gap: 20 }}>
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>아웃리치 큐</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            승인된 리드의 메시지 초안, 이메일 발송, DM 큐 등록을 관리합니다.
          </p>
        </div>
        <div style={{ color: "#7dd3fc" }}>{isLoading ? "불러오는 중..." : statusMessage}</div>
      </section>

      <section style={{ display: "flex", gap: 10 }}>
        <TabButton active={tab === "EMAIL"} onClick={() => setTab("EMAIL")}>
          이메일
        </TabButton>
        <TabButton active={tab === "DM"} onClick={() => setTab("DM")}>
          DM
        </TabButton>
        <TabButton active={tab === "FOLLOW_UP"} onClick={() => setTab("FOLLOW_UP")}>
          후속 대기
        </TabButton>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 20,
          alignItems: "start"
        }}
      >
        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>처리 대상</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {filteredQueue.map((item) => (
              <button
                key={item.leadId}
                onClick={() => {
                  setSelectedLeadId(item.leadId);
                  void loadPreview(item.leadId);
                }}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 12,
                  border: selectedLeadId === item.leadId ? "1px solid #38bdf8" : "1px solid #1f2937",
                  background: selectedLeadId === item.leadId ? "#082f49" : "#020617",
                  color: "#e2e8f0",
                  cursor: "pointer"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10
                  }}
                >
                  <strong>{item.displayName}</strong>
                  <span style={statusBadgeStyle}>{item.deliveryStatus}</span>
                </div>
                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {item.handle} · {item.platform}
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 10 }}>
                  {item.previewText}
                </div>
              </button>
            ))}
            {filteredQueue.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>현재 탭에 해당하는 대상이 없습니다.</div>
            ) : null}
          </div>
        </aside>

        <section style={panelStyle}>
          {preview ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start"
                }}
              >
                <div>
                  <h2 style={{ marginTop: 0, marginBottom: 6 }}>{preview.displayName}</h2>
                  <div style={{ color: "#94a3b8" }}>
                    채널 {preview.channel} · 상태 {preview.deliveryStatus}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={secondaryButtonStyle} onClick={handleApprove}>
                    초안 승인
                  </button>
                  <button type="button" style={primaryButtonStyle} onClick={handleSendEmail}>
                    이메일 발송
                  </button>
                  <button type="button" style={dmButtonStyle} onClick={handleQueueDm}>
                    DM 큐 등록
                  </button>
                </div>
              </div>

              <div style={itemCardStyle}>
                <strong>추천 액션</strong>
                <div style={{ color: "#7dd3fc", marginTop: 8 }}>{preview.recommendedAction}</div>
              </div>

              <div style={itemCardStyle}>
                <strong>제목</strong>
                <input
                  value={preview.subject ?? ""}
                  onChange={(event) =>
                    setPreview((prev) =>
                      prev
                        ? {
                            ...prev,
                            subject: event.target.value
                          }
                        : prev
                    )
                  }
                  style={{ ...inputStyle, marginTop: 12 }}
                />
              </div>

              <div style={itemCardStyle}>
                <strong>본문</strong>
                <textarea
                  value={preview.body}
                  onChange={(event) =>
                    setPreview((prev) =>
                      prev
                        ? {
                            ...prev,
                            body: event.target.value
                          }
                        : prev
                    )
                  }
                  style={{ ...inputStyle, minHeight: 220, marginTop: 12 }}
                />
              </div>
            </div>
          ) : (
            <p style={{ color: "#94a3b8" }}>선택된 아웃리치 대상이 없습니다.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: props.active ? "1px solid #38bdf8" : "1px solid #334155",
        background: props.active ? "#082f49" : "#111827",
        color: "#e2e8f0",
        cursor: "pointer",
        fontWeight: 700
      }}
    >
      {props.children}
    </button>
  );
}

const itemCardStyle: CSSProperties = {
  background: "#020617",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: 14
};

const statusBadgeStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  background: "#0f172a",
  border: "1px solid #1e293b",
  color: "#cbd5e1",
  fontSize: 12
};

const primaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#0ea5e9",
  color: "#082f49",
  fontWeight: 700,
  cursor: "pointer"
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "#111827",
  color: "#e2e8f0",
  fontWeight: 700,
  cursor: "pointer"
};

const dmButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#f59e0b",
  color: "#451a03",
  fontWeight: 700,
  cursor: "pointer"
};
