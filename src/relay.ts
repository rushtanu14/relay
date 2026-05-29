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
  "Next steps",
  "Follow-up items",
  "Follow up items",
  "Follow-ups",
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

function normalizePaste(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[：﹕]/g, ":")
    .trim();
}

function cleanLine(line: string) {
  return line
    .replace(/^[\s>]*(?:[-*•●◦‣▪▫–—]|\d+[.)]|[a-z][.)]|☐|☑|✅)\s*/i, "")
    .replace(/^\[[ xX]\]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlaceholderLine(line: string) {
  return /^(none|n\/a|na|no questions|no resources|no due dates|no action items|nothing yet|\(?please review meeting minutes\)?)$/i.test(line.trim());
}

function isMeetingMetadataLine(line: string) {
  return /^(minutes?\s+recorder|recorder|scribe|notetaker|note\s+taker|prepared by|submitted by|present|absent|attendees?|members?\s+present|members?\s+absent|guests?)\s*:/i.test(cleanLine(line));
}

function isDocumentArtifactLine(line: string) {
  const raw = line.trim();
  const cleaned = cleanLine(line);
  return (
    /^[_=\-—–]{3,}/.test(raw) ||
    /^[_=\-—–]{3,}/.test(cleaned) ||
    /^\([^)]{1,80}\)$/.test(cleaned) ||
    (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*[-–—]\s+/.test(cleaned) &&
      !/\b(i need to|i will|todo|to do|action item|follow up|complete|finish|submit|send|review|prepare|draft|schedule|email|ask|record|share|update|write|make|create|upload|approve|adopt|authorize)\b/i.test(cleaned))
  );
}

function isPastedDocumentNoiseLine(line: string) {
  return isPlaceholderLine(line) || isMeetingMetadataLine(line) || isDocumentArtifactLine(line);
}

function isSectionLabelLine(line: string) {
  const label = cleanLine(line).replace(/:$/, "").trim().toLowerCase();
  return SECTION_LABELS.some((sectionLabel) => sectionLabel.toLowerCase() === label);
}

function isGenericHeading(line: string) {
  return /^(agenda|notice of meeting|meeting agenda|meeting minutes|minutes)$/i.test(cleanLine(line));
}

function monthDatePattern() {
  return /\b(?:monday,\s*|tuesday,\s*|wednesday,\s*|thursday,\s*|friday,\s*|saturday,\s*|sunday,\s*)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},\s+\d{4}\b/i;
}

function isDateLikeLine(line: string) {
  const cleaned = cleanLine(line);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ||
    /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(cleaned) ||
    monthDatePattern().test(cleaned)
  );
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
    new RegExp(
      `(?:^|\\n)\\s*(?:${labelPattern})\\s*(?::\\s*([^\\n]*))?\\s*(?:\\n|$)([\\s\\S]*?)(?=\\n\\s*(?:${sectionPattern()})\\s*(?::\\s*[^\\n]*)?\\s*(?:\\n|$)|$)`,
      "i",
    ),
  );
  return [match?.[1] ?? "", match?.[2] ?? ""].join("\n").trim();
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

function taskKey(title: string, dueDateText: string) {
  return `${title
    .toLowerCase()
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()}|${dueDateText.toLowerCase().trim()}`;
}

function titleFrom(text: string) {
  const section = extractSection(text, ["Meeting title", "Title"]).split(/\n+/)[0]?.trim();
  if (section) return shortText(section, 72);
  const lines = text
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line && !isPastedDocumentNoiseLine(line) && !SECTION_LABELS.some((label) => line.toLowerCase().startsWith(label.toLowerCase())));
  const governingBodyLine = lines.find(
    (line) =>
      !isGenericHeading(line) &&
      !isDateLikeLine(line) &&
      /\b(board|council|committee|commission)\b/i.test(line),
  );
  const publicMeetingLine = lines.find(
    (line) =>
      !isGenericHeading(line) &&
      !isDateLikeLine(line) &&
      /\b(meeting|session|regents)\b/i.test(line),
  );
  const firstSpecificLine = lines.find((line) => !isGenericHeading(line) && !isDateLikeLine(line));
  return shortText(governingBodyLine || publicMeetingLine || firstSpecificLine || lines.find(Boolean) || "Personal meeting", 72);
}

function dateFrom(text: string) {
  const section = extractSection(text, ["Date"]).split(/\n+/)[0]?.trim();
  if (section) return section;
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (iso) return iso;
  const slashDate = text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/)?.[0];
  if (slashDate) return slashDate;
  const monthDate = text.match(monthDatePattern())?.[0].replace(/^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),\s*/i, "");
  return monthDate || new Date().toISOString().slice(0, 10);
}

