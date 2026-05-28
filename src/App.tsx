import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Download,
  FileText,
  History,
  Home,
  LayoutDashboard,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { createRelayDraft, relayTemplateText, sampleMeetingNotes } from "./relay";
import type { RelayDraft, RelayTask, TaskStatus } from "./types";
import "./styles.css";

type ViewKey = "capture" | "loading" | "dashboard" | "history" | "template";

type SavedState = {
  pasteText: string;
  drafts: RelayDraft[];
  activeDraftId: string | null;
};

const STORAGE_KEY = "relay:workspace:v2";
const TEMPLATE_COPY_URL =
  import.meta.env.VITE_RELAY_TEMPLATE_COPY_URL ||
  "https://docs.google.com/document/d/1o6WZbshidrm99XdLXae_i7Ws5jsI4Nff8L-5OpH3uck/copy";
const TEMPLATE_EDIT_URL =
  import.meta.env.VITE_RELAY_TEMPLATE_EDIT_URL ||
  "https://docs.google.com/document/d/1o6WZbshidrm99XdLXae_i7Ws5jsI4Nff8L-5OpH3uck/edit";

const statusLabels: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  complete: "Complete",
};

function loadSavedState(): SavedState {
  if (typeof window === "undefined") return { pasteText: "", drafts: [], activeDraftId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { pasteText: "", drafts: [], activeDraftId: null };
    const parsed = JSON.parse(raw) as SavedState;
    return {
      pasteText: parsed.pasteText ?? "",
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      activeDraftId: parsed.activeDraftId ?? null,
    };
  } catch {
    return { pasteText: "", drafts: [], activeDraftId: null };
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

function App() {
  const saved = useMemo(() => loadSavedState(), []);
  const [pasteText, setPasteText] = useState(saved.pasteText);
  const [drafts, setDrafts] = useState<RelayDraft[]>(saved.drafts);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(saved.activeDraftId);
  const [view, setView] = useState<ViewKey>(saved.activeDraftId ? "dashboard" : "capture");
  const [toast, setToast] = useState("");

  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) ?? drafts[0] ?? null;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pasteText, drafts, activeDraftId }));
  }, [activeDraftId, drafts, pasteText]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const completion = useMemo(() => {
    if (!activeDraft?.tasks.length) return 0;
    return Math.round((activeDraft.tasks.filter((task) => task.status === "complete").length / activeDraft.tasks.length) * 100);
  }, [activeDraft]);

  const navigate = (nextView: ViewKey) => {
    if (nextView === "dashboard" && !activeDraft) {
      setView("capture");
      return;
    }
    setView(nextView);
  };

  const loadSample = () => {
    setPasteText(sampleMeetingNotes);
    setToast("Sample notes loaded.");
  };

  const reset = () => {
    setPasteText("");
    setDrafts([]);
    setActiveDraftId(null);
    setView("capture");
    window.localStorage.removeItem(STORAGE_KEY);
    setToast("Relay reset.");
  };

  const generate = () => {
    if (!pasteText.trim()) {
      setToast("Paste meeting notes first.");
      return;
    }
    setView("loading");
    window.setTimeout(() => {
      const draft = createRelayDraft(pasteText);
      setDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)].slice(0, 12));
      setActiveDraftId(draft.id);
      setView("dashboard");
      setToast("Dashboard generated.");
    }, 850);
  };

  const updateActiveDraft = (updater: (draft: RelayDraft) => RelayDraft) => {
    if (!activeDraft) return;
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraft.id
          ? {
              ...updater(draft),
              updatedAt: new Date().toISOString(),
            }
          : draft,
      ),
    );
  };

  const updateTask = (taskId: string, changes: Partial<RelayTask>) => {
    updateActiveDraft((draft) => ({
      ...draft,
      tasks: draft.tasks.map((task) => (task.id === taskId ? { ...task, ...changes } : task)),
    }));
  };

  const addTask = () => {
    updateActiveDraft((draft) => ({
      ...draft,
      tasks: [
        ...draft.tasks,
        {
          id: `task-manual-${Date.now().toString(36)}`,
          title: "New follow-up task",
          status: "todo",
          dueDateText: "",
          source: "Manual task",
        },
      ],
    }));
    setToast("Task added.");
  };

  const removeTask = (taskId: string) => {
    updateActiveDraft((draft) => ({
      ...draft,
      tasks: draft.tasks.filter((task) => task.id !== taskId),
    }));
    setToast("Task removed.");
  };

  const markAllComplete = () => {
    updateActiveDraft((draft) => ({
      ...draft,
      tasks: draft.tasks.map((task) => ({ ...task, status: "complete" })),
    }));
    setToast("Tasks marked complete.");
  };

  const copyRecap = async () => {
    if (!activeDraft) return;
    await copyText(activeDraft.recap);
    setToast("Recap copied.");
  };

  const copyTemplate = async () => {
    await copyText(relayTemplateText);
    setToast("Template text copied.");
  };

  const exportDraft = () => {
    if (!activeDraft) return;
    const blob = new Blob([JSON.stringify(activeDraft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeDraft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "relay"}-dashboard.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Dashboard exported.");
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => navigate("capture")}>
          <img src="/relay-mark.svg" alt="" />
          <span>
            <strong>Relay</strong>
            <small>Personal meeting follow-up</small>
          </span>
        </button>

        <nav className="nav-list" aria-label="Relay navigation">
          <div className="nav-section">
            <span className="nav-section-label">Workspace</span>
            <NavButton active={view === "capture"} icon={<Home />} label="Capture" onClick={() => navigate("capture")} />
            <NavButton active={view === "dashboard"} icon={<LayoutDashboard />} label="Dashboard" onClick={() => navigate("dashboard")} />
            <NavButton active={view === "history"} icon={<History />} label="History" onClick={() => navigate("history")} />
            <NavButton active={view === "template"} icon={<FileText />} label="Template" onClick={() => navigate("template")} />
          </div>
        </nav>

        <section className="sidebar-panel">
          <div className="mini-visual">
            <span />
            <span />
            <span />
          </div>
          <strong>{drafts.length} saved dashboards</strong>
          <small>Paste notes once, then use the dashboard to work through the follow-up.</small>
        </section>
      </aside>

      <section className="main-area">
        {view === "capture" && (
          <CapturePage pasteText={pasteText} setPasteText={setPasteText} loadSample={loadSample} generate={generate} reset={reset} />
        )}
        {view === "loading" && <LoadingPage />}
        {view === "dashboard" && activeDraft && (
          <DashboardPage
            draft={activeDraft}
            completion={completion}
            updateTask={updateTask}
            addTask={addTask}
            removeTask={removeTask}
            markAllComplete={markAllComplete}
            copyRecap={copyRecap}
            exportDraft={exportDraft}
            newPaste={() => navigate("capture")}
          />
        )}
        {view === "history" && (
          <HistoryPage
            drafts={drafts}
            activeDraftId={activeDraftId}
            openDraft={(draftId) => {
              setActiveDraftId(draftId);
              setView("dashboard");
            }}
            newPaste={() => navigate("capture")}
          />
        )}
        {view === "template" && <TemplatePage copyTemplate={copyTemplate} />}
      </section>

      {toast ? (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={active ? "nav-item active" : "nav-item"} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CapturePage({
  pasteText,
  setPasteText,
  loadSample,
  generate,
  reset,
}: {
  pasteText: string;
  setPasteText: (text: string) => void;
  loadSample: () => void;
  generate: () => void;
  reset: () => void;
}) {
  return (
    <div className="page-stack">
      <section className="dashboard-hero capture-hero">
        <div className="hero-copy">
          <h1>Paste meeting notes. Get a personal dashboard.</h1>
          <p>
            Relay reads one copied block of notes and turns it into a calm follow-up view with recap, tasks, questions,
            resources, and due dates.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={generate}>
              <Sparkles size={17} />
              Generate dashboard
            </button>
            <button className="ghost-button" type="button" onClick={loadSample}>
              <ClipboardCopy size={17} />
              Load sample
            </button>
            <button className="ghost-button" type="button" onClick={reset}>
              <RefreshCw size={17} />
              Reset
            </button>
          </div>
        </div>
        <div className="transform-visual" aria-hidden="true">
          <div className="visual-window">
            <span className="visual-line short" />
            <span className="visual-line" />
            <span className="visual-line mid" />
            <span className="visual-line tiny" />
          </div>
          <div className="visual-arrow">
            <ArrowRight size={21} />
          </div>
          <div className="visual-cards">
            <span>Recap</span>
            <span>Tasks</span>
            <span>Due dates</span>
          </div>
        </div>
      </section>

      <section className="capture-layout">
        <section className="import-main">
          <div className="section-heading">
            <span className="eyebrow">Paste only</span>
            <h2>Meeting notes input</h2>
            <p>Copy the full notes from your doc or meeting record into this one box.</p>
          </div>
          <label className="field">
            <span>Meeting notes</span>
            <textarea
              className="paste-box"
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={relayTemplateText}
            />
          </label>
          <div className="generate-row">
            <button className="primary-button" type="button" onClick={generate}>
              <Sparkles size={17} />
              Generate dashboard
            </button>
          </div>
        </section>

        <TemplateCard />
      </section>
    </div>
  );
}

function TemplateCard() {
  return (
    <aside className="template-card" aria-label="Google Docs template">
      <TemplateLinkIcon />
      <span className="eyebrow">Google Docs</span>
      <h2>Meeting notes template</h2>
      <p>Use the editable source doc to keep every pasted note structured for Relay.</p>
      <a className="template-link" href={TEMPLATE_COPY_URL} target="_blank" rel="noreferrer">
        Open copy link
        <ArrowRight size={16} />
      </a>
      <a className="template-edit-link" href={TEMPLATE_EDIT_URL} target="_blank" rel="noreferrer">
        Edit source doc
      </a>
    </aside>
  );
}

function TemplateLinkIcon() {
  return (
    <svg className="template-link-icon" viewBox="0 0 128 128" aria-hidden="true">
      <path d="M30 46V22h46" />
      <path d="M28 102h74V56" />
      <path d="M54 74l50-50" />
      <path d="M76 22h30v30" />
    </svg>
  );
}

function LoadingPage() {
  return (
    <section className="loading-page">
      <div className="loader-card">
        <div className="loader-ring">
          <Loader2 size={54} />
        </div>
        <span className="eyebrow">Generating</span>
        <h1>Building your Relay dashboard.</h1>
        <p>Relay is sorting the pasted notes into recap, tasks, due dates, resources, and open questions.</p>
        <div className="loader-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}

function DashboardPage({
  draft,
  completion,
  updateTask,
  addTask,
  removeTask,
  markAllComplete,
  copyRecap,
  exportDraft,
  newPaste,
}: {
  draft: RelayDraft;
  completion: number;
  updateTask: (taskId: string, changes: Partial<RelayTask>) => void;
  addTask: () => void;
  removeTask: (taskId: string) => void;
  markAllComplete: () => void;
  copyRecap: () => void;
  exportDraft: () => void;
  newPaste: () => void;
}) {
  const dueSoon = draft.tasks.slice(0, 3);

  return (
    <div className="page-stack">
      <section className="student-hero">
        <div>
          <span className="eyebrow">My dashboard</span>
          <h1>{draft.title}</h1>
          <p>Everything Relay could extract from your pasted notes is organized into one personal follow-up space.</p>
        </div>
        <div className="student-identity">
          <span className="identity-dot">
            <CheckCircle2 size={22} />
          </span>
          <span>{draft.date}</span>
        </div>
      </section>

      <section className="metric-grid" aria-label="Dashboard summary">
        <MetricCard tone="green" icon={<ListChecks />} label="Tasks" value={String(draft.tasks.length)} />
        <MetricCard tone="blue" icon={<Link2 />} label="Resources" value={String(draft.resources.length)} />
        <MetricCard tone="amber" icon={<BookOpen />} label="Questions" value={String(draft.questions.length)} />
        <MetricCard tone="rose" icon={<CheckCircle2 />} label="Complete" value={`${completion}%`} />
      </section>

      <Panel title="Tasks due soon" icon={<Clock3 />}>
        <div className="task-list">
          {dueSoon.map((task) => (
            <div className="task-row" key={`due-${task.id}`}>
              <span className="task-check">{task.status === "complete" ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}</span>
              <span>
                <strong>{task.title}</strong>
                <small>{task.dueDateText ? `Due ${task.dueDateText}` : "No due date listed"}</small>
              </span>
              <StatusPill status={task.status} />
            </div>
          ))}
        </div>
      </Panel>

      <section className="today-card">
        <div>
          <span className="eyebrow">Latest meeting</span>
          <h2>Recap</h2>
          <p>{draft.recap}</p>
          <div className="tag-row">
            <span>{draft.date}</span>
            <span>{draft.resources.length} links</span>
            <span>{draft.questions.length} questions</span>
          </div>
        </div>
        <div className="today-actions">
          <button className="ghost-button" type="button" onClick={newPaste}>
            <Plus size={17} />
            New paste
          </button>
          <button className="ghost-button" type="button" onClick={copyRecap}>
            <ClipboardCopy size={17} />
            Copy recap
          </button>
          <button className="primary-button" type="button" onClick={markAllComplete}>
            <CheckCircle2 size={17} />
            Mark all complete
          </button>
        </div>
      </section>

      <section className="content-grid two-columns align-start">
        <Panel title="Your tasks" icon={<ListChecks />}>
          <div className="editable-task-list">
            {draft.tasks.map((task) => (
              <article className="editable-task" key={task.id}>
                <label className="field">
                  <span>Task</span>
                  <input value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    onChange={(event) => updateTask(task.id, { status: event.target.value as TaskStatus })}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Due date</span>
                  <input
                    aria-label={`Due date for ${task.title}`}
                    value={task.dueDateText}
                    onChange={(event) => updateTask(task.id, { dueDateText: event.target.value })}
                    placeholder="Friday, 5 PM"
                  />
                </label>
                <button className="icon-button danger" type="button" onClick={() => removeTask(task.id)} aria-label={`Remove ${task.title}`}>
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
            <button className="ghost-button add-task-button" type="button" onClick={addTask}>
              <Plus size={17} />
              Add task
            </button>
          </div>
        </Panel>

        <div className="content-grid">
          <Panel title="Since this paste" icon={<Sparkles />}>
            <div className="student-change-list">
              {draft.insights.map((insight) => (
                <div className="student-change-row" key={insight.id}>
                  <CheckCircle2 size={17} />
                  <span>
                    <strong>{insight.label}</strong>
                    <small>{insight.detail}</small>
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Resources" icon={<Link2 />}>
            <div className="resource-list">
              {draft.resources.length ? (
                draft.resources.map((resource) => (
                  <a className="resource-row" href={resource.url} target="_blank" rel="noreferrer" key={resource.id}>
                    <span>
                      <Link2 size={17} />
                    </span>
                    <strong>{resource.title}</strong>
                    <small>{resource.url}</small>
                  </a>
                ))
              ) : (
                <p className="readable">No links were found in this paste.</p>
              )}
            </div>
          </Panel>

          <Panel title="Questions" icon={<BookOpen />}>
            <div className="question-list">
              {draft.questions.length ? (
                draft.questions.map((question) => (
                  <div className="question-row" key={question.id}>
                    {question.text}
                  </div>
                ))
              ) : (
                <p className="readable">No open questions were found.</p>
              )}
            </div>
          </Panel>
        </div>
      </section>

      <div className="dashboard-footer-actions">
        <button className="ghost-button" type="button" onClick={exportDraft}>
          <Download size={17} />
          Export JSON
        </button>
      </div>
    </div>
  );
}

function MetricCard({ tone, icon, label, value }: { tone: "green" | "blue" | "amber" | "rose"; icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <span className="panel-icon">{icon}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={`status-pill ${status}`}>{statusLabels[status]}</span>;
}

function HistoryPage({
  drafts,
  activeDraftId,
  openDraft,
  newPaste,
}: {
  drafts: RelayDraft[];
  activeDraftId: string | null;
  openDraft: (draftId: string) => void;
  newPaste: () => void;
}) {
  return (
    <div className="page-stack">
      <section className="review-banner">
        <div>
          <span className="eyebrow">History</span>
          <h1>Saved Relay dashboards</h1>
          <p>Recent personal meeting dashboards stay local in this browser.</p>
        </div>
        <button className="primary-button" type="button" onClick={newPaste}>
          <Plus size={17} />
          New paste
        </button>
      </section>
      <Panel title="Recent meetings" icon={<History />}>
        <div className="session-list">
          {drafts.length ? (
            drafts.map((draft) => (
              <button
                className={draft.id === activeDraftId ? "session-row active" : "session-row"}
                type="button"
                key={draft.id}
                onClick={() => openDraft(draft.id)}
              >
                <span className="session-icon">
                  <FileText size={17} />
                </span>
                <span>
                  <strong>{draft.title}</strong>
                  <small>
                    {draft.date} · {draft.tasks.length} tasks · {draft.resources.length} links
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))
          ) : (
            <p className="readable">No dashboards yet.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function TemplatePage({ copyTemplate }: { copyTemplate: () => void }) {
  return (
    <div className="page-stack">
      <section className="review-banner">
        <div>
          <span className="eyebrow">Template</span>
          <h1>Google Docs meeting template</h1>
          <p>Relay is tuned around this structure, but the paste box also accepts messy notes.</p>
        </div>
        <a className="primary-button" href={TEMPLATE_COPY_URL} target="_blank" rel="noreferrer">
          Open copy link
          <ArrowRight size={17} />
        </a>
      </section>
      <section className="template-detail-grid">
        <TemplateCard />
        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-icon">
                <FileText size={18} />
              </span>
              <h2>Template preview</h2>
            </div>
            <button className="ghost-button" type="button" onClick={copyTemplate}>
              <ClipboardCopy size={17} />
              Copy text
            </button>
          </div>
          <pre className="template-preview">{relayTemplateText}</pre>
        </section>
      </section>
    </div>
  );
}

export default App;
