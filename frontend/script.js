const API = window.API_URL || 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderLeads();
    renderSummary();
    renderTimeline();
    renderActivity();
});

// --- Theme ---
function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
        document.documentElement.classList.add('light-mode');
    } else {
        document.documentElement.classList.add('dark-mode');
    }
    updateThemeIcon();
}

function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark-mode');
    html.classList.toggle('light-mode', !isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
    // Re-render chart with new colors
    renderSummary();
}

function updateThemeIcon() {
    const icon = document.getElementById('themeIcon');
    icon.textContent = document.documentElement.classList.contains('dark-mode') ? '\u2601' : '\u25D0';
}

// --- API ---
async function apiFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    return data;
}

function showToast(message, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = message;
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

function openModal(id) {
    clearErrors(id === 'leadModal' ? 'leadForm' : 'campaignForm');
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function formatDate(d) {
    if (!d) return '\u2014';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isDarkMode() {
    return document.documentElement.classList.contains('dark-mode');
}

// --- Validation ---
const VALIDATORS = {
    leadName: (v) => !v.trim() ? 'Name is required' : null,
    leadEmail: (v) => {
        if (!v.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Invalid email format';
        return null;
    },
    leadPhone: (v) => {
        if (v && !/^[\d\s\-+()]{7,20}$/.test(v)) return 'Invalid phone format';
        return null;
    },
    leadDepartment: (v) => !v ? 'Department is required' : null,
    campaignName: (v) => !v.trim() ? 'Campaign name is required' : null,
    campaignType: (v) => !v ? 'Campaign type is required' : null,
    campaignChannel: (v) => !v ? 'Channel is required' : null,
    campaignStatus: (v) => !v ? 'Status is required' : null,
    campaignProgress: (v) => {
        if (v === '' || v === null || v === undefined) return 'Progress is required';
        const n = parseInt(v);
        if (isNaN(n) || n < 0 || n > 100) return 'Must be between 0 and 100';
        return null;
    },
    campaignStartDate: (v) => !v ? 'Start date is required' : null,
};

function validateField(input) {
    const errorSpan = document.getElementById(`${input.id}-error`);
    const validator = VALIDATORS[input.id];
    let error = null;
    if (validator) {
        error = validator(input.value);
    } else if (input.hasAttribute('required') && !input.value.trim()) {
        error = 'This field is required';
    }
    if (error) {
        input.classList.add('invalid');
        if (errorSpan) errorSpan.textContent = error;
        return false;
    }
    input.classList.remove('invalid');
    if (errorSpan) errorSpan.textContent = '';
    return true;
}

function clearErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    form.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return true;
    const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]), select, textarea');
    let valid = true;
    inputs.forEach(input => {
        if (!validateField(input)) valid = false;
    });
    // Validate checkboxes if they have a validator
    const checks = form.querySelectorAll('input[type="checkbox"]');
    checks.forEach(cb => {
        const errorSpan = document.getElementById(`${cb.id}-error`);
        if (errorSpan) errorSpan.textContent = '';
    });
    return valid;
}

// Auto-validate on input/blur
document.addEventListener('input', (e) => {
    if (e.target.closest('.modal-content')) validateField(e.target);
});
document.addEventListener('blur', (e) => {
    if (e.target.closest('.modal-content')) validateField(e.target);
}, true);

// --- Chart ---
const CHART_COLORS_LIGHT = ['#16a34a', '#2563eb', '#7c3aed', '#ca8a04', '#6b7280'];
const CHART_COLORS_DARK = ['#4ade80', '#60a5fa', '#a78bfa', '#fbbf24', '#9ca3af'];
const CHART_LABELS = ['Completed', 'In Progress', 'Review', 'Planning', 'On Hold'];
const STATUS_KEY_MAP = {
    'Completed': 'completed',
    'In Progress': 'in_progress',
    'Review': 'review',
    'Planning': 'planning',
    'On Hold': 'on_hold',
};

function drawDonutChart(data) {
    const canvas = document.getElementById('statusChart');
    if (!canvas) return;
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth - 36 || 180;
    const h = 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2;
    const outerR = Math.min(w, h) / 2 - 20;
    const innerR = outerR * 0.58;

    const colors = isDarkMode() ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
    const bgColor = isDarkMode() ? '#1e1e1e' : '#ffffff';

    const breakdown = data.status_breakdown || {};
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0) || 1;

    // Order by status priority
    const order = ['Completed', 'In Progress', 'Review', 'Planning', 'On Hold'];
    const slices = order.map((label, i) => ({
        label,
        value: breakdown[label] || 0,
        color: colors[i] || colors[colors.length - 1],
    })).filter(s => s.value > 0);

    ctx.clearRect(0, 0, w, h);

    if (slices.length === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fillStyle = isDarkMode() ? '#333' : '#eee';
        ctx.fill();
        ctx.fillStyle = isDarkMode() ? '#777' : '#999';
        ctx.font = '12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No data', cx, cy);
        return;
    }

    let startAngle = -Math.PI / 2;
    slices.forEach(slice => {
        const angle = (slice.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, startAngle + angle);
        ctx.arc(cx, cy, innerR, startAngle + angle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();
        startAngle += angle;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();

    ctx.fillStyle = isDarkMode() ? '#fff' : '#000';
    ctx.font = 'bold 16px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy - 6);
    ctx.fillStyle = isDarkMode() ? '#a0a0a0' : '#6b6b6b';
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText('campaigns', cx, cy + 12);

    // Legend
    const legendContainer = container.querySelector('.chart-legend');
    if (legendContainer) {
        legendContainer.innerHTML = slices.map(s => `
            <span class="chart-legend-item">
                <span class="legend-dot" style="background:${s.color}"></span>
                ${s.label}
                <span class="legend-value">${s.value}</span>
            </span>
        `).join('');
    }
}

// --- Summary ---
async function renderSummary() {
    try {
        const data = await apiFetch('/api/dashboard/summary');
        const container = document.getElementById('summary');
        container.innerHTML = `
            <div class="summary-cards">
                <div class="summary-card">
                    <div class="value" style="color:${isDarkMode() ? '#86efac' : '#16a34a'}">${data.total_leads}</div>
                    <div class="label">Team Leads</div>
                </div>
                <div class="summary-card">
                    <div class="value" style="color:${isDarkMode() ? '#93c5fd' : '#2563eb'}">${data.total_campaigns}</div>
                    <div class="label">Total Campaigns</div>
                </div>
                <div class="summary-card">
                    <div class="value" style="color:${isDarkMode() ? '#fcd34d' : '#ca8a04'}">${data.active_campaigns}</div>
                    <div class="label">Active</div>
                </div>
                <div class="summary-card">
                    <div class="value" style="color:${isDarkMode() ? '#86efac' : '#16a34a'}">${data.completed_campaigns}</div>
                    <div class="label">Completed</div>
                </div>
                <div class="summary-card">
                    <div class="value">${Object.keys(data.department_breakdown || {}).length}</div>
                    <div class="label">Departments</div>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">Campaign Status</div>
                <canvas id="statusChart"></canvas>
                <div class="chart-legend"></div>
            </div>
        `;
        drawDonutChart(data);
    } catch (e) {
        console.error('Summary error:', e);
    }
}

// --- Leads ---
let expandedLeadId = null;

async function renderLeads() {
    const search = document.getElementById('searchInput').value;
    const dept = document.getElementById('deptFilter').value;
    let url = '/api/leads?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (dept) url += `department=${encodeURIComponent(dept)}`;

    try {
        const leads = await apiFetch(url);
        const tbody = document.getElementById('leadsBody');
        const empty = document.getElementById('emptyState');

        if (leads.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = leads.map(lead => `
            <tr class="expandable" onclick="toggleCampaigns(${lead.id})">
                <td>
                    <span class="expand-indicator ${expandedLeadId === lead.id ? 'open' : ''}">&#9654;</span>
                    ${lead.name}
                </td>
                <td>${lead.email}</td>
                <td>${lead.department}</td>
                <td><span class="badge ${lead.is_active ? 'badge-active' : 'badge-inactive'}">${lead.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${lead.campaigns ? lead.campaigns.length : '\u2026'}</td>
                <td class="actions-cell">
                    <button class="btn-icon btn-sm" onclick="event.stopPropagation(); openEditLeadModal(${lead.id})">Edit</button>
                    <button class="btn-sm" style="background:transparent;border:1px solid transparent;color:var(--danger);cursor:pointer;font-size:12px;padding:5px 10px;border-radius:6px;" onclick="event.stopPropagation(); deleteLead(${lead.id})">Delete</button>
                </td>
            </tr>
            <tr class="campaigns-subtable ${expandedLeadId === lead.id ? 'open' : ''}" id="campaigns-${lead.id}">
                <td colspan="6" class="campaigns-td">
                    <div class="campaigns-content" id="campaigns-content-${lead.id}"></div>
                </td>
            </tr>
        `).join('');

        if (expandedLeadId !== null) {
            const container = document.getElementById(`campaigns-content-${expandedLeadId}`);
            if (container && !container.hasChildNodes()) {
                renderCampaignsForLead(expandedLeadId);
            }
        }
    } catch (e) {
        document.getElementById('leadsBody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger);font-size:13px;">Error loading leads: ${e.message}</td></tr>`;
    }
}

function toggleCampaigns(leadId) {
    const campaignRow = document.getElementById(`campaigns-${leadId}`);
    if (!campaignRow) return;

    if (expandedLeadId !== null && expandedLeadId !== leadId) {
        const prevRow = document.getElementById(`campaigns-${expandedLeadId}`);
        if (prevRow) prevRow.classList.remove('open');
    }

    const willOpen = !campaignRow.classList.contains('open');
    campaignRow.classList.toggle('open', willOpen);
    expandedLeadId = willOpen ? leadId : null;

    const prevTr = campaignRow.previousElementSibling;
    if (prevTr) {
        const indicator = prevTr.querySelector('.expand-indicator');
        if (indicator) indicator.classList.toggle('open', willOpen);
    }

    if (willOpen) {
        const container = document.getElementById(`campaigns-content-${leadId}`);
        if (container && !container.hasChildNodes()) {
            renderCampaignsForLead(leadId);
        }
    }
}

async function renderCampaignsForLead(leadId) {
    const container = document.getElementById(`campaigns-content-${leadId}`);
    if (!container) return;
    try {
        const campStatusFilter = document.getElementById(`camp-status-${leadId}`)?.value || '';
        const campTypeFilter = document.getElementById(`camp-type-${leadId}`)?.value || '';

        let url = `/api/campaigns?lead_id=${leadId}`;
        if (campStatusFilter) url += `&status=${encodeURIComponent(campStatusFilter)}`;
        if (campTypeFilter) url += `&campaign_type=${encodeURIComponent(campTypeFilter)}`;

        const campaigns = await apiFetch(url);
        const lead = await apiFetch(`/api/leads/${leadId}`);

        const filterBar = `
            <div class="filter-bar">
                <label>Filter:</label>
                <select id="camp-status-${leadId}" onchange="renderCampaignsForLead(${leadId})">
                    <option value="">All Status</option>
                    <option value="Planning" ${campStatusFilter === 'Planning' ? 'selected' : ''}>Planning</option>
                    <option value="In Progress" ${campStatusFilter === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Review" ${campStatusFilter === 'Review' ? 'selected' : ''}>Review</option>
                    <option value="Completed" ${campStatusFilter === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="On Hold" ${campStatusFilter === 'On Hold' ? 'selected' : ''}>On Hold</option>
                </select>
                <select id="camp-type-${leadId}" onchange="renderCampaignsForLead(${leadId})">
                    <option value="">All Types</option>
                    <option value="Social" ${campTypeFilter === 'Social' ? 'selected' : ''}>Social</option>
                    <option value="Email" ${campTypeFilter === 'Email' ? 'selected' : ''}>Email</option>
                    <option value="PPC" ${campTypeFilter === 'PPC' ? 'selected' : ''}>PPC</option>
                    <option value="SEO" ${campTypeFilter === 'SEO' ? 'selected' : ''}>SEO</option>
                    <option value="Content" ${campTypeFilter === 'Content' ? 'selected' : ''}>Content</option>
                    <option value="Other" ${campTypeFilter === 'Other' ? 'selected' : ''}>Other</option>
                </select>
                <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${campaigns.length} campaign(s)</span>
            </div>
        `;

        if (campaigns.length === 0) {
            container.innerHTML = `
                <div class="campaign-header">
                    <span>Campaigns for ${lead.name}</span>
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openAddCampaignModal(${leadId})">+ Add Campaign</button>
                </div>
                ${filterBar}
                <div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">
                    No campaigns match your filters.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="campaign-header">
                <span>Campaigns for ${lead.name}</span>
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openAddCampaignModal(${leadId})">+ Add Campaign</button>
            </div>
            ${filterBar}
            <table class="campaign-table-inner" style="width:100%;">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Channel</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Dates</th>
                        <th style="width:100px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${campaigns.map(c => {
                        const sc = c.status.toLowerCase().replace(/ /g, '-');
                        return `<tr>
                            <td>${c.name}</td>
                            <td><span class="badge badge-${sc}">${c.campaign_type}</span></td>
                            <td>${c.channel}</td>
                            <td><span class="badge badge-${sc}">${c.status}</span></td>
                            <td>
                                <div class="progress-bar"><div class="progress-fill" style="width:${c.progress}%"></div></div>
                                <span class="progress-text">${c.progress}%</span>
                            </td>
                            <td style="font-size:11px;color:var(--text-secondary);">${formatDate(c.start_date)} \u2014 ${formatDate(c.target_end_date)}</td>
                            <td class="actions-cell">
                                <button class="btn-icon btn-sm" onclick="event.stopPropagation(); openEditCampaignModal(${c.id})">Edit</button>
                                <button class="btn-sm" style="background:transparent;border:1px solid transparent;color:var(--danger);cursor:pointer;font-size:11px;padding:5px 8px;border-radius:6px;font-family:Inter,sans-serif;" onclick="event.stopPropagation(); deleteCampaign(${c.id})">Delete</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        container.innerHTML = `<div style="padding:16px;color:var(--danger);font-size:13px;">Error: ${e.message}</div>`;
    }
}

// --- Lead Modal ---
function openAddLeadModal() {
    document.getElementById('leadModalTitle').textContent = 'Add Team Lead';
    document.getElementById('leadForm').reset();
    document.getElementById('leadId').value = '';
    document.getElementById('leadActive').checked = true;
    openModal('leadModal');
}

async function openEditLeadModal(leadId) {
    try {
        const lead = await apiFetch(`/api/leads/${leadId}`);
        document.getElementById('leadModalTitle').textContent = 'Edit Team Lead';
        document.getElementById('leadId').value = lead.id;
        document.getElementById('leadName').value = lead.name;
        document.getElementById('leadEmail').value = lead.email;
        document.getElementById('leadPhone').value = lead.phone || '';
        document.getElementById('leadDepartment').value = lead.department;
        document.getElementById('leadActive').checked = lead.is_active;
        openModal('leadModal');
    } catch (e) {
        showToast('Error loading lead: ' + e.message, 'error');
    }
}

async function saveLead(event) {
    event.preventDefault();
    if (!validateForm('leadForm')) return;

    const id = document.getElementById('leadId').value;
    const data = {
        name: document.getElementById('leadName').value,
        email: document.getElementById('leadEmail').value,
        phone: document.getElementById('leadPhone').value,
        department: document.getElementById('leadDepartment').value,
        is_active: document.getElementById('leadActive').checked,
    };

    try {
        if (id) {
            await apiFetch(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            showToast('Team lead updated');
        } else {
            await apiFetch('/api/leads', { method: 'POST', body: JSON.stringify(data) });
            showToast('Team lead added');
        }
        closeModal('leadModal');
        renderLeads();
        renderSummary();
        renderTimeline();
        renderActivity();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteLead(leadId) {
    if (!confirm('Delete this team lead and all their campaigns?')) return;
    try {
        await apiFetch(`/api/leads/${leadId}`, { method: 'DELETE' });
        showToast('Team lead deleted');
        if (expandedLeadId === leadId) expandedLeadId = null;
        renderLeads();
        renderSummary();
        renderTimeline();
        renderActivity();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// --- Campaign CRUD ---
function openAddCampaignModal(leadId) {
    document.getElementById('campaignModalTitle').textContent = 'Add Campaign';
    document.getElementById('campaignForm').reset();
    document.getElementById('campaignId').value = '';
    document.getElementById('campaignLeadId').value = leadId;
    document.getElementById('campaignStatus').value = 'Planning';
    document.getElementById('campaignProgress').value = 0;
    document.getElementById('campaignStartDate').value = new Date().toISOString().split('T')[0];
    openModal('campaignModal');
}

async function openEditCampaignModal(campaignId) {
    try {
        const c = await apiFetch(`/api/campaigns/${campaignId}`);
        document.getElementById('campaignModalTitle').textContent = 'Edit Campaign';
        document.getElementById('campaignId').value = c.id;
        document.getElementById('campaignLeadId').value = c.team_lead_id;
        document.getElementById('campaignName').value = c.name;
        document.getElementById('campaignType').value = c.campaign_type;
        document.getElementById('campaignChannel').value = c.channel;
        document.getElementById('campaignDescription').value = c.description || '';
        document.getElementById('campaignStatus').value = c.status;
        document.getElementById('campaignProgress').value = c.progress;
        document.getElementById('campaignStartDate').value = c.start_date;
        document.getElementById('campaignEndDate').value = c.target_end_date || '';
        openModal('campaignModal');
    } catch (e) {
        showToast('Error loading campaign: ' + e.message, 'error');
    }
}

async function saveCampaign(event) {
    event.preventDefault();
    if (!validateForm('campaignForm')) return;

    const id = document.getElementById('campaignId').value;
    const leadId = document.getElementById('campaignLeadId').value;
    const data = {
        name: document.getElementById('campaignName').value,
        campaign_type: document.getElementById('campaignType').value,
        channel: document.getElementById('campaignChannel').value,
        description: document.getElementById('campaignDescription').value,
        status: document.getElementById('campaignStatus').value,
        progress: parseInt(document.getElementById('campaignProgress').value) || 0,
        start_date: document.getElementById('campaignStartDate').value,
        target_end_date: document.getElementById('campaignEndDate').value || null,
        team_lead_id: parseInt(leadId),
    };

    try {
        if (id) {
            await apiFetch(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            showToast('Campaign updated');
        } else {
            await apiFetch('/api/campaigns', { method: 'POST', body: JSON.stringify(data) });
            showToast('Campaign added');
        }
        closeModal('campaignModal');
        renderCampaignsForLead(parseInt(leadId));
        renderSummary();
        renderTimeline();
        renderActivity();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteCampaign(campaignId) {
    if (!confirm('Delete this campaign?')) return;
    try {
        const c = await apiFetch(`/api/campaigns/${campaignId}`);
        await apiFetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
        showToast('Campaign deleted');
        if (c) renderCampaignsForLead(c.team_lead_id);
        renderSummary();
        renderTimeline();
        renderActivity();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function seedData() {
    try {
        const result = await apiFetch('/api/seed');
        showToast(result.message);
        renderLeads();
        renderSummary();
        renderTimeline();
        renderActivity();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// --- Tabs ---
function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('view-active'));
    document.getElementById(`tab-${name}`).classList.add('tab-active');
    document.getElementById(`view-${name}`).classList.add('view-active');

    if (name === 'timeline') renderTimeline();
    if (name === 'activity') renderActivity();
}

// --- Timeline ---
async function renderTimeline() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    try {
        const campaigns = await apiFetch('/api/campaigns');
        if (campaigns.length === 0) {
            container.innerHTML = '<p class="timeline-empty">No campaigns to show on timeline.</p>';
            return;
        }

        // Find date range with padding
        const today = new Date();
        let minDate = null, maxDate = null;
        const cData = [];
        for (const c of campaigns) {
            const start = new Date(c.start_date);
            const end = c.target_end_date ? new Date(c.target_end_date) : new Date(start);
            // Extend end by 30 days if no target end date
            const endAdj = c.target_end_date ? new Date(end) : new Date(Math.max(end.getTime(), today.getTime()));
            // Extend ongoing campaigns to today
            if (c.status !== 'Completed' && c.status !== 'On Hold' && endAdj < today) {
                endAdj.setTime(today.getTime());
            }
            if (!minDate || start < minDate) minDate = new Date(start);
            if (!maxDate || endAdj > maxDate) maxDate = new Date(endAdj);

            const lead = await apiFetch(`/api/leads/${c.team_lead_id}`);
            cData.push({ ...c, start, end: endAdj, leadName: lead.name });
        }

        // Add 1 month padding
        minDate.setMonth(minDate.getMonth() - 1);
        maxDate.setMonth(maxDate.getMonth() + 1);

        // Ensure today is within range
        if (today < minDate) minDate = new Date(today);
        if (today > maxDate) maxDate = new Date(today);
        maxDate.setMonth(maxDate.getMonth() + 1);

        const totalMs = maxDate.getTime() - minDate.getTime();
        if (totalMs <= 0) return;

        // Generate month headers
        const months = [];
        const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        while (cursor <= maxDate) {
            months.push(new Date(cursor));
            cursor.setMonth(cursor.getMonth() + 1);
        }

        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthWidth = 100 / months.length;

        const fmtDate = (d) => `${monthNames[d.getMonth()]} ${d.getDate()}`;

        let html = `
            <div class="timeline-header">
                <h3>Campaign Timeline</h3>
                <span style="font-size:12px;color:var(--text-muted);">${campaigns.length} campaigns &middot; ${fmtDate(minDate)} &mdash; ${fmtDate(maxDate)}</span>
            </div>
            <div class="timeline-scroll">
                <div class="timeline-months">
                    ${months.map(m => `<div class="timeline-month" style="width:${monthWidth}%">${monthNames[m.getMonth()]} ${m.getFullYear()}</div>`).join('')}
                </div>
                <div class="timeline-rows">
                    ${cData.map(c => {
                        const pctStart = Math.max(0, (c.start.getTime() - minDate.getTime()) / totalMs * 100);
                        const pctEnd = Math.min(100, Math.max(pctStart + 1, (c.end.getTime() - minDate.getTime()) / totalMs * 100));
                        const pctWidth = pctEnd - pctStart;
                        const statusClass = c.status.toLowerCase().replace(/ /g, '-');
                        return `
                            <div class="timeline-row">
                                <div class="timeline-row-label">
                                    <div>${c.name}</div>
                                    <div style="font-size:11px;color:var(--text-muted);font-weight:400;">${c.leadName}</div>
                                </div>
                                <div class="timeline-track">
                                    <div class="timeline-bar ${statusClass}" style="left:${pctStart}%;width:${pctWidth}%;" title="${c.name}: ${c.status} (${c.progress}%)">
                                        ${c.name.length > 16 ? c.name.slice(0, 14) + '\u2026' : c.name}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    ${today >= minDate && today <= maxDate ? (() => {
                        const pctToday = (today.getTime() - minDate.getTime()) / totalMs * 100;
                        return `<div class="timeline-today-marker" style="left:${pctToday}%;"></div>`;
                    })() : ''}
                </div>
            </div>
        `;

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p class="timeline-empty">Error loading timeline: ${e.message}</p>`;
    }
}

// --- Activity Log ---
async function renderActivity() {
    const container = document.getElementById('activityContainer');
    if (!container) return;
    try {
        const activities = await apiFetch('/api/activities');
        if (activities.length === 0) {
            container.innerHTML = '<div class="activity-empty">No activity recorded yet.</div>';
            return;
        }

        const now = new Date();
        const fmtTime = (d) => {
            const dt = new Date(d);
            const diff = now - dt;
            if (diff < 60000) return 'just now';
            if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
            if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
            return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        const actionLabels = { created: 'Created', updated: 'Updated', deleted: 'Deleted' };
        const entityLabels = { lead: 'Team Lead', campaign: 'Campaign' };
        const actionIcons = { created: '+', updated: '\u270E', deleted: '\u2716' };

        container.innerHTML = `
            <div class="activity-header">
                <h3>Recent Activity</h3>
                <span style="font-size:12px;color:var(--text-muted);">${activities.length} entries</span>
            </div>
            <div class="activity-list">
                ${activities.map(a => `
                    <div class="activity-item">
                        <div class="activity-icon ${a.action}">${actionIcons[a.action] || '\u2022'}</div>
                        <div class="activity-body">
                            <div>
                                <span class="activity-action ${a.action}">${actionLabels[a.action] || a.action}</span>
                                <span class="activity-entity">${a.entity_name}</span>
                                <span style="color:var(--text-muted);font-size:12px;">${entityLabels[a.entity_type] || a.entity_type}</span>
                            </div>
                            ${a.details ? `<div class="activity-details">${a.details}</div>` : ''}
                        </div>
                        <div class="activity-time">${fmtTime(a.created_at)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="activity-empty">Error loading activity: ${e.message}</div>`;
    }
}
