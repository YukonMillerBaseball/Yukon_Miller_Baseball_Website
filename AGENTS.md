<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Yukon Baseball multi-agent rules

Multiple Cursor Cloud Agents may work at the same time on YukonBaseball.com in this repository. Develop independently and protect existing code, functionality, and data.

## Before starting any work

- Fetch the latest GitHub `main` branch.
- Check recent commits and open pull requests.
- Identify which files the task will modify.
- Use a separate branch for each task.
- Do not overwrite or discard another agent's changes.
- Do not modify unrelated files.

## While working

- Other agents may be changing the repository at the same time.
- Do not assume the code you started from is still current.
- Keep changes limited to the requested task.
- Preserve existing website functionality.
- Never force-push or reset shared branches.
- Do not delete or replace existing data.

## Before pushing or deploying

1. Fetch the latest GitHub `main` branch.
2. Check whether `main` has changed since the task began.
3. If newer commits exist, review the files they changed and compare them with your work. Incorporate the latest `main`. Identify overlapping edits. Adjust your code so it stays compatible, and preserve every change made by other agents.
4. If conflicts exist, resolve them only when the correct resolution is clear. Never discard another agent's work as an automatic choice. Stop and request approval when the resolution is uncertain.
5. Review the final combined changes.
6. Verify that no unrelated files or functionality were overwritten, reverted, or removed.
7. Run TypeScript checks, relevant tests, and a production build.
8. Confirm those checks pass before publishing.

## Safe GitHub pushing

- Never force-push.
- Never overwrite GitHub history.
- Never reset the production `main` branch.
- Never discard commits from another agent.
- Do not bypass GitHub branch protections.

If `main` changes again before publishing, fetch it, incorporate the new changes, repeat validation, and retry safely. If a push is rejected because `main` has changed, do not force the push.

## Deployment

When the requested task includes deployment:

- Commit only relevant changes.
- Incorporate the latest `main` branch.
- Validate the combined website.
- Push or merge safely into `main`.
- Allow Vercel to deploy.
- Confirm the production deployment succeeds.
- Verify the requested changes on the live website.

Do not claim deployment succeeded without confirmation from Vercel.

## Protect existing website features

Unless the task explicitly requests a change, preserve:

- Media Library and uploaded cover images
- News articles
- Meeting Minutes and stored PDFs
- Varsity and JV schedules
- Historical season results
- Calendar subscription URLs
- Roster and player information
- Sponsorship pages
- Admin functionality and authentication
- Analytics and SEO configuration
- Existing redirects and public URLs

Never perform destructive database or storage changes without explicit approval and a verified recovery plan.

## Website photography

Before committing a new news, roster, or facility photograph:

1. Run `npm run images:optimize`.
2. Run `npm run images:check`.
3. Do not commit a photograph that the check says needs attention.

Do not change an existing image unless the user explicitly approves that file. Do not modify Yukon logos, sponsor logos, or other branding. Keep filenames, paths, and image references. PNG graphics and transparent assets stay unchanged. The permanent instructions are in `.cursor/rules/website-photography.mdc`.

## Report after completion

Report:

1. Files modified
2. Whether newer GitHub commits were detected
3. Whether changes from other agents were incorporated
4. Any overlapping files or conflicts
5. Any compatibility adjustments made
6. TypeScript and build results
7. Git commit hash
8. Vercel deployment status

A merge or push does not by itself prove that all functionality is preserved. When another agent's changes overlap with your work, verify that both sets of functionality still work. If preservation cannot be verified, stop and ask.
