using HospitalMS.NotificationService.Application.Hubs;
using HospitalMS.NotificationService.Application.Interfaces;
using HospitalMS.NotificationService.Domain.Entities;
using HospitalMS.NotificationService.Domain.Interfaces;
using Microsoft.AspNetCore.SignalR;
using System.Net.Http.Json;

namespace HospitalMS.NotificationService.Application.Services;

public class NotificationService : INotificationService
{
    private readonly INotificationRepository _repo;
    private readonly IHubContext<HospitalHub> _hub;
    private readonly HttpClient _httpClient;

    public NotificationService(INotificationRepository repo, IHubContext<HospitalHub> hub, IHttpClientFactory httpClientFactory)
    { 
        _repo = repo; 
        _hub = hub; 
        _httpClient = httpClientFactory.CreateClient();
    }

    // Called by OTHER services to create + send live notification
    public async Task SendAsync(int userId, string title, string message, string type, int? relatedId = null, string? relatedType = null, string? targetUrl = null)
    {
        // 1. Save to DB
        var notification = new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            Channel = "InApp",
            IsRead = false,
            SentAt = DateTime.UtcNow,
            RelatedEntityId = relatedId,
            RelatedEntityType = relatedType,
            TargetUrl = targetUrl
        };
        await _repo.AddAsync(notification);

        // 2. Push live via SignalR to that specific user's group
        await _hub.Clients.Group($"user_{userId}")
            .SendAsync("ReceiveNotification", new {
                notification.Id,
                notification.Title,
                notification.Message,
                notification.Type,
                notification.SentAt,
                notification.RelatedEntityId,
                notification.RelatedEntityType,
                notification.TargetUrl
            });
    }

    public async Task SendToRoleAsync(string role, string title, string message, string type, int? relatedId = null, string? relatedType = null, string? targetUrl = null)
    {
        // 1. Get all users with that role from AuthService
        try
        {
            var response = await _httpClient.GetAsync($"http://localhost:5001/api/auth/users/role/{role}");
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                using var doc = System.Text.Json.JsonDocument.Parse(content);
                var root = doc.RootElement;
                
                if (root.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var user in root.EnumerateArray())
                    {
                        if (user.TryGetProperty("id", out var idProp) || user.TryGetProperty("Id", out idProp))
                        {
                            int userId = idProp.GetInt32();
                            await SendAsync(userId, title, message, type, relatedId, relatedType, targetUrl);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending to role {role}: {ex.Message}");
            // Fallback: just broadcast live if persistence fails
            await BroadcastAsync(role, title, message, type);
        }
    }

    public async Task BroadcastAsync(string groupName, string title, string message, string type)
    {
        await _hub.Clients.Group(groupName)
            .SendAsync("ReceiveNotification", new {
                Title = title,
                Message = message,
                Type = type,
                SentAt = DateTime.UtcNow
            });
    }

    public async Task<List<Notification>> GetMyNotificationsAsync(int userId)
        => await _repo.GetByUserIdAsync(userId);

    public async Task<int> GetUnreadCountAsync(int userId)
        => await _repo.GetUnreadCountAsync(userId);

    public async Task MarkAsReadAsync(int id)
        => await _repo.MarkAsReadAsync(id);

    public async Task MarkAllAsReadAsync(int userId)
        => await _repo.MarkAllAsReadAsync(userId);
}
