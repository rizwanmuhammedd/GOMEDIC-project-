using HospitalMS.HospitalOpsService.Application.DTOs;
using HospitalMS.HospitalOpsService.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
namespace HospitalMS.HospitalOpsService.API.Controllers;

[ApiController]
[Route("api/prescriptions")]
[Authorize]
public class PrescriptionsController : ControllerBase
{
    private readonly IPrescriptionService _svc;
    public PrescriptionsController(IPrescriptionService svc) => _svc = svc;

    // Pharmacist sees pending queue
    [HttpGet("pending")]
    [Authorize(Roles = "Pharmacist,Admin,Receptionist")]
    public async Task<IActionResult> GetPending()
        => Ok(await _svc.GetPendingAsync());

    // Patient sees their prescriptions
    [HttpGet("patient/{patientId}")]
    public async Task<IActionResult> GetByPatient(int patientId)
        => Ok(await _svc.GetByPatientAsync(patientId));

    // Doctor sees their prescriptions
    [HttpGet("doctor")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> GetByDoctor()
    {
        var doctorId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        return Ok(await _svc.GetByDoctorAsync(doctorId));
    }

    // Doctor creates prescription
    [HttpPost]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> Create([FromBody] CreatePrescriptionDto dto)
    {
        var doctorId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        try { return Ok(await _svc.CreateAsync(doctorId, dto)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    // Doctor updates prescription
    [HttpPut("{id}")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> Update(int id, [FromBody] CreatePrescriptionDto dto)
    {
        var doctorId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        try { return Ok(await _svc.UpdateAsync(id, doctorId, dto)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    // Pharmacist dispenses
    [HttpPatch("{id}/dispense")]
    [Authorize(Roles = "Pharmacist")]
    public async Task<IActionResult> Dispense(int id)
    {
        var pharmacistId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        try { return Ok(await _svc.DispenseAsync(id, pharmacistId)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    // Patient pays for prescription (Old manual way - kept for fallback/admin)
    [HttpPatch("{id}/pay")]
    public async Task<IActionResult> Pay(int id)
    {
        try { return Ok(await _svc.PayAsync(id)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{id}/create-razorpay-order")]
    public async Task<IActionResult> CreateRazorpayOrder(int id, [FromQuery] bool isMedicine = false)
    {
        try { return Ok(await _svc.CreateRazorpayOrderAsync(id, isMedicine)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("verify-razorpay-payment")]
    public async Task<IActionResult> VerifyRazorpayPayment([FromBody] RazorpayPaymentVerificationDto dto)
    {
        try
        {
            var success = await _svc.VerifyRazorpayPaymentAsync(dto);
            if (success) return Ok(new { message = "Payment verified successfully" });
            return BadRequest(new { message = "Payment verification failed" });
        }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPatch("{id}/dismiss-medicine-payment")]
    public async Task<IActionResult> DismissMedicinePayment(int id)
    {
        try { return Ok(await _svc.DismissMedicinePaymentAsync(id)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }
}
