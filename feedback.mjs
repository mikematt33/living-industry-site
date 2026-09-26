export const REPOSITORY = 'mikematt33/gdt-livingindustry';
export const REPO_URL = `https://github.com/${REPOSITORY}`;
export const API_URL = `https://api.github.com/repos/${REPOSITORY}`;

export function issueKind(issue) {
  const labels = (issue.labels || []).map(label => typeof label === 'string' ? label.toLowerCase() : String(label.name || '').toLowerCase());
  if (labels.includes('bug') || /^\[bug\]/i.test(issue.title || '')) return 'bug';
  if (labels.some(label => ['enhancement', 'suggestion', 'idea', 'feature request'].includes(label)) || /^\[(idea|suggestion|feature)\]/i.test(issue.title || '')) return 'idea';
  return 'other';
}

export function displayTitle(title) {
  return String(title || 'Untitled feedback').replace(/^\[(bug|idea|suggestion|feature)\]\s*/i, '');
}

export function validateDraft(input) {
  if (!input || typeof input !== 'object') throw new Error('Please add your feedback.');
  if (!['bug', 'idea'].includes(input.kind)) throw new Error('Choose a bug report or an idea.');
  const title = String(input.title || '').trim();
  const details = String(input.details || '').trim();
  const version = String(input.version || '').trim();
  const steps = input.kind === 'bug' ? String(input.steps || '').trim() : '';
  const expected = input.kind === 'bug' ? String(input.expected || '').trim() : '';
  const otherMods = input.kind === 'bug' ? String(input.otherMods || '').trim() : '';
  if (title.length < 3 || title.length > 120) throw new Error('Use a title between 3 and 120 characters.');
  if (details.length < 10 || details.length > 6000) throw new Error('Add between 10 and 6,000 characters of detail.');
  if (version.length > 40) throw new Error('Keep the version under 40 characters.');
  if (steps.length > 2000 || expected.length > 1000 || otherMods.length > 500) throw new Error('Please shorten the optional bug details to fit the indicated limits.');
  return { kind: input.kind, title, details, version, steps, expected, otherMods };
}

export function prepareIssue(input) {
  const draft = validateDraft(input);
  const title = `[${draft.kind === 'bug' ? 'Bug' : 'Idea'}] ${draft.title}`;
  const body = draft.kind === 'bug'
    ? `### What happened?\n\n${draft.details}${draft.steps ? `\n\n### Steps to reproduce\n\n${draft.steps}` : ''}${draft.expected ? `\n\n### Expected behavior\n\n${draft.expected}` : ''}\n\n### Mod version\n\n${draft.version || 'Not specified'}${draft.otherMods ? `\n\n### Other installed mods\n\n${draft.otherMods}` : ''}\n\n---\nPrepared on the Living Industry feedback site.`
    : `### The idea\n\n${draft.details}\n\n---\nPrepared on the Living Industry feedback site.`;
  const url = new URL(`${REPO_URL}/issues/new`);
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  const fullUrl = url.toString();
  // GitHub's URL-size limit can be exceeded by long or non-ASCII reports.
  // Keep the complete text available for copy/paste instead of truncating it.
  if (fullUrl.length > 7000) url.searchParams.delete('body');
  return { title, body, url: url.toString(), copyRequired: fullUrl.length > 7000 };
}

export function filterIssues(issues, {kind = 'all', status = 'open', query = ''} = {}) {
  const term = String(query).trim().toLowerCase();
  return issues.filter(issue => !issue.pull_request
    && (kind === 'all' || issueKind(issue) === kind)
    && (status === 'all' || issue.state === status)
    && (!term || `${issue.title}\n${issue.body || ''}\n${issue.number}`.toLowerCase().includes(term)));
}

export function safeIssueUrl(issue) {
  return `${REPO_URL}/issues/${Number.isSafeInteger(issue.number) && issue.number > 0 ? issue.number : ''}`;
}

export function issueProgress(issue) {
  const labels = (issue.labels || []).map(label => String(typeof label === 'string' ? label : label.name || '').trim());
  if (issue.state === 'closed') {
    const fixed = labels.map(label => label.match(/^fixed in:?\s+(v?\d[\w.+-]{0,30})$/i)).find(Boolean);
    return fixed ? { text: `Fixed in ${fixed[1]}`, style: 'fixed' } : null;
  }
  const normalized = labels.map(label => label.toLowerCase().replace(/^status:\s*/, ''));
  for (const [label, text, style] of [['in progress', 'In progress', 'working'], ['planned', 'Planned', 'planned'], ['under review', 'Under review', 'review']]) {
    if (normalized.includes(label)) return { text, style };
  }
  return null;
}

const titleStopWords = new Set('a an and are as at be but by for from has have how i in is it its my of on or that the this to when with'.split(' '));
function titleWords(title) {
  return [...new Set(displayTitle(title).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])].filter(word => word.length > 2 && !titleStopWords.has(word));
}
export function similarIssues(issues, title, kind) {
  const words = titleWords(title);
  if (!words.length || String(title).trim().length < 5) return [];
  return issues.filter(issue => !issue.pull_request && (issueKind(issue) === kind || issueKind(issue) === 'other'))
    .map(issue => {
      const candidate = titleWords(issue.title);
      const matches = words.filter(word => candidate.includes(word)).length;
      const score = matches / Math.max(words.length, candidate.length, 1);
      return { issue, matches, score };
    })
    .filter(result => result.matches >= Math.min(2, words.length) && result.score >= 0.25)
    .sort((a, b) => b.score - a.score || b.issue.number - a.issue.number)
    .slice(0, 3).map(result => result.issue);
}
