using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using HospitalMS.NotificationService.Domain.Entities;
using HospitalMS.NotificationService.Domain.Interfaces;

namespace HospitalMS.NotificationService.Application.Hubs;

[Authorize]
public class HospitalHub : Hub
{
    private readonly IChatRepository _chatRepo;

    public HospitalHub(IChatRepository chatRepo)
    {
        _chatRepo = chatRepo;
    }

    public override async Task OnConnectedAsync()
    {
        // Try multiple claim types for role and tenant to be robust
        var role = Context.User?.FindFirst(ClaimTypes.Role)?.Value ?? 
                   Context.User?.FindFirst("http://schemas.microsoft.com/ws/2008/06/identity/claims/role")?.Value ??
                   Context.User?.FindFirst("role")?.Value ?? "Patient";
                   
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
                     Context.User?.FindFirst("sub")?.Value;

        var tenantIdStr = Context.User?.FindFirst("TenantId")?.Value ?? "1";

        // Join tenant-scoped role group (e.g., Tenant_1_Receptionist)
        await Groups.AddToGroupAsync(Context.ConnectionId, $"Tenant_{tenantIdStr}_{role}");
        
        // Join tenant-scoped private group for their specific user ID
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Tenant_{tenantIdStr}_user_{userId}");
        }

        await base.OnConnectedAsync();
    }

    private string GetTenantId() => Context.User?.FindFirst("TenantId")?.Value ?? "1";

    // Patient sends enquiry to all receptionists in THEIR hospital
    public async Task SendEnquiry(string patientName, string message)
    {
        var patientId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? 
                        Context.User?.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(patientId)) return;
        var tenantId = GetTenantId();

        // Check if blocked
        if (await _chatRepo.IsUserBlockedAsync(patientId))
        {
            await Clients.Caller.SendAsync("ReceiveError", "You have been blocked from sending enquiries.");
            return;
        }

        // 1. Enforce Minute Rate Limit (5 messages per minute)
        var recentCount = await _chatRepo.GetRecentMessageCountAsync(patientId, 1);
        if (recentCount >= 5)
        {
            await Clients.Caller.SendAsync("ReceiveError", "Rate limit exceeded: Please wait a minute before sending more messages (Limit: 5/min).");
            return;
        }

        var msg = new ChatMessage
        {
            PatientId = patientId,
            PatientName = patientName,
            Message = message,
            Timestamp = DateTime.UtcNow,
            IsFromPatient = true,
            TenantId = int.Parse(tenantId)
        };

        await _chatRepo.AddMessageAsync(msg);
                        
        var enquiry = new { 
            Id = msg.Id,
            PatientId = patientId, 
            PatientName = patientName, 
            Message = message, 
            Timestamp = msg.Timestamp,
            IsFromPatient = true
        };

        // Notify all receptionists in the SAME hospital
        await Clients.Group($"Tenant_{tenantId}_Receptionist").SendAsync("ReceiveEnquiry", enquiry);
        
        // Echo to patient's OTHER connections only
        await Clients.OthersInGroup($"Tenant_{tenantId}_user_{patientId}").SendAsync("ReceiveEnquiry", enquiry);
    }

    [Authorize(Roles = "Receptionist,Admin")]
    public async Task BlockUser(string patientId, string? patientName, string? reason)
    {
        var tenantId = GetTenantId();
        await _chatRepo.BlockUserAsync(patientId, patientName, reason);
        await Clients.Group($"Tenant_{tenantId}_user_{patientId}").SendAsync("UserBlocked", reason);
        
        // Notify other receptionists in the SAME hospital
        await Clients.Group($"Tenant_{tenantId}_Receptionist").SendAsync("PatientBlockedStatusChanged", new { PatientId = patientId, IsBlocked = true });
    }

    [Authorize(Roles = "Receptionist,Admin")]
    public async Task UnblockUser(string patientId)
    {
        var tenantId = GetTenantId();
        await _chatRepo.UnblockUserAsync(patientId);
        await Clients.Group($"Tenant_{tenantId}_user_{patientId}").SendAsync("UserUnblocked");

        // Notify other receptionists in the SAME hospital
        await Clients.Group($"Tenant_{tenantId}_Receptionist").SendAsync("PatientBlockedStatusChanged", new { PatientId = patientId, IsBlocked = false });
    }

    // Receptionist replies to a specific patient
    public async Task ReplyEnquiry(string patientId, string message)
    {
        var receptionistName = Context.User?.FindFirst("FullName")?.Value ?? 
                               Context.User?.Identity?.Name ?? "Receptionist";
        var tenantId = GetTenantId();

        var msg = new ChatMessage
        {
            PatientId = patientId,
            ReceptionistName = receptionistName,
            Message = message,
            Timestamp = DateTime.UtcNow,
            IsFromPatient = false,
            TenantId = int.Parse(tenantId)
        };

        await _chatRepo.AddMessageAsync(msg);
                               
        var reply = new { 
            Id = msg.Id,
            PatientId = patientId, 
            ReceptionistName = receptionistName, 
            Message = message, 
            Timestamp = msg.Timestamp,
            IsFromPatient = false
        };

        // Notify the specific patient in the SAME hospital
        await Clients.Group($"Tenant_{tenantId}_user_{patientId}").SendAsync("ReceiveEnquiry", reply);
        
        // Notify other receptionists in the SAME hospital
        await Clients.OthersInGroup($"Tenant_{tenantId}_Receptionist").SendAsync("ReceiveEnquiry", reply);
    }

    // Example: Allow client to send message to a specific user (if needed)
    public async Task SendMessageToUser(string userId, string message)
    {
        var tenantId = GetTenantId();
        await Clients.Group($"Tenant_{tenantId}_user_{userId}").SendAsync("ReceiveMessage", Context.User?.Identity?.Name, message);
    }
}
