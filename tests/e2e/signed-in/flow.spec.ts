import { expect, test } from "@playwright/test";
import { settle, signedInContext, sizes } from "../support/checks.ts";
import { readSeedIds } from "../support/seed-ids.ts";

// The core flow, once, end to end (ticket-36; AGENTS.md section 5, steps 6 to 8):
// the student times in with one tap, writes the journal, times out; the supervisor
// corrects the times and approves; and the approved hours on the student's home go
// up. Times come from the server clock, so the supervisor sets a four hour day
// before approving, which is also the path a real correction takes. The student
// can time in once a day and an approved entry cannot be deleted, so the test ends
// by reopening its entry (a supervisor's own action, audited): it is pending again
// and the next seed sets it aside, so the test can run again the same day.

test("time in, time out, approve: the student's approved hours go up", async ({ browser }) => {
  test.setTimeout(150_000);
  const ids = readSeedIds();
  test.skip(
    ids.todayLocked,
    "The student's entry for today is approved and locked (a run stopped before it was reopened). It runs again tomorrow.",
  );

  // The student, on a phone.
  const studentContext = await signedInContext(browser, "student", sizes[0], "light");
  const student = await studentContext.newPage();
  await student.goto("/student", { waitUntil: "load" });
  await settle(student);
  const before = Number(await student.getByTestId("approved-hours").innerText());
  expect(before, "approved hours before").toBeGreaterThanOrEqual(0);

  // One tap.
  // The phone's bottom bar has its own "Time in", one tap from every page; the
  // card on the home page has the other. Both are there, and both are 44 px or more.
  const bar = student.locator('nav button[aria-label="Time in"]');
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox())?.height ?? 0, "the bar's time in is at least 44 px tall").toBeGreaterThanOrEqual(44);
  const timeIn = student.getByRole("region", { name: "Today" }).getByRole("button", { name: "Time in" });
  await expect(timeIn).toBeVisible();
  expect((await timeIn.boundingBox())?.height ?? 0, "the daily action is at least 44 px tall").toBeGreaterThanOrEqual(44);
  await timeIn.click();
  await expect(student.getByText("Timed in at")).toBeVisible();

  // The journal, then time out. Before the scheduled end the app asks why.
  const journal = `E2E journal ${Date.now()}`;
  await student.getByLabel("What did you do today?").fill(journal);
  const reason = student.getByLabel(/Why are you timing out/);
  if (await reason.isVisible()) await reason.fill("A browser test run, leaving early.");
  await student.getByRole("button", { name: "Time out" }).click();
  await expect(student.getByText("Submitted. Your supervisor will review it.")).toBeVisible();

  // The supervisor, on a desktop: find the entry, set a four hour day, approve.
  let approved = false;
  const supervisorContext = await signedInContext(browser, "supervisorOwner", sizes[1], "light");
  const supervisor = await supervisorContext.newPage();
  await supervisor.goto("/supervisor/approvals", { waitUntil: "load" });
  const entry = supervisor.locator("li", { hasText: journal });
  await expect(entry).toBeVisible();

  await entry.getByRole("button", { name: "Correct times" }).click();
  await entry.getByLabel("Time in", { exact: true }).fill("08:00");
  await entry.getByLabel("Time out", { exact: true }).fill("12:00");
  await entry.getByLabel("Break in minutes").fill("0");
  await entry.getByLabel("Reason for the correction").fill("A browser test sets a four hour day.");
  await entry.getByRole("button", { name: "Save correction" }).click();
  await expect(entry.getByText(/4 h worked/)).toBeVisible();

  await entry.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(entry).toHaveCount(0);
  approved = true;

  try {
    // The student's home now counts those hours.
    await student.reload({ waitUntil: "load" });
    await settle(student);
    await expect(student.getByText("Approved. These hours count.")).toBeVisible();
    const after = Number(await student.getByTestId("approved-hours").innerText());
    expect(after - before, "approved hours gained").toBeCloseTo(4, 1);
  } finally {
    // Put the day back, even if a check above failed: the supervisor reopens the
    // entry, so it is pending again and the student can time in on the next run.
    // (An approved entry is locked until tomorrow.)
    if (approved) {
      await supervisor.goto(`/supervisor/students/${ids.deploymentId}`, { waitUntil: "load" });
      const approvedEntry = supervisor.locator("li", { hasText: journal });
      await approvedEntry.getByRole("button", { name: "Reopen", exact: true }).click();
      await approvedEntry.getByLabel("Why are you reopening this entry?").fill("A browser test puts the day back.");
      await approvedEntry.getByRole("button", { name: "Reopen entry" }).click();
      await expect(approvedEntry.getByText(/Reopened: A browser test puts the day back/)).toBeVisible();
    }
  }

  await studentContext.close();
  await supervisorContext.close();
});
