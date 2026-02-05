import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import axios from 'axios';

function ProcessingStatus() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);

    useEffect(() => {
        fetchStatus();
        // Poll every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/status');
            setStatus(res.data);
        } catch (err) {
            console.error('Failed to fetch status:', err);
        } finally {
            setLoading(false);
        }
    };

    const triggerProcessing = async () => {
        setTriggering(true);
        try {
            await axios.post('/api/process');
            // Wait a bit then refresh status
            setTimeout(fetchStatus, 2000);
        } catch (err) {
            console.error('Failed to trigger processing:', err);
        } finally {
            setTriggering(false);
        }
    };

    if (loading || !status) {
        return null;
    }

    const processing = status.processing || {};
    const isQuotaExhausted = processing.aiQuotaExhausted;
    const progress = processing.progressPercent || 0;
    const pending = processing.pending || 0;
    const mapped = processing.processed_mapped || 0;

    // Don't show if everything is processed
    if (progress === 100 && pending === 0) {
        return null;
    }

    return (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100 px-4 py-3">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Progress Info */}
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                        {isQuotaExhausted ? (
                            <AlertCircle size={18} className="text-amber-500" />
                        ) : processing.isProcessing ? (
                            <RefreshCw size={18} className="text-blue-500 animate-spin" />
                        ) : (
                            <Clock size={18} className="text-gray-500" />
                        )}
                        <span className="text-sm font-medium text-gray-700">
                            AI Processing
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex-1 max-w-xs">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <span className="text-xs font-medium text-gray-600 min-w-[3rem]">
                                {progress}%
                            </span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <CheckCircle size={14} className="text-green-500" />
                            {mapped} mapped
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock size={14} className="text-amber-500" />
                            {pending} pending
                        </span>
                    </div>
                </div>

                {/* Status Message & Action */}
                <div className="flex items-center gap-3">
                    {isQuotaExhausted ? (
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                            Quota limit reached • Resets in ~{processing.aiQuotaResetMinutes || '?'}m
                        </span>
                    ) : pending > 0 ? (
                        <button
                            onClick={triggerProcessing}
                            disabled={triggering || processing.isProcessing}
                            className="flex items-center gap-1 text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {triggering || processing.isProcessing ? (
                                <>
                                    <RefreshCw size={12} className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Zap size={12} />
                                    Process Now
                                </>
                            )}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default ProcessingStatus;
