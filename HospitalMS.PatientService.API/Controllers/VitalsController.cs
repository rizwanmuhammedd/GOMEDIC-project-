using HospitalMS.PatientService.Application.DTOs;
using HospitalMS.PatientService.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HospitalMS.PatientService.API.Controllers;

[ApiController]
[Route("api/vitals")]
[Authorize]
public class VitalsController : ControllerBase
{
    private readonly IPatientVitalService _svc;

    public VitalsController(IPatientVitalService svc)
    {
        _svc = svc;
    }

    [HttpGet("patient/{patientId:int}")]
    public async Task<IActionResult> GetByPatient(int patientId)
    {
        return Ok(await _svc.GetByPatientIdAsync(patientId));
    }

    [HttpGet("admission/{admissionId:int}")]
    public async Task<IActionResult> GetByAdmission(int admissionId)
    {
        return Ok(await _svc.GetByAdmissionIdAsync(admissionId));
    }

    [HttpPost]
    [Authorize(Roles = "Doctor,Nurse,Admin,Receptionist")]
    public async Task<IActionResult> Create([FromBody] CreatePatientVitalDto dto)
    {
        var userName = User.FindFirst("FullName")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "System";
        try
        {
            var result = await _svc.CreateAsync(userName, dto);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
