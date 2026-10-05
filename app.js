import { API_URL, REPO_URL, issueKind, issueProgress, similarIssues, displayTitle, prepareIssue, validateDraft, filterIssues, safeIssueUrl } from './feedback.mjs';

const $ = selector => document.querySelector(selector);
const state = { issues: [], kind: 'all', status: 'open', query: '', page: 1, hasMore: false, loading: false, loaded: false, syncedAt: null, lastAttempt: 0 };
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const cacheKey = 'living-industry-public-feedback-v1';
let lastIssueNumber;
let lastIssueSource = 'board';

function textElement(tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}
function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}
function feedbackTag(kind) {
  return textElement('span', kind === 'bug' ? 'Bug' : kind === 'idea' ? 'Idea' : 'Feedback', `tag ${kind}`);
}

function appendProgress(container, issue) {
  const progress = issueProgress(issue);
  if (progress) container.append(textElement('span', progress.text, `tag progress-${progress.style}`));
}

function renderSimilar() {
  const matches = similarIssues(state.issues, $('#title').value, $('input[name="kind"]:checked').value);
  $('#similar-feedback').hidden = matches.length === 0;
  $('#similar-summary').textContent = matches.length ? `${matches.length} similar ${matches.length === 1 ? 'report' : 'reports'} to check` : '';
  const list = $('#similar-list');
  list.replaceChildren();
  for (const issue of matches) {
    const button = textElement('button', '', 'similar-report');
    button.type = 'button';
    button.dataset.issueNumber = String(issue.number);
    button.append(textElement('span', displayTitle(issue.title)), textElement('small', `#${issue.number} · ${issue.state === 'closed' ? 'Closed' : 'Open'}`));
    button.addEventListener('click', () => { lastIssueNumber = issue.number; lastIssueSource = 'similar'; openIssue(issue); });
    list.append(button);
  }
}
let similarTimer;
$('#title').addEventListener('input', () => { clearTimeout(similarTimer); similarTimer = setTimeout(renderSimilar, 250); });

// Floating bug/idea icons shown when the type changes or a draft is prepared.
const bubbleIcons = {
  bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M9 5 7 3m8 2 2-2M8 10H4m12 0h4M8 14H3m13 0h5M8 18l-3 2m11-2 3 2"/><rect x="8" y="7" width="8" height="14" rx="4"/><path d="M10 7V5h4v2m-2 4v7"/></svg>',
  idea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Zm1 6h6m-5 2h4m-2-6v-5m-2-1 2 1 2-1"/></svg>'
};
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
function clearBubbles() { document.querySelectorAll('.feedback-bubble').forEach(bubble => bubble.remove()); }
motionPreference.addEventListener('change', clearBubbles);
function animateFeedback(anchor, kind, count = 1) {
  if (motionPreference.matches) return;
  clearBubbles();
  const rect = anchor.getBoundingClientRect();
  for (let index = 0; index < count; index++) {
    const bubble = document.createElement('span');
    bubble.className = `feedback-bubble ${kind}`;
    bubble.setAttribute('aria-hidden', 'true');
    bubble.innerHTML = bubbleIcons[kind];
    const spread = (index - (count - 1) / 2) * 24;
    bubble.style.left = `${Math.max(20, Math.min(window.innerWidth - 20, rect.left + rect.width / 2 + spread))}px`;
    bubble.style.top = `${Math.max(70, rect.top + 10)}px`;
    bubble.style.setProperty('--drift', `${spread * 0.65}px`);
    bubble.style.animationDelay = `${index * 45}ms`;
    document.body.append(bubble);
    bubble.addEventListener('animationend', () => bubble.remove(), { once: true });
    setTimeout(() => bubble.remove(), 1000);
  }
}

