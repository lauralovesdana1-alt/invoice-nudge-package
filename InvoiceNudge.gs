/***************************************************************
 * InvoiceNudge.gs — automatic invoice reminders (DRAFTS ONLY)
 *
 * What it does, once a day:
 *   - Checks each invoice below at its day-0 / 7 / 14 / 37 milestones.
 *   - If a milestone is due and nothing already covers it, writes a
 *     Gmail DRAFT reminder for Dara to review and send himself.
 *   - Skips (and flags) any invoice whose contact replied recently —
 *     nudges pause the moment the client engages.
 *
 * What it NEVER does:
 *   - It never sends email. There is no send call anywhere in this file.
 *   - It never back-drafts: milestones more than 2 days past are marked
 *     expired, not chased late.
 *   - It never touches any invoice except the two listed below.
 *
 * INSTALL (one sitting, ~10 minutes):
 *   1. Go to script.google.com, New project, name it "Invoice Nudges".
 *   2. Delete the starter Code.gs contents, paste this whole file, Save.
 *   3. Run runInvoiceNudges once and authorize it (Dara's own click).
 *   4. Do the dry run in the setup guide, then flip DRY_RUN to false.
 *   5. Add a daily trigger (Triggers → Add trigger → runInvoiceNudges →
 *      Time-driven → Day timer → e.g. 7–8 AM).
 *
 * KILL SWITCH: set NUDGE_ENABLED = false and Save. Everything stops.
 ***************************************************************/

/* ================= CONFIG — the only block Dara edits ================= */

var NUDGE_ENABLED = true;  // <-- KILL SWITCH. Set to false and Save to stop everything.
var DRY_RUN = true;        // <-- true = rehearse only: logs what it WOULD draft, creates nothing,
                           //     and writes 'dry-run' (never 'drafted') to the state sheet, so the
                           //     later live run still processes every milestone for real.
                           //     Flip to false only after the dry run in the setup guide.

var SENDER_NAME = 'Dara Godmade';
var TIMEZONE = 'America/Chicago';

/* >>> PAYMENT LINK — paste the real link between the quotes. <<<
 * One-line swap whenever Dara has it. Until then, every reminder draft
 * carries a clearly-marked placeholder line instead of a link. */
var PAYMENT_LINK = '';   // RETIRED 2026-10-03: bank wire is the rail (Dara's decision). Leave empty.

/* >>> WIRE DETAILS — paste your wire instructions between the backticks,
 * exactly as they appear on your invoices (beneficiary name, account number,
 * bank name, SWIFT/BIC, one per line). Paste ONCE: every reminder draft then
 * carries the details inline, so AP can pay without a reply-and-wait round
 * trip. Leave empty to keep the old "details are on the invoice" line. */
var WIRE_DETAILS = ``;

/* Only these two invoices. Adding another invoice is a separate decision. */
var INVOICES = [
  { id: 'INV-2026-0921', client: 'Apple',
    contact: 'Sam', email: 'sam@apple.com',
    amount: 30000, sentDate: '2026-09-21', dueDate: '2026-10-21' },
  { id: 'INV-2026-0925', client: 'Amazon',
    contact: 'Robert Thompson', email: 'robert.thompson@amazon.com',
    amount: 55000, sentDate: '2026-09-25', dueDate: '2026-10-25' }
];

/* Days after the invoice sent date that each reminder goes out. */
var MILESTONES = [0, 7, 14, 37];

/* ================= ENGINE — no edits needed below ================= */

