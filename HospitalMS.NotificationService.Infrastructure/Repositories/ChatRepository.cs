using HospitalMS.NotificationService.Domain.Entities;
using HospitalMS.NotificationService.Domain.Interfaces;
using HospitalMS.NotificationService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace HospitalMS.NotificationService.Infrastructure.Repositories;

public class ChatRepository : IChatRepository
{
    private readonly NotificationDbContext _db;

    public ChatRepository(NotificationDbContext db)
    {
        _db = db;
    }

    public async Task<ChatMessage> AddMessageAsync(ChatMessage message)
    {
        _db.ChatMessages.Add(message);
        await _db.SaveChangesAsync();
        return message;
    }

    public async Task<List<ChatMessage>> GetHistoryAsync(string patientId)
    {
        return await _db.ChatMessages
            .Where(m => m.PatientId == patientId)
            .OrderBy(m => m.Timestamp)
            .ToListAsync();
    }

    public async Task<IEnumerable<object>> GetUniquePatientsWithStatsAsync()
    {
        // 1. Get stats using basic projection to ensure SQL translation
        var rawStats = await _db.ChatMessages
            .GroupBy(m => m.PatientId)
            .Select(g => new {
                PatientId = g.Key,
                PatientName = g.Max(x => x.PatientName), // Take any available name
                LatestMessage = g.Max(x => x.Timestamp),
                UnreadCount = g.Count(x => x.IsFromPatient && !x.IsRead)
            })
            .ToListAsync();

        // 2. Get blocked users separately
        var sevenDaysAgo = System.DateTime.UtcNow.AddDays(-7);
        var blockedPatientIds = await _db.BlockedChatUsers
            .Where(x => x.BlockedAt > sevenDaysAgo)
            .Select(x => x.PatientId)
            .ToListAsync();

        // 3. Combine in-memory
        return rawStats
            .OrderByDescending(x => x.LatestMessage)
            .Select(s => new {
                s.PatientId,
                s.PatientName,
                s.LatestMessage,
                s.UnreadCount,
                IsBlocked = blockedPatientIds.Contains(s.PatientId)
            });
    }

    public async Task MarkAsReadAsync(string patientId)
    {
        var unread = await _db.ChatMessages
            .Where(m => m.PatientId == patientId && m.IsFromPatient && !m.IsRead)
            .ToListAsync();

        if (unread.Any())
        {
            foreach (var msg in unread) msg.IsRead = true;
            await _db.SaveChangesAsync();
        }
    }

    public async Task MarkHospitalMessagesAsReadAsync(string patientId)
    {
        var unread = await _db.ChatMessages
            .Where(m => m.PatientId == patientId && !m.IsFromPatient && !m.IsRead)
            .ToListAsync();

        if (unread.Any())
        {
            foreach (var msg in unread) msg.IsRead = true;
            await _db.SaveChangesAsync();
        }
    }

    public async Task<int> GetTotalUnreadCountAsync(string? patientId = null)
    {
        if (string.IsNullOrEmpty(patientId))
        {
            // For Receptionist: Total unread from all patients
            return await _db.ChatMessages.CountAsync(m => m.IsFromPatient && !m.IsRead);
        }
        else
        {
            // For Patient: Total unread from hospital for this patient
            return await _db.ChatMessages.CountAsync(m => m.PatientId == patientId && !m.IsFromPatient && !m.IsRead);
        }
    }

    public async Task BlockUserAsync(string patientId, string? patientName, string? reason)
    {
        var alreadyBlocked = await _db.BlockedChatUsers.AnyAsync(x => x.PatientId == patientId);
        if (alreadyBlocked) return;

        _db.BlockedChatUsers.Add(new BlockedChatUser
        {
            PatientId = patientId,
            PatientName = patientName,
            Reason = reason,
            BlockedAt = System.DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
    }

    public async Task UnblockUserAsync(string patientId)
    {
        var blocked = await _db.BlockedChatUsers.Where(x => x.PatientId == patientId).ToListAsync();
        if (blocked.Any())
        {
            _db.BlockedChatUsers.RemoveRange(blocked);
            await _db.SaveChangesAsync();
        }
    }

    public async Task<bool> IsUserBlockedAsync(string patientId)
    {
        var block = await _db.BlockedChatUsers
            .Where(x => x.PatientId == patientId)
            .OrderByDescending(x => x.BlockedAt)
            .FirstOrDefaultAsync();

        if (block == null) return false;

        // Auto-unblock after 7 days
        if (System.DateTime.UtcNow > block.BlockedAt.AddDays(7))
        {
            _db.BlockedChatUsers.Remove(block);
            await _db.SaveChangesAsync();
            return false;
        }

        return true;
    }

    public async Task<int> GetDailyMessageCountAsync(string patientId)
    {
        var today = System.DateTime.UtcNow.Date;
        return await _db.ChatMessages
            .CountAsync(m => m.PatientId == patientId && m.IsFromPatient && m.Timestamp >= today);
    }

    public async Task<int> GetRecentMessageCountAsync(string patientId, int minutes)
    {
        var since = System.DateTime.UtcNow.AddMinutes(-minutes);
        return await _db.ChatMessages
            .CountAsync(m => m.PatientId == patientId && m.IsFromPatient && m.Timestamp >= since);
    }
}
