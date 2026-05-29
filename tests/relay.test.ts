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

test("handles a completed Google Docs template paste with follow-up details", () => {
  const draft = createRelayDraft(`Meeting title:
Robotics kickoff
Date:
May 29

Context:
We planned outreach, sponsorship follow-up, and the next build session.

Resources:
• Outreach plan: https://docs.google.com/document/d/robotics-plan/edit.
• Budget sheet - https://docs.google.com/spreadsheets/d/budget/edit

Questions:
• Who is ordering parts
• Should we meet again next week?

Due dates:
• Friday: send sponsor email
• Next week - review budget

Meeting minutes:
• I need to ask Maya about the room by tomorrow.
• Follow up with Alex on the logo draft before Monday.
• We agreed that the sponsor email should be the first follow-up.`);

  assert.equal(draft.title, "Robotics kickoff");
  assert.equal(draft.date, "May 29");
  assert.match(draft.context, /outreach/);
  assert.equal(draft.resources.length, 2);
  assert.equal(draft.resources[0].title, "Outreach plan");
  assert.equal(draft.resources[0].url, "https://docs.google.com/document/d/robotics-plan/edit");
  assert.ok(draft.questions.some((question) => question.text === "Who is ordering parts"));
  assert.ok(draft.questions.some((question) => question.text === "Should we meet again next week?"));
  assert.ok(draft.tasks.some((task) => task.title === "send sponsor email" && task.dueDateText.toLowerCase() === "friday"));
  assert.ok(draft.tasks.some((task) => task.title === "review budget" && task.dueDateText.toLowerCase() === "next week"));
  assert.ok(draft.tasks.some((task) => task.title === "ask Maya about the room" && task.dueDateText.toLowerCase() === "tomorrow"));
  assert.ok(draft.tasks.some((task) => task.title === "Follow up with Alex on the logo draft" && task.dueDateText.toLowerCase() === "monday"));
});

test("does not turn template labels or repeated due-date actions into noisy tasks", () => {
  const draft = createRelayDraft(`Meeting title: Icon QA
Date: Today

Context:
Checking summary-card icon rendering.

Resources:
Reference doc: https://docs.google.com/document/d/icon-qa/edit
Checklist: https://example.com/checklist

Questions:
Should icons stay compact?
Are stat chips centered?

Due dates:
Review screenshot today

Meeting minutes:
I need to review the screenshot today.`);

  assert.equal(draft.tasks.length, 1);
  assert.equal(draft.tasks[0].title, "review the screenshot");
  assert.equal(draft.tasks[0].dueDateText, "today");
  assert.ok(draft.tasks.every((task) => !/meeting minutes/i.test(task.title)));
});

test("does not treat URL query strings as questions", () => {
  const draft = createRelayDraft(`Meeting title: Link cleanup
Date: Today

Context:
Checking links with tracking query strings.

Resources:
Spec doc: https://example.com/spec?tab=overview&ref=relay
Search page: https://example.com/search?q=relay

Questions:
https://example.com/help?topic=setup
Question: https://example.com/form?entry=followup
Should we use https://example.com/search?q=relay for references?

Meeting minutes:
Shared the spec link https://example.com/spec?tab=overview&ref=relay.
Question: https://example.com/form?entry=followup
Do we need to clean tracking params before export?`);

  assert.deepEqual(
    draft.questions.map((question) => question.text),
    [
      "Should we use https://example.com/search?q=relay for references?",
      "Do we need to clean tracking params before export?",
    ],
  );
});

test("filters meeting metadata and pasted document comments from class-officer minutes", () => {
  const draft = createRelayDraft(`5/27 '29 Officer Meeting #4 🌤️
Minutes Recorder: Elizabeth
Absent: (please review meeting minutes)
Absent: (please review meeting minutes)
________________________________ Rushil - wow a needoh
(corny ah)

Life updates 🥳‼️
Review Previous Action Items
Homecoming:
We need to update the Homecoming slides and confirm the workstream owners.
Question: Who is taking Backdrop?
Action Items:
Hype up hoco!
Go over agenda
Check in and help on tasks below`);

  assert.equal(draft.title, "5/27 '29 Officer Meeting #4 🌤️");
  assert.equal(draft.date, "5/27");
  assert.deepEqual(
    draft.questions.map((question) => question.text),
    ["Who is taking Backdrop?"],
  );
  assert.ok(!/Minutes Recorder|Absent|please review|wow a needoh|corny ah/i.test(draft.context));
  assert.ok(!/Minutes Recorder|Absent|please review|wow a needoh|corny ah/i.test(draft.recap));
});

