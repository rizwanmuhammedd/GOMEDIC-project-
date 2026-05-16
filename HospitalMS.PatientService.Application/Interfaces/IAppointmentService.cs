using HospitalMS.PatientService.Application.DTOs;

namespace HospitalMS.PatientService.Application.Interfaces;

public interface IAppointmentService
{
    Task<List<AppointmentResponseDto>> GetAllAsync();
    Task<AppointmentResponseDto?> GetByIdAsync(int id);
    Task<List<AppointmentResponseDto>> GetMyAppointmentsAsync(int patientId);
    Task<List<AppointmentResponseDto>> GetByPatientIdAsync(int patientId);
    Task<List<AppointmentResponseDto>> GetDoctorAppointmentsAsync(int doctorId);
    Task<List<AppointmentResponseDto>> GetByDoctorUserIdAsync(int userId);
    Task<AppointmentResponseDto> BookAsync(int patientId, BookAppointmentDto dto);
    Task UpdateAsync(int id, UpdateAppointmentDto dto);
    Task CancelAsync(int id);
    Task<List<string>> GetBookedTimesAsync(int doctorId, DateOnly date);
    Task<List<string>> GetAvailableSlotsAsync(int doctorId, DateOnly date);
}
