# KutchPharmaConnect — Master Operating Specification

**Version:** 1.0  
**Status:** Approved policy baseline; technical mapping in progress  
**Date:** 1 November 2026  
**Repository:** `deepjthacker/kutchpharmaconnect`  
**Supabase project:** `kutchpharmaconnect`  
**Document purpose:** One operating reference for data governance, public behaviour, administration, verification, imports, security and implementation.

> **Implementation guardrail:** This document records the approved operating policy and the current technical findings. It is not a database migration or an instruction to execute destructive changes. Existing production data and website behaviour must be backed up, mapped and tested before implementation.

---

## 1. Product purpose and success measures

KutchPharmaConnect (KPC) is a Kutch-focused pharmaceutical business directory connecting:

- Pharmaceutical companies and their organisational structures.
- Distributors and stockists.
- Pharmacists and retailers looking for relevant company/distributor contact information.

KPC is a directory and enquiry-connection service. It is **not** an inventory, stock-availability, order, delivery, or authorisation-verification system.

Success is measured by:
- Relevant searches and result/profile clicks.
- Calls, WhatsApp enquiries and map actions.
- Repeat visitors and useful profile views.
- Verified, accurate and current company/distributor relationships.
- Fewer duplicate, incomplete, misleading or stale records.

Record volume alone is not a success measure.

## 2. Approved business policies

The following decisions were explicitly approved by the site owner on 1 November 2026.

| Policy | Approved rule |
|---|---|
| Who may create distributor records? | **Admin only initially.** Public users cannot create or publish distributor profiles or distributorship relationships. |
| Unverified listings | **Hidden from public directory until verified.** Pending, unverified, needs-review, rejected and inactive records are not publicly listed. |
| Geography | **Kutch first, expansion-ready.** Public experience and data entry are Kutch-focused; the model must not prevent later geographic expansion. |
| Contact details | Visible phone and WhatsApp actions where supplied and approved, with basic anti-spam protection. |
| Business model | Free directory initially. No paid placement or paid promotion workflow is in scope now. |

### Permanent governance rules

1. **One source of truth:** one canonical record per company, subsidiary, division, brand, product/SKU and distributor. All screens and workflows must use those canonical records.
2. **No automatic relationship inheritance:** a parent-company distributorship is not automatically a subsidiary, division, brand or product distributorship. Only an explicit relationship may be shown.
3. Never infer product stock, availability, guaranteed delivery, exclusive rights or official authorisation from a directory relationship.
4. Never invent missing company, brand, product, distributor, contact or territory information.
5. No destructive imports, silent overwrites, automatic deletion of records absent from an uploaded file, or automatic duplicate creation.
6. No implementation change merely because it is easy. Every change must solve an approved business or data-quality requirement.

## 3. Canonical data model

### 3.1 Entity hierarchy

The logical hierarchy is:

`Parent Company (optional) → Company / Subsidiary → Division (optional) → Brand (optional) → Product / SKU`

- **Parent company:** optional grouping/ownership relationship. It may exist without child companies.
- **Company / subsidiary:** an independently identifiable pharmaceutical business record. A company may stand alone or reference a parent.
- **Division:** belongs to exactly one company.
- **Brand:** belongs to one company and may optionally belong to one division of that same company.
- **Product / SKU:** belongs to one company; division and brand are optional. If present, both must be consistent with that company. Strength, dosage form and pack size distinguish separate SKUs.
- **Distributor:** an independent business profile, not a child of a company.
- **Distributorship:** a separate relationship between one distributor and one company, optionally scoped to a division and, when genuinely supported by evidence, a brand.

Company groups and parent-company relationships are distinct concepts until their business purpose and existing usage are fully reconciled. Do not automatically convert one into the other.

### 3.2 Relationship integrity

- A division must reference a valid company.
- A brand must reference a valid company. If it references a division, that division must belong to the same company.
- A product's company, division and brand must agree. A brand-linked product must not cross company ownership.
- A distributorship's division and brand must belong to the distributorship's company.
- A distributor can represent multiple companies; a company can have multiple distributors.
- A company-level distributorship does not imply a division- or brand-level distributorship.
- Product-level distributor mapping is **not part of the standard operating workflow**. The existing `product_distributors` table is retained for technical review and must not be used to imply SKU availability.

