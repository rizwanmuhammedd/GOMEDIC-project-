using Ocelot.DependencyInjection;
using Ocelot.Middleware;

var builder = WebApplication.CreateBuilder(args);

// ■■ 1. Load ocelot.json (routing config) ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
var ocelotConfig = builder.Environment.IsEnvironment("Docker") ? "ocelot.Docker.json" : "ocelot.json";
builder.Configuration.AddJsonFile(ocelotConfig, optional: false, reloadOnChange: true);

// ■■ 2. Register Ocelot ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
builder.Services.AddOcelot();

// ■■ 3. CORS (Gateway also needs CORS for React) ■■■■■■■■■■■■■■■■■■■■■■■■■■■
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

var app = builder.Build();

// ■■ Middleware order matters here ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
app.UseCors("AllowReact"); // CORS must be FIRST

await app.UseOcelot(); // Ocelot handles all routing

app.Run();
