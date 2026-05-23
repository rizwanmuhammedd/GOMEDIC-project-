using HospitalMS.AuthService.Domain.Interfaces;
using HospitalMS.AuthService.Domain.Entities;
using HospitalMS.AuthService.Application.Interfaces;
using HospitalMS.AuthService.Application.DTOs;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Google.Apis.Auth;

namespace HospitalMS.AuthService.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepo;
    private readonly ITenantRepository _tenantRepo;
    private readonly IConfiguration _config;
    private readonly IEmailService _emailService;

    public AuthService(IUserRepository userRepo, ITenantRepository tenantRepo, IConfiguration config, IEmailService emailService)
    {
        _userRepo = userRepo;
        _tenantRepo = tenantRepo;
        _config = config;
        _emailService = emailService;
    }

    public async Task<Tenant?> GetTenantByIdAsync(int tenantId)
    {
        return await _tenantRepo.GetByIdAsync(tenantId);
    }

    public async Task<Tenant?> GetTenantBySubdomainAsync(string subdomain)
    {
        return await _tenantRepo.GetBySubdomainAsync(subdomain);
    }

    public async Task<string> RegisterAsync(RegisterRequestDto dto, string? subdomain = null)
    {
        var existing = await _userRepo.GetByEmailAsync(dto.Email);
        if (existing != null)
            return "User already exists";

        int tenantId = 1; // Default
        if (!string.IsNullOrEmpty(subdomain))
        {
            var tenant = await _tenantRepo.GetBySubdomainAsync(subdomain);
            if (tenant != null) tenantId = tenant.Id;
        }

        var user = new User
        {
            FullName = dto.FullName,
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Role = "Patient", // Always default to Patient for public registration
            Phone = string.IsNullOrEmpty(dto.Phone) ? "0000000000" : dto.Phone,
            DateOfBirth = dto.DateOfBirth,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            TenantId = tenantId
        };

        await _userRepo.AddUserAsync(user);
        return "Registered successfully";
    }

    public async Task<User> CreateStaffAsync(RegisterRequestDto dto, int tenantId)
    {
        var existing = await _userRepo.GetByEmailAsync(dto.Email);
        if (existing != null)
            throw new Exception("Email already registered");

        var user = new User
        {
            FullName = dto.FullName,
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Role = dto.Role ?? "Doctor", // Admin can specify the role
            Phone = dto.Phone ?? "0000000000",
            DateOfBirth = dto.DateOfBirth,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            TenantId = tenantId
        };

        await _userRepo.AddUserAsync(user);
        return user;
    }

    public async Task<List<User>> GetAllUsersAsync()
    {
        return await _userRepo.GetAllAsync();
    }

    public async Task<List<User>> GetUsersByRoleAsync(string role)
    {
        var all = await _userRepo.GetAllAsync();
        return all.Where(u => u.Role.Equals(role, StringComparison.OrdinalIgnoreCase)).ToList();
    }

    public async Task<AuthResponseDto> LoginAsync(LoginRequestDto dto)
    {
        var user = await _userRepo.GetByEmailAsync(dto.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            throw new Exception("Invalid email or password");

        // Robust Migration: If account is inactive but appears to be uninitialized (TenantId 0 or null UpdatedAt),
        // it's an existing legacy account. Auto-activate it so the user isn't locked out.
        if (user.IsActive == false && (user.UpdatedAt == null || user.TenantId == 0))
        {
            user.IsActive = true;
            user.UpdatedAt = DateTime.UtcNow;
            if (user.TenantId == 0) user.TenantId = 1;
            await _userRepo.UpdateAsync(user);
        }

        if (!user.IsActive)
            throw new Exception("Your account has been deactivated. Please contact administration.");

        var response = BuildResponse(user);
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user);
        return response;
    }

    public async Task<AuthResponseDto> RefreshAsync(RefreshTokenDto dto)
    {
        var principal = GetPrincipalFromExpiredToken(dto.AccessToken);
        var userIdStr = principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdStr == null) throw new Exception("Invalid token");

        var user = await _userRepo.GetByIdAsync(int.Parse(userIdStr));
        if (user == null || user.RefreshToken != dto.RefreshToken)
            throw new Exception("Invalid refresh token");

        if (user.RefreshTokenExpiry < DateTime.UtcNow)
            throw new Exception("Refresh token expired — please login again");

        var response = BuildResponse(user);
        await _userRepo.UpdateAsync(user);
        return response;
    }

    public async Task LogoutAsync(int userId)
    {
        var user = await _userRepo.GetByIdAsync(userId);
        if (user != null)
        {
            user.RefreshToken = null;
            user.RefreshTokenExpiry = null;
            await _userRepo.UpdateAsync(user);
        }
    }

    public async Task ForgotPasswordAsync(ForgotPasswordDto dto)
    {
        var user = await _userRepo.GetByEmailAsync(dto.Email.ToLower());
        if (user == null) return;

        var token = new Random().Next(100000, 999999).ToString();
        var expiry = DateTime.UtcNow.AddMinutes(15);

        user.PasswordResetToken = token;
        user.PasswordResetExpiry = expiry;
        await _userRepo.UpdateAsync(user);

        var subject = "Password Reset Token - HealthBridge HMS";
        var body = $@"
            <div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;'>
                <h2 style='color: #2563eb;'>HealthBridge HMS</h2>
                <p>Hello {user.FullName},</p>
                <p>You requested to reset your password. Please use the following 6-digit token to proceed:</p>
                <div style='font-size: 24px; font-weight: bold; color: #1e293b; padding: 10px; background: #f1f5f9; border-radius: 5px; display: inline-block;'>
                    {token}
                </div>
                <p style='margin-top: 20px; color: #64748b; font-size: 12px;'>
                    This token is valid for 15 minutes. If you did not request this, please ignore this email.
                </p>
            </div>";

        await _emailService.SendEmailAsync(user.Email, subject, body);

        Console.WriteLine($"Password reset token for {dto.Email} sent via email.");
    }

    public async Task ResetPasswordAsync(ResetPasswordDto dto)
    {
        var user = await _userRepo.GetByEmailAsync(dto.Email.ToLower());
        if (user == null) throw new Exception("User not found");

        if (user.PasswordResetToken != dto.Token)
            throw new Exception("Invalid reset token");

        if (user.PasswordResetExpiry < DateTime.UtcNow)
            throw new Exception("Reset token has expired");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetExpiry = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user);
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordDto dto)
    {
        var user = await _userRepo.GetByIdAsync(userId);
        if (user == null) throw new Exception("User not found");

        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
            throw new Exception("Current password is incorrect");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _userRepo.UpdateAsync(user);
    }

    public async Task UpdateProfileImageAsync(int userId, string imageUrl)
    {
        var user = await _userRepo.GetByIdAsync(userId);
        if (user != null)
        {
            user.ProfileImageUrl = imageUrl;
            await _userRepo.UpdateAsync(user);
        }
    }

    public async Task UpdateProfileAsync(int userId, UpdateProfileDto dto)
    {
        var user = await _userRepo.GetByIdAsync(userId);
        if (user == null) throw new Exception("User not found");

        user.FullName = dto.FullName;
        user.Phone = dto.Phone;
        user.DateOfBirth = dto.DateOfBirth;
        user.UpdatedAt = DateTime.UtcNow;

        await _userRepo.UpdateAsync(user);
    }

    public async Task DeactivateUserAsync(int userId)
    {
        var user = await _userRepo.GetByIdAsync(userId);
        if (user != null)
        {
            user.IsActive = false;
            user.UpdatedAt = DateTime.UtcNow;
            await _userRepo.UpdateAsync(user);
        }
    }

    public async Task RestoreUserAsync(int userId)
    {
        var user = await _userRepo.GetByIdAsync(userId);
        if (user != null)
        {
            user.IsActive = true;
            user.UpdatedAt = DateTime.UtcNow;
            await _userRepo.UpdateAsync(user);
        }
    }

    public async Task<AuthResponseDto> LoginWithGoogleAsync(GoogleLoginRequestDto dto, string? subdomain = null)
    {
        var settings = new GoogleJsonWebSignature.ValidationSettings()
        {
            Audience = new List<string> { _config["GoogleSettings:ClientId"]! }
        };

        var payload = await GoogleJsonWebSignature.ValidateAsync(dto.TokenId, settings);
        
        var user = await _userRepo.GetByEmailAsync(payload.Email);
        if (user == null)
        {
            int tenantId = 1; // Default
            if (!string.IsNullOrEmpty(subdomain))
            {
                var tenant = await _tenantRepo.GetBySubdomainAsync(subdomain);
                if (tenant != null) tenantId = tenant.Id;
            }

            // Auto-register if user doesn't exist
            user = new User
            {
                FullName = payload.Name,
                Email = payload.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()), // Random password
                Role = "Patient",
                Phone = "0000000000",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                TenantId = tenantId
            };
            await _userRepo.AddUserAsync(user);
        }

        var response = BuildResponse(user);
        await _userRepo.UpdateAsync(user);
        return response;
    }

    public async Task<User?> GetUserByIdAsync(int userId)
    {
        return await _userRepo.GetByIdAsync(userId);
    }

    public async Task<List<User>> GetUsersByIdsAsync(IEnumerable<int> userIds)
    {
        return await _userRepo.GetByIdsAsync(userIds);
    }

    private AuthResponseDto BuildResponse(User user)
    {
        var token = GenerateJwtToken(user);
        var refresh = GenerateRefreshToken();
        var expiryHours = double.Parse(_config["JwtSettings:ExpiryInHours"] ?? "24");
        var expiry = DateTime.UtcNow.AddHours(expiryHours);

        user.RefreshToken = refresh;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);

        return new AuthResponseDto
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role,
            Phone = user.Phone,
            DateOfBirth = user.DateOfBirth,
            ProfileImageUrl = user.ProfileImageUrl,
            TenantId = user.TenantId,
            Token = token,
            RefreshToken = refresh,
            TokenExpiry = expiry
        };
    }

    private string GenerateJwtToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("TenantId", user.TenantId.ToString()),
            new Claim("FullName", user.FullName)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["JwtSettings:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expiryHours = double.Parse(_config["JwtSettings:ExpiryInHours"] ?? "24");

        var token = new JwtSecurityToken(
            issuer: _config["JwtSettings:Issuer"],
            audience: _config["JwtSettings:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiryHours),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var bytes = new byte[64];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes);
    }

    private ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["JwtSettings:Key"]!));
        var validation = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = false
        };

        return new JwtSecurityTokenHandler().ValidateToken(token, validation, out _);
    }
}
