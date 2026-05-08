using HospitalMS.HospitalOpsService.Application.DTOs;
using HospitalMS.HospitalOpsService.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
namespace HospitalMS.HospitalOpsService.API.Controllers;

[ApiController]
[Route("api/bills")]
[Authorize]
public class BillsController : ControllerBase
{
    private readonly IBillService _svc;
    public BillsController(IBillService svc) => _svc = svc;

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var b = await _svc.GetByIdAsync(id);
        return b == null ? NotFound() : Ok(b);
    }

    [HttpGet("patient/{patientId}")]
    public async Task<IActionResult> GetByPatient(int patientId)
        => Ok(await _svc.GetByPatientAsync(patientId));

    [HttpGet("pending")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<IActionResult> GetPending()
        => Ok(await _svc.GetPendingAsync());

    // Receptionist generates bill
    [HttpPost]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<IActionResult> Generate([FromBody] GenerateBillDto dto)
    {
        var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdString == null) return Unauthorized();
        var userId = int.Parse(userIdString);
        dto.GeneratedByUserId = userId;
        try { return Ok(await _svc.GenerateBillAsync(dto)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    // Receptionist records payment
    [HttpPost("{id}/payment")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<IActionResult> RecordPayment(int id, [FromBody] RecordPaymentDto dto)
    {
        try { return Ok(await _svc.RecordPaymentAsync(id, dto)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    // Patient pays online
    [HttpPost("{id}/pay-online")]
    [Authorize]
    public async Task<IActionResult> PayOnline(int id)
    {
        try { return Ok(await _svc.ProcessOnlinePaymentAsync(id)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{id}/create-razorpay-order")]
    [Authorize]
    public async Task<IActionResult> CreateRazorpayOrder(int id)
    {
        try { return Ok(await _svc.CreateRazorpayOrderAsync(id)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("verify-razorpay-payment")]
    [Authorize]
    public async Task<IActionResult> VerifyRazorpayPayment([FromBody] RazorpayPaymentVerificationDto dto)
    {
        // Note: dto.PrescriptionId is being used as BillId in the shared DTO for simplicity
        var success = await _svc.VerifyRazorpayPaymentAsync(dto);
        if (success) return Ok(new { message = "Payment verified successfully" });
        return BadRequest(new { message = "Invalid payment signature" });
    }
}
