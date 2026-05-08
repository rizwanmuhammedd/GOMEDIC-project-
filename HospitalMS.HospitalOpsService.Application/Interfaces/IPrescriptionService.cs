using HospitalMS.HospitalOpsService.Application.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HospitalMS.HospitalOpsService.Application.Interfaces;

public interface IPrescriptionService
{
    Task<PrescriptionResponseDto> CreateAsync(int doctorId, CreatePrescriptionDto dto);
    Task<PrescriptionResponseDto> UpdateAsync(int prescriptionId, int doctorId, CreatePrescriptionDto dto);
    Task<PrescriptionResponseDto> DispenseAsync(int prescriptionId, int pharmacistId);
    Task<List<PrescriptionResponseDto>> GetPendingAsync();
    Task<List<PrescriptionResponseDto>> GetByPatientAsync(int patientId);
    Task<List<PrescriptionResponseDto>> GetByDoctorAsync(int doctorId);
    Task<PrescriptionResponseDto> PayAsync(int prescriptionId);
    Task<PrescriptionResponseDto> PayMedicineAsync(int prescriptionId);
    Task<PrescriptionResponseDto> DismissMedicinePaymentAsync(int prescriptionId);
    Task<RazorpayOrderResponseDto> CreateRazorpayOrderAsync(int prescriptionId, bool isMedicine = false);
    Task<bool> VerifyRazorpayPaymentAsync(RazorpayPaymentVerificationDto verificationDto);
}