function contextFrom(text: string) {
  const section = extractSection(text, ["Context"]);
  if (section) return section;
  const inferredTitle = titleFrom(text).toLowerCase();
  return text
    .split(/\n+/)
    .map(cleanLine)
    .filter(
      (line) =>
        line.length > 24 &&
        !isPastedDocumentNoiseLine(line) &&
        line.toLowerCase() !== inferredTitle &&
        !isAgendaNoiseLine(line) &&
        !isGenericHeading(line) &&
        !isDateLikeLine(line) &&
        !isQuestionCandidate(line) &&
        !/^(date|time|location|locations|committee membership)\b/i.test(line) &&
        !SECTION_LABELS.some((label) => line.toLowerCase() === label.toLowerCase()),
    )
    .slice(0, 2)
    .join(" ");
}

function resourceType(url: string): RelayResource["type"] {
  if (/docs\.google\.com\/spreadsheets/i.test(url)) return "link";
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(url)) return "video";
  if (/docs\.google\.com\/presentation|slides/i.test(url)) return "slides";
  if (/docs\.google\.com|notion\.site|\.pdf(?:$|[?#])/i.test(url)) return "doc";
  return "link";
}

function cleanUrl(url: string) {
  return url.replace(/[),.;:!?]+$/g, "");
}

function removeUrls(line: string) {
  return line.replace(/https?:\/\/[^\s)]+/gi, "").trim();
}

function hasTextOutsideUrls(line: string) {
  return /[a-z0-9]/i.test(removeUrls(line));
}

function questionTextOutsideUrls(line: string) {
  return removeUrls(line).replace(/^(question|q)\s*[:.-]\s*/i, "").trim();
}

function isQuestionCandidate(line: string) {
  const withoutUrls = removeUrls(line);
  const questionText = questionTextOutsideUrls(line);
  return (questionText.includes("?") || /^(question|q)\b/i.test(withoutUrls)) && /[a-z0-9]/i.test(questionText);
}

function defaultResourceTitle(url: string) {
  const type = resourceType(url);
  if (type === "video") return "Video";
  if (type === "slides") return "Slides";
  if (type === "doc") return "Document";
  return "Link";
}

function parseResources(text: string): RelayResource[] {
  const resourceSection = extractSection(text, ["Resources", "Links"]);
  const resourceLines = resourceSection
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line && !isPlaceholderLine(line));
  const urls = unique((`${resourceSection}\n${text}`.match(/https?:\/\/[^\s)]+/gi) ?? []).map(cleanUrl));
  return urls.map((url, index) => ({
    id: createId("resource", url, index),
    title: shortText(
      resourceLines
        .find((line) => line.includes(url) || line.includes(`${url}.`))
        ?.replace(url, "")
        .replace(cleanUrl(url), "")
        .replace(/^\s*(resource|link)\s*[:.-]\s*/i, "")
        .replace(/[.,;:!?]+$/g, "")
        .replace(/\s*[:–—-]\s*$/g, "")
        .trim() || defaultResourceTitle(url),
      72,
    ),
    url,
    type: resourceType(url),
  }));
}

function parseQuestions(text: string): RelayQuestion[] {
  const questionSection = extractSection(text, ["Questions", "Open questions"])
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line && !isPastedDocumentNoiseLine(line) && hasTextOutsideUrls(line) && /[a-z0-9]/i.test(questionTextOutsideUrls(line)))
    .map((line) => line.replace(/^(question|q)\s*[:.-]\s*/i, "").trim());
  const source = `${extractSection(text, ["Meeting minutes", "Minutes", "Notes"])}\n${text}`;
  return unique(
    [
      ...questionSection,
      ...source
        .split(/\n+/)
        .map(cleanLine)
        .filter((line) => !isPastedDocumentNoiseLine(line) && isQuestionCandidate(line))
        .map((line) => line.replace(/^(question|q)\s*[:.-]\s*/i, "").trim()),
    ],
  )
    .slice(0, 8)
    .map((question, index) => ({
      id: createId("question", question, index),
      text: question,
    }));
}

export function dueDateTextFromLine(line: string) {
  const cleaned = cleanLine(line);
  return (
    cleaned.match(/\b(?:due|by|before)\s+([^.;:,\n]+)/i)?.[1]?.trim() ??
    cleaned.match(/\bon\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})\b/i)?.[1]?.trim() ??
    cleaned.match(/^(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/i)?.[1]?.trim() ??
    cleaned.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b/i)?.[1]?.trim() ??
    ""
  );
}

