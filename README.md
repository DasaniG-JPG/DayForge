# DayForge v1.0

DayForge is a local-first smart day planner. It combines recurring schedule anchors, tasks, Google Calendar events, and deadlines to generate realistic focus blocks for your day.

## Features

- Generate My Day / Replan around fixed commitments
- Recurring weekly anchors for classes, work, meals, meetings, and routines
- Task priorities, due dates, estimated effort, and workload forecasting
- Google Calendar pull, recurring-anchor push, and deadline sync
- Screenshot OCR and PDF text extraction in the browser
- Review-before-save capture flow for tasks or calendar events
- JSON backup/restore
- Installable PWA for phones and desktops
- Local-first storage: DayForge has no app backend and does not upload your task database

## Privacy

The public repository ships with **no personal schedule or assignments**. Tasks, anchors, preferences, and imported files stay in your browser. Google Calendar access tokens are kept in memory for the current session. OCR/PDF libraries are loaded from public CDNs, but the selected file is processed in the browser by DayForge.

Do not commit personal backups, screenshots, school records, OAuth secrets, or other private data to the repository.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Deploy to GitHub Pages

1. Create a public repository, for example `DayForge`.
2. Upload/push the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Push to `main`. The included workflow deploys the site automatically.

The project-site URL will normally be:

`https://YOUR-USERNAME.github.io/DayForge/`

Because DayForge uses relative paths, it works from a GitHub Pages project subdirectory.

## Google Calendar setup

DayForge uses a bring-your-own Google OAuth client so a public fork does not depend on one developer's credentials.

1. Create/select a Google Cloud project.
2. Enable the Google Calendar API.
3. Configure Google Auth Platform / OAuth consent.
4. Create an OAuth client of type **Web application**.
5. Add your DayForge origins, for example:
   - `http://localhost:8000`
   - `https://YOUR-USERNAME.github.io`
6. Paste the OAuth Client ID into **DayForge → Settings → Google Calendar**.
7. Connect Google, then Pull/Push as needed.

If the OAuth app is still in Testing, only listed test users can authorize it. A broadly distributed Calendar integration may require Google's production/verification steps depending on the requested scopes and audience.

## Moving your setup to another device

Use **Settings → Data → Export backup**, move the JSON file to the other device, then use **Import backup**. Calendar events themselves remain in Google Calendar and can also be pulled again.

## Notes

- DayForge is a static app. It does not require your PC to stay on after you deploy it.
- Cross-device task syncing is not automatic in v1.0 because there is no backend account/database. Use backup/restore for DayForge-only data and Google Calendar for calendar events.
- Image OCR and PDF extraction require internet on first load because their browser libraries are fetched from CDNs.

## License

MIT
