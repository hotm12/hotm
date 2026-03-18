"use client";

import type { CSSProperties, ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type CrmBoardCard = {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  crmStage: string;
  totalScore: number;
  scoreGrade: string;
  latestReplyType?: string;
  latestActivitySummary?: string;
};

type CrmBoardColumn = {
  stage: string;
  items: CrmBoardCard[];
};

type ReplyItem = {
  id: number;
  leadId: number;
  channel: string;
  replyType: string;
  messageBody: string;
  receivedAt: string;
};

type ActivityItem = {
  id: number;
  leadId: number;
  activityType: string;
  summary: string;
  detail?: string;
  occurredAt: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackBoard: CrmBoardColumn[] = [
  {
    stage: "CONTACTED",
    items: []
  },
  {
    stage: "REPLIED",
    items: [
      {
        leadId: 3,
        displayName: "KGlow Finds",
        handle: "@kglow_finds",
        platform: "TIKTOK",
        crmStage: "REPLIED",
        totalScore: 40,
        scoreGrade: "A",
        latestReplyType: "POSITIVE",
        latestActivitySummary: "긍정 답장 확인"
      }
    ]
  },
  {
    stage: "INTERESTED",
    items: []
  },
  {
    stage: "MEETING_BOOKED",
    items: []
  },
  {
    stage: "ONBOARDING",
    items: []
  }
];

const fallbackReplies: ReplyItem[] = [
  {
    id: 1,
    leadId: 3,
    channel: "EMAIL",
    replyType: "POSITIVE",
    messageBody: "좋습니다. 아마존 확장 제안 내용을 검토해보겠습니다.",
    receivedAt: "2026-03-18T02:00:00Z"
  }
];

const fallbackActivities: ActivityItem[] = [
  {
    id: 1,
    leadId: 3,
    activityType: "FOLLOW_UP_NOTE",
    summary: "긍정 답장 확인",
    detail: "상품 카탈로그 요청 준비",
    occurredAt: "2026-03-18T02:10:00Z"
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

export function CrmClient() {
  const [board, setBoard] = useState<CrmBoardColumn[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("CRM 보드를 불러오는 중입니다.");
  const [isLoading, setIsLoading] = useState(true);
  const [replyForm, setReplyForm] = useState({
    channel: "EMAIL",
    replyType: "POSITIVE",
    messageBody: ""
  });
  const [activityForm, setActivityForm] = useState({
    activityType: "FOLLOW_UP_NOTE",
    summary: "",
    detail: ""
  });
  const [nextStage, setNextStage] = useState("INTERESTED");

  const selectedCard = useMemo(
    () => board.flatMap((column) => column.items).find((item) => item.leadId === selectedLeadId) ?? null,
    [board, selectedLeadId]
  );

  useEffect(() => {
    void loadBoard();
  }, []);

  async function loadBoard(preferredLeadId?: number | null) {
    setIsLoading(true);

    try {
      const nextBoard = await request<CrmBoardColumn[]>("/crm/board");
      setBoard(nextBoard);
      const flatItems = nextBoard.flatMap((column) => column.items);
      const nextLeadId =
        flatItems.find((item) => item.leadId === preferredLeadId)?.leadId ??
        flatItems[0]?.leadId ??
        null;
      setSelectedLeadId(nextLeadId);
      if (nextLeadId) {
        await loadLeadContext(nextLeadId);
      }
      setStatusMessage("API에서 CRM 보드를 불러왔습니다.");
    } catch {
      setBoard(fallbackBoard);
      setSelectedLeadId(3);
      setReplies(fallbackReplies);
      setActivities(fallbackActivities);
      setStatusMessage("API가 준비되지 않아 샘플 CRM 보드를 표시 중입니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadLeadContext(leadId: number) {
    try {
      const [nextReplies, nextActivities] = await Promise.all([
        request<ReplyItem[]>(`/crm/${leadId}/replies`),
        request<ActivityItem[]>(`/crm/${leadId}/activities`)
      ]);
      setReplies(nextReplies);
      setActivities(nextActivities);
    } catch {
      setReplies(fallbackReplies.filter((item) => item.leadId === leadId));
      setActivities(fallbackActivities.filter((item) => item.leadId === leadId));
    }
  }

  async function handleAddReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeadId) {
      return;
    }

    try {
      await request("/crm/replies", {
        method: "POST",
        body: JSON.stringify({
          leadId: selectedLeadId,
          ...replyForm
        })
      });
      setReplyForm({
        channel: "EMAIL",
        replyType: "POSITIVE",
        messageBody: ""
      });
      await loadBoard(selectedLeadId);
      await loadLeadContext(selectedLeadId);
      setStatusMessage("답장을 등록했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 답장 등록이 가능합니다.");
    }
  }

  async function handleMoveStage() {
    if (!selectedLeadId) {
      return;
    }

    try {
      await request("/crm/move-stage", {
        method: "POST",
        body: JSON.stringify({
          leadId: selectedLeadId,
          nextStage
        })
      });
      await loadBoard(selectedLeadId);
      await loadLeadContext(selectedLeadId);
      setStatusMessage(`CRM 단계를 ${nextStage}로 이동했습니다.`);
    } catch {
      setStatusMessage("API가 준비되면 CRM 단계 이동이 가능합니다.");
    }
  }

  async function handleAddActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeadId) {
      return;
    }

    try {
      await request("/crm/activities", {
        method: "POST",
        body: JSON.stringify({
          leadId: selectedLeadId,
          ...activityForm
        })
      });
      setActivityForm({
        activityType: "FOLLOW_UP_NOTE",
        summary: "",
        detail: ""
      });
      await loadLeadContext(selectedLeadId);
      await loadBoard(selectedLeadId);
      setStatusMessage("활동 메모를 추가했습니다.");
    } catch {
      setStatusMessage("API가 준비되면 활동 메모 추가가 가능합니다.");
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
          <h1 style={{ marginBottom: 8 }}>CRM 보드</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            답장 이후 단계를 칸반 보드로 관리하고 활동 메모를 기록합니다.
          </p>
        </div>
        <div style={{ color: "#7dd3fc" }}>{isLoading ? "불러오는 중..." : statusMessage}</div>
      </section>

      <section style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridAutoFlow: "column", gap: 16, alignItems: "start" }}>
          {board.map((column) => (
            <section key={column.stage} style={{ ...panelStyle, width: 280 }}>
              <h2 style={{ marginTop: 0 }}>{column.stage}</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {column.items.map((item) => (
                  <button
                    key={item.leadId}
                    onClick={() => {
                      setSelectedLeadId(item.leadId);
                      void loadLeadContext(item.leadId);
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
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong>{item.displayName}</strong>
                      <span style={scoreBadgeStyle}>{item.totalScore}</span>
                    </div>
                    <div style={{ color: "#94a3b8", marginTop: 4 }}>
                      {item.handle} · {item.platform}
                    </div>
                    {item.latestReplyType ? (
                      <div style={{ color: "#7dd3fc", fontSize: 13, marginTop: 10 }}>
                        최근 답장: {item.latestReplyType}
                      </div>
                    ) : null}
                    {item.latestActivitySummary ? (
                      <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                        활동: {item.latestActivitySummary}
                      </div>
                    ) : null}
                  </button>
                ))}
                {column.items.length === 0 ? (
                  <div style={{ color: "#94a3b8" }}>카드 없음</div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ marginTop: 0 }}>선택 리드</h2>
            <div style={{ color: "#94a3b8" }}>{selectedCard?.crmStage ?? "선택 없음"}</div>
          </div>

          {selectedCard ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={itemCardStyle}>
                <strong>{selectedCard.displayName}</strong>
                <div style={{ color: "#94a3b8", marginTop: 6 }}>
                  {selectedCard.handle} · {selectedCard.platform}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Tag>{selectedCard.scoreGrade}</Tag>
                  <Tag>{selectedCard.crmStage}</Tag>
                </div>
              </div>

              <div style={itemCardStyle}>
                <strong>단계 이동</strong>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <select
                    value={nextStage}
                    onChange={(event) => setNextStage(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="CONTACTED">CONTACTED</option>
                    <option value="REPLIED">REPLIED</option>
                    <option value="INTERESTED">INTERESTED</option>
                    <option value="MEETING_BOOKED">MEETING_BOOKED</option>
                    <option value="ONBOARDING">ONBOARDING</option>
                  </select>
                  <button type="button" style={primaryButtonStyle} onClick={handleMoveStage}>
                    이동
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddReply} style={itemCardStyle}>
                <strong>답장 등록</strong>
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  <select
                    value={replyForm.channel}
                    onChange={(event) =>
                      setReplyForm((prev) => ({ ...prev, channel: event.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="EMAIL">EMAIL</option>
                    <option value="DM">DM</option>
                  </select>
                  <select
                    value={replyForm.replyType}
                    onChange={(event) =>
                      setReplyForm((prev) => ({ ...prev, replyType: event.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="POSITIVE">POSITIVE</option>
                    <option value="NEUTRAL">NEUTRAL</option>
                    <option value="NEGATIVE">NEGATIVE</option>
                  </select>
                  <textarea
                    value={replyForm.messageBody}
                    onChange={(event) =>
                      setReplyForm((prev) => ({ ...prev, messageBody: event.target.value }))
                    }
                    style={{ ...inputStyle, minHeight: 110 }}
                  />
                  <button type="submit" style={secondaryButtonStyle}>
                    답장 추가
                  </button>
                </div>
              </form>

              <form onSubmit={handleAddActivity} style={itemCardStyle}>
                <strong>활동 메모</strong>
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  <input
                    value={activityForm.activityType}
                    onChange={(event) =>
                      setActivityForm((prev) => ({ ...prev, activityType: event.target.value }))
                    }
                    style={inputStyle}
                  />
                  <input
                    value={activityForm.summary}
                    onChange={(event) =>
                      setActivityForm((prev) => ({ ...prev, summary: event.target.value }))
                    }
                    placeholder="요약"
                    style={inputStyle}
                  />
                  <textarea
                    value={activityForm.detail}
                    onChange={(event) =>
                      setActivityForm((prev) => ({ ...prev, detail: event.target.value }))
                    }
                    placeholder="상세 메모"
                    style={{ ...inputStyle, minHeight: 110 }}
                  />
                  <button type="submit" style={secondaryButtonStyle}>
                    메모 추가
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p style={{ color: "#94a3b8" }}>선택된 카드가 없습니다.</p>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>최근 답장 / 활동</h2>
          <div style={{ display: "grid", gap: 20 }}>
            <div>
              <h3>최근 답장</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {replies.map((reply) => (
                  <div key={reply.id} style={itemCardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong>{reply.replyType}</strong>
                      <span style={{ color: "#94a3b8" }}>
                        {new Date(reply.receivedAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <div style={{ color: "#94a3b8", marginTop: 6 }}>{reply.channel}</div>
                    <p style={{ marginBottom: 0 }}>{reply.messageBody}</p>
                  </div>
                ))}
                {replies.length === 0 ? <div style={{ color: "#94a3b8" }}>답장 없음</div> : null}
              </div>
            </div>

            <div>
              <h3>최근 활동</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {activities.map((activity) => (
                  <div key={activity.id} style={itemCardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong>{activity.summary}</strong>
                      <span style={{ color: "#94a3b8" }}>
                        {new Date(activity.occurredAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <div style={{ color: "#7dd3fc", marginTop: 6 }}>{activity.activityType}</div>
                    {activity.detail ? <p style={{ marginBottom: 0 }}>{activity.detail}</p> : null}
                  </div>
                ))}
                {activities.length === 0 ? <div style={{ color: "#94a3b8" }}>활동 메모 없음</div> : null}
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Tag(props: { children: ReactNode }) {
  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        background: "#0f172a",
        border: "1px solid #1e293b",
        color: "#cbd5e1",
        fontSize: 12
      }}
    >
      {props.children}
    </span>
  );
}

const itemCardStyle: CSSProperties = {
  background: "#020617",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: 14
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

const scoreBadgeStyle: CSSProperties = {
  minWidth: 40,
  textAlign: "center",
  padding: "4px 10px",
  borderRadius: 999,
  background: "#0ea5e9",
  color: "#082f49",
  fontWeight: 800
};
