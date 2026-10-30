# ticket-02: Dugtong favicon

- Type: feature
- Assignee: Ace
- Status: done
- Mockup: None.

## What and why

Replace the default Next.js favicon with the Dugtong logo mark from `public/dugtong_logo.jpg`.

## In scope

- Prepare a multi-resolution favicon from the supplied square logo.
- Preserve the logo artwork and make the black image background transparent for light and dark browser chrome.

## Out of scope

- Changing the source logo.
- Adding other branding assets or changing the landing page.

## Plan

- Convert the supplied 480x480 JPEG logo mark to a transparent PNG favicon source.
- Replace `app/favicon.ico` with an ICO containing common browser favicon sizes.
- Verify the output image and run the production build.

## Test checklist

- [x] Favicon includes 16, 32, and 48 pixel images and uses transparency.
- [x] `npm.cmd run build` passes.
- [x] `git diff --check` passes.
- [x] `curl.exe -sS -I http://localhost:3000/favicon.ico` returns `200 OK` with `Content-Type: image/x-icon`.
