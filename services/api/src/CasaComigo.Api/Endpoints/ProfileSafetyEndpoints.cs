using System.Security.Claims;
using CasaComigo.Api.Contracts;
using CasaComigo.Api.Data;

namespace CasaComigo.Api.Endpoints;

/// <summary>Routes for blocking and reporting profiles.</summary>
public static class ProfileSafetyEndpoints
{
    /// <summary>Maps authenticated profile safety endpoints.</summary>
    public static IEndpointRouteBuilder MapProfileSafetyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/profile/blocks", async Task<IResult> (
                ClaimsPrincipal user,
                IProfileSafetyService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var profileId))
                    return TypedResults.Unauthorized();

                var profiles = await service.GetBlockedProfilesAsync(profileId, cancellationToken);
                return TypedResults.Ok(profiles);
            })
            .WithName("GetMyBlockedProfiles")
            .WithSummary("Lista os perfis bloqueados pela conta atual")
            .Produces<IReadOnlyList<BlockedProfileResponse>>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapPost("/profiles/{profileId:guid}/blocks", async Task<IResult> (
                Guid profileId,
                ClaimsPrincipal user,
                IProfileSafetyService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var blockerId))
                    return TypedResults.Unauthorized();

                await service.BlockAsync(blockerId, profileId, cancellationToken);
                return TypedResults.NoContent();
            })
            .WithName("BlockProfile")
            .WithSummary("Bloqueia um perfil e interrompe descoberta e conversas")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        endpoints.MapDelete("/profiles/{profileId:guid}/blocks", async Task<IResult> (
                Guid profileId,
                ClaimsPrincipal user,
                IProfileSafetyService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var blockerId))
                    return TypedResults.Unauthorized();

                await service.UnblockAsync(blockerId, profileId, cancellationToken);
                return TypedResults.NoContent();
            })
            .WithName("UnblockProfile")
            .WithSummary("Remove um bloqueio criado pela conta atual")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        endpoints.MapPost("/profiles/{profileId:guid}/reports", async Task<IResult> (
                Guid profileId,
                CreateProfileReportRequest request,
                ClaimsPrincipal user,
                IProfileSafetyService service,
                CancellationToken cancellationToken) =>
            {
                if (!TryGetProfileId(user, out var reporterId))
                    return TypedResults.Unauthorized();

                var report = await service.ReportAsync(reporterId, profileId, request, cancellationToken);
                return TypedResults.Ok(report);
            })
            .WithName("ReportProfile")
            .WithSummary("Envia uma denúncia sobre um perfil")
            .WithDescription("As denúncias são privadas; só a equipa de moderação deverá ter acesso às razões.")
            .Produces<ProfileReportResponse>()
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return endpoints;
    }

    private static bool TryGetProfileId(ClaimsPrincipal user, out Guid profileId)
    {
        var subject = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(subject, out profileId);
    }
}
