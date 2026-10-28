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
            throw new ProfileValidationException("Complete o seu perfil antes de descobrir pessoas.");
        if (!profile.ProfileComplete || !profile.DiscoveryVisible)
            throw new ProfileValidationException("Complete o perfil, guarde a zona e ative a descoberta nas definições.");

        return await repository.GetDiscoverableAsync(profileId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<LikeResponse> LikeAsync(
        Guid profileId,
        Guid recipientId,
        CancellationToken cancellationToken)
    {
        if (profileId == recipientId)
            throw new ProfileValidationException("Não pode gostar do seu próprio perfil.");

        return await repository.LikeAsync(profileId, recipientId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<MatchResponse>> GetMatchesAsync(
        Guid profileId,
        CancellationToken cancellationToken) =>
        repository.GetMatchesAsync(profileId, cancellationToken);
}
