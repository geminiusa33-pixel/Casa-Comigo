using CasaComigo.Api.Data;
using CasaComigo.Api.Endpoints;
using CasaComigo.Api.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
var supabaseUrl = (builder.Configuration["SUPABASE_URL"] ?? "http://127.0.0.1:54321").TrimEnd('/');
var jwtIssuer = builder.Configuration["SUPABASE_JWT_ISSUER"];
var connectionString = builder.Configuration.GetConnectionString("Supabase");
if (string.IsNullOrWhiteSpace(connectionString))
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("ConnectionStrings:Supabase tem de estar configurada fora do ambiente Development.");

    connectionString = "Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres";
}

builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
builder.Services.AddScoped<IProfileRepository, ProfileRepository>();
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddScoped<IMatchingRepository, MatchingRepository>();
builder.Services.AddScoped<IMatchingService, MatchingService>();
builder.Services.AddScoped<IChatRepository, ChatRepository>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IProfileSafetyRepository, ProfileSafetyRepository>();
builder.Services.AddScoped<IProfileSafetyService, ProfileSafetyService>();
builder.Services.AddScoped<IHousingGroupRepository, HousingGroupRepository>();
builder.Services.AddScoped<IHousingGroupService, HousingGroupService>();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Supabase")
        ?? "Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres"));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !supabaseUrl.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase)
            && !supabaseUrl.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase);
        options.Authority = $"{supabaseUrl}/auth/v1";
        options.MetadataAddress = $"{supabaseUrl}/auth/v1/.well-known/openid-configuration";
        options.Audience = "authenticated";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddValidation();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "casa-comigo-api" }))
    .WithName("Health");

var api = app.MapGroup("/api").RequireAuthorization();
api.MapAuthEndpoints();
api.MapProfileEndpoints();
api.MapMatchingEndpoints();
api.MapChatEndpoints();
api.MapProfileSafetyEndpoints();
api.MapHousingGroupEndpoints();
MapNotImplemented(api, "POST", "/matches/{matchId:guid}/visit-requests");
MapNotImplemented(api, "GET", "/houses");
MapNotImplemented(api, "POST", "/houses");
MapNotImplemented(api, "GET", "/houses/{listingId:guid}");
MapNotImplemented(api, "PUT", "/houses/{listingId:guid}");
MapNotImplemented(api, "DELETE", "/houses/{listingId:guid}");
MapNotImplemented(api, "GET", "/houses/favorites");
MapNotImplemented(api, "PUT", "/houses/{listingId:guid}/favorite");
MapNotImplemented(api, "DELETE", "/houses/{listingId:guid}/favorite");
app.Run();

static void MapNotImplemented(RouteGroupBuilder group, string method, string route)
{
    group.MapMethods(route, [method], () => Results.Problem(
        title: "Funcionalidade ainda não implementada",
        detail: "Este endpoint faz parte do contrato inicial; o caso de uso será implementado numa fase seguinte.",
        statusCode: StatusCodes.Status501NotImplemented))
        .WithName($"Scaffold_{method}_{route.Replace('/', '_').Replace('{', '_').Replace('}', '_')}");
}

public partial class Program { }
