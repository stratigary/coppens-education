# coppens.education setup guide

Five one-time steps to take the site live. Each step says where to click.

1. [Add a "Website" tab to each unit-plan sheet](#1-add-a-website-tab-to-each-unit-plan-sheet)
2. [Publish only that tab as CSV and paste the link into the editor](#2-publish-the-website-tab-as-csv)
3. [Turn on GitHub Pages](#3-turn-on-github-pages)
4. [Point coppens.education at GitHub Pages in Squarespace](#4-point-the-domain-at-github-pages-squarespace)
5. [Connect Pages CMS](#5-edit-the-site-with-pages-cms)

---

## 1. Add a "Website" tab to each unit-plan sheet

Use your **main** unit-plan sheets, not the STUDENT copies. In each one, click **+** at the bottom left, name the new tab exactly `Website`, click cell **A1**, and paste the formula below.

The formula copies **only** the student-facing columns. The tab updates on its own whenever you edit the plan.

| Sheet | Formula for `Website!A1` | Columns it copies | Columns it leaves out |
|---|---|---|---|
| **APES - Unit Plans - 26/27** | `={'Unit Plan 26-27'!A:B,'Unit Plan 26-27'!D:E,'Unit Plan 26-27'!G:L}` | #, Date, Schedule, Block (min), Unit, Lesson, AP Topics, Reading Guide DUE, Your classwork, HW | Day, Calendar note, Additional activity, **all JiTT columns**, If we lose a day |
| **IB Biology Year 1 - Unit Plans - 26/27** | `={Sheet1!A:A,Sheet1!C:L}` | Unit, Bk, Blue, Gold, Today's Topics, In Class, Labs, Homework, Reading & Notes, Assessment, Assessment Title | Content Statements (long; the codes come from Today's Topics) |
| **Environmental Science - Unit Plans - 26/27** | `={Sheet1!A:F}` | Unit, Learning Objectives, Block, Date, In Class, Homework | (none) |

Notes:

* If a tab has a different name, change the part before `!` (for example `'Unit Plan 26-27'!`).
* **Adding columns later:** the site finds columns by their **header text**, so the order can change. A new teacher-only column can't leak, because the formula copies only the columns listed above.
* **Merged unit cells are fine.** The unit name shows in the first row only, and the site carries it down.
* **Dates without a year:** Aug–Dec counts as 2026 and Jan–Jun as 2027. Next year, change "School year starts in" in the editor.
* **Notes inside date cells** (`8/21` + new line + `Sch.5`, or `2 hr delay`) show as a flag under that lesson. Any of *delay, dismissal, short block, Mardi Gras* marks the day as a **short block**. In APES, the Schedule and Block (min) columns do this: under 60 minutes, or a delay or dismissal, counts as a short block.
* **Tests and quizzes** are flagged when the lesson title or In Class says "Test"/"Quiz". In IB, the Assessment column also counts, but only when In Class agrees. "DUE: …" lines in Env Sci become *due* tags.

## 2. Publish the Website tab as CSV

In each sheet:

1. **File → Share → Publish to web**.
2. Under **Link**, change "Entire document" to **Website** and change "Web page" to **Comma-separated values (.csv)**.
3. Open **Published content and settings**. Make sure only **Website** is selected and **Automatically republish when changes are made** is checked.
4. Click **Publish** and copy the link. It ends in `output=csv`.
5. In Pages CMS, open **Courses**, find the course, paste the link into **Published CSV link for the Website tab**, and save.

Google takes up to about 5 minutes to update a published CSV after you edit the sheet.

> **If "Publish to web" is greyed out**, or the link asks people to sign in, your Google Workspace admin has limited publishing to nda.org. Ask the tech office to allow **Publish to web** for your account. Until then, the site shows the saved copy, which is refreshed whenever a published link works.

**How the live calendar and saved copy work together:** the site reads the published CSV directly in each visitor's browser. If Google is slow or unreachable, it uses the copy saved in this repository (`public/data/fallback/*.csv`). That copy is refreshed every night by the *Refresh saved calendars* GitHub Action. A line under each calendar tells students which one they are seeing. The nightly job **refuses to save** a tab whose headers contain JiTT, "If we lose a day", "teacher" or similar, so a mistake in the Website tab can't put teacher-only columns into the repository.

## 3. Turn on GitHub Pages

In the repository on GitHub:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Pages → Custom domain:** `coppens.education` → Save. When the check passes, turn on **Enforce HTTPS**. The certificate can take up to an hour.
3. **Settings → Actions → General → Workflow permissions:** choose **Read and write permissions**. The nightly calendar refresh needs this to commit.

Every push to `main` builds and publishes the site. It also rebuilds every night at about 5 am Eastern.

> GitHub Pages on a **private** repository requires a paid GitHub plan. On a free account the repository must be public. The repository holds no student data. It contains the site code, links to your Drive files (which still require a school login), and the saved student-facing calendar.

## 4. Point the domain at GitHub Pages (Squarespace)

coppens.education currently forwards to your Google Site (`sites.google.com/nda.org/coppens-science`). In **Squarespace → Domains → coppens.education**:

1. **Remove the forwarding** to the Google Site: under **Domain forwarding** (or the Google Sites connection), delete it.
2. **DNS → Custom records.** Delete any old `A`, `AAAA` or `CNAME` records for `@` and `www` that point to Google or Squarespace, then add:

| Host | Type | Data |
|---|---|---|
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |
| `@` | AAAA | `2606:50c0:8000::153` |
| `@` | AAAA | `2606:50c0:8001::153` |
| `@` | AAAA | `2606:50c0:8002::153` |
| `@` | AAAA | `2606:50c0:8003::153` |
| `www` | CNAME | `<your-github-username>.github.io` |

3. Optional but recommended: in GitHub, **your profile → Settings → Pages → Add a domain** to verify `coppens.education`. This stops anyone else's GitHub Pages site from claiming it. GitHub shows a `TXT` record to add in Squarespace.

DNS changes usually take minutes but can take up to 48 hours. The old Google Site stays reachable at its sites.google.com address until you delete it.

## 5. Edit the site with Pages CMS

1. Go to **app.pagescms.org** and sign in with GitHub.
2. Open this repository and pick the **main** branch. Edits on main go live in about a minute.
3. The left menu shows:
   * **Announcements & site settings**: notes at the top of the Today page, with an optional "hide after" date.
   * **Courses**: the **Show this course on the site** switch (turn on Freshman Honors Biology here), published CSV links, and unit names.
   * **Unit resources** for each course: notes, slides, docs and videos by unit. These are what students see in the side panel.
   * **Tools & simulations**, **Helpful links**, **Digital textbooks**.

Turning Honors Biology on adds it to the menu, the Today page and the tools filter. Its calendar appears once you add a Website tab to its unit-plan sheet and paste the CSV link. Its layout is set to the Env Sci column format (Unit, Learning Objectives, Block, Date, In Class, Homework). If the Honors sheet uses different columns, ask for the parser to be extended.

## Local development

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # parser tests against the saved calendars
npm run snapshot   # refresh public/data/fallback from the published CSVs
npm run build      # static site in dist/
```

Code map: `src/lib/sheets.js` reads the sheets; `src/lib/render.js` builds the calendar HTML (used at build time and in the browser); `src/scripts/live.js` handles the live refresh and the Blue/Gold memory; content lives in `src/data/*.json`.
