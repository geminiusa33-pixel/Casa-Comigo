using CasaComigo.Api.Contracts;
using Npgsql;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class MatchingService(
    IMatchingRepository repository,
    IProfileService profileService) : IMatchingService
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<DiscoveryProfileResponse>> GetDiscoverableAsync(
        Guid profileId,
        CancellationToken cancellationToken)
    {
        var profile = await profileService.GetAsync(profileId, cancellationToken);
        if (profile is null)
            return Array.Empty<DiscoveryProfileResponse>();
        if (!profile.ProfileComplete || !profile.DiscoveryVisible)
            return Array.Empty<DiscoveryProfileResponse>();

        return await repository.GetDiscoverableAsync(profileId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<DiscoveryProfileResponse>> GetReconsiderableAsync(
        Guid profileId,
        CancellationToken cancellationToken)
    {
        var profile = await profileService.GetAsync(profileId, cancellationToken);
        if (profile is null)
            return Array.Empty<DiscoveryProfileResponse>();
        if (!profile.ProfileComplete || !profile.DiscoveryVisible)
            return Array.Empty<DiscoveryProfileResponse>();

        return await repository.GetReconsiderableAsync(profileId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<LikeResponse> LikeAsync(
        Guid profileId,
        Guid recipientId,
        CancellationToken cancellationToken)
    {
        if (profileId == recipientId)
            throw new ProfileValidationException("Não podes gostar do teu próprio perfil.");

        return await repository.LikeAsync(profileId, recipientId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> PassAsync(
        Guid profileId,
        Guid recipientId,
        CancellationToken cancellationToken)
    {
        if (profileId == recipientId)
            throw new ProfileValidationException("Não podes rejeitar o teu próprio perfil.");

        return await repository.PassAsync(profileId, recipientId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<MatchResponse>> GetMatchesAsync(
        Guid profileId,
        CancellationToken cancellationToken) =>
        repository.GetMatchesAsync(profileId, cancellationToken);

    /// <inheritdoc />
    public Task<bool> CancelMatchAsync(Guid profileId, Guid matchId, CancellationToken cancellationToken) =>
        repository.CancelMatchAsync(profileId, matchId, cancellationToken);
}
