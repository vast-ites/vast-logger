import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellRing, Plus, Trash2, VolumeX, Volume2, Save, X, Pencil } from 'lucide-react';

export const Alerts = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('rules');
    const [rules, setRules] = useState([]);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const role = localStorage.getItem('role');

    const [showRuleModal, setShowRuleModal] = useState(false);
    const [showChannelModal, setShowChannelModal] = useState(false);
    const [showSilenceModal, setShowSilenceModal] = useState(false);
    const [selectedRule, setSelectedRule] = useState(null); // For silencing
    const [editingRuleId, setEditingRuleId] = useState(null); // For editing
    const [customPort, setCustomPort] = useState('');

    // Form States
    const [newRule, setNewRule] = useState({ name: '', metric: 'cpu_percent', host: '*', operator: '>', threshold: 80, channels: [], enabled: true });
    const [newChannel, setNewChannel] = useState({ name: '', type: 'webhook', config: { url: '', email: '' } });
    const [silenceDuration, setSilenceDuration] = useState('1h');
    const [silenceHost, setSilenceHost] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    // Check for pre-fill params from Connections page (e.g. ?metric=connection_count&threshold=50&host=fusionpbx)
    useEffect(() => {
        const metric = searchParams.get('metric');
        const threshold = searchParams.get('threshold');
        const host = searchParams.get('host');
        if (metric) {
            const hostLabel = host && host !== '*' ? ` on ${host}` : '';
            const metricLabel = metric === 'connection_count' ? 'Total Connections' : metric.replace('connection_port_', 'Port ');
            setNewRule({
                name: `${metricLabel} Alert${hostLabel}`,
                metric: metric,
                host: host || '*',
                operator: '>',
                threshold: threshold ? parseFloat(threshold) : 50,
                channels: [],
                enabled: true,
            });
            setEditingRuleId(null);
            setShowRuleModal(true);
            // Clear params so refreshing doesn't re-open
            setSearchParams({}, { replace: true });
        }
    }, [searchParams]);

    const fetchData = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        try {
            const [rulesRes, chansRes] = await Promise.all([
                fetch('/api/v1/alerts/rules', { headers }),
                fetch('/api/v1/alerts/channels', { headers })
            ]);
            if (rulesRes.ok) setRules(await rulesRes.json() || []);
            if (chansRes.ok) setChannels(await chansRes.json() || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleCreateOrUpdateRule = async () => {
        const token = localStorage.getItem('token');
        const method = editingRuleId ? 'PUT' : 'POST';
        const url = editingRuleId ? `/api/v1/alerts/rules/${editingRuleId}` : '/api/v1/alerts/rules';

        await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newRule, threshold: parseFloat(newRule.threshold) })
        });
        setShowRuleModal(false);
        setEditingRuleId(null);
        setNewRule({ name: '', metric: 'cpu_percent', host: '*', operator: '>', threshold: 80, channels: [], enabled: true });
        fetchData();
    };

    const handleEditRule = (rule) => {
        setNewRule({ ...rule });
        setEditingRuleId(rule.id);
        setShowRuleModal(true);
    };

    const handleDeleteRule = async (id) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/v1/alerts/rules/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchData();
    };

    const handleToggleRule = async (id) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/v1/alerts/rules/${id}/toggle`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        fetchData();
    };

    const handleCreateChannel = async () => {
        const token = localStorage.getItem('token');
        const cfg = {};
        if (newChannel.type === 'webhook') cfg.url = newChannel.config.url;
        if (newChannel.type === 'email') cfg.email = newChannel.config.email;

        await fetch('/api/v1/alerts/channels', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newChannel.name, type: newChannel.type, config: cfg })
        });
        setShowChannelModal(false);
        fetchData();
    };

    const handleDeleteChannel = async (id) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/v1/alerts/channels/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchData();
    };

    const handleSilence = async () => {
        const token = localStorage.getItem('token');
        const targetHost = silenceHost.trim() === '' ? '*' : silenceHost.trim();
        await fetch('/api/v1/alerts/silence', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ rule_id: selectedRule.id, host: targetHost, duration: silenceDuration })
        });
        setShowSilenceModal(false);
        fetchData();
    };

    const handleUnsilence = async (ruleId, host) => {
        const token = localStorage.getItem('token');
        await fetch('/api/v1/alerts/unsilence', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ rule_id: ruleId, host })
        });
        fetchData();
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-cyber-text flex items-center gap-2">
                <BellRing className="text-cyan-400" /> Alerting System
            </h1>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-cyber-gray/20 pb-1">
                <button onClick={() => setActiveTab('rules')} className={`px-4 py-2 text-sm font-semibold transition ${activeTab === 'rules' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-cyber-muted hover:text-cyber-text'}`}>Alert Rules</button>
                <button onClick={() => setActiveTab('channels')} className={`px-4 py-2 text-sm font-semibold transition ${activeTab === 'channels' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-cyber-muted hover:text-cyber-text'}`}>Notification Channels</button>
            </div>

            {/* Rules Content */}
            {activeTab === 'rules' && (
                <div className="space-y-4">
                    {role === 'admin' && (
                        <div className="flex justify-end">
                            <button onClick={() => { setEditingRuleId(null); setNewRule({ name: '', metric: 'cpu_percent', host: '*', operator: '>', threshold: 80, channels: [], enabled: true }); setShowRuleModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition text-sm font-semibold">
                                <Plus size={16} /> Create Rule
                            </button>
                        </div>
                    )}

                    <div className="grid gap-4">
                        {rules.map(rule => (
                            <div key={rule.id} className="glass-panel p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-cyber-gray/20 rounded-lg">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg text-cyber-text">{rule.name}</h3>
                                        {role === 'admin' ? (
                                            <button onClick={() => handleToggleRule(rule.id)} className={`px-2 py-0.5 text-[10px] rounded cursor-pointer hover:opacity-80 transition ${rule.enabled ? 'bg-green-500/20 text-green-400' : 'bg-cyber-gray/20 text-cyber-muted'}`}>
                                                {rule.enabled ? 'ENABLED' : 'DISABLED'}
                                            </button>
                                        ) : (
                                            <span className={`px-2 py-0.5 text-[10px] rounded ${rule.enabled ? 'bg-green-500/20 text-green-400' : 'bg-cyber-gray/20 text-cyber-muted'}`}>
                                                {rule.enabled ? 'ENABLED' : 'DISABLED'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1 font-mono font-medium">
                                        if <span className="text-cyan-600 dark:text-cyan-400 font-bold">{rule.metric}</span> {rule.operator} <span className="text-amber-600 dark:text-amber-400 font-bold">{rule.threshold}</span> on <span className="text-violet-600 dark:text-violet-400 font-bold">{rule.host}</span>
                                    </div>

                                    {/* Silenced Status */}
                                    {rule.silenced && Object.keys(rule.silenced).length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {Object.entries(rule.silenced)
                                                .filter(([_, expire]) => new Date(expire) > new Date())
                                                .map(([host, expire]) => (
                                                    <div key={host} className="flex items-center gap-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-500">
                                                        <VolumeX size={10} />
                                                        <span>Silenced on <b>{host}</b> until {new Date(expire).toLocaleTimeString()}</span>
                                                        {role === 'admin' && <button onClick={() => handleUnsilence(rule.id, host)} className="hover:text-white"><X size={10} /></button>}
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                                {role === 'admin' && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { setSelectedRule(rule); setSilenceHost(rule.host === '*' ? '' : rule.host); setShowSilenceModal(true); }}
                                            className="p-2 bg-cyber-gray/5 hover:bg-cyber-gray/10 rounded text-amber-500 hover:text-amber-600 transition-colors" title="Silence Rule"
                                        >
                                            <VolumeX size={18} />
                                        </button>
                                        <button onClick={() => handleEditRule(rule)} className="p-2 bg-cyber-gray/5 hover:bg-cyan-500/10 rounded text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors" title="Edit Rule"><Pencil size={18} /></button>
                                        <button onClick={() => handleDeleteRule(rule.id)} className="p-2 bg-cyber-gray/5 hover:bg-red-500/10 rounded text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete Rule"><Trash2 size={18} /></button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {rules.length === 0 && !loading && <div className="text-center text-gray-500 py-10">No alert rules defined. Creates one to get started.</div>}
                    </div>
                </div>
            )}

            {/* Channels Content */}
            {activeTab === 'channels' && (
                <div className="space-y-4">
                    {role === 'admin' && (
                        <div className="flex justify-end">
                            <button onClick={() => setShowChannelModal(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded transition text-sm font-semibold">
                                <Plus size={16} /> Add Channel
                            </button>
                        </div>
                    )}
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        {channels.map(ch => (
                            <div key={ch.id} className="glass-panel p-4 border border-cyber-gray/20 rounded-lg">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-cyber-text">{ch.name}</h3>
                                        <div className="text-xs text-cyan-600 dark:text-cyan-400 font-mono mt-1 uppercase">{ch.type}</div>
                                        <div className="text-sm text-gray-500 mt-2 break-all">{ch.config.url || ch.config.email}</div>
                                    </div>
                                    {role === 'admin' && <button onClick={() => handleDeleteChannel(ch.id)} className="text-red-500 hover:text-red-400"><Trash2 size={16} /></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Rule Modal */}
            {showRuleModal && (
                <div className="fixed inset-0 bg-cyber-black/80 flex items-center justify-center z-50 p-4">
                    <div className="glass-panel border border-cyber-gray/30 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <h2 className="text-xl font-bold text-cyber-text mb-6">{editingRuleId ? 'Edit Alert Rule' : 'Create Alert Rule'}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Rule Name</label>
                                <input className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text focus:border-cyan-500 outline-none transition-colors" placeholder="e.g. High CPU Load" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Metric</label>
                                    <select className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text outline-none transition-colors" value={newRule.metric.startsWith('connection_port_') && !['connection_port_443', 'connection_port_80', 'connection_port_22', 'connection_port_3306', 'connection_port_5432'].includes(newRule.metric) ? 'custom_port' : newRule.metric} onChange={e => {
                                        if (e.target.value === 'custom_port') {
                                            setCustomPort('');
                                            setNewRule({ ...newRule, metric: 'connection_port_' });
                                        } else {
                                            setNewRule({ ...newRule, metric: e.target.value });
                                        }
                                    }}>
                                        <optgroup label="System" className="bg-cyber-background text-cyber-text">
                                            <option value="cpu_percent" className="bg-cyber-background text-cyber-text">CPU Usage (%)</option>
                                            <option value="memory_usage" className="bg-cyber-background text-cyber-text">Memory Usage (%)</option>
                                            <option value="disk_usage" className="bg-cyber-background text-cyber-text">Disk Usage (%)</option>
                                        </optgroup>
                                        <optgroup label="Network" className="bg-cyber-background text-cyber-text">
                                            <option value="net_recv_rate" className="bg-cyber-background text-cyber-text">Net Download (B/s)</option>
                                            <option value="net_sent_rate" className="bg-cyber-background text-cyber-text">Net Upload (B/s)</option>
                                            <option value="net_total_rate" className="bg-cyber-background text-cyber-text">Net Total (B/s)</option>
                                        </optgroup>
                                        <optgroup label="Connections" className="bg-cyber-background text-cyber-text">
                                            <option value="connection_count" className="bg-cyber-background text-cyber-text">Total Connections</option>
                                            <option value="connection_port_443" className="bg-cyber-background text-cyber-text">Port 443 Connections</option>
                                            <option value="connection_port_80" className="bg-cyber-background text-cyber-text">Port 80 Connections</option>
                                            <option value="connection_port_22" className="bg-cyber-background text-cyber-text">Port 22 (SSH) Connections</option>
                                            <option value="connection_port_3306" className="bg-cyber-background text-cyber-text">Port 3306 (MySQL) Connections</option>
                                            <option value="connection_port_5432" className="bg-cyber-background text-cyber-text">Port 5432 (Postgres) Connections</option>
                                            <option value="custom_port" className="bg-cyber-background text-cyber-text">🔧 Custom Port...</option>
                                        </optgroup>
                                    </select>
                                    {(newRule.metric === 'connection_port_' || (newRule.metric.startsWith('connection_port_') && !['connection_port_443', 'connection_port_80', 'connection_port_22', 'connection_port_3306', 'connection_port_5432'].includes(newRule.metric))) && (
                                        <input
                                            type="number"
                                            min="1"
                                            max="65535"
                                            placeholder="Enter port number (e.g. 8080)"
                                            value={customPort || newRule.metric.replace('connection_port_', '')}
                                            onChange={(e) => {
                                                setCustomPort(e.target.value);
                                                if (e.target.value) {
                                                    setNewRule({ ...newRule, metric: `connection_port_${e.target.value}` });
                                                }
                                            }}
                                            className="w-full mt-2 bg-cyber-gray/10 border border-cyan-500/30 rounded p-2 text-cyan-400 font-mono text-sm outline-none focus:border-cyan-500/60 transition-colors"
                                            autoFocus
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Target Host</label>
                                    <input className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text outline-none transition-colors" placeholder="* for Any" value={newRule.host} onChange={e => setNewRule({ ...newRule, host: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Operator</label>
                                    <select className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text outline-none transition-colors" value={newRule.operator} onChange={e => setNewRule({ ...newRule, operator: e.target.value })}>
                                        <option value=">" className="bg-cyber-background text-cyber-text">&gt; (Greater)</option>
                                        <option value="<" className="bg-cyber-background text-cyber-text">&lt; (Less)</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Threshold</label>
                                    <input type="number" className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text outline-none transition-colors" value={newRule.threshold} onChange={e => setNewRule({ ...newRule, threshold: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Notification Channels (Select Multiple)</label>
                                <select multiple className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text h-24 outline-none transition-colors" onChange={e => setNewRule({ ...newRule, channels: Array.from(e.target.selectedOptions, o => o.value) })}>
                                    {channels.map(ch => <option key={ch.id} value={ch.id} className="bg-cyber-background text-cyber-text">{ch.name} ({ch.type})</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowRuleModal(false)} className="px-4 py-2 text-cyber-muted hover:text-cyber-text">Cancel</button>
                            <button onClick={handleCreateOrUpdateRule} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition-colors">{editingRuleId ? 'Update Rule' : 'Create Rule'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Channel Modal */}
            {showChannelModal && (
                <div className="fixed inset-0 bg-cyber-black/80 flex items-center justify-center z-50 p-4">
                    <div className="glass-panel border border-cyber-gray/30 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <h2 className="text-xl font-bold text-cyber-text mb-6">Add Notification Channel</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Channel Name</label>
                                <input className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text outline-none focus:border-cyan-500 transition-colors" placeholder="e.g. Critical Team Slack" value={newChannel.name} onChange={e => setNewChannel({ ...newChannel, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Type</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-cyber-text cursor-pointer">
                                        <input type="radio" checked={newChannel.type === 'webhook'} onChange={() => setNewChannel({ ...newChannel, type: 'webhook' })} /> Webhook
                                    </label>
                                    <label className="flex items-center gap-2 text-cyber-text cursor-pointer">
                                        <input type="radio" checked={newChannel.type === 'email'} onChange={() => setNewChannel({ ...newChannel, type: 'email' })} /> Email
                                    </label>
                                </div>
                            </div>
                            {newChannel.type === 'webhook' && (
                                <div>
                                    <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Webhook URL</label>
                                    <input className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text outline-none focus:border-cyan-500 transition-colors" placeholder="https://discord.com/api/webhooks/..." value={newChannel.config.url} onChange={e => setNewChannel({ ...newChannel, config: { ...newChannel.config, url: e.target.value } })} />
                                </div>
                            )}
                            {newChannel.type === 'email' && (
                                <div>
                                    <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Email Address</label>
                                    <input className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text outline-none focus:border-cyan-500 transition-colors" placeholder="oncall@company.com" value={newChannel.config.email} onChange={e => setNewChannel({ ...newChannel, config: { ...newChannel.config, email: e.target.value } })} />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowChannelModal(false)} className="px-4 py-2 text-cyber-muted hover:text-cyber-text">Cancel</button>
                            <button onClick={handleCreateChannel} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded font-bold transition-colors">Add Channel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Silence Modal */}
            {showSilenceModal && selectedRule && (
                <div className="fixed inset-0 bg-cyber-black/80 flex items-center justify-center z-50 p-4">
                    <div className="glass-panel border border-cyber-gray/30 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                        <h2 className="text-xl font-bold text-cyber-text mb-4">Silence Alert</h2>
                        <p className="text-sm text-cyber-muted mb-4">Silence <strong className="text-cyber-text">{selectedRule.name}</strong>?</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Hostname (Optional)</label>
                                <input className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text outline-none focus:border-cyan-500 transition-colors" placeholder="Specific Host or Empty for All" value={silenceHost} onChange={e => setSilenceHost(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-cyber-muted font-bold mb-1">Duration</label>
                                <select className="w-full bg-cyber-gray/10 border border-cyber-gray/30 rounded p-2 text-cyber-text outline-none focus:border-cyan-500 transition-colors" value={silenceDuration} onChange={e => setSilenceDuration(e.target.value)}>
                                    <option value="15m" className="bg-cyber-background text-cyber-text">15 Minutes</option>
                                    <option value="1h" className="bg-cyber-background text-cyber-text">1 Hour</option>
                                    <option value="6h" className="bg-cyber-background text-cyber-text">6 Hours</option>
                                    <option value="24h" className="bg-cyber-background text-cyber-text">24 Hours</option>
                                    <option value="72h" className="bg-cyber-background text-cyber-text">3 Days</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowSilenceModal(false)} className="px-4 py-2 text-cyber-muted hover:text-cyber-text">Cancel</button>
                            <button onClick={handleSilence} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold transition-colors">Silence</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
