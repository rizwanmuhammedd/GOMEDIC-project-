using HospitalMS.AuthService.Domain.Entities;
using HospitalMS.AuthService.Domain.Interfaces;
using HospitalMS.AuthService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HospitalMS.AuthService.Infrastructure.Repositories;

public class TenantRepository : ITenantRepository
{
    private readonly AuthDbContext _context;

    public TenantRepository(AuthDbContext context)
    {
        _context = context;
    }

    public async Task<Tenant?> GetByIdAsync(int id)
    {
        return await _context.Tenants.FirstOrDefaultAsync(t => t.Id == id);
    }

    public async Task<Tenant?> GetBySubdomainAsync(string subdomain)
    {
        return await _context.Tenants.FirstOrDefaultAsync(t => t.Subdomain == subdomain);
    }

    public async Task<List<Tenant>> GetAllAsync()
    {
        return await _context.Tenants.ToListAsync();
    }

    public async Task AddAsync(Tenant tenant)
    {
        await _context.Tenants.AddAsync(tenant);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Tenant tenant)
    {
        _context.Tenants.Update(tenant);
        await _context.SaveChangesAsync();
    }
}