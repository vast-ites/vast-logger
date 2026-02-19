import React, { useState } from 'react';
import { AlertOctagon, Database, Zap, Clock, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';

// Helper for duration formatting
const formatDuration = (ms) => {
    if (!ms && ms !== 0) return '-';
    if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
};

// Helper for SQL formatting (basic)
const formatSQL = (sql) => {
    if (!sql) return '';
    return sql.replace(/\s+/g, ' ').trim();
};

const CopyButton = ({ text }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        copyToClipboard(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-cyber-gray-600 text-cyber-gray-400 hover:text-cyber-cyan transition-colors"
            title="Copy Query"
        >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
    );
};

const DiagnosticSection = ({ title, icon: Icon, data, emptyMessage, renderItem }) => {
    return (
        <div className="bg-cyber-dark/50 border border-cyber-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
                <Icon className="w-5 h-5 text-cyber-cyan" />
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                {data && data.length > 0 && (
                    <span className="ml-auto bg-cyber-cyan/20 text-cyber-cyan px-3 py-1 rounded-full text-sm font-semibold">
                        {data.length}
                    </span>
                )}
            </div>

            {!data || data.length === 0 ? (
                <div className="text-center py-8 text-cyber-gray-400">
                    <Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{emptyMessage}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {data.map((item, idx) => (
                        <div key={idx} className="bg-cyber-dark border border-cyber-gray-600 rounded-lg p-4 hover:border-cyber-cyan/50 transition-colors">
                            {renderItem(item, idx)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Tables Without Indexes
export const TablesWithoutIndexes = ({ tables }) => (
    <DiagnosticSection
        title="Tables Without Indexes"
        icon={AlertOctagon}
        data={tables}
        emptyMessage="✓ All tables have indexes"
        renderItem={(table) => (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-mono text-sm">
                        {table.schema ? `${table.schema}.${table.table}` : table.collection || table}
                    </span>
                    {table.rows !== undefined && (
                        <span className="text-cyber-gray-400 text-xs">
                            {table.rows.toLocaleString()} rows
                        </span>
                    )}
                    {table.size && (
                        <span className="text-cyber-gray-400 text-xs">{table.size}</span>
                    )}
                </div>
                <p className="text-yellow-500 text-xs">⚠ Consider adding indexes to improve query performance</p>
            </div>
        )}
    />
);

// High I/O Tables
export const HighIOTables = ({ tables }) => (
    <DiagnosticSection
        title="High I/O Tables"
        icon={Database}
        data={tables}
        emptyMessage="No high I/O activity detected"
        renderItem={(table) => (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-mono text-sm">
                        {table.schema ? `${table.schema}.${table.table}` :
                            table.database ? `${table.database}.${table.table}` : table.collection}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {table.reads !== undefined && (
                        <div className="text-cyber-gray-300">
                            Reads: <span className="text-cyber-cyan">{table.reads.toLocaleString()}</span>
                        </div>
                    )}
                    {table.writes !== undefined && (
                        <div className="text-cyber-gray-300">
                            Writes: <span className="text-cyber-cyan">{table.writes.toLocaleString()}</span>
                        </div>
                    )}
                    {table.heap_reads !== undefined && (
                        <div className="text-cyber-gray-300">
                            Heap Reads: <span className="text-cyber-cyan">{table.heap_reads.toLocaleString()}</span>
                        </div>
                    )}
                    {table.idx_reads !== undefined && (
                        <div className="text-cyber-gray-300">
                            Index Reads: <span className="text-cyber-cyan">{table.idx_reads.toLocaleString()}</span>
                        </div>
                    )}
                    {table.total_reads !== undefined && (
                        <div className="text-cyber-gray-300">
                            Total Reads: <span className="text-cyber-cyan">{table.total_reads.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </div>
        )}
    />
);

const QueryRow = ({ query, type }) => {
    const [expanded, setExpanded] = useState(false);

    // Normalize data based on DB type
    let duration = 0;
    let calls = 0;
    let rows = 0;
    let sql = '';

    // PostgreSQL
    if (query.avg_time_sec !== undefined) {
        duration = query.avg_time_sec * 1000;
        calls = query.calls;
        rows = query.avg_rows_examined || query.rows;
        sql = query.query;
    }
    // MySQL
    else if (query.time !== undefined) {
        // Check if time is string "00:00:05" or number
        // Assuming simplistic mapping for now related to whatever valid field is usually there
        duration = parseFloat(query.time || 0) * 1000; // if seconds
        calls = query.exec_count || 1;
        rows = query.rows_sent || query.rows_examined;
        sql = query.sql_text || query.query; // Mysql perfschema use sql_text usually
    }
    // Generic fallback or Mongo
    else {
        duration = query.millis || 0;
        calls = query.exec_count || query.calls || 1;
        rows = query.docs_scanned || 0;
        sql = query.query || query.command;
    }

    // If sql is missing, try to find it
    if (!sql && query.digest_text) sql = query.digest_text;

    const isSlow = duration > 1000;

    return (
        <>
            <tr
                className={`border-b border-cyber-gray-700 hover:bg-cyber-gray-800/50 transition-colors cursor-pointer ${expanded ? 'bg-cyber-gray-800/30' : ''}`}
                onClick={() => setExpanded(!expanded)}
            >
                <td className="py-3 px-4 w-8">
                    {expanded ? <ChevronDown className="w-4 h-4 text-cyber-gray-400" /> : <ChevronRight className="w-4 h-4 text-cyber-gray-400" />}
                </td>
                <td className="py-3 px-4">
                    <div className="font-mono text-sm text-cyber-text truncate max-w-xl" title={sql}>
                        {formatSQL(sql).substring(0, 100)}{sql && sql.length > 100 ? '...' : ''}
                    </div>
                </td>
                <td className="py-3 px-4 text-right">
                    <span className={`font-mono text-sm ${isSlow ? 'text-red-400 font-bold' : 'text-yellow-400'}`}>
                        {formatDuration(duration)}
                    </span>
                </td>
                <td className="py-3 px-4 text-right text-cyber-gray-300 text-sm">
                    {calls?.toLocaleString() || '-'}
                </td>
                <td className="py-3 px-4 text-right hidden sm:table-cell text-cyber-gray-300 text-sm">
                    {rows?.toLocaleString() || '-'}
                </td>
                <td className="py-3 px-4 text-right">
                    <CopyButton text={sql} />
                </td>
            </tr>
            {expanded && (
                <tr className="bg-cyber-gray-900/50">
                    <td colSpan="6" className="p-4">
                        <div className="bg-black/30 rounded-lg border border-cyber-gray-700 p-4 font-mono text-xs text-cyber-gray-300 overflow-x-auto">
                            <pre className="whitespace-pre-wrap break-all">{sql}</pre>
                        </div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            {query.database && (
                                <div>
                                    <span className="text-cyber-gray-500 block">Database</span>
                                    <span className="text-cyber-cyan">{query.database}</span>
                                </div>
                            )}
                            {query.user && (
                                <div>
                                    <span className="text-cyber-gray-500 block">User</span>
                                    <span className="text-cyber-text">{query.user}</span>
                                </div>
                            )}
                            {query.client_addr && (
                                <div>
                                    <span className="text-cyber-gray-500 block">Client</span>
                                    <span className="text-cyber-text">{query.client_addr}</span>
                                </div>
                            )}
                            {query.timestamp && (
                                <div>
                                    <span className="text-cyber-gray-500 block">Seen</span>
                                    <span className="text-cyber-text">{new Date(query.timestamp).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

// Slow Queries - Table Version
export const SlowQueries = ({ queries }) => {
    if (!queries || queries.length === 0) {
        return (
            <div className="bg-cyber-dark/50 border border-cyber-gray-700 rounded-xl p-6 text-center py-8 text-cyber-gray-400">
                <div className="flex items-center gap-3 mb-4 justify-center w-full absolute top-6 left-0">
                    {/* Keep standard header absolute or just inline styled to match? 
                         Actually re-using simpler structure for empty state is better 
                     */}
                </div>
                <div className="flex items-center gap-3 mb-6 px-4">
                    <Clock className="w-5 h-5 text-cyber-cyan" />
                    <h3 className="text-lg font-semibold text-white">Slow Queries</h3>
                </div>
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No slow queries detected</p>
            </div>
        );
    }

    return (
        <div className="bg-cyber-dark/50 border border-cyber-gray-700 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-cyber-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-cyber-cyan" />
                    <h3 className="text-lg font-semibold text-white">Slow Queries</h3>
                    <span className="bg-cyber-cyan/20 text-cyber-cyan px-3 py-1 rounded-full text-sm font-semibold">
                        {queries.length}
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-cyber-gray-800/50 text-cyber-gray-400 text-xs uppercase tracking-wider">
                            <th className="py-3 px-4 w-8"></th>
                            <th className="py-3 px-4 font-medium">Query Snippet</th>
                            <th className="py-3 px-4 text-right font-medium">Duration</th>
                            <th className="py-3 px-4 text-right font-medium">Calls</th>
                            <th className="py-3 px-4 text-right hidden sm:table-cell font-medium">Rows</th>
                            <th className="py-3 px-4 w-12"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {queries.map((q, idx) => (
                            <QueryRow key={idx} query={q} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Expensive Commands (Redis)
export const ExpensiveCommands = ({ commands }) => (
    <DiagnosticSection
        title="Expensive Commands"
        icon={Zap}
        data={commands}
        emptyMessage="No expensive commands detected"
        renderItem={(cmd) => (
            <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                    <span className="text-white font-mono">{cmd.command}</span>
                </div>
                <div className="text-cyber-gray-300">
                    Calls: <span className="text-cyber-cyan">{cmd.calls?.toLocaleString() || 0}</span>
                </div>
                <div className="text-cyber-gray-300">
                    Avg: <span className="text-red-400">{cmd.usec_per_call?.toFixed(2) || 0}µs</span>
                </div>
            </div>
        )}
    />
);

// Largest Keys (Redis)
export const LargestKeys = ({ keys }) => (
    <DiagnosticSection
        title="Largest Keys"
        icon={Database}
        data={keys}
        emptyMessage="No large keys detected"
        renderItem={(key) => (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-mono text-sm truncate flex-1">{key.key}</span>
                    <span className="text-cyber-cyan text-xs ml-2">
                        {(key.size_bytes / 1024).toFixed(2)} KB
                    </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-cyber-gray-400">
                    <span>Type: {key.type}</span>
                    {key.ttl_seconds > 0 && <span>TTL: {key.ttl_seconds}s</span>}
                    {key.ttl_seconds === -1 && <span className="text-yellow-500">No TTL</span>}
                </div>
            </div>
        )}
    />
);

export default DiagnosticSection;
