// HospitalMS.HospitalOpsService.Application/DTOs/BillDtos.cs
namespace HospitalMS.HospitalOpsService.Application.DTOs;

public class GenerateBillDto
{
    public int PatientId { get; set; }
    public int? AdmissionId { get; set; }
    public int? PrescriptionId { get; set; }
    public decimal ConsultationCharge { get; set; }
    public decimal MedicineCharge { get; set; }
    public decimal LabCharge { get; set; }
    public decimal BedCharge { get; set; }
    public decimal OtherCharges { get; set; }
    public decimal Discount { get; set; }
    public int GeneratedByUserId { get; set; }
}

public class RecordPaymentDto
{
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    // Cash | Card | UPI | Insurance | Cheque
    public string? InsuranceProvider { get; set; }
    public string? InsuranceClaimNumber { get; set; }
}

public class BillDto
{
    public int Id { get; set; }
    public string BillNumber { get; set; } = string.Empty;
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string? PatientPhone { get; set; }
    public int PatientAge { get; set; }
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
    public string PaymentStatus { get; set; } = string.Empty;
    // Pending | PartiallyPaid | Paid | Waived
    public string? PaymentMethod { get; set; }
    public string? InsuranceProvider { get; set; }
    public DateTime GeneratedAt { get; set; }
    public DateTime? PaidAt { get; set; }
}
