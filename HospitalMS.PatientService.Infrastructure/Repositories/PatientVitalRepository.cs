using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Domain.Interfaces;
using HospitalMS.PatientService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HospitalMS.PatientService.Infrastructure.Repositories;

public class PatientVitalRepository : IPatientVitalRepository
{
    private readonly PatientDbContext _context;
    public PatientVitalRepository(PatientDbContext context) => _context = context;

    public async Task<IEnumerable<PatientVital>> GetByPatientIdAsync(int patientId)
    {
        return await _context.PatientVitals
            .Where(v => v.PatientId == patientId)
            .OrderByDescending(v => v.RecordedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<PatientVital>> GetByAdmissionIdAsync(int admissionId)
    {
        return await _context.PatientVitals
            .Where(v => v.AdmissionId == admissionId)
            .OrderByDescending(v => v.RecordedAt)
            .ToListAsync();
    }

    public async Task<PatientVital> AddAsync(PatientVital vital)
    {
        _context.PatientVitals.Add(vital);
        await _context.SaveChangesAsync();
        return vital;
    }
}
