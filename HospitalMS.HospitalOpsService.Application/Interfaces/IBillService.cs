using HospitalMS.HospitalOpsService.Application.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HospitalMS.HospitalOpsService.Application.Interfaces;

public interface IBillService
{
    Task<BillDto> GenerateBillAsync(GenerateBillDto dto);
    Task<BillDto> RecordPaymentAsync(int billId, RecordPaymentDto dto);
    Task<BillDto> ProcessOnlinePaymentAsync(int billId);
    Task<List<BillDto>> GetByPatientAsync(int patientId);
    Task<List<BillDto>> GetPendingAsync();
    Task<BillDto?> GetByIdAsync(int id);
    Task<BillDto?> GetByPrescriptionIdAsync(int prescriptionId);
    Task SendPaymentReminderAsync(int billId);
    Task<RazorpayOrderResponseDto> CreateRazorpayOrderAsync(int billId);
    Task<bool> VerifyRazorpayPaymentAsync(RazorpayPaymentVerificationDto verificationDto);
}