### 3.3 Identity and deduplication

- Internal UUIDs are system-generated and never entered by administrators.
- Display names use reliable official/legal or commonly recognised business names.
- Alternate spellings, abbreviations and former names are aliases, not separate records.
- Before creating a record, check canonical name, legal name, aliases and relevant identifiers/contact information.
- A duplicate must be reviewed for linked products, divisions, brands, distributorships, submissions, audit records and SEO/profile references before any merge.
- A merge must preserve the surviving canonical identity, redirect or reconcile references, record old values and be reversible.

Product identity should include, where known: product name, strength, dosage form, pack size, company/manufacturer, division, brand and product code. Missing attributes remain blank; they must not be guessed.

## 4. Lifecycle and verification policy

Record lifecycle and verification are separate dimensions.

### 4.1 Lifecycle status

The operating lifecycle is:

- **Draft:** incomplete internal working record; never public.
- **Pending:** awaiting administrator review; never public.
- **Active:** approved record eligible for public display, subject to verification rules.
- **Inactive:** retained for history but not public.
- **Rejected:** rejected submission or record; not public.

Existing production tables currently use a simpler `active / inactive` record status in several core entities. Do not add enum values or change column types until the full table/function/RLS mapping and migration strategy are approved. Draft and Pending can remain in submission/staging workflows if that is the safest fit.

### 4.2 Verification status

- **Unverified:** evidence has not been checked.
- **Needs review:** conflicting, incomplete or questionable evidence requires investigation.
- **Verified:** an administrator has checked a reliable source and recorded the evidence and date.
- **Rejected:** use for a rejected submission/claim or a relationship that must not be published; keep the reason and audit trail.

The current database's `verification_status` enum contains `verified`, `needs_review` and `unverified`; it does not contain every lifecycle state. Keep these concepts separate.

### 4.3 Public visibility rule

A company/distributor relationship is publicly visible only when:
- Its lifecycle status is active;
- Its verification status is verified;
- Both referenced entities are active; and
- Its geographic and relationship scope is valid.

All other combinations are hidden from public search, profiles, SEO pages and public counts. Admin users can inspect them in the review workspace.

A verified relationship is not proof of current stock, guaranteed supply, exclusive rights or official company authorisation unless a separate, reliable source specifically supports that exact claim.

### 4.4 Verification evidence

For every verification decision, preserve:
- Entity/relationship being checked.
- Verification status.
- Source/evidence and source date where available.
- Verification date and administrator.
- Notes/reason.
- Created/updated timestamps and change history.

Where a source is unavailable, record that fact and leave the status unverified. Do not treat a distributor's own uncorroborated submission as independent verification.

## 5. Public website behaviour

### 5.1 Design principles

- Premium, formal, light, clean and readable.
- Mobile-first and responsive.
- No crowded cards, excessive metadata, duplicate labels or long blocks of distributor text.
- Company and distributor discovery should be prominent; products are useful supporting information, not the dominant visual hierarchy.
- Avoid low-contrast text, unreadable dark-mode combinations and decorative controls that do not perform a real action.
- A result card should have a clear, predictable click target.
- Show only information that helps a pharmacist or distributor take the next step.

### 5.2 Search

One natural-language search box; no mandatory category selector.

Search matching order:
1. Exact canonical name.
2. Exact approved alias.
3. Prefix/partial canonical name or alias.
4. Fuzzy matching, only where confidence is sufficient.

Within comparable match quality, use the approved type priority:
1. Product
2. Division
3. Distributor
4. Company
5. Brand
6. Parent company

Do not let fuzzy results outrank a strong exact match. Deduplicate results by canonical entity ID. Do not show inactive, unverified or otherwise unpublished records.

Search should support partial names, known aliases and common spacing/spelling variations. Search results must be useful on both mobile and desktop.

### 5.3 Company profile

Show, in a clear hierarchy:
- Company name and approved logo/image.
- Parent company, if applicable.
- Subsidiaries and divisions.
- Brands and products, where known.
- Verified company-level and division-level distributor relationships, with accurate scope labels.
- Approved company contact and website details.

