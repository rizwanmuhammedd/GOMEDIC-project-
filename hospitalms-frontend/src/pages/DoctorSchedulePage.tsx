import React, { useState, useEffect } from 'react';
import { doctorApi } from '../api/axiosInstance';
import { useNotifications } from '../context/NotificationContext';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  CalendarDays
} from 'lucide-react';
import { PageHeader, Card, Button, Input, Select, EmptyState, Badge, Modal } from '../components/ui';

interface Schedule {
  id: number;
  doctorId: number;
  scheduleDate: string;
  shiftType: string;
  shiftStart: string;
  shiftEnd: string;
  isLeave: boolean;
  leaveReason?: string;
}

const DoctorSchedulePage: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingDuration, setUpdatingDuration] = useState(false);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [appointmentDuration, setAppointmentDuration] = useState(15);
  const { addToast } = useNotifications();

  // New Schedule State
  const [newDate, setNewDate] = useState('');
  const [shiftType, setShiftType] = useState('Morning');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [isLeave, setIsLeave] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');

  // Edit State
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [editForm, setEditForm] = useState({
    scheduleDate: '',
    shiftType: 'Morning',
    shiftStart: '09:00',
    shiftEnd: '13:00',
    isLeave: false,
    leaveReason: ''
  });

  useEffect(() => {
    fetchMyProfileAndSchedules();
  }, []);

  const fetchMyProfileAndSchedules = async () => {
    try {
      const profileRes = await doctorApi.getMe();
      const doc = profileRes.data;
      setDoctorId(doc.id);
      setAppointmentDuration(doc.appointmentDuration || 15);
      const scheduleRes = await doctorApi.getSchedules(doc.id);
      setSchedules(scheduleRes.data);
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to load schedule data' });
    } finally {
      setLoading(false);
    }
  };

  const convertTo24h = (timeStr: string) => {
    if (!timeStr) return "09:00";
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = (parseInt(hours, 10) + 12).toString();
    return `${hours.padStart(2, '0')}:${minutes}`;
  };

  const handleUpdateDuration = async (val: number) => {
    setUpdatingDuration(true);
    try {
      await doctorApi.updateSlotDuration(val);
      setAppointmentDuration(val);
      addToast({ type: 'success', title: 'Configuration Updated', message: `Appointment duration set to ${val === 0 ? 'Random' : val + ' minutes'}` });
    } catch (err) {
      addToast({ type: 'error', title: 'Update Failed', message: 'Could not update slot configuration' });
    } finally {
      setUpdatingDuration(false);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) return;

    setSubmitting(true);
    try {
      await doctorApi.addSchedule(doctorId, {
        scheduleDate: newDate,
        shiftType,
        shiftStart: startTime,
        shiftEnd: endTime,
        isLeave,
        leaveReason
      });
      addToast({ type: 'success', title: 'Success', message: 'Schedule added successfully' });
      fetchMyProfileAndSchedules();
      // Reset form
      setNewDate('');
      setLeaveReason('');
      setIsLeave(false);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed to add schedule' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (s: Schedule) => {
    setEditingSchedule(s);
    setEditForm({
      scheduleDate: s.scheduleDate,
      shiftType: s.shiftType,
      shiftStart: convertTo24h(s.shiftStart),
      shiftEnd: convertTo24h(s.shiftEnd),
      isLeave: s.isLeave,
      leaveReason: s.leaveReason || ''
    });
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;

    setSubmitting(true);
    try {
      await doctorApi.updateSchedule(editingSchedule.id, editForm);
      addToast({ 
        type: 'success', 
        title: 'Schedule Updated', 
        message: 'Schedule changes saved. Affected patients will be notified.' 
      });
      setEditingSchedule(null);
      fetchMyProfileAndSchedules();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Update Failed', message: err.response?.data?.message || 'Could not update schedule' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this schedule slot?')) return;
    try {
      await doctorApi.deleteSchedule(id);
      addToast({ type: 'success', title: 'Deleted', message: 'Slot removed' });
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'Failed to delete slot' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <PageHeader
            title="Manage My Schedule"
            subtitle="Define your availability and clinical time slots."
          />
          
          <div className="bg-white p-2 rounded-2xl border border-zinc-100 shadow-sm flex items-center gap-1">
              <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-3">Slot Duration</span>
              {[15, 30, 0].map(val => (
                  <button
                    key={val}
                    disabled={updatingDuration}
                    onClick={() => handleUpdateDuration(val)}
                    className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all ${appointmentDuration === val ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-500 hover:bg-zinc-50'}`}
                  >
                      {val === 0 ? 'Random' : `${val} Min`}
                  </button>
              ))}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Schedule Form */}
        <div className="lg:col-span-1">
          <Card
            title={
              <div className="flex items-center gap-2">
                <Plus strokeWidth={2} className="w-4 h-4 text-zinc-500" />
                <span className="text-[16px]">Add New Slot</span>
              </div>
            }
          >
            <form onSubmit={handleAddSchedule} className="space-y-5">
              <Input
                label="Active Date"
                type="date"
                value={newDate}
                onChange={(e: any) => setNewDate(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
              />

              <Select
                label="Working Shift Type"
                value={shiftType}
                onChange={(e: any) => setShiftType(e.target.value)}
                options={[
                  { value: 'Morning', label: 'Morning' },
                  { value: 'Afternoon', label: 'Afternoon' },
                  { value: 'Evening', label: 'Evening' },
                  { value: 'Night', label: 'Night' }
                ]}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Time"
                  type="time"
                  value={startTime}
                  onChange={(e: any) => setStartTime(e.target.value)}
                  required
                />
                <Input
                  label="End Time"
                  type="time"
                  value={endTime}
                  onChange={(e: any) => setEndTime(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isLeave"
                  checked={isLeave}
                  onChange={e => setIsLeave(e.target.checked)}
                  className="w-4 h-4 text-zinc-900 rounded border-zinc-300 focus:ring-emerald-500"
                />
                <label htmlFor="isLeave" className="text-[13px] font-semibold text-zinc-700">Mark as Leave/Offline</label>
              </div>

              {isLeave && (
                <Input
                  label="Leave Reason"
                  type="text"
                  value={leaveReason}
                  onChange={(e: any) => setLeaveReason(e.target.value)}
                  placeholder="Vacation, Conference, etc."
                />
              )}

              <Button
                type="submit"
                loading={submitting}
                className="w-full h-11"
              >
                Assemble Schedule
              </Button>
            </form>
          </Card>
        </div>

        {/* Schedule List */}
        <div className="lg:col-span-2 space-y-5">
          <Card
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays strokeWidth={2} className="w-5 h-5 text-zinc-500" />
                  <span className="text-[16px]">Active Time Matrix</span>
                </div>
                <Badge variant="neutral">{schedules.length} Active Slots</Badge>
              </div>
            }
            className="p-1"
          >
            <div className="divide-y divide-zinc-100/50 p-2">
              {schedules.length === 0 ? (
                <EmptyState icon={<CalendarIcon strokeWidth={1.5} className="w-8 h-8" />} title="No established schedule" description="Configure time slots to enable bookings." />
              ) : (
                schedules.map((s) => (
                  <div key={s.id} className="p-4 rounded-[14px] hover:bg-zinc-50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-[12px] flex flex-col items-center justify-center border ${s.isLeave ? 'bg-red-50 text-red-600 border-red-100' : 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
                        <span className="text-[10px] font-bold tracking-widest">{s.shiftType.substring(0, 3)}</span>
                        <Clock strokeWidth={2} className="w-4 h-4 mt-0.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[15px] font-bold text-zinc-900 tracking-tight">{new Date(s.scheduleDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                          {s.isLeave && (
                            <Badge variant="danger">Leave</Badge>
                          )}
                        </div>
                        <p className="text-[12px] text-zinc-500 font-medium flex items-center gap-1.5">
                          <Clock strokeWidth={2} className="w-3 h-3 text-zinc-400" />
                          {s.shiftStart} to {s.shiftEnd}
                          {s.leaveReason && <span className="ml-1 italic text-zinc-400">({s.leaveReason})</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditClick(s)}
                        className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex items-center justify-center border border-transparent hover:border-emerald-200"
                      >
                        <Edit2 strokeWidth={2} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center justify-center border border-transparent hover:border-red-200"
                      >
                        <Trash2 strokeWidth={2} className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <div className="bg-zinc-50 border border-zinc-200 rounded-[16px] p-5 flex gap-3">
            <AlertCircle strokeWidth={1.5} className="w-5 h-5 text-zinc-500 flex-shrink-0" />
            <p className="text-[13px] text-zinc-600 leading-relaxed font-medium">
              <strong className="text-zinc-900">Logistical Note:</strong> Patients will automatically view 15-minute intervals constructed from these active slots.
              Marking an entire day as "Leave" completely disables booking capabilities for that date.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingSchedule}
        onClose={() => setEditingSchedule(null)}
        title="Edit Schedule Slot"
      >
        <form onSubmit={handleUpdateSchedule} className="space-y-5">
          <Input
            label="Active Date"
            type="date"
            value={editForm.scheduleDate}
            onChange={(e: any) => setEditForm({...editForm, scheduleDate: e.target.value})}
            required
          />

          <Select
            label="Working Shift Type"
            value={editForm.shiftType}
            onChange={(e: any) => setEditForm({...editForm, shiftType: e.target.value})}
            options={[
              { value: 'Morning', label: 'Morning' },
              { value: 'Afternoon', label: 'Afternoon' },
              { value: 'Evening', label: 'Evening' },
              { value: 'Night', label: 'Night' }
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time"
              type="time"
              value={editForm.shiftStart}
              onChange={(e: any) => setEditForm({...editForm, shiftStart: e.target.value})}
              required
            />
            <Input
              label="End Time"
              type="time"
              value={editForm.shiftEnd}
              onChange={(e: any) => setEditForm({...editForm, shiftEnd: e.target.value})}
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="edit_isLeave"
              checked={editForm.isLeave}
              onChange={e => setEditForm({...editForm, isLeave: e.target.checked})}
              className="w-4 h-4 text-zinc-900 rounded border-zinc-300 focus:ring-emerald-500"
            />
            <label htmlFor="edit_isLeave" className="text-[13px] font-semibold text-zinc-700">Mark as Leave/Offline</label>
          </div>

          {editForm.isLeave && (
            <Input
              label="Leave Reason"
              type="text"
              value={editForm.leaveReason}
              onChange={(e: any) => setEditForm({...editForm, leaveReason: e.target.value})}
              placeholder="Vacation, Conference, etc."
            />
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingSchedule(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
            >
              Update Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DoctorSchedulePage;