function renderBoard() {
  const visible = filterIssues(state.issues, state);
  const list = $('#issue-list');
  list.replaceChildren();
  for (const issue of visible) {
    const row = textElement('button', '', 'issue-row');
    row.type = 'button';
    row.dataset.issueNumber = String(issue.number);
    const content = document.createElement('span');
    content.append(textElement('span', displayTitle(issue.title), 'issue-title'));
    const meta = textElement('span', '', 'issue-tags');
    meta.append(feedbackTag(issueKind(issue)), textElement('span', `#${issue.number}`), textElement('span', dateLabel(issue.created_at)));
    appendProgress(meta, issue);
    if (issue.comments > 0) meta.append(textElement('span', `${issue.comments} ${issue.comments === 1 ? 'reply' : 'replies'}`));
    content.append(meta);
    row.append(content, textElement('span', issue.state === 'closed' ? 'Closed' : 'Open', `state ${issue.state}`));
    row.addEventListener('click', () => { lastIssueNumber = issue.number; lastIssueSource = 'board'; openIssue(issue); });
    list.append(row);
  }
  const empty = state.loaded && visible.length === 0;
  $('#board-empty').hidden = !empty;
  const filtered = state.hasMore || state.issues.length > 0 || state.kind !== 'all' || state.status !== 'open' || state.query;
  $('#empty-title').textContent = filtered ? 'No matching feedback.' : 'The board is open.';
  $('#empty-description').textContent = filtered
    ? `Try another filter${state.hasMore ? ' or load more reports' : ''}, or share something new.`
    : 'Be the first to report a bug or share an idea for Living Industry.';
  $('#load-more').hidden = !state.hasMore;
  $('#load-more').disabled = state.loading;
  $('#refresh').disabled = state.loading;
  if (state.syncedAt) {
    const time = new Date(state.syncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    $('#sync-status').textContent = `${state.hasMore ? 'Recent feedback · ' : ''}Updated ${time} · GitHub Issues`;
  }
  renderSimilar();
}

function showBoardMessage(message, error = false) {
  const element = $('#board-message');
  element.textContent = message;
  element.classList.toggle('error', error);
}

async function loadIssues({ more = false } = {}) {
  if (state.loading) return;
  const now = Date.now();
  if (!more && now - state.lastAttempt < 5000) return;
  state.lastAttempt = now;
  state.loading = true;
  renderBoard();
  showBoardMessage(state.loaded ? 'Updating feedback…' : 'Loading feedback from GitHub…');
  const page = more ? state.page + 1 : 1;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_URL}/issues?state=all&sort=created&direction=desc&per_page=50&page=${page}`, {
      // Skip the HTTP cache so Refresh picks up issues filed in the last minute.
      cache: 'no-store', headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal
    });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) throw new Error('GitHub is limiting requests for now. Please try again later or open the board on GitHub.');
      throw new Error('We couldn’t load feedback right now. Please try again or open the board on GitHub.');
    }
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('GitHub returned an unexpected response. Please try again.');
    const issues = data.filter(issue => !issue.pull_request && Number.isSafeInteger(issue.number));
    const merged = more ? [...state.issues, ...issues] : issues;
    state.issues = [...new Map(merged.map(issue => [issue.number, issue])).values()];
    state.page = page;
    state.hasMore = !!response.headers.get('link')?.includes('rel="next"');
    state.loaded = true;
    state.syncedAt = Date.now();
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ issues: state.issues, page, hasMore: state.hasMore, syncedAt: state.syncedAt })); } catch { /* sessionStorage blocked or full */ }
    showBoardMessage('');
  } catch (error) {
    const message = error.name === 'AbortError' ? 'GitHub took too long to respond. Please try again or open the board on GitHub.' : error.message;
    showBoardMessage(`${state.loaded ? 'Showing previously loaded feedback. ' : ''}${message}`, true);
  } finally {
    clearTimeout(timeout);
    state.loading = false;
    renderBoard();
  }
}

// Turns the "### Heading" and "---" lines written by the form into elements.
// Everything else goes through textContent, so an issue body can't inject HTML.
function formatIssueBody(body) {
  const text = String(body || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return [textElement('p', 'No additional details were provided.')];
  return text.split(/\n{2,}/).flatMap(block => {
    const heading = block.match(/^#{1,6}\s+(.+)$/s);
    if (heading && !heading[1].includes('\n')) return [textElement('h3', heading[1].trim())];
    const rule = block.match(/^(?:-{3,}|\*{3,}|_{3,})(?:\n|$)/);
    if (!rule) return [textElement('p', block)];
    const rest = block.slice(rule[0].length).trim();
    return rest ? [document.createElement('hr'), textElement('p', rest)] : [document.createElement('hr')];
  });
}

function openIssue(issue) {
  const meta = $('#issue-meta');
  meta.replaceChildren(feedbackTag(issueKind(issue)), textElement('span', `#${issue.number} · ${issue.state === 'closed' ? 'Closed' : 'Open'}`));
  appendProgress(meta, issue);
  $('#issue-heading').textContent = displayTitle(issue.title);
  $('#issue-author').textContent = `Opened by ${issue.user?.login || 'a community member'} · ${dateLabel(issue.created_at)}`;
  $('#issue-body').replaceChildren(...formatIssueBody(issue.body));
  $('#issue-replies').textContent = `${issue.comments || 0} ${(issue.comments || 0) === 1 ? 'reply' : 'replies'} on GitHub`;
  $('#issue-github').href = safeIssueUrl(issue);
  $('#issue-dialog').showModal();
}
$('#close-issue').addEventListener('click', () => $('#issue-dialog').close());
$('#issue-dialog').addEventListener('close', () => {
  const trigger = [...document.querySelectorAll(lastIssueSource === 'similar' ? '.similar-report' : '.issue-row')].find(row => row.dataset.issueNumber === String(lastIssueNumber));
  (trigger || $(lastIssueSource === 'similar' ? '#title' : '#search')).focus();
});
$('#issue-dialog').addEventListener('click', event => {
  if (event.target !== event.currentTarget) return;
  const rect = event.currentTarget.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
});
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  state.kind = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
  renderBoard();
}));
$('#status-filter').addEventListener('change', event => { state.status = event.target.value; renderBoard(); });
$('#search').addEventListener('input', event => { state.query = event.target.value; renderBoard(); });
$('#refresh').addEventListener('click', () => loadIssues());
$('#load-more').addEventListener('click', () => loadIssues({ more: true }));
$('#empty-action').addEventListener('click', () => { $('#feedback-form').scrollIntoView({ block: 'center', behavior: 'auto' }); $('#title').focus({ preventScroll: true }); });
$('.mobile-feedback').addEventListener('click', event => { event.preventDefault(); $('#feedback-form').scrollIntoView({ block: 'start' }); $('#title').focus({ preventScroll: true }); });

