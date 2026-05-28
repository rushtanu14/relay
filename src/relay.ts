import type { RelayDraft, RelayInsight, RelayQuestion, RelayResource, RelayTask } from "./types";

const SECTION_LABELS = [
  "Meeting title",
  "Title",
  "Date",
  "Context",
  "Resources",
  "Links",
  "Questions",
  "Open questions",
  "Due dates",
  "Due date",
  "Meeting minutes",
  "Minutes",
  "Notes",
  "Action items",
  "Actions",
  "Tasks",
];

export const relayTemplateText = `Meeting title:
Date:

Context:

Resources:

Questions:

Due dates:

Meeting minutes:
`;

export const sampleMeetingNotes = `Meeting title: Hackathon demo planning
Date: 2026-05-27

Context:
Solo planning meeting to make the Relay demo tighter before submission. The main goal was to keep the workflow focused on pasted personal meeting notes and a clear dashboard.

Resources:
Pitch outline: https://docs.google.com/document/d/sample-relay-pitch
Demo checklist: https://example.com/relay-demo-checklist

Questions:
What should be shown in the first 30 seconds?
Do I need a backup screen recording?

Due dates:
Finish the 90-second demo script by Friday
Submit the project before Sunday night

Meeting minutes:
We decided the app should stay focused on personal meeting minutes and a smaller demo scope.
I need to finish the 90-second demo script by Friday.
Prepare screenshots for the submission page before Sunday night.
Send the final project summary to the judges after the demo is recorded.
Question: What should be shown in the first 30 seconds?`;

function cleanLine(line: string) {
  return line
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function shortText(text: string, max = 120) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}...`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sectionPattern() {
  return SECTION_LABELS.map(escapeRegExp).join("|");
}

function extractSection(text: string, labels: string[]) {
  const labelPattern = labels.map(escapeRegExp).join("|");
  const match = text.match(
    new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${sectionPattern()})\\s*:?|$)`, "i"),
  );
  return match?.[1]?.trim() ?? "";
}

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

function createId(prefix: string, seed: string, index: number) {
  return `${prefix}-${slugify(seed, String(index + 1))}-${index + 1}`;
}

function titleFrom(text: string) {
  const section = extractSection(text, ["Meeting title", "Title"]).split(/\n+/)[0]?.trim();
  if (section) return shortText(section, 72);
  const firstLine = text
    .split(/\n+/)
    .map(cleanLine)
    .find((line) => line && !SECTION_LABELS.some((label) => line.toLowerCase().startsWith(label.toLowerCase())));
  return shortText(firstLine || "Personal meeting", 72);
}

function dateFrom(text: string) {
  const section = extractSection(text, ["Date"]).split(/\n+/)[0]?.trim();
  if (section) return section;
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (iso) return iso;
  const slashDate = text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/)?.[0];
  return slashDate || new Date().toISOString().slice(0, 10);
}

function contextFrom(text: string) {
  const section = extractSection(text, ["Context"]);
  if (section) return section;
  return text
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line.length > 24)
    .slice(0, 2)
    .join(" ");
}

function resourceType(url: string): RelayResource["type"] {
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(url)) return "video";
  if (/docs\.google\.com\/presentation|slides/i.test(url)) return "slides";
  if (/docs\.google\.com|notion\.site|\.pdf(?:$|[?#])/i.test(url)) return "doc";
  return "link";
}

function parseResources(text: string): RelayResource[] {
  const resourceSection = extractSection(text, ["Resources", "Links"]);
  const urls = unique(`${resourceSection}\n${text}`.match(/https?:\/\/[^\s)]+/gi) ?? []);
  return urls.map((url, index) => ({
    id: createId("resource", url, index),
    title: resourceType(url) === "video" ? "Video" : resourceType(url) === "slides" ? "Slides" : resourceType(url) === "doc" ? "Document" : "Link",
    url,
    type: resourceType(url),
  }));
}

function parseQuestions(text: string): RelayQuestion[] {
  const source = `${extractSection(text, ["Questions", "Open questions"])}\n${extractSection(text, ["Meeting minutes", "Minutes", "Notes"])}\n${text}`;
  return unique(
    source
      .split(/\n+/)
      .map(cleanLine)
      .filter((line) => line.includes("?") || /^(question|q)\b/i.test(line))
      .map((line) => line.replace(/^(question|q)\s*[:.-]\s*/i, "").trim()),
  )
    .slice(0, 8)
    .map((question, index) => ({
      id: createId("question", question, index),
      text: question,
    }));
}

export function dueDateTextFromLine(line: string) {
  return (
    line.match(/\b(?:due|by|before|on)\s+([^.;,\n]+)/i)?.[1]?.trim() ??
    line.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/i)?.[1]?.trim() ??
    ""
  );
}

