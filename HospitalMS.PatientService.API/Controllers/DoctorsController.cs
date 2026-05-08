using HospitalMS.PatientService.Application.Interfaces;
using HospitalMS.PatientService.Application.DTOs;
using HospitalMS.PatientService.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HospitalMS.PatientService.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DoctorsController : ControllerBase
{
    private readonly IDoctorService _doctorService;

    public DoctorsController(IDoctorService doctorService)
    {
        _doctorService = doctorService;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var doctors = await _doctorService.GetAllAsync();
        return Ok(doctors);
    }

    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var doctor = await _doctorService.GetByIdAsync(id);
        if (doctor == null)
            return NotFound();
        return Ok(doctor);
    }

    [HttpGet("user/{userId:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetByUserId(int userId)
    {
        var doctor = await _doctorService.GetByUserIdAsync(userId);
        if (doctor == null) return NotFound();
        return Ok(doctor);
    }

    [HttpGet("me")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> GetMyProfile()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        var fullName = User.FindFirstValue("FullName") ?? "Doctor";
        
        var doctor = await _doctorService.GetOrCreateByUserIdAsync(int.Parse(userIdStr), fullName);
        return Ok(doctor);
    }

    [HttpGet("department/{deptId:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetByDepartment(int deptId)
    {
        var doctors = await _doctorService.GetByDepartmentAsync(deptId);
        return Ok(doctors);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateDoctorDto doctor)
    {
        var created = await _doctorService.CreateAsync(doctor);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateDoctorDto doctor)
    {
        if (id != doctor.Id) return BadRequest();
        await _doctorService.UpdateAsync(doctor);
        return NoContent();
    }

    [HttpGet("{id:int}/schedules")]
    [Authorize]
    public async Task<IActionResult> GetSchedules(int id)
    {
        return Ok(await _doctorService.GetSchedulesAsync(id));
    }

    [HttpPost("{id:int}/schedules")]
    [Authorize(Roles = "Doctor,Admin")]
    public async Task<IActionResult> AddSchedule(int id, [FromBody] CreateDoctorScheduleDto dto)
    {
        var created = await _doctorService.AddScheduleAsync(id, dto);
        return Ok(created);
    }

    [HttpPut("schedules/{scheduleId:int}")]
    [Authorize(Roles = "Doctor,Admin")]
    public async Task<IActionResult> UpdateSchedule(int scheduleId, [FromBody] CreateDoctorScheduleDto dto)
    {
        await _doctorService.UpdateScheduleAsync(scheduleId, dto);
        return NoContent();
    }

    [HttpDelete("schedules/{scheduleId:int}")]
    [Authorize(Roles = "Doctor,Admin")]
    public async Task<IActionResult> DeleteSchedule(int scheduleId)
    {
        await _doctorService.DeleteScheduleAsync(scheduleId);
        return NoContent();
    }

    [HttpPatch("profile-picture")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> UpdateProfilePicture([FromBody] UpdateProfilePictureDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        
        var doctor = await _doctorService.GetByUserIdAsync(int.Parse(userIdStr));
        if (doctor == null) return NotFound("Doctor profile not found");

        var updateDto = new UpdateDoctorDto
        {
            Id = doctor.Id,
            FullName = doctor.FullName,
            ProfileImageUrl = dto.ImageUrl,
            DepartmentId = doctor.DepartmentId,
            Specialization = doctor.Specialization,
            Qualification = doctor.Qualification,
            ConsultationFee = doctor.ConsultationFee,
            MaxPatientsPerDay = doctor.MaxPatientsPerDay,
            IsAvailable = doctor.IsAvailable
        };

        await _doctorService.UpdateAsync(updateDto);
        return Ok(new { imageUrl = dto.ImageUrl });
    }

    [HttpPatch("slot-duration")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> UpdateSlotDuration([FromBody] UpdateSlotDurationDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        
        await _doctorService.UpdateSlotDurationAsync(int.Parse(userIdStr), dto.Duration);
        return Ok(new { message = "Slot duration updated successfully" });
    }

    public class UpdateProfilePictureDto
    {
        public string ImageUrl { get; set; } = string.Empty;
    }

    public class UpdateSlotDurationDto
    {
        public int Duration { get; set; }
    }
}
