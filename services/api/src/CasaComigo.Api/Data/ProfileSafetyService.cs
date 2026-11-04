using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <inheritdoc />
public sealed class ProfileSafetyService(IProfileSafetyRepository repository) : IProfileSafetyService
{
    /// <inheritdoc />
    public Task BlockAsync(Guid blockerId, Guid blockedId, CancellationToken cancellationToken)
    {
        if (blockerId == blockedId)
            throw new ProfileValidationException("Não pode bloquear o seu próprio perfil.");

        return repository.BlockAsync(blockerId, blockedId, cancellationToken);
    }

    /// <inheritdoc />
    public Task UnblockAsync(Guid blockerId, Guid blockedId, CancellationToken cancellationToken)
    {
        if (blockerId == blockedId)
            throw new ProfileValidationException("Não pode desbloquear o seu próprio perfil.");

        return repository.UnblockAsync(blockerId, blockedId, cancellationToken);
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<BlockedProfileResponse>> GetBlockedProfilesAsync(
        Guid blockerId,
        CancellationToken cancellationToken) =>
        repository.GetBlockedProfilesAsync(blockerId, cancellationToken);

    /// <inheritdoc />
    public Task<ProfileReportResponse> ReportAsync(
        Guid reporterId,
        Guid reportedId,
        CreateProfileReportRequest request,
        CancellationToken cancellationToken)
    {
        if (reporterId == reportedId)
            throw new ProfileValidationException("Não pode denunciar o seu próprio perfil.");

        var reason = request.Reason.Trim();
        if (reason.Length < 5)
            throw new ProfileValidationException("Descreva o motivo da denúncia com pelo menos cinco caracteres.");

        return repository.ReportAsync(reporterId, reportedId, reason, cancellationToken);
    }
}
