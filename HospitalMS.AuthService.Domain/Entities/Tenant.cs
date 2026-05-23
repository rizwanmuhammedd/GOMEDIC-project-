using System;

namespace HospitalMS.AuthService.Domain.Entities;

public class Tenant
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Subdomain { get; set; }
    public string? RazorpayKey { get; set; }
    public string? RazorpaySecret { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
