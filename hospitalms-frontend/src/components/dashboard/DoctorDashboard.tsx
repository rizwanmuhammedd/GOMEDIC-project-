import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Calendar, BedDouble, Pill, Plus, X, Search, Activity, Camera, User, ClipboardList, CheckCircle2, Clock, Users, ArrowRight } from 'lucide-react';
import { StatCard, Card, Badge, statusBadge, Button, Modal, Input, PageHeader, EmptyState, LoadingSpinner, Select } from '../ui';
import { appointmentApi, admissionApi, medicineApi, prescriptionApi, authApi, doctorApi, bedApi } from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<any | null>(null);
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [prescribeOpen, setPrescribeOpen] = useState(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<number | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Admission State
  const [admitForm, setAdmitForm] = useState({
    patientId: '',
    wardType: 'General',
    admissionReason: ''
  });

  const isAppointmentTimeReached = (date: string, time: string) => {
    try {
        const now = new Date();
        const apptDateTime = new Date(`${date}T${time}`);
        return now >= apptDateTime;
    } catch (e) {
        return false;
    }
  };

  const getAppointmentsForSelectedDate = () => {
    return appointments.filter(a => a.appointmentDate === selectedDate && a.status !== 'Cancelled');
  };

  const getUniqueDates = () => {
    const dates = [...new Set(appointments.filter(a => a.status !== 'Cancelled').map(a => a.appointmentDate))];
    const today = new Date().toISOString().split('T')[0];
    if (!dates.includes(today)) {
        dates.push(today);
    }
    return dates.sort();
  };

  // Prescription State
  const [availableMeds, setAvailableMeds] = useState<any[]>([]);
  const [selectedPatientPhone, setSelectedPatientPhone] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [prescriptionSearchTerm, setPrescriptionSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useNotifications();

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [apptRes, admRes, medRes, prescRes, profileRes] = await Promise.all([
        appointmentApi.getByMyDoctor(),
        admissionApi.getAll(),
        medicineApi.getAll(),
        prescriptionApi.getDoctorPrescriptions(),
        doctorApi.getMe()
      ]);
      setAppointments(apptRes.data);
      
      // Doctor only sees patients they admitted
      const docId = profileRes.data?.id;
      if (docId) {
        setAdmissions(admRes.data.filter((a: any) => a.doctorId === docId));
      } else {
        setAdmissions([]);
      }

      setAvailableMeds(medRes.data);
      setPrescriptions(prescRes.data);
      setDoctorProfile(profileRes.data);
    } catch (err: any) {
      console.error("Load failed", err);
      addToast({
        type: 'error',
        title: 'Data Load Error',
        message: err.response?.data?.message || 'Could not fetch dashboard data. Check API connection.'
      });
    } finally { setLoading(false); }
  }, [user, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const isPatientAdmitted = (patientId: number) => {
    return admissions.some(a => a.patientId === patientId);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
        const res = await authApi.uploadPicture(file, true);
        const newUrl = res.data.imageUrl;
        
        if (user && newUrl) {
            try {
              await doctorApi.updateProfilePicture(newUrl);
            } catch (err) {
              console.warn("PatientService sync failed", err);
            }
            const updatedUser = { ...user, profileImageUrl: newUrl };
            localStorage.setItem('hms_user', JSON.stringify(updatedUser));
            addToast({ type: 'success', title: 'Updated', message: 'Profile picture updated successfully' });
            setTimeout(() => window.location.reload(), 800);
        }
    } catch (err: any) {
        addToast({ type: 'error', title: 'Upload Failed', message: err.response?.data?.message || 'Failed to upload' });
    } finally {
        setUploading(false);
    }
  };

  const handleAddMed = (med: any) => {
    setPrescriptionItems([...prescriptionItems, {
      medicineId: med.id,
      name: med.name,
      dosage: '1-0-1',
      frequency: 'After Food',
      durationDays: 5,
      quantityToDispense: 10, // Default: (1+0+1) * 5 rounded to reasonable number
      instructions: ''
    }]);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const calculateQuantity = (dosage: string, duration: number) => {
    try {
        const parts = dosage.split('-').map(Number);
        const dailyCount = parts.reduce((a, b) => a + b, 0);
        return dailyCount * duration;
    } catch (e) {
        return 10; // Fallback
    }
  };

  const filteredMeds = availableMeds.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSavePrescription = async () => {
    if (!selectedPatient || prescriptionItems.length === 0) {
      return addToast({ type: 'warning', title: 'Action Required', message: 'Add at least one medicine.' });
    }

    if (!notes.trim()) {
      return addToast({ type: 'warning', title: 'Action Required', message: 'Please add clinical notes/diagnosis.' });
    }

    const invalidItems = prescriptionItems.filter(it => !it.quantityToDispense || it.quantityToDispense <= 0);
    if (invalidItems.length > 0) {
      return addToast({ type: 'warning', title: 'Invalid Quantity', message: 'All medicines must have a valid quantity.' });
    }

    addToast({
      type: 'warning',
      title: 'Finalize Prescription?',
      message: `Are you sure you want to ${editingPrescriptionId ? 'update' : 'finalize'} this prescription for ${selectedPatientName}?`,
      onConfirm: async () => {
        setSubmitting(true);
        try {
          const payload = {
            patientId: selectedPatient,
            patientName: selectedPatientName,
            patientPhone: selectedPatientPhone,
            appointmentId: selectedApptId,
            doctorName: user?.fullName || 'Doctor',
            notes: notes,
            items: prescriptionItems.map(it => ({
                ...it,
                quantityToDispense: Math.min(it.quantityToDispense, 30) // Safety limit: max 30 units per item
            }))
          };

          if (editingPrescriptionId) {
            await prescriptionApi.update(editingPrescriptionId, payload);
            addToast({ type: 'success', title: 'Success', message: 'Prescription updated.' });
          } else {
            await prescriptionApi.create(payload);
            if (selectedApptId) {
              await appointmentApi.update(selectedApptId, { status: 'Completed' });
            }
            addToast({ type: 'success', title: 'Success', message: 'Prescription finalized.' });
          }

          setPrescribeOpen(false);
          setEditingPrescriptionId(null);
          setPrescriptionItems([]);
          setNotes('');
          loadData();
        } catch (err: any) {
          addToast({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Error saving' });
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleEditPrescription = (p: any) => {
    setEditingPrescriptionId(p.id);
    setSelectedPatient(p.patientId);
    setSelectedPatientName(p.patientName);
    setSelectedPatientPhone(p.patientPhone || '');
    setNotes(p.notes || '');
    setPrescriptionItems(p.items.map((it: any) => ({
      medicineId: it.medicineId,
      name: it.medicineName,
      dosage: it.dosage,
      frequency: it.frequency,
      durationDays: it.durationDays,
      quantityToDispense: it.quantityToDispense,
      instructions: it.instructions
    })));
    setPrescribeOpen(true);
  };

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitForm.patientId) return;

    addToast({
      type: 'warning',
      title: 'Request Admission?',
      message: `Are you sure you want to request admission for Patient #${admitForm.patientId}?`,
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await admissionApi.admit({
            patientId: parseInt(admitForm.patientId),
            doctorId: doctorProfile?.id, 
            wardType: admitForm.wardType,
            admissionReason: admitForm.admissionReason
          });
          addToast({ type: 'success', title: 'Admission Requested', message: 'Patient admission process initiated.' });
          setAdmitOpen(false);
          setAdmitForm({ patientId: '', wardType: 'General', admissionReason: '' });
          loadData();
        } catch (err: any) {
          addToast({ type: 'error', title: 'Admission Failed', message: err.response?.data?.message || 'Error processing admission' });
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const renderDashboard = () => {
    const parseTime = (t: string) => {
        if (!t) return 0;
        const [time, period] = t.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const dates = getUniqueDates();
    const currentAppts = getAppointmentsForSelectedDate();
    const filteredQueue = currentAppts
        .filter(a =>
            a.status !== 'Completed' &&
            ((a.patientName || '').toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
             a.patientId.toString().includes(patientSearchTerm))
        )
        .sort((a, b) => parseTime(a.appointmentTime) - parseTime(b.appointmentTime));

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <PageHeader
                    title={`Welcome, ${(user?.fullName || '').toLowerCase().startsWith('dr.') ? user?.fullName?.split(' ')[1] || '' : `Dr. ${user?.fullName?.split(' ')[0] || ''}`}`}
                    subtitle="Here's what's happening with your practice today."
                />
                <div className="flex items-center gap-4">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-16 h-16 rounded-[20px] overflow-hidden border-2 border-zinc-100 shadow-sm transition-all group-hover:border-zinc-300">
                            {user?.profileImageUrl ? (
                                <img src={user.profileImageUrl} alt={user.fullName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-zinc-50 flex items-center justify-center text-zinc-400">
                                    <User strokeWidth={1.5} className="w-8 h-8" />
                                </div>
                            )}
                            {uploading && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-[20px]">
                                    <LoadingSpinner size="sm" />
                                </div>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-500 transition-transform group-hover:scale-110">
                            <Camera strokeWidth={2} className="w-3 h-3" />
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
                    </div>
                    <Button onClick={() => setAdmitOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/10"><Plus className="w-4 h-4" /> Admit Patient</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Appointments</p>
                            <h3 className="text-2xl font-bold text-zinc-900">{appointments.filter(a => a.status !== 'Completed' && a.status !== 'Cancelled').length}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
                            <BedDouble className="w-6 h-6 text-violet-500" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Admissions</p>
                            <h3 className="text-2xl font-bold text-zinc-900">{admissions.length}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Completed</p>
                            <h3 className="text-2xl font-bold text-zinc-900">{appointments.filter(a => a.status === 'Completed').length}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Waiting</p>
                            <h3 className="text-2xl font-bold text-zinc-900">{appointments.filter(a => a.status === 'Scheduled').length}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Day-wise Selection Tabs */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {dates.map(date => {
                            const isToday = date === new Date().toISOString().split('T')[0];
                            const displayDate = new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
                            return (
                                <button
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    className={`px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all whitespace-nowrap border ${
                                        selectedDate === date 
                                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200' 
                                            : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-300'
                                    }`}
                                >
                                    {isToday ? `Today, ${displayDate}` : displayDate}
                                    <span className={`ml-2 px-1.5 py-0.5 rounded-lg text-[10px] ${selectedDate === date ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                        {appointments.filter(a => a.appointmentDate === date).length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <Card className="p-0 border-none shadow-sm bg-white overflow-hidden">
                        <div className="p-5 border-b border-zinc-50 flex flex-wrap justify-between items-center gap-4">
                            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-500" /> Scheduled for {new Date(selectedDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        className="pl-3 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[12px] font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                    />
                                </div>
                                <div className="relative w-48">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Search patient..." 
                                        className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={patientSearchTerm}
                                        onChange={(e) => setPatientSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-2">
                            {filteredQueue.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
                                    <Calendar className="w-12 h-12 mb-3 opacity-20" />
                                    <p>{patientSearchTerm ? "No matching patients" : "No appointments for this date"}</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredQueue.map(a => (
                                        <div key={a.id} className="p-4 hover:bg-zinc-50 transition-colors rounded-lg flex justify-between items-center group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                                                    {a.tokenNumber}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[14px] font-bold text-zinc-900">{a.patientName}</p>
                                                        {isPatientAdmitted(a.patientId) && (
                                                            <Badge variant="success" className="text-[9px] px-1.5 py-0">Admitted</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-zinc-500 font-medium">{(a.patientAge !== undefined && a.patientAge !== null) ? `${a.patientAge}y` : 'Age N/A'} &bull; ID #{a.patientId} &bull; {a.appointmentTime} &bull; <span className="text-zinc-700 font-bold">{a.patientPhone || 'N/A'}</span></p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={statusBadge(a.status)}>{a.status}</Badge>
                                                <Button size="sm" variant="secondary" onClick={() => { setSelectedPatient(a.patientId); setSelectedPatientName(a.patientName); setSelectedPatientPhone(a.patientPhone || ''); setSelectedApptId(a.id); setPrescribeOpen(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Prescribe
                                                </Button>
                                                {isAppointmentTimeReached(a.appointmentDate, a.appointmentTime) && (
                                                    <Button size="sm" variant="secondary" onClick={() => { setAdmitForm({ ...admitForm, patientId: a.patientId.toString() }); setAdmitOpen(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Admit
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
                {/* ... Admissions card ... */}
                <div className="space-y-8">
                    <Card className="p-0 border-none shadow-sm bg-white overflow-hidden">
                        <div className="p-5 border-b border-zinc-50 flex justify-between items-center">
                            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                                <BedDouble className="w-4 h-4 text-violet-500" /> Admitted Patients
                            </h3>
                            <Button variant="secondary" size="sm" onClick={() => window.location.pathname = '/admissions'}>All Admissions</Button>
                        </div>
                        <div className="p-4 space-y-3">
                            {admissions.length === 0 ? (
                                <div className="py-12 text-center text-zinc-400 text-sm italic">No active admissions</div>
                            ) : (
                                admissions.slice(0, 5).map(a => (
                                    <div key={a.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-zinc-200 transition-colors flex justify-between items-center">
                                        <div>
                                            <p className="text-[13px] font-bold text-zinc-900">{a.patientName || `Patient #${a.patientId}`}</p>
                                            <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5"><BedDouble className="w-3 h-3 text-zinc-400" /> ID #{a.patientId} &bull; Bed {a.bedNumber}</p>
                                            <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase tracking-wider">{a.patientAge}y &bull; {a.patientPhone || 'No Phone Registered'}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-zinc-300" />
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
  };

  const renderAppointments = () => {
    const parseTime = (t: string) => {
        if (!t) return 0;
        const [time, period] = t.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    const dates = getUniqueDates();
    const filtered = appointments
        .filter(a => 
            a.appointmentDate === selectedDate &&
            a.status !== 'Cancelled' &&
            ((a.patientName || '').toLowerCase().includes(patientSearchTerm.toLowerCase()) || 
            a.patientId.toString().includes(patientSearchTerm))
        )
        .sort((a, b) => parseTime(a.appointmentTime) - parseTime(b.appointmentTime));

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <PageHeader title="Patient Appointments" subtitle="Manage your clinical queue and historical patient visits" />
                <div className="w-full md:w-80 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                        type="text" 
                        placeholder="Search patient name or ID..." 
                        className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        value={patientSearchTerm}
                        onChange={(e) => setPatientSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Day Selection Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {dates.map(date => {
                    const isToday = date === new Date().toISOString().split('T')[0];
                    const displayDate = new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
                    return (
                        <button
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            className={`px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all whitespace-nowrap border ${
                                selectedDate === date 
                                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200' 
                                    : 'bg-white text-zinc-500 border-zinc-100 hover:border-zinc-300'
                            }`}
                        >
                            {isToday ? `Today, ${displayDate}` : displayDate}
                            <span className={`ml-2 px-1.5 py-0.5 rounded-lg text-[10px] ${selectedDate === date ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                {appointments.filter(a => a.appointmentDate === date).length}
                            </span>
                        </button>
                    );
                })}
            </div>

            <Card className="p-0 border-none shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-50/50">
                            <tr>
                                <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Patient Name</th>
                                <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Token</th>
                                <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Schedule</th>
                                <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {filtered.map(a => (
                                <tr key={a.id} className="hover:bg-zinc-50/80 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[14px] font-bold text-zinc-900">{a.patientName}</p>
                                            {isPatientAdmitted(a.patientId) && (
                                                <Badge variant="success" className="text-[9px] px-1.5 py-0">Admitted</Badge>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-zinc-500">{(a.patientAge !== undefined && a.patientAge !== null) ? `${a.patientAge} Years` : 'Age N/A'} &bull; ID #{a.patientId}</p>
                                    </td>
                                    <td className="p-4">
                                        <span className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center font-bold text-zinc-600 text-[12px]">
                                            {a.tokenNumber}
                                        </span>
                                    </td>
                                    <td className="p-4 text-[13px] text-zinc-600 font-medium">{a.appointmentTime}</td>
                                    <td className="p-4"><Badge variant={statusBadge(a.status)}>{a.status}</Badge></td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {a.status !== 'Completed' && (
                                                <Button size="sm" variant="secondary" onClick={() => { setSelectedPatient(a.patientId); setSelectedPatientName(a.patientName); setSelectedPatientPhone(a.patientPhone || ''); setSelectedApptId(a.id); setPrescribeOpen(true); }}>
                                                    Prescribe
                                                </Button>
                                            )}
                                            {isAppointmentTimeReached(a.appointmentDate, a.appointmentTime) && (
                                                <Button size="sm" variant="secondary" onClick={() => { setAdmitForm({ ...admitForm, patientId: a.patientId.toString() }); setAdmitOpen(true); }}>
                                                    Admit
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="py-20 text-center text-zinc-400">
                            <Search className="w-12 h-12 mb-3 mx-auto opacity-20" />
                            <p>No matching appointments found for this date</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
  };

  const renderPrescriptions = () => {
    const filtered = prescriptions.filter(p => 
        p.id.toString().includes(prescriptionSearchTerm) || 
        p.patientId.toString().includes(prescriptionSearchTerm)
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <PageHeader title="Clinical Prescriptions" subtitle="View and manage medication history for your patients" />
                <div className="w-full md:w-80 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                        type="text" 
                        placeholder="Search by ID or Patient ID..." 
                        className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        value={prescriptionSearchTerm}
                        onChange={(e) => setPrescriptionSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-3xl border border-zinc-100 flex flex-col items-center justify-center text-zinc-400">
                        <Search className="w-12 h-12 mb-3 opacity-20" />
                        <p>{prescriptionSearchTerm ? "No matching prescriptions" : "No prescriptions issued yet"}</p>
                    </div>
                ) : (
                    filtered.map(p => (
                        <Card key={p.id} className="p-0 border-none shadow-sm bg-white overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                            <div className="p-5 border-b border-zinc-50 flex justify-between items-start bg-zinc-50/30">
                                <div>
                                    <h3 className="text-[15px] font-bold text-zinc-900 leading-tight">{p.patientName || `Patient #${p.patientId}`}</h3>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">#PRES-{p.id} &bull; ID #{p.patientId}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={p.status === 'Dispensed' ? 'success' : 'warning'}>{p.status}</Badge>
                                    {p.status === 'Pending' && (
                                        <button 
                                            onClick={() => handleEditPrescription(p)}
                                            className="p-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-400 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                                            title="Edit Prescription"
                                        >
                                            <Activity className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-5 flex-1 space-y-4">
                                {p.patientPhone && (
                                    <div className="flex justify-between items-center text-[12px]">
                                        <span className="text-zinc-500 font-medium">Contact</span>
                                        <span className="font-bold text-zinc-900">{p.patientPhone}</span>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Medications</p>
                                    <div className="space-y-1.5">
                                        {p.items?.map((it: any, i: number) => (
                                            <div key={i} className={`flex justify-between items-center text-[12px] bg-zinc-50/50 px-3 py-2 rounded-lg border border-zinc-100/50 ${it.isOutOfStock ? 'opacity-60' : ''}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-zinc-600 font-medium">{it.medicineName}</span>
                                                    {it.isOutOfStock && <Badge variant="error" className="text-[8px] px-1 py-0">STOCK OUT</Badge>}
                                                </div>
                                                <span className={`font-bold ${it.isOutOfStock ? 'text-zinc-400 line-through' : 'text-emerald-600'}`}>x{it.quantityToDispense}</span>
                                            </div>
                                        ))}                                    </div>
                                </div>
                                {p.notes && (
                                    <div className="pt-3 border-t border-zinc-50">
                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Notes</p>
                                        <p className="text-[12px] text-zinc-600 line-clamp-2 leading-relaxed italic">"{p.notes}"</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
  };

  const renderAdmissions = () => (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <PageHeader title="Patient Admissions" subtitle="Track active inpatient care and bed assignments" />
        <Button onClick={() => setAdmitOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/10"><Plus className="w-4 h-4" /> New Admission</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {admissions.map(a => (
          <Card key={a.id} className="p-0 border-none shadow-sm bg-white hover:shadow-md transition-all border-l-4 border-l-emerald-500 overflow-hidden">
            <div className="p-5 border-b border-zinc-50 flex justify-between items-start bg-zinc-50/30">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900">{a.patientName || `Patient #${a.patientId}`}</h3>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">ID #{a.patientId}</p>
                  </div>
               </div>
               <Badge variant="success">Active</Badge>
            </div>
            
            <div className="p-5 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Contact & Age</p>
                    <p className="text-[12px] font-bold text-zinc-900">{a.patientPhone || 'No Phone'}</p>
                    <p className="text-[11px] text-zinc-500">{a.patientAge} Years Old</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Bed Assignment</p>
                    <p className="text-[12px] font-bold text-emerald-600 flex items-center justify-end gap-1.5"><BedDouble className="w-3.5 h-3.5" /> {a.bedNumber}</p>
                    <p className="text-[11px] text-zinc-500">{a.wardType} Ward</p>
                  </div>
               </div>

               <div className="pt-4 border-t border-zinc-50 flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1 text-[11px] h-8">Vitals</Button>
                  <Button size="sm" variant="secondary" className="flex-1 text-[11px] h-8">History</Button>
               </div>
            </div>
          </Card>
        ))}
        {admissions.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-zinc-100 flex flex-col items-center justify-center text-zinc-400">
            <BedDouble className="w-12 h-12 mb-3 opacity-20" />
            <p>No active admissions under your care</p>
          </div>
        )}
      </div>
    </div>
  );

  const getContent = () => {
    if (location.pathname === '/appointments') return renderAppointments();
    if (location.pathname === '/prescriptions') return renderPrescriptions();
    if (location.pathname === '/admissions') return renderAdmissions();
    return renderDashboard();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="pb-20 max-w-7xl mx-auto">
      {getContent()}

      <Modal isOpen={admitOpen} onClose={() => setAdmitOpen(false)} title="New Admission Request">
        <form onSubmit={handleAdmit} className="space-y-6">
          <p className="text-[13px] text-zinc-500 leading-relaxed mb-2">Initiate an admission request for clinical care. Floor management will assign the specific bed.</p>
          
          <Input 
            label="Patient Registration ID" 
            type="number" 
            required
            value={admitForm.patientId}
            onChange={(e: any) => setAdmitForm({ ...admitForm, patientId: e.target.value })}
            placeholder="e.g. 1004" 
          />
          <Input 
            label="Admission Reason" 
            placeholder="e.g. Post-operative care" 
            value={admitForm.admissionReason}
            onChange={(e: any) => setAdmitForm({ ...admitForm, admissionReason: e.target.value })}
          />
          <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/10" loading={submitting}>Process Request</Button>
        </form>
      </Modal>

      <Modal isOpen={prescribeOpen} onClose={() => { setPrescribeOpen(false); setEditingPrescriptionId(null); setPrescriptionItems([]); setNotes(''); }} title={editingPrescriptionId ? "Edit Clinical Prescription" : "Clinical Prescription Form"} size="xl">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-3 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
            <div className="sticky top-0 bg-[#FDFDFD] z-10 pb-4 border-b border-zinc-100 mb-4">
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Medication Search</p>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search strokeWidth={2} className="w-4 h-4 text-zinc-400" />
                </div>
                <input
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-zinc-200 text-[13px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 transition-all"
                  placeholder="Search active pharmacy inventory..."
                  value={searchTerm}
                  onChange={(e: any) => {
                    const val = e.target.value;
                    setSearchTerm(val);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {showSuggestions && searchTerm && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-zinc-200 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] max-h-56 overflow-y-auto custom-scrollbar">
                    {filteredMeds.length > 0 ? (
                      filteredMeds.map(m => (
                        <div
                          key={m.id}
                          className="px-4 py-3 hover:bg-zinc-50 cursor-pointer text-[13px] font-medium border-b border-zinc-100 last:border-0 transition-colors flex justify-between items-center"
                          onClick={() => handleAddMed(m)}
                        >
                          <span className="text-zinc-900">{m.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-4 text-[13px] text-zinc-500 text-center italic">No inventory match</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 pb-4">
              {prescriptionItems.length === 0 && (
                <div className="bg-zinc-50/50 border border-dashed border-zinc-200 rounded-[16px] py-10 flex flex-col items-center justify-center text-zinc-400">
                  <Pill strokeWidth={1.5} className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-[12px] font-medium">Search to add medications</p>
                </div>
              )}

              {prescriptionItems.map((it, i) => (
                <div key={i} className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm relative group">
                  <button onClick={() => setPrescriptionItems(prescriptionItems.filter((_, idx) => idx !== i))} className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 hover:bg-red-50 w-6 h-6 rounded-md flex items-center justify-center transition-colors">
                    <X strokeWidth={2} className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[14px] font-bold tracking-tight text-zinc-900 pr-8 line-clamp-1">{it.name}</span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">Dosage</label>
                      <input className="w-full px-3 py-2 text-[12px] bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-zinc-100 focus:border-zinc-400 transition-all text-zinc-900 font-medium" placeholder="e.g. 1-0-1" value={it.dosage} onChange={(e) => {
                        const newItems = [...prescriptionItems];
                        newItems[i].dosage = e.target.value;
                        setPrescriptionItems(newItems);
                      }} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5 block">Quantity Total (Max 30)</label>
                      <input 
                        className="w-full px-3 py-2 text-[12px] bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-zinc-100 focus:border-zinc-400 transition-all text-zinc-900 font-medium" 
                        placeholder="Qty" 
                        type="number" 
                        min="1" 
                        max="30"
                        value={it.quantityToDispense} 
                        onChange={(e) => {
                          let val = parseInt(e.target.value) || 0;
                          if (val > 30) val = 30; // Hard cap on input
                          const newItems = [...prescriptionItems];
                          newItems[i].quantityToDispense = val;
                          setPrescriptionItems(newItems);
                        }} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-4 border-t md:border-t-0 md:border-l border-zinc-100 pt-6 md:pt-0 md:pl-6">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">Clinical Notes & Diagnosis</p>
            <textarea
              className="w-full h-[200px] md:h-[300px] p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-[13px] outline-none focus:ring-4 focus:ring-zinc-100 focus:border-zinc-400 resize-none transition-all text-zinc-900 placeholder-zinc-400"
              placeholder="Document symptoms, diagnosis, and care instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-8 pt-5 border-t border-zinc-100 flex justify-end">
          <Button className="w-full sm:w-auto min-w-[200px] bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/10" loading={submitting} onClick={handleSavePrescription}>Confirm & Finalize</Button>
        </div>
      </Modal>
    </div>
  );
};

export default DoctorDashboard;
