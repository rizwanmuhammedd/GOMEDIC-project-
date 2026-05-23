using HospitalMS.NotificationService.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HospitalMS.NotificationService.Domain.Interfaces;

public interface IChatRepository
{
    Task<ChatMessage> AddMessageAsync(ChatMessage message);
    Task<List<ChatMessage>> GetHistoryAsync(string patientId);
    Task<IEnumerable<object>> GetUniquePatientsWithStatsAsync();
    Task MarkAsReadAsync(string patientId);
    Task MarkHospitalMessagesAsReadAsync(string patientId);
    Task<int> GetTotalUnreadCountAsync(string? patientId = null);
    Task BlockUserAsync(string patientId, string? patientName, string? reason);
    Task UnblockUserAsync(string patientId);
    Task<bool> IsUserBlockedAsync(string patientId);
    Task<int> GetDailyMessageCountAsync(string patientId);
    Task<int> GetRecentMessageCountAsync(string patientId, int minutes);
}
