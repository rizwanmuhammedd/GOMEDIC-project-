using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HospitalMS.NotificationService.Infrastructure.Data;
using System.Security.Claims;
using HospitalMS.NotificationService.Domain.Entities;
using HospitalMS.NotificationService.Domain.Interfaces;

namespace HospitalMS.NotificationService.API.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IChatRepository _chatRepo;

    public ChatController(IChatRepository chatRepo)
    {
        _chatRepo = chatRepo;
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] string? patientId)
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? 
                   User.FindFirst("http://schemas.microsoft.com/ws/2008/06/identity/claims/role")?.Value;

        if (role == "Receptionist")
        {
            if (string.IsNullOrEmpty(patientId))
            {
                var patients = await _chatRepo.GetUniquePatientsWithStatsAsync();
                return Ok(patients);
            }

            var history = await _chatRepo.GetHistoryAsync(patientId);
            return Ok(history);
        }
        else
        {
            if (string.IsNullOrEmpty(currentUserId)) return BadRequest();
            var history = await _chatRepo.GetHistoryAsync(currentUserId);
            return Ok(history);
        }
    }

    [HttpPatch("read/{patientId}")]
    public async Task<IActionResult> MarkAsRead(string patientId)
    {
        await _chatRepo.MarkAsReadAsync(patientId);
        return NoContent();
    }

    [HttpPatch("read-hospital/{patientId}")]
    public async Task<IActionResult> MarkHospitalAsRead(string patientId)
    {
        await _chatRepo.MarkHospitalMessagesAsReadAsync(patientId);
        return NoContent();
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? 
                   User.FindFirst("http://schemas.microsoft.com/ws/2008/06/identity/claims/role")?.Value;

        if (role == "Receptionist")
        {
            var count = await _chatRepo.GetTotalUnreadCountAsync(null);
            return Ok(new { count });
        }
        else
        {
            if (string.IsNullOrEmpty(currentUserId)) return BadRequest();
            var count = await _chatRepo.GetTotalUnreadCountAsync(currentUserId);
            return Ok(new { count });
        }
    }
}
