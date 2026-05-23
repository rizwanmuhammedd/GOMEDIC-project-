using FluentValidation;
using HospitalMS.PatientService.Application.DTOs;

namespace HospitalMS.PatientService.Application.Validators;

public class BookAppointmentValidator : AbstractValidator<BookAppointmentDto>
{
    public BookAppointmentValidator()
    {
        RuleFor(x => x.DoctorId)
            .GreaterThan(0).WithMessage("Valid doctor is required");

        RuleFor(x => x.PatientName)
            .NotEmpty().WithMessage("Patient name is required")
            .MaximumLength(100);

        RuleFor(x => x.PatientAge)
            .InclusiveBetween(0, 150).WithMessage("Valid patient age is required");

        RuleFor(x => x.AppointmentDate)
            .NotEmpty().WithMessage("Appointment date is required")
            .Must(dateStr => 
            {
                if (DateOnly.TryParse(dateStr, out var date))
                {
                    return date >= DateOnly.FromDateTime(DateTime.Today);
                }
                return false;
            })
            .WithMessage("Appointment date must be a valid date in the future or today (YYYY-MM-DD)");

        RuleFor(x => x.ChiefComplaint)
            .MaximumLength(500);
    }
}