Distributors and their contact actions should be easy to find. Products should not displace the distributor directory.

### 5.4 Division profile

Show the division, owning company, associated brands/products and verified division-level distributors. Do not inherit company-level relationships as division-level appointments.

### 5.5 Product profile

Show product name, strength, dosage form, pack size, company, division and brand where known. Show the relevant verified distributor directory based on explicit scope:
- A company-level relationship may be displayed as **Company-listed distributor**.
- A division-level relationship may be displayed as **Division-listed distributor**.
- A brand-level relationship, if later used, must be labelled **Brand-listed distributor**.

Never state or imply that the distributor has the specific SKU in stock. The enquiry action should encourage the visitor to confirm availability directly.

### 5.6 Distributor profile

Show:
- Distributor name and approved image/logo.
- Kutch location/address, where known.
- Phone and WhatsApp actions, where supplied and approved.
- Map/directions action, where a reliable location exists.
- Companies and divisions represented, with scope labels and verification state.
- Last checked/verified information where appropriate.

Do not display unverified relationships as current representation.

### 5.7 Contact and engagement

Permitted actions include Call, WhatsApp, Maps/directions, company website and correction/report. Phone and WhatsApp should be visible where approved. Add reasonable rate limiting, validation and abuse controls to public forms/actions.

Track useful aggregate events such as search, result click, profile view, call click, WhatsApp click, map click and correction submission. Do not collect unnecessary personal data or expose private submission details.

### 5.8 Public submissions

Under the approved Admin-only policy:
- Remove/disable public distributor creation and distributor-submission entry points.
- Do not accept a public file upload that can create or publish distributor profiles or relationships.
- Keep a public correction/report mechanism so visitors can flag inaccurate information; corrections enter an admin queue and never directly alter published records.
- Review product-submission and other public intake flows separately; they must not bypass admin approval or create unverified public catalogue data.

Existing submission records and uploaded files must be retained until their purpose, retention requirements and dependencies are reviewed. Do not delete them as part of disabling a public entry point.

## 6. Administration: four work areas

The admin interface should expose four primary work areas. Internal technical modules may remain separate, but they must be presented through these four understandable tasks.

### A. Company Hierarchy

Manage parent companies, companies/subsidiaries, divisions, brands and products in one guided hierarchy. Administrators select names from existing records; system IDs remain hidden. Prevent invalid parent/child and cross-company relationships. Include search, duplicate warnings and clear edit history.

### B. Distributors

Manage independent distributor profiles: name, legal name, contact person, phone, WhatsApp, email, address, location, map, website, image and status. Add/edit is admin-only. Do not create a distributorship merely because a distributor profile exists.

### C. Bulk Upload

One guided workflow for approved company hierarchy/catalogue and relationship files:
1. Download the correct template.
2. Fill the template.
3. Upload.
4. Preview parsed rows.
5. Validate required fields and relationship consistency.
6. Match existing records and aliases.
7. Resolve duplicate/ambiguous matches.
8. Show exact create/update/skip/error counts.
9. Require administrator approval.
10. Import with a report and audit trail.

No silent import, no automatic deletion of missing rows, no overwriting verified data with incomplete data, and no creation of a new company/distributor simply because a spelling differs. Use safe batch limits and resumable processing for large files.

### D. Verification & Corrections

One queue for pending verification, needs-review records, correction reports and approved changes. Show evidence, current values, proposed values, relationship scope and impact before approval. Approve, reject, request review or mark inactive with reason. Record who made the decision and when.

### Admin usability rules

- No manual UUID entry or SQL.
- Use plain-language labels and short helper text.
- Show the next action, not every database field.
- Keep advanced/reference settings out of the main workflow.
- Prevent accidental permanent deletion. Prefer inactive/archive.
- Permanent deletion is restricted to proven test, duplicate or erroneous records after dependency review and backup.

## 7. Bulk upload and change safety

