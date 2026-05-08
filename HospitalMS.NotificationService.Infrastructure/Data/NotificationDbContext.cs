using System;
using System.Collections.Generic;
using System.Linq;
using HospitalMS.NotificationService.Domain.Entities;
using HospitalMS.NotificationService.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HospitalMS.NotificationService.Infrastructure.Data;
public partial class NotificationDbContext : DbContext
{
    private readonly ITenantProvider? _tenant;

    public NotificationDbContext()
    {
    }

    public NotificationDbContext(DbContextOptions<NotificationDbContext> options, ITenantProvider tenant)
        : base(options)
    {
        _tenant = tenant;
    }

    public virtual DbSet<Notification> Notifications { get; set; }
    public virtual DbSet<ChatMessage> ChatMessages { get; set; }
    public virtual DbSet<BlockedChatUser> BlockedChatUsers { get; set; }


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Use a variable to avoid multiple null-checks or access issues during translation
        int tenantId = _tenant?.TenantId ?? 1;

        modelBuilder.Entity<Notification>().HasQueryFilter(e => e.TenantId == tenantId);
        modelBuilder.Entity<ChatMessage>().HasQueryFilter(e => e.TenantId == tenantId);
        modelBuilder.Entity<BlockedChatUser>().HasQueryFilter(e => e.TenantId == tenantId);

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Notifica__3214EC07327F70D6");

            entity.HasIndex(e => e.UserId, "IX_Notifications_UserId");

            entity.HasIndex(e => new { e.UserId, e.IsRead }, "IX_Notifications_UserId_IsRead");

            entity.Property(e => e.Channel)
                .HasMaxLength(20)
                .HasDefaultValue("InApp");
            entity.Property(e => e.Message).HasMaxLength(1000);
            entity.Property(e => e.RelatedEntityType).HasMaxLength(50);
            entity.Property(e => e.SentAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Title).HasMaxLength(200);
            entity.Property(e => e.Type).HasMaxLength(50);
        });

        modelBuilder.Entity<ChatMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.PatientId).HasMaxLength(50);
            entity.Property(e => e.PatientName).HasMaxLength(200);
            entity.Property(e => e.ReceptionistName).HasMaxLength(200);
            entity.Property(e => e.Message).HasMaxLength(2000);
            entity.Property(e => e.Timestamp).HasDefaultValueSql("(getutcdate())");
        });

        modelBuilder.Entity<BlockedChatUser>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.PatientId).HasMaxLength(50);
            entity.Property(e => e.PatientName).HasMaxLength(200);
            entity.Property(e => e.Reason).HasMaxLength(500);
            entity.Property(e => e.BlockedAt).HasDefaultValueSql("(getutcdate())");
        });

      
        OnModelCreatingPartial(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries().Where(e => e.State == EntityState.Added))
        {
            var property = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "TenantId");
            if (property != null && _tenant != null)
            {
                property.CurrentValue = _tenant.TenantId;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
