using System.Text;
using CasaComigo.Api.Data;
using CasaComigo.Api.Endpoints;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
var supabaseUrl = (builder.Configuration["SUPABASE_URL"] ?? "http://127.0.0.1:54321").TrimEnd('/');
var jwtSecret = builder.Configuration["SUPABASE_JWT_SECRET"];
var jwtIssuer = builder.Configuration["SUPABASE_JWT_ISSUER"] ?? "supabase";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Supabase")
        ?? "Host=127.0.0.1;Port=54322;Database=postgres;Username=postgres;Password=postgres"));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !supabaseUrl.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase)
            && !supabaseUrl.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(jwtSecret))
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,
                ValidateAudience = true,
                ValidAudience = "authenticated",
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ClockSkew = TimeSpan.FromMinutes(1)
            };
        }
        else
        {
            // Supports Supabase projects that publish signing-key metadata. Local HS256
            // tokens require SUPABASE_JWT_SECRET to be supplied by the developer.
            options.Authority = $"{supabaseUrl}/auth/v1";
            options.Audience = "authenticated";
        }
    });

builder.Services.AddAuthorization();
builder.Services.AddValidation();
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
MapNotImplemented(api, "GET", "/profile");
MapNotImplemented(api, "PUT", "/profile");
MapNotImplemented(api, "PUT", "/profile/search-area");
MapNotImplemented(api, "GET", "/discovery/profiles");
MapNotImplemented(api, "POST", "/profiles/{profileId:guid}/likes");
MapNotImplemented(api, "GET", "/matches");
MapNotImplemented(api, "GET", "/matches/{matchId:guid}/messages");
MapNotImplemented(api, "POST", "/matches/{matchId:guid}/messages");
MapNotImplemented(api, "POST", "/matches/{matchId:guid}/visit-requests");
MapNotImplemented(api, "GET", "/houses");
MapNotImplemented(api, "POST", "/houses");
MapNotImplemented(api, "GET", "/houses/{listingId:guid}");
MapNotImplemented(api, "PUT", "/houses/{listingId:guid}");
MapNotImplemented(api, "DELETE", "/houses/{listingId:guid}");
MapNotImplemented(api, "GET", "/houses/favorites");
MapNotImplemented(api, "PUT", "/houses/{listingId:guid}/favorite");
MapNotImplemented(api, "DELETE", "/houses/{listingId:guid}/favorite");
MapNotImplemented(api, "POST", "/profiles/{profileId:guid}/blocks");
MapNotImplemented(api, "POST", "/profiles/{profileId:guid}/reports");

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
