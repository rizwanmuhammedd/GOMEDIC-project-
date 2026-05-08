import React from 'react';
import { X, Loader2 } from 'lucide-react';

export const StatCard: React.FC<any> = ({ title, value, icon, color = 'blue' }) => {
  // Using more muted colors that fit the SaaS aesthetic
  const colors = {
    blue: 'bg-zinc-100 text-zinc-700',
    violet: 'bg-zinc-100 text-zinc-700',
    emerald: 'bg-zinc-100 text-zinc-700',
    amber: 'bg-zinc-100 text-zinc-700',
    rose: 'bg-zinc-100 text-zinc-700'
  };
  return (
    <div className="rounded-[16px] p-5 bg-[#FDFDFD] border border-zinc-200 shadow-sm flex items-center justify-between hover:border-zinc-300 transition-colors">
      <div>
        <p className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-1">{title}</p>
        <p className="text-[28px] font-bold tracking-tight text-zinc-900">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${(colors as any)[color] || colors.blue}`}>{icon}</div>
    </div>
  );
};

export const Badge: React.FC<any> = ({ variant = 'neutral', children }) => {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    danger: 'bg-red-50 text-red-700 border border-red-100',
    info: 'bg-zinc-100 text-zinc-700 border border-zinc-200',
    neutral: 'bg-zinc-50 text-zinc-600 border border-zinc-200'
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${(styles as any)[variant]}`}>{children}</span>;
};

export const statusBadge = (s: string) => {
  const m: any = { Scheduled: 'info', Completed: 'success', Admitted: 'warning', Discharged: 'success', Pending: 'warning', Paid: 'success', Available: 'success', Occupied: 'danger' };
  return m[s] || 'neutral';
};

export const Modal: React.FC<any> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-[400px]', md: 'max-w-[500px]', lg: 'max-w-[640px]', xl: 'max-w-[800px]' };
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${(sizes as any)[size]} bg-[#FDFDFD] rounded-[32px] shadow-[0_32px_120px_rgba(0,0,0,0.15)] border border-zinc-200/50 animate-in zoom-in-95 duration-300 overflow-hidden`}>
        <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100/80">
          <h2 className="text-[19px] font-bold tracking-tight text-zinc-900">{title}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-zinc-50 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-all border border-zinc-100 flex items-center justify-center"><X strokeWidth={2.5} className="w-4 h-4" /></button>
        </div>
        <div className="px-8 py-8 max-h-[80vh] overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

export const Button: React.FC<any> = ({ variant = 'primary', size = 'md', loading, children, ...props }) => {
  const v = {
    primary: 'bg-emerald-500 text-white hover:bg-emerald-600 border border-emerald-500 shadow-sm',
    secondary: 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300',
    ghost: 'text-zinc-600 hover:bg-zinc-100'
  };
  const s = {
    sm: 'px-3 py-1.5 text-[12px] rounded-lg',
    md: 'px-4 py-2.5 text-[13px] rounded-xl',
    lg: 'px-6 py-3 text-[14px] rounded-xl'
  };
  return (
    <button {...props} disabled={props.disabled || loading} className={`inline-flex items-center justify-center gap-2 font-medium transition-all focus:outline-none focus:ring-4 focus:ring-zinc-100 disabled:opacity-50 ${(v as any)[variant]} ${(s as any)[size]} ${props.className || ''}`}>
      {loading && <Loader2 strokeWidth={2} className="w-3.5 h-3.5 animate-spin" />}{children}
    </button>
  );
};

export const Input: React.FC<any> = ({ label, error, ...props }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-[12px] font-medium text-zinc-700 ml-0.5">{label}</label>}
    <input {...props} className={`w-full px-3.5 py-2.5 rounded-lg border text-[13px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all ${error ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-zinc-400'}`} />
    {error && <p className="text-[11px] text-red-500 font-medium ml-0.5">{error}</p>}
  </div>
);

export const Select: React.FC<any> = ({ label, error, options, ...props }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-[12px] font-medium text-zinc-700 ml-0.5">{label}</label>}
    <select {...props} className={`w-full px-3.5 py-2.5 rounded-lg border text-[13px] text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-zinc-100 transition-all ${error ? 'border-red-400 focus:border-red-500' : 'border-zinc-200 focus:border-zinc-400'}`}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export const LoadingSpinner: React.FC<any> = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center h-48 gap-3">
    <Loader2 strokeWidth={1.5} className="w-6 h-6 text-zinc-400 animate-spin" />
    <p className="text-[13px] text-zinc-500 font-medium">{message}</p>
  </div>
);

export const EmptyState: React.FC<any> = ({ icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-10 px-4 gap-2 text-center border border-dashed border-zinc-200 rounded-[16px] bg-zinc-50/50">
    <div className="text-zinc-400 mb-1">{icon}</div>
    <p className="font-semibold text-zinc-900 text-[14px]">{title}</p>
    {description && <p className="text-[13px] text-zinc-500 max-w-[250px]">{description}</p>}
  </div>
);

export const PageHeader: React.FC<any> = ({ title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4 border-b border-zinc-200 pb-5">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
      {subtitle && <p className="text-zinc-500 text-[14px] mt-1.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Card: React.FC<any> = ({ children, title, action, className = '' }) => (
  <div className={`bg-[#FDFDFD] rounded-[20px] border border-zinc-200 shadow-sm overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        {title && <h3 className="font-semibold text-zinc-900 text-[14px] tracking-tight">{title}</h3>}
        {action}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

export const ProgressBar: React.FC<any> = ({ value, max, color = 'bg-emerald-500' }) => (
  <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }} /></div>
);

import { Camera, Image as ImageIcon } from 'lucide-react';

export const ImageUpload: React.FC<any> = ({ value, onChange, label, loading }) => {
  const [preview, setPreview] = React.useState(value);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      onChange(file);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="text-[12px] font-medium text-zinc-700 ml-0.5">{label}</label>}
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-xl bg-white border border-dashed border-zinc-300 overflow-hidden flex items-center justify-center group hover:border-zinc-500 hover:bg-zinc-50 transition-all">
          {preview ? (
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon strokeWidth={1.5} className="w-5 h-5 text-zinc-300 group-hover:text-zinc-400" />
          )}
          {loading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <Loader2 strokeWidth={2} className="w-4 h-4 text-zinc-900 animate-spin" />
            </div>
          )}
          <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-emerald-500/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera strokeWidth={2} className="w-4 h-4 text-white" />
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={loading} />
          </label>
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-zinc-500 font-medium leading-relaxed uppercase tracking-wider">Supports JPG, PNG<br />Max size 2MB</p>
        </div>
      </div>
    </div>
  );
};
