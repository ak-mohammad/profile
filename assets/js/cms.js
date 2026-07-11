// CMS Application Logic
let state = {
  token: localStorage.getItem('cms_github_token') || '',
  username: localStorage.getItem('cms_github_username') || '',
  repo: localStorage.getItem('cms_github_repo') || '',
  branch: localStorage.getItem('cms_github_branch') || 'main',
  proxyUrl: localStorage.getItem('cms_github_proxy') || '',
  posts: [],
  editingPost: null, // { filename, content, sha }
  workflowInterval: null
};

// DOM Nodes
const panels = {
  config: document.getElementById('panel-config'),
  dashboard: document.getElementById('panel-dashboard'),
  editor: document.getElementById('panel-editor')
};

const elements = {
  btnShowConfig: document.getElementById('btn-show-config'),
  formConfig: document.getElementById('form-config'),
  btnOAuthLogin: document.getElementById('btn-oauth-login'),
  
  btnNewPost: document.getElementById('btn-new-post'),
  postsLoading: document.getElementById('posts-loading'),
  postsEmpty: document.getElementById('posts-empty'),
  postsList: document.getElementById('posts-list'),
  
  editorPanelTitle: document.getElementById('editor-panel-title'),
  postHeadline: document.getElementById('post-headline'),
  postSubheadline: document.getElementById('post-subheadline'),
  postDate: document.getElementById('post-date'),
  postCategories: document.getElementById('post-categories'),
  postImage: document.getElementById('post-image'),
  postContent: document.getElementById('post-content'),
  postFilename: document.getElementById('post-filename'),
  previewRender: document.getElementById('preview-render'),
  btnEditorCancel: document.getElementById('btn-editor-cancel'),
  btnEditorPublish: document.getElementById('btn-editor-publish'),
  
  deploymentTracker: document.getElementById('deployment-tracker'),
  trackerText: document.getElementById('tracker-text'),
  trackerLink: document.getElementById('tracker-link'),
  toast: document.getElementById('toast')
};

// Start CMS
window.addEventListener('DOMContentLoaded', async () => {
  setupHandlers();
  fillConfigFields();
  
  // Handle OAuth code callback redirect
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    window.history.replaceState({}, document.title, window.location.pathname);
    await handleOAuthExchange(code);
  } else if (state.token && state.username && state.repo) {
    showPanel('dashboard');
    await fetchPosts();
    startWorkflowMonitoring();
  } else {
    showPanel('config');
  }
});

