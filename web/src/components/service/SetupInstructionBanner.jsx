import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

const SetupInstructionBanner = ({ database, prerequisite, enabled, setupInstructions }) => {
    if (enabled) return null;

    return (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h3 className="text-yellow-500 font-semibold mb-2">
                        {prerequisite} Not Enabled
                    </h3>
                    <p className="text-cyber-gray-300 text-sm mb-3">
                        {database} performance diagnostics require {prerequisite} to be enabled.
                        Without it, advanced metrics like index recommendations and slow queries cannot be collected.
                    </p>
                    <div className="bg-cyber-dark/50 rounded p-3 text-sm">
                        <div className="flex items-center gap-2 mb-2 text-cyber-cyan">
                            <Info className="w-4 h-4" />
                            <span className="font-semibold">Setup Instructions:</span>
                        </div>
                        <pre className="text-cyber-gray-300 whitespace-pre-wrap">
                            {setupInstructions}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupInstructionBanner;
