namespace HospitalMS.AuthService.Application.DTOs;

public class InquiryDto
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string InquiryType { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
