using HospitalMS.PatientService.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HospitalMS.PatientService.Domain.Interfaces;

public interface IDoctorRepository
{
    Task<List<Doctor>> GetAllAsync();
    Task<Doctor?> GetByIdAsync(int id);
    Task<List<Doctor>> GetByDepartmentAsync(int deptId);
    Task<Doctor?> GetByUserIdAsync(int userId);
    Task<List<Doctor>> GetByUserIdsAsync(IEnumerable<int> userIds);
    Task<Doctor> AddAsync(Doctor doctor);
    Task UpdateAsync(Doctor doctor);
}