function taskTitleFromLine(line: string) {
  return shortText(
    line
      .replace(/^[\s>]*(?:[-*•●◦‣▪▫–—]|\d+[.)]|[a-z][.)]|☐|☑|✅)\s*/i, "")
      .replace(/^(todo|to do|action item|my task)\s*[:.-]\s*/i, "")
      .replace(/^(action|consent item|staff recommendation|recommendation)\s*[:.-]\s*/i, "")
      .replace(/^motion was made to\s+/i, "")
      .replace(/^staff recommends that\s+/i, "")
      .replace(/^(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\s*[:–—-]\s*/i, "")
      .replace(/^i need to\s+/i, "")
      .replace(/^i will\s+/i, "")
      .replace(/\b(?:due|by|before)\s+([^.;:,\n]+)/i, "")
      .replace(/\bon\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})\b/i, "")
      .replace(/\s*[-–—]\s*(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\s*$/i, "")
      .replace(/\s+\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)\b\.?$/i, "")
      .replace(/[.;:,]\s*$/g, "")
      .trim(),
  );
}

function isAgendaNoiseLine(line: string) {
  const cleaned = cleanLine(line).replace(/:$/, "").trim();
  return (
    !cleaned ||
    isGenericHeading(cleaned) ||
    isDateLikeLine(cleaned) ||
    /^(date|time|location|locations|committee membership|agenda posted|website|sunshine list|to review agenda materials)\b/i.test(cleaned) ||
    /\bcalled the meeting to order\b/i.test(cleaned) ||
    /\b(city hall|council chambers|city council chambers)\b/i.test(cleaned) ||
    /^opening of meeting\b/i.test(cleaned) ||
    /^the regents of the university of california$/i.test(cleaned) ||
    /^(?:\d+\s*&\s*\d+\s*p\.m\.\s*)?meeting of\b/i.test(cleaned) ||
    (/^[A-Z0-9\s/&-]+$/.test(cleaned) && !/\d/.test(cleaned) && cleaned.length > 16) ||
    /^(welcome and call to order|call to order|opening of meeting|invocation|pledge of allegiance|certification of quorum|roll call|public comments?|public forum|dinner recess|remarks|future agenda considerations|closed sessions?|adjourn(?:ment)?|reports?|information items?)$/i.test(cleaned) ||
    /^(action|consent agenda|agenda open session|agenda - open session|life updates|review previous action items)$/i.test(cleaned)
  );
}

function parseTasks(text: string): RelayTask[] {
  const dueLines = extractSection(text, ["Due dates", "Due date"])
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line && !isPlaceholderLine(line));
  const actionSection = extractSection(text, ["Action items", "Actions", "Tasks", "Next steps", "Follow-up items", "Follow up items", "Follow-ups"])
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line && !isPlaceholderLine(line));
  const minutes = extractSection(text, ["Meeting minutes", "Minutes", "Notes"]) || text;
  const minuteActions = minutes
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) =>
      /\b(i need to|i will|my task|todo|to do|action item|follow up|complete|finish|submit|send|review|prepare|draft|schedule|email|ask|record|share|update|write|make|create|upload|action|motion|direct staff|provide direction|approve|approval|adopt|adoption|authorize|consider|proposed|resolution|budget|deliberation|request(?:ed|ing)?|consent item)\b/i.test(line),
    );
  const sourceLines = unique([...minuteActions, ...actionSection, ...dueLines])
    .filter((line) => !isSectionLabelLine(line) && !isPastedDocumentNoiseLine(line) && !isAgendaNoiseLine(line))
    .slice(0, 10);

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

  const tasks: RelayTask[] = [];
  const seenTasks = new Set<string>();
  sourceLines.forEach((line) => {
    const title = taskTitleFromLine(line);
    const dueDateText = dueDateTextFromLine(line);
    if (!title || isSectionLabelLine(title)) return;
    const key = taskKey(title, dueDateText);
    if (seenTasks.has(key)) return;
    seenTasks.add(key);
    tasks.push({
      id: createId("task", line, tasks.length),
      title,
      status: "todo",
      dueDateText,
      source: line,
    });
  });

  return tasks.length
    ? tasks
    : [
        {
          id: "task-review-recap-1",
          title: "Review the meeting recap",
          status: "todo",
          dueDateText: dueLines[0] ?? "",
          source: "Fallback personal follow-up",
        },
      ];
}

function recapFrom(text: string, title: string, context: string) {
  const minutes = extractSection(text, ["Meeting minutes", "Minutes", "Notes"]) || text;
  const lines = minutes
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line.length > 24 && !/^https?:/i.test(line))
    .filter(
      (line) =>
        !isPastedDocumentNoiseLine(line) &&
        line.toLowerCase() !== title.toLowerCase() &&
        !isAgendaNoiseLine(line) &&
        !isGenericHeading(line) &&
        !isDateLikeLine(line) &&
        !isQuestionCandidate(line) &&
        !/^(date|time|location|locations|committee membership)\b/i.test(line) &&
        !SECTION_LABELS.some((label) => line.toLowerCase().startsWith(label.toLowerCase())),
    )
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
  const normalized = normalizePaste(sourceText);
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
