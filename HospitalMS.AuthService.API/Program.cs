using HospitalMS.AuthService.Application.Interfaces;
using HospitalMS.AuthService.Application.Services;
using HospitalMS.AuthService.Domain.Interfaces;
using HospitalMS.AuthService.Infrastructure.Data;
using HospitalMS.AuthService.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using HospitalMS.AuthService.Application.Validators;
using FluentValidation;
using FluentValidation.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => {
    options.Limits.MaxRequestBodySize = 5 * 1024 * 1024; // 5MB max
});

builder.Services.AddDbContext<AuthDbContext>(options =>
options.UseSqlServer(builder.Configuration.GetConnectionString("AuthDb")));
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<ITenantRepository, TenantRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IImageService, ImageService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantProvider, TenantProvider>();

builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssembly(typeof(RegisterValidator).Assembly);

builder.Services.Configure<Microsoft.AspNetCore.Mvc.ApiBehaviorOptions>(options => {
    options.InvalidModelStateResponseFactory = context => {
        var errors = context.ModelState
            .Where(e => e.Value?.Errors.Count > 0)
            .SelectMany(e => e.Value!.Errors)
            .Select(e => e.ErrorMessage)
            .ToList();
        return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new { message = "Validation failed", errors });
    };
});

var jwtKey = builder.Configuration["JwtSettings:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
        ValidAudience = builder.Configuration["JwtSettings:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
    Encoding.UTF8.GetBytes(jwtKey)),
        RoleClaimType = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
        NameClaimType = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
    };
});
builder.Services.AddAuthorization();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "HMS AuthService", Version = "v1" });
    // Add JWT Bearer input box in Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Enter: Bearer {your JWT token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
{
{
new OpenApiSecurityScheme {
Reference = new OpenApiReference {
Type = ReferenceType.SecurityScheme,
Id = "Bearer"
}
},
Array.Empty<string>()
}
});
});
var app = builder.Build();

app.UseMiddleware<HospitalMS.AuthService.API.Middleware.ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseCors("AllowReact"); // CORS must come before auth
app.UseStaticFiles();
app.UseAuthentication(); // MUST be before UseAuthorization
app.UseAuthorization();
app.MapControllers();
app.Run();
