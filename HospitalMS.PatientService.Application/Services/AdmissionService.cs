using HospitalMS.PatientService.Application.DTOs;
using HospitalMS.PatientService.Application.Interfaces;
using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Domain.Interfaces;
using System.Net.Http;
using System.Net.Http.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using Microsoft.Extensions.DependencyInjection;

namespace HospitalMS.PatientService.Application.Services;

public class AdmissionService : IAdmissionService
{
    private readonly IAdmissionRepository _admRepo;
    private readonly IBedRepository _bedRepo;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IServiceScopeFactory _scopeFactory;
    
    public AdmissionService(IAdmissionRepository admRepo, 
        IBedRepository bedRepo, IHttpClientFactory httpClientFactory,
        IServiceScopeFactory scopeFactory)
    { 
        _admRepo = admRepo; 
        _bedRepo = bedRepo; 
        _httpClientFactory = httpClientFactory; 
        _scopeFactory = scopeFactory;
    }

    private async Task BroadcastEventAsync(string groupName, string eventName, object payload)
    {
        try {
            var client = _httpClientFactory.CreateClient();
            var request = new { GroupName = groupName, EventName = eventName, Payload = payload };
            await client.PostAsJsonAsync("http://localhost:5004/api/notifications/broadcast", request);
        } catch { /* Silent fail for broadcast */ }
    }
    
    public async Task<AdmissionResponseDto> AdmitPatientAsync(AdmitPatientDto dto)
    {
        if (await _admRepo.IsPatientAdmittedAsync(dto.PatientId))
            throw new Exception("Patient is already admitted.");
            
        // Fetch Patient details from AuthService
        string patientName = "Unknown Patient";
        string? patientPhone = null;
        int patientAge = 0;
        try
        {
            var client = _httpClientFactory.CreateClient();
            var userRes = await client.GetAsync($"http://localhost:5001/api/auth/users/{dto.PatientId}");
            if (userRes.IsSuccessStatusCode)
            {
                var user = await userRes.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                patientName = user.GetProperty("fullName").GetString() ?? "Unknown";
                patientPhone = user.TryGetProperty("phone", out var p) ? p.GetString() : null;
                if (user.TryGetProperty("dateOfBirth", out var dobProp) && dobProp.ValueKind != System.Text.Json.JsonValueKind.Null)
                {
                    var dobStr = dobProp.GetString();
                    if (!string.IsNullOrEmpty(dobStr))
                    {
                        var dob = DateOnly.Parse(dobStr);
                        patientAge = DateTime.Today.Year - dob.Year;
                        if (dob > DateOnly.FromDateTime(DateTime.Today.AddYears(-patientAge))) patientAge--;
                    }
                }
            }
        }
        catch { /* Fallback to defaults */ }
        
        var admission = new Admission
        {
            PatientId = dto.PatientId,
            PatientName = patientName,
            PatientPhone = patientPhone,
            PatientAge = patientAge,
            DoctorId = dto.DoctorId,
            BedId = null, // No bed yet
            AdmissionDate = DateTime.UtcNow,
            Status = "AwaitingBed",
            AdmissionReason = dto.AdmissionReason,
            CreatedAt = DateTime.UtcNow
        };
        var created = await _admRepo.AddAsync(admission);
        
        // Notify Receptionists that a bed is needed
        await BroadcastEventAsync("Receptionist", "AdmissionRequested", new {
            AdmissionId = created.Id, PatientName = patientName, WardRequested = dto.WardType
        });

        return MapToDto(created, null);
    }

    public async Task<AdmissionResponseDto> AssignBedAsync(int admissionId, int bedId)
    {
        var admission = await _admRepo.GetByIdAsync(admissionId)
            ?? throw new Exception("Admission record not found.");
            
        if (admission.Status != "AwaitingBed")
            throw new Exception("This admission is not in 'AwaitingBed' status.");

        var bed = await _bedRepo.GetByIdAsync(bedId)
            ?? throw new Exception("Bed not found.");
            
        if (bed.Status != "Available")
            throw new Exception("The selected bed is not available.");

        await _bedRepo.UpdateStatusAsync(bed.Id, "Occupied");
        
        admission.BedId = bed.Id;
        admission.Status = "Admitted";
        await _admRepo.UpdateAsync(admission);
        
        await BroadcastEventAsync("Admin", "BedStatusChanged", new {
            BedId = bed.Id, BedNumber = bed.BedNumber,
            WardType = bed.WardType, NewStatus = "Occupied"
        });

        return MapToDto(admission, bed);
    }
    