function setupHandlers() {
  // Navigation
  elements.btnShowConfig.addEventListener('click', () => {
    fillConfigFields();
    showPanel('config');
  });

  // Config Submit
  elements.formConfig.addEventListener('submit', handleConfigSave);
  
  // OAuth Button
  elements.btnOAuthLogin.addEventListener('click', () => {
    const proxy = document.getElementById('config-proxy').value.trim();
    const username = document.getElementById('config-username').value.trim();
    const repo = document.getElementById('config-repo').value.trim();
    
    if (!proxy) {
      showToast('OAuth requires an exchange proxy URL configured.', 'error');
      return;
    }
    
    // Save partial config to restore later
    localStorage.setItem('cms_github_username', username);
    localStorage.setItem('cms_github_repo', repo);
    localStorage.setItem('cms_github_proxy', proxy);
    
    // Redirect to GitHub OAuth
    // Create a public OAuth Client ID placeholder or let them enter theirs.
    // If they configure a client ID inside proxy, the proxy handles it.
    // Here we can link to a standard authorize endpoint:
    const clientId = 'Ov23lissjbf3KA3blXGg'; // Placeholder or custom ID
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&redirect_uri=${encodeURIComponent(window.location.href)}`;
  });

  // Dashboard New Post
  elements.btnNewPost.addEventListener('click', () => startEditor());

  // Editor Actions
  elements.btnEditorCancel.addEventListener('click', () => {
    if (confirm('Discard changes?')) {
      showPanel('dashboard');
    }
  });

  elements.btnEditorPublish.addEventListener('click', handlePublishPost);

  // Editor typing auto generators
  elements.postHeadline.addEventListener('input', () => {
    if (!state.editingPost || !state.editingPost.sha) {
      calcFilename();
    }
    renderLivePreview();
  });
  elements.postDate.addEventListener('change', () => {
    if (!state.editingPost || !state.editingPost.sha) {
      calcFilename();
    }
    renderLivePreview();
  });
  elements.postSubheadline.addEventListener('input', renderLivePreview);
  elements.postImage.addEventListener('input', renderLivePreview);
  elements.postCategories.addEventListener('input', renderLivePreview);
  elements.postContent.addEventListener('input', renderLivePreview);
}

// Show Panel
function showPanel(panelName) {
  Object.keys(panels).forEach(name => {
    if (name === panelName) {
      panels[name].classList.remove('hidden');
    } else {
      panels[name].classList.add('hidden');
    }
  });

  if (panelName === 'config') {
    elements.btnShowConfig.classList.add('hidden');
  } else {
    elements.btnShowConfig.classList.remove('hidden');
  }
}

// Fill Configuration Inputs from state
function fillConfigFields() {
  document.getElementById('config-token').value = state.token;
  document.getElementById('config-username').value = state.username;
  document.getElementById('config-repo').value = state.repo;
  document.getElementById('config-branch').value = state.branch;
  document.getElementById('config-proxy').value = state.proxyUrl;
}

// Save config details
async function handleConfigSave(e) {
  e.preventDefault();
  
  const token = document.getElementById('config-token').value.trim();
  const username = document.getElementById('config-username').value.trim();
  const repo = document.getElementById('config-repo').value.trim();
  const branch = document.getElementById('config-branch').value.trim() || 'main';
  const proxy = document.getElementById('config-proxy').value.trim();

  // Test the credentials
  showToast('Testing Connection...', 'info');
  try {
    const res = await fetch(`https://api.github.com/repos/${username}/${repo}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!res.ok) throw new Error(`Status ${res.status}: Repository access denied.`);
    
    // Save to state
    state.token = token;
    state.username = username;
    state.repo = repo;
    state.branch = branch;
    state.proxyUrl = proxy;

    // Save to localStorage
    localStorage.setItem('cms_github_token', token);
    localStorage.setItem('cms_github_username', username);
    localStorage.setItem('cms_github_repo', repo);
    localStorage.setItem('cms_github_branch', branch);
    localStorage.setItem('cms_github_proxy', proxy);

    showToast('Connection validated and config saved!', 'success');
    showPanel('dashboard');
    await fetchPosts();
    startWorkflowMonitoring();
  } catch (err) {
    showToast(`Connection failed: ${err.message}`, 'error');
  }
}

// Handle OAuth Code Exchange
async function handleOAuthExchange(code) {
  const proxy = state.proxyUrl;
  if (!proxy) {
    showToast('OAuth exchange proxy is missing in settings. Please login with a Personal Token.', 'error');
    showPanel('config');
    return;
  }

  showToast('Exchanging code for token...', 'info');
  try {
    const res = await fetch(proxy, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.error || 'Failed to exchange token.');
    }

    state.token = data.access_token;
    localStorage.setItem('cms_github_token', state.token);
    showToast('Signed in successfully!', 'success');
    showPanel('dashboard');
    await fetchPosts();
    startWorkflowMonitoring();
  } catch (err) {
    showToast(err.message, 'error');
    showPanel('config');
  }
}

