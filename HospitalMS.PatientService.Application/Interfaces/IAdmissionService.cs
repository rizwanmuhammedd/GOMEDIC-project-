using HospitalMS.PatientService.Application.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HospitalMS.PatientService.Application.Interfaces;

public interface IAdmissionService
{
    Task<AdmissionResponseDto> AdmitPatientAsync(AdmitPatientDto dto);
    Task<AdmissionResponseDto> AssignBedAsync(int admissionId, int bedId);
    Task<AdmissionResponseDto> DischargePatientAsync(int admissionId, DischargePatientDto dto);
    Task<List<AdmissionResponseDto>> GetAllActiveAsync();
    Task<List<AdmissionResponseDto>> GetPendingAdmissionsAsync();
    Task<List<AdmissionResponseDto>> GetByPatientIdAsync(int patientId);
    Task<AdmissionResponseDto?> GetByIdAsync(int id);
}
