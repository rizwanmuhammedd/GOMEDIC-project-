// HospitalMS.HospitalOpsService.Application/Services/BillService.cs
using HospitalMS.HospitalOpsService.Application.DTOs;
using HospitalMS.HospitalOpsService.Application.Interfaces;
using HospitalMS.HospitalOpsService.Domain.Entities;
using HospitalMS.HospitalOpsService.Domain.Interfaces;
using System.Net.Http.Json;
using Hangfire;
using Razorpay.Api;
using Microsoft.Extensions.Configuration;

namespace HospitalMS.HospitalOpsService.Application.Services;

public class BillService : IBillService
{
    private readonly IBillRepository _repo;
    private readonly IPrescriptionRepository _prescriptionRepo;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ITenantProvider _tenant;

    public BillService(IBillRepository repo, IPrescriptionRepository prescriptionRepo, IHttpClientFactory httpClientFactory, IConfiguration config, ITenantProvider tenant)
    {
        _repo = repo;
        _prescriptionRepo = prescriptionRepo;
        _httpClientFactory = httpClientFactory;
        _config = config;
        _tenant = tenant;
    }

    public async Task<BillDto> GenerateBillAsync(GenerateBillDto dto)
    {
        var billNumber = await _repo.GenerateBillNumberAsync();

        var total = dto.ConsultationCharge + dto.MedicineCharge +
                    dto.LabCharge + dto.BedCharge +
                    dto.OtherCharges - dto.Discount;

        var bill = new Bill
        {
            BillNumber         = billNumber,
            PatientId          = dto.PatientId,
            PatientName        = dto.PatientName,
            PatientPhone       = dto.PatientPhone,
            PatientAge         = dto.PatientAge,
            AdmissionId        = dto.AdmissionId,
            PrescriptionId     = dto.PrescriptionId,
            ConsultationCharge = dto.ConsultationCharge,
            MedicineCharge     = dto.MedicineCharge,
            LabCharge          = dto.LabCharge,
            BedCharge          = dto.BedCharge,
            OtherCharges       = dto.OtherCharges,
            Discount           = dto.Discount,
            TotalAmount        = total,
            PaidAmount         = 0,
            BalanceAmount      = total,
            PaymentStatus      = "Pending",
            GeneratedAt        = DateTime.UtcNow,
            GeneratedByUserId  = dto.GeneratedByUserId
        };

        var saved = await _repo.AddAsync(bill);

        // Notify Patient (Persistent)
        if (dto.PatientId > 0)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                await client.PostAsJsonAsync("http://localhost:5004/api/notifications", new
                {
                    UserId = dto.PatientId,
                    Title = "🧾 New Bill Generated",
                    Message = $"A new bill ({bill.BillNumber}) for ₹{bill.TotalAmount} has been generated.",
                    Type = "warning",
                    RelatedEntityId = saved.Id,
                    RelatedEntityType = "Bill",
                    TargetUrl = "/bills"
                });
            }
            catch { }
        }

        return await PopulatePatientDetailsAsync(Map(saved));
    }

    public async Task<BillDto> RecordPaymentAsync(int billId, RecordPaymentDto dto)
    {
        var bill = await _repo.GetByIdAsync(billId);
        if (bill == null)
            throw new Exception("Bill not found");
        if (bill.PaymentStatus == "Paid")
            throw new Exception("This bill is already fully paid");
        if (dto.Amount <= 0)
            throw new Exception("Payment amount must be greater than zero");
        if (dto.Amount > bill.BalanceAmount)
            throw new Exception(
                $"Amount ({dto.Amount}) exceeds balance due ({bill.BalanceAmount})");

        bill.PaidAmount   += dto.Amount;
        bill.BalanceAmount = bill.TotalAmount - bill.PaidAmount;
        bill.PaymentMethod = dto.PaymentMethod;

        if (dto.PaymentMethod == "Insurance")
        {
            bill.InsuranceProvider    = dto.InsuranceProvider;
            bill.InsuranceClaimNumber = dto.InsuranceClaimNumber;
        }

        bill.PaymentStatus = bill.BalanceAmount <= 0
            ? "Paid" : "PartiallyPaid";

        if (bill.PaymentStatus == "Paid")
        {
            bill.PaidAt = DateTime.UtcNow;
            
            // If this bill was linked to a prescription, mark the prescription as paid
            if (bill.PrescriptionId.HasValue)
            {
                var prescription = await _prescriptionRepo.GetByIdWithItemsAsync(bill.PrescriptionId.Value);
                if (prescription != null)
                {
                    prescription.IsPaid = true;
                    await _prescriptionRepo.UpdateAsync(prescription);
                }
            }
        }

        await _repo.UpdateAsync(bill);
        return await PopulatePatientDetailsAsync(Map(bill));
    }

    public async Task<List<BillDto>> GetByPatientAsync(int patientId)
    {
        var bills = await _repo.GetByPatientAsync(patientId);
        var dtos = bills.Select(Map).ToList();
        return await PopulateBatchPatientDetailsAsync(dtos);
    }

    public async Task<List<BillDto>> GetPendingAsync()
    {
        var bills = await _repo.GetPendingAsync();
        var dtos = bills.Select(Map).ToList();
        return await PopulateBatchPatientDetailsAsync(dtos);
    }

    public async Task<List<BillDto>> GetAllAsync()
    {
        var bills = await _repo.GetAllAsync();
        var dtos = bills.Select(Map).ToList();
        return await PopulateBatchPatientDetailsAsync(dtos);
    }

    public async Task<RazorpayOrderResponseDto> CreateRazorpayOrderAsync(int billId)
    {
        var b = await _repo.GetByIdAsync(billId) ?? throw new Exception("Bill not found");
        
        // Fetch Tenant-specific Razorpay Settings from AuthService
        var key = _config["Razorpay:Key"];
        var secret = _config["Razorpay:Secret"];

        try
        {
            var client = _httpClientFactory.CreateClient();
            var res = await client.GetAsync($"http://localhost:5001/api/auth/tenants/{_tenant.TenantId}/settings");
            if (res.IsSuccessStatusCode)
            {
                var settings = await res.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                var tKey = settings.TryGetProperty("razorpayKey", out var pk) ? pk.GetString() : null;
                var tSecret = settings.TryGetProperty("razorpaySecret", out var ps) ? ps.GetString() : null;
                
                if (!string.IsNullOrEmpty(tKey) && !string.IsNullOrEmpty(tSecret))
                {
                    key = tKey;
                    secret = tSecret;
                }
            }
        }
        catch { /* Fallback to global config if auth service is down or not found */ }

        RazorpayClient rzpClient = new RazorpayClient(key, secret);

        if (b.BalanceAmount <= 0) throw new Exception("Bill is already settled");

        Dictionary<string, object> options = new Dictionary<string, object>();
        options.Add("amount", (int)(b.BalanceAmount * 100)); // Amount in paise
        options.Add("currency", "INR");
        options.Add("receipt", $"BILL_{billId}");

        Order order = rzpClient.Order.Create(options);

        return new RazorpayOrderResponseDto
        {
            OrderId = order["id"].ToString(),
            Amount = b.BalanceAmount,
            Currency = "INR",
            KeyId = key!,
            IsMedicine = false // General Bill
        };
    }

    public async Task<bool> VerifyRazorpayPaymentAsync(RazorpayPaymentVerificationDto verificationDto)
    {
        try
        {
            var secret = _config["Razorpay:Secret"];
            
            // Try to get tenant secret for verification
            try
            {
                var client = _httpClientFactory.CreateClient();
                var res = await client.GetAsync($"http://localhost:5001/api/auth/tenants/{_tenant.TenantId}/settings");
                if (res.IsSuccessStatusCode)
                {
                    var settings = await res.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                    var tSecret = settings.TryGetProperty("razorpaySecret", out var ps) ? ps.GetString() : null;
                    if (!string.IsNullOrEmpty(tSecret)) secret = tSecret;
                }
            }
            catch { }

            Dictionary<string, string> attributes = new Dictionary<string, string>();
            attributes.Add("razorpay_order_id", verificationDto.RazorpayOrderId);
            attributes.Add("razorpay_payment_id", verificationDto.RazorpayPaymentId);
            attributes.Add("razorpay_signature", verificationDto.RazorpaySignature);

            Utils.verifyPaymentSignature(attributes);

            await ProcessOnlinePaymentAsync(verificationDto.PrescriptionId); // Using PrescriptionId field for BillId in this context
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    public async Task<BillDto?> GetByIdAsync(int id)
    {
        var b = await _repo.GetByIdAsync(id);
        if (b == null) return null;
        return await PopulatePatientDetailsAsync(Map(b));
    }

    public async Task<BillDto?> GetByPrescriptionIdAsync(int prescriptionId)
    {
        var bills = await _repo.GetPendingAsync();
        var bill = bills.FirstOrDefault(b => b.PrescriptionId == prescriptionId);
        if (bill == null) return null;
        return await PopulatePatientDetailsAsync(Map(bill));
    }

    public async Task<BillDto> ProcessOnlinePaymentAsync(int billId)
    {
        var bill = await _repo.GetByIdAsync(billId)
            ?? throw new Exception("Bill not found");

        if (bill.PaymentStatus == "Paid")
            throw new Exception("Bill is already paid");

        bill.PaidAmount = bill.TotalAmount;
        bill.BalanceAmount = 0;
        bill.PaymentStatus = "Paid";
        bill.PaymentMethod = "Online";
        bill.PaidAt = DateTime.UtcNow;

        if (bill.PrescriptionId.HasValue)
        {
            var prescription = await _prescriptionRepo.GetByIdWithItemsAsync(bill.PrescriptionId.Value);
            if (prescription != null)
            {
                prescription.IsPaid = true;
                await _prescriptionRepo.UpdateAsync(prescription);
            }
        }

        await _repo.UpdateAsync(bill);

        // Stop Reminders
        try { Hangfire.RecurringJob.RemoveIfExists($"payment_reminder_{bill.Id}"); } catch { }
        
        // Notify Receptionist about online payment
        await BroadcastEventAsync("Receptionist", "OnlinePaymentReceived", new {
            BillId = bill.Id,
            PatientId = bill.PatientId,
            PatientName = (await PopulatePatientDetailsAsync(Map(bill))).PatientName,
            Amount = bill.TotalAmount
        });

        return await PopulatePatientDetailsAsync(Map(bill));
    }

    public async Task SendPaymentReminderAsync(int billId)
    {
        var bill = await _repo.GetByIdAsync(billId);
        if (bill == null || bill.PaymentStatus == "Paid")
        {
            Hangfire.RecurringJob.RemoveIfExists($"payment_reminder_{billId}");
            return;
        }

        var client = _httpClientFactory.CreateClient();
        await client.PostAsJsonAsync("http://localhost:5004/api/notifications", new
        {
            UserId = bill.PatientId,
            Title = "💳 Payment Reminder",
            Message = $"Please settle your pending consultation fee of ₹{bill.BalanceAmount} online.",
            Type = "warning",
            RelatedEntityId = bill.Id,
            RelatedEntityType = "Bill"
        });
    }

    private async Task BroadcastEventAsync(string groupName, string eventName, object payload)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var request = new { 
                TenantId = _tenant.TenantId,
                GroupName = groupName, // Controller will prepend Tenant_{Id}_
                EventName = eventName, 
                Payload = payload 
            };
            // Use direct port 5004 for notification broadcast
            await client.PostAsJsonAsync("http://localhost:5004/api/notifications/broadcast", request);
        }
        catch { /* Fire and forget */ }
    }

    private async Task<BillDto> PopulatePatientDetailsAsync(BillDto dto)
    {
        // 1. For guest patients (ID 0), prioritize the name already stored on the bill
        if (dto.PatientId == 0)
        {
            if (string.IsNullOrEmpty(dto.PatientName) || dto.PatientName == "Patient #0")
                dto.PatientName = "Guest Patient";
            
            return dto;
        }

        // 2. For registered patients, default to placeholder and then try to fetch from Auth Service
        if (string.IsNullOrEmpty(dto.PatientName)) 
            dto.PatientName = $"Patient #{dto.PatientId}";
        
        try
        {
            var client = _httpClientFactory.CreateClient();
            var res = await client.GetAsync($"http://localhost:5001/api/auth/users/{dto.PatientId}");
            if (res.IsSuccessStatusCode)
            {
                var user = await res.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                var fullName = user.TryGetProperty("fullName", out var fn) ? fn.GetString() : null;
                if (!string.IsNullOrEmpty(fullName)) dto.PatientName = fullName;

                dto.PatientPhone = user.TryGetProperty("phone", out var p) ? p.GetString() : null;
                if (user.TryGetProperty("dateOfBirth", out var dobProp) && dobProp.ValueKind != System.Text.Json.JsonValueKind.Null)
                {
                    var dobStr = dobProp.GetString();
                    if (!string.IsNullOrEmpty(dobStr))
                    {
                        var dob = DateOnly.Parse(dobStr);
                        int age = DateTime.Today.Year - dob.Year;
                        if (dob > DateOnly.FromDateTime(DateTime.Today.AddYears(-age))) age--;
                        dto.PatientAge = age;
                    }
                }
            }
        }
        catch { /* Fallback remains */ }
        return dto;
    }

    private async Task<List<BillDto>> PopulateBatchPatientDetailsAsync(List<BillDto> dtos)
    {
        var patientIds = dtos.Where(d => d.PatientId > 0).Select(d => d.PatientId).Distinct().ToList();
        if (!patientIds.Any()) return dtos;

        try
        {
            var client = _httpClientFactory.CreateClient();
            var idsParam = string.Join(",", patientIds);
            var res = await client.GetAsync($"http://localhost:5001/api/auth/users/batch?ids={idsParam}");
            
            if (res.IsSuccessStatusCode)
            {
                var users = await res.Content.ReadFromJsonAsync<List<System.Text.Json.JsonElement>>();
                var userMap = users.ToDictionary(
                    u => u.GetProperty("id").GetInt32(),
                    u => u
                );

                foreach (var dto in dtos)
                {
                    if (dto.PatientId == 0)
                    {
                        if (string.IsNullOrEmpty(dto.PatientName) || dto.PatientName == "Patient #0")
                            dto.PatientName = "Guest Patient";
                        continue;
                    }

                    if (userMap.TryGetValue(dto.PatientId, out var user))
                    {
                        var fullName = user.TryGetProperty("fullName", out var fn) ? fn.GetString() : null;
                        if (!string.IsNullOrEmpty(fullName)) dto.PatientName = fullName;

                        dto.PatientPhone = user.TryGetProperty("phone", out var p) ? p.GetString() : null;
                        if (user.TryGetProperty("dateOfBirth", out var dobProp) && dobProp.ValueKind != System.Text.Json.JsonValueKind.Null)
                        {
                            var dobStr = dobProp.GetString();
                            if (!string.IsNullOrEmpty(dobStr))
                            {
                                var dob = DateOnly.Parse(dobStr);
                                int age = DateTime.Today.Year - dob.Year;
                                if (dob > DateOnly.FromDateTime(DateTime.Today.AddYears(-age))) age--;
                                dto.PatientAge = age;
                            }
                        }
                    }
                    else if (string.IsNullOrEmpty(dto.PatientName))
                    {
                        dto.PatientName = $"Patient #{dto.PatientId}";
                    }
                }
            }
        }
        catch { /* Fallback remains */ }

        return dtos;
    }

    private static BillDto Map(Bill b) => new()
    {
        Id                 = b.Id,
        BillNumber         = b.BillNumber,
        PatientId          = b.PatientId,
        PatientName        = b.PatientName ?? string.Empty,
        PatientPhone       = b.PatientPhone,
        PatientAge         = b.PatientAge,
        PrescriptionId     = b.PrescriptionId,
        ConsultationCharge = b.ConsultationCharge,
        MedicineCharge     = b.MedicineCharge,
        LabCharge          = b.LabCharge,
        BedCharge          = b.BedCharge,
        OtherCharges       = b.OtherCharges,
        Discount           = b.Discount,
        TotalAmount        = b.TotalAmount,
        PaidAmount         = b.PaidAmount,
        BalanceAmount      = b.BalanceAmount,
        PaymentStatus      = b.PaymentStatus,
        PaymentMethod      = b.PaymentMethod,
        InsuranceProvider  = b.InsuranceProvider,
        GeneratedAt        = b.GeneratedAt,
        PaidAt             = b.PaidAt
    };
}
