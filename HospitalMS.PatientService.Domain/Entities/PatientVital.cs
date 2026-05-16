using System;
using System.Collections.Generic;

namespace HospitalMS.PatientService.Domain.Entities;

public partial class PatientVital
{
    public int Id { get; set; }

    public int PatientId { get; set; }

    public int? AdmissionId { get; set; }

    public int? AppointmentId { get; set; }

    public decimal? Temperature { get; set; }

    public string? BloodPressure { get; set; }

    public int? HeartRate { get; set; }

    public int? RespiratoryRate { get; set; }

    public int? OxygenSaturation { get; set; }

    public decimal? Weight { get; set; }

    public decimal? Height { get; set; }

    public string? RecordedBy { get; set; }

    public DateTime RecordedAt { get; set; }

    public int TenantId { get; set; }

    public virtual Admission? Admission { get; set; }

    public virtual Appointment? Appointment { get; set; }
}
