using System.Security.Claims;
using CasaComigo.Api.Contracts;
using CasaComigo.Api.Data;

namespace CasaComigo.Api.Endpoints;

/// <summary>Routes for mutually compatible roommate discovery and likes.</summary>
public static class MatchingEndpoints
{
    /// <summary>Maps discovery, likes, and reciprocal-match endpoints.</summary>
    public static IEndpointRouteBuilder MapMatchingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/discovery/profiles", async Task<IResult> (
                ClaimsPrincipal user,
                IMatchingService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var profiles = await service.GetDiscoverableAsync(profileId, cancellationToken);
                return TypedResults.Ok(profiles);
            })
            .WithName("DiscoverProfiles")
            .WithSummary("Descobre perfis em zonas de procura mutuamente compatíveis")
            .WithDescription("Nunca devolve coordenadas precisas nem perfis fora da compatibilidade geográfica.")
            .Produces<IReadOnlyList<DiscoveryProfileResponse>>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesValidationProblem();

        endpoints.MapPost("/profiles/{profileId:guid}/likes", async Task<IResult> (
                Guid profileId,
                ClaimsPrincipal user,
                IMatchingService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var actorId))
                    return TypedResults.Unauthorized();

                var result = await service.LikeAsync(actorId, profileId, cancellationToken);
                return TypedResults.Ok(result);
            })
            .WithName("LikeProfile")
            .WithSummary("Gosta de um perfil elegível")
            .WithDescription("Cria um match apenas se existir também um gosto recíproco.")
            .Produces<LikeResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapGet("/matches", async Task<IResult> (
                ClaimsPrincipal user,
                IMatchingService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var matches = await service.GetMatchesAsync(profileId, cancellationToken);
                return TypedResults.Ok(matches);
            })
            .WithName("GetMyMatches")
            .WithSummary("Lista os matches recíprocos da sessão atual")
            .WithDescription("Só devolve os matches em que o utilizador autenticado é participante.")
            .Produces<IReadOnlyList<MatchResponse>>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        return endpoints;
    }

    private static bool TryGetProfileId(ClaimsPrincipal user, out Guid profileId)
    {
        var subject = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(subject, out profileId);
    }
}
