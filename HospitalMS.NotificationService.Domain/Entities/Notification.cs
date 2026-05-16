using System;
using System.Collections.Generic;

namespace HospitalMS.NotificationService.Domain.Entities; 
public partial class Notification
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string Title { get; set; } = null!;

    public string Message { get; set; } = null!;

    public string Type { get; set; } = null!;

    public string Channel { get; set; } = null!;

    public bool IsRead { get; set; }

    public int? RelatedEntityId { get; set; }

    public string? RelatedEntityType { get; set; }

    public string? TargetUrl { get; set; }

    public DateTime SentAt { get; set; }

    public DateTime? ReadAt { get; set; }
    public int TenantId { get; set; }
}
