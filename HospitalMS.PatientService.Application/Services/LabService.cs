using HospitalMS.PatientService.Application.DTOs;
using HospitalMS.PatientService.Application.Interfaces;
using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Domain.Interfaces;
using System.Net.Http.Json;

namespace HospitalMS.PatientService.Application.Services;

public class LabService : ILabService
{
    private readonly ILabOrderRepository _repo;
    private readonly HttpClient _httpClient;

    public LabService(ILabOrderRepository repo, IHttpClientFactory httpClientFactory)
    {
        _repo = repo;
        _httpClient = httpClientFactory.CreateClient();
    }

    public async Task<List<LabOrder>> GetAllAsync() => await _repo.GetAllAsync();

    public async Task<LabOrder?> GetByIdAsync(int id) => await _repo.GetByIdAsync(id);

    public async Task<List<LabOrder>> GetPendingAsync() => await _repo.GetPendingAsync();

    public async Task<List<LabOrder>> GetByPatientAsync(int patientId) => await _repo.GetByPatientIdAsync(patientId);

    public async Task<LabOrder> OrderTestAsync(int patientId, int doctorId, int labTestId, int? appointmentId)
    {
        var order = new LabOrder
        {
            PatientId = patientId,
            DoctorId = doctorId,
            LabTestId = labTestId,
            AppointmentId = appointmentId,
            Status = "Pending",
            OrderedAt = DateTime.UtcNow
        };
        return await _repo.AddAsync(order);
    }

    public async Task UploadResultAsync(int orderId, string resultValue, string? notes, bool isAbnormal)
    {
        var order = await _repo.GetByIdAsync(orderId)
            ?? throw new Exception("Lab order not found");

        order.Status = "ResultReady";
        order.ResultValue = resultValue;
        order.ResultNotes = notes;

        await _repo.UpdateAsync(order);

        // Notify Patient via persistent Notification endpoint
        try
        {
            await _httpClient.PostAsJsonAsync("http://localhost:5004/api/notifications", new
            {
                UserId = order.PatientId,
                Title = isAbnormal ? "🔴 Abnormal Lab Result" : "✅ Lab Result Ready",
                Message = $"Your lab result for order #{orderId} is ready for review.",
                Type = isAbnormal ? "error" : "success",
                RelatedEntityId = orderId,
                RelatedEntityType = "LabOrder",
                TargetUrl = "/dashboard" // Or a specific lab results page if available
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to notify Patient: {ex.Message}");
        }
    }
}
