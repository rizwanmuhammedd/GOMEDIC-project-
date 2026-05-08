using System;
using System.Collections.Generic;

namespace HospitalMS.PatientService.Domain.Entities;

public partial class Admission
{
    public int Id { get; set; }

    public int PatientId { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string PatientName { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string? PatientPhone { get; set; }

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public int PatientAge { get; set; }

    public int DoctorId { get; set; }

    public int? BedId { get; set; }

    public DateTime AdmissionDate { get; set; }

    public DateTime? DischargeDate { get; set; }

    public string Status { get; set; } = null!;

    public string? AdmissionReason { get; set; }

    public string? DischargeSummary { get; set; }

    public string? DischargeCondition { get; set; }

    public DateTime CreatedAt { get; set; }

    public int TenantId { get; set; }

    public virtual Bed? Bed { get; set; }

    public virtual Doctor Doctor { get; set; } = null!;
}
