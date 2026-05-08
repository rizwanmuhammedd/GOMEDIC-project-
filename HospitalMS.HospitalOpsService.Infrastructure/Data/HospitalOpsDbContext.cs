using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using HospitalMS.HospitalOpsService.Domain.Entities;
using HospitalMS.HospitalOpsService.Domain.Interfaces;

namespace HospitalMS.HospitalOpsService.Infrastructure.Data;

public partial class HospitalOpsDbContext : DbContext
{
    private readonly ITenantProvider? _tenant;

    public HospitalOpsDbContext()
    {
    }

    public HospitalOpsDbContext(DbContextOptions<HospitalOpsDbContext> options, ITenantProvider tenant)
        : base(options)
    {
        _tenant = tenant;
    }

    public virtual DbSet<Bill> Bills { get; set; }

    public virtual DbSet<Medicine> Medicines { get; set; }

    public virtual DbSet<Prescription> Prescriptions { get; set; }

    public virtual DbSet<PrescriptionItem> PrescriptionItems { get; set; }

    public virtual DbSet<LabOrder> LabOrders { get; set; }

    public virtual DbSet<LabTest> LabTests { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Bill>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<Medicine>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<Prescription>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<PrescriptionItem>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<LabOrder>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<LabTest>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);

        modelBuilder.Entity<Bill>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.BillNumber).IsUnique();
            entity.Property(e => e.BalanceAmount).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.BedCharge).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.BillNumber).HasMaxLength(30);
            entity.Property(e => e.ConsultationCharge).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.Discount).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.GeneratedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.InsuranceClaimNumber).HasMaxLength(80);
            entity.Property(e => e.InsuranceProvider).HasMaxLength(100);
            entity.Property(e => e.LabCharge).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.MedicineCharge).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.OtherCharges).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.PaidAmount).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.PaymentMethod).HasMaxLength(30);
            entity.Property(e => e.PaymentStatus).HasMaxLength(20).HasDefaultValue("Pending");
            entity.Property(e => e.TotalAmount).HasColumnType("decimal(10, 2)");
        });

        modelBuilder.Entity<Medicine>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.BatchNumber).HasMaxLength(50);
            entity.Property(e => e.Category).HasMaxLength(80);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.GenericName).HasMaxLength(200);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Manufacturer).HasMaxLength(150);
            entity.Property(e => e.MinimumStockLevel).HasDefaultValue(10);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.Unit).HasMaxLength(30);
            entity.Property(e => e.UnitPrice).HasColumnType("decimal(10, 2)");
        });

        modelBuilder.Entity<Prescription>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.PatientName).HasMaxLength(150);
            entity.Property(e => e.PatientPhone).HasMaxLength(20);
            entity.Property(e => e.Notes).HasMaxLength(500);
            entity.Property(e => e.PrescribedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Status).HasMaxLength(30).HasDefaultValue("Pending");
        });

        modelBuilder.Entity<PrescriptionItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Dosage).HasMaxLength(50);
            entity.Property(e => e.Frequency).HasMaxLength(100);
            entity.Property(e => e.Instructions).HasMaxLength(300);

            entity.HasOne(d => d.Medicine).WithMany(p => p.PrescriptionItems)
                .HasForeignKey(d => d.MedicineId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.Prescription).WithMany(p => p.PrescriptionItems)
                .HasForeignKey(d => d.PrescriptionId);
        });

        modelBuilder.Entity<LabOrder>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasMaxLength(30).IsRequired();
            entity.Property(e => e.ResultValue).HasMaxLength(500);
            entity.Property(e => e.ResultNotes).HasMaxLength(1000);
            entity.Property(e => e.OrderedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.LabTest).WithMany(p => p.LabOrders)
                .HasForeignKey(d => d.LabTestId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<LabTest>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TestName).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.Price).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.SampleType).HasMaxLength(50);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
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
