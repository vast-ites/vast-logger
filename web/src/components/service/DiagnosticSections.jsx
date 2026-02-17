import React from 'react';
import { AlertOctagon, Database, Zap, Clock } from 'lucide-react';

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

// Slow Queries
export const SlowQueries = ({ queries }) => (
    <DiagnosticSection
        title="Slow Queries"
        icon={Clock}
        data={queries}
        emptyMessage="No slow queries detected"
        renderItem={(query) => (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-red-400 text-xs font-semibold">
                        {query.avg_time_sec ? `${query.avg_time_sec.toFixed(3)}s avg` :
                            query.millis ? `${query.millis}ms` : 'Slow'}
                    </span>
                    {query.exec_count !== undefined && (
                        <span className="text-cyber-gray-400 text-xs">
                            {query.exec_count.toLocaleString()} executions
                        </span>
                    )}
                    {query.calls !== undefined && (
                        <span className="text-cyber-gray-400 text-xs">
                            {query.calls.toLocaleString()} calls
                        </span>
                    )}
                </div>
                <pre className="text-cyber-gray-300 text-xs font-mono whitespace-pre-wrap break-all bg-cyber-dark/50 p-2 rounded">
                    {query.query || query.command || 'N/A'}
                </pre>
                {query.avg_rows_examined !== undefined && query.avg_rows_examined > 1000 && (
                    <p className="text-yellow-500 text-xs mt-2">
                        ⚠ Avg {Math.round(query.avg_rows_examined).toLocaleString()} rows examined
                    </p>
                )}
                {query.ns && (
                    <p className="text-cyber-gray-400 text-xs mt-1">{query.ns}</p>
                )}
            </div>
        )}
    />
);

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
