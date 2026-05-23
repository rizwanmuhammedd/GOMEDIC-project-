using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Domain.Interfaces;
using HospitalMS.PatientService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace HospitalMS.PatientService.Infrastructure.Repositories;

public class DoctorRepository : IDoctorRepository
{
    private readonly PatientDbContext _db;
    public DoctorRepository(PatientDbContext db) => _db = db;

    public async Task<List<Doctor>> GetAllAsync()
        => await _db.Doctors.Include(d => d.Department).ToListAsync();

    public async Task<Doctor?> GetByIdAsync(int id)
        => await _db.Doctors
               .Include(d => d.Department)
               .FirstOrDefaultAsync(d => d.Id == id);

    public async Task<List<Doctor>> GetByDepartmentAsync(int deptId)
        => await _db.Doctors
               .Include(d => d.Department)
               .Where(d => d.DepartmentId == deptId)
               .ToListAsync();

    public async Task<Doctor?> GetByUserIdAsync(int userId)
        => await _db.Doctors
               .Include(d => d.Department)
               .FirstOrDefaultAsync(d => d.UserId == userId);

    public async Task<List<Doctor>> GetByUserIdsAsync(IEnumerable<int> userIds)
        => await _db.Doctors
               .Include(d => d.Department)
               .Where(d => userIds.Contains(d.UserId))
               .ToListAsync();

    public async Task<Doctor> AddAsync(Doctor doctor)
    {
        _db.Doctors.Add(doctor);
        await _db.SaveChangesAsync();
        return doctor;
    }

    public async Task UpdateAsync(Doctor doctor)
    {
        _db.Doctors.Update(doctor);
        await _db.SaveChangesAsync();
    }
}
