import { expect, test, type Page } from "@playwright/test";

const relayFlowNotes = `Meeting title: Hackathon demo planning
Date: Thursday

Context:
Solo planning meeting to make the Relay demo tighter before submission.

Resources:
Pitch outline: https://docs.google.com/document/d/sample-relay-pitch
Demo checklist: https://example.com/relay-demo-checklist

Questions:
Should the demo show JSON export?

Due dates:
Finish the 90-second demo script by Friday

Meeting minutes:
We decided the app should stay focused on personal meeting minutes and a smaller demo scope.
I need to finish the 90-second demo script by Friday.
Send the final project summary to the judges after the demo is recorded.`;

const publicAgendaNotes = `AGENDA
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
P. Adjourn`;

const queryStringNotes = `Meeting title: Link cleanup
Date: Today

Context:
Checking links with tracking query strings.

Resources:
Spec doc: https://example.com/spec?tab=overview&ref=relay
Form: https://example.com/form?entry=followup

Questions:
https://example.com/help?topic=setup
Question: https://example.com/form?entry=followup
Do we need to clean tracking params before export?

Meeting minutes:
Shared the spec link https://example.com/spec?tab=overview&ref=relay.`;

const classOfficerMinutes = `5/27 '29 Officer Meeting #4 🌤️
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
Check in and help on tasks below`;

async function expectConfettiNear(page: Page, expected: { x: number; y: number }, tolerance = 3) {
  const confetti = page.getByTestId("task-confetti").last();
  const center = await confetti.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    };
  });

  expect(Math.abs(center.x - expected.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(center.y - expected.y)).toBeLessThanOrEqual(tolerance);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
});

