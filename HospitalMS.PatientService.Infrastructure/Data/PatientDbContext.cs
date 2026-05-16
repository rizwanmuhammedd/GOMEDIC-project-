using System;
using System.Collections.Generic;
using System.Linq;
using HospitalMS.PatientService.Domain.Entities;
using HospitalMS.PatientService.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace HospitalMS.PatientService.Infrastructure.Data;

public partial class PatientDbContext : DbContext
{
    private readonly ITenantProvider? _tenant;

    public PatientDbContext()
    {
    }

    public PatientDbContext(DbContextOptions<PatientDbContext> options, ITenantProvider tenant)
        : base(options)
    {
        _tenant = tenant;
    }

    public virtual DbSet<Admission> Admissions { get; set; }

    public virtual DbSet<Appointment> Appointments { get; set; }

    public virtual DbSet<Bed> Beds { get; set; }

    public virtual DbSet<Department> Departments { get; set; }

    public virtual DbSet<Doctor> Doctors { get; set; }

    public virtual DbSet<DoctorSchedule> DoctorSchedules { get; set; }

    public virtual DbSet<LabOrder> LabOrders { get; set; }

    public virtual DbSet<LabTest> LabTests { get; set; }

    public virtual DbSet<PatientVital> PatientVitals { get; set; }


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Admission>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<Appointment>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<Bed>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<Department>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<Doctor>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<DoctorSchedule>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<LabOrder>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<LabTest>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);
        modelBuilder.Entity<PatientVital>().HasQueryFilter(e => e.TenantId == _tenant!.TenantId);

        modelBuilder.Entity<Admission>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Admissio__3214EC072F5EF03B");

            entity.Property(e => e.AdmissionDate).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.AdmissionReason).HasMaxLength(500);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.DischargeCondition).HasMaxLength(50);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Admitted");

            entity.HasOne(d => d.Bed).WithMany(p => p.Admissions)
                .HasForeignKey(d => d.BedId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Admissions_Bed");

            entity.HasOne(d => d.Doctor).WithMany(p => p.Admissions)
                .HasForeignKey(d => d.DoctorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Admissions_Doctor");
        });

        modelBuilder.Entity<Appointment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Appointm__3214EC075AE861A1");

            entity.Property(e => e.PatientName).HasMaxLength(200);
            entity.Property(e => e.PatientPhone).HasMaxLength(40);
            entity.Property(e => e.PatientAge).HasDefaultValue(0);
            entity.Property(e => e.ChiefComplaint).HasMaxLength(500);
            entity.Property(e => e.ConsultationNotes).HasMaxLength(2000);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Diagnosis).HasMaxLength(500);
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValue("Scheduled");

            entity.HasOne(d => d.Doctor).WithMany(p => p.Appointments)
                .HasForeignKey(d => d.DoctorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Appointments_Doctor");
        });

        modelBuilder.Entity<Bed>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Beds__3214EC0777BD31A9");

            entity.HasIndex(e => e.BedNumber, "IX_Beds_BedNumber").IsUnique();

            entity.Property(e => e.BedNumber).HasMaxLength(20);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.DailyCharge).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.FloorNumber).HasDefaultValue(1);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.RoomNumber).HasMaxLength(20);
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValue("Available");
            entity.Property(e => e.WardType).HasMaxLength(30);
        });

        modelBuilder.Entity<Department>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Departme__3214EC0761BE8E98");

            entity.HasIndex(e => e.Name, "IX_Departments_Name").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.Description).HasMaxLength(300);
            entity.Property(e => e.FloorNumber).HasDefaultValue(1);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.PhoneExtension).HasMaxLength(10);

            // Seed Department
            entity.HasData(new Department
            {
                Id = 1,
                Name = "General Medicine",
                Description = "Primary healthcare department",
                FloorNumber = 1,
                IsActive = true,
                CreatedAt = new DateTime(2025, 1, 1),
                TenantId = 1
            });
        });

        modelBuilder.Entity<Doctor>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Doctors__3214EC07EB4A20D0");

            entity.HasIndex(e => e.LicenseNumber, "IX_Doctors_LicenseNumber").IsUnique();

            entity.HasIndex(e => e.UserId, "IX_Doctors_UserId").IsUnique();

            entity.Property(e => e.ConsultationFee).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.IsAvailable).HasDefaultValue(true);
            entity.Property(e => e.LicenseNumber).HasMaxLength(50);
            entity.Property(e => e.MaxPatientsPerDay).HasDefaultValue(30);
            entity.Property(e => e.FullName).HasMaxLength(150);
            entity.Property(e => e.ProfileImageUrl).HasMaxLength(500);
            entity.Property(e => e.Qualification).HasMaxLength(200);
            entity.Property(e => e.Specialization).HasMaxLength(100);

            entity.HasOne(d => d.Department).WithMany(p => p.Doctors)
                .HasForeignKey(d => d.DepartmentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Doctors_Department");

            // Seed Doctor (matches UserId 2 from AuthService)
            entity.HasData(new Doctor
            {
                Id = 1,
                UserId = 2,
                FullName = "Dr. John Smith",
                DepartmentId = 1,
                Specialization = "General Physician",
                Qualification = "MBBS, MD",
                LicenseNumber = "LIC12345",
                ConsultationFee = 500,
                MaxPatientsPerDay = 20,
                IsAvailable = true,
                CreatedAt = new DateTime(2025, 1, 1),
                TenantId = 1
            });
        });

        modelBuilder.Entity<DoctorSchedule>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__DoctorSc__3214EC07D35A9E2C");

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.LeaveReason).HasMaxLength(200);
            entity.Property(e => e.ShiftType).HasMaxLength(20);

            entity.HasOne(d => d.Doctor).WithMany(p => p.DoctorSchedules)
                .HasForeignKey(d => d.DoctorId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_DoctorSchedules_Doctor");
        });

        modelBuilder.Entity<LabOrder>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__LabOrder__3214EC079B7D8297");

            entity.Property(e => e.OrderedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.ResultFileUrl).HasMaxLength(300);
            entity.Property(e => e.ResultNotes).HasMaxLength(1000);
            entity.Property(e => e.ResultValue).HasMaxLength(1000);
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValue("Pending");

            entity.HasOne(d => d.LabTest).WithMany(p => p.LabOrders)
                .HasForeignKey(d => d.LabTestId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_LabOrders_LabTest");
        });

        modelBuilder.Entity<LabTest>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__LabTests__3214EC07E97E44C1");

            entity.Property(e => e.Category).HasMaxLength(80);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getutcdate())");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Price).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.SampleType).HasMaxLength(50);
            entity.Property(e => e.TestName).HasMaxLength(150);
            entity.Property(e => e.TurnaroundHours).HasDefaultValue(2);
        });

        modelBuilder.Entity<PatientVital>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Temperature).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.Weight).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.Height).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.BloodPressure).HasMaxLength(20);
            entity.Property(e => e.RecordedBy).HasMaxLength(100);
            entity.Property(e => e.RecordedAt).HasDefaultValueSql("(getutcdate())");

            entity.HasOne(d => d.Admission).WithMany()
                .HasForeignKey(d => d.AdmissionId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.Appointment).WithMany()
                .HasForeignKey(d => d.AppointmentId)
                .OnDelete(DeleteBehavior.SetNull);
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