function taskTitleFromLine(line: string) {
  return shortText(
    line
      .replace(/^[-*]\s*/, "")
      .replace(/^(todo|to do|action item|my task)\s*[:.-]\s*/i, "")
      .replace(/^i need to\s+/i, "")
      .replace(/^i will\s+/i, "")
      .replace(/\b(?:due|by|before|on)\s+([^.;,\n]+)/i, "")
      .replace(/\s+[.]\s*$/g, "")
      .trim(),
  );
}

function parseTasks(text: string): RelayTask[] {
  const dueLines = extractSection(text, ["Due dates", "Due date"])
    .split(/\n+/)
    .map(cleanLine)
    .filter(Boolean);
  const actionSection = extractSection(text, ["Action items", "Actions", "Tasks"])
    .split(/\n+/)
    .map(cleanLine)
    .filter(Boolean);
  const minutes = extractSection(text, ["Meeting minutes", "Minutes", "Notes"]) || text;
  const minuteActions = minutes
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) =>
      /\b(i need to|i will|my task|todo|to do|action item|follow up|complete|finish|submit|send|review|prepare|draft|schedule|email|ask|record)\b/i.test(line),
    );
  const sourceLines = unique([...minuteActions, ...actionSection, ...dueLines]).slice(0, 10);

  if (!sourceLines.length) {
    return [
      {
        id: "task-review-recap-1",
        title: "Review the meeting recap",
        status: "todo",
        dueDateText: dueLines[0] ?? "",
        source: "Fallback personal follow-up",
      },
    ];
  }

  return sourceLines.map((line, index) => ({
    id: createId("task", line, index),
    title: taskTitleFromLine(line),
    status: "todo",
    dueDateText: dueDateTextFromLine(line),
    source: line,
  }));
}

function recapFrom(text: string, title: string, context: string) {
  const minutes = extractSection(text, ["Meeting minutes", "Minutes", "Notes"]) || text;
  const lines = minutes
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line.length > 24 && !/^https?:/i.test(line))
    .filter((line) => !SECTION_LABELS.some((label) => line.toLowerCase().startsWith(label.toLowerCase())))
    .slice(0, 3);
  const opener = `${title} focused on ${context || "the pasted meeting notes"}.`;
  return lines.length ? [opener, ...lines].join(" ") : `${opener} Review the tasks, resources, questions, and due dates before closing the loop.`;
}

function insightsFrom(tasks: RelayTask[], questions: RelayQuestion[], resources: RelayResource[]): RelayInsight[] {
  const insights: RelayInsight[] = [
    {
      id: "insight-task-load",
      label: "Task load",
      detail: tasks.length ? `${tasks.length} personal follow-up items were detected from the notes.` : "No concrete follow-up tasks were detected yet.",
    },
    {
      id: "insight-open-questions",
      label: "Open questions",
      detail: questions.length ? `${questions.length} questions still need an answer before the loop is closed.` : "No open questions were found in the pasted notes.",
    },
    {
      id: "insight-resources",
      label: "Resources",
      detail: resources.length ? `${resources.length} links or reference materials were pulled into the dashboard.` : "No links were found. Add URLs to make the dashboard more useful.",
    },
  ];
  return insights;
}

export function createRelayDraft(sourceText: string): RelayDraft {
  const normalized = sourceText.trim();
  const title = titleFrom(normalized);
  const date = dateFrom(normalized);
  const context = contextFrom(normalized);
  const resources = parseResources(normalized);
  const questions = parseQuestions(normalized);
  const tasks = parseTasks(normalized);
  const now = new Date().toISOString();

  return {
    id: `relay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    date,
    context,
    sourceText: normalized,
    recap: recapFrom(normalized, title, context),
    resources,
    questions,
    tasks,
    insights: insightsFrom(tasks, questions, resources),
    createdAt: now,
    updatedAt: now,
  };
}
