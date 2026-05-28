import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("single paste input generates the ClassLoop-style dashboard", async ({ page }) => {
  await expect(page).toHaveTitle(/Relay/);
  await expect(page.getByRole("heading", { name: /Paste meeting notes/ })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Meeting notes" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open copy link/i })).toHaveAttribute("href", /docs\.google\.com/);
  await expect(page.getByRole("heading", { name: "Meeting notes template" })).toBeVisible();

  await page.getByRole("button", { name: "Load sample" }).click();
  await expect(page.getByText("Sample notes loaded.")).toBeVisible();
  await page.getByRole("button", { name: "Generate dashboard" }).first().click();

  await expect(page.getByRole("heading", { name: "Building your Relay dashboard." })).toBeVisible();
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
  await page.getByRole("button", { name: "Load sample" }).click();
  await page.getByRole("button", { name: "Generate dashboard" }).first().click();
  await expect(page.getByRole("heading", { name: "Hackathon demo planning" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your tasks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New paste" })).toBeVisible();
});
