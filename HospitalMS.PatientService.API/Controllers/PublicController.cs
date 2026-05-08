using Microsoft.AspNetCore.Mvc;
using HospitalMS.PatientService.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using HospitalMS.PatientService.Infrastructure.Data;

namespace HospitalMS.PatientService.API.Controllers;

[ApiController]
[Route("api/public")]
[AllowAnonymous]
public class PublicController : ControllerBase
{
    private readonly PatientDbContext _context;

    public PublicController(PatientDbContext context)
    {
        _context = context;
    }

    [HttpGet("stats")]
    public IActionResult GetPublicStats()
    {
        // ... (existing logic)
        return Ok(new { /*...*/ });
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments()
    {
        var depts = await _context.Departments
            .Where(d => d.IsActive)
            .Select(d => new { d.Id, d.Name, d.Description, d.FloorNumber })
            .ToListAsync();
        return Ok(depts);
    }
}
