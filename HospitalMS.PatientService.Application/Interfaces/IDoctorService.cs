using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Application.DTOs;

namespace HospitalMS.PatientService.Application.Interfaces;

public interface IDoctorService
{
    Task<List<DoctorDto>> GetAllAsync();
    Task<DoctorDto?> GetByIdAsync(int id);
    Task<DoctorDto?> GetByUserIdAsync(int userId);
    Task<List<DoctorDto>> GetByUserIdsAsync(IEnumerable<int> userIds);
    Task<DoctorDto> GetOrCreateByUserIdAsync(int userId, string fullName);
    Task<List<DoctorDto>> GetByDepartmentAsync(int deptId);
    Task<DoctorDto> CreateAsync(CreateDoctorDto dto);
    Task UpdateAsync(UpdateDoctorDto dto);
    Task DeactivateAsync(int id);
    Task ToggleAvailabilityAsync(int id);
    Task UpdateSlotDurationAsync(int userId, int duration);

    // Schedule Management
    Task<List<DoctorScheduleDto>> GetSchedulesAsync(int doctorId);
    Task<DoctorScheduleDto> AddScheduleAsync(int doctorId, CreateDoctorScheduleDto dto);
    Task UpdateScheduleAsync(int scheduleId, CreateDoctorScheduleDto dto);
    Task DeleteScheduleAsync(int scheduleId);
    Task<List<string>> GetAvailableTimeSlotsAsync(int doctorId, DateOnly date);
}
