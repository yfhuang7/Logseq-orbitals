/**
 * ORBITALS GMAIL BRIDGE — connects Gmail to the "Orbitals" Logseq plugin (by yfhuang7).
 * ---------------------------------------------------------------------
 * How it works:
 *   1. In Gmail, you apply the label "logseq" to any email that should become a task.
 *   2. This tiny script (running in YOUR Google account) hands those emails
 *      to the Logseq plugin as JSON when the plugin asks for them.
 *   3. After handing an email over, it swaps the label to "logseq/added"
 *      so the same email is never imported twice.
 *
 * Setup: see README.md ("Connect Gmail") — ~10 minutes, copy-paste only.
 *
 * IMPORTANT: change the SECRET below to your own random text before deploying.
 */

var LABEL = 'logseq';          // label you apply in Gmail
var DONE_LABEL = 'logseq/added'; // label after import (created automatically)
var SECRET = 'change-me-to-something-random'; // <-- CHANGE THIS

// Which Google Calendars to sync. Empty [] = your default calendar only.
// To pick specific ones, list their names, e.g.: ['Work', 'Family', 'yfhuang@gmail.com']
// (Open <your-bridge-url>&action=calendars in a browser to see all your calendar names.)
var CALENDARS = [];

function doGet(e) {
  var p = (e && e.parameter) || {};
  if ((p.key || '') !== SECRET) return json_({ error: 'wrong or missing key' });
  if (p.action === 'events') return json_(listEvents_());
  if (p.action === 'calendars') {
    return json_({ calendars: CalendarApp.getAllCalendars().map(function (c) { return c.getName(); }) });
  }
  return json_(listEmails_());
}

/** Upcoming Google Calendar events (next 6 weeks, read-only) for the Calendar view. */
function listEvents_() {
  var start = new Date();
  start.setHours(0, 0, 0, 0);
  var end = new Date(start);
  end.setDate(end.getDate() + 42);
  var tz = Session.getScriptTimeZone();
  var cals = [];
  if (CALENDARS.length) {
    CALENDARS.forEach(function (n) { cals = cals.concat(CalendarApp.getCalendarsByName(n)); });
  }
  if (!cals.length) cals = [CalendarApp.getDefaultCalendar()];
  var out = [];
  cals.forEach(function (cal) {
    cal.getEvents(start, end).slice(0, 150).forEach(function (ev) {
      out.push({
        title: ev.getTitle() || '(no title)',
        date: Utilities.formatDate(ev.getStartTime(), tz, 'yyyy-MM-dd'),
        time: ev.isAllDayEvent() ? '' : Utilities.formatDate(ev.getStartTime(), tz, 'HH:mm'),
        end: ev.isAllDayEvent() ? '' : Utilities.formatDate(ev.getEndTime(), tz, 'HH:mm'),
        allDay: ev.isAllDayEvent(),
        cal: cal.getName()
      });
    });
  });
  return { events: out.slice(0, 300) };
}

function listEmails_() {
  var label = GmailApp.getUserLabelByName(LABEL);
  if (!label) {
    return { emails: [], note: 'No "' + LABEL + '" label found in Gmail yet. Create it and apply it to an email.' };
  }
  var done = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var threads = label.getThreads(0, 20);
  var out = [];
  threads.forEach(function (th) {
    try {
      var msg = th.getMessages()[0];
      out.push({
        id: msg.getId(),
        from: msg.getFrom().replace(/<.*>/, '').replace(/"/g, '').trim(),
        subject: th.getFirstMessageSubject() || '(no subject)',
        date: Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        snippet: (msg.getPlainBody() || '').replace(/\s+/g, ' ').trim().slice(0, 300),
        link: 'https://mail.google.com/mail/u/0/#all/' + msg.getId()
      });
      th.removeLabel(label);
      th.addLabel(done);
    } catch (err) { /* skip a broken thread rather than failing the whole sync */ }
  });
  return { emails: out };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Optional: run this once from the editor (▶ Run) to test without deploying. */
function testList() {
  Logger.log(JSON.stringify(listEmails_(), null, 2));
}