function clearPreparedDraft() {
  $('#form-message').textContent = '';
  $('#long-report').hidden = true;
  $('#prepared-body').value = '';
  $('#open-long-report').removeAttribute('href');
  $('#copy-report').textContent = 'Copy report';
}
$('#feedback-form').addEventListener('input', clearPreparedDraft);

function updateForm() {
  const bug = $('input[name="kind"]:checked').value === 'bug';
  $('#version-field').hidden = !bug;
  $('#version').disabled = !bug;
  $('#bug-context').hidden = !bug;
  $('#bug-context').querySelectorAll('input, textarea').forEach(input => { input.disabled = !bug; });
  $('#details-label').replaceChildren(document.createTextNode(bug ? 'What happened? ' : 'Your idea '), textElement('span', 'required', 'required-note'));
  $('#details-help').textContent = bug ? 'What were you doing, what went wrong, and what did you expect?' : 'What would you change or add? What would make it fun or useful?';
  $('#title').placeholder = bug ? 'What’s happening?' : 'Give your idea a name';
  $('#details').placeholder = bug ? 'Include steps to repeat it, if you can.' : 'Tell us what would make your next run better.';
  $('#form-tip').textContent = bug ? 'Check the board first. If someone reported the same problem, add your details to their GitHub discussion.' : 'One idea per post helps keep the discussion focused. A small change can make a big difference.';
  clearPreparedDraft();
}
document.querySelectorAll('input[name="kind"]').forEach(input => input.addEventListener('change', () => { updateForm(); renderSimilar(); animateFeedback(input.closest('label'), input.value); }));

