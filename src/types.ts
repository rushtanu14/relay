export type TaskStatus = "todo" | "in_progress" | "complete";

export type RelayResource = {
  id: string;
  title: string;
  url: string;
  type: "link" | "doc" | "slides" | "video";
};

export type RelayQuestion = {
  id: string;
  text: string;
};

export type RelayTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDateText: string;
  source: string;
};

export type RelayInsight = {
  id: string;
  label: string;
  detail: string;
};

export type RelayDraft = {
  id: string;
  title: string;
  date: string;
  context: string;
  sourceText: string;
  recap: string;
  resources: RelayResource[];
  questions: RelayQuestion[];
  tasks: RelayTask[];
  insights: RelayInsight[];
  createdAt: string;
  updatedAt: string;
};
