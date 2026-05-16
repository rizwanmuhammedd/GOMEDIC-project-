using HospitalMS.PatientService.Application.DTOs;
using HospitalMS.PatientService.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HospitalMS.PatientService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // all routes need JWT token
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _svc;
    public AppointmentsController(IAppointmentService svc) => _svc = svc;

    // GET api/appointments — Admin/Receptionist sees all
    [HttpGet]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<IActionResult> GetAll()
    {
        var list = await _svc.GetAllAsync();
        return Ok(list);
    }

    // GET api/appointments/5
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var result = await _svc.GetByIdAsync(id);
        return result == null ? NotFound() : Ok(result);
    }

    // GET api/appointments/my — patient sees own appointments
    [HttpGet("my")]
    [Authorize(Roles = "Patient")]
    public async Task<IActionResult> GetMy()
    {
        // Read patientId from JWT token claims
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        
        int patientId = int.Parse(userIdStr);
        var list = await _svc.GetMyAppointmentsAsync(patientId);
        return Ok(list);
    }

    [HttpGet("patient/{patientId:int}")]
    [Authorize(Roles = "Doctor,Admin,Receptionist")]
    public async Task<IActionResult> GetByPatient(int patientId)
    {
        var list = await _svc.GetByPatientIdAsync(patientId);
        return Ok(list);
    }

    // GET api/appointments/doctor/3
    [HttpGet("doctor/{doctorId:int}")]
    [Authorize(Roles = "Doctor,Admin")]
    public async Task<IActionResult> GetByDoctor(int doctorId)
    {
        var list = await _svc.GetDoctorAppointmentsAsync(doctorId);
        return Ok(list);
    }

    // GET api/appointments/doctor/me — doctor sees own appointments securely
    [HttpGet("doctor/me")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> GetByDoctorMe()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        int userId = int.Parse(userIdStr);
        var list = await _svc.GetByDoctorUserIdAsync(userId);
        return Ok(list);
    }

    // GET api/appointments/slots/3?date=2024-04-05
    [HttpGet("slots/{doctorId:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAvailableSlots(int doctorId, [FromQuery] string date)
    {
        if (!DateOnly.TryParse(date, out var d))
            return BadRequest(new { message = "Invalid date format. Use YYYY-MM-DD." });

        var available = await _svc.GetAvailableSlotsAsync(doctorId, d);

        return Ok(new { date = d, doctorId, availableSlots = available });
    }

    // POST api/appointments — everyone can book (patient for self, staff for others)
    [HttpPost]
    [Authorize(Roles = "Patient,Receptionist,Admin,Doctor,LabTechnician,Pharmacist")]
    public async Task<IActionResult> Book([FromBody] BookAppointmentDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        int loggedInUserId = int.Parse(userIdStr);
        
        // If staff provides a specific PatientId, use it. Otherwise use logged in user's ID (patient booking for self)
        int patientId = (dto.PatientId.HasValue && !User.IsInRole("Patient")) ? dto.PatientId.Value : loggedInUserId;

        try 
        {
            var result = await _svc.BookAsync(patientId, dto);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PUT api/appointments/5 — doctor updates notes/status
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Doctor,Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateAppointmentDto dto)
    {
        await _svc.UpdateAsync(id, dto);
        return NoContent();
    }

    // DELETE api/appointments/5/cancel
    [HttpDelete("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id)
    {
        await _svc.CancelAsync(id);
        return NoContent();
    }
}
