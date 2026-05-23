using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using HospitalMS.AuthService.Application.Interfaces;
using HospitalMS.AuthService.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace HospitalMS.AuthService.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IImageService _imageService;

    public AuthController(IAuthService authService, IImageService imageService)
    {
        _authService = authService;
        _imageService = imageService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDto dto)
    {
        var subdomain = Request.Headers["X-Tenant-Subdomain"].FirstOrDefault();
        var result = await _authService.RegisterAsync(dto, subdomain);
        return Ok(new { message = result });
    }

    [HttpPost("create-staff")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateStaff([FromBody] RegisterRequestDto dto)
    {
        try
        {
            var tenantIdClaim = User.FindFirst("TenantId")?.Value;
            int tenantId = tenantIdClaim != null ? int.Parse(tenantIdClaim) : 1;

            var user = await _authService.CreateStaffAsync(dto, tenantId);
            return Ok(new { 
                id = user.Id, 
                email = user.Email, 
                fullName = user.FullName,
                role = user.Role
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("users")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _authService.GetAllUsersAsync();
        return Ok(users);
    }

    [HttpGet("users/{id}")]
    [AllowAnonymous] // Internal use for other microservices
    public async Task<IActionResult> GetUserById(int id)
    {
        var user = await _authService.GetUserByIdAsync(id);
        if (user == null) return NotFound();
        return Ok(new { 
            id = user.Id, 
            email = user.Email, 
            fullName = user.FullName,
            role = user.Role,
            phone = user.Phone,
            dateOfBirth = user.DateOfBirth,
            profileImageUrl = user.ProfileImageUrl
        });
    }

    [HttpGet("users/batch")]
    [AllowAnonymous]
    public async Task<IActionResult> GetUsersByIds([FromQuery] string ids)
    {
        if (string.IsNullOrEmpty(ids)) return BadRequest();
        var idList = ids.Split(',').Select(int.Parse).ToList();
        var users = await _authService.GetUsersByIdsAsync(idList);
        return Ok(users.Select(user => new {
            id = user.Id,
            email = user.Email,
            fullName = user.FullName,
            role = user.Role,
            phone = user.Phone,
            dateOfBirth = user.DateOfBirth,
            profileImageUrl = user.ProfileImageUrl
        }));
    }

    [HttpGet("tenants/{id}/settings")]
    [AllowAnonymous] // Internal use
    public async Task<IActionResult> GetTenantSettings(int id)
    {
        var tenant = await _authService.GetTenantByIdAsync(id);
        if (tenant == null) return NotFound();
        return Ok(new {
            id = tenant.Id,
            name = tenant.Name,
            razorpayKey = tenant.RazorpayKey,
            razorpaySecret = tenant.RazorpaySecret
        });
    }

    [HttpGet("tenants/resolve/{subdomain}")]
    [AllowAnonymous]
    public async Task<IActionResult> ResolveTenant(string subdomain)
    {
        var tenant = await _authService.GetTenantByIdAsync(0); // Dummy call to get repo via service if needed, but I'll use repo directly if possible or add to service
        // Better: Add ResolveSubdomain to IAuthService
        var t = await _authService.GetTenantBySubdomainAsync(subdomain);
        if (t == null) return NotFound();
        return Ok(new { id = t.Id, name = t.Name, subdomain = t.Subdomain });
    }

    [HttpDelete("users/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeactivateUser(int id)
    {
        await _authService.DeactivateUserAsync(id);
        return NoContent();
    }

    [HttpPost("users/{id}/restore")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RestoreUser(int id)
    {
        await _authService.RestoreUserAsync(id);
        return NoContent();
    }

    [HttpGet("users/role/{role}")]
    [AllowAnonymous] // Internal use
    public async Task<IActionResult> GetUsersByRole(string role)
    {
        var users = await _authService.GetUsersByRoleAsync(role);
        // Only return users who are explicitly Active
        return Ok(users.Where(u => u.IsActive).ToList());
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto)
    {
        try
        {
            var result = await _authService.LoginAsync(dto);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("google-login")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequestDto dto)
    {
        try
        {
            var subdomain = Request.Headers["X-Tenant-Subdomain"].FirstOrDefault();
            var result = await _authService.LoginWithGoogleAsync(dto, subdomain);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenDto dto)
    {
        try
        {
            var result = await _authService.RefreshAsync(dto);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdStr != null)
        {
            await _authService.LogoutAsync(int.Parse(userIdStr));
        }
        return Ok(new { message = "Logged out successfully" });
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
    {
        await _authService.ForgotPasswordAsync(dto);
        return Ok(new { message = "If this email is registered, a reset token has been sent" });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        try
        {
            await _authService.ResetPasswordAsync(dto);
            return Ok(new { message = "Password reset successfully" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        try
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdStr == null) return Unauthorized();
            
            await _authService.ChangePasswordAsync(int.Parse(userIdStr), dto);
            return Ok(new { message = "Password changed successfully" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public class ProfilePictureUploadRequest
    {
        public IFormFile File { get; set; } = null!;
        public bool UpdateProfile { get; set; } = false;
    }

    [HttpPost("upload-picture")]
    [Authorize]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadProfilePicture([FromForm] ProfilePictureUploadRequest request)
    {
        if (request == null || request.File == null || request.File.Length == 0)
            return BadRequest(new { message = "No file uploaded" });

        var file = request.File;
        var allowedTypes = new[] { "image/jpeg", "image/jpg", "image/png" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { message = "Only JPG and PNG files are allowed" });

        if (file.Length > 2 * 1024 * 1024)
            return BadRequest(new { message = "File size must be less than 2MB" });

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdStr == null) return Unauthorized();
        var userId = int.Parse(userIdStr);

        try
        {
            var imageUrl = await _imageService.UploadImageAsync(file, "profile_pictures");
            if (string.IsNullOrEmpty(imageUrl))
                return BadRequest(new { message = "Failed to upload image to Cloudinary" });

            if (request.UpdateProfile)
            {
                await _authService.UpdateProfileImageAsync(userId, imageUrl);
            }
            
            return Ok(new { imageUrl });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("users/{userId:int}/profile-picture")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUserProfilePicture(int userId, [FromBody] UpdateProfilePictureDto dto)
    {
        try
        {
            await _authService.UpdateProfileImageAsync(userId, dto.ImageUrl);
            return Ok(new { imageUrl = dto.ImageUrl });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        try
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdStr == null) return Unauthorized();
            
            await _authService.UpdateProfileAsync(int.Parse(userIdStr), dto);
            return Ok(new { message = "Profile updated successfully" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    public class UpdateProfilePictureDto
    {
        public string ImageUrl { get; set; } = string.Empty;
    }
}
