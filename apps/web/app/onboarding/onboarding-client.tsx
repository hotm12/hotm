"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type OnboardingSummary = {
  leadId: number;
  displayName: string;
  handle: string;
  platform: string;
  onboardingStatus: string;
  nextAction?: string;
  updatedAt?: string;
};

type OnboardingDetail = OnboardingSummary & {
  notes?: string;
  startedAt?: string;
  crmStage?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const fallbackItems: OnboardingSummary[] = [
  {
    leadId: 3,
    displayName: "KGlow Finds",
    handle: "@kglow_finds",
    platform: "TIKTOK",
    onboardingStatus: "IN_PROGRESS",
    nextAction: "Request product catalog",
    updatedAt: "2026-03-18T03:10:00Z"
  }
];

const fallbackDetail: OnboardingDetail = {
  ...fallbackItems[0],
  crmStage: "ONBOARDING",
  notes: "Seller replied positively. Waiting for listing details.",
  startedAt: "2026-03-18T03:00:00Z"
};

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

export function OnboardingClient() {
  const [items, setItems] = useState<OnboardingSummary[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OnboardingDetail | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading onboarding workspace.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadItems();
  }, []);

  async function loadItems(preferredLeadId?: number | null) {
    setIsLoading(true);

    try {
      const nextItems = await request<OnboardingSummary[]>("/onboarding");
      setItems(nextItems);
      const nextLeadId =
        nextItems.find((item) => item.leadId === preferredLeadId)?.leadId ??
        nextItems[0]?.leadId ??
        null;
      setSelectedLeadId(nextLeadId);
      if (nextLeadId) {
        await loadDetail(nextLeadId);
      } else {
        setDetail(null);
      }
      setStatusMessage("Loaded onboarding data from API.");
    } catch {
      setItems(fallbackItems);
      setSelectedLeadId(fallbackDetail.leadId);
      setDetail(fallbackDetail);
      setStatusMessage("API unavailable, showing fallback onboarding data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDetail(leadId: number) {
    try {
      const nextDetail = await request<OnboardingDetail>(`/onboarding/${leadId}`);
      setDetail(nextDetail);
    } catch {
      setDetail(
        leadId === fallbackDetail.leadId
          ? fallbackDetail
          : {
              leadId,
              displayName: "Unknown lead",
              handle: "@unknown",
              platform: "UNKNOWN",
              onboardingStatus: "NOT_STARTED"
            }
      );
    }
  }

  async function handleStart() {
    if (!detail) {
      return;
    }

    try {
      const nextDetail = await request<OnboardingDetail>("/onboarding/start", {
        method: "POST",
        body: JSON.stringify({
          leadId: detail.leadId,
          onboardingStatus: detail.onboardingStatus === "NOT_STARTED" ? "IN_PROGRESS" : detail.onboardingStatus,
          nextAction: detail.nextAction,
          notes: detail.notes
        })
      });
      setDetail(nextDetail);
      await loadItems(detail.leadId);
      setStatusMessage("Onboarding started.");
    } catch {
      setStatusMessage("API will enable onboarding start once available.");
    }
  }

  async function handleSave() {
    if (!detail) {
      return;
    }

    try {
      const nextDetail = await request<OnboardingDetail>(`/onboarding/${detail.leadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          onboardingStatus: detail.onboardingStatus,
          nextAction: detail.nextAction,
          notes: detail.notes
        })
      });
      setDetail(nextDetail);
      await loadItems(detail.leadId);
      setStatusMessage("Onboarding detail updated.");
    } catch {
      setStatusMessage("API will enable onboarding updates once available.");
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
          <h1 style={{ marginBottom: 8 }}>Onboarding</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            Track seller onboarding status, next actions, and notes after approval.
          </p>
        </div>
        <div style={{ color: "#7dd3fc" }}>{isLoading ? "Loading..." : statusMessage}</div>
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
          <h2 style={{ marginTop: 0 }}>Onboarding Queue</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item) => (
              <button
                key={item.leadId}
                type="button"
                onClick={() => {
                  setSelectedLeadId(item.leadId);
                  void loadDetail(item.leadId);
                }}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 12,
                  border:
                    selectedLeadId === item.leadId ? "1px solid #38bdf8" : "1px solid #1f2937",
                  background: selectedLeadId === item.leadId ? "#082f49" : "#020617",
                  color: "#e2e8f0",
                  cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong>{item.displayName}</strong>
                  <span style={badgeStyle}>{item.onboardingStatus}</span>
                </div>
                <div style={{ color: "#94a3b8", marginTop: 4 }}>
                  {item.handle} / {item.platform}
                </div>
                {item.nextAction ? (
                  <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 10 }}>
                    Next: {item.nextAction}
                  </div>
                ) : null}
              </button>
            ))}
            {items.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>No onboarding items yet.</div>
            ) : null}
          </div>
        </aside>

        <section style={panelStyle}>
          {detail ? (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  gap: 16
                }}
              >
                <div>
                  <h2 style={{ marginTop: 0, marginBottom: 6 }}>{detail.displayName}</h2>
                  <div style={{ color: "#94a3b8" }}>
                    {detail.handle} / {detail.platform} / CRM {detail.crmStage ?? "N/A"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={secondaryButtonStyle} onClick={handleStart}>
                    Start
                  </button>
                  <button type="button" style={primaryButtonStyle} onClick={handleSave}>
                    Save
                  </button>
                </div>
              </div>

              <div style={itemCardStyle}>
                <strong>Status</strong>
                <select
                  value={detail.onboardingStatus}
                  onChange={(event) =>
                    setDetail((prev) =>
                      prev
                        ? {
                            ...prev,
                            onboardingStatus: event.target.value
                          }
                        : prev
                    )
                  }
                  style={{ ...inputStyle, marginTop: 12 }}
                >
                  <option value="NOT_STARTED">NOT_STARTED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="READY_FOR_LISTING">READY_FOR_LISTING</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>

              <div style={itemCardStyle}>
                <strong>Next Action</strong>
                <input
                  value={detail.nextAction ?? ""}
                  onChange={(event) =>
                    setDetail((prev) =>
                      prev
                        ? {
                            ...prev,
                            nextAction: event.target.value
                          }
                        : prev
                    )
                  }
                  style={{ ...inputStyle, marginTop: 12 }}
                />
              </div>

              <div style={itemCardStyle}>
                <strong>Notes</strong>
                <textarea
                  value={detail.notes ?? ""}
                  onChange={(event) =>
                    setDetail((prev) =>
                      prev
                        ? {
                            ...prev,
                            notes: event.target.value
                          }
                        : prev
                    )
                  }
                  style={{ ...inputStyle, marginTop: 12, minHeight: 180 }}
                />
              </div>

              <div style={itemCardStyle}>
                <strong>Timeline</strong>
                <div style={{ color: "#94a3b8", marginTop: 10 }}>
                  Started: {detail.startedAt ? new Date(detail.startedAt).toLocaleString("ko-KR") : "Not started"}
                </div>
                <div style={{ color: "#94a3b8", marginTop: 6 }}>
                  Updated: {detail.updatedAt ? new Date(detail.updatedAt).toLocaleString("ko-KR") : "N/A"}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: "#94a3b8" }}>Select an onboarding item to continue.</p>
          )}
        </section>
      </section>
    </main>
  );
}

const itemCardStyle: CSSProperties = {
  background: "#020617",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: 14
};

const badgeStyle: CSSProperties = {
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
