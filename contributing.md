# CONTRIBUTING

How we work together on Dugtong OJT. The product rules are in `AGENTS.md`. This file is about branches, tickets, and merging.

## Branches

| Branch              | Purpose                          | Who changes it                     |
| ------------------- | -------------------------------- | ---------------------------------- |
| `main`              | Production                       | Only by PR from `test`             |
| `test`              | Testing                          | Only by PR from `dev`              |
| `dev`               | Where finished tickets land      | Only by PR from a developer branch |
| `ace`, `<yourname>` | Your own branch, named after you | You (and your AI)                  |

Nobody commits directly to `main`, `test`, or `dev`. Turn on branch protection for these three where the GitHub plan allows it. Where it doesn't, treat it as a team rule.

## Tickets

- Every task is a file in `tickets/`, named `ticket-01-short-name.md`. Copy `tickets/TEMPLATE.md`.
- The project owner creates tickets on `dev` and assigns them, so two people never pick the same number.
- A ticket is finished when every acceptance criterion and test box is ticked.
- Status goes `todo`, then `in progress`, then `done`. Set `done` in the last commit before you open the PR.
- Ideas that come up while working go under "Suggested new tickets" in the ticket. They are not built in the same ticket.

## The flow for each ticket

Work on **one ticket at a time** on your branch. Do not start the next ticket until the previous one is merged into `dev`.

1. **Start from the latest dev.**
   ```bash
   git switch dev
   git pull
   git switch ace          # your own branch
   git merge dev
   git push origin ace
   ```
2. **Work, commit, and push each logical change** on `ace`. Push every commit to `origin/ace` immediately after creating it; do not leave completed work only in the local checkout. Stage only the files for that change, and start every commit message with the ticket number:
   ```
   ticket-01: add time-in action
   ticket-01: add time-in tests
   ```
   If a push fails, report the failure and do not claim the change was published. Never push to `dev`, `test`, or `main`, and never force-push.
3. **Sync every day** (the same `git merge dev` as above). Small, frequent merges keep conflicts small.
4. **When the ticket is done:** merge `dev` into your branch one last time, run typecheck, lint and tests, then push any new merge or fix commits to `origin/ace`.
5. **Open a PR from your branch to `dev`.** Title it `ticket-01: Student time in and time out` and link the ticket file. Another developer reviews it.
6. **Merge the PR using "Create a merge commit"**, not squash and not rebase. Squashing a long-lived personal branch makes the same changes conflict again on the next merge.
7. **After the merge:** `git switch ace`, then `git merge dev` and `git push origin ace` to line your branch up with `dev`. Now you can start the next ticket.

## Promoting to test and production

- `dev` to `test`: the project owner opens a PR when a batch of tickets is ready. Run the full checks, then test by hand.
- `test` to `main`: PR only after testing passes.
- Both use normal merge commits so the branches don't drift apart.

## Resolving conflicts

1. `git merge dev` stops and lists the conflicted files (`git status` shows them).
2. Open each file, keep the right parts, and remove the `<<<<<<<`, `=======` and `>>>>>>>` markers.
3. Run typecheck, lint and tests, then `git add` the files and `git commit`.
4. If you are not sure which side is right, ask. Do not guess.

Special files:

- **Database migrations:** never edit a migration that is already on `dev`. After a merge, check the migration order is still valid.
- **Lockfile and generated files:** regenerate them, don't merge by hand.
- **Shared files** (layout, navigation, global styles): only one person works on them at a time. Say so in the ticket.

## Never

- Force-push (`git push --force`).
- Commit directly to `main`, `test`, or `dev`.
- Commit secrets or `.env` files.
- Merge a PR with failing checks.
- Work on two tickets at once on the same branch.

## Working with AI

Your AI follows the rules in `AGENTS.md`, section 14. In short: it works only from a ticket, asks instead of guessing, commits only on your branch, and never merges to `dev` itself.
