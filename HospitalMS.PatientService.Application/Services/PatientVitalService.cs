using HospitalMS.PatientService.Application.DTOs;
using HospitalMS.PatientService.Application.Interfaces;
using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Domain.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace HospitalMS.PatientService.Application.Services;

public class PatientVitalService : IPatientVitalService
{
    private readonly IPatientVitalRepository _repo;

    public PatientVitalService(IPatientVitalRepository repo)
    {
        _repo = repo;
    }

    public async Task<IEnumerable<PatientVitalDto>> GetByPatientIdAsync(int patientId)
    {
        var vitals = await _repo.GetByPatientIdAsync(patientId);
        return vitals.Select(MapToDto);
    }

    public async Task<IEnumerable<PatientVitalDto>> GetByAdmissionIdAsync(int admissionId)
    {
        var vitals = await _repo.GetByAdmissionIdAsync(admissionId);
        return vitals.Select(MapToDto);
    }

    public async Task<PatientVitalDto> CreateAsync(string recordedBy, CreatePatientVitalDto dto)
    {
        var vital = new PatientVital
        {
            PatientId = dto.PatientId,
            AdmissionId = dto.AdmissionId,
            AppointmentId = dto.AppointmentId,
            Temperature = dto.Temperature,
            BloodPressure = dto.BloodPressure,
            HeartRate = dto.HeartRate,
            RespiratoryRate = dto.RespiratoryRate,
            OxygenSaturation = dto.OxygenSaturation,
            Weight = dto.Weight,
            Height = dto.Height,
            RecordedBy = recordedBy,
            RecordedAt = DateTime.UtcNow
        };

        var created = await _repo.AddAsync(vital);
        return MapToDto(created);
    }

    private static PatientVitalDto MapToDto(PatientVital v) => new PatientVitalDto
    {
        Id = v.Id,
        PatientId = v.PatientId,
        AdmissionId = v.AdmissionId,
        AppointmentId = v.AppointmentId,
        Temperature = v.Temperature,
        BloodPressure = v.BloodPressure,
        HeartRate = v.HeartRate,
        RespiratoryRate = v.RespiratoryRate,
        OxygenSaturation = v.OxygenSaturation,
        Weight = v.Weight,
        Height = v.Height,
        RecordedBy = v.RecordedBy,
        RecordedAt = v.RecordedAt
    };
}
