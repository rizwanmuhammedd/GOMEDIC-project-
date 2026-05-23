using System.Security.Claims;
using HospitalMS.HospitalOpsService.Domain.Interfaces;
using Microsoft.AspNetCore.Http;

namespace HospitalMS.HospitalOpsService.Application.Services;

public class TenantProvider : ITenantProvider
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TenantProvider(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public int TenantId
    {
        get
        {
            // 1. Check JWT Claim (Most Secure)
            var tenantIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("TenantId");
            if (tenantIdClaim != null && int.TryParse(tenantIdClaim.Value, out int tenantId))
            {
                return tenantId;
            }

            // 2. Check Header (For Public/Anonymous Landing Pages)
            var headerValue = _httpContextAccessor.HttpContext?.Request.Headers["X-Tenant-Id"].FirstOrDefault();
            if (!string.IsNullOrEmpty(headerValue) && int.TryParse(headerValue, out int headerTenantId))
            {
                return headerTenantId;
            }

            return 1; // Default/fallback tenant
        }
    }
}
