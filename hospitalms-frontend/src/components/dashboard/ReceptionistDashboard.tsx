import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, Card, EmptyState, Badge, LoadingSpinner, Button, statusBadge, Modal, Input, Select } from '../ui';
import { Calendar, Receipt, Search, BedDouble, ArrowRight } from 'lucide-react';
import api, { appointmentApi, prescriptionApi, doctorApi, bedApi, admissionApi } from '../../api/axiosInstance';
import { useNotifications } from '../../context/NotificationContext';
import { EnquiryChat } from '../chat/EnquiryChat';
import { useSignalR } from '../../hooks/useSignalR';

export const ReceptionistDashboard = () => {
    const { addToast } = useNotifications();
    const location = useLocation();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [bills, setBills] = useState<any[]>([]);
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [genModalOpen, setGenModalOpen] = useState(false);
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
    const [selectedBill, setSelectedBill] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [apptSearchTerm, setApptSearchTerm] = useState('');
    const [billSearchTerm, setBillSearchTerm] = useState('');
    const [beds, setBeds] = useState<any[]>([]);
    const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
    const [pendingAdmissions, setPendingAdmissions] = useState<any[]>([]);
    const [selectedBed, setSelectedBed] = useState<any | null>(null);
    const [bedStatusModalOpen, setBedStatusModalOpen] = useState(false);
    const [assignBedModalOpen, setAssignBedModalOpen] = useState(false);
    const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);

    const [billForm, setBillForm] = useState({
        consultationCharge: 0, medicineCharge: 0, labCharge: 0, bedCharge: 0, otherCharges: 0, discount: 0
    });
    const [payForm, setPayForm] = useState({ amount: 0, method: 'Cash' });

    const loadData = useCallback(async () => {
        try {
            const [apptRes, billRes, prescRes, docRes, bedRes, admRes, pendingRes] = await Promise.all([
                appointmentApi.getAll(),
                api.get('/api/bills/pending'),
                prescriptionApi.getPending(),
                doctorApi.getAll(),
                bedApi.getAll(),
                api.get('/api/admissions'),
                api.get('/api/admissions/pending')
            ]);
            setAppointments(apptRes.data || []);
            setBills(billRes.data || []);
            setPrescriptions(prescRes.data || []);
            setDoctors(docRes.data || []);
            setBeds(bedRes.data || []);
            setActiveAdmissions(admRes.data || []);
            setPendingAdmissions(pendingRes.data || []);
        } catch (err) {
            console.error("Receptionist Data Load Failed", err);
        } finally { 
            setLoading(false); 
        }
    }, [addToast]);

    useSignalR([
        {
            event: 'AdmissionRequested',
            handler: (data: any) => {
                addToast({ 
                    type: 'info', 
                    title: 'New Admission', 
                    message: `Patient ${data.patientName} needs bed allocation.` 
                });
                loadData();
            }
        },
        {
            event: 'OnlinePaymentReceived',
            handler: (data: any) => {
                addToast({ 
                    type: 'success', 
                    title: 'Payment Received', 
                    message: `₹${data.amount} paid by ${data.patientName} for consultation.` 
                });
                loadData();
            }
        }
    ]);

    useEffect(() => { 
        loadData(); 
    }, [loadData, location.pathname]);

    const handleAssignBed = async (bedId: number) => {
        if (!selectedAdmission) return;
        setSubmitting(true);
        try {
            await api.patch(`/api/admissions/${selectedAdmission.id}/assign-bed/${bedId}`);
            addToast({ type: 'success', title: 'Bed Assigned', message: `Patient ${selectedAdmission.patientName} assigned to bed.` });
            setAssignBedModalOpen(false);
            setSelectedAdmission(null);
            loadData();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Assignment Failed', message: err.response?.data?.message || 'Error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateBedStatus = async (status: string) => {
        if (!selectedBed) return;
        addToast({
            type: 'warning',
            title: 'Change Bed Status?',
            message: `Are you sure you want to change Bed #${selectedBed.bedNumber} status to ${status}?`,
            onConfirm: async () => {
                try {
                    await bedApi.updateStatus(selectedBed.id, status);
                    addToast({ type: 'success', title: 'Bed Updated', message: `Bed #${selectedBed.bedNumber} is now ${status}` });
                    setBedStatusModalOpen(false);
                    loadData();
                } catch (err) {
                    addToast({ type: 'error', title: 'Update Failed', message: 'Could not update bed status' });
                }
            }
        });
    };

    const [dischargeModalOpen, setDischargeModalOpen] = useState(false);
    const [dischargeForm, setDischargeForm] = useState({
        summary: 'Patient recovered well.',
        condition: 'Stable'
    });

    const handleDischargePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAdmission) return;

        addToast({
            type: 'warning',
            title: 'Discharge Patient?',
            message: `Finalize clinical stay for ${selectedAdmission.patientName}? The bed will be sent for cleaning.`,
            onConfirm: async () => {
                setSubmitting(true);
                try {
                    const res = await api.put(`/api/admissions/${selectedAdmission.id}/discharge`, {
                        dischargeSummary: dischargeForm.summary,
                        dischargeCondition: dischargeForm.condition
                    });
                    
                    addToast({ type: 'success', title: 'Discharged', message: 'Patient has been discharged successfully.' });
                    setDischargeModalOpen(false);
                    
                    // Trigger bill generation with bed charges
                    const finalAdm = res.data;
                    setSelectedAppt({
                        patientId: finalAdm.patientId,
                        patientName: finalAdm.patientName,
                        doctorName: 'Hospital Inpatient Services',
                        id: 0 // Dummy ID for admission bill
                    });
                    setBillForm({
                        consultationCharge: 0,
                        medicineCharge: 0,
                        labCharge: 0,
                        bedCharge: finalAdm.totalBedCharge,
                        otherCharges: 0,
                        discount: 0
                    });
                    setGenModalOpen(true);
                    loadData();
                } catch (err: any) {
                    addToast({ type: 'error', title: 'Discharge Failed', message: err.response?.data?.message || 'Error' });
                } finally {
                    setSubmitting(false);
                }
            }
        });
    };

    const renderWardManagement = () => {
        const wards = [...new Set(beds.map(b => b.wardType))];
        
        return (
            <div className="space-y-8">
                <PageHeader title="Facility & Ward Monitoring" subtitle="Track live bed occupancy and manage ward availability" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Card className="p-4 border-none shadow-sm bg-emerald-50">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Available Beds</p>
                        <p className="text-xl font-black text-emerald-700">{beds.filter(b => (b.status || '').toLowerCase() === 'available').length}</p>
                    </Card>
                    <Card className="p-4 border-none shadow-sm bg-red-50">
                        <p className="text-[10px] font-bold text-red-600 uppercase">Occupied Beds</p>
                        <p className="text-xl font-black text-red-700">{beds.filter(b => (b.status || '').toLowerCase() === 'occupied').length}</p>
                    </Card>
                    <Card className="p-4 border-none shadow-sm bg-orange-50">
                        <p className="text-[10px] font-bold text-orange-600 uppercase">Under Cleaning</p>
                        <p className="text-xl font-black text-orange-700">{beds.filter(b => (b.status || '').toLowerCase() === 'undercleaning').length}</p>
                    </Card>
                    <Card className="p-4 border-none shadow-sm bg-zinc-50">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Total Capacity</p>
                        <p className="text-xl font-black text-zinc-900">{beds.length}</p>
                    </Card>
                </div>

                {/* PENDING ADMISSIONS SECTION */}
                <Card title="Patients Awaiting Bed Allocation">
                    {pendingAdmissions.length === 0 ? (
                        <div className="py-8 text-center text-zinc-400 text-[13px] italic border border-dashed border-zinc-200 rounded-xl">No pending admission requests.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pendingAdmissions.map(adm => (
                                <div key={adm.id} className="p-4 bg-orange-50/50 border border-orange-100 rounded-2xl flex justify-between items-center group">
                                    <div>
                                        <p className="text-[14px] font-bold text-zinc-900">{adm.patientName}</p>
                                        <p className="text-[11px] text-zinc-500 font-medium">Requested Ward: <span className="text-orange-600 font-bold uppercase tracking-wider">{adm.wardType}</span></p>
                                        <p className="text-[11px] text-zinc-400 mt-1 italic line-clamp-1">"{adm.admissionReason || 'Clinical care'}"</p>
                                    </div>
                                    <Button size="sm" onClick={() => { setSelectedAdmission(adm); setAssignBedModalOpen(true); }} className="bg-orange-600 hover:bg-orange-700">Assign Bed</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {wards.map(ward => (
                        <Card key={ward} title={`${ward} Ward`}>
                            <div className="grid grid-cols-4 gap-2">
                                {beds.filter(b => b.wardType === ward).map(b => (
                                    <button 
                                        key={b.id} 
                                        onClick={() => { setSelectedBed(b); setBedStatusModalOpen(true); }}
                                        className={`h-12 rounded-lg border flex flex-col items-center justify-center transition-all ${
                                            b.status === 'Available' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100' :
                                            b.status === 'Occupied' ? 'bg-red-50 border-red-100 text-red-700 hover:bg-red-100' :
                                            'bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100'
                                        }`}
                                        title={`${b.bedNumber} - ${b.status}`}
                                    >
                                        <span className="text-[10px] font-bold">{b.bedNumber.split('-')[1] || b.bedNumber}</span>
                                        <BedDouble className="w-3 h-3 opacity-50" />
                                    </button>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>

                {/* ADMITTED PATIENTS LIST */}
                <Card title="Live Admitted Patients (Inpatient Registry)">
                    {activeAdmissions.length === 0 ? (
                        <div className="py-12 text-center text-zinc-400 text-sm italic border border-dashed border-zinc-200 rounded-xl">No active admissions currently recorded.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-zinc-50 border-b border-zinc-100">
                                    <tr>
                                        <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Patient Name</th>
                                        <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Bed</th>
                                        <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Ward</th>
                                        <th className="p-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-50">
                                    {activeAdmissions.map(adm => (
                                        <tr key={adm.id} className="hover:bg-zinc-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-[11px]">
                                                        {adm.patientName?.charAt(0) || 'P'}
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold text-zinc-900">{adm.patientName}</p>
                                                        <p className="text-[10px] text-zinc-500">{adm.patientAge > 0 ? `${adm.patientAge}y &bull; ` : ''}ID #{adm.patientId} &bull; {adm.patientPhone || 'No Phone'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 font-black">{adm.bedNumber || '---'}</Badge>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-[12px] font-medium text-zinc-600">{adm.wardType}</span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <p className="text-[12px] font-bold text-zinc-800">{new Date(adm.admissionDate).toLocaleDateString()}</p>
                                                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setSelectedAdmission(adm); setDischargeModalOpen(true); }}>Discharge</Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        );
    };

    const handleOpenGenBill = (appt: any) => {
        const doc = doctors.find(d => d.id === appt.doctorId);
        const presc = prescriptions.find(p => p.appointmentId === appt.id);

        setSelectedAppt(appt);
        setBillForm({
            consultationCharge: doc?.consultationFee || 500,
            medicineCharge: presc?.totalCost || 0,
            labCharge: 0, bedCharge: 0, otherCharges: 0, discount: 0
        });
        setGenModalOpen(true);
    };

    const handleGenerateBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAppt) return;
        
        addToast({
            type: 'warning',
            title: 'Issue Invoice?',
            message: `Are you sure you want to generate a bill for ${selectedAppt.patientName}?`,
            onConfirm: async () => {
                setSubmitting(true);
                try {
                    await api.post('/api/bills', {
                        patientId: selectedAppt.patientId,
                        ...billForm,
                        consultationCharge: parseFloat(billForm.consultationCharge.toString()),
                        medicineCharge: parseFloat(billForm.medicineCharge.toString())
                    });
                    addToast({ type: 'success', title: 'Bill Generated', message: 'Ready for payment collection' });
                    setGenModalOpen(false);
                    loadData();
                } catch (err: any) {
                    addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Generation failed' });
                } finally { setSubmitting(false); }
            }
        });
    };

    const handleCollectPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBill) return;

        addToast({
            type: 'warning',
            title: 'Resolve Payment?',
            message: `Are you sure you want to record a payment of ₹${payForm.amount} for Ledger #${selectedBill.id}?`,
            onConfirm: async () => {
                setSubmitting(true);
                try {
                    await api.post(`/api/bills/${selectedBill.id}/payment`, {
                        amount: parseFloat(payForm.amount.toString()),
                        paymentMethod: payForm.method
                    });
                    addToast({ type: 'success', title: 'Paid', message: 'Payment recorded successfully' });
                    setPayModalOpen(false);
                    loadData();
                } catch (err: any) {
                    addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Payment failed' });
                } finally { setSubmitting(false); }
            }
        });
    };

    const renderAppointments = (withHeader = false) => {
        const filtered = appointments.filter(a => 
            (a.patientName || '').toLowerCase().includes(apptSearchTerm.toLowerCase()) ||
            (a.doctorName || '').toLowerCase().includes(apptSearchTerm.toLowerCase()) ||
            a.patientId?.toString().includes(apptSearchTerm)
        );

        return (
            <div className="space-y-6">
                {withHeader && <PageHeader title="Patient Appointments" subtitle="Manage hospital check-ins and clinical scheduling" />}
                <Card title="Today's Active Appointments">
                    <div className="mb-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                            type="text" 
                            placeholder="Search patient or doctor..." 
                            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={apptSearchTerm}
                            onChange={(e) => setApptSearchTerm(e.target.value)}
                        />
                    </div>
                    {filtered.length === 0 ? <EmptyState icon={<Calendar strokeWidth={1.5} className="w-8 h-8" />} title={apptSearchTerm ? "No matches found" : "No visits scheduled"} /> :
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                            {filtered.map(a => (
                                <div key={a.id} className="p-4 bg-[#FDFDFD] border border-zinc-200 rounded-[16px] flex justify-between items-center transition-shadow hover:shadow-sm">
                                    <div className="flex-1">
                                        <p className="text-[14px] font-bold tracking-tight text-zinc-900">{a.patientName}</p>
                                        <p className="text-[12px] text-zinc-500 font-medium">{(a.doctorName || '').toLowerCase().startsWith('dr.') ? a.doctorName : `Dr. ${a.doctorName}`} &bull; {a.appointmentTime}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant={statusBadge(a.status)}>{a.status}</Badge>
                                        {a.status === 'Completed' && (
                                            <Button size="sm" variant="secondary" onClick={() => handleOpenGenBill(a)}>Create Bill</Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    }
                </Card>
            </div>
        );
    };

    const renderBills = (withHeader = false) => {
        const pending = bills.filter(b => 
            (b.paymentStatus === 'Pending' || b.paymentStatus === 'PartiallyPaid') &&
            (b.id.toString().includes(billSearchTerm) ||
             b.patientId?.toString().includes(billSearchTerm) ||
             (b.patientName || '').toLowerCase().includes(billSearchTerm.toLowerCase()))
        );

        const completed = bills.filter(b => 
            b.paymentStatus === 'Paid' &&
            (b.id.toString().includes(billSearchTerm) ||
             b.patientId?.toString().includes(billSearchTerm) ||
             (b.patientName || '').toLowerCase().includes(billSearchTerm.toLowerCase()))
        );

        return (
            <div className="space-y-8">
                {withHeader && <PageHeader title="Billing & Accounts" subtitle="Monitor revenue cycle and collect patient payments" />}
                <Card title="Outstanding Ledger Accounts">
                    <div className="mb-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                            type="text" 
                            placeholder="Search by ID or Patient..." 
                            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={billSearchTerm}
                            onChange={(e) => setBillSearchTerm(e.target.value)}
                        />
                    </div>
                    {pending.length === 0 ? <EmptyState icon={<Receipt strokeWidth={1.5} className="w-8 h-8" />} title={billSearchTerm ? "No matching bills" : "No pending payments"} /> :
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {pending.map(b => (
                                <div key={b.id} className="p-4 flex justify-between items-center bg-white border border-red-100 rounded-[16px] transition-shadow hover:shadow-sm">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-sm">
                                            {b.patientName?.charAt(0) || 'P'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-zinc-900">{b.patientName}</span>
                                            <span className="text-[11px] text-zinc-500 font-medium">Ledger #{b.id} &bull; {b.patientPhone || 'No Phone'} {b.patientAge > 0 ? `&bull; ${b.patientAge}y` : ''}</span>
                                            <span className="text-[11px] text-red-600 font-bold uppercase tracking-wider mt-0.5">Due: ₹{b.balanceAmount}</span>
                                        </div>
                                    </div>
                                    <Button size="sm" onClick={() => { setSelectedBill(b); setPayForm({ amount: b.balanceAmount, method: 'Cash' }); setPayModalOpen(true); }}>Collect Cash</Button>
                                </div>
                            ))}
                        </div>
                    }
                </Card>

                <Card title="Recently Received Payments">
                    {completed.length === 0 ? <p className="text-[12px] text-zinc-400 italic text-center py-4">No recent payments received</p> :
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {completed.slice(0, 20).map(b => (
                                <div key={b.id} className="p-4 flex justify-between items-center bg-emerald-50/30 border border-emerald-100 rounded-[16px]">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
                                            {b.patientName?.charAt(0) || 'P'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-emerald-900">{b.patientName}</span>
                                            <span className="text-[11px] text-emerald-600/70 font-medium">Ledger #{b.id} &bull; {b.patientPhone || 'No Phone'} {b.patientAge > 0 ? `&bull; ${b.patientAge}y` : ''}</span>
                                            <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">Paid: ₹{b.totalAmount} via {b.paymentMethod}</span>
                                        </div>
                                    </div>
                                    <Badge variant="success">Cleared</Badge>
                                </div>
                            ))}
                        </div>
                    }
                </Card>
            </div>
        );
    };

    if (loading) return <LoadingSpinner message="Loading receptionist portal..." />;

    const renderDashboardOverview = () => (
        <div className="space-y-10">
            <PageHeader title="Reception Overview" subtitle="Quick look at today's hospital operations and front-desk flow" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 border-none shadow-sm bg-white">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Appointments</p>
                    <h3 className="text-2xl font-bold text-zinc-900">{appointments.length}</h3>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Pending Collections</p>
                    <h3 className="text-2xl font-bold text-zinc-900">{bills.filter(b => b.paymentStatus !== 'Paid').length}</h3>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white">
                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">Available Beds</p>
                    <h3 className="text-2xl font-bold text-zinc-900">{beds.filter(b => (b.status || '').toLowerCase() === 'available').length}</h3>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white">
                    <p className="text-[11px] font-bold text-orange-600 uppercase tracking-widest mb-1">Active Admissions</p>
                    <h3 className="text-2xl font-bold text-zinc-900">{beds.filter(b => (b.status || '').toLowerCase() === 'occupied').length}</h3>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {renderAppointments()}
                {renderBills()}
            </div>
        </div>
    );

    const renderContent = () => {
        const path = location.pathname.toLowerCase();
        
        if (path.includes('/appointments')) return renderAppointments(true);
        if (path.includes('/admissions')) return renderWardManagement();
        if (path.includes('/billing')) return renderBills(true);
        
        return renderDashboardOverview();
    };

    return (
        <div className="pb-20">
            <div className="space-y-10 max-w-7xl mx-auto">
                {renderContent()}
            </div>

            <Modal isOpen={bedStatusModalOpen} onClose={() => setBedStatusModalOpen(false)} title="Update Bed Status" size="sm">
                {selectedBed && (
                    <div className="space-y-6">
                        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Current State</p>
                            <h3 className="text-lg font-bold text-zinc-900">Bed #{selectedBed.bedNumber} ({selectedBed.status})</h3>
                            <p className="text-[12px] text-zinc-500">{selectedBed.wardType} Ward</p>
                        </div>

                        {selectedBed.status === 'Occupied' && (
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Admitted Patient</p>
                                {(() => {
                                    const adm = activeAdmissions.find(a => a.bedId === selectedBed.id);
                                    return adm ? (
                                        <div className="space-y-1">
                                            <p className="text-[14px] font-bold text-emerald-900">{adm.patientName}</p>
                                            <p className="text-[11px] text-emerald-700 font-medium">{adm.patientAge > 0 ? `${adm.patientAge}y &bull; ` : ''}ID #{adm.patientId}</p>
                                            <p className="text-[11px] text-emerald-600 italic mt-1">"{adm.admissionReason || 'General care'}"</p>
                                        </div>
                                    ) : (
                                        <p className="text-[12px] text-emerald-600 italic">Patient details loading...</p>
                                    );
                                })()}
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 gap-2">
                            <Button variant="secondary" className="justify-start gap-3 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200" onClick={() => handleUpdateBedStatus('Available')}>
                                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Mark as Available
                            </Button>
                            <Button variant="secondary" className="justify-start gap-3 hover:bg-red-50 hover:text-red-700 hover:border-red-200" onClick={() => handleUpdateBedStatus('Occupied')}>
                                <div className="w-2 h-2 rounded-full bg-red-500" /> Mark as Occupied
                            </Button>
                            <Button variant="secondary" className="justify-start gap-3 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200" onClick={() => handleUpdateBedStatus('UnderCleaning')}>
                                <div className="w-2 h-2 rounded-full bg-orange-500" /> Send to Cleaning
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={dischargeModalOpen} onClose={() => setDischargeModalOpen(false)} title="Clinical Discharge Summary" size="md">
                {selectedAdmission && (
                    <form onSubmit={handleDischargePatient} className="space-y-6">
                        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Patient Subject</p>
                            <h3 className="text-[14px] font-bold text-zinc-900">{selectedAdmission.patientName}</h3>
                            <p className="text-[12px] text-zinc-500">ID #{selectedAdmission.patientId} &bull; Bed {selectedAdmission.bedNumber}</p>
                        </div>

                        <div className="space-y-4">
                            <Input 
                                label="Discharge Condition" 
                                value={dischargeForm.condition} 
                                onChange={(e: any) => setDischargeForm({ ...dischargeForm, condition: e.target.value })} 
                                placeholder="e.g. Fully Recovered, Stable" 
                                required
                            />
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Clinical Summary</label>
                                <textarea 
                                    className="w-full h-32 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-[13px] outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 resize-none transition-all text-zinc-900"
                                    value={dischargeForm.summary}
                                    onChange={(e) => setDischargeForm({ ...dischargeForm, summary: e.target.value })}
                                    placeholder="Document the patient's recovery and follow-up instructions..."
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex gap-3">
                            <Button type="button" variant="secondary" className="flex-1" onClick={() => setDischargeModalOpen(false)}>Cancel</Button>
                            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/10" loading={submitting}>Confirm Discharge</Button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal isOpen={genModalOpen} onClose={() => setGenModalOpen(false)} title="Generate Invoice Ledger" size="md">
                <form onSubmit={handleGenerateBill} className="space-y-5">
                    <div className="p-4 bg-zinc-50 rounded-[16px] border border-zinc-200 mb-2">
                        <p className="text-[11px] font-semibold text-zinc-500 tracking-widest uppercase mb-1">Patient Subject</p>
                        <p className="text-[14px] font-bold text-zinc-900">{selectedAppt?.patientName}</p>
                        <p className="text-[11px] font-medium text-zinc-500 mt-0.5">Consultant: {selectedAppt?.doctorName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Consultation Rate (₹)" type="number" value={billForm.consultationCharge} onChange={(e: any) => setBillForm({ ...billForm, consultationCharge: e.target.value })} required />
                        <Input label="Pharmacy Overhead (₹)" type="number" value={billForm.medicineCharge} onChange={(e: any) => setBillForm({ ...billForm, medicineCharge: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Laboratory Cost (₹)" type="number" value={billForm.labCharge} onChange={(e: any) => setBillForm({ ...billForm, labCharge: e.target.value })} />
                        <Input label="Bed & Stay Charges (₹)" type="number" value={billForm.bedCharge} onChange={(e: any) => setBillForm({ ...billForm, bedCharge: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Ancillary Deductibles (₹)" type="number" value={billForm.otherCharges} onChange={(e: any) => setBillForm({ ...billForm, otherCharges: e.target.value })} />
                        <Input label="Discount Subtracted (₹)" type="number" value={billForm.discount} onChange={(e: any) => setBillForm({ ...billForm, discount: e.target.value })} />
                    </div>

                    <div className="p-4 bg-emerald-500 rounded-[16px] text-white flex justify-between items-center mt-2">
                        <span className="text-[12px] font-medium opacity-80 uppercase tracking-widest">Calculated Total</span>
                        <span className="text-2xl font-bold tracking-tight">₹{(parseFloat(billForm.consultationCharge.toString()) + parseFloat(billForm.medicineCharge.toString()) + parseFloat(billForm.labCharge.toString()) + parseFloat(billForm.bedCharge.toString()) + parseFloat(billForm.otherCharges.toString())) - parseFloat(billForm.discount.toString())}</span>
                    </div>

                    <div className="pt-3 flex gap-3">
                        <Button type="button" variant="secondary" className="flex-1" onClick={() => setGenModalOpen(false)}>Cancel</Button>
                        <Button type="submit" className="flex-1" loading={submitting}>Issue Bill</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={payModalOpen} onClose={() => setPayModalOpen(false)} title="Settle Ledger Payments" size="sm">
                <form onSubmit={handleCollectPayment} className="space-y-6">
                    <div className="text-center p-6 bg-zinc-50 border border-zinc-100 rounded-[16px]">
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Amount Owed</p>
                        <p className="text-[32px] font-black tracking-tight text-zinc-900">₹{payForm.amount}</p>
                    </div>
                    <Select
                        label="Transfer Method"
                        value={payForm.method}
                        onChange={(e: any) => setPayForm({ ...payForm, method: e.target.value })}
                        options={[
                            { value: 'Cash', label: 'Standard Cash' },
                            { value: 'Card', label: 'Debit/Credit Card' },
                            { value: 'UPI', label: 'UPI / Fast Scan' },
                            { value: 'Insurance', label: 'Insurance Claim Routing' }
                        ]}
                    />
                    <Button type="submit" className="w-full h-12" loading={submitting}>Resolve Payment Balance</Button>
                </form>
            </Modal>

            <Modal isOpen={assignBedModalOpen} onClose={() => { setAssignBedModalOpen(false); setSelectedAdmission(null); }} title="Allocate Ward & Bed" size="lg">
                {selectedAdmission && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 bg-orange-50 border border-orange-100 rounded-[24px]">
                                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1">Subject</p>
                                <h3 className="text-xl font-black text-zinc-900 leading-tight">{selectedAdmission.patientName}</h3>
                                <p className="text-[12px] text-zinc-500 font-medium mt-1">ID #{selectedAdmission.patientId} &bull; Age {selectedAdmission.patientAge}y</p>
                            </div>
                            <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-[24px]">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Reason for Admission</p>
                                <p className="text-[13px] text-zinc-600 font-medium leading-relaxed italic">"{selectedAdmission.admissionReason || 'Clinical supervision required'}"</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Global Ward Inventory</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {(() => {
                                    const wards = [...new Set(beds.map(b => b.wardType))];
                                    return wards.map(ward => {
                                        const availableInWard = beds.filter(b => b.wardType === ward && b.status === 'Available');
                                        return (
                                            <div key={ward} className="space-y-3">
                                                <div className="flex justify-between items-center px-1">
                                                    <h4 className="text-[13px] font-black text-zinc-900 uppercase tracking-tighter">{ward} Ward</h4>
                                                    <Badge variant={availableInWard.length > 0 ? 'success' : 'danger'} className="text-[9px]">{availableInWard.length} Available</Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    {availableInWard.length === 0 ? (
                                                        <div className="p-3 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-[11px] text-zinc-400 text-center italic">No vacant beds</div>
                                                    ) : (
                                                        availableInWard.map(b => (
                                                            <button 
                                                                key={b.id} 
                                                                onClick={() => handleAssignBed(b.id)}
                                                                disabled={submitting}
                                                                className="w-full p-3.5 bg-white border border-zinc-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-start gap-1 group"
                                                            >
                                                                <div className="flex justify-between w-full">
                                                                    <span className="text-[13px] font-black text-zinc-900 group-hover:text-emerald-700">Bed {b.bedNumber}</span>
                                                                    <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                                                                </div>
                                                                <span className="text-[11px] text-zinc-500 font-bold group-hover:text-emerald-600/70">₹{b.dailyCharge}/day</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                             <p className="text-[11px] text-zinc-400 italic">Receptionist: Finalize allocation to confirm admission.</p>
                             <Button variant="secondary" size="sm" onClick={() => { setAssignBedModalOpen(false); setSelectedAdmission(null); }}>Cancel Process</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ENQUIRY CHAT SECTION */}
            <div className="pt-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Patient Enquiry Desk</h2>
                        <p className="text-[13px] text-zinc-500 font-medium">Real-time communication with patients</p>
                    </div>
                </div>
                <EnquiryChat />
            </div>
        </div>
    );
};
