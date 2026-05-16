using HospitalMS.NotificationService.Application.Interfaces;
using HospitalMS.NotificationService.Application.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace HospitalMS.NotificationService.API.Controllers;

public class BroadcastRequest
{
    public string? GroupName { get; set; }
    public string EventName { get; set; } = "ReceiveNotification";
    public object Payload { get; set; } = new { };
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _svc;
    private readonly IHubContext<HospitalHub> _hub;

    public NotificationsController(INotificationService svc, IHubContext<HospitalHub> hub)
    {
        _svc = svc;
        _hub = hub;
    }

    [HttpGet]
    public async Task<IActionResult> GetMy()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        if (!int.TryParse(userIdStr, out int userId)) return BadRequest("Invalid User ID");
        return Ok(await _svc.GetMyNotificationsAsync(userId));
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        if (!int.TryParse(userIdStr, out int userId)) return BadRequest("Invalid User ID");
        return Ok(new { count = await _svc.GetUnreadCountAsync(userId) });
    }

    [HttpPatch("{id}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        await _svc.MarkAsReadAsync(id);
        return NoContent();
    }

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        if (!int.TryParse(userIdStr, out int userId)) return BadRequest("Invalid User ID");
        await _svc.MarkAllAsReadAsync(userId);
        return NoContent();
    }

    public class CreateNotificationRequest
    {
        public int UserId { get; set; }
        public string Title { get; set; }
        public string Message { get; set; }
        public string Type { get; set; }
        public int? RelatedEntityId { get; set; }
        public string? RelatedEntityType { get; set; }
        public string? TargetUrl { get; set; }
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Create([FromBody] CreateNotificationRequest request)
    {
        await _svc.SendAsync(request.UserId, request.Title, request.Message, request.Type, request.RelatedEntityId, request.RelatedEntityType, request.TargetUrl);
        return Ok(new { message = "Notification created and sent" });
    }

    public class RoleNotificationRequest
    {
        public string Role { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string? TargetUrl { get; set; }
    }

    [HttpPost("role")]
    [AllowAnonymous]
    public async Task<IActionResult> SendToRole([FromBody] RoleNotificationRequest request)
    {
        await _svc.SendToRoleAsync(request.Role, request.Title, request.Message, request.Type, targetUrl: request.TargetUrl);
        return Ok(new { message = $"Notifications sent to all {request.Role}s" });
    }

    [HttpPost("broadcast")]
    [AllowAnonymous] // Usually internal, but allowing for dev ease. Secure in production.
    public async Task<IActionResult> Broadcast([FromBody] BroadcastRequest request)
    {
        if (string.IsNullOrEmpty(request.GroupName))
        {
            await _hub.Clients.All.SendAsync(request.EventName, request.Payload);
        }
        else
        {
            await _hub.Clients.Group(request.GroupName).SendAsync(request.EventName, request.Payload);
        }
        return Ok(new { message = "Broadcast sent successfully" });
    }
}
