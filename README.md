# Workforce Competency for Claude Code

Know which skills are current, which assessments need review and where the next expiry leaves a team short. Keep your role requirements, assessment history and training follow-up in a database you own.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT. Install and run the demo. | Your roles, rating scale, import mapping and shared screens. | Installed and operated through Omni by Enterprise DNA. One setup fee, then a retainer. |

[Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=ag5) · [Instead of AG5](https://enterprisedna.co/omni/instead-of/ag5)

## Start with the Monday review

Requires Node 20 or later.

```bash
npm install
npm run demo
npm run competency -- weekly-review
npm run docs
npm run view
```

Open this folder in Claude Code, Codex, OpenCode or Cursor. AGENTS.md points every runtime at the same instructions and commands. PGlite runs locally; DATABASE_URL selects PostgreSQL. Seed only a disposable demo database.

The fictional packing business has two sites, four employees, three skills and deliberately expired, pending, below-level and missing evidence records. Nothing in the demo authorises anyone to operate equipment.

## Weekly rituals

/skills-gap checks role requirements. /renewals-due reviews expiry. /single-cover finds teams below their cover target. /approval-queue prepares the assessor review. /training-plan follows up open training. /weekly-review combines coverage, attention and training.

The latest assessment on or before today controls readiness. A pending, revoked or expired latest assessment never falls back to an older pass. Training completion records attendance evidence; it does not approve competence. Coverage counts distinct active employees and respects assignment dates. The thirty-day projection holds today's assignments fixed and only ages current assessment expiry; it is not a staffing forecast.

30 CLI commands are documented in [operations](docs/operations.md).

## Ten questions you can answer today

These are demonstrated questions for this system. No claim is made that AG5 cannot answer them.

1. Which required skills have no assessment? Run `skills-gap`.
2. Which certificates have expired or expire within sixty days? Run `renewals-due`.
3. Which site depends on one currently qualified person? Run `single-cover`.
4. Where will coverage fall below our target in thirty days? Run `coverage`.
5. Which newer assessments are still waiting for review? Run `approval-queue`.
6. Which approved records lack supporting evidence? Run `compliance`.
7. Which training owner has the most overdue actions? Run `owner-load`.
8. Who has a recorded level below the role requirement? Run `skills-gap`.
9. Who approved or revoked an assessment and when? Run `activity`.
10. What source rows were brought across from the export? Run `import-history`.

## Bring your records

```bash
npm run competency -- import ag5 --manifest=fixtures/ag5/manifest.json --source=demo-export --actor="Your name" --dry-run
```

The fixture is fictional. AG5 documents custom Excel exports and CSV for large exports, not a fixed universal set of headings. Map your actual files in one manifest, then run one import for the batch. The importer preserves original columns, reconciles unchanged repeats and rolls back the batch on errors or changed duplicates. Imported reference codes must be unique in this database. See the [switching guide](docs/replace-ag5.md).

## Documents and views

Edit brand.json for your name, logo and colours. npm run docs produces worker competency records and training follow-up working drafts. npm run view produces the weekly review, competency matrix and training snapshots. The draft commands write private HTML and send nothing.

/compliance checks record evidence against the sources in [compliance.md](docs/compliance.md). It does not certify competence or legal compliance. A supervisor still assesses the work, its hazards and the person. This base does not provide learning courses, phone workflows, SSO, electronic signatures or validated FDA controls. [Why no front end](docs/why-no-front-end.md).

## Your first hour: ten things to ask for

1. Put our business name on the training plans.
2. Show the missing assessments for packing operators.
3. Show the expired evidence separately from pending review.
4. Explain why the machine isolation cover drops next month.
5. Draft a training follow-up for the supervisor.
6. Test our export mapping without saving records.
7. Add our roles and their minimum levels.
8. Assign training follow-up to the responsible owner.
9. Add a read-only view grouped by site.
10. Add a training provider reference with a tested migration.

/customise writes and tests a numbered migration. /new-view adds a read-only report. Start every answer with current database records.

## Verification and selection evidence

npm test covers every CLI command, migration and seed idempotence, assessment precedence, expiry boundaries, coverage, input validation, approval gates, audit history, CSV/XLSX import, rollback, repeat imports, exports and escaped HTML. Windows/Linux verification is configured in the manual CI workflow. See [operations](docs/operations.md).

AG5 currently quotes privately. The selection used a third-party five-figure annualised listing, not a verified customer invoice or a current vendor price. No current NZ/AU bill or savings claim is made. [Research and six scores](docs/research.md).

Enterprise DNA maps your records, builds your workflows and runs your version through Omni by Enterprise DNA. One setup fee, then a retainer. [Book 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=ag5).

MIT. Not affiliated with AG5 or Anthropic. Hosting and agent usage have their own costs.
