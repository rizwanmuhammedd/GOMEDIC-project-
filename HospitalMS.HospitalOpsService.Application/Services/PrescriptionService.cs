// HospitalMS.HospitalOpsService.Application/Services/PrescriptionService.cs
using HospitalMS.HospitalOpsService.Application.DTOs;
using HospitalMS.HospitalOpsService.Application.Interfaces;
using HospitalMS.HospitalOpsService.Domain.Entities;
using HospitalMS.HospitalOpsService.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Razorpay.Api;
using System.Net.Http.Json;
using Hangfire;

namespace HospitalMS.HospitalOpsService.Application.Services;

public class PrescriptionService : IPrescriptionService
{
    private readonly IPrescriptionRepository _repo;
    private readonly IMedicineRepository _medRepo;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly IBillService _billService;

    public PrescriptionService(IPrescriptionRepository repo,
                                IMedicineRepository medRepo,
                                IHttpClientFactory httpClientFactory,
                                IConfiguration config,
                                IBillService billService)
    { 
        _repo = repo; 
        _medRepo = medRepo; 
        _httpClient = httpClientFactory.CreateClient();
        _config = config;
        _billService = billService;
    }

    // Doctor creates prescription
    public async Task<PrescriptionResponseDto> CreateAsync(
        int doctorId, CreatePrescriptionDto dto)
    {
        if (!dto.Items.Any())
            throw new Exception("Prescription must have at least one medicine");

        // Validate all medicines exist
        foreach (var item in dto.Items)
        {
            var med = await _medRepo.GetByIdAsync(item.MedicineId);
            if (med == null || med.IsActive == false)
                throw new Exception($"Medicine ID {item.MedicineId} not found or inactive");
        }

        // If phone is missing, try to fetch from Appointment service
        var finalPhone = dto.PatientPhone;
        if (string.IsNullOrEmpty(finalPhone) && dto.AppointmentId.HasValue)
        {
            try
            {
                var apptResponse = await _httpClient.GetAsync($"http://localhost:5000/api/appointments/{dto.AppointmentId.Value}");
                if (apptResponse.IsSuccessStatusCode)
                {
                    var apptData = await apptResponse.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                    if (apptData.TryGetProperty("patientPhone", out var phoneProp) || apptData.TryGetProperty("PatientPhone", out phoneProp))
                    {
                        finalPhone = phoneProp.GetString();
                    }
                }
            }
            catch { /* Ignore and keep empty */ }
        }

        var prescription = new Prescription
        {
            PatientId     = dto.PatientId,
            PatientName   = dto.PatientName,
            PatientPhone  = finalPhone,
            DoctorId      = doctorId,
            AppointmentId = dto.AppointmentId,
            Notes         = dto.Notes,
            Status        = "Pending",
            PrescribedAt  = DateTime.UtcNow,
            PrescriptionItems = dto.Items.Select(i => new PrescriptionItem
            {
                MedicineId         = i.MedicineId,
                Dosage             = i.Dosage,
                Frequency          = i.Frequency,
                DurationDays       = i.DurationDays,
                QuantityToDispense = i.QuantityToDispense,
                Instructions       = i.Instructions
            }).ToList()
        };

        var saved = await _repo.AddAsync(prescription);

        // Auto-generate Bill for Consultation Fee
        var mapped = await MapAsync(saved);
        var bill = await _billService.GenerateBillAsync(new GenerateBillDto
        {
            PatientId = saved.PatientId,
            PrescriptionId = saved.Id,
            ConsultationCharge = mapped.ConsultationFee,
            GeneratedByUserId = doctorId // Assigned doctor ID
        });

        // Setup Payment Reminders every 5 minutes
        try
        {
            Hangfire.RecurringJob.AddOrUpdate<IBillService>(
                $"payment_reminder_{bill.Id}",
                svc => svc.SendPaymentReminderAsync(bill.Id),
                "*/5 * * * *" // CRON: Every 5 minutes
            );
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to setup Hangfire reminder: {ex.Message}");
        }
        
        // Notify Patient (Persistent)
        try
        {
            await _httpClient.PostAsJsonAsync("http://localhost:5004/api/notifications", new
            {
                UserId = dto.PatientId,
                Title = "💊 New Prescription Issued",
                Message = $"Doctor has issued a new prescription for you. Please visit the pharmacy.",
                Type = "success",
                RelatedEntityId = saved.Id,
                RelatedEntityType = "Prescription"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to notify Patient: {ex.Message}");
        }

        // Notify Pharmacists (Persistent via Role)
        try
        {
            await _httpClient.PostAsJsonAsync("http://localhost:5004/api/notifications/role", new
            {
                Role = "Pharmacist",
                Title = "🔔 New Prescription Request",
                Message = $"A new prescription (ID: {saved.Id}) is pending for dispensing.",
                Type = "info"
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to notify Pharmacists: {ex.Message}");
        }

        return await MapAsync(saved);
    }

    public async Task<PrescriptionResponseDto> UpdateAsync(int prescriptionId, int doctorId, CreatePrescriptionDto dto)
    {
        var existing = await _repo.GetByIdWithItemsAsync(prescriptionId);
        if (existing == null) throw new Exception("Prescription not found");
        if (existing.DoctorId != doctorId) throw new Exception("You are not authorized to update this prescription");
        if (existing.Status != "Pending") throw new Exception("Only pending prescriptions can be edited");

        if (!dto.Items.Any())
            throw new Exception("Prescription must have at least one medicine");

        // Validate all medicines exist
        foreach (var item in dto.Items)
        {
            var med = await _medRepo.GetByIdAsync(item.MedicineId);
            if (med == null || med.IsActive == false)
                throw new Exception($"Medicine ID {item.MedicineId} not found or inactive");
        }

        existing.Notes = dto.Notes;
        existing.PatientName = dto.PatientName;
        existing.PatientPhone = dto.PatientPhone;

        // Update items
        existing.PrescriptionItems.Clear();
        foreach (var i in dto.Items)
        {
            existing.PrescriptionItems.Add(new PrescriptionItem
            {
                MedicineId = i.MedicineId,
                Dosage = i.Dosage,
                Frequency = i.Frequency,
                DurationDays = i.DurationDays,
                QuantityToDispense = i.QuantityToDispense,
                Instructions = i.Instructions
            });
        }

        await _repo.UpdateAsync(existing);
        return await MapAsync(existing);
    }

    // Pharmacist dispenses prescription
    public async Task<PrescriptionResponseDto> DispenseAsync(
        int prescriptionId, int pharmacistId)
    {
        var prescription = await _repo.GetByIdWithItemsAsync(prescriptionId);
        if (prescription == null)
            throw new Exception("Prescription not found");
        if (prescription.Status == "Dispensed")
            throw new Exception("Prescription already dispensed");

        // Deduct stock ONLY for available medicines
        foreach (var item in prescription.PrescriptionItems)
        {
            var med = await _medRepo.GetByIdAsync(item.MedicineId);
            if (med != null && med.StockQuantity >= item.QuantityToDispense)
            {
                int newStock = med.StockQuantity - item.QuantityToDispense;
                await _medRepo.UpdateStockAsync(med.Id, newStock);

                // Check for low stock after deduction
                if (newStock <= med.MinimumStockLevel)
                {
                    try
                    {
                        await _httpClient.PostAsJsonAsync("http://localhost:5004/api/notifications/role", new
                        {
                            Role = "Pharmacist",
                            Title = "⚠ Low Stock Alert",
                            Message = $"Medicine '{med.Name}' is low on stock ({newStock} units left).",
                            Type = "warning"
                        });
                    }
                    catch { /* Ignore notification failures */ }
                }
            }
        }

        // Mark prescription as dispensed
        prescription.Status                = "Dispensed";
        prescription.DispensingAt          = DateTime.UtcNow;
        prescription.DispensingPharmacistId = pharmacistId;
        await _repo.UpdateAsync(prescription);

        return await MapAsync(prescription);
    }

    public async Task<PrescriptionResponseDto> PayAsync(int prescriptionId)
    {
        var p = await _repo.GetByIdWithItemsAsync(prescriptionId) ?? throw new Exception("Prescription not found");
        p.IsPaid = true;
        await _repo.UpdateAsync(p);
        return await MapAsync(p);
    }

    public async Task<PrescriptionResponseDto> PayMedicineAsync(int prescriptionId)
    {
        var p = await _repo.GetByIdWithItemsAsync(prescriptionId) ?? throw new Exception("Prescription not found");
        p.IsMedicinePaid = true;
        await _repo.UpdateAsync(p);
        return await MapAsync(p);
    }

    public async Task<PrescriptionResponseDto> DismissMedicinePaymentAsync(int prescriptionId)
    {
        var p = await _repo.GetByIdWithItemsAsync(prescriptionId) ?? throw new Exception("Prescription not found");
        p.IsMedicinePaymentDismissed = true;
        await _repo.UpdateAsync(p);
        return await MapAsync(p);
    }

    public async Task<List<PrescriptionResponseDto>> GetPendingAsync()
    {
        var list = await _repo.GetPendingAsync();
        var result = new List<PrescriptionResponseDto>();
        foreach (var p in list) result.Add(await MapAsync(p));
        return result;
    }

    public async Task<List<PrescriptionResponseDto>> GetByPatientAsync(int patientId)
    {
        var list = await _repo.GetByPatientAsync(patientId);
        var result = new List<PrescriptionResponseDto>();
        foreach (var p in list) result.Add(await MapAsync(p));
        return result;
    }

    public async Task<List<PrescriptionResponseDto>> GetByDoctorAsync(int doctorId)
    {
        var list = await _repo.GetByDoctorAsync(doctorId);
        var result = new List<PrescriptionResponseDto>();
        foreach (var p in list) result.Add(await MapAsync(p));
        return result;
    }

    public async Task<RazorpayOrderResponseDto> CreateRazorpayOrderAsync(int prescriptionId, bool isMedicine = false)
    {
        var dto = await MapAsync(await _repo.GetByIdWithItemsAsync(prescriptionId) ?? throw new Exception("Prescription not found"));
        
        var key = _config["Razorpay:Key"];
        var secret = _config["Razorpay:Secret"];
        
        RazorpayClient client = new RazorpayClient(key, secret);

        decimal amountToPay = isMedicine ? dto.TotalCost : dto.ConsultationFee;
        if (amountToPay <= 0) throw new Exception("Amount must be greater than zero");

        Dictionary<string, object> options = new Dictionary<string, object>();
        options.Add("amount", (int)(amountToPay * 100)); // Amount in paise
        options.Add("currency", "INR");
        options.Add("receipt", $"{(isMedicine ? "MED" : "CON")}_{prescriptionId}");

        Order order = client.Order.Create(options);

        return new RazorpayOrderResponseDto
        {
            OrderId = order["id"].ToString(),
            Amount = amountToPay,
            Currency = "INR",
            KeyId = key!,
            IsMedicine = isMedicine
        };
    }

    public async Task<bool> VerifyRazorpayPaymentAsync(RazorpayPaymentVerificationDto verificationDto)
    {
        try
        {
            var secret = _config["Razorpay:Secret"];
            
            Dictionary<string, string> attributes = new Dictionary<string, string>();
            attributes.Add("razorpay_order_id", verificationDto.RazorpayOrderId);
            attributes.Add("razorpay_payment_id", verificationDto.RazorpayPaymentId);
            attributes.Add("razorpay_signature", verificationDto.RazorpaySignature);

            Utils.verifyPaymentSignature(attributes);

            // If verification succeeds, mark the correct fee as paid
            if (verificationDto.IsMedicine)
            {
                await PayMedicineAsync(verificationDto.PrescriptionId);
            }
            else
            {
                await PayAsync(verificationDto.PrescriptionId);
            }
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    private async Task<PrescriptionResponseDto> MapAsync(Prescription p)
    {
        var items = new List<PrescriptionItemResponseDto>();
        decimal total = 0;

        if (p.PrescriptionItems != null)
        {
            foreach (var item in p.PrescriptionItems)
            {
                var med = item.Medicine ?? (item.MedicineId > 0 ? await _medRepo.GetByIdAsync(item.MedicineId) : null);
                var unitPrice = med?.UnitPrice ?? 0;
                var lineTotal = unitPrice * item.QuantityToDispense;
                
                bool isOutOfStock = med == null || med.StockQuantity < item.QuantityToDispense;
                
                // Patient only pays for available medicine
                if (!isOutOfStock)
                {
                    total += lineTotal;
                }

                items.Add(new PrescriptionItemResponseDto
                {
                    MedicineId         = item.MedicineId,
                    MedicineName       = med?.Name ?? "Unknown",
                    Dosage             = item.Dosage ?? "",
                    Frequency          = item.Frequency ?? "",
                    DurationDays       = item.DurationDays,
                    QuantityToDispense = item.QuantityToDispense,
                    Instructions       = item.Instructions ?? "",
                    UnitPrice          = unitPrice,
                    LineTotal          = lineTotal,
                    IsOutOfStock       = isOutOfStock
                });
            }
        }

        // Fetch Real Doctor Details from PatientService
        string doctorName = "Medical Specialist";
        decimal consultationFee = 500; // Default fallback
        try
        {
            // Note: DoctorId in Prescription IS the UserId from the claim
            // We use the new dedicated endpoint: api/Doctors/user/{userId}
            var response = await _httpClient.GetAsync($"http://localhost:5000/api/doctors/user/{p.DoctorId}");
            if (response.IsSuccessStatusCode)
            {
                var docData = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                if (docData.ValueKind != System.Text.Json.JsonValueKind.Null && (docData.TryGetProperty("fullName", out var nameProp) || docData.TryGetProperty("FullName", out nameProp)))
                {
                    doctorName = nameProp.GetString() ?? "Medical Specialist";
                }
                
                if (docData.ValueKind != System.Text.Json.JsonValueKind.Null && (docData.TryGetProperty("consultationFee", out var feeProp) || docData.TryGetProperty("ConsultationFee", out feeProp)))
                {
                    consultationFee = feeProp.GetDecimal();
                }
            }
        }
        catch { /* Fallback */ }

        return new PrescriptionResponseDto
        {
            Id           = p.Id,
            PatientId    = p.PatientId,
            PatientName  = p.PatientName,
            PatientPhone = p.PatientPhone,
            DoctorId     = p.DoctorId,
            DoctorName   = doctorName,
            ConsultationFee = consultationFee,
            Status       = p.Status,
            PrescribedAt = p.PrescribedAt,
            DispensingAt = p.DispensingAt,
            IsPaid       = p.IsPaid,
            IsMedicinePaid = p.IsMedicinePaid,
            IsMedicinePaymentDismissed = p.IsMedicinePaymentDismissed,
            Notes        = p.Notes,
            Items        = items,
            TotalCost    = total
        };
    }
}
