using HospitalMS.AuthService.Domain.Entities;

namespace HospitalMS.AuthService.Domain.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByIdAsync(int id);
    Task<List<User>> GetByIdsAsync(IEnumerable<int> ids);
    Task<List<User>> GetAllAsync();
    Task AddUserAsync(User user);
    Task UpdateAsync(User user);
}