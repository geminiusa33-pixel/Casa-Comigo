using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class ProfileService(IProfileRepository repository) : IProfileService
{
    /// <inheritdoc />
    public Task<ProfileResponse?> GetAsync(Guid profileId, CancellationToken cancellationToken) =>
        repository.GetAsync(profileId, cancellationToken);

    /// <inheritdoc />
    public async Task<ProfileResponse> SaveAsync(
        Guid profileId,
        UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        var displayName = request.DisplayName.Trim();
        if (displayName.Length < 2)
            throw new ProfileValidationException("O nome deve ter pelo menos dois caracteres.");

        if (request.PreferredHousemates is < 2 or > 20)
            throw new ProfileValidationException("Escolha entre 2 e 20 pessoas no total, incluindo-se a si.");

        var interests = request.Interests
            .Select(interest => interest.Trim())
            .Where(interest => interest.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (interests.Length > 20 || interests.Any(interest => interest.Length > 50))
            throw new ProfileValidationException("Indique até 20 interesses, cada um com no máximo 50 caracteres.");

        if (request.DiscoveryVisible && !await repository.HasSearchAreaAsync(profileId, cancellationToken))
            throw new ProfileValidationException("Guarde primeiro uma zona de procura antes de ativar a descoberta.");

        return await repository.SaveAsync(
            profileId,
            request with { DisplayName = displayName, Interests = interests },
            cancellationToken);
    }

    /// <inheritdoc />
    public Task<ProfileResponse> SaveSearchAreaAsync(
        Guid profileId,
        UpdateSearchAreaRequest request,
        CancellationToken cancellationToken)
    {
        var areaLabel = request.AreaLabel.Trim();
        if (areaLabel.Length == 0)
            throw new ProfileValidationException("Indique uma cidade ou área aproximada.");

        if (!double.IsFinite(request.Latitude) || !double.IsFinite(request.Longitude)
            || !double.IsFinite(request.RadiusKm))
            throw new ProfileValidationException("A localização e o raio têm de ser valores numéricos válidos.");

        return repository.SaveSearchAreaAsync(
            profileId,
            request with { AreaLabel = areaLabel },
            cancellationToken);
    }
}