function runInvoiceNudges() {
  if (!NUDGE_ENABLED) {
    Logger.log('NUDGE_ENABLED is false — kill switch on. Nothing ran.');
    return;
  }
  Logger.log('--- runInvoiceNudges ' + todayStr_() +
             (DRY_RUN ? ' [DRY_RUN — nothing will be created]' : '') + ' ---');

  var sh = sheetTab_('Invoices', ['date', 'invoice_id', 'client', 'milestone',
                                  'milestone_date', 'action', 'detail']);
  var logged = {};
  sh.getDataRange().getValues().forEach(function (r) {
    if (r[1] !== '' && r[3] !== '') logged[r[1] + '|' + r[3]] = r[5];
  });
  var today = todayStr_();

  INVOICES.forEach(function (inv) {
    try {
      MILESTONES.forEach(function (m) {
        var mDate = addDaysStr_(inv.sentDate, m);
        var key = inv.id + '|' + m;
        var row = [today, inv.id, inv.client, m, mDate, '', ''];

        // Skip only if a REAL (non-dry-run) run already handled this milestone.
        // Dry runs log action='dry-run', which never blocks the later live run.
        if (logged[key] && logged[key] !== 'dry-run') return;
        if (mDate > today) return;                  // milestone is in the future
        if (daysBetween_(mDate, today) > 2) {       // too far past: expire, never back-draft
          logRow_(sh, row, 'expired',
                  'Milestone passed before install — left for Dara to judge, not chased late.');
          return;
        }
        if (milestoneCoveredInGmail_(inv, mDate)) {
          logRow_(sh, row, 'covered',
                  'Found matching sent mail or an open draft in Gmail — no new draft.');
          return;
        }
        if (contactReplied_(inv)) {                 // STAND-DOWN: client engaged
          logRow_(sh, row, 'reply-detected',
                  inv.contact + ' replied recently — no chase drafted; needs Dara\'s eyes.');
          Logger.log('STAND DOWN for ' + inv.id + ': recent reply from ' + inv.contact);
          return;
        }

        var draft = buildMilestoneDraft_(inv, m);
        var created = createDraftOnly_(inv.email, draft.subject, draft.body);
        logRow_(sh, row, 'drafted',
                'Draft "' + draft.subject + '" to ' + inv.email + '.');
        Logger.log((created ? 'DRAFTED' : '[DRY_RUN] would draft') +
                   ' day-' + m + ' for ' + inv.id + ' (' + inv.client + '): ' + draft.subject);
      });
    } catch (e) {
      Logger.log('Invoice ' + inv.id + ' FAILED (skipped, will retry tomorrow): ' + e.message);
    }
  });
  Logger.log('runInvoiceNudges done.');
}

/** Build the reminder for one milestone, in Dara's specific-ask voice. */
function buildMilestoneDraft_(inv, m) {
  var first = inv.contact.split(' ')[0];
  var amt = money_(inv.amount);
  var sentH = humanDate_(inv.sentDate);
  var dueH = humanDate_(inv.dueDate);
  var payLine = payBlock_(inv);
  var subject, body;

  if (m === 0) {
    subject = 'Invoice ' + inv.id + ' (' + amt + ') — confirming receipt';
    body = first + ' — confirming you received invoice ' + inv.id + ' for ' + amt +
      ', sent ' + sentH + ', due ' + dueH + ' (Net 30).\n\n' +
      'Quick reply to confirm it\'s in your AP queue — or point me to whoever owns it.\n\n' +
      payLine + '\n\nBest,\nDara';
  } else if (m === 7) {
    subject = amt + ' invoice — in your AP queue?';
    body = first + ' — checking in on invoice ' + inv.id + ' for ' + amt +
      ', sent ' + sentH + ', due ' + dueH + ' (Net 30).\n\n' +
      'Is it in your AP queue? If there\'s an approval step I can help with, tell me who to call.\n\n' +
      payLine + '\n\nBest,\nDara';
  } else if (m === 14) {
    subject = amt + ' invoice — need a payment date';
    body = first + ' — the ' + amt + ' invoice (' + inv.id + ') went out ' + sentH +
      ' and I haven\'t heard back since. Due date is ' + dueH + ' (Net 30).\n\n' +
      'What\'s the expected payment date on your end?\n\n' +
      payLine + '\n\n' +
      'Flagging early so there are no surprises: my terms add 1.5% per month (simple) ' +
      'on balances unpaid after 30 days. We\'re not there yet — I\'d like to keep it that way. ' +
      'If there\'s a holdup on your side, tell me and we\'ll work it out.\n\nBest,\nDara';
  } else { // day 37 — work pauses per the locked terms
    subject = amt + ' invoice ' + inv.id + ' — 37 days, work pauses';
    body = first + ' — invoice ' + inv.id + ' for ' + amt + ' (sent ' + sentH +
      ', due ' + dueH + ') is now 37 days old.\n\n' +
      'Per my standard terms, work pauses until the account is current, and the 1.5% ' +
      'monthly late fee now applies. I don\'t want this to sit — what\'s the payment date?\n\n' +
      payLine + '\n\nBest,\nDara';
  }
  return { subject: subject, body: body };
}

/**
 * Three-step payment block (the "hard-to-pay bills get paid late" fix):
 * amount + wire details + reference in one place, so AP pays without a
 * reply round-trip. Falls back to the invoice line when WIRE_DETAILS is empty.
 */
