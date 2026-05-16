using System;
using System.Collections.Generic;

namespace HospitalMS.PatientService.Domain.Entities;

public partial class Appointment
{
    public int Id { get; set; }

    public int PatientId { get; set; }

    public string PatientName { get; set; } = string.Empty;

    public string? PatientPhone { get; set; }

    public int PatientAge { get; set; }

    public int DoctorId { get; set; }

    public DateOnly AppointmentDate { get; set; }

    public TimeOnly AppointmentTime { get; set; }

    public int TokenNumber { get; set; }

    public string Status { get; set; } = null!;

    public string? ChiefComplaint { get; set; }

    public string? ConsultationNotes { get; set; }

    public string? Diagnosis { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public int TenantId { get; set; }

    public virtual Doctor Doctor { get; set; } = null!;
}
