# Invoice Nudge Package

A draft-only invoice reminder cadence for Google Apps Script: day-0/7/14/37 nudges with stand-down on reply and a kill-switch. Built for my own $105K collections pipeline.

## What it does

- **Day 0** — polite due-date reminder (the only touch that auto-sends)
- **Day 7 / 14 / 37** — escalating drafts, never sent without human review
- **Stand-down on reply** — any client reply pauses the sequence and hands to a person
- **Kill switch** — `NUDGE_ENABLED=false` stops everything instantly
- **Dispute detection** — dispute keywords kill the sequence and route to the owner within 24h

## Philosophy

Only Touch 1 auto-sends. Touches 3–5 are drafts pending human review. The +14-day reminder leads with the work pause, not the late fee — the fee hits finance people who didn't cause the delay; the pause is what moves them.

## Files

- `InvoiceNudge.gs` — the full Apps Script source
- `SETUP-GUIDE.md` — install guide: authorize in your own Google account, flip `DRY_RUN` to false, add the daily trigger

## About the author

Built by **Dara Godmade** — I build custom software and automation for professional-services firms.

- Work with me: https://dara-godmade.b12sites.com
- Email: Dara.godmade@gmx.com
