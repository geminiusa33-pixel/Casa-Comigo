using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Consultas de descoberta, gostos e matches recíprocos.</summary>
public interface IMatchingRepository
{
    Task<IReadOnlyList<DiscoveryProfileResponse>> GetDiscoverableAsync(Guid profileId, CancellationToken cancellationToken);
    Task<LikeResponse> LikeAsync(Guid profileId, Guid recipientId, CancellationToken cancellationToken);
    Task<IReadOnlyList<MatchResponse>> GetMatchesAsync(Guid profileId, CancellationToken cancellationToken);
}
