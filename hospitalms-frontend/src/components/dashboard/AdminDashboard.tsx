import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Users, Activity, Plus, Camera, User, Stethoscope, Pill, Receipt, ShieldCheck, 
  Mail, Lock, Phone, BedDouble, TrendingUp, Package, Search, Filter, ArrowRight,
  ClipboardList, CheckCircle2, AlertCircle, Trash2, Edit, AlertTriangle, RefreshCw
} from 'lucide-react';
import { 
  Card, Badge, PageHeader, LoadingSpinner, Button, Modal, Input, Select, 
  EmptyState, ImageUpload, StatCard 
} from '../ui';
import api, { authApi, departmentApi, doctorApi, bedApi, billApi, medicineApi, adminApi } from '../../api/axiosInstance';
import { useNotifications } from '../../context/NotificationContext';

const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const { addToast, hasUnreadInSection } = useNotifications();
  const [users, setUsers] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);

  // Form State
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '', role: 'Doctor',
    dateOfBirth: '',
    specialization: '', qualification: '', departmentId: '', consultationFee: '500',
    profileImageUrl: ''
  });

  const [bedForm, setBedForm] = useState({
    bedNumber: '', wardType: 'General'
  });

  const handleAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/beds', bedForm);
      addToast({ type: 'success', title: 'Bed Added', message: `Bed ${bedForm.bedNumber} has been added to ${bedForm.wardType} ward.` });
      setBedModalOpen(false);
      setBedForm({ bedNumber: '', wardType: 'General' });
      // Refresh beds
      const bedRes = await bedApi.getAll();
      setBeds(bedRes.data);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Could not add bed' });
    } finally { setSubmitting(false); }
  };

  const loadData = useCallback(async () => {
    try {
      const [usersRes, deptsRes, docsRes, bedsRes, billsRes, medsRes, statsRes] = await Promise.all([
        authApi.getUsers(),
        departmentApi.getAll(),
        doctorApi.getAll(),
        bedApi.getAll(),
        billApi.getPending(),
        medicineApi.getAll(),
        adminApi.getStats()
      ]);
      
      setUsers(usersRes.data);
      setDepartments(deptsRes.data);
      setDoctorsList(docsRes.data);
      setBeds(bedsRes.data);
      setBills(billsRes.data);
      setMedicines(medsRes.data);
      setStats(statsRes.data);
    } catch (err: any) {
      console.error("Failed to load admin data", err);
      addToast({ type: 'error', title: 'Load Error', message: 'Failed to synchronize administrative data.' });
    } finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await authApi.uploadPicture(file, false);
      const imageUrl = res.data.imageUrl;

      if (editModalOpen && selectedStaff) {
        setSelectedStaff((prev: any) => ({ ...prev, profileImageUrl: imageUrl }));
      } else {
        setForm((prev: any) => ({ ...prev, profileImageUrl: imageUrl }));
      }
      addToast({ type: 'success', title: 'Image Uploaded', message: 'Picture ready for profile' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Upload Failed', message: 'Could not upload image.' });
    } finally { setUploading(false); }
  };

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.role === 'Doctor' && !form.departmentId) {
      return addToast({ type: 'warning', title: 'Missing Info', message: 'Please select a department for Doctor' });
    }

    setSubmitting(true);
    try {
      const authRes = await api.post('/api/auth/create-staff', {
        FullName: form.fullName,
        Email: form.email.toLowerCase().trim(),
        Password: form.password,
        Phone: form.phone,
        DateOfBirth: form.dateOfBirth,
        Role: form.role
      });

      const newUserId = authRes.data.id;

      if (form.role === 'Doctor') {
        try {
          await api.post('/api/doctors', {
            UserId: newUserId,
            FullName: form.fullName,
            DepartmentId: parseInt(form.departmentId),
            Specialization: form.specialization,
            Qualification: form.qualification,
            LicenseNumber: `LIC-${Math.floor(Math.random() * 100000)}`,
            ConsultationFee: parseFloat(form.consultationFee),
            MaxPatientsPerDay: 30,
            ProfileImageUrl: form.profileImageUrl
          });
        } catch (docErr: any) {
          console.error("Doctor profile link failed", docErr);
        }

        if (form.profileImageUrl) {
          await api.patch(`/api/auth/users/${newUserId}/profile-picture`, { ImageUrl: form.profileImageUrl });
        }
      }

      addToast({ type: 'success', title: 'Staff Registered', message: `${form.role} ${form.fullName} is now active.` });
      setAddModalOpen(false);
      loadData();
      setForm({ fullName: '', email: '', password: '', phone: '', role: 'Doctor', specialization: '', qualification: '', departmentId: '', consultationFee: '500', profileImageUrl: '' });
    } catch (err: any) {
      const serverMsg = err.response?.data?.message;
      const validationErrors = err.response?.data?.errors;
      const errorDetail = validationErrors 
        ? (Array.isArray(validationErrors) ? validationErrors.join(', ') : Object.values(validationErrors).flat().join(', '))
        : serverMsg;
      addToast({ type: 'error', title: 'Registration Failed', message: errorDetail || 'Check security requirements.' });
    } finally { setSubmitting(false); }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setSubmitting(true);
    try {
      // 1. Always sync profile picture if modified
      if (selectedStaff.id && selectedStaff.profileImageUrl) {
        await api.patch(`/api/auth/users/${selectedStaff.id}/profile-picture`, { ImageUrl: selectedStaff.profileImageUrl });
      }

      // 2. Update Professional Profile if Doctor
      if (selectedStaff.role === 'Doctor' && selectedStaff.docProfile) {
        const dp = selectedStaff.docProfile;
        await api.put(`/api/doctors/${dp.id}`, {
          id: dp.id,
          fullName: selectedStaff.fullName,
          departmentId: dp.departmentId,
          specialization: dp.specialization,
          qualification: dp.qualification,
          consultationFee: parseFloat(dp.consultationFee.toString()),
          maxPatientsPerDay: dp.maxPatientsPerDay || 30,
          isAvailable: dp.isAvailable !== undefined ? dp.isAvailable : true,
          profileImageUrl: selectedStaff.profileImageUrl || dp.profileImageUrl || ''
        });
      }

      addToast({ type: 'success', title: 'Profile Updated', message: `Details for ${selectedStaff.fullName} saved.` });
      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Update Failed', message: 'Error saving changes.' });
    } finally { setSubmitting(false); }
  };

  const handleDeleteStaff = async (userId: number) => {
    if (!userId || !window.confirm("Are you sure you want to deactivate this staff member?")) return;
    try {
      await authApi.deleteUser(userId);
      addToast({ type: 'success', title: 'Staff Deactivated', message: 'Account access has been restricted.' });
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Delete Failed', message: 'Check if backend is running.' });
    }
  };

  const handleRestoreStaff = async (userId: number) => {
    try {
      await authApi.restoreUser(userId);
      addToast({ type: 'success', title: 'Staff Restored', message: 'The user account is now active again.' });
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Restore Failed', message: 'Check if backend is running.' });
    }
  };

  // Process all staff data
  const authStaff = users.filter((u: any) => (u.role || u.Role) !== 'Patient');
  const activeStaff: any[] = [];
  const deactivatedStaff: any[] = [];

  authStaff.forEach(u => {
    const active = u.isActive === false || u.IsActive === false ? false : true;
    const docProfile = doctorsList.find(d => d.userId === u.id);
    const staffObj = { ...u, docProfile, role: u.role || u.Role, isActive: active };
    if (active) activeStaff.push(staffObj);
    else deactivatedStaff.push(staffObj);
  });

  // Find doctors with no auth account
  const ghostDoctors = doctorsList
    .filter(doc => !users.find(u => u.id === doc.userId))
    .map(doc => ({
        fullName: doc.fullName,
        role: 'Doctor',
        isGhost: true,
        docProfile: doc,
        isActive: true,
        email: 'No Login Account Linked'
    }));

  const renderDashboard = () => (
    <div className="space-y-8">
      <PageHeader 
        title="Hospital Overview" 
        subtitle="System-wide metrics and status monitoring" 
        hasAlert={hasUnreadInSection('Dashboard')}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active Personnel" value={activeStaff.length + ghostDoctors.length} icon={<Users />} color="blue" />
        <StatCard title="Total Beds" value={beds.length} icon={<BedDouble />} color="violet" />
        <StatCard title="Inventory Items" value={medicines.length} icon={<Package />} color="orange" />
        <StatCard title="Unpaid Bills" value={bills.length} icon={<Receipt />} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="System Alerts">
          <div className="space-y-4">
            {ghostDoctors.length === 0 ? (
                <EmptyState icon={<CheckCircle2 className="text-emerald-500" />} title="Database Synchronized" subtitle="All registered doctors have active login accounts." />
            ) : (
                ghostDoctors.map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            <div>
                                <p className="text-[13px] font-bold text-zinc-900">{u.fullName}</p>
                                <p className="text-[11px] text-orange-600 font-medium">Click to create login account for this doctor.</p>
                            </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => { setForm({ ...form, fullName: u.fullName, role: 'Doctor' }); setAddModalOpen(true); }}>Link Account</Button>
                    </div>
                ))
            )}
          </div>
        </Card>

        <Card title="Facility Overview">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-center">
               <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Available</p>
               <h3 className="text-2xl font-bold text-emerald-700">{beds.filter(b => (b.status || '').toLowerCase() === 'available').length}</h3>
            </div>
            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-center">
               <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Occupied</p>
               <h3 className="text-2xl font-bold text-zinc-700">{beds.filter(b => (b.status || '').toLowerCase() === 'occupied').length}</h3>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderStaff = () => (
    <div className="space-y-12">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <PageHeader 
                title="Staff Personnel" 
                subtitle="Manage hospital staff and clinical specialists" 
                hasAlert={hasUnreadInSection('Staff')}
            />
            <Button onClick={() => setAddModalOpen(true)}><Plus className="w-4 h-4" /> Register Staff</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...activeStaff, ...ghostDoctors].map((u, i) => (
            <StaffCard 
                key={u.id || `ghost-${i}`} 
                user={u} 
                onEdit={() => { setSelectedStaff(u); setEditModalOpen(true); }}
                onDelete={u.id ? () => handleDeleteStaff(u.id) : undefined}
            />
            ))}
        </div>
      </div>

      {deactivatedStaff.length > 0 && (
        <div className="space-y-6 pt-12 border-t border-zinc-100">
            <PageHeader title="Deactivated Accounts" subtitle="Staff members with restricted system access" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
                {deactivatedStaff.map((u) => (
                <StaffCard 
                    key={u.id} 
                    user={u} 
                    onRestore={() => handleRestoreStaff(u.id)}
                />
                ))}
            </div>
        </div>
      )}
    </div>
  );

  const renderBeds = () => (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <PageHeader 
            title="Facility Management" 
            subtitle="Monitor and update hospital bed availability" 
            hasAlert={hasUnreadInSection('Beds')}
        />
        <Button onClick={() => setBedModalOpen(true)} className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/10">
          <Plus className="w-4 h-4" /> Add New Bed
        </Button>
      </div>
      <Card className="p-0 border-none shadow-sm bg-white overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-50/50">
            <tr>
              <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Bed Number</th>
              <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Ward Type</th>
              <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {beds.map(b => (
              <tr key={b.id}>
                <td className="p-4 font-bold text-zinc-900">#{b.bedNumber}</td>
                <td className="p-4 text-[13px] text-zinc-600">{b.wardType}</td>
                <td className="p-4"><Badge variant={b.status === 'Available' ? 'success' : 'danger'}>{b.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  const renderPharmacy = () => (
    <div className="space-y-8">
      <PageHeader 
        title="Pharmacy Oversight" 
        subtitle="Global inventory monitoring and stock levels" 
        hasAlert={hasUnreadInSection('Pharmacy')}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {medicines.map(m => (
          <Card key={m.id} className="p-5 border-none shadow-sm bg-white flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.stockQuantity <= m.minimumStockLevel ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                  <Pill className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-[14px] font-bold text-zinc-900">{m.name}</p>
                  <p className="text-[11px] text-zinc-500">{m.category}</p>
               </div>
            </div>
            <div className="text-right">
               <p className={`text-[15px] font-bold ${m.stockQuantity <= m.minimumStockLevel ? 'text-red-600' : 'text-zinc-900'}`}>{m.stockQuantity}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-8">
      <PageHeader 
        title="Financial Records" 
        subtitle="Track pending payments and hospital revenue" 
        hasAlert={hasUnreadInSection('Billing')}
      />
      <Card className="p-0 border-none shadow-sm bg-white overflow-hidden">
        <table className="w-full text-left">
           <thead className="bg-zinc-50/50">
             <tr>
               <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Bill ID</th>
               <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Patient</th>
               <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Amount</th>
               <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-zinc-50">
             {bills.map(bill => (
               <tr key={bill.id}>
                 <td className="p-4 font-bold text-zinc-900">#BILL-{bill.id}</td>
                 <td className="p-4 text-[13px] text-zinc-600">Patient #{bill.patientId}</td>
                 <td className="p-4 font-bold text-zinc-900">₹{bill.totalAmount}</td>
                 <td className="p-4"><Badge variant="warning">{bill.status}</Badge></td>
               </tr>
             ))}
           </tbody>
        </table>
      </Card>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-8">
      <PageHeader 
        title="Hospital Analytics" 
        subtitle="Data-driven insights for hospital operations" 
        hasAlert={hasUnreadInSection('Analytics')}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Activity Stats">
          <div className="h-64 flex items-center justify-center bg-zinc-50 border border-dashed border-zinc-200 rounded-3xl text-zinc-400 text-sm">
             Analytics Visualization Placeholder
          </div>
        </Card>
        <Card title="Operational Performance">
           <div className="space-y-6 pt-4">
              <div>
                 <div className="flex justify-between text-[12px] font-bold mb-2 uppercase tracking-widest text-zinc-500">
                    <span>Bed Utilization</span>
                    <span>{stats ? Math.round((beds.filter(b => b.status === 'Occupied').length / (beds.length || 1)) * 100) : 0}%</span>
                 </div>
                 <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats ? (beds.filter(b => b.status === 'Occupied').length / (beds.length || 1)) * 100 : 0}%` }} />
                 </div>
              </div>
              <div>
                 <div className="flex justify-between text-[12px] font-bold mb-2 uppercase tracking-widest text-zinc-500">
                    <span>Inventory Health</span>
                    <span>{stats ? Math.round((medicines.filter(m => m.stockQuantity > m.minimumStockLevel).length / (medicines.length || 1)) * 100) : 0}%</span>
                 </div>
                 <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats ? (medicines.filter(m => m.stockQuantity > m.minimumStockLevel).length / (medicines.length || 1)) * 100 : 0}%` }} />
                 </div>
              </div>
           </div>
        </Card>
      </div>
    </div>
  );

  const getContent = () => {
    switch (location.pathname) {
      case '/staff': return renderStaff();
      case '/beds': return renderBeds();
      case '/pharmacy': return renderPharmacy();
      case '/billing': return renderBilling();
      case '/analytics': return renderAnalytics();
      default: return renderDashboard();
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="pb-20 max-w-7xl mx-auto">
      {getContent()}

      {/* Register Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Register Hospital Staff" size="lg">
        <form onSubmit={handleRegisterStaff} className="space-y-6 max-h-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5 mb-3">Account Details</p>
              <Input label="Full Name" value={form.fullName} onChange={(e: any) => setForm({ ...form, fullName: e.target.value })} required placeholder="e.g. Sana Ahmed" />
              <Input label="Email Address" type="email" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} required placeholder="sana@hospital.com" />
              <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e: any) => setForm({ ...form, dateOfBirth: e.target.value })} required />
              <Input label="Temporary Password" type="password" value={form.password} onChange={(e: any) => setForm({ ...form, password: e.target.value })} required placeholder="••••••••" />

              <Select
                label="Assign Role"
                value={form.role}
                onChange={(e: any) => setForm({ ...form, role: e.target.value })}
                options={[
                  { value: 'Doctor', label: 'Medical Doctor' },
                  { value: 'Pharmacist', label: 'Pharmacist' },
                  { value: 'Receptionist', label: 'Receptionist' },
                  { value: 'LabTechnician', label: 'Lab Technician' },
                  { value: 'Admin', label: 'Administrator' }
                ]}
                required
              />
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5 mb-3">Contact & Profile</p>
              <Input label="Phone Number" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} required placeholder="9876543210" />

              {form.role === 'Doctor' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <ImageUpload
                    label="Profile Image"
                    value={form.profileImageUrl}
                    onChange={handleFileUpload}
                    loading={uploading}
                  />
                  <Select
                    label="Department"
                    value={form.departmentId}
                    onChange={(e: any) => setForm({ ...form, departmentId: e.target.value })}
                    options={[{ value: '', label: 'Select Department' }, ...departments.map(d => ({ value: d.id.toString(), label: d.name }))]}
                    required
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Specialization" value={form.specialization} onChange={(e: any) => setForm({ ...form, specialization: e.target.value })} required placeholder="e.g. Cardiology" />
                    <Input label="Fee (₹)" type="number" value={form.consultationFee} onChange={(e: any) => setForm({ ...form, consultationFee: e.target.value })} required />
                  </div>
                  <Input label="Qualification" value={form.qualification} onChange={(e: any) => setForm({ ...form, qualification: e.target.value })} required placeholder="e.g. MBBS, MD" />
                </div>
              )}
            </div>
          </div>
          <div className="pt-5 border-t border-zinc-100 flex gap-3 mt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/10" loading={submitting}>Register Staff</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit ${selectedStaff?.role || 'Staff'} Profile`} size="md">
        {selectedStaff && (
          <form onSubmit={handleUpdateStaff} className="space-y-4">
            <ImageUpload
              label="Profile Image"
              value={selectedStaff.profileImageUrl || (selectedStaff.docProfile?.profileImageUrl)}
              onChange={handleFileUpload}
              loading={uploading}
            />
            <Input label="Full Name" value={selectedStaff.fullName} onChange={(e: any) => setSelectedStaff({ ...selectedStaff, fullName: e.target.value })} required />
            <Input label="Phone Number" value={selectedStaff.phone} onChange={(e: any) => setSelectedStaff({ ...selectedStaff, phone: e.target.value })} required />
            
            {selectedStaff.role === 'Doctor' && selectedStaff.docProfile && (
              <div className="space-y-4 pt-2 border-t border-zinc-100 mt-4">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Clinical Details</p>
                <Select
                  label="Department"
                  value={selectedStaff.docProfile.departmentId.toString()}
                  onChange={(e: any) => setSelectedStaff({ ...selectedStaff, docProfile: { ...selectedStaff.docProfile, departmentId: parseInt(e.target.value) } })}
                  options={departments.map(d => ({ value: d.id.toString(), label: d.name }))}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Specialization" value={selectedStaff.docProfile.specialization} onChange={(e: any) => setSelectedStaff({ ...selectedStaff, docProfile: { ...selectedStaff.docProfile, specialization: e.target.value } })} required />
                  <Input label="Fee (₹)" type="number" value={selectedStaff.docProfile.consultationFee} onChange={(e: any) => setSelectedStaff({ ...selectedStaff, docProfile: { ...selectedStaff.docProfile, consultationFee: e.target.value } })} required />
                </div>
                <Input label="Qualification" value={selectedStaff.docProfile.qualification} onChange={(e: any) => setSelectedStaff({ ...selectedStaff, docProfile: { ...selectedStaff.docProfile, qualification: e.target.value } })} required />
              </div>
            )}

            <div className="pt-5 flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/10" loading={submitting}>Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Bed Modal */}
      <Modal isOpen={bedModalOpen} onClose={() => setBedModalOpen(false)} title="Provision New Hospital Bed" size="sm">
        <form onSubmit={handleAddBed} className="space-y-6">
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center mb-2">
            <BedDouble className="w-8 h-8 text-violet-500 mx-auto mb-2" />
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Facility Expansion</p>
          </div>
          
          <Input 
            label="Bed Designation / Number" 
            value={bedForm.bedNumber} 
            onChange={(e: any) => setBedForm({ ...bedForm, bedNumber: e.target.value })} 
            required 
            placeholder="e.g. ICU-105 or GEN-402"
          />
          
          <Select
            label="Clinical Ward Category"
            value={bedForm.wardType}
            onChange={(e: any) => setBedForm({ ...bedForm, wardType: e.target.value })}
            options={[
              { value: 'General', label: 'General Ward' },
              { value: 'ICU', label: 'Intensive Care Unit (ICU)' },
              { value: 'Private', label: 'Private Premium Suite' }
            ]}
            required
          />

          <div className="pt-2 flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setBedModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/10" loading={submitting}>Deploy Bed</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const StaffCard = ({ user, onEdit, onDelete, onRestore }: { user: any, onEdit?: () => void, onDelete?: () => void, onRestore?: () => void }) => {
  const role = user.role || user.Role || 'Staff';
  const email = user.email || user.Email || '';
  let name = user.fullName || user.FullName || 'User';
  
  if (role === 'Doctor' && name !== 'User' && !name.toLowerCase().startsWith('dr.')) {
    name = `Dr. ${name}`;
  }
  
  const profileImg = user.profileImageUrl || (user.docProfile && user.docProfile.profileImageUrl);

  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border ${user.isGhost ? 'border-orange-200 bg-orange-50/30' : 'border-zinc-200 bg-white'} hover:border-emerald-500/20 transition-all group hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]`}>
      <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-[15px] overflow-hidden shrink-0 border border-zinc-200 group-hover:border-emerald-500/30">
        {profileImg && role !== 'Admin' ? (
          <img src={profileImg} alt={name} className="w-full h-full object-cover" />
        ) : (
          name.charAt(0)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-zinc-900 truncate tracking-tight flex items-center gap-2">
            {name}
            {user.isGhost && <AlertTriangle className="w-3 h-3 text-orange-500" title="Account not linked" />}
        </p>
        <p className="text-[12px] text-zinc-500 truncate font-medium">{email}</p>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <Badge variant={role === 'Admin' ? 'danger' : (user.isGhost ? 'warning' : (user.isActive === false ? 'danger' : 'info'))}>{user.isGhost ? 'Incomplete' : (user.isActive === false ? 'Deactivated' : role)}</Badge>
        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRestore ? (
              <button onClick={onRestore} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Restore Account">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
          ) : (
            <>
                {onEdit && (
                <button onClick={onEdit} className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit Profile">
                    <Edit className="w-3.5 h-3.5" />
                </button>
                )}
                {onDelete && (
                <button onClick={onDelete} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate Account">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
