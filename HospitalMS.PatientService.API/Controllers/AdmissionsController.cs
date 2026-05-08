using HospitalMS.PatientService.Application.DTOs;
using HospitalMS.PatientService.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace HospitalMS.PatientService.API.Controllers;

[ApiController]
[Route("api/admissions")]
[Authorize]
public class AdmissionsController : ControllerBase
{
    private readonly IAdmissionService _svc;
    public AdmissionsController(IAdmissionService svc) => _svc = svc;
    
    [HttpGet]
    [Authorize(Roles = "Admin,Receptionist,Doctor")]
    public async Task<IActionResult> GetActive()
        => Ok(await _svc.GetAllActiveAsync());

    [HttpGet("pending")]
    [Authorize(Roles = "Admin,Receptionist")]
    public async Task<IActionResult> GetPending()
        => Ok(await _svc.GetPendingAdmissionsAsync());
        
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    { 
        var r = await _svc.GetByIdAsync(id); 
        return r == null ? NotFound() : Ok(r); 
    }
    
    [HttpGet("patient/{patientId:int}")]
    public async Task<IActionResult> GetByPatient(int patientId)
        => Ok(await _svc.GetByPatientIdAsync(patientId));
        
    [HttpPost]
    [Authorize(Roles = "Doctor,Admin")]
    public async Task<IActionResult> Admit([FromBody] AdmitPatientDto dto)
    {
        try { return Ok(await _svc.AdmitPatientAsync(dto)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPatch("{id:int}/assign-bed/{bedId:int}")]
    [Authorize(Roles = "Receptionist,Admin")]
    public async Task<IActionResult> AssignBed(int id, int bedId)
    {
        try { return Ok(await _svc.AssignBedAsync(id, bedId)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }
    
    [HttpPut("{id:int}/discharge")]
    [Authorize(Roles = "Doctor,Admin,Receptionist")]
    public async Task<IActionResult> Discharge(int id, [FromBody] DischargePatientDto dto)
    {
        try { return Ok(await _svc.DischargePatientAsync(id, dto)); }
        catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
    }
}
