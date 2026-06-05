import { useState, useRef } from "react";

const PRESETS = {
  automation_drop: {
    client: "Greystone Properties", tier: "Enterprise", arr: "£72,000",
    reporter: "Sarah Kim, Head of Operations", renewal: "6 weeks",
    issue: "Our automation rate has fallen from 84% to 41% over the past 48 hours. Tenants are complaining about delayed responses and our team is overwhelmed handling tickets manually. We had 340 unresolved queries at 9am this morning. This is completely unacceptable — what is going on?",
    context: "Deployment pushed Friday evening v2.3.1 — new NLP model update. No alerts fired on our side."
  },
  integration_broken: {
    client: "Meridian Housing Group", tier: "Growth", arr: "£28,000",
    reporter: "Tom Bassett, IT Manager", renewal: "4 months",
    issue: "The webhook integration between LightWork and our property management system stopped sending data at approximately 11pm last night. Move-in requests are not being routed, maintenance jobs are not being logged. We have 8 properties affected.",
    context: "Client is mid-onboarding, go-live was scheduled for next Tuesday. This is their first production incident."
  },
  angry_exec: {
    client: "Apex Living", tier: "Enterprise", arr: "£95,000",
    reporter: "James Okafor, CEO", renewal: "6 weeks",
    issue: "I'm personally reaching out because I'm extremely unhappy with the service we've received over the last month. Response times have been terrible, our CSM doesn't reply within the same day, and I'm seeing no improvement in our automation metrics. I'm questioning whether we made the right decision switching to LightWork. I'd like to speak to someone senior this week.",
    context: "Account is up for renewal in 6 weeks. CSM has been on leave for 2 weeks — cover was arranged but not communicated to the client."
  },
  data_quality: {
    client: "Elmwood Estates", tier: "Growth", arr: "£32,000",
    reporter: "Priya Sharma, Data Analyst", renewal: "5 months",
    issue: "We've noticed the satisfaction scores being reported in our LightWork dashboard don't match what we're seeing in our internal CRM. Specifically, LightWork is showing 4.2/5 but our own survey data shows 3.1/5 for the same period. We have a board presentation next week using these figures.",
    context: "Client connected a third-party survey tool 6 weeks ago. Mapping config was done manually."
  },
  sla_breach: {
    client: "Riverbank Residences", tier: "Starter", arr: "£14,000",
    reporter: "Callum Price, Operations Lead", renewal: "8 months",
    issue: "Tenants have been reporting that it takes over 20 minutes to get a first response from the AI assistant. Our SLA is 3 minutes. This started about 4 days ago. A couple of tenants have already complained to the building manager directly.",
    context: "No recent changes on our side. Client is in a shared infrastructure tier."
  }
};

