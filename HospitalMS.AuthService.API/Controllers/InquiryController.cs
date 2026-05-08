using Microsoft.AspNetCore.Mvc;
using HospitalMS.AuthService.Application.Interfaces;
using HospitalMS.AuthService.Application.DTOs;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;

namespace HospitalMS.AuthService.API.Controllers;

[ApiController]
[Route("api/auth/inquiry")]
[AllowAnonymous]
[EnableCors("AllowReact")]
public class InquiryController : ControllerBase
{
    private readonly IEmailService _emailService;
    private readonly IConfiguration _config;

    public InquiryController(IEmailService emailService, IConfiguration config)
    {
        _emailService = emailService;
        _config = config;
    }

    [HttpPost]
    public async Task<IActionResult> SendInquiry([FromBody] InquiryDto dto)
    {
        if (string.IsNullOrEmpty(dto.Email) || string.IsNullOrEmpty(dto.Message))
            return BadRequest(new { message = "Email and Message are required." });

        var adminEmail = _config["SmtpSettings:SenderEmail"] ?? "support@gomedic.com";
        var subject = $"New {dto.InquiryType} from {dto.FullName}";
        var body = $@"
            <div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;'>
                <h2 style='color: #10b981; margin-bottom: 20px;'>New Website Inquiry</h2>
                <div style='background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;'>
                    <p><strong>From:</strong> {dto.FullName} ({dto.Email})</p>
                    <p><strong>Type:</strong> {dto.InquiryType}</p>
                </div>
                <div style='padding: 15px; border: 1px solid #f1f5f9; border-radius: 8px;'>
                    <h4 style='margin-top: 0; color: #64748b;'>Message:</h4>
                    <p style='color: #1e293b; line-height: 1.6;'>{dto.Message}</p>
                </div>
                <p style='margin-top: 30px; font-size: 11px; color: #94a3b8;'>
                    This message was sent via the GOMEDIC Contact Form.
                </p>
            </div>";

        try
        {
            await _emailService.SendEmailAsync(adminEmail, subject, body);
            return Ok(new { message = "Your inquiry has been sent successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to send email.", error = ex.Message });
        }
    }
}
