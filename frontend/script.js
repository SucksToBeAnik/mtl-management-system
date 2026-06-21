// Change this to your Render backend URL in production
const API = window.API_URL || 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', () => {
    renderLeads();
    renderSummary();
});

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
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Summary ---
async function renderSummary() {
    try {
        const data = await apiFetch('/api/dashboard/summary');
        const container = document.getElementById('summary');
        container.innerHTML = `
            <div class="summary-card accent-blue">
                <div class="value">${data.total_leads}</div>
                <div class="label">Total Team Leads</div>
            </div>
            <div class="summary-card accent-green">
                <div class="value">${data.total_campaigns}</div>
                <div class="label">Total Campaigns</div>
            </div>
            <div class="summary-card accent-orange">
                <div class="value">${data.active_campaigns}</div>
                <div class="label">Active Campaigns</div>
            </div>
            <div class="summary-card accent-purple">
                <div class="value">${data.completed_campaigns}</div>
                <div class="label">Completed</div>
            </div>
            <div class="summary-card accent-red">
                <div class="value">${Object.keys(data.department_breakdown || {}).length}</div>
                <div class="label">Departments</div>
            </div>
        `;
    } catch (e) {
        console.error('Summary error:', e);
    }
}

// --- Leads CRUD ---
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
                <td>${lead.campaigns ? lead.campaigns.length : '...'}</td>
                <td class="actions-cell">
                    <button class="btn-icon" onclick="event.stopPropagation(); openEditLeadModal(${lead.id})">Edit</button>
                    <button class="btn-icon" style="color:#ef4444;" onclick="event.stopPropagation(); deleteLead(${lead.id})">Delete</button>
                </td>
            </tr>
            <tr class="campaigns-subtable ${expandedLeadId === lead.id ? 'open' : ''}" id="campaigns-${lead.id}">
                <td colspan="6" style="padding:0;">
                    <div id="campaigns-content-${lead.id}"></div>
                </td>
            </tr>
        `).join('');

        // Load campaigns for expanded leads
        if (expandedLeadId !== null) {
            const lead = leads.find(l => l.id === expandedLeadId);
            if (lead) {
                renderCampaignsForLead(expandedLeadId);
            }
        }
    } catch (e) {
        document.getElementById('leadsBody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#ef4444;">Error loading leads: ${e.message}</td></tr>`;
    }
}

function toggleCampaigns(leadId) {
    if (expandedLeadId === leadId) {
        expandedLeadId = null;
    } else {
        expandedLeadId = leadId;
    }
    renderLeads();
}

