import React, { useState, useEffect, useRef } from 'react';
import { Users, Server, Shield, Trash2, UserPlus, Folder, Edit, X, Check, Search, Key } from 'lucide-react';

/* HostSelector */
const HostSelector = ({ onSelectionChange, initialSelected = [] }) => {
    const [availableHosts, setAvailableHosts] = useState([]);
    const [selected, setSelected] = useState([...initialSelected]);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => { setSelected([...initialSelected]); }, [JSON.stringify(initialSelected)]);

    useEffect(() => {
        fetch('/api/v1/hosts', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                const hosts = Array.isArray(data) ? data.map(h => (typeof h === 'string' ? h : h.hostname || h.name || String(h))) : [];
                setAvailableHosts(hosts);
            })
            .catch(() => setAvailableHosts([]));
    }, []);

    // Close on click outside
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const pick = (host) => {
        setSelected(prev => {
            let next;
            if (host === '*') {
                next = prev.includes('*') ? [] : ['*'];
            } else {
                const without = prev.filter(h => h !== '*');
                next = without.includes(host) ? without.filter(h => h !== host) : [...without, host];
            }
            onSelectionChange(next);
            return next;
        });
    };

    const label = selected.includes('*')
        ? <span className="text-green-400 font-bold">ALL HOSTS (*)</span>
        : selected.length === 0
            ? <span className="text-gray-500">Select Hosts...</span>
            : selected.length > 2
                ? `${selected.length} hosts selected`
                : selected.join(', ');

    return (
        <div className="relative flex-1" ref={wrapperRef}>
            <div
                onMouseDown={(e) => { e.preventDefault(); setOpen(o => !o); }}
                className="bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-sm text-cyber-text h-10 flex items-center gap-2 cursor-pointer overflow-hidden whitespace-nowrap select-none"
            >
                {label}
            </div>
            {open && (
                <div className="absolute top-11 left-0 z-[9999] w-64 bg-gray-900 border border-cyber-cyan rounded shadow-xl p-2 max-h-60 overflow-y-auto">
                    <div
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSelected([]); onSelectionChange([]); setOpen(false); }}
                        className="px-2 py-1 hover:bg-white/10 cursor-pointer text-xs text-red-400 border-b border-white/10 mb-1 select-none"
                    >Clear Selection</div>
                    {availableHosts.map(host => (
                        <div
                            key={host}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pick(host); }}
                            className={`px-2 py-1 cursor-pointer text-sm flex items-center justify-between hover:bg-white/10 select-none ${selected.includes(host) ? 'text-cyber-cyan font-bold' : 'text-gray-300'}`}
                        >
                            {host} {selected.includes(host) && <span>✓</span>}
                        </div>
                    ))}
                    <div className="mt-2 pt-2 border-t border-white/10">
                        <div
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pick('*'); }}
                            className={`px-2 py-1 cursor-pointer text-sm hover:bg-white/10 select-none ${selected.includes('*') ? 'text-green-400 font-bold' : 'text-gray-400'}`}
                        >ALL HOSTS (*)</div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* EditGroupModal */