// Fetch Posts from GitHub
async function fetchPosts() {
  elements.postsLoading.classList.remove('hidden');
  elements.postsEmpty.classList.add('hidden');
  elements.postsList.classList.add('hidden');

  try {
    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/contents/_posts?ref=${state.branch}`, {
      headers: {
        'Authorization': `token ${state.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 404) {
      // Folder doesn't exist yet
      elements.postsLoading.classList.add('hidden');
      elements.postsEmpty.classList.remove('hidden');
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const files = await res.json();
    state.posts = files.filter(f => f.name.endsWith('.md') || f.name.endsWith('.markdown'));
    // Sort from newest to oldest
    state.posts.sort((a, b) => b.name.localeCompare(a.name));

    elements.postsLoading.classList.add('hidden');
    if (state.posts.length === 0) {
      elements.postsEmpty.classList.remove('hidden');
    } else {
      renderPosts();
    }
  } catch (err) {
    elements.postsLoading.classList.add('hidden');
    elements.postsEmpty.classList.remove('hidden');
    elements.postsEmpty.querySelector('p').textContent = `Failed to fetch: ${err.message}`;
  }
}

// Render post cards
function renderPosts() {
  elements.postsList.innerHTML = '';
  elements.postsList.classList.remove('hidden');

  state.posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'glass-panel post-card';
    card.style.padding = '1.5rem';
    
    const dateMatch = post.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    const dateStr = dateMatch ? dateMatch[1] : '';
    const rawTitle = dateMatch ? dateMatch[2].replace(/-/g, ' ') : post.name;
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

    card.innerHTML = `
      <div>
        <span class="post-card-date">${dateStr || 'Draft'}</span>
        <h3 class="post-card-title">${title}</h3>
        <p class="post-card-desc" style="font-size: 0.8rem; font-family: monospace; color: var(--text-muted);">${post.name}</p>
      </div>
      <div class="post-card-actions">
        <button class="btn btn-secondary btn-edit" data-name="${post.name}">Edit</button>
        <button class="btn btn-danger btn-delete" data-name="${post.name}" data-sha="${post.sha}">Delete</button>
      </div>
    `;

    card.querySelector('.btn-edit').addEventListener('click', () => editPost(post.name));
    card.querySelector('.btn-delete').addEventListener('click', () => deletePost(post.name, post.sha));

    elements.postsList.appendChild(card);
  });
}

