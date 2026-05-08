import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { PageHeader, Card, EmptyState, Badge, LoadingSpinner, Button, Modal, Input, Select } from '../ui';
import {
    Pill, Receipt, Plus, Package, AlertCircle, ShoppingCart, TrendingUp, Search, Filter, ArrowRight, CheckCircle2
} from 'lucide-react';
import { prescriptionApi, medicineApi } from '../../api/axiosInstance';
import { useNotifications } from '../../context/NotificationContext';

export const PharmacistDashboard = () => {
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [medicines, setMedicines] = useState<any[]>([]);
    const [lowStock, setLowStock] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useNotifications();

    const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
    const prescIdParam = searchParams.get('prescriptionId');

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [selectedMed, setSelectedMed] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [newQty, setNewQty] = useState('');
    const [medForm, setMedForm] = useState({
        name: '', genericName: '', category: 'Analgesic', manufacturer: '',
        stockQuantity: '', minimumStockLevel: '50', unitPrice: '', unit: 'Tablet'
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [prescriptionSearchTerm, setPrescriptionSearchTerm] = useState('');

    const loadData = async () => {
        try {
            const [prescRes, medRes, lowRes] = await Promise.all([
                prescriptionApi.getPending(),
                medicineApi.getAll(),
                medicineApi.getLowStock()
            ]);
            setPrescriptions(prescRes.data);
            setMedicines(medRes.data);
            setLowStock(lowRes.data);
            
            if (prescIdParam) {
                const p = prescRes.data.find((x: any) => x.id === parseInt(prescIdParam));
                if (p) setSelectedPrescription(p);
            }
        } catch (err: any) {
            addToast({
                type: 'error',
                title: 'Fetch Failed',
                message: err.response?.data?.message || 'Unauthorized or Connection Error'
            });
        } finally { setLoading(false); }
    };

    useEffect(() => { loadData(); }, []);

    const handleDispense = async (id: number) => {
        const p = prescriptions.find(x => x.id === id);
        const hasStockOut = p?.items?.some((it: any) => it.isOutOfStock);

        addToast({
            type: 'warning',
            title: hasStockOut ? 'Partial Dispense?' : 'Dispense Medication?',
            message: hasStockOut 
                ? `This prescription has out-of-stock items. We will only dispense available stock and finalize the order. Continue?`
                : 'Are you sure you want to dispense this prescription? This will deduct from current stock.',
            onConfirm: async () => {
                try {
                    await prescriptionApi.dispense(id);
                    addToast({ type: 'success', title: 'Dispensed', message: hasStockOut ? 'Available items dispensed. Prescription finalized.' : 'Medicine stock updated' });
                    loadData();
                } catch (err: any) {
                    addToast({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Error dispensing' });
                }
            }
        });
    };

    const handleAddMedicine = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await medicineApi.add({
                ...medForm,
                stockQuantity: parseInt(medForm.stockQuantity),
                minimumStockLevel: parseInt(medForm.minimumStockLevel),
                unitPrice: parseFloat(medForm.unitPrice)
            });
            addToast({ type: 'success', title: 'Added', message: `${medForm.name} added to inventory` });
            setAddModalOpen(false);
            setMedForm({ name: '', genericName: '', category: 'Analgesic', manufacturer: '', stockQuantity: '', minimumStockLevel: '50', unitPrice: '', unit: 'Tablet' });
            loadData();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Error adding medicine' });
        } finally { setSubmitting(false); }
    };

    const handleUpdateStock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMed) return;
        setSubmitting(true);
        try {
            await medicineApi.updateStock(selectedMed.id, parseInt(newQty));
            addToast({ type: 'success', title: 'Updated', message: `Stock for ${selectedMed.name} updated` });
            setUpdateModalOpen(false);
            setSelectedMed(null);
            setNewQty('');
            loadData();
        } catch (err: any) {
            addToast({ type: 'error', title: 'Failed', message: err.response?.data?.message || 'Error updating stock' });
        } finally { setSubmitting(false); }
    };

    if (loading) return <LoadingSpinner />;

    const renderDashboard = () => (
        <div className="space-y-8">
            <PageHeader title="Pharmacy Dashboard" subtitle="Overview of inventory and pending prescriptions" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Package className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Total Inventory</p>
                            <h3 className="text-2xl font-bold text-zinc-900">{medicines.length}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Low Stock</p>
                            <h3 className="text-2xl font-bold text-orange-600">{lowStock.length}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                            <Receipt className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Pending Orders</p>
                            <h3 className="text-2xl font-bold text-zinc-900">{prescriptions.length}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Dispensed Today</p>
                            <h3 className="text-2xl font-bold text-zinc-900">12</h3>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-0 border-none shadow-sm bg-white overflow-hidden">
                    <div className="p-5 border-b border-zinc-50 flex justify-between items-center">
                        <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-orange-500" /> Critical Low Stock
                        </h3>
                        <Button variant="secondary" size="sm" onClick={() => window.location.pathname = '/medicines'}>View All</Button>
                    </div>
                    <div className="p-2">
                        {lowStock.length === 0 ? (
                            <div className="py-10 text-center text-zinc-400 text-sm">No critical stock levels</div>
                        ) : (
                            <table className="w-full">
                                <tbody className="divide-y divide-zinc-50">
                                    {lowStock.slice(0, 5).map(m => (
                                        <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                                            <td className="p-4">
                                                <p className="text-[13px] font-bold text-zinc-900">{m.name}</p>
                                                <p className="text-[11px] text-zinc-500">{m.manufacturer}</p>
                                            </td>
                                            <td className="p-4 text-right">
                                                <Badge variant="error" className="text-[10px]">{m.stockQuantity} Left</Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Card>

                <Card className="p-0 border-none shadow-sm bg-white overflow-hidden">
                    <div className="p-5 border-b border-zinc-50 flex justify-between items-center">
                        <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-purple-500" /> Recent Prescriptions
                        </h3>
                        <Button variant="secondary" size="sm" onClick={() => window.location.pathname = '/prescriptions'}>View All</Button>
                    </div>
                    <div className="p-2">
                        {prescriptions.length === 0 ? (
                            <div className="py-10 text-center text-zinc-400 text-sm">No pending prescriptions</div>
                        ) : (
                            <div className="space-y-1">
                                {prescriptions.slice(0, 5).map(p => (
                                    <div key={p.id} className="p-4 hover:bg-zinc-50 transition-colors rounded-lg flex justify-between items-center">
                                        <div>
                                            <p className="text-[14px] font-bold text-zinc-900">{p.patientName || 'Unknown Patient'}</p>
                                            <p className="text-[11px] text-zinc-500">ID #{p.patientId} &bull; {p.patientPhone || 'No Phone'}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[12px] text-zinc-400 font-medium">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <ArrowRight className="w-4 h-4 text-zinc-300" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );

    const renderMedicines = () => {
        const filteredMedicines = medicines.filter(m => 
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            m.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.category.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <PageHeader title="Medicine Inventory" subtitle="Manage hospital pharmacy stock levels and pricing" />
                    <Button onClick={() => setAddModalOpen(true)}>
                        <Plus className="w-4 h-4" /> Add New Medicine
                    </Button>
                </div>

                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                            type="text" 
                            placeholder="Search by name, category, or generic name..." 
                            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="secondary" className="gap-2">
                        <Filter className="w-4 h-4" /> Filter
                    </Button>
                </div>

                <Card className="p-0 border-none shadow-sm bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-zinc-50/50">
                                <tr>
                                    <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Medicine Information</th>
                                    <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-center">Current Stock</th>
                                    <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Manufacturer</th>
                                    <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Unit Price</th>
                                    <th className="p-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50">
                                {filteredMedicines.map(m => (
                                    <tr key={m.id} className="hover:bg-zinc-50/80 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.stockQuantity <= m.minimumStockLevel ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                                    <Pill className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[14px] font-bold text-zinc-900 leading-tight">{m.name}</p>
                                                    <p className="text-[11px] text-zinc-500 font-medium mt-0.5">{m.category} &bull; {m.unit}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-[15px] font-bold ${m.stockQuantity <= m.minimumStockLevel ? 'text-red-600' : 'text-zinc-900'}`}>
                                                    {m.stockQuantity}
                                                </span>
                                                {m.stockQuantity <= m.minimumStockLevel && (
                                                    <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest mt-1">Reorder Required</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-[13px] text-zinc-600 font-medium">{m.manufacturer}</td>
                                        <td className="p-4 text-[14px] font-bold text-zinc-900">₹{m.unitPrice.toFixed(2)}</td>
                                        <td className="p-4 text-right">
                                            <Button 
                                                size="sm" 
                                                variant="secondary" 
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => { setSelectedMed(m); setNewQty(m.stockQuantity.toString()); setUpdateModalOpen(true); }}
                                            >
                                                Restock
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredMedicines.length === 0 && (
                            <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
                                <Search className="w-12 h-12 mb-3 opacity-20" />
                                <p>No medicines found matching your search</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        );
    };

    const renderPrescriptions = () => {
        const filtered = prescriptions.filter(p => 
            (p.patientName || '').toLowerCase().includes(prescriptionSearchTerm.toLowerCase()) ||
            (p.patientPhone || '').includes(prescriptionSearchTerm) ||
            p.patientId.toString().includes(prescriptionSearchTerm) ||
            p.id.toString().includes(prescriptionSearchTerm)
        );

        const unpaid = filtered.filter(p => !p.isPaid);
        const consultationPaid = filtered.filter(p => p.isPaid && !p.isMedicinePaid);
        const fullyPaid = filtered.filter(p => p.isPaid && p.isMedicinePaid);

        const renderPrescriptionCard = (p: any, allowDispense: boolean) => (
            <Card key={p.id} className="p-0 border-none shadow-sm bg-white overflow-hidden flex flex-col">
                <div className="p-4 border-b border-zinc-50 flex justify-between items-center bg-zinc-50/30">
                    <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Prescription</p>
                        <h3 className="text-[14px] font-bold text-zinc-900">#PRES-{p.id}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Badge variant={p.isPaid ? 'success' : 'danger'}>{p.isPaid ? 'Consultation Paid' : 'Fee Pending'}</Badge>
                        {p.isMedicinePaid && <Badge variant="info">Medicines Paid</Badge>}
                    </div>
                </div>
                <div className="p-4 flex-1 space-y-3">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-600">P</div>
                            <div>
                                <p className="text-[13px] font-bold text-zinc-900 leading-tight">{p.patientName}</p>
                                <p className="text-[10px] text-zinc-500 font-medium">ID #{p.patientId} &bull; {p.patientPhone || 'No Phone'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1 pt-2 border-t border-zinc-50">
                        {p.items?.slice(0, 2).map((it: any, i: number) => (
                            <div key={i} className="flex justify-between items-center text-[12px]">
                                <span className="text-zinc-600 truncate max-w-[120px]">{it.medicineName}</span>
                                <span className="font-bold text-zinc-900">x{it.quantityToDispense}</span>
                            </div>
                        ))}
                        {p.items?.length > 2 && <p className="text-[10px] text-zinc-400 text-center">+{p.items.length - 2} more medicines</p>}
                    </div>
                    <div className="pt-2 flex justify-between items-center border-t border-zinc-50">
                        <span className="text-[11px] font-bold text-zinc-400">Medicine Cost</span>
                        <span className="text-[13px] font-black text-zinc-900">₹{p.totalCost}</span>
                    </div>
                </div>
                <div className="p-4 pt-0 mt-auto">
                    <Button 
                        className={`w-full ${allowDispense ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`} 
                        disabled={!allowDispense}
                        onClick={() => handleDispense(p.id)}
                    >
                        {p.isMedicinePaid ? 'Dispense Paid Order' : allowDispense ? 'Dispense (Cash Payment)' : 'Awaiting Consultation'}
                    </Button>
                </div>
            </Card>
        );

        return (
            <div className="space-y-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <PageHeader title="Pharmacy Dispensing Hub" subtitle="Reconcile payments and dispense medications securely" />
                    <div className="w-full md:w-80 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                            type="text" 
                            placeholder="Search patient or ID..." 
                            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={prescriptionSearchTerm}
                            onChange={(e) => setPrescriptionSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Section 1: Unpaid / Consultation Pending */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-red-100 pb-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">1. Fee Not Completed (Awaiting Consultation)</h2>
                        <Badge variant="danger">{unpaid.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {unpaid.map(p => renderPrescriptionCard(p, false))}
                        {unpaid.length === 0 && <p className="col-span-full text-[12px] text-zinc-400 italic py-4">No prescriptions in this category</p>}
                    </div>
                </section>

                {/* Section 2: Consultation Paid but Medicine Pending */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-blue-100 pb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">2. Consultation Paid (Medicine Fee Pending)</h2>
                        <Badge variant="info">{consultationPaid.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {consultationPaid.map(p => renderPrescriptionCard(p, true))}
                        {consultationPaid.length === 0 && <p className="col-span-full text-[12px] text-zinc-400 italic py-4">No prescriptions in this category</p>}
                    </div>
                </section>

                {/* Section 3: Fully Paid */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-emerald-100 pb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">3. Consultation & Medicine Fee Completed</h2>
                        <Badge variant="success">{fullyPaid.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {fullyPaid.map(p => renderPrescriptionCard(p, true))}
                        {fullyPaid.length === 0 && <p className="col-span-full text-[12px] text-zinc-400 italic py-4">No fully paid orders pending</p>}
                    </div>
                </section>
            </div>
        );
    };

    const getContent = () => {
        if (location.pathname === '/medicines') return renderMedicines();
        if (location.pathname === '/prescriptions') return renderPrescriptions();
        return renderDashboard();
    };

    return (
        <div className="pb-20 max-w-7xl mx-auto">
            {getContent()}

            {/* Add Medicine Modal */}
            <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Register Clinical Inventory" size="lg">
                <form onSubmit={handleAddMedicine} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Input label="Medicine Name" required value={medForm.name} onChange={(e: any) => setMedForm({ ...medForm, name: e.target.value })} placeholder="e.g. Paracetamol 500mg" />
                            <Input label="Generic Alias" required value={medForm.genericName} onChange={(e: any) => setMedForm({ ...medForm, genericName: e.target.value })} placeholder="e.g. Acetaminophen" />
                            <Select
                                label="Therapeutic Category"
                                value={medForm.category}
                                onChange={(e: any) => setMedForm({ ...medForm, category: e.target.value })}
                                options={[
                                    { value: 'Analgesic', label: 'Analgesic' },
                                    { value: 'Antibiotic', label: 'Antibiotic' },
                                    { value: 'Antidiabetic', label: 'Antidiabetic' },
                                    { value: 'Antihistamine', label: 'Antihistamine' },
                                    { value: 'Antacid', label: 'Antacid' },
                                    { value: 'NSAID', label: 'NSAID' }
                                ]}
                            />
                        </div>
                        <div className="space-y-4">
                            <Input label="Manufacturer Log" required value={medForm.manufacturer} onChange={(e: any) => setMedForm({ ...medForm, manufacturer: e.target.value })} placeholder="e.g. GlaxoSmithKline" />
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Initial Inventory" type="number" required value={medForm.stockQuantity} onChange={(e: any) => setMedForm({ ...medForm, stockQuantity: e.target.value })} />
                                <Input label="Low Threshold" type="number" required value={medForm.minimumStockLevel} onChange={(e: any) => setMedForm({ ...medForm, minimumStockLevel: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Unit MSRP (₹)" type="number" step="0.01" required value={medForm.unitPrice} onChange={(e: any) => setMedForm({ ...medForm, unitPrice: e.target.value })} />
                                <Select
                                    label="Physical Unit"
                                    value={medForm.unit}
                                    onChange={(e: any) => setMedForm({ ...medForm, unit: e.target.value })}
                                    options={[{ value: 'Tablet', label: 'Tablet' }, { value: 'Capsule', label: 'Capsule' }, { value: 'Syrup', label: 'Syrup' }, { value: 'Injection', label: 'Injection' }]}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-zinc-100 flex gap-3">
                        <Button type="button" variant="secondary" className="flex-1" onClick={() => setAddModalOpen(false)}>Cancel</Button>
                        <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" loading={submitting}>Commit Registration</Button>
                    </div>
                </form>
            </Modal>

            {/* Restock Modal */}
            <Modal isOpen={updateModalOpen} onClose={() => setUpdateModalOpen(false)} title="Modify Inventory Count" size="sm">
                <form onSubmit={handleUpdateStock} className="space-y-5">
                    <div className="p-4 bg-zinc-50 rounded-[12px] border border-zinc-100 text-center mb-2">
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">{selectedMed?.category}</p>
                        <h3 className="text-[16px] font-bold tracking-tight text-zinc-900">{selectedMed?.name}</h3>
                    </div>
                    <Input label="Target Stock Value" type="number" required value={newQty} onChange={(e: any) => setNewQty(e.target.value)} />
                    <div className="pt-2 flex gap-3">
                        <Button type="button" variant="secondary" className="flex-1" onClick={() => setUpdateModalOpen(false)}>Cancel</Button>
                        <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" loading={submitting}>Save</Button>
                    </div>
                </form>
            </Modal>
            
            {/* Prescription Detail Modal */}
            <Modal
                isOpen={!!selectedPrescription}
                onClose={() => setSelectedPrescription(null)}
                title="Valid Prescription Details"
                size="md"
            >
                {selectedPrescription && (
                    <div className="space-y-6">
                        <div className="p-4 bg-zinc-50 rounded-[16px] border border-zinc-200 flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-0.5">Physician</p>
                                <p className="text-[13px] font-bold tracking-tight text-zinc-900">{(selectedPrescription.doctorName || '').toLowerCase().startsWith('dr.') ? selectedPrescription.doctorName : `Dr. ${selectedPrescription.doctorName || 'Assigned'}`}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-0.5">Patient Info</p>
                                <p className="text-[13px] font-bold tracking-tight text-zinc-900">#{selectedPrescription.patientId} &bull; {selectedPrescription.patientPhone || 'No Phone'}</p>
                            </div>
                            <Badge variant="warning">{selectedPrescription.status}</Badge>
                        </div>

                        <div className="space-y-3">
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Required Dispensation Items</p>
                            <div className="space-y-2">
                                {selectedPrescription.items?.map((it: any, i: number) => (
                                    <div key={i} className={`flex items-center justify-between p-3 rounded-[12px] border ${it.isOutOfStock ? 'bg-red-50/50 border-red-100 opacity-80' : 'bg-[#FDFDFD] border-zinc-100'}`}>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[13px] font-semibold text-zinc-900">{it.medicineName}</p>
                                                {it.isOutOfStock && <Badge variant="error" className="text-[8px] px-1 py-0">STOCK OUT</Badge>}
                                            </div>
                                            <p className="text-[11px] text-zinc-500 font-medium">{it.dosage} &bull; {it.frequency}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[14px] font-bold text-zinc-900">x{it.quantityToDispense}</p>
                                            <p className="text-[11px] text-zinc-500">{it.durationDays} Days Track</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedPrescription.status === 'Pending' && (
                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => { handleDispense(selectedPrescription.id); setSelectedPrescription(null); }}>
                                Mark Dispensed
                            </Button>
                        )}
                        <Button className="w-full" variant="secondary" onClick={() => setSelectedPrescription(null)}>Dismiss</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};
