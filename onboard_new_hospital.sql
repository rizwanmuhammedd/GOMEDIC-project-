-- =========================================================================
-- SCRIPT: onboard_new_hospital.sql
-- PURPOSE: Adds a new hospital (Tenant) and its first Administrator account.
-- USAGE: Run this in SQL Server Management Studio (SSMS) against your AuthDb.
-- =========================================================================

DECLARE @HospitalName NVARCHAR(100) = 'City Care Hospital';
DECLARE @Subdomain NVARCHAR(50) = 'citycare'; -- E.g., citycare.gomedic.com
DECLARE @RazorpayKey NVARCHAR(100) = 'rzp_test_YOUR_KEY_HERE';
DECLARE @RazorpaySecret NVARCHAR(100) = 'YOUR_SECRET_HERE';

DECLARE @AdminFullName NVARCHAR(100) = 'Admin City Care';
DECLARE @AdminEmail NVARCHAR(150) = 'admin@citycare.com';
DECLARE @AdminPasswordHash NVARCHAR(255) = '$2a$11$9rW.mX.5x6mI6Y9Xm9m9Me6vX6mI6Y9Xm9m9Me6vX6mI6Y9Xm9m9M'; -- Default: Password123!
DECLARE @AdminPhone NVARCHAR(15) = '1112223333';

-- 1. Insert New Tenant
INSERT INTO Tenants (Name, Subdomain, RazorpayKey, RazorpaySecret, CreatedAt)
VALUES (@HospitalName, @Subdomain, @RazorpayKey, @RazorpaySecret, GETUTCDATE());

-- Get the ID of the newly created Tenant
DECLARE @NewTenantId INT = SCOPE_IDENTITY();

-- 2. Insert Admin User for the New Tenant
-- Note: Email must be unique across the entire database.
IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = @AdminEmail)
BEGIN
    INSERT INTO Users (FullName, Email, PasswordHash, Role, Phone, IsActive, CreatedAt, TenantId)
    VALUES (
        @AdminFullName, 
        @AdminEmail, 
        @AdminPasswordHash, 
        'Admin', 
        @AdminPhone, 
        1, -- IsActive
        GETUTCDATE(), 
        @NewTenantId
    );
    
    PRINT 'SUCCESS: New hospital and admin account created successfully.';
    PRINT 'Tenant ID: ' + CAST(@NewTenantId AS NVARCHAR(10));
    PRINT 'Admin Login: ' + @AdminEmail;
END
ELSE
BEGIN
    PRINT 'ERROR: A user with email ' + @AdminEmail + ' already exists. Please choose a different email.';
END
