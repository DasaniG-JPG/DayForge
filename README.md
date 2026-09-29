# DayForge v0.1

A local-first student time-management web app built around fixed commitments, flexible tasks, assignment deadlines, and Google Calendar.

## Run it today

From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

You can also use any local web server or deploy the folder to GitHub Pages.

## Google Calendar setup

DayForge uses Google Identity Services in the browser and requests read-only Calendar access.

1. Open Google Cloud Console and create/select a project.
2. Enable **Google Calendar API**.
3. Configure the OAuth consent screen.
4. Create an **OAuth 2.0 Client ID** with application type **Web application**.
5. Add `http://localhost:8000` as an Authorized JavaScript origin for local testing.
6. Paste the Client ID into DayForge → Settings → Google Calendar.
7. Click **Connect Google Calendar**.

For a deployed GitHub Pages version, add that HTTPS site origin to the same OAuth client.

## What v0.1 already does

- Preloads the weekly class/routine skeleton provided in chat.
- Preloads the nearest known Fall 2026 assignment deadlines from the supplied course PDFs.
- Lets you add/complete/delete tasks.
- Ranks the best next task using deadline, priority, estimated duration, and free gaps.
- Protects a configurable transition buffer around fixed events.
- Reads timed events from your primary Google Calendar for the next 30 days.
- Stores app data locally in the browser.
- Includes a basic PWA manifest/service worker for install-like behavior.

## Known v0.1 limits

- Google authorization is session-based; it may ask you to reconnect after the access token expires.
- The scheduler recommends a task for a free block but does not yet auto-create study blocks on Google Calendar.
- Work-study hours are not seeded yet because the hours are not known.
- Gym duration is currently set to 60 minutes and is easy to edit in `app.js` once your actual return time is known.
- Only the nearest/highest-value assignment deadlines are seeded in the starter file. More syllabus ingestion can be added next.