$('#feedback-form').addEventListener('submit', event => {
  event.preventDefault();
  clearPreparedDraft();
  try {
    const kind = $('input[name="kind"]:checked').value;
    const prepared = prepareIssue({ kind, title: $('#title').value, details: $('#details').value, version: $('#version').value, steps: $('#steps').value, expected: $('#expected').value, otherMods: $('#other-mods').value });
    animateFeedback($('#submit-feedback'), kind, 3);
    $('#long-report').hidden = !prepared.copyRequired;
    if (prepared.copyRequired) {
      $('#prepared-body').value = prepared.body;
      $('#open-long-report').href = prepared.url;
      $('#form-message').textContent = 'Your full report is ready to copy. Nothing has been submitted yet.';
      $('#prepared-body').focus();
      return;
    }
    const link = document.createElement('a');
    link.href = prepared.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.append(link);
    link.click();
    link.remove();
    $('#form-message').replaceChildren(document.createTextNode('Finish submitting in GitHub, then refresh this board. If no tab opened, '));
    const fallback = textElement('a', 'continue here');
    fallback.href = prepared.url; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer'; fallback.style.textDecoration = 'underline';
    $('#form-message').append(fallback, document.createTextNode('.'));
  } catch (error) { $('#form-message').textContent = error.message; }
});
$('#copy-report').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#prepared-body').value); $('#copy-report').textContent = 'Copied'; }
  catch { $('#prepared-body').focus(); $('#prepared-body').select(); $('#copy-report').textContent = 'Select and copy the text above'; }
});

try {
  const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
  if (cached && Array.isArray(cached.issues) && Date.now() - cached.syncedAt < 60000) {
    Object.assign(state, { issues: cached.issues, page: cached.page, hasMore: cached.hasMore, syncedAt: cached.syncedAt, loaded: true });
    renderBoard(); showBoardMessage('');
  }
} catch { /* no cache, or unparseable JSON */ }
if (!state.loaded) loadIssues();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - (state.syncedAt || 0) > 60000) loadIssues(); });

async function loadRelease() {
  const key = 'living-industry-latest-release-v1';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let release;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (cached && Date.now() - cached.savedAt < 900000) release = cached.release;
    } catch { /* bad cache entry; fetch instead */ }
    if (!release) {
      const response = await fetch(`${API_URL}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      if (typeof data.tag_name !== 'string' || !data.tag_name || data.tag_name.length > 80) return;
      release = { tag: data.tag_name };
      try { sessionStorage.setItem(key, JSON.stringify({ release, savedAt: Date.now() })); } catch { /* sessionStorage blocked or full */ }
    }
    if (typeof release.tag !== 'string' || !release.tag || release.tag.length > 80) return;
    $('#release-version').textContent = release.tag;
    $('#release-version').hidden = false;
    $('#release-notes').href = `${REPO_URL}/releases/tag/${encodeURIComponent(release.tag)}`;
    $('#release-notes').textContent = 'What changed? ↗';
    // Placeholder only. The field stays empty so players type the version they have.
    $('#version').placeholder = `e.g. ${release.tag}, or leave blank`;
  } catch { /* offline or rate limited; the Release history link still works */ }
  finally { clearTimeout(timeout); }
}
loadRelease();

// WebMCP hook so a browser agent can fill in the form. It stops short of opening GitHub.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'prepare_feedback_report', title: 'Prepare Living Industry feedback',
      description: 'Fill the visible feedback form. This stages a draft; it does not submit or open GitHub.',
      inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['bug', 'idea'] }, title: { type: 'string' }, details: { type: 'string' }, version: { type: 'string' }, steps: { type: 'string' }, expected: { type: 'string' }, otherMods: { type: 'string' } }, required: ['kind', 'title', 'details'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const draft = validateDraft(input);
        document.querySelector(`input[name="kind"][value="${draft.kind}"]`).checked = true;
        updateForm();
        $('#title').value = draft.title; $('#details').value = draft.details; $('#version').value = draft.version;
        $('#steps').value = draft.steps; $('#expected').value = draft.expected; $('#other-mods').value = draft.otherMods;
        $('#bug-context').open = Boolean(draft.steps || draft.expected || draft.otherMods);
        renderSimilar();
        $('#feedback-form').scrollIntoView({ behavior: 'auto', block: 'center' });
        return { prepared: true, submitted: false, finalSubmission: 'GitHub' };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
  } catch { /* registerTool threw; the page works without it */ }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
