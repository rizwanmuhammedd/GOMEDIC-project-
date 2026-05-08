using HospitalMS.PatientService.Application.DTOs;
using HospitalMS.PatientService.Application.Interfaces;
using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Domain.Interfaces;
using System.Net.Http.Json;

namespace HospitalMS.PatientService.Application.Services;

public class AppointmentService : IAppointmentService
{
    private readonly IAppointmentRepository _repository;
    private readonly IDoctorRepository _doctorRepo;
    private readonly IDoctorScheduleRepository _scheduleRepo;
    private readonly HttpClient _httpClient;

    public AppointmentService(
        IAppointmentRepository repository, 
        IDoctorRepository doctorRepo,
        IDoctorScheduleRepository scheduleRepo,
        IHttpClientFactory httpClientFactory)
    {
        _repository = repository;
        _doctorRepo = doctorRepo;
        _scheduleRepo = scheduleRepo;
        _httpClient = httpClientFactory.CreateClient();
    }


    public async Task<List<AppointmentResponseDto>> GetAllAsync()
    {
        var list = await _repository.GetAllAsync();
        return await PopulatePatientDetailsAsync(list.Select(MapToDto).ToList());
    }

    public async Task<AppointmentResponseDto?> GetByIdAsync(int id)
    {
        var a = await _repository.GetByIdAsync(id);
        if (a == null) return null;
        var list = await PopulatePatientDetailsAsync(new List<AppointmentResponseDto> { MapToDto(a) });
        return list.FirstOrDefault();
    }

    public async Task<List<AppointmentResponseDto>> GetMyAppointmentsAsync(int patientId)
    {
        var list = await _repository.GetByPatientIdAsync(patientId);
        return await PopulatePatientDetailsAsync(list.Select(MapToDto).ToList());
    }

    public async Task<List<AppointmentResponseDto>> GetDoctorAppointmentsAsync(int doctorId)
    {
        var list = await _repository.GetByDoctorIdAsync(doctorId);
        return await PopulatePatientDetailsAsync(list.Select(MapToDto).ToList());
    }

    public async Task<List<AppointmentResponseDto>> GetByDoctorUserIdAsync(int userId)
    {
        var doctor = await _doctorRepo.GetByUserIdAsync(userId);
        if (doctor == null) return new List<AppointmentResponseDto>();
        return await GetDoctorAppointmentsAsync(doctor.Id);
    }

    private async Task<List<AppointmentResponseDto>> PopulatePatientDetailsAsync(List<AppointmentResponseDto> dtos)
    {
        var client = _httpClient; 
        foreach (var dto in dtos)
        {
            // Fetch if name is missing OR age is zero (might be uninitialized)
            if (string.IsNullOrEmpty(dto.PatientName) || dto.PatientName == "Unknown" || dto.PatientAge == 0)
            {
                try
                {
                    var userRes = await client.GetAsync($"http://localhost:5001/api/auth/users/{dto.PatientId}");
                    if (userRes.IsSuccessStatusCode)
                    {
                        var user = await userRes.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                        
                        if (user.TryGetProperty("fullName", out var nameProp))
                            dto.PatientName = nameProp.GetString() ?? dto.PatientName;

                        if (user.TryGetProperty("phone", out var phoneProp))
                            dto.PatientPhone = phoneProp.GetString() ?? dto.PatientPhone;

                        if (user.TryGetProperty("dateOfBirth", out var dobProp) && dobProp.ValueKind != System.Text.Json.JsonValueKind.Null)
                        {
                            var dobStr = dobProp.GetString();
                            if (!string.IsNullOrEmpty(dobStr))
                            {
                                // Resilient parsing: try DateOnly then DateTime
                                if (DateTime.TryParse(dobStr, out var dt))
                                {
                                    var today = DateTime.Today;
                                    int age = today.Year - dt.Year;
                                    if (dt.Date > today.AddYears(-age)) age--;
                                    dto.PatientAge = age >= 0 ? age : 0;
                                }
                            }
                        }
                    }
                }
                catch { /* Silent fail to avoid crashing the whole list */ }
            }
        }
        return dtos;
    }