test("handles public city agenda text without generic headings or today's fallback date", () => {
  const draft = createRelayDraft(`AGENDA
BREVARD CITY COUNCIL - REGULAR MEETING
Monday, May 18, 2026 - 5:30 PM
City Council Chambers
A. Welcome and Call to Order
E. Approval of Agenda
F. Approval of Minutes
J. Public Hearing(s)
1. Proposed FY 2026-2027 Budget and Ordinance
2. Proposed Amendments to the City of Brevard Unified Development Ordinance
M. New Business
1. Proposed Amendment to City of Brevard Fee Schedule re Pool Fees
3. Resolution Requesting Increased Funding from Transylvania County to Support Enhanced Staffing for Brevard Fire Department
P. Adjourn`);

  assert.equal(draft.title, "BREVARD CITY COUNCIL - REGULAR MEETING");
  assert.equal(draft.date, "May 18, 2026");
  assert.ok(draft.tasks.some((task) => task.title === "Approval of Agenda"));
  assert.ok(draft.tasks.some((task) => task.title === "Proposed FY 2026-2027 Budget and Ordinance"));
  assert.ok(draft.tasks.every((task) => !/^(agenda|adjourn|call to order)$/i.test(task.title)));
});

test("handles public school-board agenda action labels without promoting section headings", () => {
  const draft = createRelayDraft(`Thursday, February 26, 2026
4 & 7 p.m. Meeting of the Board of Education of Howard County, Adoption of FY27 Operating Budget and FY27 Capital Budget & FY27-32 Capital Improvement Program Deliberation and Adoption
1. OPENING OF MEETING - 4 p.m.
A. Approval of Agenda
5. CONSENT AGENDA
A. Donations - ACTION
B. Bids and Contracts - ACTION
C. 02 02 26 Meeting Minutes - ACTION
13. OPERATING BUDGET ADOPTION
A. FY27 Operating Budget
14. CAPITAL BUDGET DELIBERATIONS/ADOPTION
A. FY27 Capital Budgets & FY27-32 Capital Improvement Program Deliberation
B. FY27 Capital Budgets & FY27-32 Capital Improvement Program Adoption`);

  assert.equal(draft.date, "February 26, 2026");
  assert.ok(draft.title.includes("Board of Education of Howard County"));
  assert.ok(draft.tasks.some((task) => task.title === "Bids and Contracts - ACTION"));
  assert.ok(draft.tasks.some((task) => task.title === "FY27 Operating Budget"));
  assert.ok(draft.tasks.every((task) => !/opening of meeting|consent agenda|capital budget deliberations\/adoption/i.test(task.title)));
});

test("handles public minutes and committee notice formats", () => {
  const minutesDraft = createRelayDraft(`TRACY CITY COUNCIL - SPECIAL MEETING MINUTES
August 26, 2025, 6:00 p.m.
Tracy City Hall, 333 Civic Center Plaza, Tracy, CA
Items from the Audience: a resident requested that someone investigate the railroad crossing lights on Linne Road.
Action: Motion was made to direct staff to enter into negotiations regarding a community workforce training agreement, update related ordinances, analyze concerns raised, and provide an update within 90 days.
Action: Motion was made to adopt a resolution declaring intent to transition to by-district council member elections beginning with the November 2026 General Election.
Adjournment.`);

  assert.equal(minutesDraft.title, "TRACY CITY COUNCIL - SPECIAL MEETING MINUTES");
  assert.equal(minutesDraft.date, "August 26, 2025");
  assert.ok(minutesDraft.tasks.some((task) => task.title.startsWith("direct staff to enter into negotiations")));
  assert.ok(minutesDraft.tasks.some((task) => task.title.startsWith("adopt a resolution")));

  const committeeDraft = createRelayDraft(`NOTICE OF MEETING
The Regents of the University of California
FINANCE AND CAPITAL STRATEGIES COMMITTEE
Date: May 6, 2026
Time: 1:40 p.m.
Location: Luskin Conference Center, Los Angeles campus
Action
Consent Agenda:
Approval of the Minutes of the Meeting of March 18, 2026
Consent Item: Fiscal Year 2026-27 Bond Issuances
Consent Item: Adoption of Expenditure Rate for the General Endowment Pool
Fiscal Year 2026-27 Budget for the University of California Office of the President`);

  assert.equal(committeeDraft.title, "FINANCE AND CAPITAL STRATEGIES COMMITTEE");
  assert.equal(committeeDraft.date, "May 6, 2026");
  assert.ok(committeeDraft.tasks.some((task) => task.title === "Fiscal Year 2026-27 Bond Issuances"));
  assert.ok(committeeDraft.tasks.every((task) => !/notice of meeting|consent agenda/i.test(task.title)));
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