async function renderCampaignsForLead(leadId) {
    const container = document.getElementById(`campaigns-content-${leadId}`);
    if (!container) return;
    try {
        const campaignStatusFilter = document.getElementById(`camp-status-${leadId}`)?.value || '';
        const campaignTypeFilter = document.getElementById(`camp-type-${leadId}`)?.value || '';

        let url = `/api/campaigns?lead_id=${leadId}`;
        if (campaignStatusFilter) url += `&status=${encodeURIComponent(campaignStatusFilter)}`;
        if (campaignTypeFilter) url += `&campaign_type=${encodeURIComponent(campaignTypeFilter)}`;

        const campaigns = await apiFetch(url);
        const lead = await apiFetch(`/api/leads/${leadId}`);

        const filterBar = `
            <div style="padding:8px 24px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #eee;">
                <span style="font-size:12px;color:#6b7280;font-weight:500;">Filter:</span>
                <select id="camp-status-${leadId}" onchange="renderCampaignsForLead(${leadId})" style="padding:4px 8px;font-size:12px;border:1px solid #d1d5db;border-radius:4px;">
                    <option value="">All Status</option>
                    <option value="Planning" ${campaignStatusFilter === 'Planning' ? 'selected' : ''}>Planning</option>
                    <option value="In Progress" ${campaignStatusFilter === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Review" ${campaignStatusFilter === 'Review' ? 'selected' : ''}>Review</option>
                    <option value="Completed" ${campaignStatusFilter === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="On Hold" ${campaignStatusFilter === 'On Hold' ? 'selected' : ''}>On Hold</option>
                </select>
                <select id="camp-type-${leadId}" onchange="renderCampaignsForLead(${leadId})" style="padding:4px 8px;font-size:12px;border:1px solid #d1d5db;border-radius:4px;">
                    <option value="">All Types</option>
                    <option value="Social" ${campaignTypeFilter === 'Social' ? 'selected' : ''}>Social</option>
                    <option value="Email" ${campaignTypeFilter === 'Email' ? 'selected' : ''}>Email</option>
                    <option value="PPC" ${campaignTypeFilter === 'PPC' ? 'selected' : ''}>PPC</option>
                    <option value="SEO" ${campaignTypeFilter === 'SEO' ? 'selected' : ''}>SEO</option>
                    <option value="Content" ${campaignTypeFilter === 'Content' ? 'selected' : ''}>Content</option>
                    <option value="Other" ${campaignTypeFilter === 'Other' ? 'selected' : ''}>Other</option>
                </select>
                <span style="font-size:12px;color:#9ca3af;">${campaigns.length} campaign(s)</span>
            </div>
        `;

        if (campaigns.length === 0) {
            container.innerHTML = `
                ${filterBar}
                <div style="padding:16px 24px;color:#9ca3af;font-size:13px;">
                    No campaigns match your filters.
                    <button class="btn btn-primary btn-sm add-campaign-btn" onclick="openAddCampaignModal(${leadId})">+ Add Campaign</button>
                </div>
            `;
            return;
        }
        container.innerHTML = `
            <div style="padding:12px 24px 4px 24px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;font-size:14px;">Campaigns for ${lead.name}</span>
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openAddCampaignModal(${leadId})">+ Add Campaign</button>
            </div>
            ${filterBar}
            <table style="width:100%;">
                <thead>
                    <tr>
                        <th style="padding:8px 12px;font-size:12px;">Name</th>
                        <th style="padding:8px 12px;font-size:12px;">Type</th>
                        <th style="padding:8px 12px;font-size:12px;">Channel</th>
                        <th style="padding:8px 12px;font-size:12px;">Status</th>
                        <th style="padding:8px 12px;font-size:12px;">Progress</th>
                        <th style="padding:8px 12px;font-size:12px;">Dates</th>
                        <th style="padding:8px 12px;font-size:12px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${campaigns.map(c => {
                        const statusClass = c.status.toLowerCase().replace(' ', '-');
                        return `<tr style="background:#f8fafc;">
                            <td style="padding:8px 12px;font-size:13px;">${c.name}</td>
                            <td style="padding:8px 12px;font-size:13px;"><span class="badge badge-${statusClass}">${c.campaign_type}</span></td>
                            <td style="padding:8px 12px;font-size:13px;">${c.channel}</td>
                            <td style="padding:8px 12px;font-size:13px;"><span class="badge badge-${statusClass}">${c.status}</span></td>
                            <td style="padding:8px 12px;font-size:13px;">
                                <div class="progress-bar"><div class="progress-fill" style="width:${c.progress}%"></div></div>
                                <span class="progress-text">${c.progress}%</span>
                            </td>
                            <td style="padding:8px 12px;font-size:12px;">${formatDate(c.start_date)} — ${formatDate(c.target_end_date)}</td>
                            <td class="actions-cell" style="padding:8px 12px;">
                                <button class="btn-icon" style="font-size:12px;" onclick="event.stopPropagation(); openEditCampaignModal(${c.id})">Edit</button>
                                <button class="btn-icon" style="font-size:12px;color:#ef4444;" onclick="event.stopPropagation(); deleteCampaign(${c.id})">Delete</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        container.innerHTML = `<div style="padding:16px;color:#ef4444;font-size:13px;">Error loading campaigns: ${e.message}</div>`;
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
            await apiFetch(`/api/leads/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            showToast('Team lead updated');
        } else {
            await apiFetch('/api/leads', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            showToast('Team lead added');
        }
        closeModal('leadModal');
        renderLeads();
        renderSummary();
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
            await apiFetch(`/api/campaigns/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            showToast('Campaign updated');
        } else {
            await apiFetch('/api/campaigns', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            showToast('Campaign added');
        }
        closeModal('campaignModal');
        renderCampaignsForLead(parseInt(leadId));
        renderSummary();
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
    } catch (e) {
        showToast(e.message, 'error');
    }
}
