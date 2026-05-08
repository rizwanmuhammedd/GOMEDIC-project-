// HospitalMS.HospitalOpsService.Application/DTOs/PrescriptionDtos.cs
namespace HospitalMS.HospitalOpsService.Application.DTOs;

public class PrescriptionItemDto
{
    public int MedicineId { get; set; }
    public string Dosage { get; set; } = string.Empty;
    // '500mg' | '10ml' | '1 tablet'
    public string Frequency { get; set; } = string.Empty;
    // 'Twice daily' | 'Once at night' | 'Every 8 hours'
    public int DurationDays { get; set; }
    public int QuantityToDispense { get; set; }
    public string? Instructions { get; set; }
    // 'Take after food' | 'Avoid dairy' | 'With warm water'
}

public class CreatePrescriptionDto
{
    public int PatientId { get; set; }
    public string? PatientName { get; set; }
    public string? PatientPhone { get; set; }
    public int? AppointmentId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public List<PrescriptionItemDto> Items { get; set; } = new();
}

public class PrescriptionResponseDto
{
    public int Id { get; set; }
    public int PatientId { get; set; }
    public string? PatientName { get; set; }
    public string? PatientPhone { get; set; }
    public int DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public decimal ConsultationFee { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime PrescribedAt { get; set; }
    public DateTime? DispensingAt { get; set; }
    public bool IsPaid { get; set; }
    public bool IsMedicinePaid { get; set; }
    public bool IsMedicinePaymentDismissed { get; set; }
    public string? Notes { get; set; }
    public List<PrescriptionItemResponseDto> Items { get; set; } = new();
    public decimal TotalCost { get; set; }
}

public class PrescriptionItemResponseDto
{
    public int MedicineId { get; set; }
    public string MedicineName { get; set; } = string.Empty;
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public int QuantityToDispense { get; set; }
    public string? Instructions { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public bool IsOutOfStock { get; set; }
}
