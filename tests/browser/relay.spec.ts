import { expect, test } from "@playwright/test";

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
  await expect(page.locator(".task-row", { hasText: "90-second demo script" }).first()).toBeVisible();
  await expect(page.locator(".resource-row", { hasText: "https://docs.google.com/document/d/sample-relay-pitch" })).toBeVisible();

  const firstStatus = page.getByLabel(/Status for .*90-second demo script/i).first();
  await firstStatus.selectOption("complete");
  await expect(firstStatus).toHaveValue("complete");

  const firstDueDate = page.getByLabel(/Due date for .*90-second demo script/i).first();
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
