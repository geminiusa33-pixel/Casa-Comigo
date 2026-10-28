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
            .WithDescription("O centro de cada área tem de ficar dentro do raio de procura da outra pessoa. Preferências de convivência ou habitação não restringem a descoberta. Nunca devolve coordenadas precisas.")
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
            .WithDescription("Revalida a compatibilidade geográfica mútua antes de registar o gosto; cria um match apenas se existir também um gosto recíproco. As restantes preferências são informativas.")
            .Produces<LikeResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapPost("/profiles/{profileId:guid}/passes", async Task<IResult> (
                Guid profileId,
                ClaimsPrincipal user,
                IMatchingService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var actorId))
                    return TypedResults.Unauthorized();

                var passed = await service.PassAsync(actorId, profileId, cancellationToken);
                return passed ? TypedResults.NoContent() : TypedResults.NotFound();
            })
            .WithName("PassProfile")
            .WithSummary("Rejeita temporariamente um perfil na descoberta")
            .WithDescription("Oculta o perfil durante três dias e só aceita perfis geograficamente elegíveis.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

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

        endpoints.MapDelete("/matches/{matchId:guid}", async Task<IResult> (
                Guid matchId,
                ClaimsPrincipal user,
                IMatchingService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var cancelled = await service.CancelMatchAsync(profileId, matchId, cancellationToken);
                return cancelled ? TypedResults.NoContent() : TypedResults.NotFound();
            })
            .WithName("CancelMatch")
            .WithSummary("Cancela um match e permite nova descoberta")
            .WithDescription("Só um participante pode cancelar. A conversa e as mensagens são eliminadas, os gostos recíprocos são removidos e o par pode voltar a aparecer se mantiver áreas mutuamente compatíveis.")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return endpoints;
    }

    private static bool TryGetProfileId(ClaimsPrincipal user, out Guid profileId)
    {
        var subject = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(subject, out profileId);
    }
}
