// HospitalMS.HospitalOpsService.Domain/Entities/Bill.cs
using System;
using System.Collections.Generic;

namespace HospitalMS.HospitalOpsService.Domain.Entities;

public partial class Bill
{
    public int Id { get; set; }

    public string BillNumber { get; set; } = null!;

    public int PatientId { get; set; }

    public string? PatientName { get; set; }

    public string? PatientPhone { get; set; }

    public int PatientAge { get; set; }

    public int? AdmissionId { get; set; }
    
    public int? PrescriptionId { get; set; }

    public decimal ConsultationCharge { get; set; }

    public decimal MedicineCharge { get; set; }

    public decimal LabCharge { get; set; }

    public decimal BedCharge { get; set; }

    public decimal OtherCharges { get; set; }

    public decimal Discount { get; set; }

    public decimal TotalAmount { get; set; }

    public decimal PaidAmount { get; set; }

    public decimal BalanceAmount { get; set; }

    public string PaymentStatus { get; set; } = null!;

    public string? PaymentMethod { get; set; }

    public string? InsuranceProvider { get; set; }

    public string? InsuranceClaimNumber { get; set; }

    public DateTime GeneratedAt { get; set; }

    public DateTime? PaidAt { get; set; }

    public int GeneratedByUserId { get; set; }
    public int TenantId { get; set; }
}