    public async Task<AppointmentResponseDto> BookAsync(int patientId, BookAppointmentDto dto)
    {
        // 1. Check doctor exists and is available
        var doctor = await _doctorRepo.GetByIdAsync(dto.DoctorId);
        if (doctor == null) throw new Exception("Doctor not found");
        if (!doctor.IsAvailable) throw new Exception("Doctor is not currently available");

        // 2. Prevent past dates (Allow Today)
        if (dto.AppointmentDate < DateOnly.FromDateTime(DateTime.Today))
            throw new Exception("Appointment must not be in the past");

        // 3. Validate requested time is within Doctor's Schedule
        var schedules = await _scheduleRepo.GetByDoctorAndDateAsync(dto.DoctorId, dto.AppointmentDate);
        var activeSchedules = schedules.Where(s => !s.IsLeave).ToList();
        
        Console.WriteLine($"Booking attempt for Doctor {dto.DoctorId} on {dto.AppointmentDate} at {dto.AppointmentTime}");
        foreach(var s in activeSchedules) Console.WriteLine($" - Available Shift: {s.ShiftStart} to {s.ShiftEnd}");

        if (!activeSchedules.Any())
            throw new Exception("The doctor has no active schedule for the selected date.");

        bool isWithinShift = activeSchedules.Any(s => 
            dto.AppointmentTime >= s.ShiftStart && dto.AppointmentTime <= s.ShiftEnd);

        if (!isWithinShift)
        {
            Console.WriteLine("REJECTED: Time is outside scheduled shifts.");
            throw new Exception($"The requested time {dto.AppointmentTime} is outside of the doctor's scheduled shift hours for today.");
        }
        Console.WriteLine("ACCEPTED: Time is within shift.");

        // 4. Check exact time slot not already taken
        bool slotTaken = await _repository.ExistsAsync(dto.DoctorId, dto.AppointmentDate, dto.AppointmentTime);
        if (slotTaken) throw new Exception("This time slot is already booked. Please choose another time.");

        // 4. Check patient doesn't already have appointment same day same doctor
        bool duplicate = await _repository.PatientHasAppointmentAsync(patientId, dto.DoctorId, dto.AppointmentDate);
        if (duplicate) throw new Exception("You already have an appointment with this doctor on this date.");

        // 5. Check max patients per day not exceeded
        int todayCount = await _repository.GetDoctorDayCountAsync(dto.DoctorId, dto.AppointmentDate);
        if (todayCount >= doctor.MaxPatientsPerDay)
            throw new Exception($"Doctor's schedule is full. Max {doctor.MaxPatientsPerDay} patients per day.");

        // 6. Auto-assign token number
        int token = await _repository.GetNextTokenAsync(dto.DoctorId, dto.AppointmentDate);

        var appointment = new Appointment
        {
            PatientId = patientId,
            PatientName = dto.PatientName,
            PatientPhone = dto.PatientPhone,
            PatientAge = dto.PatientAge,
            DoctorId = dto.DoctorId,
            AppointmentDate = dto.AppointmentDate,
            AppointmentTime = dto.AppointmentTime,
            TokenNumber = token,
            Status = "Scheduled",
            ChiefComplaint = dto.ChiefComplaint,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _repository.AddAsync(appointment);
        var reloaded = await _repository.GetByIdAsync(created.Id);

        // Notify Doctor via SignalR (and persist to DB via NotificationService)
        try
        {
            await _httpClient.PostAsJsonAsync("http://localhost:5004/api/notifications", new
            {
                UserId = doctor.UserId,
                Title = "🗓 New Appointment Booked",
                Message = $"New appointment from {dto.PatientName} for {dto.AppointmentDate} at {dto.AppointmentTime:HH:mm}",
                Type = "info"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to notify Doctor: {ex.Message}");
        }

        return MapToDto(reloaded!);
    }

    public async Task UpdateAsync(int id, UpdateAppointmentDto dto)
    {
        var a = await _repository.GetByIdAsync(id)
            ?? throw new Exception("Appointment not found");

        a.Status = dto.Status;
        a.ConsultationNotes = dto.ConsultationNotes;
        a.Diagnosis = dto.Diagnosis;
        // a.UpdatedAt = DateTime.UtcNow; // Assuming UpdatedAt exists in entity
        await _repository.UpdateAsync(a);
    }

    public async Task CancelAsync(int id)
    {
        var a = await _repository.GetByIdAsync(id)
            ?? throw new Exception("Appointment not found");

        a.Status = "Cancelled";
        // a.UpdatedAt = DateTime.UtcNow;
        await _repository.UpdateAsync(a);
    }

    public async Task<List<string>> GetBookedTimesAsync(int doctorId, DateOnly date)
    {
        var appointments = await _repository.GetByDoctorAndDateAsync(doctorId, date);
        return appointments
            .Where(a => a.Status != "Cancelled")
            .Select(a => a.AppointmentTime.ToString("HH:mm"))
            .ToList();
    }

    public async Task<List<string>> GetAvailableSlotsAsync(int doctorId, DateOnly date)
    {
        var doctor = await _doctorRepo.GetByIdAsync(doctorId);
        int duration = doctor?.AppointmentDuration ?? 15;
        if (duration <= 0) duration = 15;

        var schedules = await _scheduleRepo.GetByDoctorAndDateAsync(doctorId, date);
        var activeSchedules = schedules.Where(s => !s.IsLeave).ToList();

        if (!activeSchedules.Any()) return new List<string>();

        var bookedTimes = (await GetBookedTimesAsync(doctorId, date)).ToHashSet();
        var allPossibleSlots = new List<string>();

        foreach (var shift in activeSchedules)
        {
            var current = shift.ShiftStart;
            // Use same real-life logic: slot must end within shift
            while (current.AddMinutes(duration) <= shift.ShiftEnd)
            {
                var timeStr = current.ToString("HH:mm");
                if (bookedTimes.Contains(timeStr))
                {
                    allPossibleSlots.Add($"{timeStr}::booked");
                }
                else
                {
                    allPossibleSlots.Add(timeStr);
                }
                current = current.AddMinutes(duration);
            }
        }

        return allPossibleSlots
            .OrderBy(s => s)
            .Distinct()
            .ToList();
    }

    // Helper — map entity to DTO
    private static AppointmentResponseDto MapToDto(Appointment a) => new()
    {
        Id = a.Id,
        PatientId = a.PatientId,
        PatientName = a.PatientName,
        PatientPhone = a.PatientPhone,
        PatientAge = a.PatientAge,
        DoctorName = a.Doctor?.FullName ?? "Specialist",
        DepartmentName = a.Doctor?.Department?.Name ?? "General",
        AppointmentDate = a.AppointmentDate,
        AppointmentTime = a.AppointmentTime,
        TokenNumber = a.TokenNumber,
        Status = a.Status,
        ChiefComplaint = a.ChiefComplaint
    };
}
