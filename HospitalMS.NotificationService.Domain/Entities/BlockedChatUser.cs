using System;

namespace HospitalMS.NotificationService.Domain.Entities;

public class BlockedChatUser
{
    public int Id { get; set; }
    public string PatientId { get; set; } = null!;
    public string? PatientName { get; set; }
    public DateTime BlockedAt { get; set; }
    public string? Reason { get; set; }
    public int TenantId { get; set; }
}
