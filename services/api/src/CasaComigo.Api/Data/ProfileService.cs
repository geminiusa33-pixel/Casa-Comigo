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
            throw new ProfileValidationException("O nome tem de ter pelo menos dois caracteres.");

        if (request.PreferredHousemates is < 2 or > 20)
            throw new ProfileValidationException("Escolhe entre 2 e 20 pessoas no total, incluindo-te.");

        if (RentContributionRanges.GetBounds(request.RentContributionRange) is null)
            throw new ProfileValidationException("Escolhe um escalão válido para a contribuição mensal de renda.");

        var interests = request.Interests
            .Select(interest => interest.Trim())
            .Where(interest => interest.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (interests.Length > 20 || interests.Any(interest => interest.Length > 50))
            throw new ProfileValidationException("Indica até 20 interesses, cada um com no máximo 50 caracteres.");

        if (request.DiscoveryVisible && !await repository.HasSearchAreaAsync(profileId, cancellationToken))
            throw new ProfileValidationException("Guarda primeiro uma zona de procura antes de ativares a descoberta.");

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
            throw new ProfileValidationException("Indica uma cidade ou área aproximada.");

        if (!double.IsFinite(request.Latitude) || !double.IsFinite(request.Longitude)
            || !double.IsFinite(request.RadiusKm))
            throw new ProfileValidationException("A localização e o raio têm de ser valores numéricos válidos.");

        if (request.RadiusKm < 5 || request.RadiusKm > 50 || request.RadiusKm % 5 != 0)
            throw new ProfileValidationException("Escolhe um raio entre 5 e 50 km, em intervalos de 5 km.");

        return repository.SaveSearchAreaAsync(
            profileId,
            request with { AreaLabel = areaLabel },
            cancellationToken);
    }
}
