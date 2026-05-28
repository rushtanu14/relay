import assert from "node:assert/strict";
import { createRelayDraft, dueDateTextFromLine, relayTemplateText, sampleMeetingNotes } from "../src/relay.js";

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("parses one pasted meeting block into a personal dashboard", () => {
  const draft = createRelayDraft(sampleMeetingNotes);

  assert.equal(draft.title, "Hackathon demo planning");
  assert.equal(draft.date, "2026-05-27");
  assert.match(draft.context, /Solo planning meeting/);
  assert.equal(draft.resources.length, 2);
  assert.equal(draft.questions.length, 2);
  assert.ok(draft.tasks.some((task) => task.title.includes("90-second demo script")));
  assert.ok(draft.tasks.some((task) => task.dueDateText.toLowerCase().includes("friday")));
  assert.match(draft.recap, /personal meeting minutes/);
});

test("uses due date lines as tasks when the notes are light", () => {
  const draft = createRelayDraft(`Meeting title: Portfolio review
Date: 2026-05-27
Context: Personal check-in about portfolio work.
Due dates:
Portfolio polish by tomorrow
Send reflection before Friday
Meeting minutes:
We clarified the priority list.`);

  assert.equal(draft.tasks.length, 2);
  assert.deepEqual(
    {
      title: draft.tasks[0].title,
      status: draft.tasks[0].status,
      dueDateText: draft.tasks[0].dueDateText,
    },
    {
      title: "Portfolio polish",
      status: "todo",
      dueDateText: "tomorrow",
    },
  );
});

test("keeps the Google Docs template focused on Relay's paste schema", () => {
  assert.match(relayTemplateText, /Meeting title:/);
  assert.match(relayTemplateText, /Date:/);
  assert.match(relayTemplateText, /Context:/);
  assert.match(relayTemplateText, /Resources:/);
  assert.match(relayTemplateText, /Questions:/);
  assert.match(relayTemplateText, /Due dates:/);
  assert.match(relayTemplateText, /Meeting minutes:/);
});

test("extracts due date text from natural action lines", () => {
  assert.equal(dueDateTextFromLine("Send the recap by Friday at 5 PM"), "Friday at 5 PM");
  assert.equal(dueDateTextFromLine("Review the notes tomorrow"), "tomorrow");
});
