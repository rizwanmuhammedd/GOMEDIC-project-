using HospitalMS.AuthService.Application.DTOs;
using HospitalMS.AuthService.Domain.Entities;

namespace HospitalMS.AuthService.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto> LoginAsync(LoginRequestDto request);
    Task<string> RegisterAsync(RegisterRequestDto request, string? subdomain = null);
    Task<User> CreateStaffAsync(RegisterRequestDto request, int tenantId);
    Task<List<User>> GetAllUsersAsync();
    Task<List<User>> GetUsersByRoleAsync(string role);
    Task<AuthResponseDto> RefreshAsync(RefreshTokenDto dto);
    Task LogoutAsync(int userId);
    Task ForgotPasswordAsync(ForgotPasswordDto dto);
    Task ResetPasswordAsync(ResetPasswordDto dto);
    Task ChangePasswordAsync(int userId, ChangePasswordDto dto);
    Task UpdateProfileImageAsync(int userId, string imageUrl);
    Task UpdateProfileAsync(int userId, UpdateProfileDto dto);
    Task DeactivateUserAsync(int userId);
    Task RestoreUserAsync(int userId);
    Task<User?> GetUserByIdAsync(int userId);
    Task<List<User>> GetUsersByIdsAsync(IEnumerable<int> userIds);
    Task<Tenant?> GetTenantByIdAsync(int tenantId);
    Task<Tenant?> GetTenantBySubdomainAsync(string subdomain);
    Task<AuthResponseDto> LoginWithGoogleAsync(GoogleLoginRequestDto dto, string? subdomain = null);
}