test("single paste input generates the ClassLoop-style dashboard", async ({ page }) => {
  await expect(page).toHaveTitle(/Relay/);
  await expect(page.getByRole("heading", { name: /Paste meeting notes/ })).toBeVisible();
  const notesInput = page.getByRole("textbox", { name: "Meeting notes" });
  await expect(notesInput).toBeVisible();
  await expect(notesInput).toHaveValue("");
  await expect(page.getByRole("button", { name: "Load sample" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Open copy link/i })).toHaveAttribute(
    "href",
    "https://docs.google.com/document/d/17qDjDwntSB_QHYE6rn-TKwiOrIWyxPBywMzSwNJUhVU/copy",
  );
  await expect(page.getByRole("link", { name: "Edit source doc" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Meeting notes template" })).toBeVisible();

  await notesInput.fill(relayFlowNotes);
  await page.getByRole("button", { name: "Generate dashboard" }).first().click();

  await expect(page.getByRole("heading", { name: "Hackathon demo planning" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tasks due soon" })).toBeVisible();
  await expect(page.locator(".metric-icon svg")).toHaveCount(4);
  const metricIconBoxes = await page.locator(".metric-icon svg").evaluateAll((icons) =>
    icons.map((icon) => {
      const box = icon.getBoundingClientRect();
      return { height: Math.round(box.height), width: Math.round(box.width) };
    }),
  );
  expect(metricIconBoxes.every((box) => box.height >= 18 && box.height <= 22 && box.width >= 18 && box.width <= 22)).toBeTruthy();
  await expect(page.locator(".task-row", { hasText: "90-second demo script" }).first()).toBeVisible();
  await expect(page.locator(".resource-row", { hasText: "https://docs.google.com/document/d/sample-relay-pitch" })).toBeVisible();

  await page.getByRole("button", { name: "New paste" }).click();
  await expect(notesInput).toHaveValue("");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hackathon demo planning" })).toBeVisible();

  const firstStatus = page.getByLabel(/Status for .*90-second demo script/i).first();
  await firstStatus.selectOption("complete");
  await expect(firstStatus).toHaveValue("complete");

  const firstDueDate = page.getByLabel(/Due date for .*90-second demo script/i).first();
  await expect(firstDueDate).toHaveAttribute("placeholder", "Enter due date");
  await firstDueDate.fill("Friday, 6 PM");
  await expect(firstDueDate).toHaveValue("Friday, 6 PM");

  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.locator('input[value="New follow-up task"]')).toBeVisible();
  await page.getByRole("button", { name: "Remove New follow-up task" }).click();
  await expect(page.locator('input[value="New follow-up task"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Copy recap" }).click();
  await expect(page.getByText("Recap copied.")).toBeVisible();

  await page.getByRole("button", { name: "Mark all complete" }).click();
  await expect(page.getByText("Tasks marked complete.")).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Saved Relay dashboards" })).toBeVisible();
  await page.getByRole("button", { name: /Hackathon demo planning/ }).click();
  await expect(page.getByRole("heading", { name: "Hackathon demo planning" })).toBeVisible();

  await page.getByRole("button", { name: "Template" }).click();
  await expect(page.getByRole("heading", { name: "Google Docs meeting template" })).toBeVisible();
  await page.getByRole("button", { name: "Copy text" }).click();
  await expect(page.getByText("Template text copied.")).toBeVisible();
});

test("dashboard flow stays usable on mobile", async ({ page }) => {
  await page.getByRole("textbox", { name: "Meeting notes" }).fill(relayFlowNotes);
  await page.getByRole("button", { name: "Generate dashboard" }).first().click();
  await expect(page.getByRole("heading", { name: "Hackathon demo planning" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your tasks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New paste" })).toBeVisible();
});

test("completion confetti follows the latest mouse cursor on desktop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Mouse cursor behavior is desktop-only.");

  await page.getByRole("textbox", { name: "Meeting notes" }).fill(relayFlowNotes);
  await page.getByRole("button", { name: "Generate dashboard" }).first().click();
  await expect(page.getByRole("heading", { name: "Hackathon demo planning" })).toBeVisible();

  const firstStatus = page.getByLabel(/Status for .*90-second demo script/i).first();
  const cursorPoint = { x: 320, y: 240 };
  await page.mouse.move(cursorPoint.x, cursorPoint.y);
  await page.evaluate((point) => {
    window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: point.x, clientY: point.y }));
  }, cursorPoint);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await firstStatus.selectOption("complete");
  await expect(page.getByTestId("task-confetti")).toHaveCount(1);
  await expectConfettiNear(page, cursorPoint);
});

test("completion confetti falls back to the completing status control", async ({ page }) => {
  await page.getByRole("textbox", { name: "Meeting notes" }).fill(relayFlowNotes);
  await page.getByRole("button", { name: "Generate dashboard" }).first().click();
  await expect(page.getByRole("heading", { name: "Hackathon demo planning" })).toBeVisible();

  const firstStatus = page.getByLabel(/Status for .*90-second demo script/i).first();
  await page.waitForTimeout(3100);
  const statusBox = await firstStatus.boundingBox();
  if (!statusBox) throw new Error("Expected the first status control to be visible.");
  await firstStatus.selectOption("complete");
  await expect(page.getByTestId("task-confetti")).toHaveCount(1);
  await expectConfettiNear(page, {
    x: statusBox.x + statusBox.width / 2,
    y: statusBox.y + statusBox.height / 2,
  }, 12);
});

test("raw public agenda paste generates a useful dashboard", async ({ page }) => {
  await page.getByRole("textbox", { name: "Meeting notes" }).fill(publicAgendaNotes);
  await page.getByRole("button", { name: "Generate dashboard" }).first().click();

  await expect(page.getByRole("heading", { name: "BREVARD CITY COUNCIL - REGULAR MEETING" })).toBeVisible();
  await expect(page.locator(".student-identity", { hasText: "May 18, 2026" })).toBeVisible();
  const taskTitles = await page.locator(".editable-task input").evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
  expect(taskTitles).toContain("Proposed FY 2026-2027 Budget and Ordinance");
  expect(taskTitles.some((title) => /Resolution Requesting Increased Funding/.test(title))).toBeTruthy();
  expect(taskTitles.some((title) => /^(AGENDA|Call to Order)$/i.test(title))).toBeFalsy();
});

test("URL query strings do not appear as dashboard questions", async ({ page }) => {
  await page.getByRole("textbox", { name: "Meeting notes" }).fill(queryStringNotes);
  await page.getByRole("button", { name: "Generate dashboard" }).first().click();

  await expect(page.getByRole("heading", { name: "Link cleanup" })).toBeVisible();
  const questionTexts = await page.locator(".question-row").evaluateAll((rows) => rows.map((row) => row.textContent?.trim()));
  expect(questionTexts).toEqual(["Do we need to clean tracking params before export?"]);
});

test("class officer pasted minutes ignore metadata and document comments", async ({ page }) => {
  await page.getByRole("textbox", { name: "Meeting notes" }).fill(classOfficerMinutes);
  await page.getByRole("button", { name: "Generate dashboard" }).first().click();

  await expect(page.getByRole("heading", { name: /5\/27 '29 Officer Meeting #4/ })).toBeVisible();
  await expect(page.locator(".today-card")).not.toContainText(/Minutes Recorder|Absent|please review|wow a needoh|corny ah/i);
  await expect(page.locator(".question-row")).toHaveText(["Who is taking Backdrop?"]);
  await expect(page.locator(".metric-card", { hasText: "Questions" }).locator("strong")).toHaveText("1");
});
