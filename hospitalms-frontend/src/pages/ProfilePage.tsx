import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Save,
  ShieldCheck,
  Mail,
  Phone,
  IdCard,
  Settings,
  ShieldAlert,
  ArrowRight,
  Activity,
  Clock,
  Camera
} from 'lucide-react';
import { Card, PageHeader, Input, Button, Badge, LoadingSpinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { authApi, doctorApi } from '../api/axiosInstance';
import { useNotifications } from '../context/NotificationContext';
import { gsap } from 'gsap';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileForm, setProfileForm] = useState({ 
    fullName: user?.fullName || '', 
    phone: user?.phone || '', 
    dateOfBirth: user?.dateOfBirth || '' 
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
        setProfileForm({
            fullName: user.fullName,
            phone: user.phone || '',
            dateOfBirth: user.dateOfBirth || ''
        });
    }
  }, [user]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.profile-animate', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power4.out'
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
        await authApi.updateProfile(profileForm);
        
        if (user) {
            const updatedUser = { 
                ...user, 
                fullName: profileForm.fullName, 
                phone: profileForm.phone, 
                dateOfBirth: profileForm.dateOfBirth 
            };
            localStorage.setItem('hms_user', JSON.stringify(updatedUser));
            addToast({ type: 'success', title: 'Profile Updated', message: 'Your details have been synchronized.' });
            setTimeout(() => window.location.reload(), 800);
        }
    } catch (err: any) {
        addToast({ type: 'error', title: 'Update Failed', message: err.response?.data?.message || 'Error' });
    } finally {
        setUpdating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
        const res = await authApi.uploadPicture(file, true);
        const newUrl = res.data.imageUrl;
        
        if (user && newUrl) {
            // Sync with PatientService only if user is a Doctor
            if (user.role === 'Doctor') {
                try {
                    await doctorApi.updateProfilePicture(newUrl);
                } catch (syncErr) {
                    console.warn("PatientService sync skipped or failed", syncErr);
                }
            }

            const updatedUser = { ...user, profileImageUrl: newUrl };
            localStorage.setItem('hms_user', JSON.stringify(updatedUser));
            addToast({ type: 'success', title: 'Updated', message: 'Profile picture updated successfully' });
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (err: any) {
        const msg = err.response?.data?.message || 'Failed to upload profile picture';
        addToast({ type: 'error', title: 'Error', message: msg });
    } finally {
        setUploading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passForm.newPassword.length < 6) {
      return addToast({
        type: 'error',
        title: 'Weak Password',
        message: 'New password must be at least 6 characters long.'
      });
    }

    if (passForm.newPassword !== passForm.confirmPassword) {
      return addToast({
        type: 'error',
        title: 'Mismatch',
        message: 'New passwords do not match.'
      });
    }

    setLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      });

      addToast({
        type: 'success',
        title: 'Success',
        message: 'Your security credentials have been updated!'
      });
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Current password incorrect or session expired.';
      addToast({ type: 'error', title: 'Update Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20" ref={containerRef}>
      <PageHeader
        title="Personal Profile"
        subtitle="Manage professional credentials and platform security."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Visual Profile */}
        <div className="lg:col-span-4 space-y-6 profile-animate">
          <Card className="border-t-[6px] border-t-zinc-900">
            <div className="text-center py-6">
              <div 
                className={`relative inline-block group ${user?.role === 'Admin' ? 'cursor-default' : 'cursor-pointer'}`} 
                onClick={() => user?.role !== 'Admin' && fileInputRef.current?.click()}
              >
                <div className="w-36 h-36 rounded-[30px] bg-[#FDFDFD] border border-zinc-200 flex items-center justify-center text-zinc-900 text-[64px] font-black shadow-sm mb-6 group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden">
                  {user?.profileImageUrl && user.role !== 'Admin' ? (
                    <img src={user.profileImageUrl} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    user?.fullName.charAt(0)
                  )}
                  {user?.role !== 'Admin' && (
                    <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 flex items-center justify-center backdrop-blur-sm transition-opacity duration-300">
                      <Camera strokeWidth={1.5} className="w-10 h-10 text-zinc-900" />
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <LoadingSpinner size="sm" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-zinc-900 border-[6px] border-white w-8 h-8 rounded-full shadow-sm" title="Session Active" />
                {user?.role !== 'Admin' && <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />}
              </div>

              <h3 className="text-[22px] font-bold text-zinc-900 tracking-tight">{user?.fullName}</h3>
              <p className="text-zinc-500 font-medium text-[13px] mb-5">{user?.email}</p>

              <div className="flex justify-center gap-2">
                <Badge variant="neutral">{user?.role}</Badge>
                <Badge variant="info">ID: #{user?.id}</Badge>
              </div>
            </div>

            <div className="mt-6 space-y-1 pt-6 border-t border-zinc-100">
              <div className="flex items-center gap-4 p-3 rounded-[12px] hover:bg-zinc-50 transition-colors group cursor-default">
                <div className="p-2.5 bg-zinc-100 text-zinc-600 rounded-[10px] group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <Mail strokeWidth={2} className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-semibold text-zinc-700">{user?.email}</span>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-[12px] hover:bg-zinc-50 transition-colors group cursor-default">
                <div className="p-2.5 bg-zinc-100 text-zinc-600 rounded-[10px] group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <Phone strokeWidth={2} className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-semibold text-zinc-700">Protected Details</span>
              </div>

              <div className="flex items-center gap-4 p-3 rounded-[12px] hover:bg-zinc-50 transition-colors group cursor-default">
                <div className="p-2.5 bg-zinc-100 text-zinc-600 rounded-[10px] group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <ShieldCheck strokeWidth={2} className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-semibold text-zinc-700">AES-256 Enabled</span>
              </div>
            </div>
          </Card>

          <div className="p-6 bg-zinc-900 rounded-[20px] text-white shadow-xl relative overflow-hidden group">
            <div className="relative z-10">
              <h4 className="font-bold text-[18px] mb-2 tracking-tight">Technical Assistance</h4>
              <p className="text-zinc-400 text-[12px] font-medium mb-5 leading-relaxed">Require systemic configuration changes or authorization upgrades? Contact our infrastructure team.</p>
              <button className="flex items-center gap-2 text-[11px] font-bold text-white uppercase tracking-widest hover:text-zinc-300 transition-colors border-b border-zinc-700 pb-1 w-max">
                Support Protocol <ArrowRight strokeWidth={2} className="w-3.5 h-3.5" />
              </button>
            </div>
            <Activity strokeWidth={1} className="absolute -right-6 -bottom-6 w-32 h-32 text-zinc-800 group-hover:scale-110 transition-transform duration-700" />
          </div>
        </div>

        {/* Right Column: Security Forms */}
        <div className="lg:col-span-8 space-y-8 profile-animate">
          {/* PROFILE UPDATE CARD */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <Settings strokeWidth={2} className="w-4 h-4 text-zinc-500" />
                <span>Profile Synchronization</span>
              </div>
            }
          >
            <form onSubmit={handleUpdateProfile} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input 
                    label="Official Full Name"
                    value={profileForm.fullName}
                    onChange={(e: any) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    required
                  />
                  <Input 
                    label="Verified Phone Vector"
                    value={profileForm.phone}
                    onChange={(e: any) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    required
                  />
                  <Input 
                    label="Date of Birth"
                    type="date"
                    value={profileForm.dateOfBirth}
                    onChange={(e: any) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                    required
                  />
               </div>
               <div className="pt-2">
                  <Button type="submit" loading={updating} className="w-full md:w-auto h-11 px-8 bg-zinc-900 text-white hover:bg-zinc-800">
                    Sync Personal Details
                  </Button>
               </div>
            </form>
          </Card>

          <Card
            title={
              <div className="flex items-center gap-2">
                <Lock strokeWidth={2} className="w-4 h-4 text-zinc-500" />
                <span>Cryptographic Security</span>
              </div>
            }
          >
            <form onSubmit={handleChangePassword} className="space-y-8">
              <div className="p-4 bg-zinc-50 rounded-[16px] border border-zinc-200 flex gap-4 items-start">
                <ShieldAlert strokeWidth={2} className="w-5 h-5 text-zinc-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-zinc-900 text-[13px] mb-1">Standard Encryption Requirements</h5>
                  <p className="text-[12px] text-zinc-500 leading-relaxed font-medium">
                    Please ensure authentication vectors meet complexity prerequisites. Credentials are mathematically hashed prior to database ingestion.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <Input
                    label="Old Password"
                    type="password"
                    placeholder="Enter current password"
                    value={passForm.currentPassword}
                    onChange={(e: any) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <div className="h-px bg-zinc-100" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="New Password"
                    type="password"
                    placeholder="Enter new password"
                    value={passForm.newPassword}
                    onChange={(e: any) => setPassForm({ ...passForm, newPassword: e.target.value })}
                    required
                    autoComplete="new-password"
                  />
                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Confirm new password"
                    value={passForm.confirmPassword}
                    onChange={(e: any) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  loading={loading}
                  className="w-full md:w-auto h-11 px-8"
                >
                  Update Password
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Session Diagnostic Data" className="bg-[#FDFDFD]/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-50 rounded-[14px] flex items-center justify-center border border-zinc-100">
                  <IdCard strokeWidth={1.5} className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">Platform Node ID</p>
                  <p className="text-[14px] font-bold tracking-tight text-zinc-900">NODE-{user?.id}-00X</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-50 rounded-[14px] flex items-center justify-center border border-zinc-100">
                  <Clock strokeWidth={1.5} className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">Runtime Status</p>
                  <p className="text-[14px] font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-900 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-900"></span>
                    </span>
                    Synchronized
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
