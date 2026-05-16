using HospitalMS.PatientService.Domain.Entities;

namespace HospitalMS.PatientService.Domain.Interfaces;

public interface IPatientVitalRepository
{
    Task<IEnumerable<PatientVital>> GetByPatientIdAsync(int patientId);
    Task<IEnumerable<PatientVital>> GetByAdmissionIdAsync(int admissionId);
    Task<PatientVital> AddAsync(PatientVital vital);
}
