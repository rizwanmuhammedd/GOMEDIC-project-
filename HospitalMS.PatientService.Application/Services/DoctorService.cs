using HospitalMS.PatientService.Application.DTOs;
using HospitalMS.PatientService.Application.Interfaces;
using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Domain.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using System.Net.Http.Json;

namespace HospitalMS.PatientService.Application.Services;

public class DoctorService : IDoctorService
{
    private readonly IDoctorRepository _repository;
    private readonly IDoctorScheduleRepository _scheduleRepo;
    private readonly IAppointmentRepository _appointmentRepo;
    private readonly IHttpClientFactory _httpClientFactory;

    public DoctorService(
        IDoctorRepository repository, 
        IDoctorScheduleRepository scheduleRepo,
        IAppointmentRepository appointmentRepo,
        IHttpClientFactory httpClientFactory)
    {
        _repository = repository;
        _scheduleRepo = scheduleRepo;
        _appointmentRepo = appointmentRepo;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<List<DoctorDto>> GetAllAsync()
    {
        var doctors = await _repository.GetAllAsync();
        var activeUserIds = await GetActiveUserIdsAsync();
        return doctors
            .Where(d => activeUserIds.Contains(d.UserId))
            .Select(MapToDto)
            .ToList();
    }

    public async Task<List<DoctorDto>> GetByDepartmentAsync(int deptId)
    {
        var doctors = await _repository.GetByDepartmentAsync(deptId);
        var activeUserIds = await GetActiveUserIdsAsync();
        return doctors
            .Where(d => activeUserIds.Contains(d.UserId))
            .Select(MapToDto)
            .ToList();
    }

    public async Task<DoctorDto?> GetByIdAsync(int id)
    {
        var doctor = await _repository.GetByIdAsync(id);
        return doctor == null ? null : MapToDto(doctor);
    }

    public async Task<DoctorDto?> GetByUserIdAsync(int userId)
    {
        var doctor = await _repository.GetByUserIdAsync(userId);
        return doctor == null ? null : MapToDto(doctor);
    }

    public async Task<DoctorDto> GetOrCreateByUserIdAsync(int userId, string fullName)
    {
        var doctor = await _repository.GetByUserIdAsync(userId);
        if (doctor != null) return MapToDto(doctor);

        // Auto-create a basic doctor profile if it doesn't exist
        var newDoctor = new Doctor
        {
            UserId = userId,
            FullName = fullName,
            DepartmentId = 1, // Default to General Medicine
            Specialization = "Medical Specialist",
            Qualification = "MBBS",
            LicenseNumber = $"PENDING-{userId}",
            ConsultationFee = 500,
            MaxPatientsPerDay = 30,
            IsAvailable = true,
            CreatedAt = DateTime.UtcNow
        };
        var saved = await _repository.AddAsync(newDoctor);
        return MapToDto(saved);
    }

    private async Task<HashSet<int>> GetActiveUserIdsAsync()
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync("http://localhost:5001/api/auth/users/role/Doctor");
            if (response.IsSuccessStatusCode)
            {
                var users = await response.Content.ReadFromJsonAsync<List<UserStatusDto>>();
                if (users != null)
                {
                    return users.Select(u => u.Id).ToHashSet();
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"AuthService sync failed: {ex.Message}");
        }
        return new HashSet<int>();
    }

    private class UserStatusDto
    {
        public int Id { get; set; }
    }

    public async Task<DoctorDto> CreateAsync(CreateDoctorDto dto)
    {
        var doctor = new Doctor
        {
            UserId = dto.UserId,
            FullName = dto.FullName,
            ProfileImageUrl = dto.ProfileImageUrl,
            DepartmentId = dto.DepartmentId,
            Specialization = dto.Specialization,
            Qualification = dto.Qualification,
            LicenseNumber = dto.LicenseNumber,
            ConsultationFee = dto.ConsultationFee,
            MaxPatientsPerDay = dto.MaxPatientsPerDay,
            AppointmentDuration = dto.AppointmentDuration,
            IsAvailable = true,
            CreatedAt = DateTime.UtcNow
        };
        var saved = await _repository.AddAsync(doctor);
        return MapToDto(saved);
    }

    public async Task UpdateAsync(UpdateDoctorDto dto)
    {
        var existing = await _repository.GetByIdAsync(dto.Id) 
            ?? throw new Exception("Doctor not found");

        existing.FullName = dto.FullName;
        existing.ProfileImageUrl = dto.ProfileImageUrl;
        existing.DepartmentId = dto.DepartmentId;
        existing.Specialization = dto.Specialization;
        existing.Qualification = dto.Qualification;
        existing.ConsultationFee = dto.ConsultationFee;
        existing.MaxPatientsPerDay = dto.MaxPatientsPerDay;
        existing.IsAvailable = dto.IsAvailable;
        existing.AppointmentDuration = dto.AppointmentDuration;

        await _repository.UpdateAsync(existing);
    }

    public async Task DeactivateAsync(int id)
    {
        var doctor = await _repository.GetByIdAsync(id) ?? throw new Exception("Doctor not found");
        doctor.IsAvailable = false;
        await _repository.UpdateAsync(doctor);
    }

