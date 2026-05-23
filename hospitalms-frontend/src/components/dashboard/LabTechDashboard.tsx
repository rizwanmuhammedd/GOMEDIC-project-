import React, { useState, useEffect } from 'react';
import { PageHeader, Card, EmptyState, Button, LoadingSpinner } from '../ui';
import { FlaskConical } from 'lucide-react';
import { labApi } from '../../api/axiosInstance';
import { useNotifications } from '../../context/NotificationContext';

export const LabTechDashboard = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast, hasUnreadInSection } = useNotifications();

    const loadData = async () => {
        try {
            const res = await labApi.getPending();
            setOrders(res.data);
        } catch { setOrders([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <PageHeader 
                title="Laboratory Infrastructure" 
                subtitle="Process samples and securely upload clinical diagnostics" 
                hasAlert={hasUnreadInSection('Lab')}
            />
            <Card title="Pending Sample Queue">
                {orders.length === 0 ? <EmptyState icon={<FlaskConical strokeWidth={1.5} className="w-8 h-8" />} title="No pending samples" description="All diagnostic requests have been fulfilled." /> : (
                    <div className="space-y-3">
                        {orders.map(o => (
                            <div key={o.id} className="flex items-center justify-between p-4 bg-[#FDFDFD] border border-zinc-200 rounded-xl hover:border-zinc-300 transition-colors">
                                <div>
                                    <p className="text-[14px] font-semibold text-zinc-900 tracking-tight">{o.testName}</p>
                                    <p className="text-[12px] text-zinc-500 mt-0.5">Patient Reg ID: <span className="font-medium text-zinc-700">{o.patientId}</span></p>
                                </div>
                                <Button size="sm" variant="secondary">Upload Results</Button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};
