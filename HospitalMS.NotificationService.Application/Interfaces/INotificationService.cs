using HospitalMS.NotificationService.Domain.Entities;

namespace HospitalMS.NotificationService.Application.Interfaces;

public interface INotificationService
{
    Task SendAsync(int userId, string title, string message, string type, int? relatedId = null, string? relatedType = null, string? targetUrl = null);
    Task SendToRoleAsync(string role, string title, string message, string type, int? relatedId = null, string? relatedType = null, string? targetUrl = null);
    Task BroadcastAsync(string groupName, string title, string message, string type);
    Task<List<Notification>> GetMyNotificationsAsync(int userId);
    Task<int> GetUnreadCountAsync(int userId);
    Task MarkAsReadAsync(int id);
    Task MarkAllAsReadAsync(int userId);
}
