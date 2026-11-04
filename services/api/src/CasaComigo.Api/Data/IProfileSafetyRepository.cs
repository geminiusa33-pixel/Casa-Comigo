using CasaComigo.Api.Contracts;

namespace CasaComigo.Api.Data;

/// <summary>Data access for blocking and reporting profiles.</summary>
public interface IProfileSafetyRepository
{
    /// <summary>Blocks a profile; repeated requests are idempotent.</summary>
    Task BlockAsync(Guid blockerId, Guid blockedId, CancellationToken cancellationToken);

    /// <summary>Removes a block created by the current profile.</summary>
    Task UnblockAsync(Guid blockerId, Guid blockedId, CancellationToken cancellationToken);

    /// <summary>Lists profiles blocked by the current profile.</summary>
    Task<IReadOnlyList<BlockedProfileResponse>> GetBlockedProfilesAsync(
        Guid blockerId,
        CancellationToken cancellationToken);

    /// <summary>Stores a report, enforcing a per-profile cooldown.</summary>
    Task<ProfileReportResponse> ReportAsync(
        Guid reporterId,
        Guid reportedId,
        string reason,
        CancellationToken cancellationToken);
}
