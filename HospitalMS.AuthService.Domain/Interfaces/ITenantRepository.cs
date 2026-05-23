using HospitalMS.AuthService.Domain.Entities;

namespace HospitalMS.AuthService.Domain.Interfaces;

public interface ITenantRepository
{
    Task<Tenant?> GetByIdAsync(int id);
    Task<Tenant?> GetBySubdomainAsync(string subdomain);
    Task<List<Tenant>> GetAllAsync();
    Task AddAsync(Tenant tenant);
    Task UpdateAsync(Tenant tenant);
}