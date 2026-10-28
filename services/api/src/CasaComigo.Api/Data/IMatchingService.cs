using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Executa operações de descoberta e matching.</summary>
public interface IMatchingService
{
    Task<IReadOnlyList<DiscoveryProfileResponse>> GetDiscoverableAsync(Guid profileId, CancellationToken cancellationToken);
    Task<LikeResponse> LikeAsync(Guid profileId, Guid recipientId, CancellationToken cancellationToken);
    Task<bool> PassAsync(Guid profileId, Guid recipientId, CancellationToken cancellationToken);
    Task<IReadOnlyList<MatchResponse>> GetMatchesAsync(Guid profileId, CancellationToken cancellationToken);
    Task<bool> CancelMatchAsync(Guid profileId, Guid matchId, CancellationToken cancellationToken);
}