Every import or bulk edit must:
- Validate file type, size, required headers, encoding and row count.
- Preserve original file and parsed preview for audit where appropriate.
- Normalize names for matching without overwriting the official display name.
- Match exact IDs internally where provided by a trusted export; otherwise use controlled name/alias matching.
- Flag ambiguous matches for human decision.
- Validate all company/division/brand/product/distributor references.
- Detect duplicate rows within the file and against production data.
- Display planned inserts, updates, skips and errors before approval.
- Preserve verified values when an incoming row is blank or lower quality.
- Never delete records because they are absent from an upload.
- Commit in a controlled transaction or safe batches with an import ID.
- Produce a downloadable import report and record who approved it.
- Support rollback or a documented compensating correction.

No user-facing upload should require internal IDs. Use readable names and dropdown-assisted matching wherever possible.

## 8. Data quality, provenance and audit

For important records and relationships, maintain:
- Source/provenance.
- Current lifecycle and verification status.
- Created and updated timestamps.
- Last verified/checked date and verifier.
- Change history with prior and new values.
- Submission/import ID where applicable.
- Administrator responsible for approval.

Corrections must not erase history. A correction report is a request, not an automatic update. Public claims must be supported by evidence.

## 9. Security, privacy and operational controls

- Enable and correctly configure RLS on exposed tables; RLS being enabled alone is not proof of safety.
- Public/anonymous roles must not create, edit, delete or publish canonical directory records.
- Only active, verified and correctly scoped data may be read publicly.
- Admin operations must verify the authenticated user's active admin record server-side; hiding UI controls is not security.
- Review every `SECURITY DEFINER` function for explicit admin checks, least-privilege execution grants and a fixed safe search path.
- Never embed service-role credentials in client code, SQL trigger definitions, public files, logs or repository content.
- Use server-side secrets for privileged operations. Rotate any privileged credential found hard-coded in database metadata or code, then replace the integration safely.
- Public upload buckets must not permit files that bypass admin review or expose private documents.
- Keep distributor-submission files private; only authorised admins should read them.
- Apply upload size/type restrictions, path restrictions, rate limits and retention rules.
- Do not expose submitter email/mobile or private file URLs on public profiles.
- Preserve admin audit logs and operational evidence.

## 10. Current production baseline — read-only audit

The following counts were observed during the initial read-only Supabase review on 1 November 2026. They are a snapshot and should be re-counted immediately before any data migration.

| Entity / measure | Observed count |
|---|---:|
| Companies | 766 |
| Divisions | 40 |
| Brands | 10 |
| Products | 1,208 |
| Distributors | 30 |
| Distributorship relationships | 1,261 |
| Verification records | 1,518 |
| Product-distributor rows | 0 |
| Company aliases | 38 |
| Division aliases | 1 |

Additional observations:
- 4 companies have `parent_company_id` set.
- 20 companies have `company_group_id` set.
- 597 products have a division; 0 products have a brand linked.
- 5 distributorships have a division; 0 have a brand linked.
- Company records: 737 active and 29 inactive.
- Distributors: 30 active.
- Distributorships: 1,256 active and 5 inactive.
- Distributorship verification states by lifecycle: 1,249 active + verified, **7 active + unverified**, 1 inactive + needs review, and 4 inactive + verified. The 7 active + unverified relationships are currently eligible under the existing public RLS rule because that rule checks only active lifecycle status; this is a confirmed policy violation that must be corrected before further public directory changes.
- No company/division mismatch was found in product-to-division relationships or distributorship-to-division relationships in the initial consistency checks.
- No duplicate distributorship groups were found using company, distributor, division, brand, category, location and normalized territory as the candidate key.
- No parent-company cycles were found in the current parent links. The database only prevents a company from being its own immediate parent; cycle prevention still needs to be enforced for future edits.
- A preliminary product duplicate scan found 19 candidate groups with the same company and normalized product name while strength, dosage form and pack size are blank. These are candidates for review, not confirmed duplicates; do not merge them automatically.
- One normalized company-name duplicate group was found for Cadila Healthcare Limited (two records). No automatic merge is authorised.
- The existing schema contains separate tables for companies, company groups, divisions, brands, products, distributors, distributorships, search aliases, verification records, distributor submissions, product submissions, correction reports, profile reviews, feedback and import staging. Current staging tables contain 154 company rows, 166 distributorship rows, 4 distributor rows, 1 division row and 18 import aliases; these are retained data and must be reconciled before any cleanup.
- Existing record lifecycle enums are simpler than the approved operating lifecycle. Existing verification enum values are verified, needs_review and unverified.
- The current public alias table contains 38 company aliases and 1 division alias. Its entity-type constraint permits company, division and distributor, but not brand or product.
- All inspected public tables had RLS enabled. Policies, grants and function permissions still require detailed security validation.
- Two storage buckets exist: a public directory-profile-images bucket and a private distributor-submission-files bucket. The latter currently has a public upload policy for an incoming folder and an authenticated read policy; this must be reconciled with Admin-only intake.
- A database trigger for distributor-submission notifications contains a hard-coded service-role JWT in its HTTP request configuration. Treat this credential as exposed to anyone with sufficient database metadata access; rotate it through Supabase project settings and replace the trigger authentication mechanism. Do not copy the token into tickets, code or chat.
- The Supabase security advisor reports six SECURITY DEFINER functions executable by authenticated users, disabled leaked-password protection, and an extension-in-public warning. Each finding needs a deliberate permissions/configuration review.
- Performance advisor reports duplicate and unused indexes and multiple permissive RLS policies. Do not remove indexes or combine policies solely to silence warnings; verify query plans and behaviour first.

