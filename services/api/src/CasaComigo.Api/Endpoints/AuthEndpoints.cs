using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;

namespace CasaComigo.Api.Endpoints;

/// <summary>Routes for the authenticated user's session.</summary>
public static class AuthEndpoints
{
    /// <summary>Maps authenticated session endpoints.</summary>
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/auth/session", Results<Ok<AuthSessionResponse>, UnauthorizedHttpResult> (ClaimsPrincipal user) =>
            {
                var userId = user.FindFirstValue("sub")
                    ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrWhiteSpace(userId))
                    return TypedResults.Unauthorized();

                return TypedResults.Ok(new AuthSessionResponse(
                    userId,
                    user.FindFirstValue("email") ?? user.FindFirstValue(ClaimTypes.Email)));
            })
            .WithName("GetAuthenticatedSession")
            .WithSummary("Confirma a sessão autenticada")
            .WithDescription("Devolve apenas o identificador e o email do utilizador do token validado.")
            .Produces<AuthSessionResponse>()
            .Produces(StatusCodes.Status401Unauthorized);

        return endpoints;
    }
}

/// <summary>Identidade associada a um token de acesso Supabase validado.</summary>
public sealed record AuthSessionResponse(string UserId, string? Email);