    public async Task ToggleAvailabilityAsync(int id)
    {
        var doctor = await _repository.GetByIdAsync(id) ?? throw new Exception("Doctor not found");
        doctor.IsAvailable = !doctor.IsAvailable;
        await _repository.UpdateAsync(doctor);
    }

    public async Task UpdateSlotDurationAsync(int userId, int duration)
    {
        var doctor = await _repository.GetByUserIdAsync(userId) 
            ?? throw new Exception("Doctor profile not found");
        
        doctor.AppointmentDuration = duration;
        await _repository.UpdateAsync(doctor);
    }

    public async Task<List<DoctorScheduleDto>> GetSchedulesAsync(int doctorId)
    {
        var schedules = await _scheduleRepo.GetByDoctorIdAsync(doctorId);
        return schedules.Select(MapToScheduleDto).ToList();
    }

    public async Task<DoctorScheduleDto> AddScheduleAsync(int doctorId, CreateDoctorScheduleDto dto)
    {
        var schedule = new DoctorSchedule
        {
            DoctorId = doctorId,
            ScheduleDate = DateOnly.Parse(dto.ScheduleDate),
            ShiftType = dto.ShiftType,
            ShiftStart = TimeOnly.Parse(dto.ShiftStart),
            ShiftEnd = TimeOnly.Parse(dto.ShiftEnd),
            IsLeave = dto.IsLeave,
            LeaveReason = dto.LeaveReason,
            CreatedAt = DateTime.UtcNow
        };
        var saved = await _scheduleRepo.AddAsync(schedule);
        return MapToScheduleDto(saved);
    }

    public async Task UpdateScheduleAsync(int scheduleId, CreateDoctorScheduleDto dto)
    {
        var existing = await _scheduleRepo.GetByIdAsync(scheduleId) 
            ?? throw new Exception("Schedule not found");

        existing.ScheduleDate = DateOnly.Parse(dto.ScheduleDate);
        existing.ShiftType = dto.ShiftType;
        existing.ShiftStart = TimeOnly.Parse(dto.ShiftStart);
        existing.ShiftEnd = TimeOnly.Parse(dto.ShiftEnd);
        existing.IsLeave = dto.IsLeave;
        existing.LeaveReason = dto.LeaveReason;

        await _scheduleRepo.UpdateAsync(existing);
    }

    public async Task DeleteScheduleAsync(int scheduleId)
    {
        await _scheduleRepo.DeleteAsync(scheduleId);
    }

    public async Task<List<string>> GetAvailableTimeSlotsAsync(int doctorId, DateOnly date)
    {
        var doctor = await _repository.GetByIdAsync(doctorId);
        int duration = doctor?.AppointmentDuration ?? 15;
        if (duration <= 0) duration = 15;

        var schedules = await _scheduleRepo.GetByDoctorAndDateAsync(doctorId, date);
        var activeSchedules = schedules.Where(s => !s.IsLeave).ToList();

        if (!activeSchedules.Any()) return new List<string>();

        var appointments = await _appointmentRepo.GetByDoctorAndDateAsync(doctorId, date);
        var bookedTimes = appointments.Select(a => a.AppointmentTime.ToString("HH:mm")).ToHashSet();

        var slots = new List<string>();
        foreach (var schedule in activeSchedules)
        {
            var current = schedule.ShiftStart;
            // A slot starting at ShiftEnd is not valid as it would exceed the shift.
            // So we use current.AddMinutes(duration) <= schedule.ShiftEnd
            while (current.AddMinutes(duration) <= schedule.ShiftEnd)
            {
                var timeStr = current.ToString("HH:mm");
                if (bookedTimes.Contains(timeStr))
                {
                    slots.Add($"{timeStr}::booked");
                }
                else
                {
                    slots.Add(timeStr);
                }
                current = current.AddMinutes(duration);
            }
        }

        return slots.OrderBy(s => s).Distinct().ToList();
    }

    private DoctorDto MapToDto(Doctor d) => new DoctorDto
    {
        Id = d.Id,
        UserId = d.UserId,
        FullName = d.FullName,
        ProfileImageUrl = d.ProfileImageUrl,
        DepartmentId = d.DepartmentId,
        DepartmentName = d.Department?.Name ?? "Unknown",
        Specialization = d.Specialization,
        Qualification = d.Qualification,
        LicenseNumber = d.LicenseNumber,
        ConsultationFee = d.ConsultationFee,
        MaxPatientsPerDay = d.MaxPatientsPerDay,
        IsAvailable = d.IsAvailable,
        AppointmentDuration = d.AppointmentDuration
    };

    private DoctorScheduleDto MapToScheduleDto(DoctorSchedule s) => new DoctorScheduleDto
    {
        Id = s.Id,
        DoctorId = s.DoctorId,
        ScheduleDate = s.ScheduleDate.ToString("yyyy-MM-dd"),
        ShiftType = s.ShiftType,
        ShiftStart = s.ShiftStart.ToString("h:mm tt"),
        ShiftEnd = s.ShiftEnd.ToString("h:mm tt"),
        IsLeave = s.IsLeave,
        LeaveReason = s.LeaveReason
    };
}

