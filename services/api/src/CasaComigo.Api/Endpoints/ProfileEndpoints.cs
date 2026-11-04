using System.Security.Claims;
using System.Text.Json;
using CasaComigo.Api.Contracts;
using CasaComigo.Api.Data;
using Microsoft.AspNetCore.Http.HttpResults;

namespace CasaComigo.Api.Endpoints;

/// <summary>Routes for the authenticated user's profile and private search area.</summary>
public static class ProfileEndpoints
{
    /// <summary>Maps profile and search-area endpoints.</summary>
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/profile", async Task<IResult> (
                ClaimsPrincipal user,
                IProfileService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var profile = await service.GetAsync(profileId, cancellationToken);
                return profile is null ? TypedResults.NotFound() : TypedResults.Ok(profile);
            })
            .WithName("GetMyProfile")
            .WithSummary("Obtém o perfil da sessão atual")
            .WithDescription("Inclui coordenadas apenas na resposta autenticada do próprio utilizador.")
            .Produces<ProfileResponse>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        endpoints.MapPut("/profile", async Task<IResult> (
                UpdateProfileRequest request,
                ClaimsPrincipal user,
                IProfileService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var profile = await service.SaveAsync(profileId, request, cancellationToken);
                return TypedResults.Ok(profile);
            })
            .WithName("UpdateMyProfile")
            .WithSummary("Atualiza o perfil e as preferências de coabitação")
            .Produces<ProfileResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapPut("/profile/search-area", async Task<IResult> (
                UpdateSearchAreaRequest request,
                ClaimsPrincipal user,
                IProfileService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var profile = await service.SaveSearchAreaAsync(profileId, request, cancellationToken);
                return TypedResults.Ok(profile);
            })
            .WithName("UpdateMySearchArea")
            .WithSummary("Guarda a zona e o raio privados do utilizador")
            .WithDescription("Os coordenadas exatas não são devolvidas a outros perfis.")
            .Produces<ProfileResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        return endpoints;
    }

    private static bool TryGetProfileId(ClaimsPrincipal user, out Guid profileId)
    {
        var subject = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(subject, out profileId);
    }
}
