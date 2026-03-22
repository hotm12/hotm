"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import {
  defaultOperatorProfile,
  saveOperatorProfile,
  type OperatorProfile
} from "./operator-profile";

type DashboardMetric = {
  label: string;
  value: number;
  description: string;
};

type DashboardCount = {
  label: string;
  value: number;
};

type DashboardOnboardingItem = {
  leadId: number;
  displayName: string;
  onboardingStatus: string;
  nextAction?: string;
  updatedAt?: string;
};

type AuditLogItem = {
  id: number;
  entityType: string;
  entityId: number;
  actionType: string;
  actor?: string;
  summary?: string;
  detail?: string;
  createdAt: string;
};

type DashboardPayload = {
  metrics: DashboardMetric[];
  leadStatusCounts: DashboardCount[];
  crmStageCounts: DashboardCount[];
  onboardingItems: DashboardOnboardingItem[];
  recentActivity: AuditLogItem[];
  storage: {
    storageMode: "DATABASE" | "JSON_FALLBACK";
    devSeedEnabled: boolean;
    databaseUrlConfigured: boolean;
  };
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

const routes = [
  { href: "/settings", label: "Settings" },
  { href: "/discovery", label: "Discovery" },
  { href: "/leads", label: "Leads" },
  { href: "/review", label: "Review" },
  { href: "/outreach", label: "Outreach" },
  { href: "/crm", label: "CRM" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/audit", label: "Audit Log" }
];

const fallbackDashboard: DashboardPayload = {
  metrics: [
    { label: "Campaigns", value: 1, description: "Active seller discovery campaigns" },
    { label: "Total Leads", value: 3, description: "Saved seller candidates" },
    { label: "Review Queue", value: 2, description: "Leads waiting for review" },
    { label: "Outreach Queue", value: 1, description: "Drafts ready for approval or send" },
    { label: "CRM In Flight", value: 1, description: "Leads with replies or follow-ups" },
    { label: "Onboarding", value: 1, description: "Leads currently in onboarding" }
  ],
  leadStatusCounts: [
    { label: "NEW", value: 1 },
    { label: "REVIEW_READY", value: 1 },
    { label: "APPROVED", value: 1 }
  ],
  crmStageCounts: [
    { label: "CONTACTED", value: 2 },
    { label: "REPLIED", value: 1 }
  ],
  onboardingItems: [
    {
      leadId: 3,
      displayName: "KGlow Finds",
      onboardingStatus: "IN_PROGRESS",
      nextAction: "Request product catalog",
      updatedAt: "2026-03-18T03:10:00Z"
    }
  ],
  recentActivity: [
    {
      id: 1,
      entityType: "LEAD",
      entityId: 3,
      actionType: "ONBOARDING_STARTED",
      summary: "Onboarding started",
      detail: "Moved to product catalog request step.",
      createdAt: "2026-03-18T03:00:00Z"
    }
  ],
  storage: {
    storageMode: "JSON_FALLBACK",
    devSeedEnabled: true,
    databaseUrlConfigured: false
  }
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export function DashboardClient() {
  const [dashboard, setDashboard] = useState<DashboardPayload>(fallbackDashboard);
  const [statusMessage, setStatusMessage] = useState("Loading dashboard.");
  const [operatorProfile, setOperatorProfile] = useState<OperatorProfile>(defaultOperatorProfile);

  useEffect(() => {
    void loadDashboard();
    setOperatorProfile(defaultOperatorProfile);
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("seller-find-operator-profile");
        if (raw) {
          setOperatorProfile(JSON.parse(raw) as OperatorProfile);
        }
      } catch {}
    }
  }, []);

  async function loadDashboard() {
    try {
      const nextDashboard = await request<DashboardPayload>("/dashboard");
      setDashboard(nextDashboard);
      setStatusMessage("Loaded live metrics from API.");
    } catch {
      setDashboard(fallbackDashboard);
      setStatusMessage("API unavailable. Showing fallback dashboard.");
    }
  }

  function handleSaveOperatorProfile() {
    saveOperatorProfile(operatorProfile);
    setStatusMessage(`Saved operator profile: ${operatorProfile.name}`);
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Seller Find Dashboard</div>
          <h1 style={titleStyle}>Seller Outreach Operations</h1>
          <p style={descriptionStyle}>
            Track discovery, review, outreach, CRM, and onboarding flow from one workspace and jump
            directly into the next task.
          </p>
        </div>
        <div style={statusStyle}>{statusMessage}</div>
      </section>

      <section style={navGridStyle}>
        {routes.map((route) => (
          <a key={route.href} href={route.href} style={navCardStyle}>
            <strong>{route.label}</strong>
            <span style={navHintStyle}>Open workspace</span>
          </a>
        ))}
      </section>

      <section style={metricGridStyle}>
        {dashboard.metrics.map((metric) => (
          <article key={metric.label} style={panelStyle}>
            <div style={mutedStyle}>{metric.label}</div>
            <div style={metricValueStyle}>{metric.value}</div>
            <p style={panelDescriptionStyle}>{metric.description}</p>
          </article>
        ))}
      </section>

      <section style={twoColumnStyle}>
        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Storage Mode</h2>
          <div style={listStyle}>
            <div style={rowStyle}>
              <span>Mode</span>
              <strong>{dashboard.storage.storageMode}</strong>
            </div>
            <div style={rowStyle}>
              <span>Database URL</span>
              <strong>{dashboard.storage.databaseUrlConfigured ? "Configured" : "Missing"}</strong>
            </div>
            <div style={rowStyle}>
              <span>Dev Seed</span>
              <strong>{dashboard.storage.devSeedEnabled ? "Enabled" : "Disabled"}</strong>
            </div>
          </div>
        </article>

        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Operator Profile</h2>
          <div style={listStyle}>
            <input
              style={inputStyle}
              value={operatorProfile.name}
              onChange={(event) =>
                setOperatorProfile((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Operator name"
            />
            <select
              style={inputStyle}
              value={operatorProfile.role}
              onChange={(event) =>
                setOperatorProfile((current) => ({
                  ...current,
                  role: event.target.value as OperatorProfile["role"]
                }))
              }
            >
              <option value="ADMIN">ADMIN</option>
              <option value="OPERATOR">OPERATOR</option>
              <option value="REVIEWER">REVIEWER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
            <button type="button" style={actionButtonStyle} onClick={handleSaveOperatorProfile}>
              Save Operator
            </button>
          </div>
        </article>
      </section>

      <section style={twoColumnStyle}>
        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Lead Status</h2>
          <div style={listStyle}>
            {dashboard.leadStatusCounts.map((item) => (
              <div key={item.label} style={rowStyle}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>CRM Stage</h2>
          <div style={listStyle}>
            {dashboard.crmStageCounts.map((item) => (
              <div key={item.label} style={rowStyle}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={twoColumnStyle}>
        <article style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Next Onboarding Actions</h2>
            <a href="/onboarding" style={linkStyle}>
              View all
            </a>
          </div>
          <div style={listStyle}>
            {dashboard.onboardingItems.map((item) => (
              <div key={item.leadId} style={cardStyle}>
                <div style={rowStyle}>
                  <strong>{item.displayName}</strong>
                  <span style={tagStyle}>{item.onboardingStatus}</span>
                </div>
                <div style={cardDescriptionStyle}>{item.nextAction ?? "No next action"}</div>
                <div style={mutedStyle}>
                  {item.updatedAt
                    ? new Date(item.updatedAt).toLocaleString("ko-KR")
                    : "No timestamp"}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Recent Activity</h2>
            <a href="/audit" style={linkStyle}>
              Open audit log
            </a>
          </div>
          <div style={listStyle}>
            {dashboard.recentActivity.map((item) => (
              <div key={item.id} style={cardStyle}>
                <div style={rowStyle}>
                  <strong>{item.summary ?? item.actionType}</strong>
                  <span style={tagStyle}>
                    {item.entityType} #{item.entityId}
                  </span>
                </div>
                <div style={cardDescriptionStyle}>{item.detail ?? "No detail"}</div>
                <div style={mutedStyle}>{new Date(item.createdAt).toLocaleString("ko-KR")}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 32,
  background:
    "linear-gradient(180deg, rgba(14, 165, 233, 0.14) 0%, rgba(2, 6, 23, 0) 24%), #020617",
  color: "#e2e8f0",
  display: "grid",
  gap: 20
};

const heroStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #1e293b",
  borderRadius: 24,
  padding: 28,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 24
};

const eyebrowStyle: CSSProperties = {
  color: "#38bdf8",
  fontSize: 13,
  letterSpacing: 1.2,
  textTransform: "uppercase"
};

const titleStyle: CSSProperties = {
  margin: "12px 0 10px",
  fontSize: 36
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  maxWidth: 760,
  lineHeight: 1.7
};

const statusStyle: CSSProperties = {
  color: "#7dd3fc",
  fontSize: 14,
  maxWidth: 320,
  textAlign: "right"
};

const navGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 14
};

const navCardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 18,
  borderRadius: 18,
  background: "rgba(15, 23, 42, 0.9)",
  border: "1px solid #1e293b",
  color: "#e2e8f0",
  textDecoration: "none"
};

const navHintStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 13
};

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 20
};

const panelStyle: CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid #1e293b",
  borderRadius: 22,
  padding: 24,
  display: "grid",
  gap: 14
};
const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0",
  padding: "11px 12px"
};
const actionButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "12px 16px",
  background: "#38bdf8",
  color: "#082f49",
  fontWeight: 700,
  cursor: "pointer"
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 12
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center"
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 16,
  padding: 16
};

const mutedStyle: CSSProperties = {
  color: "#94a3b8",
  fontSize: 14
};

const metricValueStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  marginTop: 6
};

const panelDescriptionStyle: CSSProperties = {
  color: "#94a3b8",
  margin: 0,
  lineHeight: 1.6
};

const cardDescriptionStyle: CSSProperties = {
  color: "#cbd5e1",
  lineHeight: 1.6
};

const tagStyle: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  background: "#082f49",
  color: "#7dd3fc",
  fontSize: 12
};

const linkStyle: CSSProperties = {
  color: "#7dd3fc",
  textDecoration: "none",
  fontSize: 14
};
