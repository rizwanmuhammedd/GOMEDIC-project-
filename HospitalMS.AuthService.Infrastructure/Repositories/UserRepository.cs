using HospitalMS.AuthService.Domain.Interfaces;
using HospitalMS.AuthService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using HospitalMS.AuthService.Infrastructure.Data;
namespace HospitalMS.AuthService.Infrastructure.Repositories; 
public class UserRepository : IUserRepository
{
    private readonly AuthDbContext _context;

    public UserRepository(AuthDbContext context)
    {
        _context = context;
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        return await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == email);
    }

    public async Task<User?> GetByIdAsync(int id)
    {
        return await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
    }

    public async Task<List<User>> GetByIdsAsync(IEnumerable<int> ids)
    {
        return await _context.Users.IgnoreQueryFilters()
            .Where(u => ids.Contains(u.Id))
            .ToListAsync();
    }

    public async Task<List<User>> GetAllAsync()
    {
        return await _context.Users.IgnoreQueryFilters().ToListAsync();
    }

    public async Task AddUserAsync(User user)
    {
        await _context.Users.AddAsync(user);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(User user)
    {
        _context.Users.Update(user);
        await _context.SaveChangesAsync();
    }
}