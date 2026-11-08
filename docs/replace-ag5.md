# Move records from AG5

AG5's [export documentation](https://docs.ag5.com/data-management/exporting-data), checked 8 November 2026, describes Excel exports, CSV for very large reports, predefined fields and custom field selection. Export permissions depend on your account. Employees, skills, results, requirements, positions and planning records have export options. The export history holds larger completed exports.

1. Export the employees, skills, positions or roles, requirements, role assignments and skill results you need using an authorised account. Export planning separately if needed. Keep the originals in a private archive.
2. Copy fixtures/ag5/manifest.json to a private working folder and replace its paths and column mappings with the headings in your exports. The fixture headings are examples, not a vendor specification. Each entry declares kind, file, optional sheet and a map from our field names to your columns. CSV and XLSX are supported. Formula cells must be exported as values.
3. Load in dependency order: employees, roles, skills, requirements, assignments, results, training. The single command imports all files in that order:

```bash
npm run competency -- import ag5 --manifest=/private/exports/manifest.json --source=ag5-original --actor="Training coordinator" --dry-run
```

4. Review the preview. Run the same command without --dry-run to commit the batch. Repeating the same mapped records and source does not create duplicates. A changed duplicate stops the whole batch; reconcile the difference deliberately rather than silently replacing an approved assessment. Do not change source to evade reconciliation.
5. Compare employee, skill and result counts with the exported files. Review a worker's full history, expiry and requirement level against AG5. Keep AG5 until the mapping and operating process are accepted.

## Mapping contract

The manifest maps our names on the left to your real column headings on the right. Dates must be ISO YYYY-MM-DD, levels whole numbers 0 to 5 (requirements 1 to 5), booleans true or false, result status pending, approved or revoked. Convert your rating scale explicitly before loading, and preserve the source archive. Unknown ratings must not become a pass. Blank expiry means no recorded expiry, not a licence exemption.

Reference fields employee, role and skill resolve an imported code, full identifier or unambiguous name. Prefer stable codes. Codes must be globally unique within each record kind; use a source prefix when combining exports. Each result needs its own stable code. Do not collapse assessment history to one employee/skill row. Every imported row keeps its original columns alongside the mapped values.

Only approved results with assessor and required evidence qualify as current. Missing evidence on an approved export must be reconciled or mapped to pending with the original state preserved in the archive. Evidence is a reference, not an uploaded attachment, and the importer does not fetch it. Keep source evidence in controlled storage with access arranged for supervisors.

The free base models one minimum-level requirement for each role and skill. AG5's hierarchical rules, exemptions, temporary skill assignments, prerequisite logic, rating descriptions, self-assessment workflows, translations and signatures need explicit mapping or custom work. Attachments, SSO settings, notification automations and vendor audit history do not migrate as executable features. Original columns are retained as evidence, not treated as working rules.

The one-command promise is for the mapped batch. Mapping and acceptance still require a person who understands the work. Enterprise DNA does this work as part of your custom version.
