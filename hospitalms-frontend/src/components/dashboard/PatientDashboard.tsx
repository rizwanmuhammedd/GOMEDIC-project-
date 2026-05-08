import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader, Card, EmptyState, Badge, LoadingSpinner, Button, statusBadge, Modal, Input, Select } from '../ui';
import {
    Calendar, Pill, FlaskConical, Receipt, User, Stethoscope,
    LayoutGrid, HeartPulse, Brain, Bone, Baby, Activity, X, ChevronRight, FileText, Plus, Clock, ArrowLeft, ArrowRight, Loader2, CheckCircle2, Sparkles
} from 'lucide-react';
import api, { appointmentApi, prescriptionApi, billApi, labApi, medicineApi, doctorApi } from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { AIChat } from '../chat/AIChat';

const DEPT_ICONS: Record<string, React.ReactNode> = {
    'General Medicine': <HeartPulse strokeWidth={1.5} className="w-5 h-5" />,
    'Cardiology': <HeartPulse strokeWidth={1.5} className="w-5 h-5 text-zinc-700" />,
    'Neurology': <Brain strokeWidth={1.5} className="w-5 h-5 text-zinc-700" />,
    'Orthopaedics': <Bone strokeWidth={1.5} className="w-5 h-5 text-zinc-700" />,
    'Paediatrics': <Baby strokeWidth={1.5} className="w-5 h-5 text-zinc-700" />,
};