const TEAMS = [
  { id: "engineering", label: "Engineering", icon: "⚙", desc: "Bugs, failures, performance", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "cs",          label: "Customer Success", icon: "🤝", desc: "Relationship, onboarding", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  { id: "product",     label: "Product",     icon: "💡", desc: "Feature gaps, UX issues",  color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  { id: "ops",         label: "Operations",  icon: "🔧", desc: "Config, integrations",     color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  { id: "leadership",  label: "Leadership",  icon: "⭐", desc: "Exec escalation",          color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
];

async function callAI(prompt) {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.content?.map(i => i.text || "").join("") || "";
}

function Badge({ label, color, bg, border }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: bg, color, border: `0.5px solid ${border}`, fontWeight: 500, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const map = {
    Critical: { color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
    High:     { color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
    Medium:   { color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
    Low:      { color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  };
  const s = map[severity] || map.Medium;
  return <Badge label={severity} {...s} />;
}

function ChurnBadge({ risk }) {
  const map = {
    High:   { color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
    Medium: { color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
    Low:    { color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  };
  const s = map[risk] || map.Medium;
  return <Badge label={`Churn risk: ${risk}`} {...s} />;
}

function CopyButton({ getText }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = typeof getText === "function" ? getText() : getText;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };
  return (
    <button onClick={copy} style={{ fontSize: 11, padding: "4px 10px", border: "0.5px solid #e5e7eb", borderRadius: 6, background: copied ? "#f0fdf4" : "transparent", color: copied ? "#16a34a" : "#6b7280", cursor: "pointer", fontWeight: 500, transition: "all .15s" }}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function EditableEmail({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", minHeight: 200, padding: "12px 14px",
        fontSize: 13, lineHeight: 1.75, color: "#1f2937",
        background: "#f9fafb", border: "0.5px solid #d1d5db",
        borderRadius: 8, resize: "vertical", outline: "none",
        fontFamily: "Georgia, serif", boxSizing: "border-box"
      }}
    />
  );
}

function TriageResult({ result, client, tier, arr, reporter, selectedTeam, onReset }) {
  const [emailDraft, setEmailDraft] = useState(result.client_email || "");
  const [ticketText, setTicketText] = useState(result.internal_ticket || "");
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingTicket, setEditingTicket] = useState(false);
  const team = TEAMS.find(t => t.id === selectedTeam) || TEAMS[0];
  const now = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 14, padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#0f1117", letterSpacing: -.3 }}>{client}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
              {reporter && <span>{reporter} · </span>}
              {tier && <span>{tier} · </span>}
              {arr && <span>{arr} · </span>}
              <span>{now}</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <SeverityBadge severity={result.severity} />
              <ChurnBadge risk={result.churn_risk} />
              <Badge label={result.issue_type} color="#185fa5" bg="#e6f1fb" border="#b3d4f5" />
              <Badge label={`→ ${team.label}`} color={team.color} bg={team.bg} border={team.border} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", background: "#f3f4f6", padding: "4px 9px", borderRadius: 6 }}>
            Triage complete
          </div>
        </div>
      </div>

      {/* Summary + Severity rationale */}
      <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Summary</div>
        <div style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.65, marginBottom: 10 }}>{result.summary}</div>
        <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", borderTop: "0.5px solid #f3f4f6", paddingTop: 8 }}>{result.severity_rationale}</div>
      </div>

      {/* Routing */}
      <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Routing</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {(result.routing || []).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f9fafb", borderRadius: 8, border: "0.5px solid #e5e7eb" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0f1117", minWidth: 120 }}>{r.team}</span>
              <span style={{ fontSize: 12, color: "#6b7280", flex: 1 }}>{r.reason}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: r.urgency === "Immediate" ? "#fef2f2" : r.urgency === "Today" ? "#fffbeb" : "#f0fdf4", color: r.urgency === "Immediate" ? "#dc2626" : r.urgency === "Today" ? "#d97706" : "#16a34a", fontWeight: 500 }}>{r.urgency}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Immediate actions */}
      <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Immediate actions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {(result.immediate_actions || []).map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#e6f1fb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#185fa5", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <span style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.55 }}>{a}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Client holding message — editable */}
      <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>✉ Client holding message</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Edit before sending — click the text to modify</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setEditingEmail(e => !e)}
              style={{ fontSize: 11, padding: "4px 10px", border: "0.5px solid #e5e7eb", borderRadius: 6, background: editingEmail ? "#e6f1fb" : "transparent", color: editingEmail ? "#185fa5" : "#6b7280", cursor: "pointer" }}>
              {editingEmail ? "Done" : "Edit"}
            </button>
            <CopyButton getText={() => emailDraft} />
          </div>
        </div>
        {editingEmail ? (
          <EditableEmail value={emailDraft} onChange={setEmailDraft} />
        ) : (
          <div onClick={() => setEditingEmail(true)}
            style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#1f2937", lineHeight: 1.75, whiteSpace: "pre-wrap", border: "0.5px solid #e5e7eb", cursor: "text", fontFamily: "Georgia, serif" }}>
            {emailDraft}
          </div>
        )}
      </div>

      {/* Internal ticket — editable */}
      <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>🔧 Internal ticket — {team.label}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Ready to paste into Jira, Linear, or Slack</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setEditingTicket(t => !t)}
              style={{ fontSize: 11, padding: "4px 10px", border: "0.5px solid #e5e7eb", borderRadius: 6, background: editingTicket ? "#e6f1fb" : "transparent", color: editingTicket ? "#185fa5" : "#6b7280", cursor: "pointer" }}>
              {editingTicket ? "Done" : "Edit"}
            </button>
            <CopyButton getText={() => ticketText} />
          </div>
        </div>
        {editingTicket ? (
          <textarea value={ticketText} onChange={e => setTicketText(e.target.value)}
            style={{ width: "100%", minHeight: 160, padding: "12px 14px", fontSize: 12, lineHeight: 1.7, color: "#1f2937", background: "#f9fafb", border: "0.5px solid #d1d5db", borderRadius: 8, resize: "vertical", outline: "none", fontFamily: "DM Mono, monospace", boxSizing: "border-box" }} />
        ) : (
          <div onClick={() => setEditingTicket(true)}
            style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#1f2937", lineHeight: 1.7, whiteSpace: "pre-wrap", border: "0.5px solid #e5e7eb", fontFamily: "DM Mono, monospace", cursor: "text" }}>
            {ticketText}
          </div>
        )}
      </div>

      {/* Churn risk rationale */}
      {result.churn_risk_rationale && (
        <div style={{ background: "#fffbeb", border: "0.5px solid #fcd34d", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#78350f" }}>
          <span style={{ fontWeight: 600 }}>Churn note: </span>{result.churn_risk_rationale}
        </div>
      )}

      <button onClick={onReset}
        style={{ padding: "10px", border: "0.5px solid #e5e7eb", borderRadius: 10, background: "#fff", fontSize: 13, color: "#6b7280", cursor: "pointer" }}>
        ← Triage another issue
      </button>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState({ client: "", tier: "", arr: "", reporter: "", renewal: "", issue: "", context: "" });
  const [selectedTeam, setSelectedTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadPreset = (key) => {
    const p = PRESETS[key];
    setForm({ client: p.client, tier: p.tier, arr: p.arr, reporter: p.reporter, renewal: p.renewal, issue: p.issue, context: p.context });
  };

  const reset = () => { setResult(null); setError(null); setForm({ client: "", tier: "", arr: "", reporter: "", renewal: "", issue: "", context: "" }); setSelectedTeam(""); };

  const run = async () => {
    if (!form.client.trim() || !form.issue.trim()) { setError("Please enter a client name and issue description."); return; }
    if (!selectedTeam) { setError("Please select a team to route this to."); return; }
    setLoading(true); setError(null);

    const team = TEAMS.find(t => t.id === selectedTeam);
    const prompt = `You are an expert Customer Success escalation specialist at LightWork AI — a SaaS platform that automates tenant communications for property management companies using an AI agent called Felicity.

Analyse this escalation and return ONLY valid JSON. No markdown. No code fences. Start with { and end with }.

{
  "severity": "Critical|High|Medium|Low",
  "severity_rationale": "1-2 sentences explaining the severity classification",
  "issue_type": "Integration failure|Performance degradation|Relationship risk|Data quality|Billing/contract|Safety concern|Feature gap|Other",
  "summary": "2-3 sentences: what happened, what the impact is, why it matters",
  "immediate_actions": ["action 1 with owner and timeframe", "action 2", "action 3", "action 4"],
  "routing": [
    {"team": "${team?.label}", "reason": "specific reason this team owns this", "urgency": "Immediate|Today|This week"},
    {"team": "second team if relevant", "reason": "reason", "urgency": "Immediate|Today|This week"}
  ],
  "client_email": "Full professional email from CSM to client. Start with Subject: on the first line. Then a blank line. Then the email body. Use the client name. Be warm, take ownership, set clear expectations. Sign off as the CSM. Do NOT over-promise or be defensive.",
  "internal_ticket": "Structured internal ticket for the ${team?.label} team. Use this exact format:\\nTITLE: [one line]\\nPRIORITY: [Critical/High/Medium/Low]\\nCLIENT: [name | tier | ARR]\\nREPORTED BY: [name/role]\\nISSUE:\\n[2-3 lines describing the technical problem]\\nIMPACT:\\n[what is broken for the client right now]\\nCONTEXT:\\n[any internal context that helps]\\nACTION NEEDED:\\n[what the team needs to do and by when]",
  "churn_risk": "High|Medium|Low",
  "churn_risk_rationale": "1 sentence on churn risk and why"
}

CLIENT: ${form.client}
TIER: ${form.tier || "Unknown"}
ARR: ${form.arr || "Unknown"}
RENEWAL: ${form.renewal || "Unknown"}
REPORTED BY: ${form.reporter || "Unknown"}
ROUTED TO: ${team?.label}
ISSUE: ${form.issue}
INTERNAL CONTEXT: ${form.context || "None provided"}

Return only the JSON object.`;

  try {
      const raw = await callAI(prompt);
      // Strip any markdown fences and find the JSON object
      const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first === -1 || last === -1) throw new Error("No JSON found in response: " + cleaned.slice(0, 100));
      const parsed = JSON.parse(cleaned.slice(first, last + 1));
      setResult(parsed);
    } catch (e) {
      setError("Triage failed: " + e.message);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#f7f8fa;color:#0f1117}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px}
        textarea{font-family:'DM Sans',sans-serif}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .3s ease both}
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f7f8fa" }}>
        {/* Nav */}
        <div style={{ background: "#fff", borderBottom: "0.5px solid #e5e7eb", padding: "0 24px", display: "flex", alignItems: "center", height: 52, position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>L</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0f1117", letterSpacing: -.2 }}>LightWork AI</span>
            <span style={{ fontSize: 11, color: "#9ca3af", background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>Escalation Triage</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>Live</span>
          </div>
        </div>

        <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px" }}>
          {!result ? (
            <div className="fade-up">
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#0f1117", letterSpacing: -.3 }}>Escalation triage</div>
                <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 3 }}>Paste a client issue, pick a team, get severity classification, routing, draft email and internal ticket in seconds.</div>
              </div>

              {/* Presets */}
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Load a scenario</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {[
                    { key: "automation_drop", label: "Automation rate drop" },
                    { key: "integration_broken", label: "Integration failure" },
                    { key: "angry_exec", label: "Angry executive" },
                    { key: "data_quality", label: "Data discrepancy" },
                    { key: "sla_breach", label: "SLA breach" },
                  ].map(p => (
                    <button key={p.key} onClick={() => loadPreset(p.key)}
                      style={{ fontSize: 12, padding: "5px 11px", border: "0.5px solid #e5e7eb", borderRadius: 20, background: "#f9fafb", color: "#374151", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                      onMouseLeave={e => e.currentTarget.style.background = "#f9fafb"}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form */}
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Client details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {[
                    { key: "client", label: "Client name *", ph: "Greystone Properties" },
                    { key: "tier", label: "Account tier", ph: "Enterprise / Growth / Starter" },
                    { key: "arr", label: "ARR", ph: "£72,000" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>{f.label}</label>
                      <input value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.ph}
                        style={{ width: "100%", padding: "7px 10px", border: "0.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#0f1117", background: "#f9fafb", outline: "none" }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { key: "reporter", label: "Reported by", ph: "Sarah Kim, Head of Ops" },
                    { key: "renewal", label: "Renewal (optional)", ph: "e.g. 6 weeks" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>{f.label}</label>
                      <input value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.ph}
                        style={{ width: "100%", padding: "7px 10px", border: "0.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#0f1117", background: "#f9fafb", outline: "none" }} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Issue description *</label>
                  <textarea value={form.issue} onChange={e => set("issue", e.target.value)}
                    placeholder="Paste the client's message or describe what happened…"
                    style={{ width: "100%", minHeight: 110, padding: "8px 10px", border: "0.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#0f1117", background: "#f9fafb", resize: "vertical", outline: "none", lineHeight: 1.55 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>Internal context (optional)</label>
                  <textarea value={form.context} onChange={e => set("context", e.target.value)}
                    placeholder="Recent deploys, known incidents, previous tickets, account history…"
                    style={{ width: "100%", minHeight: 60, padding: "8px 10px", border: "0.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#0f1117", background: "#f9fafb", resize: "vertical", outline: "none", lineHeight: 1.55 }} />
                </div>
              </div>

              {/* Team selection */}
              <div style={{ background: "#fff", border: "0.5px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Route to team</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                  {TEAMS.map(t => (
                    <div key={t.id} onClick={() => setSelectedTeam(t.id)}
                      style={{ border: `${selectedTeam === t.id ? "1.5px" : "0.5px"} solid ${selectedTeam === t.id ? t.color : "#e5e7eb"}`, borderRadius: 10, padding: "10px 8px", cursor: "pointer", background: selectedTeam === t.id ? t.bg : "#f9fafb", textAlign: "center", transition: "all .15s" }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: selectedTeam === t.id ? t.color : "#374151" }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, lineHeight: 1.3 }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {error && <div style={{ fontSize: 13, color: "#dc2626", padding: "8px 12px", background: "#fef2f2", borderRadius: 8, border: "0.5px solid #fca5a5", marginBottom: 10 }}>{error}</div>}

              <button onClick={run} disabled={loading}
                style={{ width: "100%", padding: "12px", background: loading ? "#9ca3af" : "#0f1117", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                {loading ? (
                  <>
                    <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                    Analysing escalation…
                  </>
                ) : "⚡ Run triage"}
              </button>
            </div>
          ) : (
            <div className="fade-up">
              <TriageResult
                result={result}
                client={form.client}
                tier={form.tier}
                arr={form.arr}
                reporter={form.reporter}
                selectedTeam={selectedTeam}
                onReset={reset}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
