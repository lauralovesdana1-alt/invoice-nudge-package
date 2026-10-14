# Invoice Reminders — One-Sitting Setup Guide

Installs the automatic invoice-reminder system for your two open invoices:
**Apple $30,000** (INV-2026-0921, due Oct 21) and **Amazon $55,000** (INV-2026-0925, due Oct 25).

The system only ever creates Gmail **drafts**. Nothing sends on its own — you review and send each reminder yourself. If a client replies about an invoice, reminders for it stop automatically.

**Time needed:** about 10 minutes. Two of the steps are yours alone (signing in to authorize the script, and pasting your payment link when you have it).

---

## The clicks, in order

**1. Create the project.**
Go to script.google.com → **New project**. Rename it `Invoice Nudges`.

**2. Paste the script.**
In the editor you'll see a starter file. Select everything in it, delete it, then paste the entire contents of `InvoiceNudge.gs` (the file next to this guide). Press **Ctrl/Cmd + S** to save.

**3. Dry-run first (recommended).**
Leave `DRY_RUN = true` at the top of the file for now — it comes that way.

**4. Run it once and authorize.**
Click **Run** (▶) with `runInvoiceNudges` selected in the function dropdown. Google will ask you to authorize the script — this is your click, in your own Google account: choose your account → Advanced → Go to Invoice Nudges → Allow. It needs Gmail and Sheets access to do its job.

**5. Check the rehearsal.**
Open **Executions** (clock icon, left sidebar) and read the latest run's log. With `DRY_RUN = true` you'll see lines like `[DRY_RUN] would draft …` and no draft is created in Gmail. That proves the logic runs cleanly before anything real happens.

**6. Go live.**
Back in the editor, change `DRY_RUN = true` to `DRY_RUN = false` and save.

**7. Put it on a daily schedule.**
Click **Triggers** (clock icon) → **Add Trigger** → choose `runInvoiceNudges` → event source **Time-driven** → **Day timer** → pick a morning hour (7–8 AM works). Save.

**8. Done.** Every morning the system checks both invoices and drafts any reminder that's due. You review each draft in Gmail before sending.

---

## 💳 Payment link — the one spot to fill in

Near the top of the script you'll see this block:

```
**PAYMENT RAIL — bank wire (decided 2026-10-03).** No pay-now link: the
invoice itself carries the bank account details. The old `PAYMENT_LINK`
config is retired — leave it empty. If a pay-now link ever becomes viable
(US LLC + Stripe, or PayPal+Paga), reintroduce it here with a one-line swap.

### The 3-step payment block (new 2026-10-03 — cuts payment friction)

Near the top of the script you'll see `WIRE_DETAILS` (empty backticks).
Paste your wire instructions between the backticks, exactly as on your
invoices, one item per line — for example:

```
Beneficiary: Dara Godmade
Account: 0123456789
Bank: Access Bank Plc
SWIFT: ABNGNGLA
```

(Use your real details — the example numbers above are placeholders.)

Paste it **once** and every reminder draft carries a "Pay in 3 steps" block:
the amount, your wire details, the invoice reference, and a request for the
remittance slip — so AP can pay without emailing you back for banking details
first. That's the whole point: when bills pile up, the easiest one gets paid
first. Leave `WIRE_DETAILS` empty and drafts keep the old "details are on the
invoice" line.

---

## 🛑 Kill switch — one step stops everything

Set this line at the top of the script:

```js
var NUDGE_ENABLED = false;
```

…and press save. The next scheduled run logs "kill switch on" and exits. Nothing drafts, nothing sends. Set it back to `true` to resume. (Deleting the daily trigger in step 7 stops it too — the switch is the faster path.)

---

## 🧪 Dry-run test plan (prove it fires before going live)

Do this once, with `DRY_RUN = true`:

1. Run `runInvoiceNudges` manually (step 4 above).
2. Open **Executions** → latest run → read the log.
3. Confirm you see `[DRY_RUN] would draft …` lines and **no new draft** appears in your Gmail Drafts.
4. Confirm there's a row for each invoice in the auto-created **"Invoice Nudges — State"** spreadsheet (it appears in your Google Drive after the first run). Dry-run rows show action **dry-run** — never `drafted` or `expired`. That's the safety contract: a rehearsal is visible in the sheet but never marks a milestone as handled, so flipping to live still drafts everything that's due.

Then flip `DRY_RUN` to `false`, save, and run once more manually. This time exactly **one real draft** should appear in Gmail Drafts (the due milestone for one invoice), and the log should say `DRAFTED …`. Review it, then delete it or keep it — it's a real draft now, addressed to the real contact, so treat it like one.

A dry-run draft was already created for you against the Apple invoice thread as a preview — it's labeled **[DRY RUN — TEST — DO NOT SEND]** and is safe to delete.

---

## What each reminder says

| When (days after invoice sent) | Subject | The one ask |
|---|---|---|
| Day 0 | `Invoice INV-… ($…) — confirming receipt` | Confirm it's in your AP queue |
| Day 7 | `$… invoice — in your AP queue?` | Is it queued for payment? |
| Day 14 | `$… invoice — need a payment date` | What's the expected payment date? (flags the 1.5%/mo late fee early) |
| Day 37 | `$… invoice INV-… — 37 days, work pauses` | Work pauses until current; late fee now applies |

Milestones more than 2 days past are marked **expired**, never chased late. If the client replies about the invoice, that invoice's reminders **stand down** and the run log flags it for your eyes.

---

## ⚠️ One timing note

A separate day-7 chase for the **Amazon** invoice is already scheduled for **Oct 2 at 8:37 AM**. If you go live before then, the system will also draft its own day-7 reminder on Oct 2 and you'll get two drafts. Simplest path: keep `DRY_RUN = true` until after the Oct 2 chase goes out, then flip it to `false`.
