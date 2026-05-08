using HospitalMS.HospitalOpsService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace HospitalMS.HospitalOpsService.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task SeedMedicinesAsync(HospitalOpsDbContext context)
    {
        if (await context.Medicines.AnyAsync()) return;

        var medicines = new List<Medicine>
        {
            new Medicine { Name = "Panadol 500mg", GenericName = "Paracetamol", Category = "Analgesic", StockQuantity = 500, UnitPrice = 5.00m, Unit = "Tablet", Manufacturer = "GSK", BatchNumber = "BN1001", MinimumStockLevel = 50, IsActive = true, TenantId = 1 },
            new Medicine { Name = "Amoxil 250mg", GenericName = "Amoxicillin", Category = "Antibiotic", StockQuantity = 200, UnitPrice = 15.50m, Unit = "Capsule", Manufacturer = "GSK", BatchNumber = "BN1002", MinimumStockLevel = 30, IsActive = true, TenantId = 1 },
            new Medicine { Name = "Brufen 400mg", GenericName = "Ibuprofen", Category = "NSAID", StockQuantity = 350, UnitPrice = 8.75m, Unit = "Tablet", Manufacturer = "Abbott", BatchNumber = "BN1003", MinimumStockLevel = 40, IsActive = true, TenantId = 1 },
            new Medicine { Name = "Augmentin 625mg", GenericName = "Amoxicillin + Clavulanate", Category = "Antibiotic", StockQuantity = 150, UnitPrice = 45.00m, Unit = "Tablet", Manufacturer = "GSK", BatchNumber = "BN1004", MinimumStockLevel = 20, IsActive = true, TenantId = 1 },
            new Medicine { Name = "Zyrtec 10mg", GenericName = "Cetirizine", Category = "Antihistamine", StockQuantity = 120, UnitPrice = 12.00m, Unit = "Tablet", Manufacturer = "UCB", BatchNumber = "BN1005", MinimumStockLevel = 25, IsActive = true, TenantId = 1 },
            new Medicine { Name = "Glucophage 500mg", GenericName = "Metformin", Category = "Antidiabetic", StockQuantity = 400, UnitPrice = 6.50m, Unit = "Tablet", Manufacturer = "Merck", BatchNumber = "BN1006", MinimumStockLevel = 50, IsActive = true, TenantId = 1 },
            new Medicine { Name = "Lipitor 20mg", GenericName = "Atorvastatin", Category = "Statin", StockQuantity = 300, UnitPrice = 35.00m, Unit = "Tablet", Manufacturer = "Pfizer", BatchNumber = "BN1007", MinimumStockLevel = 35, IsActive = true, TenantId = 1 },
            new Medicine { Name = "Ventolin Inhaler", GenericName = "Salbutamol", Category = "Bronchodilator", StockQuantity = 80, UnitPrice = 55.00m, Unit = "Unit", Manufacturer = "GSK", BatchNumber = "BN1008", MinimumStockLevel = 15, IsActive = true, TenantId = 1 },
            new Medicine { Name = "Aspirin 75mg", GenericName = "Acetylsalicylic Acid", Category = "Antiplatelet", StockQuantity = 600, UnitPrice = 2.50m, Unit = "Tablet", Manufacturer = "Bayer", BatchNumber = "BN1009", MinimumStockLevel = 100, IsActive = true, TenantId = 1 },
            new Medicine { Name = "Insulin Glargine", GenericName = "Lantus", Category = "Hormone", StockQuantity = 50, UnitPrice = 120.00m, Unit = "Vial", Manufacturer = "Sanofi", BatchNumber = "BN1010", MinimumStockLevel = 10, IsActive = true, TenantId = 1 }
        };

        context.Medicines.AddRange(medicines);
        await context.SaveChangesAsync();
    }
}
