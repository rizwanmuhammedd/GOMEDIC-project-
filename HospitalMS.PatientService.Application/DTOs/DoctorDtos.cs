namespace HospitalMS.PatientService.Application.DTOs;

public class CreateDoctorDto
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public int DepartmentId { get; set; }
    public string Specialization { get; set; } = string.Empty;
    public string Qualification { get; set; } = string.Empty;
    public string LicenseNumber { get; set; } = string.Empty;
    public decimal ConsultationFee { get; set; }
    public int MaxPatientsPerDay { get; set; } = 30;
    public int AppointmentDuration { get; set; } = 15;
}

public class DoctorDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public string Qualification { get; set; } = string.Empty;
    public string LicenseNumber { get; set; } = string.Empty;
    public decimal ConsultationFee { get; set; }
    public int MaxPatientsPerDay { get; set; }
    public bool IsAvailable { get; set; }
    public int AppointmentDuration { get; set; }
}

public class UpdateDoctorDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public int DepartmentId { get; set; }
    public string Specialization { get; set; } = string.Empty;
    public string Qualification { get; set; } = string.Empty;
    public decimal ConsultationFee { get; set; }
    public int MaxPatientsPerDay { get; set; }
    public bool IsAvailable { get; set; }
    public int AppointmentDuration { get; set; }
}

public class DoctorScheduleDto
{
    public int Id { get; set; }
    public int DoctorId { get; set; }
    public string ScheduleDate { get; set; } = string.Empty;
    public string ShiftType { get; set; } = string.Empty;
    public string ShiftStart { get; set; } = string.Empty;
    public string ShiftEnd { get; set; } = string.Empty;
    public bool IsLeave { get; set; }
    public string? LeaveReason { get; set; }
}

public class CreateDoctorScheduleDto
{
    public string ScheduleDate { get; set; } = string.Empty;
    public string ShiftType { get; set; } = string.Empty; // Morning, Afternoon, Evening, Night
    public string ShiftStart { get; set; } = string.Empty; // HH:mm
    public string ShiftEnd { get; set; } = string.Empty;   // HH:mm
    public bool IsLeave { get; set; }
    public string? LeaveReason { get; set; }
}
