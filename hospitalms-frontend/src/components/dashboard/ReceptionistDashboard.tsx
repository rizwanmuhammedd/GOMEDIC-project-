import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, Card, EmptyState, Badge, LoadingSpinner, Button, statusBadge, Modal, Input, Select } from '../ui';
import { Calendar, Receipt, Search, BedDouble, ArrowRight, Activity, Plus, FileText } from 'lucide-react';
import api, { appointmentApi, prescriptionApi, doctorApi, bedApi, admissionApi, vitalsApi } from '../../api/axiosInstance';
import { useNotifications } from '../../context/NotificationContext';
import { EnquiryChat } from '../chat/EnquiryChat';
import { useSignalR } from '../../hooks/useSignalR';

export const ReceptionistDashboard = () => {
    const { addToast, hasUnreadInSection } = useNotifications();
    const location = useLocation();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [bills, setBills] = useState<any[]>([]);
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [doctorAvailabilities, setDoctorAvailabilities] = useState<Record<number, any>>({});
    const [loading, setLoading] = useState(true);
    const [genModalOpen, setGenModalOpen] = useState(false);
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
    const [selectedBill, setSelectedBill] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [apptSearchTerm, setApptSearchTerm] = useState('');
    const [billSearchTerm, setBillSearchTerm] = useState('');
    const [admissionSearchTerm, setAdmissionSearchTerm] = useState('');
    const [beds, setBeds] = useState<any[]>([]);
    const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
    const [pendingAdmissions, setPendingAdmissions] = useState<any[]>([]);
    const [selectedBed, setSelectedBed] = useState<any | null>(null);
    const [bedStatusModalOpen, setBedStatusModalOpen] = useState(false);
    const [assignBedModalOpen, setAssignBedModalOpen] = useState(false);
    const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);

    // Manual Booking State
    const [manualBookOpen, setManualBookOpen] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [bookForm, setBookForm] = useState({
        patientName: '',
        patientAge: '',
        patientPhone: '',
        doctorId: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        chiefComplaint: ''
    });

    const fetchSlots = async (doctorId: number, date: string) => {
        try {
            const res = await api.get(`/api/appointments/slots/${doctorId}?date=${date}`);
            setAvailableSlots(res.data.availableSlots || []);
        } catch (err) {
            console.error("Slots load failed", err);
        }
    };

    const handleManualBook = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        if (!bookForm.doctorId || !bookForm.date || !bookForm.time) {
            addToast({ type: 'error', title: 'Missing Info', message: 'Please select doctor, date and time.' });
            return;
        }

        setSubmitting(true);
        try {
            // Ensure date is in YYYY-MM-DD format regardless of display
            let formattedDate = bookForm.date;
            if (formattedDate.includes('-') && formattedDate.split('-')[0].length !== 4) {
                // Handle DD-MM-YYYY if it somehow leaked through
                const parts = formattedDate.split('-');
                formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            const res = await api.post('/api/appointments', {
                patientId: 0, // Special ID for guest booking
                patientName: bookForm.patientName,
                patientAge: parseInt(bookForm.patientAge) || 0,
                patientPhone: bookForm.patientPhone,
                doctorId: parseInt(bookForm.doctorId),
                appointmentDate: formattedDate,
                appointmentTime: bookForm.time,
                chiefComplaint: bookForm.chiefComplaint
            });
            const newAppt = res.data;
            addToast({ type: 'success', title: 'Appointment Booked', message: `Manual booking for ${bookForm.patientName} successful.` });
            setManualBookOpen(false);
            setBookForm({
                patientName: '', patientAge: '', patientPhone: '',
                doctorId: '', date: new Date().toISOString().split('T')[0],
                time: '', chiefComplaint: ''
            });
            loadData();
        } catch (err: any) {
            const errorData = err.response?.data;
            let errorMsg = 'An unexpected error occurred during booking.';
            
            if (errorData?.errors) {
                // Extract specific validation errors
                const details = Object.entries(errorData.errors)
                    .map(([field, msgs]: [any, any]) => `${field}: ${msgs.join(', ')}`)
                    .join(' | ');
                errorMsg = `Validation failed: ${details}`;
            } else {
                errorMsg = errorData?.message || errorData?.title || errorMsg;
            }

            console.error("Manual Booking Error Details:", errorData);
            addToast({ type: 'error', title: 'Booking Failed', message: errorMsg });
        } finally {
            setSubmitting(false);
        }
    };

    const [billForm, setBillForm] = useState({
        consultationCharge: 0, medicineCharge: 0, labCharge: 0, bedCharge: 0, otherCharges: 0, discount: 0
    });
    const [payForm, setPayForm] = useState({ amount: 0, method: 'Cash' });

    // Vitals State
    const [vitalsOpen, setVitalsOpen] = useState(false);
    const [vitalsList, setVitalsList] = useState<any[]>([]);

    const fetchVitals = async (admissionId: number) => {
        try {
            const res = await vitalsApi.getByAdmission(admissionId);
            setVitalsList(res.data);
        } catch (err) {
            console.error("Vitals load failed", err);
        }
    };

    const loadData = useCallback(async () => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const [apptRes, billRes, prescRes, docRes, bedRes, admRes, pendingRes] = await Promise.all([
                appointmentApi.getAll(),
                api.get('/api/bills'),
                prescriptionApi.getPending(),
                doctorApi.getAll(),
                bedApi.getAll(),
                api.get('/api/admissions'),
                api.get('/api/admissions/pending')
            ]);
            
            const docs = docRes.data || [];
            setAppointments(apptRes.data || []);
            setBills(billRes.data || []);
            setPrescriptions(prescRes.data || []);
            setDoctors(docs);
            setBeds(bedRes.data || []);
            setActiveAdmissions(admRes.data || []);
            setPendingAdmissions(pendingRes.data || []);

            // Fetch today's availability for each doctor
            const availPromises = docs.map(async (d: any) => {
                try {
                    const res = await api.get(`/api/appointments/slots/${d.id}?date=${todayStr}`);
                    return { id: d.id, slots: res.data.availableSlots || [] };
                } catch {
                    return { id: d.id, slots: [] };
                }
            });
            const avails = await Promise.all(availPromises);
            const availMap: Record<number, any> = {};
            avails.forEach(a => { availMap[a.id] = a.slots; });
            setDoctorAvailabilities(availMap);

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
                <PageHeader 
                    title="Facility & Ward Monitoring" 
                    subtitle="Track live bed occupancy and manage ward availability" 
                    hasAlert={hasUnreadInSection('Admissions')}
                />
                
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
                    <div className="mb-6 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                            type="text" 
                            placeholder="Search admitted patient by name or ID..." 
                            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all shadow-inner"
                            value={admissionSearchTerm}
                            onChange={(e) => setAdmissionSearchTerm(e.target.value)}
                        />
                    </div>

                    {(() => {
                        const filtered = activeAdmissions.filter(adm => 
                            (adm.patientName || '').toLowerCase().includes(admissionSearchTerm.toLowerCase()) ||
                            adm.patientId?.toString().includes(admissionSearchTerm) ||
                            (adm.bedNumber || '').toLowerCase().includes(admissionSearchTerm.toLowerCase())
                        );

                        if (filtered.length === 0) {
                            return <div className="py-12 text-center text-zinc-400 text-sm italic border border-dashed border-zinc-200 rounded-xl">{admissionSearchTerm ? "No matching patients found." : "No active admissions currently recorded."}</div>;
                        }

                        return (
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
                                        {filtered.map(adm => (
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
                                                        <div className="flex gap-2 mt-2">
                                                            <Button size="sm" variant="secondary" onClick={() => { setSelectedAdmission(adm); fetchVitals(adm.id); setVitalsOpen(true); }}><Activity className="w-3 h-3 mr-1" /> Vitals</Button>
                                                            <Button size="sm" variant="secondary" onClick={() => { setSelectedAdmission(adm); setDischargeModalOpen(true); }}>Discharge</Button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
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
                    const res = await api.post('/api/bills', {
                        patientId: selectedAppt.patientId,
                        patientName: selectedAppt.patientName,
                        patientPhone: selectedAppt.patientPhone,
                        patientAge: selectedAppt.patientAge,
                        ...billForm,
                        consultationCharge: parseFloat(billForm.consultationCharge.toString()),
                        medicineCharge: parseFloat(billForm.medicineCharge.toString()),
                        labCharge: parseFloat(billForm.labCharge.toString()),
                        bedCharge: parseFloat(billForm.bedCharge.toString()),
                        otherCharges: parseFloat(billForm.otherCharges.toString()),
                        discount: parseFloat(billForm.discount.toString())
                    });
                    const newBill = res.data;
                    addToast({ type: 'success', title: 'Bill Generated', message: `Ledger created for ${selectedAppt.patientName}.` });
                    setGenModalOpen(false);
                    loadData();
                    // Automatically trigger print/download for the new bill
                    handleDownloadBill(newBill);
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
                    
                    const updatedBill = {
                        ...selectedBill,
                        paymentStatus: 'Paid',
                        paidAmount: payForm.amount,
                        balanceAmount: selectedBill.totalAmount - payForm.amount,
                        paymentMethod: payForm.method,
                        paidAt: new Date().toISOString()
                    };

                    addToast({ type: 'success', title: 'Paid', message: 'Payment recorded successfully' });
                    setPayModalOpen(false);
                    loadData();
                    
                    // Auto-print receipt to prevent it being missed when it leaves the outstanding list
                    handleDownloadBill(updatedBill);
                } catch (err: any) {
                    addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Payment failed' });
                } finally { setSubmitting(false); }
            }
        });
    };

    const handleDownloadBill = (b: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice ${b.billNumber || b.id}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
                        .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .hospital-name { font-size: 24px; font-weight: 800; color: #3b82f6; margin: 0; }
                        .invoice-label { font-size: 32px; font-weight: 900; color: #eee; margin: 0; text-transform: uppercase; }
                        .meta-info { margin-bottom: 40px; display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
                        .meta-block h4 { font-size: 11px; text-transform: uppercase; color: #999; margin: 0 0 5px 0; }
                        .meta-block p { font-weight: bold; margin: 0; }
                        .line-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; font-size: 14px; }
                        .total-section { margin-top: 30px; border-top: 2px solid #333; padding-top: 20px; }
                        .total-row { display: flex; justify-content: space-between; padding: 10px 0; }
                        .grand-total { font-size: 20px; font-weight: 900; background: #3b82f6; color: white; padding: 15px 20px; border-radius: 10px; margin-top: 10px; }
                        .footer { margin-top: 100px; font-size: 11px; color: #999; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h1 class="hospital-name">GOMEDIC HOSPITAL</h1>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Medical Billing Department</p>
                        </div>
                        <h2 class="invoice-label">Invoice</h2>
                    </div>

                    <div class="meta-info">
                        <div class="meta-block">
                            <h4>Billed To</h4>
                            <p>${b.patientName}</p>
                            <span style="font-size: 12px; color: #666;">Patient ID: #${b.patientId}</span>
                        </div>
                        <div class="meta-block" style="text-align: right">
                            <h4>Invoice Details</h4>
                            <p>${b.billNumber || 'DRAFT'}</p>
                            <span style="font-size: 12px; color: #666;">Date: ${new Date(b.generatedAt || Date.now()).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <div style="margin-top: 40px">
                        <div class="line-item" style="font-weight: bold; background: #f9fafb; padding: 12px;">
                            <span>Description</span>
                            <span>Amount</span>
                        </div>
                        ${b.consultationCharge > 0 ? `<div class="line-item"><span>Professional Consultation Fee</span><span>₹${b.consultationCharge}</span></div>` : ''}
                        ${b.medicineCharge > 0 ? `<div class="line-item"><span>Pharmacy & Medication Overhead</span><span>₹${b.medicineCharge}</span></div>` : ''}
                        ${b.labCharge > 0 ? `<div class="line-item"><span>Diagnostic Laboratory Services</span><span>₹${b.labCharge}</span></div>` : ''}
                        ${b.bedCharge > 0 ? `<div class="line-item"><span>Room / Inpatient Accommodation</span><span>₹${b.bedCharge}</span></div>` : ''}
                        ${b.otherCharges > 0 ? `<div class="line-item"><span>Ancillary Clinical Charges</span><span>₹${b.otherCharges}</span></div>` : ''}
                    </div>

                    <div class="total-section">
                        <div class="total-row">
                            <span style="color: #666">Subtotal</span>
                            <span style="font-weight: bold">₹${(b.totalAmount || 0) + (b.discount || 0)}</span>
                        </div>
                        ${b.discount > 0 ? `<div class="total-row" style="color: #ef4444">
                            <span>Hospital Discount</span>
                            <span>- ₹${b.discount}</span>
                        </div>` : ''}
                        <div class="grand-total">
                            <span>Invoice Total</span>
                            <span>₹${b.totalAmount}</span>
                        </div>
                        <div class="total-row" style="margin-top: 10px; color: #10b981; font-weight: bold">
                            <span>Amount Paid</span>
                            <span>₹${b.paidAmount || 0}</span>
                        </div>
                        <div class="total-row">
                            <span style="color: #666">Balance Due</span>
                            <span style="font-weight: bold">₹${b.balanceAmount}</span>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Payment Status: ${(b.paymentStatus || 'Pending').toUpperCase()}</p>
                        ${b.paidAt ? `<p>Paid On: ${new Date(b.paidAt).toLocaleString()}</p>` : ''}
                        <p style="margin-top: 20px">Thank you for choosing GOMEDIC Hospital. Wish you a speedy recovery.</p>
                    </div>
                    <script>window.print(); setTimeout(() => window.close(), 500);</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const renderAppointments = (withHeader = false) => {
        const filtered = appointments.filter(a => 
            (a.patientName || '').toLowerCase().includes(apptSearchTerm.toLowerCase()) ||
            (a.doctorName || '').toLowerCase().includes(apptSearchTerm.toLowerCase()) ||
            a.patientId?.toString().includes(apptSearchTerm)
        );

        const onlineBooked = filtered.filter(a => a.patientId !== 0);
        const manuallyBooked = filtered.filter(a => a.patientId === 0);

        const ApptList = ({ list, emptyMsg }: { list: any[], emptyMsg: string }) => (
            list.length === 0 ? <EmptyState icon={<Calendar strokeWidth={1.5} className="w-8 h-8" />} title={emptyMsg} /> :
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {list.map(a => (
                    <div key={a.id} className="p-4 bg-[#FDFDFD] border border-zinc-200 rounded-[16px] flex justify-between items-center transition-shadow hover:shadow-sm">
                        <div className="flex-1">
                            <p className="text-[14px] font-bold tracking-tight text-zinc-900">{a.patientName}</p>
                            <p className="text-[12px] text-zinc-500 font-medium">{(a.doctorName || '').toLowerCase().startsWith('dr.') ? a.doctorName : `Dr. ${a.doctorName}`} &bull; {a.appointmentTime}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant={statusBadge(a.status)}>{a.status}</Badge>
                            {(a.status === 'Completed' || a.status === 'Scheduled') && (
                                <Button size="sm" variant="secondary" onClick={() => handleOpenGenBill(a)}>
                                    {a.status === 'Scheduled' ? 'Check-in & Bill' : 'Create Bill'}
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-end">
                    {withHeader && (
                        <PageHeader 
                            title="Patient Appointments" 
                            subtitle="Manage hospital check-ins and clinical scheduling" 
                            hasAlert={hasUnreadInSection('Appointments')}
                        />
                    )}
                    <Button onClick={() => setManualBookOpen(true)} className="mb-1 bg-zinc-900 hover:bg-zinc-800 text-[12px] h-10 px-6 rounded-xl shadow-lg shadow-zinc-200">
                        <Plus className="w-4 h-4 mr-2" /> Manual Booking
                    </Button>
                </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card title="Online Booked Patients">
                        <ApptList list={onlineBooked} emptyMsg={apptSearchTerm ? "No matches found" : "No online bookings"} />
                    </Card>
                    <Card title="Manually Booked Patients">
                        <ApptList list={manuallyBooked} emptyMsg={apptSearchTerm ? "No matches found" : "No manual bookings"} />
                    </Card>
                </div>
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
                {withHeader && (
                    <PageHeader 
                        title="Billing & Accounts" 
                        subtitle="Monitor revenue cycle and collect patient payments" 
                        hasAlert={hasUnreadInSection('Billing')}
                    />
                )}
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
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => handleDownloadBill(b)} title="Print Bill"><FileText className="w-4 h-4" /></Button>
                                        <Button size="sm" onClick={() => { setSelectedBill(b); setPayForm({ amount: b.balanceAmount, method: 'Cash' }); setPayModalOpen(true); }}>Collect Cash</Button>
                                    </div>
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
                                    <div className="flex items-center gap-3">
                                        <Button size="sm" variant="secondary" onClick={() => handleDownloadBill(b)} title="Print Receipt"><FileText className="w-4 h-4" /></Button>
                                        <Badge variant="success">Cleared</Badge>
                                    </div>
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
            <PageHeader 
                title="Reception Overview" 
                subtitle="Quick look at today's hospital operations and front-desk flow" 
                hasAlert={hasUnreadInSection('Dashboard')}
            />
            
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

    const renderSchedules = () => {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        return (
            <div className="space-y-8">
                <div className="flex justify-between items-end">
                    <PageHeader 
                        title="Doctor Daily Schedules" 
                        subtitle={`Live availability tracking for ${today}`} 
                        hasAlert={hasUnreadInSection('Schedules')}
                    />
                    <Badge variant="info" className="mb-1 h-8 px-4 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" /> Synchronized
                    </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {doctors.map(doc => {
                        const slots = doctorAvailabilities[doc.id] || [];
                        const booked = slots.filter((s: string) => s.endsWith('::booked')).length;
                        const free = slots.length - booked;
                        
                        return (
                            <Card key={doc.id} className="p-0 border-none shadow-sm bg-white overflow-hidden group">
                                <div className="p-5 border-b border-zinc-50 flex justify-between items-start bg-zinc-50/30">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-900 text-lg font-black shadow-sm group-hover:scale-105 transition-transform">
                                            {doc.profileImageUrl ? (
                                                <img src={doc.profileImageUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
                                            ) : (doc.fullName || 'D').charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-zinc-900">{(doc.fullName || '').toLowerCase().startsWith('dr.') ? doc.fullName : `Dr. ${doc.fullName}`}</h4>
                                            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">{doc.departmentName || 'Specialist'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={free > 0 ? 'success' : 'danger'}>
                                            {free > 0 ? `${free} Slots Free` : 'Fully Booked'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Today's Timeline</span>
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{booked} Booked / {slots.length} Total</span>
                                    </div>
                                    
                                    {slots.length === 0 ? (
                                        <div className="py-6 text-center text-zinc-400 text-[12px] italic border border-dashed border-zinc-100 rounded-xl">No active shift today.</div>
                                    ) : (
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                            {slots.map((s: string, i: number) => {
                                                const isBooked = s.endsWith('::booked');
                                                const time = isBooked ? s.split('::')[0] : s;
                                                return (
                                                    <div 
                                                        key={i} 
                                                        className={`py-2 rounded-lg text-center text-[10px] font-bold border transition-all ${
                                                            isBooked 
                                                            ? 'bg-zinc-50 border-zinc-100 text-zinc-300' 
                                                            : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                                        }`}
                                                    >
                                                        {time}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="mt-6 flex gap-2">
                                        <Button 
                                            size="sm" 
                                            className="flex-1 bg-zinc-900 text-[11px]" 
                                            onClick={() => {
                                                setBookForm({ ...bookForm, doctorId: doc.id.toString(), date: new Date().toISOString().split('T')[0] });
                                                fetchSlots(doc.id, new Date().toISOString().split('T')[0]);
                                                setManualBookOpen(true);
                                            }}
                                        >
                                            Quick Book
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderContent = () => {
        const path = location.pathname.toLowerCase();
        
        if (path.includes('/appointments')) return renderAppointments(true);
        if (path.includes('/admissions')) return renderWardManagement();
        if (path.includes('/billing')) return renderBills(true);
        if (path.includes('/schedule')) return renderSchedules();
        
        return (
            <div className="space-y-12">
                {renderDashboardOverview()}
                
                {/* DOCTOR SCHEDULES QUICK VIEW */}
                <div className="pt-4 border-t border-zinc-100">
                    <div className="flex items-center justify-between mb-8">
                         <div>
                            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Today's Doctor Availability</h2>
                            <p className="text-[13px] text-zinc-500 font-medium">Real-time tracking of clinical shifts and appointment slots</p>
                         </div>
                         <Button variant="secondary" size="sm" onClick={() => window.location.pathname = '/schedule'}>Detailed View</Button>
                    </div>
                    {renderSchedules()}
                </div>
            </div>
        );
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

            <Modal isOpen={vitalsOpen} onClose={() => setVitalsOpen(false)} title={`Clinical Vitals - ${selectedAdmission?.patientName || 'Patient'}`} size="lg">
                <div className="space-y-6">
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Normal Reference Values</p>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 text-[11px] text-zinc-500 font-medium">
                                <span>Temp: 36.5 - 37.5 °C</span>
                                <span>BP: 120/80 mmHg</span>
                                <span>Pulse: 60 - 100 bpm</span>
                                <span>SpO2: 95 - 100%</span>
                            </div>
                        </div>
                        <Activity className="w-8 h-8 text-emerald-500 opacity-20" />
                    </div>

                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        {vitalsList.length === 0 ? (
                            <div className="py-12 text-center text-zinc-400 text-sm italic border border-dashed border-zinc-200 rounded-xl">No vitals have been recorded for this admission yet.</div>
                        ) : (
                            vitalsList.map(v => (
                                <div key={v.id} className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm transition-shadow hover:shadow-md">
                                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-50">
                                        <span className="text-[12px] font-black text-zinc-900">{new Date(v.recordedAt).toLocaleString()}</span>
                                        <Badge variant="secondary" className="text-[10px]">Recorded By: {v.recordedBy}</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {v.temperature && (
                                            <div className="p-2 bg-zinc-50/50 rounded-lg">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase">Temp</p>
                                                <p className={`text-sm font-bold ${v.temperature > 37.5 || v.temperature < 36.5 ? 'text-red-600' : 'text-zinc-900'}`}>{v.temperature}°C</p>
                                            </div>
                                        )}
                                        {v.bloodPressure && (
                                            <div className="p-2 bg-zinc-50/50 rounded-lg">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase">BP</p>
                                                <p className="text-sm font-bold text-zinc-900">{v.bloodPressure}</p>
                                            </div>
                                        )}
                                        {v.heartRate && (
                                            <div className="p-2 bg-zinc-50/50 rounded-lg">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase">Pulse</p>
                                                <p className={`text-sm font-bold ${v.heartRate > 100 || v.heartRate < 60 ? 'text-red-600' : 'text-zinc-900'}`}>{v.heartRate} bpm</p>
                                            </div>
                                        )}
                                        {v.oxygenSaturation && (
                                            <div className="p-2 bg-zinc-50/50 rounded-lg">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase">SpO2</p>
                                                <p className={`text-sm font-bold ${v.oxygenSaturation < 95 ? 'text-red-600' : 'text-zinc-900'}`}>{v.oxygenSaturation}%</p>
                                            </div>
                                        )}
                                        {v.respiratoryRate && (
                                            <div className="p-2 bg-zinc-50/50 rounded-lg">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase">Resp.</p>
                                                <p className="text-sm font-bold text-zinc-900">{v.respiratoryRate}/min</p>
                                            </div>
                                        )}
                                        {v.weight && (
                                            <div className="p-2 bg-zinc-50/50 rounded-lg">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase">Weight</p>
                                                <p className="text-sm font-bold text-zinc-900">{v.weight} kg</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={manualBookOpen} onClose={() => setManualBookOpen(false)} title="Quick Manual Booking" size="lg">
                <form onSubmit={handleManualBook} className="space-y-6">
                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-white">
                            <Plus className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[14px] font-bold text-zinc-900">Direct Patient Check-in</p>
                            <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-widest">Front Desk Assistant</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-4">
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Patient Demographics</p>
                            <Input label="Full Name" placeholder="e.g. Rahul Sharma" value={bookForm.patientName} onChange={(e: any) => setBookForm({ ...bookForm, patientName: e.target.value })} required />
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Age" type="number" placeholder="e.g. 25" value={bookForm.patientAge} onChange={(e: any) => setBookForm({ ...bookForm, patientAge: e.target.value })} required />
                                <Input label="Phone" placeholder="10-digit mobile" value={bookForm.patientPhone} onChange={(e: any) => setBookForm({ ...bookForm, patientPhone: e.target.value })} required />
                            </div>
                            <Input label="Chief Complaint" placeholder="e.g. Fever and Headache" value={bookForm.chiefComplaint} onChange={(e: any) => setBookForm({ ...bookForm, chiefComplaint: e.target.value })} />
                        </div>

                        <div className="space-y-4">
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Scheduling Details</p>
                            <Select 
                                label="Select Consultant" 
                                value={bookForm.doctorId} 
                                onChange={(e: any) => { 
                                    setBookForm({ ...bookForm, doctorId: e.target.value, time: '' }); 
                                    if (e.target.value) fetchSlots(parseInt(e.target.value), bookForm.date);
                                }}
                                options={[{ value: '', label: 'Choose a Doctor' }, ...doctors.map(d => ({ value: d.id, label: d.fullName }))]}
                                required
                            />
                            <Input 
                                label="Appointment Date" 
                                type="date" 
                                value={bookForm.date} 
                                onChange={(e: any) => { 
                                    setBookForm({ ...bookForm, date: e.target.value, time: '' }); 
                                    if (bookForm.doctorId) fetchSlots(parseInt(bookForm.doctorId), e.target.value);
                                }}
                                required
                            />
                            <Select 
                                label="Available Time Slot" 
                                value={bookForm.time} 
                                onChange={(e: any) => setBookForm({ ...bookForm, time: e.target.value })}
                                options={[
                                    { value: '', label: 'Select a slot' },
                                    ...availableSlots.map(s => {
                                        const isBooked = s.endsWith('::booked');
                                        const time = isBooked ? s.split('::')[0] : s;
                                        return { 
                                            value: time, 
                                            label: isBooked ? `${time} (Booked)` : time,
                                            disabled: isBooked
                                        };
                                    })
                                ]}
                                required
                                disabled={!bookForm.doctorId || availableSlots.length === 0}
                            />
                            {!bookForm.doctorId ? (
                                <p className="text-[10px] text-zinc-400 italic">Select a doctor first to see availability.</p>
                            ) : availableSlots.length === 0 ? (
                                <p className="text-[10px] text-red-500 font-bold">Today no schedules for this doctor on selected date.</p>
                            ) : null}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 flex gap-3">
                        <Button type="button" variant="secondary" className="flex-1" onClick={() => setManualBookOpen(false)}>Discard</Button>
                        <Button type="submit" className="flex-1 bg-zinc-900 hover:bg-zinc-800 shadow-xl shadow-zinc-200" loading={submitting}>Confirm & Book</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
