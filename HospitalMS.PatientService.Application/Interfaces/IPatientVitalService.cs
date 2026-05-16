using HospitalMS.PatientService.Application.DTOs;

namespace HospitalMS.PatientService.Application.Interfaces;

public interface IPatientVitalService
{
    Task<IEnumerable<PatientVitalDto>> GetByPatientIdAsync(int patientId);
    Task<IEnumerable<PatientVitalDto>> GetByAdmissionIdAsync(int admissionId);
    Task<PatientVitalDto> CreateAsync(string recordedBy, CreatePatientVitalDto dto);
}