// Edit post content
async function editPost(filename) {
  showToast('Fetching post...', 'info');
  try {
    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/contents/_posts/${filename}?ref=${state.branch}`, {
      headers: {
        'Authorization': `token ${state.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const content = atob(data.content.replace(/\s/g, ''));

    startEditor({
      filename: data.name,
      sha: data.sha,
      content: content
    });
  } catch (err) {
    showToast(`Fetch failed: ${err.message}`, 'error');
  }
}

// Delete post file
async function deletePost(filename, sha) {
  if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

  showToast('Deleting post...', 'info');
  try {
    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/contents/_posts/${filename}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `CMS: Delete ${filename}`,
        sha: sha,
        branch: state.branch
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast('Post deleted!', 'success');
    await fetchPosts();
    triggerWorkflowCheck();
  } catch (err) {
    showToast(`Deletion failed: ${err.message}`, 'error');
  }
}

// Start editor view
function startEditor(postData = null) {
  showPanel('editor');

  if (postData) {
    state.editingPost = postData;
    elements.editorPanelTitle.textContent = `Edit Post`;
    elements.postFilename.disabled = true;

    const parsed = parseMarkdownFrontMatter(postData.content);
    elements.postHeadline.value = parsed.title || '';
    elements.postSubheadline.value = parsed.subtitle || parsed.description || '';
    elements.postDate.value = parsed.date || new Date().toISOString().split('T')[0];
    elements.postCategories.value = parsed.categories ? parsed.categories.join(', ') : '';
    elements.postImage.value = parsed.image || '';
    elements.postContent.value = parsed.body || '';
    elements.postFilename.value = postData.filename;
  } else {
    state.editingPost = { filename: '', content: '', sha: null };
    elements.editorPanelTitle.textContent = `Create New Post`;
    elements.postFilename.disabled = false;

    elements.postHeadline.value = '';
    elements.postSubheadline.value = '';
    elements.postDate.value = new Date().toISOString().split('T')[0];
    elements.postCategories.value = 'marketing, digital';
    elements.postImage.value = '';
    elements.postContent.value = `Write your post details here...`;
    calcFilename();
  }
  
  renderLivePreview();
}

function calcFilename() {
  const date = elements.postDate.value;
  const headline = elements.postHeadline.value.trim();
  
  if (!date) return;
  
  let slug = 'draft';
  if (headline) {
    slug = headline
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
  elements.postFilename.value = `${date}-${slug}.md`;
}

function renderLivePreview() {
  const title = elements.postHeadline.value || 'Untitled Headline';
  const sub = elements.postSubheadline.value || '';
  const date = elements.postDate.value || new Date().toISOString().split('T')[0];
  const image = elements.postImage.value || '';
  const categories = elements.postCategories.value;
  const content = elements.postContent.value;

  const dateObj = new Date(date);
  const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let headerHtml = `
    <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem; margin-bottom: 2rem;">
      <span style="color: var(--secondary); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">${formattedDate}</span>
      <h1 style="font-size: 2.25rem; color: var(--text-primary); margin-top: 0.5rem; line-height: 1.25;">${title}</h1>
      ${sub ? `<p style="font-size: 1.15rem; color: var(--text-secondary); font-style: italic; margin-top: 0.5rem;">${sub}</p>` : ''}
      ${image ? `<img src="${image}" alt="Post Banner" style="width: 100%; border-radius: var(--border-radius-md); margin-top: 1.5rem; border: 1px solid var(--border-color);" onerror="this.style.display='none'">` : ''}
      ${categories ? `<div style="margin-top: 1.25rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        ${categories.split(',').map(c => `<span style="background: rgba(255,255,255,0.05); font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 50px; border: 1px solid var(--border-color); color: var(--text-muted);">${c.trim()}</span>`).join('')}
      </div>` : ''}
    </div>
  `;

  let renderedBody = '';
  if (typeof marked !== 'undefined') {
    renderedBody = marked.parse(content);
  } else {
    renderedBody = `<pre style="white-space: pre-wrap;">${content}</pre>`;
  }

  elements.previewRender.innerHTML = headerHtml + renderedBody;
}

// Publish post to GitHub
async function handlePublishPost() {
  const headline = elements.postHeadline.value.trim();
  const date = elements.postDate.value;
  const filename = elements.postFilename.value.trim();
  const content = elements.postContent.value.trim();

  if (!headline || !date || !filename || !content) {
    showToast('Please fill out all required fields.', 'error');
    return;
  }

  elements.btnEditorPublish.disabled = true;
  showToast('Publishing post to GitHub...', 'info');

  try {
    const markdownContent = buildMarkdownContent();
    const isUpdate = !!(state.editingPost && state.editingPost.sha);

    const body = {
      message: `CMS: ${isUpdate ? 'Update' : 'Create'} ${filename}`,
      content: btoa(unescape(encodeURIComponent(markdownContent))),
      branch: state.branch
    };

    if (isUpdate) {
      body.sha = state.editingPost.sha;
    }

    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/contents/_posts/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    showToast('Post published successfully!', 'success');
    showPanel('dashboard');
    await fetchPosts();
    triggerWorkflowCheck();
  } catch (err) {
    showToast(`Publish failed: ${err.message}`, 'error');
  } finally {
    elements.btnEditorPublish.disabled = false;
  }
}

// Compile front-matter and content
function buildMarkdownContent() {
  const title = elements.postHeadline.value.trim();
  const subtitle = elements.postSubheadline.value.trim();
  const date = elements.postDate.value;
  const image = elements.postImage.value.trim();
  
  const rawCats = elements.postCategories.value.split(',');
  const categories = rawCats.map(c => c.trim()).filter(c => c !== '');
  
  const body = elements.postContent.value;

  let md = '---\n';
  md += 'layout: post\n';
  md += `title: "${title.replace(/"/g, '\\"')}"\n`;
  if (subtitle) md += `subtitle: "${subtitle.replace(/"/g, '\\"')}"\n`;
  md += `date: ${date} 12:00:00 +0530\n`;
  if (image) md += `image: "${image}"\n`;
  if (categories.length > 0) md += `categories: [${categories.join(', ')}]\n`;
  md += '---\n\n';
  
  return md + body;
}

// Parse markdown front-matter
function parseMarkdownFrontMatter(fullText) {
  const result = { title: '', subtitle: '', date: '', categories: [], image: '', body: '' };
  
  if (!fullText.startsWith('---\n')) {
    result.body = fullText;
    return result;
  }

  const parts = fullText.split('---\n');
  if (parts.length < 3) {
    result.body = fullText;
    return result;
  }

  result.body = parts.slice(2).join('---\n').trim();
  const fmLines = parts[1].split('\n');

  fmLines.forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;

    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();

    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }

    if (key === 'title') result.title = val;
    else if (key === 'subtitle' || key === 'description') result.subtitle = val;
    else if (key === 'image') result.image = val;
    else if (key === 'date') {
      const match = val.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) result.date = match[0];
    }
    else if (key === 'categories') {
      const arrayMatch = val.match(/\[(.*)\]/);
      if (arrayMatch) {
        result.categories = arrayMatch[1].split(',').map(c => c.trim());
      } else {
        result.categories = val.split(',').map(c => c.trim());
      }
    }
  });

  return result;
}

