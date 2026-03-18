"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

type ReviewQueueItem = {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  leadStatus: string;
  totalScore: number;
  scoreGrade: string;
  riskFlags: string[];
  checklistProgress: string;
};

type ReviewChecklistAnswer = {
  id: number;
  label: string;
  passed: boolean | null;
  note?: string;
};

type ReviewDetail = {
  id: number;
  displayName: string;
  handle: string;
  platform: string;
  leadStatus: string;
  totalScore: number;
  scoreGrade: string;
  riskFlags: string[];
  reviewNotes?: string;
  reviewChecklistAnswers: ReviewChecklistAnswer[];
  score: {
    totalScore: number;
    scoreGrade: string;
    scoreBreakdown: Array<{
      label: string;
      scoreDelta: number;
      reason: string;
    }>;
  };
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackDetails: ReviewDetail[] = [
  {
    id: 1,
    displayName: "KBeauty Store Lab",
    handle: "@kbeauty_store_lab",
    platform: "INSTAGRAM",
    leadStatus: "REVIEW_READY",
    totalScore: 40,
    scoreGrade: "A",
    riskFlags: ["민감 성분 검토 필요"],
    reviewNotes: "프로필 링크와 공개 이메일이 있어 검수 우선순위가 높습니다.",
    reviewChecklistAnswers: [
      {
        id: 1,
        label: "실제 판매 계정 여부",
        passed: true,
        note: "상품 링크와 판매 문구가 명확합니다."
      },
      {
        id: 2,
        label: "공개 연락 채널 존재 여부",
        passed: true,
        note: "프로필에 이메일이 공개되어 있습니다."
      },
      {
        id: 3,
        label: "민감 카테고리 여부",
        passed: false,
        note: "민감 성분 검토가 필요합니다."
      }
    ],
    score: {
      totalScore: 40,
      scoreGrade: "A",
      scoreBreakdown: [
        {
          label: "팔로워 규모",
          scoreDelta: 25,
          reason: "팔로워가 1만 명 이상입니다."
        },
        {
          label: "공개 이메일",
          scoreDelta: 15,
          reason: "공개 이메일 연락처가 존재합니다."
        }
      ]
    }
  },
  {
    id: 2,
    displayName: "Seoul Skin Archive",
    handle: "@seoul_skin_archive",
    platform: "INSTAGRAM",
    leadStatus: "NEW",
    totalScore: 15,
    scoreGrade: "C",
    riskFlags: [],
    reviewNotes: "콘텐츠 톤은 좋지만 판매 채널 명확성은 추가 확인이 필요합니다.",
    reviewChecklistAnswers: [
      {
        id: 4,
        label: "실제 판매 계정 여부",
        passed: null,
        note: ""
      },
      {
        id: 5,
        label: "공개 연락 채널 존재 여부",
        passed: false,
        note: "이메일이 아직 확인되지 않았습니다."
      }
    ],
    score: {
      totalScore: 15,
      scoreGrade: "C",
      scoreBreakdown: [
        {
          label: "팔로워 규모",
          scoreDelta: 15,
          reason: "팔로워가 3천 명 이상입니다."
        }
      ]
    }
  }
];

const fallbackQueue: ReviewQueueItem[] = fallbackDetails.map((detail) => ({
  leadId: detail.id,
  displayName: detail.displayName,
  handle: detail.handle,
  platform: detail.platform,
  leadStatus: detail.leadStatus,
  totalScore: detail.totalScore,
  scoreGrade: detail.scoreGrade,
  riskFlags: detail.riskFlags,
  checklistProgress: `${detail.reviewChecklistAnswers.filter((item) => item.passed !== null).length}/${detail.reviewChecklistAnswers.length}`
}));

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

export function ReviewClient() {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [statusMessage, setStatusMessage] = useState("검수 큐를 불러오는 중입니다.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadQueue();
  }, []);

  async function loadQueue() {
    setIsLoading(true);

    try {
      const nextQueue = await request<ReviewQueueItem[]>("/review-queue");
      setQueue(nextQueue);
      const nextLeadId = nextQueue[0]?.leadId ?? null;
      setSelectedLeadId(nextLeadId);
      if (nextLeadId) {
        await loadDetail(nextLeadId);
      }
      setStatusMessage("API에서 검수 큐를 불러왔습니다.");
    } catch {
      setQueue(fallbackQueue);
      setSelectedLeadId(fallbackQueue[0]?.leadId ?? null);
      setDetail(fallbackDetails[0] ?? null);
      setStatusMessage("API가 준비되지 않아 샘플 검수 큐를 표시 중입니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDetail(leadId: number) {
    try {
      const nextDetail = await request<ReviewDetail>(`/review-queue/${leadId}`);
      setDetail(nextDetail);
    } catch {
      setDetail(fallbackDetails.find((item) => item.id === leadId) ?? null);
    }
  }

  async function handleDecision(decisionStatus: string) {
    if (!selectedLeadId || !detail) {
      return;
    }

    try {
      const nextDetail = await request<ReviewDetail>(`/review-queue/${selectedLeadId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          decisionStatus,
          reviewNotes: detail.reviewNotes,
          checklistAnswers: detail.reviewChecklistAnswers.map((item) => ({
            label: item.label,
            passed: item.passed,
            note: item.note
          }))
        })
      });

      setDetail(nextDetail);
      await loadQueue();
      setStatusMessage(`리드를 ${decisionStatus} 상태로 저장했습니다.`);
    } catch {
      const localDetail: ReviewDetail = {
        ...detail,
        leadStatus: decisionStatus
      };
      const nextQueue =
        decisionStatus === "ON_HOLD"
          ? queue.map((item) =>
              item.leadId === selectedLeadId
                ? {
                    ...item,
                    leadStatus: decisionStatus,
                    checklistProgress: `${localDetail.reviewChecklistAnswers.filter((answer) => answer.passed !== null).length}/${localDetail.reviewChecklistAnswers.length}`
                  }
                : item
            )
          : queue.filter((item) => item.leadId !== selectedLeadId);

      setQueue(nextQueue);
      if (decisionStatus === "ON_HOLD") {
        setDetail(localDetail);
      } else {
        const nextLeadId = nextQueue[0]?.leadId ?? null;
        setSelectedLeadId(nextLeadId);
        setDetail(nextLeadId ? fallbackDetails.find((item) => item.id === nextLeadId) ?? null : null);
      }
      setStatusMessage("샘플 모드에서 검수 상태를 갱신했습니다.");
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
          <h1 style={{ marginBottom: 8 }}>검수 큐</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            점수와 위험 신호를 확인하고 승인, 보류, 제외를 처리합니다.
          </p>
        </div>
        <div style={{ color: "#7dd3fc" }}>{isLoading ? "불러오는 중..." : statusMessage}</div>
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
          <h2 style={{ marginTop: 0 }}>검수 대상</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {queue.map((item) => (
              <button
                key={item.leadId}
                onClick={() => {
                  setSelectedLeadId(item.leadId);
                  void loadDetail(item.leadId);
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
                  <span style={scoreBadgeStyle}>{item.totalScore}</span>
                </div>
                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {item.handle} · {item.platform}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <Tag>{item.leadStatus}</Tag>
                  <Tag>{item.scoreGrade}</Tag>
                  <Tag>{item.checklistProgress}</Tag>
                </div>
                {item.riskFlags.length > 0 ? (
                  <div style={{ color: "#fda4af", fontSize: 13, marginTop: 10 }}>
                    위험: {item.riskFlags.join(", ")}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <section style={panelStyle}>
          {detail ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start"
                }}
              >
                <div>
                  <h2 style={{ marginTop: 0, marginBottom: 6 }}>{detail.displayName}</h2>
                  <div style={{ color: "#94a3b8" }}>
                    {detail.handle} · {detail.platform}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={approveButtonStyle} onClick={() => void handleDecision("APPROVED")}>
                    승인
                  </button>
                  <button type="button" style={holdButtonStyle} onClick={() => void handleDecision("ON_HOLD")}>
                    보류
                  </button>
                  <button type="button" style={rejectButtonStyle} onClick={() => void handleDecision("REJECTED")}>
                    제외
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={itemCardStyle}>
                  <strong>점수 요약</strong>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>
                    {detail.score.totalScore}
                  </div>
                  <div style={{ color: "#7dd3fc", marginTop: 4 }}>
                    Grade {detail.score.scoreGrade}
                  </div>
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {detail.score.scoreBreakdown.map((item) => (
                      <div key={item.label} style={subtleCardStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <strong>{item.label}</strong>
                          <span>{item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta}</span>
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>
                          {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={itemCardStyle}>
                  <strong>위험 신호</strong>
                  <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {detail.riskFlags.length > 0 ? (
                      detail.riskFlags.map((flag) => (
                        <div key={flag} style={warningCardStyle}>
                          {flag}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: "#94a3b8" }}>표시할 위험 신호가 없습니다.</div>
                    )}
                  </div>
                </div>
              </div>

              <div style={itemCardStyle}>
                <strong>검수 체크리스트</strong>
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {detail.reviewChecklistAnswers.map((answer) => (
                    <div key={answer.id} style={subtleCardStyle}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{answer.label}</div>
                      <select
                        value={
                          answer.passed === null ? "PENDING" : answer.passed ? "PASS" : "FAIL"
                        }
                        onChange={(event) =>
                          setDetail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  reviewChecklistAnswers: prev.reviewChecklistAnswers.map((item) =>
                                    item.id === answer.id
                                      ? {
                                          ...item,
                                          passed:
                                            event.target.value === "PENDING"
                                              ? null
                                              : event.target.value === "PASS"
                                        }
                                      : item
                                  )
                                }
                              : prev
                          )
                        }
                        style={inputStyle}
                      >
                        <option value="PENDING">보류</option>
                        <option value="PASS">통과</option>
                        <option value="FAIL">실패</option>
                      </select>
                      <textarea
                        value={answer.note ?? ""}
                        onChange={(event) =>
                          setDetail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  reviewChecklistAnswers: prev.reviewChecklistAnswers.map((item) =>
                                    item.id === answer.id
                                      ? {
                                          ...item,
                                          note: event.target.value
                                        }
                                      : item
                                  )
                                }
                              : prev
                          )
                        }
                        style={{ ...inputStyle, minHeight: 80, marginTop: 10 }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={itemCardStyle}>
                <strong>검수 메모</strong>
                <textarea
                  value={detail.reviewNotes ?? ""}
                  onChange={(event) =>
                    setDetail((prev) =>
                      prev
                        ? {
                            ...prev,
                            reviewNotes: event.target.value
                          }
                        : prev
                    )
                  }
                  style={{ ...inputStyle, minHeight: 120, marginTop: 12 }}
                />
              </div>
            </div>
          ) : (
            <p style={{ color: "#94a3b8" }}>선택된 검수 대상이 없습니다.</p>
          )}
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

const subtleCardStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 10,
  padding: 10
};

const warningCardStyle: CSSProperties = {
  background: "#2a0b13",
  border: "1px solid #7f1d1d",
  borderRadius: 10,
  padding: 10,
  color: "#fecdd3"
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

const approveButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#22c55e",
  color: "#052e16",
  fontWeight: 700,
  cursor: "pointer"
};

const holdButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#f59e0b",
  color: "#451a03",
  fontWeight: 700,
  cursor: "pointer"
};

const rejectButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#f43f5e",
  color: "#4c0519",
  fontWeight: 700,
  cursor: "pointer"
};