### Important interpretation

These are observations, not approval to alter the database. In particular:
- `company_groups` must not be merged into `parent_company_id` without examining every existing reference and the intended business meaning.
- The Cadila duplicate must not be merged until its linked records and public URLs are mapped.
- `product_distributors` has zero rows and is not part of the standard workflow; retain the table pending dependency review.
- The verification record table is synchronised from distributorship changes by a trigger, so the authoritative verification field and history model must be decided before simplifying it.
- Current public read policies gate distributorships by active status, not by verified status. The 7 active + unverified relationships are therefore exposed to anonymous/authenticated reads under the current policy. This is a confirmed policy violation and requires a tested RLS/query correction.
- The distributor-submission publish function currently marks relationships active + verified when an administrator approves a distributor-submitted mapping. Approval of a self-submitted claim is not, by itself, independent verification. Under the approved policy, this path must be disabled or changed so the admin records evidence before a relationship becomes verified.
- The current admin interface exposes permanent-delete actions for companies, distributors and distributorships. The associated SECURITY DEFINER delete functions remove related products, relationships, divisions, aliases and/or submission records. This is broader than the approved default of archive/inactivate; deletion controls must be restricted pending dependency previews, backups and a reviewed recovery plan.
- The product-submission publish function can create product-level distributor mappings and marks them active + unverified. Product-level mapping is outside the standard workflow and must remain excluded from public directory presentation until separately approved.
- Current product profile code retrieves company-level distributorships without fully applying the division-scope rule. This requires correction before product/distributor presentation can be considered compliant.

## 11. Known website/database policy gaps

| Gap | Required outcome |
|---|---|
| Public distributor submission form and public submission upload path | Disable new public distributor intake; admin creates records. Retain historical records and correction reports. |
| Submission publishing auto-verifies distributor-submitted relationships | Do not equate admin approval of a self-submitted claim with independent verification; require evidence before setting verified. |
| Permanent-delete controls and cascading RPCs | Restrict destructive actions; default to inactive/archive. Require dependency preview, backup and recovery plan before exceptional deletion. |
| Product submission can create product-level distributor links | Keep product-level mapping outside standard workflow and prevent it from implying SKU stock or appearing publicly without separate approval. |
| Public distributorship read rule | Enforce active + verified + valid entity + explicit scope. |
| Product distributor retrieval | Respect company/division/optional brand scope; never imply stock. |
| Admin interface has many separate screens | Present four primary work areas while retaining necessary internal functionality. |
| Verification data duplicated across distributorship and verification records | Define one authoritative current state and a reliable audit/history model before changing fields or triggers. |
| Parent hierarchy and company groups both exist | Document and preserve distinct semantics until reconciled. |
| Search aliases currently observed only for company and division | Extend matching coverage only after defining canonical entity types and checking alias constraints. |
| Product-level distributor mapping exists in schema but has no rows | Keep out of routine workflow; do not remove without dependency review. |
| Public upload bucket policy permits incoming submissions | Reconcile permissions and file retention with Admin-only intake. |
| Hard-coded privileged token in notification trigger | Rotate credential and move authentication to a safe server-side secret/configuration mechanism. |
| SECURITY DEFINER functions have authenticated execute grants | Review each function's purpose, explicit admin checks, grants and call paths. |
| Duplicate/unused indexes and permissive policies | Optimise only after query-plan and security regression testing. |