const EditGroupModal = ({ group, allUsers, onClose, onSave }) => {
    const nameRef = useRef(null);
    const roleRef = useRef(null);
    const [hosts, setHosts] = useState(group.hosts || []);
    const [selectedUsers, setSelectedUsers] = useState([]);

    useEffect(() => {
        const members = allUsers.filter(u => u.groups && u.groups.includes(group.id)).map(u => u.username);
        setSelectedUsers(members);
    }, [allUsers, group]);

    const handleSave = () => {
        onSave(group.id, {
            name: nameRef.current.value,
            role: roleRef.current.value,
            hosts: hosts, // Ensure hosts is an array
            users: selectedUsers
        });
    };

    const toggleUser = (username) => {
        if (selectedUsers.includes(username)) setSelectedUsers(selectedUsers.filter(u => u !== username));
        else setSelectedUsers([...selectedUsers, username]);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-cyber-gray/90 border border-cyber-cyan p-6 rounded-xl w-full max-w-2xl shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-cyber-muted hover:text-white"><X size={20} /></button>
                <h2 className="text-xl font-bold text-cyber-cyan mb-6 flex items-center gap-2"><Edit size={20} /> Edit Group: {group.name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div><label className="text-xs text-cyber-muted uppercase font-bold block mb-1">Group Name</label><input ref={nameRef} defaultValue={group.name} className="w-full bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-cyber-text" /></div>
                        <div><label className="text-xs text-cyber-muted uppercase font-bold block mb-1">Default Role</label><select ref={roleRef} defaultValue={group.role || 'viewer'} className="w-full bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-cyber-text"><option value="viewer">Viewer</option><option value="admin">Admin</option></select></div>
                        <div><label className="text-xs text-cyber-muted uppercase font-bold block mb-1">Server Access</label><HostSelector initialSelected={group.hosts || []} onSelectionChange={setHosts} /></div>
                    </div>
                    <div className="border border-cyber-dim rounded-lg p-3 bg-cyber-black/30 flex flex-col h-64">
                        <label className="text-xs text-cyber-muted uppercase font-bold block mb-2 flex justify-between"><span>Group Members</span><span className="text-cyber-cyan">{selectedUsers.length} selected</span></label>
                        <div className="overflow-y-auto flex-1 space-y-1 pr-1">
                            {allUsers.map(u => (
                                <div key={u.username} onClick={() => toggleUser(u.username)} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${selectedUsers.includes(u.username) ? 'bg-cyber-cyan/20 border border-cyber-cyan/50 text-white' : 'hover:bg-cyber-gray/50 text-gray-400'}`}>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedUsers.includes(u.username) ? 'bg-cyber-cyan border-cyber-cyan' : 'border-gray-500'}`}>{selectedUsers.includes(u.username) && <Check size={12} className="text-black" />}</div>
                                    <span>{u.username}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="mt-8 flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 rounded text-cyber-muted hover:bg-white/10">Cancel</button><button onClick={handleSave} className="bg-cyber-cyan text-black px-6 py-2 rounded font-bold hover:bg-white transition-colors">SAVE CHANGES</button></div>
            </div>
        </div>
    );
};

/* GroupManagement */
const GroupManagement = ({ groups, allUsers, onRefreshGroups, onRefreshUsers }) => {
    const [newGroupHosts, setNewGroupHosts] = useState([]);
    const [resetKey, setResetKey] = useState(0);
    const [editingGroup, setEditingGroup] = useState(null);
    const groupNameRef = useRef();
    const groupRoleRef = useRef();

    const createGroup = () => {
        const name = groupNameRef.current.value;
        const role = groupRoleRef.current.value;
        if (!name) return alert("Group Name Required");
        fetch('/api/v1/groups', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ name, role, hosts: newGroupHosts }) })
            .then(res => { if (res.ok) { alert("Created"); groupNameRef.current.value = ""; setResetKey(k => k + 1); onRefreshGroups(); } else alert("Failed"); });
    };

    const updateGroup = (id, data) => {
        fetch(`/api/v1/groups/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(data) })
            .then(res => { if (res.ok) { alert("Updated"); setEditingGroup(null); onRefreshGroups(); onRefreshUsers(); } else alert("Failed"); });
    };

    const deleteGroup = (id) => {
        if (confirm("Delete Group?")) fetch(`/api/v1/groups/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(() => onRefreshGroups());
    };

    return (
        <div className="glass-panel p-6 rounded-xl border border-cyber-gray">
            <h3 className="text-lg font-bold text-cyber-magenta mb-4 flex items-center gap-2"><Folder size={18} /> Server Groups</h3>
            <div className="mb-6 p-4 bg-cyber-gray/10 rounded border border-cyber-gray/20">
                <label className="text-xs font-bold text-cyber-muted uppercase block mb-2">Create New Group</label>
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <input ref={groupNameRef} placeholder="Group Name" className="bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-sm text-cyber-text flex-1" />
                        <select ref={groupRoleRef} className="bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-sm text-cyber-text h-10 w-32"><option value="viewer">Viewer</option><option value="admin">Admin</option></select>
                    </div>
                    <div className="flex gap-2 items-center"><HostSelector key={resetKey} onSelectionChange={setNewGroupHosts} /><button onClick={createGroup} className="bg-cyber-magenta/20 text-cyber-magenta px-4 py-2 rounded text-sm hover:bg-cyber-magenta/30 font-bold whitespace-nowrap h-10">ADD GROUP</button></div>
                </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {groups.map(g => (
                    <div key={g.id} className="flex justify-between items-center bg-cyber-gray/10 p-3 rounded border border-cyber-gray/20 hover:border-cyber-cyan/30 transition-colors">
                        <div className="flex-1">
                            <div className="text-cyber-text font-bold text-sm flex items-center gap-2"><Folder size={14} className="text-cyber-muted" /> {g.name} <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${g.role === 'admin' ? 'border-red-900 text-red-400 bg-red-900/10' : 'border-blue-900 text-blue-400 bg-blue-900/10'}`}>{g.role || 'viewer'}</span></div>
                            <div className="text-xs text-cyber-muted mt-1 px-4 truncate max-w-md">{g.hosts?.length > 0 ? <span className="text-cyber-cyan">{g.hosts.length > 3 ? `${g.hosts.length} hosts` : g.hosts.join(', ')}</span> : <span className="italic opacity-50">No hosts assigned</span>}</div>
                        </div>
                        <div className="flex gap-2"><button onClick={() => setEditingGroup(g)} className="text-cyber-cyan p-2 hover:bg-cyber-cyan/10 rounded"><Edit size={16} /></button><button onClick={() => deleteGroup(g.id)} className="text-red-400 p-2 hover:bg-red-900/20 rounded"><Trash2 size={16} /></button></div>
                    </div>
                ))}
                {groups.length === 0 && <div className="text-gray-500 text-xs p-2 italic">No groups defined.</div>}
            </div>
            {editingGroup && <EditGroupModal group={editingGroup} allUsers={allUsers} onClose={() => setEditingGroup(null)} onSave={updateGroup} />}
        </div>
    );
};

/* UserManagement */
const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [newUserHosts, setNewUserHosts] = useState([]);
    const [resetKey, setResetKey] = useState(0);
    const [editingUser, setEditingUser] = useState(null);
    const [changingPasswordUser, setChangingPasswordUser] = useState(null);
    const usernameRef = useRef();
    const passwordRef = useRef();
    const roleRef = useRef();

    const fetchData = () => {
        fetch('/api/v1/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()).then(d => setUsers(d || [])).catch(console.error);
        fetch('/api/v1/groups', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json()).then(d => setGroups(d || [])).catch(console.error);
    };

    useEffect(() => { fetchData(); }, []);

    const createUser = () => {
        const username = usernameRef.current.value;
        const password = passwordRef.current.value;
        if (!username || !password) return alert("Required");
        fetch('/api/v1/users', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ username, password, role: roleRef.current.value, allowed_hosts: newUserHosts }) })
            .then(res => { if (res.ok) { alert("Created"); usernameRef.current.value = ""; passwordRef.current.value = ""; setResetKey(k => k + 1); fetchData(); } else alert("Failed"); });
    };

    const deleteUser = (u) => { if (confirm("Delete?")) fetch(`/api/v1/users/${u}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(fetchData); };

    const updateUser = (username, data) => {
        fetch(`/api/v1/users/${username}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify(data)
        }).then(res => {
            if (res.ok) {
                alert("User updated successfully");
                setEditingUser(null);
                fetchData();
            } else {
                alert("Failed to update user");
            }
        });
    };

    const changePassword = (username, newPassword) => {
        fetch(`/api/v1/users/${username}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ password: newPassword })
        }).then(res => {
            if (res.ok) {
                alert("Password changed successfully");
                setChangingPasswordUser(null);
            } else {
                alert("Failed to change password");
            }
        });
    };

    const getGroupName = (id) => groups.find(g => g.id === id)?.name || id;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold font-display text-cyber-text flex items-center gap-3"><Users className="text-cyber-cyan" /> User & Access Management</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="glass-panel p-6 rounded-xl border border-cyber-gray relative z-20">
                        <h3 className="text-lg font-bold text-cyber-cyan mb-4 flex items-center gap-2"><UserPlus size={18} /> Create New User</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <input ref={usernameRef} placeholder="Username" className="bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-sm text-cyber-text" />
                            <input ref={passwordRef} placeholder="Password" type="password" className="bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-sm text-cyber-text" />
                        </div>
                        <div className="flex gap-4 items-center">
                            <select ref={roleRef} className="bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-sm text-cyber-text h-10 w-32"><option value="viewer">Viewer</option><option value="admin">Admin</option></select>
                            <HostSelector key={resetKey} onSelectionChange={setNewUserHosts} />
                            <button onClick={createUser} className="bg-cyber-cyan text-black font-bold rounded px-6 py-2 text-sm hover:bg-white transition-colors h-10 whitespace-nowrap">CREATE USER</button>
                        </div>
                    </div>
                    <div className="glass-panel p-0 rounded-xl border border-cyber-gray overflow-hidden">
                        <div className="p-4 border-b border-cyber-gray/30 bg-cyber-gray/5"><h3 className="font-bold text-cyber-text">System Users</h3></div>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-cyber-gray/20 text-cyber-cyan font-mono text-xs"><tr><th className="p-4">USERNAME</th><th className="p-4">ROLE</th><th className="p-4">ACCESS SCOPE</th><th className="p-4 text-right">ACTION</th></tr></thead>
                            <tbody className="divide-y divide-cyber-dim">
                                {users.map(u => (
                                    <tr key={u.username} className="hover:bg-cyber-gray/10 transition-colors">
                                        <td className="p-4 text-cyber-text font-bold flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyber-gray to-cyber-black flex items-center justify-center text-xs border border-cyber-dim">{u.username.substring(0, 2).toUpperCase()}</div>
                                            {u.username}
                                        </td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-mono ${u.role === 'admin' ? 'bg-red-900/20 text-red-400 border border-red-900/30' : 'bg-blue-900/20 text-blue-400 border border-blue-900/30'}`}>{u.role.toUpperCase()}</span></td>
                                        <td className="p-4 text-cyber-muted font-mono text-xs">
                                            {u.groups && u.groups.length > 0 && <div className="flex flex-wrap gap-1 mb-1">{u.groups.map(g => (<span key={g} className="bg-cyber-magenta/20 text-cyber-magenta px-1.5 rounded flex items-center gap-1 border border-cyber-magenta/30"><Folder size={10} /> {getGroupName(g)}</span>))}</div>}
                                            {u.allowed_hosts && u.allowed_hosts.length > 0 ? <div className="flex flex-wrap gap-1">{u.allowed_hosts.map(h => (<span key={h} className="bg-cyber-gray/30 px-1.5 rounded text-cyber-text">{h}</span>))}</div> : (u.groups?.length === 0 && <span className="text-green-400 flex items-center gap-1"><Shield size={12} /> FULL ACCESS</span>)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setEditingUser(u)} className="text-cyber-muted hover:text-cyan-400 transition-colors" title="Edit User">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => setChangingPasswordUser(u)} className="text-cyber-muted hover:text-amber-400 transition-colors" title="Change Password">
                                                    <Key size={16} />
                                                </button>
                                                <button onClick={() => deleteUser(u.username)} className="text-cyber-muted hover:text-red-500 transition-colors" title="Delete User">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-cyber-muted italic">No users found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="space-y-6">
                    <GroupManagement groups={groups} allUsers={users} onRefreshGroups={fetchData} onRefreshUsers={fetchData} />
                    <div className="glass-panel p-6 rounded-xl border border-cyber-gray bg-cyber-black/40">
                        <h4 className="text-sm font-bold text-cyber-muted uppercase tracking-wider mb-4">Access Control Guide</h4>
                        <ul className="space-y-3 text-xs text-cyber-muted">
                            <li className="flex gap-2"><span className="text-green-400 font-bold">Admin:</span><span>Full access.</span></li>
                            <li className="flex gap-2"><span className="text-blue-400 font-bold">Viewer:</span><span>Read-only access.</span></li>
                            <li className="flex gap-2"><span className="text-cyber-magenta font-bold">Groups:</span><span>Assign users.</span></li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-cyber-gray/90 border border-cyber-cyan p-6 rounded-xl w-full max-w-md shadow-2xl relative">
                        <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-cyber-muted hover:text-white">
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-cyber-cyan mb-6 flex items-center gap-2">
                            <Edit size={20} /> Edit User: {editingUser.username}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-cyber-muted uppercase font-bold block mb-1">Username (read-only)</label>
                                <input value={editingUser.username} disabled className="w-full bg-cyber-black/50 border border-cyber-dim rounded px-3 py-2 text-cyber-muted cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="text-xs text-cyber-muted uppercase font-bold block mb-1">Role</label>
                                <select
                                    value={editingUser.role}
                                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                    className="w-full bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-cyber-text"
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-cyber-muted uppercase font-bold block mb-1">Allowed Hosts</label>
                                <HostSelector
                                    initialSelected={editingUser.allowed_hosts || []}
                                    onSelectionChange={(hosts) => setEditingUser({ ...editingUser, allowed_hosts: hosts })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditingUser(null)} className="px-4 py-2 bg-cyber-gray/50 hover:bg-cyber-gray/70 text-cyber-text rounded transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={() => updateUser(editingUser.username, { role: editingUser.role, allowed_hosts: editingUser.allowed_hosts })}
                                className="px-4 py-2 bg-cyber-cyan hover:bg-cyber-cyan/80 text-black font-bold rounded transition-colors flex items-center gap-2"
                            >
                                <Check size={16} /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {changingPasswordUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-cyber-gray/90 border border-amber-500 p-6 rounded-xl w-full max-w-md shadow-2xl relative">
                        <button onClick={() => setChangingPasswordUser(null)} className="absolute top-4 right-4 text-cyber-muted hover:text-white">
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold text-amber-400 mb-6 flex items-center gap-2">
                            <Key size={20} /> Change Password: {changingPasswordUser.username}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-cyber-muted uppercase font-bold block mb-1">New Password</label>
                                <input
                                    type="password"
                                    id="new-password-input"
                                    className="w-full bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-cyber-text"
                                    placeholder="Enter new password"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-cyber-muted uppercase font-bold block mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    id="confirm-password-input"
                                    className="w-full bg-cyber-black border border-cyber-dim rounded px-3 py-2 text-cyber-text"
                                    placeholder="Confirm new password"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setChangingPasswordUser(null)} className="px-4 py-2 bg-cyber-gray/50 hover:bg-cyber-gray/70 text-cyber-text rounded transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const newPass = document.getElementById('new-password-input').value;
                                    const confirmPass = document.getElementById('confirm-password-input').value;
                                    if (!newPass || !confirmPass) return alert('Please fill all fields');
                                    if (newPass !== confirmPass) return alert('Passwords do not match');
                                    if (newPass.length < 4) return alert('Password must be at least 4 characters');
                                    changePassword(changingPasswordUser.username, newPass);
                                }}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded transition-colors flex items-center gap-2"
                            >
                                <Key size={16} /> Change Password
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default UserManagement;
