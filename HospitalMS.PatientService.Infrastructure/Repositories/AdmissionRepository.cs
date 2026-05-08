using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Domain.Interfaces;
using HospitalMS.PatientService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace HospitalMS.PatientService.Infrastructure.Repositories;

public class AdmissionRepository : IAdmissionRepository
{
    private readonly PatientDbContext _db;
    public AdmissionRepository(PatientDbContext db) => _db = db;
    public async Task<List<Admission>> GetAllActiveAsync()
        => await _db.Admissions
            .Where(a => a.Status == "Admitted" || a.Status == "AwaitingBed")
            .Include(a => a.Bed)
            .OrderByDescending(a => a.AdmissionDate)
            .ToListAsync();
    public async Task<Admission?> GetByIdAsync(int id)
        => await _db.Admissions.Include(a => a.Bed).FirstOrDefaultAsync(a => a.Id == id);
    public async Task<List<Admission>> GetByPatientIdAsync(int patientId)
        => await _db.Admissions.Where(a => a.PatientId == patientId)
            .OrderByDescending(a => a.AdmissionDate).ToListAsync();
    public async Task<Admission> AddAsync(Admission a)
        { _db.Admissions.Add(a); await _db.SaveChangesAsync(); return a; }
    public async Task UpdateAsync(Admission a)
        { _db.Admissions.Update(a); await _db.SaveChangesAsync(); }
    public async Task<bool> IsPatientAdmittedAsync(int patientId)
        => await _db.Admissions.AnyAsync(a => a.PatientId == patientId && (a.Status == "Admitted" || a.Status == "AwaitingBed"));
}