## 12. Implementation sequence and release gates

### Phase 1 — Governance baseline
- This specification is the approved policy baseline.
- Record the decisions and scope.
- No production data changes.

### Phase 2 — Complete technical inventory
- Map every table, column, constraint, foreign key, index, trigger, function, grant, RLS policy and storage policy.
- Inspect all relevant frontend components and workflows.
- Compare migrations in GitHub with the live production schema.
- Identify unused, duplicated and overlapping systems.
- Reconcile current record counts and status intersections.

**Exit gate:** a complete database-to-policy map and a prioritised gap report.

### Phase 3 — Safety and backup plan
- Confirm GitHub main commit and create a working branch.
- Export/backup production data and schema using supported Supabase backup/export facilities.
- Confirm recovery/rollback path.
- Rotate the hard-coded privileged credential and safely replace the notification integration.
- Test proposed RLS and function changes in a development/staging environment or branch where available.

**Exit gate:** recoverable backup, credential remediation plan and tested migration plan.

### Phase 4 — Minimum database corrections
- Enforce public visibility policy.
- Resolve verification source-of-truth and audit model.
- Validate relationship constraints and duplicate handling.
- Restrict public intake and storage access according to approved policies.
- Preserve all existing records and history.

**Exit gate:** integrity checks pass and no unintended data loss.

### Phase 5 — Admin workflow simplification
- Four primary work areas.
- Clear company hierarchy and distributor profile workflows.
- One safe bulk-upload pipeline with preview and import report.
- One verification/corrections queue.

**Exit gate:** a non-technical administrator can complete routine tasks without UUIDs, SQL or manual database intervention.

### Phase 6 — Public directory and search
- Company/distributor-first profile presentation.
- Explicit company/division/brand scope labels.
- Verified-only public relationships.
- Exact/alias/partial search and deduplicated results.
- Mobile and desktop QA.

**Exit gate:** no unverified/inactive records leak into public results, profiles, counts or SEO pages.

### Phase 7 — Engagement and quality assurance
- Call, WhatsApp, Maps and website actions.
- Aggregate engagement measurement.
- Rate limiting and correction reporting.
- Test access roles, uploads, mobile layouts, search edge cases, SEO and deployment.

**Exit gate:** end-to-end test report and verified production release.

## 13. Release acceptance checklist

A release is not complete until all relevant checks pass:

- [ ] No canonical duplicates are created by spelling/spacing variations.
- [ ] Parent/company/division/brand/product links obey hierarchy constraints.
- [ ] Distributorships are explicit and do not inherit automatically.
- [ ] Only active, verified relationships with active entities appear publicly.
- [ ] Company-level and division-level relationships are labelled accurately.
- [ ] No public page implies live SKU stock or guaranteed delivery.
- [ ] Public users cannot create or publish distributors or distributorships.
- [ ] Correction reports enter a review queue and cannot directly edit canonical data.
- [ ] Admin-only actions are protected by server-side authorisation and RLS.
- [ ] No service-role secret is present in frontend assets, Git history, SQL trigger definitions or logs.
- [ ] Upload preview, duplicate matching, approval, audit and rollback work.
- [ ] No upload silently deletes records missing from the file.
- [ ] Search prioritises exact matches, deduplicates canonical records and respects publication rules.
- [ ] Contact actions work on mobile and desktop.
- [ ] Public and admin interfaces are responsive and readable.
- [ ] Existing records, profile URLs and SEO routes are preserved or redirected deliberately.
- [ ] Backup, migration and rollback procedures are documented.
- [ ] Post-deployment smoke tests and data reconciliation pass.

---

**Change control:** Any future change to this specification must include a version number, date, reason, affected policy/data/workflow, impact assessment and approval. The approved policy baseline must not be silently changed during implementation.