    public async Task<AdmissionResponseDto> DischargePatientAsync(int admissionId, DischargePatientDto dto)
    {
        var admission = await _admRepo.GetByIdAsync(admissionId)
            ?? throw new Exception("Admission not found.");
            
        admission.DischargeDate = DateTime.UtcNow;
        admission.DischargeSummary = dto.DischargeSummary;
        admission.DischargeCondition = dto.DischargeCondition;
        admission.Status = "Discharged";
        await _admRepo.UpdateAsync(admission);
        
        if (admission.BedId.HasValue)
        {
            var bedId = admission.BedId.Value;
            await _bedRepo.UpdateStatusAsync(bedId, "UnderCleaning");
            await BroadcastEventAsync("Admin", "BedStatusChanged", new {
                BedId = bedId, NewStatus = "UnderCleaning"
            });

            // Schedule auto-available after cleaning (Simulated 15-20 min, using 15 min for logic)
            _ = Task.Run(async () => {
                await Task.Delay(TimeSpan.FromMinutes(15));
                using var scope = _scopeFactory.CreateScope();
                var scopedBedRepo = scope.ServiceProvider.GetRequiredService<IBedRepository>();
                var bed = await scopedBedRepo.GetByIdAsync(bedId);
                if (bed != null && bed.Status == "UnderCleaning")
                {
                    await scopedBedRepo.UpdateStatusAsync(bedId, "Available");
                    await BroadcastEventAsync("Admin", "BedStatusChanged", new {
                        BedId = bedId, BedNumber = bed.BedNumber, WardType = bed.WardType, NewStatus = "Available"
                    });
                }
            });
        }
        
        return MapToDto(admission, admission.Bed);
    }
    
    public async Task<List<AdmissionResponseDto>> GetAllActiveAsync()
    {
        var admissions = await _admRepo.GetAllActiveAsync();
        return await PopulateDtosAsync(admissions);
    }

    public async Task<List<AdmissionResponseDto>> GetPendingAdmissionsAsync()
    {
        // We might need to add a method to Repo, or filter active ones
        var allActive = await _admRepo.GetAllActiveAsync();
        var pending = allActive.Where(a => a.Status == "AwaitingBed").ToList();
        return await PopulateDtosAsync(pending);
    }

    private async Task<List<AdmissionResponseDto>> PopulateDtosAsync(List<Admission> admissions)
    {
        if (!admissions.Any()) return new List<AdmissionResponseDto>();

        var patientIds = admissions.Select(a => a.PatientId).Distinct().ToList();
        var userMap = new Dictionary<int, System.Text.Json.JsonElement>();

        try
        {
            var client = _httpClientFactory.CreateClient();
            var idsParam = string.Join(",", patientIds);
            var res = await client.GetAsync($"http://localhost:5001/api/auth/users/batch?ids={idsParam}");
            if (res.IsSuccessStatusCode)
            {
                var users = await res.Content.ReadFromJsonAsync<List<System.Text.Json.JsonElement>>();
                if (users != null)
                {
                    userMap = users.ToDictionary(u => u.GetProperty("id").GetInt32(), u => u);
                }
            }
        }
        catch { }

        var dtos = new List<AdmissionResponseDto>();
        foreach (var a in admissions)
        {
            var dto = MapToDto(a, a.Bed);
            if (userMap.TryGetValue(a.PatientId, out var user))
            {
                if (user.TryGetProperty("fullName", out var nameProp))
                    dto.PatientName = nameProp.GetString() ?? dto.PatientName;

                if (user.TryGetProperty("phone", out var phoneProp))
                    dto.PatientPhone = phoneProp.GetString() ?? dto.PatientPhone;

                if (user.TryGetProperty("dateOfBirth", out var dobProp) && dobProp.ValueKind != System.Text.Json.JsonValueKind.Null)
                {
                    var dobStr = dobProp.GetString();
                    if (!string.IsNullOrEmpty(dobStr))
                    {
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
            dtos.Add(dto);
        }
        return dtos;
    }
        
    public async Task<List<AdmissionResponseDto>> GetByPatientIdAsync(int patientId)
    {
        var admissions = await _admRepo.GetByPatientIdAsync(patientId);
        return admissions.Select(a => MapToDto(a, a.Bed)).ToList();
    }
        
    public async Task<AdmissionResponseDto?> GetByIdAsync(int id)
    { 
        var a = await _admRepo.GetByIdAsync(id); 
        return a == null ? null : MapToDto(a, a.Bed!); 
    }
    
    private static AdmissionResponseDto MapToDto(Admission a, Bed? bed)
    {
        int days = a.DischargeDate.HasValue 
            ? (int)(a.DischargeDate.Value - a.AdmissionDate).TotalDays + 1
            : (int)(DateTime.UtcNow - a.AdmissionDate).TotalDays + 1;
        decimal charge = days * (bed?.DailyCharge ?? 0);
        return new AdmissionResponseDto {
            Id = a.Id, 
            PatientId = a.PatientId, 
            PatientName = a.PatientName,
            PatientPhone = a.PatientPhone,
            PatientAge = a.PatientAge,
            DoctorId = a.DoctorId,
            BedNumber = bed?.BedNumber ?? "N/A",
            WardType = bed?.WardType ?? "N/A",
            AdmissionDate = a.AdmissionDate,
            DischargeDate = a.DischargeDate,
            Status = a.Status, TotalDays = days, TotalBedCharge = charge
        };
    }
}