function payBlock_(inv) {
  var amt = money_(inv.amount);
  if (!WIRE_DETAILS || !String(WIRE_DETAILS).trim()) {
    return 'Payment is by bank wire to the account details on the invoice' +
      ' — reply here if you need the details resent.';
  }
  return 'Pay in 3 steps:\n' +
    '1. Wire ' + amt + ' to:\n' + String(WIRE_DETAILS).trim() + '\n' +
    '2. Reference: ' + inv.id + '\n' +
    '3. Reply here with the remittance slip — I\'ll confirm receipt the same day.';
}

/* ---------------- Safety checks ---------------- */

/** True if Gmail already shows a sent chase or an open draft for this milestone. */
function milestoneCoveredInGmail_(inv, mDate) {
  try {
    var sent = GmailApp.search('in:sent "' + inv.id + '" newer_than:60d', 0, 10);
    for (var i = 0; i < sent.length; i++) {
      var msgs = sent[i].getMessages();
      for (var j = 0; j < msgs.length; j++) {
        var d = Utilities.formatDate(msgs[j].getDate(), TIMEZONE, 'yyyy-MM-dd');
        if (Math.abs(daysBetween_(mDate, d)) <= 3) return true;
      }
    }
  } catch (e) { Logger.log('sent-mail dedupe failed (non-fatal): ' + e.message); }
  return draftExistsWith_(inv.id, inv.email);
}

/** True if the contact emailed about the invoice in the last 14 days → stand down. */
function contactReplied_(inv) {
  try {
    var hits = GmailApp.search('from:' + inv.email + ' "' + inv.id + '" newer_than:14d', 0, 3);
    return hits.length > 0;
  } catch (e) {
    Logger.log('reply check failed (non-fatal): ' + e.message);
    return false;
  }
}

/** Any open Gmail draft whose subject contains this invoice id and is addressed to the contact. */
function draftExistsWith_(subjectFragment, toFragment) {
  try {
    var drafts = GmailApp.getDrafts();
    for (var i = 0; i < drafts.length; i++) {
      var msg = drafts[i].getMessage();
      if (msg.getSubject().indexOf(subjectFragment) >= 0 &&
          (!toFragment || msg.getTo().toLowerCase().indexOf(toFragment.toLowerCase()) >= 0)) {
        return true;
      }
    }
  } catch (e) { Logger.log('draft check failed (non-fatal): ' + e.message); }
  return false;
}

/* ---------------- Draft creation (never sends) ---------------- */

/**
 * Creates a Gmail draft. Honors DRY_RUN.
 * There is deliberately no send function anywhere in this file.
 */
function createDraftOnly_(to, subject, body) {
  if (DRY_RUN) {
    Logger.log('[DRY_RUN] would DRAFT to ' + to + ' | subject: ' + subject);
    return false;
  }
  var d = GmailApp.createDraft(to, subject, body, { name: SENDER_NAME });
  return true;
}

/* ---------------- State log ---------------- */

/**
 * Record a milestone outcome in the state sheet.
 * Dry runs NEVER advance persistent state: they log action='dry-run'
 * (visible in the sheet for rehearsal) and the skip-check in
 * runInvoiceNudges ignores 'dry-run' rows — so a later live run still
 * processes every milestone for real. This is the whole safety contract.
 */
function logRow_(sh, row, action, detail) {
  if (DRY_RUN) {
    row[5] = 'dry-run';
    row[6] = '[dry run — no state change] Would have been "' + action + '": ' + detail;
  } else {
    row[5] = action;
    row[6] = detail;
  }
  sh.appendRow(row);
}

function sheetTab_(name, headers) {
  var ss = stateSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headers) sh.appendRow(headers);
  return sh;
}

function stateSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('STATE_SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through, recreate */ }
  }
  var ss = SpreadsheetApp.create('Invoice Nudges — State');
  props.setProperty('STATE_SPREADSHEET_ID', ss.getId());
  Logger.log('Created state spreadsheet: ' + ss.getUrl());
  return ss;
}

/* ---------------- Date / money helpers ---------------- */

function todayStr_() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function addDaysStr_(ymd, days) {
  var p = ymd.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
}

function daysBetween_(a, b) {
  var pa = a.split('-'), pb = b.split('-');
  var da = new Date(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2]));
  var db = new Date(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2]));
  return Math.round((db - da) / 86400000);
}

function humanDate_(ymd) {
  var p = ymd.split('-');
  var months = ['January','February','March','April','May','June','July',
                'August','September','October','November','December'];
  return months[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0];
}

function money_(n) {
  return '$' + Number(n).toLocaleString('en-US');
}