export const PatientDashboard = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [doctors, setDoctors] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiChatOpen, setAIChatOpen] = useState(false);
    const [selectedDept, setSelectedDept] = useState<number | null>(null);
    const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
    const recordsRef = React.useRef<HTMLDivElement>(null);
    const { addToast } = useNotifications();

    // Booking States
    const [bookingModalOpen, setBookingModalOpen] = useState(false);
    const [bookingStep, setBookingStep] = useState(1);
    const [bookingDeptId, setBookingDeptId] = useState<number | null>(null);
    const [bookingDoc, setBookingDoc] = useState<any | null>(null);
    const [bookingDate, setBookingDate] = useState('');
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [chiefComplaint, setChiefComplaint] = useState('');
    const [patientAge, setPatientAge] = useState('');
    const [bookingLoading, setBookingLoading] = useState(false);
    
    // Auto-calculate age if DOB is available
    useEffect(() => {
        if (bookingModalOpen && user?.dateOfBirth) {
            try {
                const dobStr = user.dateOfBirth.split(' ')[0].split('T')[0];
                let [year, month, day] = [0, 0, 0];
                const parts = dobStr.split(/[-/]/);
                
                if (parts[0].length === 4) {
                    [year, month, day] = parts.map(Number);
                } else {
                    [day, month, year] = parts.map(Number);
                }

                if (year && month && day) {
                    const today = new Date();
                    let age = today.getFullYear() - year;
                    const m = today.getMonth() + 1;
                    if (m < month || (m === month && today.getDate() < day)) {
                        age--;
                    }
                    setPatientAge(age >= 0 ? age.toString() : '0');
                }
            } catch (err) {
                console.error("Age calculation error", err);
            }
        }
    }, [user, bookingModalOpen]);

    const [slotsLoading, setSlotsLoading] = useState(false);
    const [deptDoctors, setDeptDoctors] = useState<any[]>([]);
    const [deptDocsLoading, setDeptDocsLoading] = useState(false);

    useEffect(() => {
        if (location.pathname === '/appointments' && recordsRef.current) {
            recordsRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [location.pathname, loading]);

    const prescIdParam = searchParams.get('prescriptionId');
    const bookParam = searchParams.get('book');

    useEffect(() => {
        if (bookParam === 'true') {
            setBookingStep(1);
            setBookingModalOpen(true);
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('book');
            setSearchParams(newParams, { replace: true });
        }
    }, [bookParam, searchParams, setSearchParams]);

    useEffect(() => {
        if (bookingDeptId) {
            fetchDeptDoctors();
        }
    }, [bookingDeptId]);

    const fetchDeptDoctors = async () => {
        setDeptDocsLoading(true);
        try {
            const res = await api.get(`/api/doctors/department/${bookingDeptId}`);
            setDeptDoctors(res.data);
        } catch (err) {
            setDeptDoctors([]);
        } finally {
            setDeptDocsLoading(false);
        }
    };

    useEffect(() => {
        if (bookingDoc && bookingDate) {
            fetchSlots();
        }
    }, [bookingDoc, bookingDate]);

    const fetchSlots = async () => {
        setSlotsLoading(true);
        try {
            const slotsRes = await doctorApi.getAvailableSlots(bookingDoc.id, bookingDate);
            setAvailableSlots(slotsRes.data.availableSlots || []);
        } catch (err) {
            setAvailableSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    };

    const handleBookAppointment = async (e: React.FormEvent) => {
        e.preventDefault();
        setBookingLoading(true);
        try {
            await appointmentApi.book({
                doctorId: bookingDoc.id,
                patientName: user?.fullName || 'Patient',
                patientPhone: user?.phone || '',
                patientAge: parseInt(patientAge),
                appointmentDate: bookingDate,
                appointmentTime: selectedSlot.includes(':') && selectedSlot.split(':').length === 2 ? selectedSlot + ':00' : selectedSlot,
                chiefComplaint
            });
            addToast({ type: 'success', title: 'Success', message: 'Appointment booked successfully!' });
            setBookingModalOpen(false);
            resetBooking();
            const apptRes = await appointmentApi.getMy();
            setAppointments(apptRes.data);
        } catch (err: any) {
            addToast({ type: 'error', title: 'Booking Failed', message: err.response?.data?.message || 'Error booking appointment' });
        } finally {
            setBookingLoading(false);
        }
    };

    const resetBooking = () => {
        setBookingStep(1);
        setBookingDeptId(null);
        setBookingDoc(null);
        setBookingDate('');
        setSelectedSlot('');
        setChiefComplaint('');
    };

    const handlePayBillOnline = async (b: any) => {
        try {
            setLoading(true);
            addToast({ type: 'info', title: 'Connecting to Gateway', message: 'Initializing secure transaction...' });
            
            // 1. Create order
            const orderRes = await api.post(`/api/bills/${b.id}/create-razorpay-order`);
            const { orderId, amount, currency, keyId } = orderRes.data;

            // 2. Razorpay Options
            const options = {
                key: keyId,
                amount: amount * 100,
                currency: currency,
                name: "GOMEDIC Hospital",
                description: `Hospital Ledger Payment - ${b.billNumber}`,
                order_id: orderId,
                handler: async function (response: any) {
                    try {
                        addToast({ type: 'info', title: 'Finalizing', message: 'Verifying transaction with bank...' });
                        
                        await api.post('/api/bills/verify-razorpay-payment', {
                            razorpayOrderId: response.razorpay_order_id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature,
                            prescriptionId: b.id, // Using shared field for BillId
                            isMedicine: false
                        });

                        addToast({ type: 'success', title: 'Payment Secured', message: 'Transaction verified. Your ledger is now cleared.' });
                        
                        // Refresh bills
                        const res = await billApi.getByPatient(user?.id || 0);
                        setBills(res.data);
                    } catch (err: any) {
                        addToast({ type: 'error', title: 'Verification Failed', message: 'Contact support with transaction ID: ' + response.razorpay_payment_id });
                    }
                },
                prefill: {
                    name: user?.fullName,
                    contact: user?.phone
                },
                theme: { color: "#111827" }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', (res: any) => addToast({ type: 'error', title: 'Payment Aborted', message: res.error.description }));
            rzp.open();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Payment Error', message: 'Could not initiate gateway.' });
        } finally {
            setLoading(false);
        }
    };

    const handlePayForPrescription = async (p: any, isMedicine: boolean = false) => {
        try {
            addToast({ type: 'info', title: 'Preparing Payment', message: `Initializing ${isMedicine ? 'Medicine' : 'Consultation'} fee...` });
            
            // 1. Create order in backend
            const orderRes = await api.post(`/api/prescriptions/${p.id}/create-razorpay-order?isMedicine=${isMedicine}`);
            const { orderId, amount, currency, keyId } = orderRes.data;

            // 2. Configure Razorpay options
            const options = {
                key: keyId,
                amount: amount * 100,
                currency: currency,
                name: "GOMEDIC Hospital",
                description: `${isMedicine ? 'Medicine' : 'Consultation'} Fee - #${p.id}`,
                order_id: orderId,
                handler: async function (response: any) {
                    // 3. Verify payment in backend
                    try {
                        addToast({ type: 'info', title: 'Verifying Payment', message: 'Please wait while we confirm your payment...' });
                        
                        await api.post('/api/prescriptions/verify-razorpay-payment', {
                            razorpayOrderId: response.razorpay_order_id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature,
                            prescriptionId: p.id,
                            isMedicine: isMedicine
                        });

                        addToast({ type: 'success', title: 'Payment Successful', message: isMedicine ? 'Medicine payment confirmed.' : 'Prescription is now unlocked.' });
                        
                        // Refresh data
                        const prescRes = await prescriptionApi.getByPatient(user?.id || 0);
                        const updatedList = prescRes.data;
                        setPrescriptions(updatedList);
                        
                        // Update current selected prescription if open to show "Payment Completed"
                        const updatedP = updatedList.find((x: any) => x.id === p.id);
                        if (updatedP) {
                            setSelectedPrescription(updatedP);
                        }
                    } catch (err: any) {
                        addToast({ type: 'error', title: 'Verification Failed', message: 'We couldn\'t verify your payment. Please contact support.' });
                    }
                },
                prefill: {
                    name: user?.fullName,
                    contact: user?.phone
                },
                theme: {
                    color: isMedicine ? "#3b82f6" : "#10b981"
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (response: any) {
                addToast({ type: 'error', title: 'Payment Failed', message: response.error.description });
            });
            rzp.open();

        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Could not initiate payment' });
        }
    };

    const handleDismissMedicinePayment = async (prescriptionId: number) => {
        try {
            await api.patch(`/api/prescriptions/${prescriptionId}/dismiss-medicine-payment`);
            addToast({ type: 'info', title: 'Payment Dismissed', message: 'The medicine payment request has been removed.' });
            
            // Refresh data
            const prescRes = await prescriptionApi.getByPatient(user?.id || 0);
            setPrescriptions(prescRes.data);
        } catch (err: any) {
            addToast({ type: 'error', title: 'Error', message: 'Could not dismiss payment request' });
        }
    };

    const handleDownloadPrescription = (p: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        const itemsHtml = p.items?.map((it: any) => `
            <tr style="${it.isOutOfStock ? 'background: #fffafa;' : ''}">
                <td style="padding: 12px; border-bottom: 1px solid #eee;">
                    <div style="font-weight: bold; color: ${it.isOutOfStock ? '#ef4444' : '#111'};">${it.medicineName} ${it.isOutOfStock ? '<span style="font-size: 8px; border: 1px solid #ef4444; padding: 1px 4px; border-radius: 4px; margin-left: 8px; text-transform: uppercase;">Not Available</span>' : ''}</div>
                    <div style="font-size: 11px; color: #666;">${it.instructions || ''}</div>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; color: ${it.isOutOfStock ? '#ccc' : 'inherit'};">${it.dosage}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; color: ${it.isOutOfStock ? '#ccc' : 'inherit'};">${it.frequency}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center; color: ${it.isOutOfStock ? '#ccc' : 'inherit'};">${it.durationDays} Days</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Prescription #${p.id}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
                        .header { border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .hospital-name { font-size: 24px; font-weight: 800; color: #10b981; margin: 0; }
                        .meta-info { margin-bottom: 40px; display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
                        .meta-block h4 { font-size: 11px; text-transform: uppercase; color: #999; margin: 0 0 5px 0; }
                        .meta-block p { font-weight: bold; margin: 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background: #f9fafb; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; }
                        .footer { margin-top: 50px; border-top: 1px solid #eee; pt: 20px; font-size: 12px; color: #999; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h1 class="hospital-name">GOMEDIC HOSPITAL</h1>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Digital Clinical Record</p>
                        </div>
                        <div style="text-align: right">
                            <p style="font-weight: bold; margin: 0;">Prescription #${p.id}</p>
                            <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">Issued: ${new Date(p.prescribedAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                    
                    <div class="meta-info">
                        <div class="meta-block">
                            <h4>Patient Details</h4>
                            <p>${p.patientName || 'Clinical Subject'}</p>
                            <span style="font-size: 12px; color: #666;">ID: #${p.patientId}</span>
                        </div>
                        <div class="meta-block" style="text-align: right">
                            <h4>Prescribing Doctor</h4>
                            <p>${(p.doctorName || '').toLowerCase().startsWith('dr.') ? p.doctorName : 'Dr. ' + (p.doctorName || 'Medical Officer')}</p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Medication</th>
                                <th style="text-align: center;">Dosage</th>
                                <th style="text-align: center;">Frequency</th>
                                <th style="text-align: center;">Duration</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>

                    ${p.notes ? `<div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 10px;">
                        <h4 style="font-size: 11px; text-transform: uppercase; color: #999; margin: 0 0 10px 0;">Clinical Notes</h4>
                        <p style="margin: 0; font-size: 13px; line-height: 1.5;">${p.notes}</p>
                    </div>` : ''}

                    <div class="footer">
                        <p>This is a computer-generated document. No signature required.</p>
                        <p>&copy; ${new Date().getFullYear()} GOMEDIC Multi-Speciality Hospital</p>
                    </div>
                    <script>window.print(); setTimeout(() => window.close(), 500);</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleDownloadBill = (b: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice ${b.billNumber}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
                        .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .hospital-name { font-size: 24px; font-weight: 800; color: #3b82f6; margin: 0; }
                        .invoice-label { font-size: 32px; font-weight: 900; color: #eee; margin: 0; text-transform: uppercase; }
                        .meta-info { margin-bottom: 40px; display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
                        .meta-block h4 { font-size: 11px; text-transform: uppercase; color: #999; margin: 0 0 5px 0; }
                        .meta-block p { font-weight: bold; margin: 0; }
                        .line-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; font-size: 14px; }
                        .total-section { margin-top: 30px; border-top: 2px solid #333; pt: 20px; }
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
                            <p>${user?.fullName}</p>
                            <span style="font-size: 12px; color: #666;">Patient ID: #${b.patientId}</span>
                        </div>
                        <div class="meta-block" style="text-align: right">
                            <h4>Invoice Details</h4>
                            <p>${b.billNumber}</p>
                            <span style="font-size: 12px; color: #666;">Date: ${new Date(b.generatedAt).toLocaleDateString()}</span>
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
                            <span style="font-weight: bold">₹${b.totalAmount + b.discount}</span>
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
                            <span>₹${b.paidAmount}</span>
                        </div>
                        <div class="total-row">
                            <span style="color: #666">Balance Due</span>
                            <span style="font-weight: bold">₹${b.balanceAmount}</span>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Payment Status: ${b.paymentStatus.toUpperCase()}</p>
                        ${b.paidAt ? `<p>Paid On: ${new Date(b.paidAt).toLocaleString()}</p>` : ''}
                        <p style="margin-top: 20px">Thank you for choosing GOMEDIC Hospital. Wish you a speedy recovery.</p>
                    </div>
                    <script>window.print(); setTimeout(() => window.close(), 500);</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    useEffect(() => {
        const fetchData = async () => {
            const safeFetch = async (apiCall: any, fallback: any = []) => {
                try {
                    const res = await apiCall;
                    return res.data;
                } catch (err) {
                    console.warn("Individual fetch failed:", err);
                    return fallback;
                }
            };

            try {
                const [docs, depts, appts, prescs, bls] = await Promise.all([
                    safeFetch(doctorApi.getAll()),
                    safeFetch(api.get('/api/departments')),
                    safeFetch(appointmentApi.getMy()),
                    safeFetch(prescriptionApi.getByPatient(user?.id || 0)),
                    safeFetch(billApi.getByPatient(user?.id || 0))
                ]);
                
                setDoctors(docs);
                setDepartments(depts);
                setAppointments(appts);
                setPrescriptions(prescs);
                setBills(bls);
            } catch (e) {
                console.error("Critical error loading patient dashboard data:", e);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchData();
    }, [user]);

    const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);

    const filteredDoctors = selectedDept
        ? doctors.filter(d => d.departmentId === selectedDept)
        : doctors;

    if (loading) return <LoadingSpinner message="Loading patient portal..." />;

    const steps = ['Department', 'Specialist', 'Date & Time', 'Confirm'];

    return (
        <div className="pb-20 max-w-[1200px] mx-auto">
            {/* Main Content */}
            {location.pathname === '/appointments' ? (
                <div className="space-y-8">
                    <PageHeader title="My Appointments" subtitle="Manage your upcoming visits and medical history" />
                    <Card title="Upcoming & Recent Visits">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {appointments.length === 0 ? <div className="col-span-full"><EmptyState icon={<Calendar strokeWidth={1.5} className="w-8 h-8" />} title="No appointments found" /></div> :
                                appointments.map(a => (
                                    <div key={a.id} onClick={() => setSelectedAppointment(a)} className="p-5 rounded-[20px] border transition-colors cursor-pointer group bg-[#FDFDFD] border-zinc-200 hover:border-zinc-300 hover:shadow-sm">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center bg-emerald-500 border-emerald-500 text-white">
                                                <Stethoscope strokeWidth={2} className="w-5 h-5" />
                                            </div>
                                            <Badge variant={statusBadge(a.status)}>{a.status}</Badge>
                                        </div>
                                        <p className="font-semibold text-zinc-900 text-[15px] mb-0.5 tracking-tight">{a.doctorName}</p>
                                        <p className="text-zinc-500 text-[12px] font-medium mb-4">{a.departmentName || 'Specialist'}</p>
                                        <div className="flex items-center gap-2.5 text-[12px] font-semibold text-zinc-700">
                                            <Calendar strokeWidth={2} className="w-3.5 h-3.5 text-zinc-400" /> {a.appointmentDate}
                                            <Clock strokeWidth={2} className="w-3.5 h-3.5 text-zinc-400" /> {a.appointmentTime}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </Card>
                </div>
            ) : location.pathname === '/bills' ? (
                <div className="space-y-8">
                    <PageHeader title="Bills & Payments" subtitle="Track your medical expenses and payment status" />
                    
                    {/* Section: Pending Consultation Payments */}
                    <Card title="Direct Online Settlements">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {bills.filter(b => b.paymentStatus !== 'Paid').length === 0 ? (
                                <div className="col-span-full py-12 text-center text-zinc-400 text-[13px] italic border-2 border-dashed border-zinc-100 rounded-[32px]">
                                    No outstanding hospital dues detected.
                                </div>
                            ) : (
                                bills.filter(b => b.paymentStatus !== 'Paid').map(b => (
                                    <div key={b.id} className="relative overflow-hidden bg-zinc-900 rounded-[28px] p-6 text-white shadow-xl shadow-zinc-200/50 group">
                                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                            <Receipt className="w-24 h-24" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-center mb-6">
                                                <Badge variant="warning" className="bg-amber-400 text-amber-950 border-none font-black text-[10px]">Awaiting Payment</Badge>
                                                <p className="text-[11px] font-bold opacity-40 uppercase tracking-widest">{b.billNumber}</p>
                                            </div>
                                            <p className="text-[13px] opacity-60 font-medium mb-1">Total Outstanding</p>
                                            <h3 className="text-3xl font-black tracking-tight mb-8">₹{b.balanceAmount}</h3>
                                            
                                            <div className="space-y-3">
                                                <Button 
                                                    className="w-full h-12 bg-white text-zinc-900 hover:bg-zinc-100 font-bold border-none" 
                                                    onClick={() => handlePayBillOnline(b)}
                                                >
                                                    Secure Payment
                                                </Button>
                                                <p className="text-center text-[10px] opacity-40 font-medium">Encrypted & Secure Peer-to-Peer Transaction</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Section: Pending Medicine Payments */}
                    <Card title="Pending Medicine Payments">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {prescriptions.filter(p => p.isPaid && !p.isMedicinePaid && !p.isMedicinePaymentDismissed && p.status !== 'Dispensed').length === 0 ? (
                                <div className="col-span-full py-4 text-center text-zinc-400 text-[13px] italic border-2 border-dashed border-zinc-100 rounded-[20px]">
                                    No pending medicine payments.
                                </div>
                            ) : (
                                prescriptions.filter(p => p.isPaid && !p.isMedicinePaid && !p.isMedicinePaymentDismissed && p.status !== 'Dispensed').map(p => (
                                    <div key={p.id} className="bg-blue-50/30 rounded-[20px] p-5 border border-blue-100 shadow-sm hover:border-blue-200 transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-10 h-10 rounded-[12px] bg-blue-500 flex items-center justify-center text-white">
                                                <Pill strokeWidth={2} className="w-5 h-5" />
                                            </div>
                                            <Badge variant="warning">Medicine Fee</Badge>
                                        </div>
                                        <p className="text-[11px] font-bold text-blue-600 uppercase mb-1">Prescription #{p.id}</p>
                                        <h3 className="text-[16px] font-bold text-zinc-900 mb-4">₹{p.totalCost}</h3>
                                        
                                        <div className="flex gap-2">
                                            <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => handlePayForPrescription(p, true)}>Pay Now</Button>
                                            <Button size="sm" variant="secondary" className="px-3" onClick={() => handleDismissMedicinePayment(p.id)} title="Remove from this section"><X className="w-4 h-4" /></Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    <Card title="Payment Ledger">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {bills.length === 0 ? <div className="col-span-full"><EmptyState icon={<Receipt strokeWidth={1.5} className="w-8 h-8" />} title="No billing records found" /></div> :
                                bills.map(b => (
                                <div key={b.id} className="bg-[#FDFDFD] rounded-[20px] p-6 border border-zinc-200 shadow-sm hover:border-zinc-300 transition-colors group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-10 h-10 rounded-[12px] bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-600">
                                            <Receipt strokeWidth={2} className="w-5 h-5" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="secondary" className="px-2 h-8" onClick={() => handleDownloadBill(b)} title="Print Invoice"><FileText className="w-4 h-4" /></Button>
                                            <Badge variant={b.paymentStatus === 'Paid' ? 'success' : 'danger'}>{b.paymentStatus}</Badge>
                                        </div>
                                    </div>
                                    <h3 className="text-[16px] font-semibold tracking-tight text-zinc-900 mb-4">{b.billNumber}</h3>
                                    <div className="flex justify-between items-end border-t border-zinc-100 pt-4 mt-2">
                                        <div><p className="text-[10px] font-medium text-zinc-400 uppercase">Generated</p><p className="text-[13px] font-medium text-zinc-700">{new Date(b.generatedAt).toLocaleDateString()}</p></div>
                                        <div className="text-right"><p className="text-[10px] font-medium text-zinc-400 uppercase">Total</p><p className="text-[18px] font-bold text-zinc-900">₹{b.totalAmount}</p></div>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                    </Card>
                </div>
            ) : location.pathname === '/prescriptions' ? (
                <div className="space-y-8">
                    <PageHeader title="My Prescriptions" subtitle="Access your medical history and medicine details" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {prescriptions.length === 0 ? <div className="lg:col-span-3"><EmptyState icon={<Pill strokeWidth={1.5} className="w-8 h-8" />} title="No prescriptions found" /></div> :
                            prescriptions.map(p => (
                                <div key={p.id} className="bg-[#FDFDFD] rounded-[20px] p-6 border border-zinc-200 shadow-sm hover:border-zinc-300 transition-colors">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-10 h-10 rounded-[12px] bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-600"><Pill strokeWidth={2} className="w-5 h-5" /></div>
                                        <Badge variant={p.status === 'Dispensed' ? 'success' : 'warning'}>{p.status}</Badge>
                                    </div>
                                    <p className="text-[11px] font-semibold text-zinc-500 mb-1">{(p.doctorName || '').toLowerCase().startsWith('dr.') ? p.doctorName : `Dr. ${p.doctorName || 'Medical Team'}`}</p>
                                    <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900 mb-4">Prescription #{p.id}</h3>
                                    <div className="flex justify-between items-center border-t border-zinc-100 pt-4 mt-2">
                                        <div><p className="text-[10px] font-medium text-zinc-400 uppercase">Issued On</p><p className="text-[13px] font-medium text-zinc-700">{new Date(p.prescribedAt).toLocaleDateString()}</p></div>
                                        <div className="flex gap-2">
                                            {p.isPaid ? (
                                                <>
                                                    <Button size="sm" variant="secondary" onClick={() => setSelectedPrescription(p)}>View</Button>
                                                    <Button size="sm" variant="secondary" className="px-2" onClick={() => handleDownloadPrescription(p)} title="Download PDF"><FileText className="w-4 h-4" /></Button>
                                                </>
                                            ) : (
                                                <div className="text-right">
                                                    <p className="text-[10px] text-zinc-400 italic mb-1">Pay bill to unlock</p>
                                                    <Badge variant="warning">Awaiting Payment</Badge>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            ) : (
                <div className="space-y-10">
                    <PageHeader title="Patient Dashboard" subtitle="Manage your health and connect with specialists" />
                    
                    {/* AI ASSISTANT PROMO */}
                    <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-700 rounded-[32px] p-8 text-white shadow-xl group">
                        <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <Sparkles className="w-48 h-48" />
                        </div>
                        <div className="relative z-10 max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-[10px] font-black uppercase tracking-widest mb-4">
                                <Sparkles className="w-3 h-3" /> New Platform Feature
                            </div>
                            <h2 className="text-3xl font-black tracking-tight mb-3">AI Medical Assistant</h2>
                            <p className="text-emerald-50 text-[15px] font-medium leading-relaxed mb-8 opacity-90">
                                Get instant answers to your medical questions, symptom analysis, and wellness guidance powered by our advanced clinical logic engine.
                            </p>
                            <button 
                                onClick={() => setAIChatOpen(true)}
                                className="bg-white text-emerald-700 px-8 py-3.5 rounded-2xl text-[14px] font-black transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-95"
                            >
                                Start Smart Consultation
                            </button>
                        </div>
                    </div>

                    {/* DEPARTMENTS */}
                    <section className="space-y-5">
                        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                            <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5"><LayoutGrid strokeWidth={2} className="w-5 h-5 text-zinc-500" /> Departments</h2>
                            {selectedDept && <Button size="sm" variant="secondary" onClick={() => setSelectedDept(null)}>Clear Filter</Button>}
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            {departments.map(dept => (
                                <div key={dept.id} onClick={() => setSelectedDept(dept.id)} className={`group p-5 rounded-[20px] border transition-all cursor-pointer text-center ${selectedDept === dept.id ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-[#FDFDFD] border-zinc-200 hover:border-zinc-300 hover:shadow-sm text-zinc-900'}`}>
                                    <div className={`w-10 h-10 rounded-[10px] mx-auto mb-3 flex items-center justify-center transition-colors ${selectedDept === dept.id ? 'bg-zinc-800 text-white' : 'bg-zinc-50 border border-zinc-100 text-zinc-600 group-hover:bg-zinc-100'}`}>{DEPT_ICONS[dept.name] || <Stethoscope strokeWidth={1.5} className="w-5 h-5" />}</div>
                                    <h3 className="font-semibold text-[13px] tracking-tight">{dept.name}</h3>
                                    <p className={`text-[11px] mt-1.5 font-medium ${selectedDept === dept.id ? 'text-zinc-400' : 'text-zinc-500'}`}>{doctors.filter(d => d.departmentId === dept.id).length} Specialists</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* SPECIALISTS */}
                    <section className="space-y-5 pt-4">
                        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                            <h2 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5"><User strokeWidth={2} className="w-5 h-5 text-zinc-500" /> {selectedDept ? `Specialists in ${departments.find(d => d.id === selectedDept)?.name}` : 'Our Clinical Team'}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredDoctors.map(doc => (
                                <div key={doc.id} className="bg-[#FDFDFD] rounded-[20px] border border-zinc-200 p-5 transition-shadow hover:shadow-md hover:border-zinc-300">
                                    <div className="flex items-center gap-4 mb-5">
                                        {doc.profileImageUrl ? <img src={doc.profileImageUrl} alt={doc.fullName} className="w-14 h-14 rounded-[14px] object-cover bg-zinc-50 border border-zinc-100" /> : <div className="w-14 h-14 rounded-[14px] flex items-center justify-center bg-zinc-50 border border-zinc-200 text-zinc-400"><User strokeWidth={1.5} className="w-6 h-6" /></div>}
                                        <div className="flex-1 min-w-0"><h3 className="text-[15px] font-semibold text-zinc-900 truncate">{doc.fullName}</h3><p className="text-[12px] text-zinc-500 truncate">{doc.specialization}</p></div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                                        <div className="flex flex-col"><span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Consultation</span><span className="text-[15px] font-bold text-zinc-900">₹{doc.consultationFee}</span></div>
                                        <Button size="sm" onClick={() => { setBookingDoc(doc); setBookingDate(new Date().toISOString().split('T')[0]); setBookingStep(3); setBookingModalOpen(true); }}>Schedule Visit</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {/* Common Modals */}

            {/* Generic Booking Modal (Multi-step like home) */}
            <Modal
                isOpen={bookingModalOpen}
                onClose={() => { setBookingModalOpen(false); resetBooking(); }}
                title="Schedule an Appointment"
                size="md"
            >
                <div className="space-y-8">
                    {/* Progress Bar */}
                    <div className="flex items-center px-2">
                        {steps.map((s, i) => (
                            <React.Fragment key={s}>
                                <div className="flex flex-col items-center gap-2 relative z-10">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-300 ${i + 1 <= bookingStep ? 'bg-emerald-500 text-white ring-4 ring-emerald-50' : 'bg-zinc-100 text-zinc-400'}`}>
                                        {i + 1 < bookingStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider absolute -bottom-5 whitespace-nowrap ${i + 1 <= bookingStep ? 'text-zinc-900' : 'text-zinc-400'}`}>{s}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 transition-colors duration-300 ${i + 1 < bookingStep ? 'bg-emerald-500' : 'bg-zinc-100'}`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="pt-4">
                        {/* Step 1: Department */}
                        {bookingStep === 1 && (
                            <div className="animate-in slide-in-from-right-2 fade-in duration-300">
                                <div className="mb-6">
                                    <h3 className="text-[17px] font-bold text-zinc-900">Select Department</h3>
                                    <p className="text-[13px] text-zinc-500">Choose the clinical department for your visit</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    {departments.map(d => (
                                        <button key={d.id} onClick={() => { setBookingDeptId(d.id); setBookingStep(2); }}
                                            className="p-4 rounded-[20px] border border-zinc-200 bg-white hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-md transition-all text-center group">
                                            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center mx-auto mb-3 text-zinc-500 group-hover:bg-white group-hover:text-emerald-600 transition-colors">
                                                {DEPT_ICONS[d.name] || <Stethoscope className="w-5 h-5" />}
                                            </div>
                                            <span className="text-[14px] font-bold text-zinc-800 block">{d.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Doctor */}
                        {bookingStep === 2 && (
                            <div className="animate-in slide-in-from-right-2 fade-in duration-300">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-[17px] font-bold text-zinc-900">Choose Specialist</h3>
                                        <p className="text-[13px] text-zinc-500">Select a doctor from our {departments.find(d => d.id === bookingDeptId)?.name} team</p>
                                    </div>
                                    <button onClick={() => setBookingStep(1)} className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
                                </div>
                                
                                {deptDocsLoading ? <LoadingSpinner message="Finding specialists..." /> : (
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {deptDoctors.map(doc => (
                                            <button key={doc.id} onClick={() => { setBookingDoc(doc); setBookingDate(new Date().toISOString().split('T')[0]); setBookingStep(3); }}
                                                className="w-full p-4 rounded-[20px] border border-zinc-200 bg-white hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-md transition-all flex items-center gap-4 text-left group">
                                                <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-white transition-colors">
                                                    {doc.profileImageUrl ? <img src={doc.profileImageUrl} alt="" className="w-full h-full object-cover rounded-xl" /> : <User className="w-6 h-6" />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[14px] font-bold text-zinc-900">{(doc.fullName || '').toLowerCase().startsWith('dr.') ? doc.fullName : `Dr. ${doc.fullName}`}</p>
                                                    <p className="text-[12px] text-zinc-500">{doc.specialization}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[14px] font-bold text-emerald-600">₹{doc.consultationFee}</p>
                                                    <p className="text-[10px] font-medium text-zinc-400 uppercase">Per Visit</p>
                                                </div>
                                            </button>
                                        ))}
                                        {deptDoctors.length === 0 && <EmptyState icon={<User className="w-8 h-8" />} title="No doctors available" description="Try selecting a different department." />}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 3: Date & Time */}
                        {bookingStep === 3 && bookingDoc && (
                            <div className="animate-in slide-in-from-right-2 fade-in duration-300">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-[17px] font-bold text-zinc-900">Appointment Schedule</h3>
                                        <p className="text-[13px] text-zinc-500">Pick a convenient time for your consultation</p>
                                    </div>
                                    {!bookParam && <button onClick={() => setBookingStep(2)} className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 transition-colors"><ArrowLeft className="w-4 h-4" /></button>}
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                                            <User strokeWidth={2} className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-bold text-emerald-900">{(bookingDoc.fullName || '').toLowerCase().startsWith('dr.') ? bookingDoc.fullName : `Dr. ${bookingDoc.fullName}`}</p>
                                            <p className="text-[11px] text-emerald-700 font-medium opacity-80">{bookingDoc.specialization}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="Visit Date" type="date" required value={bookingDate} onChange={(e: any) => setBookingDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                                        <div>
                                            <label className="text-[12px] font-medium text-zinc-700 ml-0.5">Patient Age</label>
                                            <input 
                                                type="number" 
                                                value={patientAge} 
                                                onChange={e => setPatientAge(e.target.value)} 
                                                placeholder="Age"
                                                readOnly={!!user?.dateOfBirth}
                                                className={`w-full px-3.5 py-2.5 mt-1.5 border border-zinc-200 rounded-lg text-[13px] placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 transition-all ${user?.dateOfBirth ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed' : 'bg-white text-zinc-900'}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[12px] font-medium text-zinc-700 ml-0.5">Select Time Slot</label>
                                        {slotsLoading ? <LoadingSpinner size="sm" /> : (
                                            <div className="grid grid-cols-4 gap-2">
                                                {availableSlots.map(slotStr => {
                                                    const isBooked = slotStr.endsWith('::booked');
                                                    const slot = isBooked ? slotStr.replace('::booked', '') : slotStr;
                                                    return (
                                                        <button key={slotStr} type="button" disabled={isBooked} onClick={() => setSelectedSlot(slot)}
                                                            className={`py-2.5 rounded-xl border text-[11px] font-bold transition-all ${isBooked ? 'bg-zinc-50 text-zinc-300 border-zinc-100 cursor-not-allowed' : selectedSlot === slot ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'}`}>
                                                            {slot}
                                                        </button>
                                                    );
                                                })}
                                                {availableSlots.length === 0 && <div className="col-span-4 p-4 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-zinc-400 text-[12px] italic">No slots available for this date.</div>}
                                            </div>
                                        )}
                                    </div>

                                    <Input label="Chief Complaint" required value={chiefComplaint} onChange={(e: any) => setChiefComplaint(e.target.value)} placeholder="Briefly describe your health concern..." />
                                </div>

                                <Button onClick={() => setBookingStep(4)} disabled={!selectedSlot || !bookingDate || !chiefComplaint || !patientAge} className="w-full mt-10 h-12 shadow-lg shadow-emerald-500/10">Continue to Review</Button>
                            </div>
                        )}

                        {/* Step 4: Finalize */}
                        {bookingStep === 4 && bookingDoc && (
                            <div className="animate-in slide-in-from-right-2 fade-in duration-300">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[17px] font-bold text-zinc-900">Review Appointment</h3>
                                    <button onClick={() => setBookingStep(3)} className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
                                </div>
                                
                                <div className="relative overflow-hidden bg-white border border-zinc-200 rounded-[24px] shadow-sm">
                                    {/* Decorative "Ticket" elements */}
                                    <div className="absolute top-1/2 -left-3 w-6 h-6 bg-zinc-50 rounded-full border border-zinc-200 -translate-y-1/2" />
                                    <div className="absolute top-1/2 -right-3 w-6 h-6 bg-zinc-50 rounded-full border border-zinc-200 -translate-y-1/2" />
                                    
                                    <div className="p-6 border-b border-dashed border-zinc-200">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500 overflow-hidden">
                                                {bookingDoc.profileImageUrl ? <img src={bookingDoc.profileImageUrl} alt="" className="w-full h-full object-cover" /> : <User className="w-7 h-7" />}
                                            </div>
                                            <div>
                                                <p className="text-[15px] font-bold text-zinc-900">{(bookingDoc.fullName || '').toLowerCase().startsWith('dr.') ? bookingDoc.fullName : `Dr. ${bookingDoc.fullName}`}</p>
                                                <p className="text-[12px] text-zinc-500 font-medium">{bookingDoc.specialization} &bull; {departments.find(d => d.id === bookingDeptId)?.name}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Date & Time</p>
                                                <div className="flex items-center gap-2 text-[14px] font-bold text-zinc-800">
                                                    <Calendar className="w-4 h-4 text-emerald-500" /> {bookingDate}
                                                </div>
                                                <div className="flex items-center gap-2 text-[14px] font-bold text-zinc-800 mt-1">
                                                    <Clock className="w-4 h-4 text-emerald-500" /> {selectedSlot}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Consultation Fee</p>
                                                <p className="text-2xl font-black text-zinc-900">₹{bookingDoc.consultationFee}</p>
                                                <p className="text-[11px] text-zinc-500">Payable at hospital</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-zinc-50/50">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1"><Activity className="w-4 h-4 text-zinc-400" /></div>
                                            <div>
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Clinical Note</p>
                                                <p className="text-[13px] text-zinc-600 font-medium leading-relaxed italic">"{chiefComplaint}"</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-10 space-y-3">
                                    <Button onClick={handleBookAppointment} loading={bookingLoading} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20 text-[14px] font-bold">Confirm & Book Appointment</Button>
                                    <p className="text-center text-[11px] text-zinc-400 font-medium px-4">By confirming, you agree to our hospital's clinical attendance and cancellation policies.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Other Modals (Prescription, Appointment Detail) */}
            <Modal isOpen={!!selectedAppointment} onClose={() => setSelectedAppointment(null)} title="Appointment Information" size="md">
                {selectedAppointment && (
                    <div className="space-y-8">
                        <div className="relative overflow-hidden bg-white border border-zinc-200 rounded-[28px] shadow-sm">
                            <div className="bg-zinc-900 p-6 text-white relative">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <Activity className="w-32 h-32" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <Badge variant={statusBadge(selectedAppointment.status)}>{selectedAppointment.status}</Badge>
                                        <p className="text-[12px] font-bold opacity-60 uppercase tracking-widest">Token #{selectedAppointment.tokenNumber || '---'}</p>
                                    </div>
                                    <h3 className="text-2xl font-black tracking-tight mb-1">{(selectedAppointment.doctorName || '').toLowerCase().startsWith('dr.') ? selectedAppointment.doctorName : `Dr. ${selectedAppointment.doctorName}`}</h3>
                                    <p className="text-[13px] opacity-70 font-medium uppercase tracking-wider">{selectedAppointment.departmentName || 'Medical Specialist'}</p>
                                </div>
                            </div>

                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Visit Date</p>
                                        <p className="text-[15px] font-bold text-zinc-900">{selectedAppointment.appointmentDate}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 justify-end"><Clock className="w-3 h-3" /> Time Slot</p>
                                        <p className="text-[15px] font-bold text-zinc-900">{selectedAppointment.appointmentTime}</p>
                                    </div>
                                </div>

                                <div className="h-px bg-zinc-100" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><User className="w-3 h-3" /> Patient Subject</p>
                                        <p className="text-[14px] font-bold text-zinc-900">{selectedAppointment.patientName || user?.fullName}</p>
                                        <p className="text-[12px] text-zinc-500 font-medium">{selectedAppointment.patientAge || '---'} Years Old</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5"><HeartPulse className="w-3 h-3" /> Chief Complaint</p>
                                        <p className="text-[13px] font-medium text-zinc-600 leading-relaxed italic">"{selectedAppointment.chiefComplaint || 'No clinical notes provided.'}"</p>
                                    </div>
                                </div>

                                {selectedAppointment.status === 'Scheduled' && (
                                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                                        <div className="mt-0.5"><Activity className="w-4 h-4 text-amber-600" /></div>
                                        <p className="text-[11px] text-amber-800 font-medium leading-relaxed">Please arrive 15 minutes before your scheduled time. Carry any previous medical reports for review.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex gap-3 pt-2">
                            <Button className="flex-1" variant="secondary" onClick={() => setSelectedAppointment(null)}>Close Window</Button>
                            {selectedAppointment.status === 'Scheduled' && (
                                <Button className="flex-1 bg-red-50 text-red-600 border-red-100 hover:bg-red-100 hover:border-red-200" onClick={async () => {
                                    if (window.confirm('Are you sure you want to cancel this appointment?')) {
                                        try {
                                            await appointmentApi.cancel(selectedAppointment.id);
                                            addToast({ type: 'success', title: 'Cancelled', message: 'Appointment cancelled successfully' });
                                            setSelectedAppointment(null);
                                            const apptRes = await appointmentApi.getMy();
                                            setAppointments(apptRes.data);
                                        } catch (err) {
                                            addToast({ type: 'error', title: 'Error', message: 'Could not cancel appointment' });
                                        }
                                    }
                                }}>Cancel Visit</Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={!!selectedPrescription} onClose={() => setSelectedPrescription(null)} title="Prescription Details" size="md">
                {selectedPrescription && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
                            <div><p className="text-[10px] font-bold text-zinc-400 uppercase">Doctor</p><p className="text-[14px] font-bold text-zinc-900">{(selectedPrescription.doctorName || '').toLowerCase().startsWith('dr.') ? selectedPrescription.doctorName : `Dr. ${selectedPrescription.doctorName}`}</p></div>
                            <Badge variant={selectedPrescription.status === 'Dispensed' ? 'success' : 'warning'}>{selectedPrescription.status}</Badge>
                        </div>
                        <div className="space-y-3">
                            {selectedPrescription.items?.map((it: any, i: number) => (
                                <div key={i} className={`flex justify-between items-center py-2 border-b border-zinc-50 ${it.isOutOfStock ? 'opacity-60' : ''}`}>
                                   <div>
                                       <div className="flex items-center gap-2">
                                           <p className="text-[13px] font-bold text-zinc-900">{it.medicineName}</p>
                                           {it.isOutOfStock && <Badge variant="error" className="text-[8px] px-1 py-0 uppercase">STOCK OUT - Buy Outside</Badge>}
                                       </div>
                                       <p className="text-[11px] text-zinc-500">{it.dosage} - {it.frequency}</p>
                                       {it.isOutOfStock && <p className="text-[10px] text-red-500 font-medium italic">Unavailable in Hospital Pharmacy</p>}
                                   </div>
                                   <div className="text-right">
                                       <p className="text-[12px] font-bold">{it.durationDays} Days</p>
                                       <p className={`text-[11px] ${it.isOutOfStock ? 'line-through text-red-400' : 'text-zinc-400'}`}>₹{it.lineTotal}</p>
                                   </div>
                                </div>                            ))}
                        </div>
                        {selectedPrescription.isPaid && !selectedPrescription.isMedicinePaid && selectedPrescription.status !== 'Dispensed' && (
                            <div className="pt-2">
                                {selectedPrescription.items?.some((it: any) => !it.isOutOfStock) ? (
                                    <>
                                        <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-md" onClick={() => handlePayForPrescription(selectedPrescription, true)}>
                                            Pay for Available Medicines (₹{selectedPrescription.totalCost})
                                        </Button>
                                        <p className="text-[10px] text-zinc-400 text-center mt-2 italic">Payment for unavailable items has been removed.</p>
                                    </>
                                ) : (
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-center">
                                        <p className="text-[12px] font-bold text-red-600">All medicines are currently out of stock.</p>
                                        <p className="text-[10px] text-red-500 mt-1 italic">Please purchase these medications from an external pharmacy. No hospital payment required.</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {selectedPrescription.isMedicinePaid && (
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                                <span className="text-[12px] font-bold text-blue-700">Medicine Payment Confirmed</span>
                                <Badge variant="success">Paid ₹{selectedPrescription.totalCost}</Badge>
                            </div>
                        )}
                        <Button className="w-full" variant="secondary" onClick={() => setSelectedPrescription(null)}>Close</Button>
                    </div>
                )}
            </Modal>

            <AIChat isOpen={aiChatOpen} onClose={() => setAIChatOpen(false)} />
        </div>
    );
};