// Monitor Workflow Runs
function startWorkflowMonitoring() {
  triggerWorkflowCheck();
  clearInterval(state.workflowInterval);
  state.workflowInterval = setInterval(triggerWorkflowCheck, 10000);
}

async function triggerWorkflowCheck() {
  if (!state.token || !state.username || !state.repo) return;

  try {
    const res = await fetch(`https://api.github.com/repos/${state.username}/${state.repo}/actions/runs?per_page=5&branch=${state.branch}`, {
      headers: {
        'Authorization': `token ${state.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) return;
    const data = await res.json();
    const runs = data.workflow_runs || [];

    if (runs.length === 0) {
      elements.deploymentTracker.classList.add('hidden');
      return;
    }

    const latest = runs[0];
    elements.deploymentTracker.classList.remove('hidden');

    const siteUrl = `https://${state.username}.github.io/${state.repo}`;
    elements.trackerLink.href = siteUrl;

    if (latest.status === 'queued' || latest.status === 'in_progress') {
      elements.deploymentTracker.className = 'tracker-panel building';
      elements.trackerText.textContent = 'Building Jekyll site on GitHub Pages...';
      elements.trackerLink.classList.add('hidden');
    } else if (latest.status === 'completed') {
      if (latest.conclusion === 'success') {
        elements.deploymentTracker.className = 'tracker-panel success';
        
        // Relative time calculation
        const duration = Math.floor((new Date() - new Date(latest.completed_at)) / 1000);
        let timeText = 'just now';
        if (duration >= 60) {
          const mins = Math.floor(duration / 60);
          timeText = `${mins}m ago`;
        }
        elements.trackerText.textContent = `Portfolio is Live! (Built ${timeText})`;
        elements.trackerLink.classList.remove('hidden');
      } else {
        elements.deploymentTracker.className = 'tracker-panel failed';
        elements.trackerText.textContent = 'Last Jekyll build failed.';
        elements.trackerLink.classList.add('hidden');
      }
    }
  } catch (e) {
    elements.deploymentTracker.classList.add('hidden');
  }
}

// Show Toast Alerts
let toastTimeout;
function showToast(message, type = 'success') {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove('hidden');

  toastTimeout = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 4000);
}
